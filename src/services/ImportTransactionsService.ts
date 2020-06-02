import fs from 'fs';
import csvParse from 'csv-parse';
import path from 'path';
import { getCustomRepository, getRepository, In } from 'typeorm';

import CreateTransactionService from './CreateTransactionService';
import TransactionsRepository from '../repositories/TransactionsRepository';
import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface RequestDTO {
  filePath: string;
}
interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute({ filePath }: RequestDTO): Promise<Transaction[]> {
    const readStream = fs.createReadStream(filePath);
    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getRepository(Transaction);
    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    const parseStream = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });

    const parseFile = readStream.pipe(parseStream);

    parseFile.on('data', line => {
      const [title, type, value, category] = line;

      if (!title || !type || !value) return;

      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => {
      parseFile.on('end', resolve);
    });

    // get all existent categories
    const existentCategories = await categoriesRepository.find();
    const existentCategoriesTitles = (await categoriesRepository.find()).map(
      (category: Category) => category.title,
    );

    // before filter, get only unique values, then, filter to get only new titles
    const uniqueCategories = Array.from(new Set(categories)).filter(
      category => !existentCategoriesTitles.includes(category),
    );

    const newCategories = categoriesRepository.create(
      uniqueCategories.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);

    const allCategories = [...newCategories, ...existentCategories];

    const createdTransactions = transactionsRepository.create(
      transactions.map(
        ({ title, type, value, category: transactionCategory }) => ({
          title,
          type,
          value,
          category: allCategories.find(
            category => category.title === transactionCategory,
          ),
        }),
      ),
    );

    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
