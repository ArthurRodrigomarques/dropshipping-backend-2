import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';
import uploadImage from '../database/firebase';

export const createProduct = async (req: Request, res: Response) => {
  const { name, price, amount, description } = req.body;
  const { storeId } = req.params;

  try {
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        amount: parseInt(amount, 10),
        Store: {
          connect: {
            id: storeId,
          },
        },
      },
    });

    const imageUploadPromises = (req.files as Express.Multer.File[]).map(async (file) => {
      const request = { file } as any;
      await new Promise<void>((resolve, reject) => {
        uploadImage(request, res, async () => {
          if (request.file.firebaseUrl) {
            try {
              await prisma.productImage.create({
                data: {
                  imageUrl: request.file.firebaseUrl,
                  productId: product.id,
                },
              });
              resolve();
            } catch (error) {
              reject(error);
            }
          } else {
            resolve();
          }
        });
      });
    });

    await Promise.all(imageUploadPromises);

    return res.status(201).json(product);
  } catch (error) {
    return res.status(400).json({ message: 'Erro ao criar o produto', error });
  }
};

export const getAllProducts = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const perPage = parseInt(req.query.perPage as string, 10) || 10;

  try {
    const products = await prisma.product.findMany({
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        images: true,
      },
    });

    return res.status(200).json(products);
  } catch (error) {
    return res.status(400).json({ message: 'Erro ao buscar os produtos', error });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  const { name, price, amount, description } = req.body;
  const { productId } = req.params;
  const { id } = req.user as Prisma.UserWhereUniqueInput;

  try {
    const existingProduct = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      include: {
        Store: true,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }

    if (id !== existingProduct?.Store?.userId) {
      return res.status(403).json({ message: 'Este produto não pertence a esse usuário' });
    }

    const updatedProduct = await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        name,
        description,
        price: parseFloat(price),
        amount: parseInt(amount, 10),
      },
    });

    return res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Erro ao atualizar o produto:', error);
    return res.status(400).json({ message: 'Erro ao atualizar o produto', error });
  }
};

export const getUniqueProduct = async (req: Request, res: Response) => {
  const { productId } = req.params;

  try {
    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        amount: true,
        images: true,
      },
    });

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }

    return res.status(200).json(product);
  } catch (error) {
    return res.status(400).json({ message: 'Erro ao buscar o produto', error });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { id } = req.user as Prisma.UserWhereUniqueInput;

  try {
    const existingProduct = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      include: {
        Store: true,
        images: true,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }

    if (id !== existingProduct?.Store?.userId) {
      return res.status(403).json({ message: 'Este produto não pertence a esse usuário' });
    }

    // Deletar todas as imagens associadas ao produto
    await prisma.productImage.deleteMany({
      where: {
        productId: productId,
      },
    });

    // Deletar o produto
    await prisma.product.delete({
      where: {
        id: productId,
      },
    });

    return res.status(204).json({ message: 'Produto deletado com sucesso' });
  } catch (error) {
    return res.status(400).json({ message: 'Erro ao deletar o produto', error });
  }
};