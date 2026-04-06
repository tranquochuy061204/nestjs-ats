import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { JobEntity } from './job.entity';
import { SkillMetadataEntity } from '../../metadata/skills/skill-metadata.entity';

@Entity('job_skill_tag')
export class JobSkillTagEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'job_id' })
  jobId: number;

  @Column({ name: 'skill_id', nullable: true })
  skillId: number;

  // Custom text for skills that don't match the metadata perfectly
  @Column({ type: 'varchar', length: 100, nullable: true })
  tagText: string;

  @ManyToOne(() => JobEntity, (job) => job.skills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: JobEntity;

  @ManyToOne(() => SkillMetadataEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'skill_id' })
  skillMetadata: SkillMetadataEntity;
}
