import { Request, Response } from "express";
import stripe from '../database/stripe';
import { prisma } from "../database/prisma";
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

    // Obter dados do vendedor e comprador
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



export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error}`);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      const { buyerId, userSellerId, products } = session.metadata || {};

      if (buyerId && userSellerId && products) {
        const parsedProducts = JSON.parse(products);

        const productsByDatabase = await prisma.product.findMany({
          where: {
            id: { in: parsedProducts.map((product: any) => product.id) },
          },
        });

        const productWithQuantity = productsByDatabase.map((product) => {
          const { id, name, price } = product;
          const quantity = parsedProducts.find((p: any) => p.id === product.id).quantity;
          return {
            id,
            name,
            price,
            quantity,
          };
        });

        let total = 0;
        for (const product of productWithQuantity) {
          total += product.price * parseInt(product.quantity);
        }

        if (buyerId === userSellerId) {
          console.error("Não é possível criar uma venda com ID de comprador e vendedor iguais");
          return res.status(400).json({
            message: "Não é possível criar uma venda com ID de comprador e vendedor iguais",
          });
        }

        try {
          const sale = await prisma.sale.create({
            data: {
              total_value: total,
              Seller: { connect: { id: userSellerId } },
              Buyer: { connect: { id: buyerId } },
              SaleProduct: {
                create: productWithQuantity.map((product) => ({
                  Product: { connect: { id: product.id } },
                  quantity: product.quantity,
                })),
              },
            },
            include: {
              SaleProduct: true,
            },
          });

          productWithQuantity.map(async (product) => {
            await prisma.product.updateMany({
              where: { id: product.id },
              data: {
                amount: {
                  decrement: parseInt(product.quantity),
                },
              },
            });
          });

          console.log({ sale, message: "Compra realizada com sucesso." });
        } catch (error) {
          console.error(error);
        }
      }

      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).end();
};