import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum SkillType {
  HARD = 'hard',
  SOFT = 'soft',
}

@Entity('skill_metadata')
export class SkillMetadataEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'canonical_name',
    type: 'varchar',
    length: 100,
    unique: true,
  })
  canonicalName: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'jsonb', default: '[]' })
  aliases: string[];

  @Column({ type: 'enum', enum: SkillType })
  type: SkillType;

  @Column({ name: 'use_count', type: 'int', default: 0 })
  useCount: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'now()',
  })
  createdAt: Date;
}
