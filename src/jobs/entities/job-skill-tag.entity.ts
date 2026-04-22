import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { JobEntity } from './job.entity';
import { SkillMetadataEntity } from '../../metadata/skills/skill-metadata.entity';

@Entity('job_skill_tag')
@Unique('UQ_job_skill_tag_job_skill', ['jobId', 'skillId'])
export class JobSkillTagEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'job_id' })
  jobId: number;

  @Index()
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
