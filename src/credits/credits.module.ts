import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';
import { CreditWalletEntity } from './entities/credit-wallet.entity';
import { CreditTransactionEntity } from './entities/credit-transaction.entity';
import { CreditProductEntity } from './entities/credit-product.entity';
import { CreditPurchaseLogEntity } from './entities/credit-purchase-log.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { JobEntity } from '../jobs/entities/job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreditWalletEntity,
      CreditTransactionEntity,
      CreditProductEntity,
      CreditPurchaseLogEntity,
      EmployerEntity,
      JobEntity,
    ]),
  ],
  controllers: [CreditsController],
  providers: [CreditsService],
  exports: [CreditsService, TypeOrmModule],
})
export class CreditsModule {}
