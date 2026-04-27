import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScreeningService } from './screening.service';
import { ScreeningController } from './screening.controller';
import { ScreeningQuestionEntity } from './entities/screening-question.entity';
import { ScreeningAnswerEntity } from './entities/screening-answer.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { CandidateEntity } from '../candidates/entities/candidate.entity';
import { JobEntity } from '../jobs/entities/job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScreeningQuestionEntity,
      ScreeningAnswerEntity,
      EmployerEntity,
      CandidateEntity,
      JobEntity,
    ]),
    SubscriptionsModule,
  ],
  controllers: [ScreeningController],
  providers: [ScreeningService],
  exports: [ScreeningService, TypeOrmModule],
})
export class ScreeningModule {}
