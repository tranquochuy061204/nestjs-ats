import { CreditTransactionType } from '../entities/credit-transaction.entity';

export interface ChargeCreditOptions {
  type: CreditTransactionType | string;
  description: string;
  referenceType?: string;
  referenceId?: number;
  createdBy?: number;
}
