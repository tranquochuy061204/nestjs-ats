import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdjustMonetizationRules1777200000000 implements MigrationInterface {
  name = 'AdjustMonetizationRules1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop unused table pipeline_fee_config
    await queryRunner.query(`DROP TABLE IF EXISTS "pipeline_fee_config"`);

    // 2. Remove unused columns from subscription_package
    await queryRunner.query(
      `ALTER TABLE "subscription_package" DROP COLUMN IF EXISTS "can_use_ai_strict_filter"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_package" DROP COLUMN IF EXISTS "can_export_report"`,
    );

    // 3. Remove AI strict filter and export report from available credit products
    await queryRunner.query(
      `DELETE FROM "credit_product" WHERE "slug" IN ('ai_filter_job', 'export_report')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Re-add columns to subscription_package
    await queryRunner.query(
      `ALTER TABLE "subscription_package" ADD COLUMN "can_use_ai_strict_filter" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_package" ADD COLUMN "can_export_report" boolean NOT NULL DEFAULT false`,
    );

    // 2. Re-create pipeline_fee_config
    await queryRunner.query(`
      CREATE TABLE "pipeline_fee_config" (
        "id" SERIAL NOT NULL,
        "to_status" character varying(30) NOT NULL,
        "credit_cost" integer NOT NULL DEFAULT '0',
        "vip_credit_cost" integer NOT NULL DEFAULT '0',
        "is_free" boolean NOT NULL DEFAULT false,
        CONSTRAINT "UQ_9e3d93fd99f4d2f8d83bf9bcf57" UNIQUE ("to_status"),
        CONSTRAINT "PK_7b3decdfa1a7a00f28e2354c0e5" PRIMARY KEY ("id")
      )
    `);

    // 3. Re-seed credit_product
    await queryRunner.query(`
      INSERT INTO "credit_product" ("slug", "display_name", "credit_cost", "duration_days", "scope")
      VALUES 
        ('ai_filter_job', 'AI Strict Filter (1 tin)', 20, NULL, 'job'),
        ('export_report', 'Xuất Báo Cáo (1 lần)', 10, NULL, 'company')
    `);
  }
}
