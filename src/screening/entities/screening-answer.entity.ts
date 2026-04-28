import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JobApplicationEntity } from '../../applications/entities/job-application.entity';
import { ScreeningQuestionEntity } from './screening-question.entity';

@Entity('screening_answer')
export class ScreeningAnswerEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'application_id' })
  applicationId: number;

  @Column({ name: 'question_id' })
  questionId: number;

  @Column({ name: 'answer_text', type: 'text' })
  answerText: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => JobApplicationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: JobApplicationEntity;

  @ManyToOne(() => ScreeningQuestionEntity, (q) => q.answers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'question_id' })
  question: ScreeningQuestionEntity;
}
