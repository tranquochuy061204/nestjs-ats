import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidatesController } from './candidates.controller';
import { CandidateProfileService } from './services/candidate-profile.service';
import { CandidateExperienceService } from './services/candidate-experience.service';
import { CandidateSkillsService } from './services/candidate-skills.service';
import { CandidateCertificatesService } from './services/candidate-certificates.service';
import { CandidateEntity } from './entities/candidate.entity';
import { WorkExperienceEntity } from './entities/work-experience.entity';
import { EducationEntity } from './entities/education.entity';
import { ProjectEntity } from './entities/project.entity';
import { CandidateSkillTagEntity } from './entities/candidate-skill-tag.entity';
import { CertificateEntity } from './entities/certificate.entity';
import { AuthModule } from '../auth/auth.module';
import { MetadataModule } from '../metadata/metadata.module';
import { StorageModule } from '../storage/storage.module';
import { CandidateJobCategoryEntity } from './entities/candidate-job-category.entity';
import { JobCategoryMetadataEntity } from '../metadata/job-categories/job-category.entity';
import { JobTypeMetadataEntity } from '../metadata/job-types/job-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CandidateEntity,
      WorkExperienceEntity,
      EducationEntity,
      ProjectEntity,
      CandidateSkillTagEntity,
      CertificateEntity,
      CandidateJobCategoryEntity,
      JobCategoryMetadataEntity,
      JobTypeMetadataEntity,
    ]),
    AuthModule,
    MetadataModule,
    StorageModule,
  ],
  controllers: [CandidatesController],
  providers: [
    CandidateProfileService,
    CandidateExperienceService,
    CandidateSkillsService,
    CandidateCertificatesService,
  ],
})
export class CandidatesModule {}
