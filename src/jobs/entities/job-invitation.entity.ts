import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { JobEntity } from './job.entity';
import { CandidateEntity } from '../../candidates/entities/candidate.entity';
import { EmployerEntity } from '../../employers/entities/employer.entity';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

@Entity('job_invitation')
export class JobInvitationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'employer_id' })
  employerId: number;

  @Index()
  @Column({ name: 'candidate_id' })
  candidateId: number;

  @Index()
  @Column({ name: 'job_id' })
  jobId: number;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Index()
  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => EmployerEntity)
  @JoinColumn({ name: 'employer_id' })
  employer: EmployerEntity;

  @ManyToOne(() => CandidateEntity)
  @JoinColumn({ name: 'candidate_id' })
  candidate: CandidateEntity;

  @ManyToOne(() => JobEntity)
  @JoinColumn({ name: 'job_id' })
  job: JobEntity;
}
