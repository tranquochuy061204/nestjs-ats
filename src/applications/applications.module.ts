import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobApplicationEntity } from './entities/job-application.entity';
import { ApplicationStatusHistoryEntity } from './entities/application-status-history.entity';
import { ApplicationNoteEntity } from './entities/application-note.entity';
import { CandidateEntity } from '../candidates/entities/candidate.entity';
import { JobEntity } from '../jobs/entities/job.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { CandidateApplicationsService } from './candidate-applications.service';
import { EmployerApplicationsService } from './employer-applications.service';
import { CandidateApplicationsController } from './candidate-applications.controller';
import { EmployerApplicationsController } from './employer-applications.controller';
import { ApplicationScoringService } from './application-scoring.service';
import { ApplicationStatusService } from './application-status.service';
import { ApplicationNotesService } from './application-notes.service';
import { ApplicationPipelineFeeService } from './application-pipeline-fee.service';

import { UserEntity } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonGuardsModule } from '../common/guards/common-guards.module';
import { SocketModule } from '../common/socket/socket.module';
import { MailModule } from '../mail/mail.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CreditsModule } from '../credits/credits.module';
import { JobProfileViewEntity } from '../subscriptions/entities/job-profile-view.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobApplicationEntity,
      ApplicationStatusHistoryEntity,
      ApplicationNoteEntity,
      CandidateEntity,
      JobEntity,
      EmployerEntity,
      UserEntity,
      JobProfileViewEntity,
    ]),
    NotificationsModule,
    CommonGuardsModule,
    SocketModule,
    MailModule,
    SubscriptionsModule,
    CreditsModule,
  ],
  controllers: [
    CandidateApplicationsController,
    EmployerApplicationsController,
  ],
  providers: [
    CandidateApplicationsService,
    EmployerApplicationsService,
    ApplicationScoringService,
    ApplicationStatusService,
    ApplicationNotesService,
    ApplicationPipelineFeeService,
  ],
  exports: [CandidateApplicationsService, ApplicationScoringService],
})
export class ApplicationsModule {}
