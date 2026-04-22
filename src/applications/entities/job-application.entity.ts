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
  Index,
} from 'typeorm';
import { JobEntity } from '../../jobs/entities/job.entity';
import { CandidateEntity } from '../../candidates/entities/candidate.entity';
import { ApplicationStatusHistoryEntity } from './application-status-history.entity';

export enum ApplicationStatus {
  APPLIED = 'applied',
  SHORTLISTED = 'shortlisted',
  SKILL_TEST = 'skill_test',
  INTERVIEW = 'interview',
  OFFER = 'offer',
  HIRED = 'hired',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

import { ApplicationNoteEntity } from './application-note.entity';

@Entity('job_application')
@Unique(['jobId', 'candidateId'])
export class JobApplicationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'job_id' })
  jobId: number;

  @Index()
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

  @Index()
  @Column({
    type: 'varchar',
    default: ApplicationStatus.APPLIED,
  })
  status: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  // employer_note column removed – use ApplicationNoteEntity instead

  @Column({ name: 'match_score', type: 'int', nullable: true })
  matchScore: number | null;

  @Column({ name: 'match_reasoning', type: 'text', nullable: true })
  matchReasoning: string | null;

  @Column({ name: 'cv_match_score', type: 'int', nullable: true })
  cvMatchScore: number | null;

  @Column({ name: 'cv_match_reasoning', type: 'text', nullable: true })
  cvMatchReasoning: string | null;

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

  @OneToMany(() => ApplicationNoteEntity, (note) => note.application)
  notes: ApplicationNoteEntity[];
}
