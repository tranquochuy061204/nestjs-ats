import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreditsService } from '../credits/credits.service';
import { CreditTransactionType } from '../credits/entities/credit-transaction.entity';

@Injectable()
export class ApplicationPipelineFeeService {
  private readonly logger = new Logger(ApplicationPipelineFeeService.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly creditsService: CreditsService,
  ) {}

  /**
   * Tính toán và trừ phí (nếu có) khi nhà tuyển dụng di chuyển ứng viên trong pipeline.
   * Trả về số credit đã bị trừ (0 nếu miễn phí hoặc VIP dùng free proceed).
   */
  async enforcePipelineFee(
    companyId: number,
    oldStatus: string,
    newStatus: string,
    applicationId: number,
    employerUserId: number,
  ): Promise<number> {
    const { creditCost, isFree, useFreeProceed } =
      await this.subscriptionsService.calculateProceedFee(
        companyId,
        oldStatus,
        newStatus,
      );

    if (isFree) {
      return 0;
    }

    // Enforce daily processing limit
    await this.subscriptionsService.incrementDailyProcessedCount(companyId);

    if (useFreeProceed) {
      // VIP dùng free proceed — không trừ Credit
      await this.subscriptionsService.consumeFreeProceed(companyId);
      return 0;
    }

    if (creditCost > 0) {
      // Trừ Credit (ném exception nếu không đủ)
      await this.creditsService.chargeCredit(companyId, creditCost, {
        type: CreditTransactionType.PIPELINE_FEE,
        description: `Phí proceed ứng viên sang "${newStatus}" — Application #${applicationId}`,
        referenceType: 'job_application',
        referenceId: applicationId,
        createdBy: employerUserId,
      });
      return creditCost;
    }

    return 0;
  }
}
