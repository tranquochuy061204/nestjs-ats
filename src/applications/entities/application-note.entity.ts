import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { JobApplicationEntity } from './job-application.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('application_note')
export class ApplicationNoteEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'application_id' })
  applicationId: number;

  @Column({ name: 'author_id' })
  authorId: number;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // -- RELATIONS --

  @ManyToOne(() => JobApplicationEntity, (app) => app.notes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'application_id' })
  application: JobApplicationEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'author_id' })
  author: UserEntity;
}
