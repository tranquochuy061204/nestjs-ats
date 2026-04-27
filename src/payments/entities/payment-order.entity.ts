import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { SubscriptionPackageEntity } from '../../subscriptions/entities/subscription-package.entity';

export enum PaymentOrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentOrderType {
  SUBSCRIPTION = 'subscription',
  CREDIT_TOPUP = 'credit_topup',
}

@Entity('payment_order')
export class PaymentOrderEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'company_id' })
  companyId: number;

  /** 'subscription' | 'credit_topup' */
  @Column({ name: 'order_type', type: 'varchar', length: 20 })
  orderType: string;

  /** null nếu là credit_topup */
  @Column({ name: 'package_id', type: 'int', nullable: true })
  packageId: number | null;

  /** Số Credit sẽ nhận (bao gồm bonus). null nếu mua gói */
  @Column({ name: 'credit_amount', type: 'int', nullable: true })
  creditAmount: number | null;

  /** Số tiền VNĐ */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  /** 'vnpay' (chỉ VNPay cho Phase 1) */
  @Column({ name: 'payment_method', type: 'varchar', length: 20 })
  paymentMethod: string;

  @Column({
    name: 'payment_status',
    type: 'varchar',
    length: 20,
    default: PaymentOrderStatus.PENDING,
  })
  paymentStatus: string;

  /** Mã đơn hàng gửi lên VNPay (vnp_TxnRef) */
  @Column({ name: 'gateway_order_id', type: 'varchar', length: 255, nullable: true })
  gatewayOrderId: string | null;

  /** Mã giao dịch từ VNPay (vnp_TransactionNo) */
  @Column({ name: 'gateway_transaction_id', type: 'varchar', length: 255, nullable: true })
  gatewayTransactionId: string | null;

  /** Raw JSON response từ VNPay IPN */
  @Column({ name: 'gateway_response_data', type: 'text', nullable: true })
  gatewayResponseData: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => CompanyEntity)
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;

  @ManyToOne(() => SubscriptionPackageEntity, { nullable: true })
  @JoinColumn({ name: 'package_id' })
  package: SubscriptionPackageEntity | null;
}
