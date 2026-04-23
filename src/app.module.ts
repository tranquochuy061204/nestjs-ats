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
import { JobsModule } from './jobs/jobs.module';
import { ApplicationsModule } from './applications/applications.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';
import config from '../typeorm.config';
import { MailModule } from './mail/mail.module';
import { AiProviderModule } from './common/ai/ai-provider.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(config),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    CandidatesModule,
    MetadataModule,
    StorageModule,
    EmployersModule,
    CompaniesModule,
    JobsModule,
    ApplicationsModule,
    NotificationsModule,
    AiProviderModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
