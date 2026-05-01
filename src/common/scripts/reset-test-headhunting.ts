import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('--- RESETTING HEADHUNTING TEST DATA ---');

  try {
    await dataSource.transaction(async (manager) => {
      // 1. Delete all unlock logs
      console.log('Deleting contact_unlock_log...');
      await manager.query('DELETE FROM contact_unlock_log');

      // 2. Reset headhunting usage in subscriptions
      console.log('Resetting headhunting_views_used in company_subscription...');
      await manager.query(`
        UPDATE company_subscription 
        SET headhunting_views_used = 0, 
            headhunting_views_reset_at = NULL
      `);

      // 3. Optional: Reset wallets to a healthy testing balance
      console.log('Setting credit_wallet balance to 1000 for all companies...');
      await manager.query('UPDATE credit_wallet SET balance = 1000');

      // 4. Optional: Clear transactions to keep history clean
      console.log('Deleting credit_transaction history...');
      await manager.query('DELETE FROM credit_transaction');
    });

    console.log('✅ Success: All headhunting test data reset.');
  } catch (error) {
    console.error('❌ Error during reset:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
