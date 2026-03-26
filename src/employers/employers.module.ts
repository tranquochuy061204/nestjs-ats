import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployersService } from './employers.service';
import { EmployersController } from './employers.controller';
import { EmployerEntity } from './entities/employer.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployerEntity, CompanyEntity]),
    StorageModule,
  ],
  controllers: [EmployersController],
  providers: [EmployersService],
  exports: [EmployersService],
})
export class EmployersModule {}
