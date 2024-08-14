import { Request, Response } from 'express';
import { prisma } from '../database/prisma';
import stripe from '../database/stripe';
import Stripe from "stripe";

const formatPrice = (amountInCents: number): string => {
  const amountInReais = amountInCents / 100;
  return amountInReais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { products, userSellerId } = req.body;
    const { id: buyerId } = req.user;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Products are required' });
    }

    if (!userSellerId) {
      return res.status(400).json({ error: 'Seller ID is required' });
    }

    const seller = await prisma.user.findUnique({
      where: { id: userSellerId },
      select: { id: true, name: true }
    });

    const buyer = await prisma.user.findUnique({
      where: { id: buyerId },
      select: { id: true, name: true, email: true }
    });

    if (!seller) {
      return res.status(400).json({ error: 'Seller not found' });
    }

    if (!buyer) {
      return res.status(400).json({ error: 'Buyer not found' });
    }

    const productIds = products.map((product: any) => product.id);
    const productsByDatabase = await prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
    });

    if (productsByDatabase.length !== products.length) {
      return res.status(400).json({ error: 'Some products not found in database' });
    }

    const lineItems = productsByDatabase.map((product) => {
      const { id, name, price } = product;
      const quantity = products.find((p: any) => p.id === product.id).quantity;
      return {
        price_data: {
          currency: 'brl',
          product_data: {
            name,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity,
      };
    });

    const address = await prisma.address.findUnique({
      where: { userId: buyerId },
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: {
        buyerId,
        userSellerId,
        products: JSON.stringify(products),
        address: address ? JSON.stringify(address) : null,
      },
    });

    const formattedLineItems = lineItems.map(item => ({
      ...item,
      price_data: {
        ...item.price_data,
        unit_amount: formatPrice(item.price_data.unit_amount)
      }
    }));

    res.status(200).json({
      sessionId: session.id,
      lineItems: formattedLineItems,
      seller,
      buyer
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create checkout session' });
  }
};


export const getAllSessions = async (req: Request, res: Response) => {
  try {
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
    });
    
    const sessionsWithMetadata = sessions.data.map(session => ({
      id: session.id,
      email: session.customer_details,
      metadata: session.metadata,
    }));

    res.status(200).json(sessionsWithMetadata);
  } catch (error) {
    console.error('Erro ao buscar sessões:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

export const getSessionById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const session = await stripe.checkout.sessions.retrieve(id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionData = {
      id: session.id,
      email: session.customer_details,
      metadata: session.metadata,
    };

    res.status(200).json(sessionData);
  } catch (error) {
    console.error('Erro ao buscar sessão:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
};


export const getUserSessions = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
    });

    // Verifique se o metadata e o buyerId estão definidos antes de filtrar
    const userSessions = sessions.data.filter(session => 
      session.metadata && session.metadata.buyerId === id
    );

    const sessionsWithMetadata = userSessions.map(session => ({
      id: session.id,
      email: session.customer_details?.email || 'N/A',
      metadata: session.metadata || {},
    }));

    res.status(200).json(sessionsWithMetadata);
  } catch (error) {
    console.error('Erro ao buscar sessões do usuário:', error);
    res.status(500).json({ error: 'Failed to fetch user sessions' });
  }
};
