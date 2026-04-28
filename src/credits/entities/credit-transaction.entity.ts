import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CreditWalletEntity } from './credit-wallet.entity';

export enum CreditTransactionType {
  TOPUP = 'topup',
  PIPELINE_FEE = 'pipeline_fee',
  AI_SCORING = 'ai_scoring',
  CONTACT_UNLOCK = 'contact_unlock',
  PURCHASE = 'purchase',
  REFUND = 'refund',
  BONUS = 'bonus',
  ADMIN_ADJUST = 'admin_adjust',
}

@Entity('credit_transaction')
export class CreditTransactionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'wallet_id' })
  walletId: number;

  @Column({
    type: 'varchar',
    length: 20,
  })
  type: string;

  /** Số dương = Credit vào. Số âm = Credit ra */
  @Column({ type: 'int' })
  amount: number;

  /** Số dư sau giao dịch này */
  @Column({ name: 'balance_after', type: 'int' })
  balanceAfter: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** 'application_status_history' | 'credit_purchase' | 'contact_unlock' | 'payment_order' */
  @Column({
    name: 'reference_type',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'int', nullable: true })
  referenceId: number | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => CreditWalletEntity)
  @JoinColumn({ name: 'wallet_id' })
  wallet: CreditWalletEntity;
}
