import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

export enum NotificationType {
  APPLICATION_STATUS = 'application_status',
  HEADHUNT_INVITATION = 'headhunt_invitation',
  HEADHUNT_ACCEPT = 'headhunt_accept',
  HEADHUNT_REJECT = 'headhunt_reject',
  JOB_APPROVAL = 'job_approval',
  JOB_REJECTION = 'job_rejection',
  NEW_NOTE = 'new_note',
  SYSTEM = 'system',
}

@Entity('notification')
export class NotificationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id' })
  userId: number;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // -- RELATIONS --

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
