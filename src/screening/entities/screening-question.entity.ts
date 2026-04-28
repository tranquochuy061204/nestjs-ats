import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JobEntity } from '../../jobs/entities/job.entity';
import { ScreeningAnswerEntity } from './screening-answer.entity';

export enum ScreeningQuestionType {
  TEXT = 'text',
  YES_NO = 'yes_no',
  SINGLE_CHOICE = 'single_choice',
}

@Entity('screening_question')
export class ScreeningQuestionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'job_id' })
  jobId: number;

  @Column({ name: 'question_text', type: 'text' })
  questionText: string;

  @Column({
    name: 'question_type',
    type: 'varchar',
    length: 20,
    default: ScreeningQuestionType.TEXT,
  })
  questionType: string;

  /** JSON array for single_choice. NULL for text/yes_no */
  @Column({ type: 'text', nullable: true })
  options: string | null;

  /**
   * Đáp án mong muốn. NULL = không auto-tag.
   * "yes"/"no" cho yes_no. Giá trị cụ thể cho single_choice.
   */
  @Column({
    name: 'preferred_answer',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  preferredAnswer: string | null;

  @Column({ name: 'is_required', type: 'boolean', default: true })
  isRequired: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => JobEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: JobEntity;

  @OneToMany(() => ScreeningAnswerEntity, (a) => a.question)
  answers: ScreeningAnswerEntity[];
}
