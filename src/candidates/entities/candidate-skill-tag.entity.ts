import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { CandidateEntity } from './candidate.entity';
import { SkillMetadataEntity } from '../../metadata/skills/skill-metadata.entity';

@Entity('candidate_skill_tag')
@Unique(['candidateId', 'skillMetadataId'])
export class CandidateSkillTagEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'candidate_id' })
  candidateId: number;

  @Index()
  @Column({ name: 'skill_metadata_id' })
  skillMetadataId: number;

  @ManyToOne(() => CandidateEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: CandidateEntity;

  @ManyToOne(() => SkillMetadataEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_metadata_id' })
  skillMetadata: SkillMetadataEntity;
}
