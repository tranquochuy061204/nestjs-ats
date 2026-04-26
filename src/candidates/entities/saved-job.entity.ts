import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { CandidateEntity } from './candidate.entity';
import { JobEntity } from '../../jobs/entities/job.entity';

@Entity('saved_job')
@Unique(['candidateId', 'jobId']) // candidate can only save a job once
export class SavedJobEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'candidate_id' })
  candidateId: number;

  @Index()
  @Column({ name: 'job_id' })
  jobId: number;

  @CreateDateColumn({ name: 'saved_at' })
  savedAt: Date;

  // -- RELATIONS --

  @ManyToOne(() => CandidateEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: CandidateEntity;

  @ManyToOne(() => JobEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: JobEntity;
}
