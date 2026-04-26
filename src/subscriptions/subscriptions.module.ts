import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPackageEntity } from './entities/subscription-package.entity';
import { CompanySubscriptionEntity } from './entities/company-subscription.entity';
import { PipelineFeeConfigEntity } from './entities/pipeline-fee-config.entity';
import { JobProfileViewEntity } from './entities/job-profile-view.entity';
import { ContactUnlockLogEntity } from './entities/contact-unlock-log.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPackageEntity,
      CompanySubscriptionEntity,
      PipelineFeeConfigEntity,
      JobProfileViewEntity,
      ContactUnlockLogEntity,
      EmployerEntity,
    ]),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService, TypeOrmModule],
})
export class SubscriptionsModule {}
