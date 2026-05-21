import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';

const config: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [path.join(__dirname, '**', '*.entity.{js,ts}')],
  migrations: [path.join(__dirname, 'migrations', '*.{js,ts}')],
  synchronize: false,
  migrationsRun: true,
  migrationsTableName: 'migrations',
  logging: ['error'],
  extra: {
    timezone: 'Asia/Ho_Chi_Minh',
  },
};

export const dataSource = new DataSource(config);

export default config;
