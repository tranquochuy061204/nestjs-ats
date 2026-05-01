import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployersService } from './employers.service';
import { EmployersController } from './employers.controller';
import { EmployerEntity } from './entities/employer.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
import { SavedCandidateEntity } from './entities/saved-candidate.entity';
import { CandidateEntity } from '../candidates/entities/candidate.entity';
import { JobEntity } from '../jobs/entities/job.entity';
import { JobInvitationEntity } from '../jobs/entities/job-invitation.entity';
import { CertificateEntity } from '../candidates/entities/certificate.entity';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { EmployerCandidateMatchingService } from './services/employer-candidate-matching.service';
import { EmployerContactUnlockService } from './services/employer-contact-unlock.service';
import { EmployerTalentPoolService } from './services/employer-talent-pool.service';
import { EmployerInvitationService } from './services/employer-invitation.service';
import { EmployerHeadhuntingController } from './employer-headhunting.controller';
import { UserEntity } from '../users/entities/user.entity';
import { EmployerCompanyDashboardService } from './services/employer-company-dashboard.service';
import { EmployerJobDashboardService } from './services/employer-job-dashboard.service';
import { EmployerDashboardController } from './employer-dashboard.controller';
import { CandidatesModule } from '../candidates/candidates.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CreditsModule } from '../credits/credits.module';
import { ContactUnlockLogEntity } from '../subscriptions/entities/contact-unlock-log.entity';

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
