import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployersService } from './employers.service';
import { EmployersController } from './employers.controller';
import { EmployerEntity } from './entities/employer.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
import { SavedCandidateEntity } from './entities/saved-candidate.entity';
import { CandidateEntity } from '../candidates/entities/candidate.entity';
import { JobEntity } from '../jobs/entities/job.entity';
import { JobInvitationEntity } from '../jobs/entities/job-invitation.entity';
import { CertificateEntity } from '../candidates/entities/certificate.entity';
import { StorageModule } from '../storage/storage.module';
import { EmployerHeadhuntingService } from './employer-headhunting.service';
import { EmployerHeadhuntingController } from './employer-headhunting.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployerEntity,
      CompanyEntity,
      SavedCandidateEntity,
      CandidateEntity,
      JobEntity,
      JobInvitationEntity,
      CertificateEntity,
    ]),
    StorageModule,
  ],
  controllers: [EmployersController, EmployerHeadhuntingController],
  providers: [EmployersService, EmployerHeadhuntingService],
  exports: [EmployersService],
})
export class EmployersModule {}
