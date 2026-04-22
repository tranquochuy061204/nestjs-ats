import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { JobApplicationEntity } from './job-application.entity';

@Entity('application_status_history')
export class ApplicationStatusHistoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'application_id' })
  applicationId: number;

  @Column({ name: 'old_status', type: 'varchar', length: 20, nullable: true })
  oldStatus: string | null;

  @Column({ name: 'new_status', type: 'varchar', length: 20 })
  newStatus: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'changed_by_id', type: 'int', nullable: true })
  changedById: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => JobApplicationEntity, (app) => app.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'application_id' })
  application: JobApplicationEntity;
}
