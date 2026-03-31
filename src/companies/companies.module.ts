import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { AdminCompaniesController } from './admin-companies.controller';
import { CompanyEntity } from './entities/company.entity';
import { CompanyImageEntity } from './entities/company-image.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyEntity, CompanyImageEntity]),
    StorageModule,
  ],
  controllers: [CompaniesController, AdminCompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
