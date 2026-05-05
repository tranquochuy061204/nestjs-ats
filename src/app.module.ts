// Core & Config
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import config from '../typeorm.config';

// App Base
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Core Business & Auth
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

// Actors (Candidate & Employer)
import { CandidatesModule } from './candidates/candidates.module';
import { EmployersModule } from './employers/employers.module';
import { CompaniesModule } from './companies/companies.module';

// Job & Application
import { JobsModule } from './jobs/jobs.module';
import { ApplicationsModule } from './applications/applications.module';
import { ScreeningModule } from './screening/screening.module';

// Monetization
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { CreditsModule } from './credits/credits.module';
import { PaymentsModule } from './payments/payments.module';

// Admin
import { AdminModule } from './admin/admin.module';

// Shared Services
import { MetadataModule } from './metadata/metadata.module';
import { StorageModule } from './storage/storage.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MailModule } from './mail/mail.module';
import { AiProviderModule } from './common/ai/ai-provider.module';

@Module({
  imports: [
    // Core
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(config),
    ScheduleModule.forRoot(),

    // Shared Services
    MetadataModule,
    StorageModule,
    NotificationsModule,
    AiProviderModule,
    MailModule,

    // Core Business
    AuthModule,
    UsersModule,

    // Actors
    CandidatesModule,
    EmployersModule,
    CompaniesModule,

    // Job & Application
    JobsModule,
    ApplicationsModule,
    ScreeningModule,

    // Monetization
    SubscriptionsModule,
    CreditsModule,
    PaymentsModule,

    // Admin
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
