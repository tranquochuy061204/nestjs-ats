import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobSkillsService } from './job-skills.service';
import { JobEntity } from './entities/job.entity';
import { JobSkillTagEntity } from './entities/job-skill-tag.entity';
import { JobStatusHistoryEntity } from './entities/job-status-history.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { MetadataModule } from '../metadata/metadata.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobEntity,
      JobSkillTagEntity,
      JobStatusHistoryEntity,
      EmployerEntity,
    ]),
    MetadataModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, JobSkillsService],
  exports: [JobsService],
})
export class JobsModule {}
