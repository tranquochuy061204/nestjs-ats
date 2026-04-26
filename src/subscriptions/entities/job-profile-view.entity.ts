import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JobEntity } from '../../jobs/entities/job.entity';
import { CandidateEntity } from '../../candidates/entities/candidate.entity';

@Entity('job_profile_view')
export class JobProfileViewEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'job_id' })
  jobId: number;

  @Index()
  @Column({ name: 'candidate_id' })
  candidateId: number;

  @Column({ name: 'viewed_at', type: 'timestamp', default: () => 'now()' })
  viewedAt: Date;

  @ManyToOne(() => JobEntity)
  @JoinColumn({ name: 'job_id' })
  job: JobEntity;

  @ManyToOne(() => CandidateEntity)
  @JoinColumn({ name: 'candidate_id' })
  candidate: CandidateEntity;
}
