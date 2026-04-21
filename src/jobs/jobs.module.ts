import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobEntity } from './entities/job.entity';
import { JobSkillTagEntity } from './entities/job-skill-tag.entity';
import { JobStatusHistoryEntity } from './entities/job-status-history.entity';
import { JobInvitationEntity } from './entities/job-invitation.entity';
import { MetadataModule } from '../metadata/metadata.module';
import { EmployersModule } from '../employers/employers.module';
import { JobSkillsService } from './job-skills.service';

// New Services
import { PublicJobsService } from './services/public-jobs.service';
import { EmployerJobsService } from './services/employer-jobs.service';
import { AdminJobsService } from './services/admin-jobs.service';
import { JobTasksService } from './services/job-tasks.service';

// New Controllers
import { PublicJobsController } from './controllers/public-jobs.controller';
import { EmployerJobsController } from './controllers/employer-jobs.controller';
import { AdminJobsController } from './controllers/admin-jobs.controller';

import { NotificationsModule } from '../notifications/notifications.module';
import { UserEntity } from '../users/entities/user.entity';
import { CommonGuardsModule } from '../common/guards/common-guards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobEntity,
      JobSkillTagEntity,
      JobStatusHistoryEntity,
      JobInvitationEntity,
      UserEntity,
    ]),
    MetadataModule,
    EmployersModule,
    NotificationsModule,
    CommonGuardsModule,
  ],
  controllers: [
    PublicJobsController,
    EmployerJobsController,
    AdminJobsController,
  ],
  providers: [
    JobSkillsService,
    PublicJobsService,
    EmployerJobsService,
    AdminJobsService,
    JobTasksService,
  ],
  exports: [
    PublicJobsService,
    EmployerJobsService,
    AdminJobsService,
    JobTasksService,
  ],
})
export class JobsModule {}
