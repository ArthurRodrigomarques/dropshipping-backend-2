import { Request, Response } from "express";
import stripe from '../database/stripe';
import { prisma } from "../database/prisma";
import Stripe from "stripe";

export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    console.log('Evento recebido:', event.type);
  } catch (error) {
    console.error('Erro de Webhook:', error);
    return res.status(400).send(`Webhook Error: ${error}`);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;

      if (metadata) {
        const { buyerId, userSellerId, products, address } = metadata;

        if (buyerId && userSellerId && products) {
          const parsedProducts = JSON.parse(products);
          const parsedAddress = address ? JSON.parse(address) : null;

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
            // Criar a venda no banco de dados
            const sale = await prisma.sale.create({
              data: {
                total_value: total,
                Seller: { connect: { id: userSellerId } },
                Buyer: { connect: { id: buyerId } },
                Address: parsedAddress ? {
                  connect: { id: parsedAddress.id }
                } : undefined,
                SaleProduct: {
                  create: productWithQuantity.map((product) => ({
                    Product: { connect: { id: product.id } },
                    quantity: product.quantity,
                  })),
                },
              },
              include: {
                SaleProduct: true,
                Address: true,
              },
            });

            // Atualizar a quantidade dos produtos
            for (const product of productWithQuantity) {
              await prisma.product.updateMany({
                where: { id: product.id },
                data: {
                  amount: {
                    decrement: parseInt(product.quantity),
                  },
                },
              });
            }

            await prisma.sale.update({
              where: { id: sale.id },
              data: { stripeSessionId: session.id },
            });

            console.log({ sale, message: "Compra realizada com sucesso." });
          } catch (error) {
            console.error(error);
          }
        }

      } else {
        console.error('Metadata não encontrada na sessão do checkout');
        return res.status(400).json({ error: 'Metadata não encontrada na sessão do checkout' });
      }

      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).end();
};
