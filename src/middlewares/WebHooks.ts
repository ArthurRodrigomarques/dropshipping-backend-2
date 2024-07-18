import { Request, Response } from "express";
import stripe from '../database/stripe';
import { prisma } from "../database/prisma";

export const createCheckoutSession = async (req: Request, res: Response) => {
    try {
      const { products, userSellerId } = req.body;
      const { id } = req.user;
  
      const productsByDatabase = await prisma.product.findMany({
        where: {
          id: { in: products.map((product: any) => product.id) },
        },
      });
  
      const lineItems = productsByDatabase.map((product) => {
        const { id, name, price } = product;
        const quantity = products.find((p: any) => p.id === product.id).quantity;
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity,
        };
      });
  
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      });
  
      res.status(200).json({ sessionId: session.id });
    } catch (error) {
      res.status(400).json(error);
    }
  };


  
export const handleWebhook = (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${Error}`);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      // Handle the checkout session completion
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).end();
};
