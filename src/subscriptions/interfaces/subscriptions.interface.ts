import { CompanySubscriptionEntity } from '../entities/company-subscription.entity';
import { SubscriptionPackageEntity } from '../entities/subscription-package.entity';

export interface ActiveSubscription {
  subscription: CompanySubscriptionEntity;
  package: SubscriptionPackageEntity;
}
