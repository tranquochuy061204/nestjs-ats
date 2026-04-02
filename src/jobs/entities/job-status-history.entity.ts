import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { JobEntity, JobStatus } from './job.entity';

@Entity('job_status_history')
export class JobStatusHistoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'job_id' })
  jobId: number;

  @Column({ name: 'old_status', type: 'varchar', length: 20, nullable: true })
  oldStatus: JobStatus | string;

  @Column({ name: 'new_status', type: 'varchar', length: 20 })
  newStatus: JobStatus | string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ name: 'changed_by_id', nullable: true })
  changedById: number; // ID của Admin thực hiện

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => JobEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: JobEntity;
}
