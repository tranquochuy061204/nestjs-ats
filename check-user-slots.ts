import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SubscriptionsService } from './src/subscriptions/subscriptions.service';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  
  const email = 'tnxgxg3@gmail.com';
  const user = await dataSource.query('SELECT u.id as user_id, e.company_id FROM "user" u JOIN employer e ON u.id = e.user_id WHERE u.email = $1', [email]);
  
  if (user.length > 0) {
    const companyId = user[0].company_id;
    console.log('--- USER/COMPANY INFO ---');
    console.log(`User ID: ${user[0].user_id}`);
    console.log(`Company ID: ${companyId}`);
    
    const subService = app.get(SubscriptionsService);
    const activeSub = await subService.getActiveSubscription(companyId);
    console.log('\n--- SUBSCRIPTION INFO ---');
    console.log('Package:', activeSub.package.name);
    console.log('Max Active Jobs (base):', activeSub.package.maxActiveJobs);
    console.log('Extra Slots:', activeSub.extraSlots);
    console.log('Effective Max Jobs:', activeSub.effectiveMaxJobs);
    
    const statusCounts = await dataSource.query(
      'SELECT status, COUNT(*) as count FROM job WHERE company_id = $1 AND status IN (\'pending\', \'published\') GROUP BY status',
      [companyId]
    );
    console.log('\n--- ACTIVE JOBS COUNTS ---');
    console.log(statusCounts);
    
    const purchaseLogs = await dataSource.query(
      'SELECT pl.*, p.slug FROM credit_purchase_log pl JOIN credit_product p ON p.id = pl.product_id WHERE pl.company_id = $1 AND p.slug = \'extra_job_slot\'',
      [companyId]
    );
    console.log('\n--- EXTRA SLOTS PURCHASE LOGS ---');
    console.log(purchaseLogs);

    const checkLock = await subService.checkJobSlotLock(companyId);
    console.log('\n--- SLOT LOCK CHECK ---');
    console.log(checkLock);
    
  } else {
    console.log('User not found');
  }
  
  await app.close();
}

bootstrap();
