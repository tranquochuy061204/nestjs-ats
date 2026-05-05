import { MigrationInterface, QueryRunner } from "typeorm";

export class AdminAuditLog1777985717772 implements MigrationInterface {
    name = 'AdminAuditLog1777985717772'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."audit_log_action_enum" AS ENUM('UPDATE_CREDIT', 'LOCK_USER', 'UNLOCK_USER', 'VERIFY_EMAIL', 'APPROVE_JOB', 'REJECT_JOB', 'CLOSE_JOB', 'UPDATE_VIP_CONFIG', 'UPDATE_CREDIT_CONFIG', 'CANCEL_VIP')`);
        await queryRunner.query(`CREATE TABLE "audit_log" ("id" SERIAL NOT NULL, "admin_id" integer NOT NULL, "action" "public"."audit_log_action_enum" NOT NULL, "resource" character varying(50) NOT NULL, "resource_id" character varying(50) NOT NULL, "old_values" json, "new_values" json, "ip_address" character varying(45), "user_agent" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_audit_log_resource" ON "audit_log" ("resource", "resource_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_audit_log_action" ON "audit_log" ("action") `);
        await queryRunner.query(`CREATE INDEX "IDX_audit_log_admin_id" ON "audit_log" ("admin_id") `);
        await queryRunner.query(`DROP INDEX "public"."IDX_bac37f13b06c08534012dc3607"`);
        await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."job_status_enum" AS ENUM('draft', 'pending', 'published', 'rejected', 'closed')`);
        await queryRunner.query(`ALTER TABLE "job" ADD "status" "public"."job_status_enum" NOT NULL DEFAULT 'draft'`);
        await queryRunner.query(`CREATE INDEX "IDX_bac37f13b06c08534012dc3607" ON "job" ("status") `);
        await queryRunner.query(`ALTER TABLE "audit_log" ADD CONSTRAINT "FK_0de5650de773ff3e481357151bf" FOREIGN KEY ("admin_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_log" DROP CONSTRAINT "FK_0de5650de773ff3e481357151bf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bac37f13b06c08534012dc3607"`);
        await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."job_status_enum"`);
        await queryRunner.query(`ALTER TABLE "job" ADD "status" character varying(20) NOT NULL DEFAULT 'draft'`);
        await queryRunner.query(`CREATE INDEX "IDX_bac37f13b06c08534012dc3607" ON "job" ("status") `);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_log_admin_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_log_action"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_log_resource"`);
        await queryRunner.query(`DROP TABLE "audit_log"`);
        await queryRunner.query(`DROP TYPE "public"."audit_log_action_enum"`);
    }

}
