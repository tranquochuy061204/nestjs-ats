import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPackageEntity } from './entities/subscription-package.entity';
import { CompanySubscriptionEntity } from './entities/company-subscription.entity';
import { JobProfileViewEntity } from './entities/job-profile-view.entity';
import { ContactUnlockLogEntity } from './entities/contact-unlock-log.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { CreditPurchaseLogEntity } from '../credits/entities/credit-purchase-log.entity';
import { CreditProductEntity } from '../credits/entities/credit-product.entity';
import { JobEntity } from '../jobs/entities/job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPackageEntity,
      CompanySubscriptionEntity,
      JobProfileViewEntity,
      ContactUnlockLogEntity,
      EmployerEntity,
      CreditPurchaseLogEntity,
      CreditProductEntity,
      JobEntity,
    ]),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService, TypeOrmModule],
})
export class SubscriptionsModule {}
