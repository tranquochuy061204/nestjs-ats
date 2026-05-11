import { MigrationInterface, QueryRunner } from "typeorm";

export class OptimizeCandidateProfile1778227216977 implements MigrationInterface {
    name = 'OptimizeCandidateProfile1778227216977'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscription_package" DROP COLUMN "can_use_premium_filters"`);
        await queryRunner.query(`CREATE INDEX "IDX_ecbb7801eb205538825fa89b2b" ON "certificate" ("candidate_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7c8809be2c6678f1865b5d8329" ON "candidate_job_category" ("candidate_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_4d542165035a792e0972754a15" ON "work_experience" ("candidate_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e5cd2741ebeb6c59b192cafcc9" ON "education" ("candidate_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_28106292f6455e1aa10dc82687" ON "project" ("candidate_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_28106292f6455e1aa10dc82687"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e5cd2741ebeb6c59b192cafcc9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d542165035a792e0972754a15"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7c8809be2c6678f1865b5d8329"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ecbb7801eb205538825fa89b2b"`);
        await queryRunner.query(`ALTER TABLE "subscription_package" ADD "can_use_premium_filters" boolean NOT NULL DEFAULT false`);
    }

}
