// Core
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Controllers
import { CandidateProfileController } from './candidate-profile.controller';
import { CandidateWorkExperienceController } from './controllers/candidate-work-experience.controller';
import { CandidateEducationController } from './controllers/candidate-education.controller';
import { CandidateProjectController } from './controllers/candidate-project.controller';
import { CandidateSkillsController } from './candidate-skills.controller';
import { CandidateHeadhuntingController } from './candidate-headhunting.controller';
import { CandidateSavedJobsController } from './candidate-saved-jobs.controller';

// Services
import { CandidateProfileService } from './services/candidate-profile.service';
import { CandidateWorkExperienceService } from './services/candidate-work-experience.service';
import { CandidateEducationService } from './services/candidate-education.service';
import { CandidateProjectService } from './services/candidate-project.service';
import { CandidateSkillsService } from './services/candidate-skills.service';
import { CandidateCertificatesService } from './services/candidate-certificates.service';
import { CandidateCvParserService } from './services/candidate-cv-parser.service';
import { CandidateCvAiExtractorService } from './services/candidate-cv-ai-extractor.service';
import { CandidateCvImporterService } from './services/candidate-cv-importer.service';
import { CandidateHeadhuntingService } from './services/candidate-headhunting.service';
import { CandidateSavedJobsService } from './services/candidate-saved-jobs.service';
import { CandidateSearchService } from './services/candidate-search.service';

// Entities
import { CandidateEntity } from './entities/candidate.entity';
import { WorkExperienceEntity } from './entities/work-experience.entity';
import { EducationEntity } from './entities/education.entity';
import { ProjectEntity } from './entities/project.entity';
import { CandidateSkillTagEntity } from './entities/candidate-skill-tag.entity';
import { CertificateEntity } from './entities/certificate.entity';
import { CandidateJobCategoryEntity } from './entities/candidate-job-category.entity';
import { SavedJobEntity } from './entities/saved-job.entity';

// External Entities
import { JobCategoryMetadataEntity } from '../metadata/job-categories/job-category.entity';
import { JobTypeMetadataEntity } from '../metadata/job-types/job-type.entity';
import { JobEntity } from '../jobs/entities/job.entity';
import { JobInvitationEntity } from '../jobs/entities/job-invitation.entity';
import { JobApplicationEntity } from '../applications/entities/job-application.entity';
import { ApplicationStatusHistoryEntity } from '../applications/entities/application-status-history.entity';
import { UserEntity } from '../users/entities/user.entity';
import { ContactUnlockLogEntity } from '../subscriptions/entities/contact-unlock-log.entity';

// Modules
import { AuthModule } from '../auth/auth.module';
import { MetadataModule } from '../metadata/metadata.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonGuardsModule } from '../common/guards/common-guards.module';
import { ApplicationsModule } from '../applications/applications.module';
import { EmployersModule } from '../employers/employers.module';

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
      ContactUnlockLogEntity,
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => EmployersModule),
    MetadataModule,
    StorageModule,
    NotificationsModule,
    CommonGuardsModule,
    ApplicationsModule,
  ],
  controllers: [
    CandidateProfileController,
    CandidateWorkExperienceController,
    CandidateEducationController,
    CandidateProjectController,
    CandidateSkillsController,
    CandidateHeadhuntingController,
    CandidateSavedJobsController,
  ],
  providers: [
    CandidateProfileService,
    CandidateWorkExperienceService,
    CandidateEducationService,
    CandidateProjectService,
    CandidateSkillsService,
    CandidateCertificatesService,
    CandidateCvAiExtractorService,
    CandidateCvImporterService,
    CandidateCvParserService,
    CandidateHeadhuntingService,
    CandidateSearchService,
    CandidateSavedJobsService,
  ],
  exports: [CandidateProfileService, CandidateSearchService],
})
export class CandidatesModule {}
