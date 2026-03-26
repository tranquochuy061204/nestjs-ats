import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CandidatesModule } from './candidates/candidates.module';
import { MetadataModule } from './metadata/metadata.module';
import { StorageModule } from './storage/storage.module';
import { EmployersModule } from './employers/employers.module';
import { CompaniesModule } from './companies/companies.module';
import config from '../typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(config),
    AuthModule,
    UsersModule,
    CandidatesModule,
    MetadataModule,
    StorageModule,
    EmployersModule,
    CompaniesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
