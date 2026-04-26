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
import { CandidateSavedJobsService } from './services/candidate-saved-jobs.service';
import { CandidateHeadhuntingController } from './candidate-headhunting.controller';
import { CandidateSavedJobsController } from './candidate-saved-jobs.controller';
import { CandidateSearchService } from './services/candidate-search.service';
import { CandidateEntity } from './entities/candidate.entity';
import { SavedJobEntity } from './entities/saved-job.entity';
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
import { JobEntity } from '../jobs/entities/job.entity';
import { JobInvitationEntity } from '../jobs/entities/job-invitation.entity';
import { JobApplicationEntity } from '../applications/entities/job-application.entity';
import { ApplicationStatusHistoryEntity } from '../applications/entities/application-status-history.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonGuardsModule } from '../common/guards/common-guards.module';
import { UserEntity } from '../users/entities/user.entity';
import { ApplicationsModule } from '../applications/applications.module';

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
      JobEntity,
      SavedJobEntity,
      JobInvitationEntity,
      JobApplicationEntity,
      ApplicationStatusHistoryEntity,
      UserEntity,
    ]),
    forwardRef(() => AuthModule),
    MetadataModule,
    StorageModule,
    NotificationsModule,
    CommonGuardsModule,
    ApplicationsModule,
  ],
  controllers: [
    CandidateProfileController,
    CandidateExperienceController,
    CandidateSkillsController,
    CandidateHeadhuntingController,
    CandidateSavedJobsController,
  ],
  providers: [
    CandidateProfileService,
    CandidateExperienceService,
    CandidateSkillsService,
    CandidateCertificatesService,
    CandidateCvParserService,
    CandidateHeadhuntingService,
    CandidateSearchService,
    CandidateSavedJobsService,
  ],
  exports: [CandidateProfileService, CandidateSearchService],
})
export class CandidatesModule {}
