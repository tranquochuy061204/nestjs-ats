import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';

const config: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [path.join(__dirname, 'src', '**', '*.entity.{js,ts}')],
  migrations: [path.join(__dirname, 'src', 'migrations', '*.{js,ts}')],
  synchronize: false,
  migrationsRun: true,
  migrationsTableName: 'migrations',
};

export const dataSource = new DataSource(config);

export default config;
