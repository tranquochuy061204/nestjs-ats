import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from '../../../users/entities/user.entity';

import { AuditLogAction } from '../enums/audit-log-action.enum';

@Entity('audit_log')
@Index('IDX_audit_log_admin_id', ['adminId'])
@Index('IDX_audit_log_action', ['action'])
@Index('IDX_audit_log_resource', ['resource', 'resourceId'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id' })
  adminId: number;

  @Column({ type: 'enum', enum: AuditLogAction })
  action: AuditLogAction;

  @Column({ type: 'varchar', length: 50 })
  resource: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 50 })
  resourceId: string;

  @Column({ name: 'old_values', type: 'json', nullable: true })
  oldValues: Record<string, any> | null;

  @Column({ name: 'new_values', type: 'json', nullable: true })
  newValues: Record<string, any> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'admin_id' })
  admin: UserEntity;
}
