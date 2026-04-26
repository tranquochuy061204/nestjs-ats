import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScreeningService } from './screening.service';
import { ScreeningQuestionEntity } from './entities/screening-question.entity';
import { ScreeningAnswerEntity } from './entities/screening-answer.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScreeningQuestionEntity, ScreeningAnswerEntity]),
    SubscriptionsModule,
  ],
  providers: [ScreeningService],
  exports: [ScreeningService, TypeOrmModule],
})
export class ScreeningModule {}
