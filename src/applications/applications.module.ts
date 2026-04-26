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

import { UserEntity } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonGuardsModule } from '../common/guards/common-guards.module';
import { SocketModule } from '../common/socket/socket.module';
import { MailModule } from '../mail/mail.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CreditsModule } from '../credits/credits.module';

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
  providers: [CandidateApplicationsService, EmployerApplicationsService],
  exports: [CandidateApplicationsService],
})
export class ApplicationsModule {}
