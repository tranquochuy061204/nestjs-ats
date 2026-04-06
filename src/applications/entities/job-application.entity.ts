import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { JobEntity } from '../../jobs/entities/job.entity';
import { CandidateEntity } from '../../candidates/entities/candidate.entity';
import { ApplicationStatusHistoryEntity } from './application-status-history.entity';

export enum ApplicationStatus {
  RECEIVED = 'received',
  SCREENING = 'screening',
  INTERVIEW = 'interview',
  OFFER = 'offer',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

@Entity('job_application')
@Unique(['jobId', 'candidateId'])
export class JobApplicationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'job_id' })
  jobId: number;

  @Column({ name: 'candidate_id' })
  candidateId: number;

  @Column({
    name: 'cv_url_snapshot',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  cvUrlSnapshot: string | null;

  @Column({ name: 'cover_letter', type: 'text', nullable: true })
  coverLetter: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: ApplicationStatus.RECEIVED,
  })
  status: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'employer_note', type: 'text', nullable: true })
  employerNote: string | null;

  @CreateDateColumn({ name: 'applied_at' })
  appliedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // -- RELATIONS --

  @ManyToOne(() => JobEntity, (job) => job.applications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'job_id' })
  job: JobEntity;

  @ManyToOne(() => CandidateEntity, (candidate) => candidate.applications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'candidate_id' })
  candidate: CandidateEntity;

  @OneToMany(
    () => ApplicationStatusHistoryEntity,
    (history) => history.application,
  )
  statusHistory: ApplicationStatusHistoryEntity[];
}
