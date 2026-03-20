import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CandidateEntity } from './candidate.entity';

@Entity('certificate')
export class CertificateEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'candidate_id' })
  candidateId: number;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    comment: 'Tên chứng chỉ',
  })
  name: string;

  @Column({
    name: 'cer_img_url',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Ảnh chụp chứng chỉ',
  })
  cerImgUrl: string;

  @ManyToOne(() => CandidateEntity, (candidate) => candidate.certificates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'candidate_id' })
  candidate: CandidateEntity;
}
