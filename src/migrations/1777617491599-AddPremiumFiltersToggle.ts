import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPremiumFiltersToggle1777617491599 implements MigrationInterface {
  name = 'AddPremiumFiltersToggle1777617491599';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_package" ADD "can_use_premium_filters" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_package" DROP COLUMN "can_use_premium_filters"`,
    );
  }
}
