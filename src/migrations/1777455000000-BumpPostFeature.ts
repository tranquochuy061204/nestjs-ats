import { MigrationInterface, QueryRunner } from "typeorm";

export class BumpPostFeature1777455000000 implements MigrationInterface {
    name = 'BumpPostFeature1777455000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop deprecated columns in subscription_package
        await queryRunner.query(`ALTER TABLE "subscription_package" DROP COLUMN IF EXISTS "can_view_advanced_analytics"`);
        await queryRunner.query(`ALTER TABLE "subscription_package" DROP COLUMN IF EXISTS "can_use_premium_filters"`);
        
        // Add bumped_at to job table
        await queryRunner.query(`ALTER TABLE "job" ADD IF NOT EXISTS "bumped_at" TIMESTAMP WITH TIME ZONE`);
        
        // Add bump_quota_reset_at to company_subscription
        await queryRunner.query(`ALTER TABLE "company_subscription" ADD IF NOT EXISTS "bump_quota_reset_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company_subscription" DROP COLUMN IF EXISTS "bump_quota_reset_at"`);
        await queryRunner.query(`ALTER TABLE "job" DROP COLUMN IF EXISTS "bumped_at"`);
        await queryRunner.query(`ALTER TABLE "subscription_package" ADD IF NOT EXISTS "can_use_premium_filters" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "subscription_package" ADD IF NOT EXISTS "can_view_advanced_analytics" boolean NOT NULL DEFAULT false`);
    }
}
