import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { UserEntity } from '../users/entities/user.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
import { JobEntity } from '../jobs/entities/job.entity';
import { JobApplicationEntity } from '../applications/entities/job-application.entity';
import { PaymentOrderEntity } from '../payments/entities/payment-order.entity';
import { CreditTransactionEntity } from '../credits/entities/credit-transaction.entity';
import { CreditWalletEntity } from '../credits/entities/credit-wallet.entity';
import { CreditPackageEntity } from '../credits/entities/credit-package.entity';
import { CompanySubscriptionEntity } from '../subscriptions/entities/company-subscription.entity';
import { SubscriptionPackageEntity } from '../subscriptions/entities/subscription-package.entity';

// Audit Logs
import { AdminAuditLogsModule } from './audit-logs/admin-audit-logs.module';

// Stats
import { AdminStatsController } from './stats/admin-stats.controller';
import { AdminStatsService } from './stats/admin-stats.service';

// VIP
import { AdminVipController } from './vip/admin-vip.controller';
import { AdminVipService } from './vip/admin-vip.service';

// Credits
import { AdminCreditsController } from './credits/admin-credits.controller';
import { AdminCreditsService } from './credits/admin-credits.service';

// Companies
import { AdminCompaniesController } from './companies/admin-companies.controller';
import { AdminCompaniesService } from './companies/admin-companies.service';

// Users
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';

@Module({
  imports: [
    AdminAuditLogsModule,
    TypeOrmModule.forFeature([
      UserEntity,
      CompanyEntity,
      JobEntity,
      JobApplicationEntity,
      PaymentOrderEntity,
      CreditTransactionEntity,
      CreditWalletEntity,
      CreditPackageEntity,
      CompanySubscriptionEntity,
      SubscriptionPackageEntity,
    ]),
  ],
  controllers: [
    AdminStatsController,
    AdminVipController,
    AdminCreditsController,
    AdminCompaniesController,
    AdminUsersController,
  ],
  providers: [
    AdminStatsService,
    AdminVipService,
    AdminCreditsService,
    AdminCompaniesService,
    AdminUsersService,
  ],
})
export class AdminModule {}
