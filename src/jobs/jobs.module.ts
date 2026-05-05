// Core
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Controllers
import { PublicJobsController } from './controllers/public-jobs.controller';
import { EmployerJobsController } from './controllers/employer-jobs.controller';
import { AdminJobsController } from './controllers/admin-jobs.controller';
import { CandidateJobsController } from './controllers/candidate-jobs.controller';

// Services
import { JobSkillsService } from './job-skills.service';
import { PublicJobsService } from './services/public-jobs.service';
import { EmployerJobsService } from './services/employer-jobs.service';
import { AdminJobsService } from './services/admin-jobs.service';
import { JobTasksService } from './services/job-tasks.service';
import { CandidateJobsService } from './services/candidate-jobs.service';
import { EmployerJobBumpService } from './services/employer-job-bump.service';

// Entities
import { JobEntity } from './entities/job.entity';
import { JobSkillTagEntity } from './entities/job-skill-tag.entity';
import { JobStatusHistoryEntity } from './entities/job-status-history.entity';
import { JobInvitationEntity } from './entities/job-invitation.entity';

// External Entities
import { UserEntity } from '../users/entities/user.entity';
import { CandidateEntity } from '../candidates/entities/candidate.entity';

// Modules
import { MetadataModule } from '../metadata/metadata.module';
import { EmployersModule } from '../employers/employers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonGuardsModule } from '../common/guards/common-guards.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobEntity,
      JobSkillTagEntity,
      JobStatusHistoryEntity,
      JobInvitationEntity,
      UserEntity,
      CandidateEntity,
    ]),
    MetadataModule,
    EmployersModule,
    NotificationsModule,
    CommonGuardsModule,
    SubscriptionsModule,
    CreditsModule,
  ],
  controllers: [
    PublicJobsController,
    EmployerJobsController,
    AdminJobsController,
    CandidateJobsController,
  ],
  providers: [
    JobSkillsService,
    PublicJobsService,
    EmployerJobsService,
    AdminJobsService,
    JobTasksService,
    CandidateJobsService,
    EmployerJobBumpService,
  ],
  exports: [
    PublicJobsService,
    EmployerJobsService,
    AdminJobsService,
    JobTasksService,
  ],
})
export class JobsModule {}
