// Core
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Controllers
import { EmployersController } from './employers.controller';
import { EmployerHeadhuntingController } from './employer-headhunting.controller';
import { EmployerDashboardController } from './employer-dashboard.controller';

// Services
import { EmployersService } from './employers.service';
import { EmployerCandidateMatchingService } from './services/employer-candidate-matching.service';
import { EmployerContactUnlockService } from './services/employer-contact-unlock.service';
import { EmployerTalentPoolService } from './services/employer-talent-pool.service';
import { EmployerInvitationService } from './services/employer-invitation.service';
import { EmployerCompanyDashboardService } from './services/employer-company-dashboard.service';
import { EmployerJobDashboardService } from './services/employer-job-dashboard.service';

// Entities
import { EmployerEntity } from './entities/employer.entity';
import { SavedCandidateEntity } from './entities/saved-candidate.entity';

// External Entities
import { CompanyEntity } from '../companies/entities/company.entity';
import { CandidateEntity } from '../candidates/entities/candidate.entity';
import { JobEntity } from '../jobs/entities/job.entity';
import { JobInvitationEntity } from '../jobs/entities/job-invitation.entity';
import { CertificateEntity } from '../candidates/entities/certificate.entity';
import { UserEntity } from '../users/entities/user.entity';
import { ContactUnlockLogEntity } from '../subscriptions/entities/contact-unlock-log.entity';
import { JobApplicationEntity } from '../applications/entities/job-application.entity';

// Modules
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { CandidatesModule } from '../candidates/candidates.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployerEntity,
      CompanyEntity,
      SavedCandidateEntity,
      CandidateEntity,
      JobEntity,
      JobInvitationEntity,
      CertificateEntity,
      UserEntity,
      ContactUnlockLogEntity,
      JobApplicationEntity,
    ]),
    StorageModule,
    NotificationsModule,
    MailModule,
    forwardRef(() => CandidatesModule),
    SubscriptionsModule,
    CreditsModule,
  ],
  controllers: [
    EmployersController,
    EmployerHeadhuntingController,
    EmployerDashboardController,
  ],
  providers: [
    EmployersService,
    EmployerCandidateMatchingService,
    EmployerContactUnlockService,
    EmployerTalentPoolService,
    EmployerInvitationService,
    EmployerCompanyDashboardService,
    EmployerJobDashboardService,
  ],
  exports: [EmployersService],
})
export class EmployersModule {}
