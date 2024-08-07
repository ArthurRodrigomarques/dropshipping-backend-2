import { Request, Response } from 'express';
import { prisma }from '../database/prisma';

export const createAddress = async (req: Request, res: Response) => {
  const { street, city, state, country, zip, houseNumber, complement, neighborhood } = req.body;
  const { id } = req.user;

  try {
    const existingAddress = await prisma.address.findUnique({
      where: { userId: id },
    });

    if (existingAddress) {
      return res.status(400).json({ message: "Usuário já possui um endereço." });
    }

    const newAddress = await prisma.address.create({
      data: {
        street,
        city,
        state,
        country,
        zip,
        houseNumber,
        complement,
        neighborhood,
        userId: id,
      },
    });

    return res.status(201).json(newAddress);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao criar endereço.", error });
  }
};

export const getAddressById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const address = await prisma.address.findUnique({
      where: { userId: id },
    });

    if (!address) {
      return res.status(404).json({ message: "Endereço não encontrado" });
    }

    return res.status(200).json(address);
  } catch (error) {
    res.status(500).json({ error: 'Falha ao encontrar o endereço' });
  }
};

export const updateAddress = async (req: Request, res: Response) => {
  const { street, city, state, country, zip, houseNumber, complement, neighborhood } = req.body;
  const { id } = req.user;

  try {
    const existingAddress = await prisma.address.findUnique({
      where: { userId: id },
    });

    if (!existingAddress) {
      return res.status(404).json({ message: "Endereço não encontrado." });
    }

    const updatedAddress = await prisma.address.update({
      where: { userId: id },
      data: {
        street,
        city,
        state,
        country,
        zip,
        houseNumber,
        complement,
        neighborhood,
      },
    });

    return res.status(200).json(updatedAddress);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao atualizar endereço.", error });
  }
};


  export const deleteAddress = async (req: Request, res: Response) => {
    const { id } = req.user;
  
    try {
      const existingAddress = await prisma.address.findUnique({
        where: { userId: id },
      });
  
      if (!existingAddress) {
        return res.status(404).json({ message: "Endereço não encontrado." });
      }
  
      await prisma.address.delete({
        where: { userId: id },
      });
  
      return res.status(200).json({ message: "Endereço deletado com sucesso." });
    } catch (error) {
      return res.status(500).json({ message: "Erro ao deletar endereço.", error });
    }
  };