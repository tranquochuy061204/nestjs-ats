import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CandidateEntity } from './candidate.entity';
import { JobCategoryMetadataEntity } from '../../metadata/job-categories/job-category.entity';

@Entity('candidate_job_category')
export class CandidateJobCategoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'candidate_id' })
  candidateId: number;

  @Index()
  @Column({ name: 'job_category_id' })
  jobCategoryId: number;

  @ManyToOne(() => CandidateEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: CandidateEntity;

  @ManyToOne(() => JobCategoryMetadataEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_category_id' })
  jobCategory: JobCategoryMetadataEntity;
}
