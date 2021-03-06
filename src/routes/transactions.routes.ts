import { Router, Request, Response } from 'express';
import { getCustomRepository } from 'typeorm';
import multer from 'multer';

import TransactionsRepository from '../repositories/TransactionsRepository';
import CreateTransactionService from '../services/CreateTransactionService';
import DeleteTransactionService from '../services/DeleteTransactionService';
import ImportTransactionsService from '../services/ImportTransactionsService';

import uploadConfig from '../config/upload';

const transactionsRouter = Router();
const upload = multer(uploadConfig);

transactionsRouter.get('/', async (request: Request, response: Response) => {
  const { page = 1 } = request.query;

  const transactionRepository = getCustomRepository(TransactionsRepository);

  const count = String(await transactionRepository.count());

  const transactions = await transactionRepository.getTransactions(
    Number(page),
  );
  const balance = await transactionRepository.getBalance();

  response.header('X-Total-Count', count);

  return response.json({ transactions, balance });
});

transactionsRouter.post('/', async (request, response) => {
  const { title, value, type, category } = request.body;

  const createTransaction = new CreateTransactionService();

  const transaction = await createTransaction.execute({
    title,
    value,
    type,
    category,
  });

  return response.json(transaction);
});

transactionsRouter.delete('/:id', async (request, response) => {
  const { id } = request.params;

  const deleteTransaction = new DeleteTransactionService();

  await deleteTransaction.execute(id);

  return response.status(204).send();
});

transactionsRouter.post(
  '/import',
  upload.single('file'),
  async (request, response) => {
    const importTransaction = new ImportTransactionsService();
    const filePath = request.file.path;

    const transactions = await importTransaction.execute({ filePath });

    return response.json(transactions);
  },
);

export default transactionsRouter;
