import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { EmployerEntity } from './employer.entity';
import { CandidateEntity } from '../../candidates/entities/candidate.entity';

@Entity('saved_candidate')
@Unique(['employerId', 'candidateId'])
export class SavedCandidateEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'employer_id' })
  employerId: number;

  @Column({ name: 'candidate_id' })
  candidateId: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => EmployerEntity)
  @JoinColumn({ name: 'employer_id' })
  employer: EmployerEntity;

  @ManyToOne(() => CandidateEntity)
  @JoinColumn({ name: 'candidate_id' })
  candidate: CandidateEntity;
}
