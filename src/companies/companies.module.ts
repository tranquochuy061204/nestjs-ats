// Core
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Controllers
import { CompaniesController } from './companies.controller';
import { AdminCompaniesController } from './admin-companies.controller';

// Services
import { CompaniesService } from './companies.service';

// Entities
import { CompanyEntity } from './entities/company.entity';
import { CompanyImageEntity } from './entities/company-image.entity';
import { CompanyStatusHistoryEntity } from './entities/company-status-history.entity';

// Modules
import { StorageModule } from '../storage/storage.module';
import { JobsModule } from '../jobs/jobs.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      CompanyImageEntity,
      CompanyStatusHistoryEntity,
    ]),
    StorageModule,
    JobsModule,
    SubscriptionsModule,
  ],
  controllers: [CompaniesController, AdminCompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
