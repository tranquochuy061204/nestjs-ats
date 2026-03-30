import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobEntity } from './entities/job.entity';
import { JobSkillTagEntity } from './entities/job-skill-tag.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { MetadataModule } from '../metadata/metadata.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobEntity, JobSkillTagEntity, EmployerEntity]),
    MetadataModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
