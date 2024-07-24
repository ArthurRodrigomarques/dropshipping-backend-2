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
      select: { id: true, name: true }
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
        address: address ? JSON.stringify(address) : null,  // Adicionando endereço nos metadados
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

export const getOrdersForAdmin = async (req: Request, res: Response) => {
  try {
    const orders = await prisma.sale.findMany({
      include: {
        SaleProduct: {
          include: {
            Product: true,
          },
        },
        Address: true,
        Buyer: true,
        Seller: true,
      },
    });

    console.log('Pedidos:', orders);

    res.json(orders);
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
};



export const getOrderDetails = async (req: Request, res: Response) => {
  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id as string);

    if (!session.metadata || !session.metadata.saleId) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const sale = await prisma.sale.findUnique({
      where: { id: session.metadata.saleId },
      include: {
        Buyer: true,
        Seller: true,
        Address: true,
        SaleProduct: {
          include: {
            Product: true,
          },
        },
      },
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json(sale);
  } catch (error) {
    console.error('Erro ao buscar detalhes da venda:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes da venda' });
  }
};