import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CandidateEntity } from './candidate.entity';

@Entity('education')
export class EducationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'candidate_id' })
  candidateId: number;

  @Column({ name: 'school_name', type: 'varchar', length: 255 })
  schoolName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  major: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  degree: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string;

  @Column({ name: 'is_still_studying', type: 'boolean', nullable: true })
  isStillStudying: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => CandidateEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: CandidateEntity;
}
