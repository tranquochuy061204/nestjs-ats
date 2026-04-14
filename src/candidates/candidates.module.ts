import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateProfileController } from './candidate-profile.controller';
import { CandidateExperienceController } from './candidate-experience.controller';
import { CandidateSkillsController } from './candidate-skills.controller';
import { CandidateProfileService } from './services/candidate-profile.service';
import { CandidateExperienceService } from './services/candidate-experience.service';
import { CandidateSkillsService } from './services/candidate-skills.service';
import { CandidateCertificatesService } from './services/candidate-certificates.service';
import { CandidateCvParserService } from './services/candidate-cv-parser.service';
import { CandidateHeadhuntingService } from './services/candidate-headhunting.service';
import { CandidateHeadhuntingController } from './candidate-headhunting.controller';
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
import { JobInvitationEntity } from '../jobs/entities/job-invitation.entity';
import { JobApplicationEntity } from '../applications/entities/job-application.entity';
import { ApplicationStatusHistoryEntity } from '../applications/entities/application-status-history.entity';

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
      JobInvitationEntity,
      JobApplicationEntity,
      ApplicationStatusHistoryEntity,
    ]),
    forwardRef(() => AuthModule),
    MetadataModule,
    StorageModule,
  ],
  controllers: [
    CandidateProfileController,
    CandidateExperienceController,
    CandidateSkillsController,
    CandidateHeadhuntingController,
  ],
  providers: [
    CandidateProfileService,
    CandidateExperienceService,
    CandidateSkillsService,
    CandidateCertificatesService,
    CandidateCvParserService,
    CandidateHeadhuntingService,
  ],
  exports: [CandidateProfileService],
})
export class CandidatesModule {}
