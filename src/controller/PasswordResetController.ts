import { Request, Response } from 'express';
import { prisma } from '../database/prisma';
import crypto from 'crypto';
import transporter from '../middlewares/emailTransporter';
import bcrypt from 'bcryptjs';

export const requestPasswordReset = async (req: Request, res: Response) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await prisma.passwordResetToken.create({
        data: {
            token,
            userId: user.id,
            expiresAt,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_FROM || "default-email@example.com",
        to: user.email,
        subject: 'Password Reset Request',
        text: `To reset your password, click the following link: ${process.env.FRONTEND_URL}/reset-password/${token}`,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ message: "Password reset email sent" });
    } catch (error) {
        console.error("Failed to send email:", error);
        res.status(500).json({ error: "Failed to send email" });
    }
};


export const resetPassword = async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!resetToken || resetToken.expiresAt < new Date()) {
        return res.status(400).json({ error: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
    });

    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });

    res.json({ message: "Password reset successful" });
};
