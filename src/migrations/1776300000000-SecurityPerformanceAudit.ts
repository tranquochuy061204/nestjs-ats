import { MigrationInterface, QueryRunner } from "typeorm";

export class SecurityPerformanceAudit1776300000000 implements MigrationInterface {
    name = 'SecurityPerformanceAudit1776300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Indexes for User
        await queryRunner.query(`CREATE INDEX "IDX_role_user" ON "user" ("role")`);
        await queryRunner.query(`CREATE INDEX "IDX_status_user" ON "user" ("status")`);

        // Indexes for Job
        await queryRunner.query(`CREATE INDEX "IDX_company_id_job" ON "job" ("company_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_employer_id_job" ON "job" ("employer_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_province_id_job" ON "job" ("province_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_category_id_job" ON "job" ("category_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_job_type_id_job" ON "job" ("job_type_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_status_job" ON "job" ("status")`);

        // DataType changes for Job Salary
        await queryRunner.query(`ALTER TABLE "job" ALTER COLUMN "salary_min" TYPE numeric(15,2)`);
        await queryRunner.query(`ALTER TABLE "job" ALTER COLUMN "salary_max" TYPE numeric(15,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "job" ALTER COLUMN "salary_max" TYPE integer`);
        await queryRunner.query(`ALTER TABLE "job" ALTER COLUMN "salary_min" TYPE integer`);

        await queryRunner.query(`DROP INDEX "IDX_status_job"`);
        await queryRunner.query(`DROP INDEX "IDX_job_type_id_job"`);
        await queryRunner.query(`DROP INDEX "IDX_category_id_job"`);
        await queryRunner.query(`DROP INDEX "IDX_province_id_job"`);
        await queryRunner.query(`DROP INDEX "IDX_employer_id_job"`);
        await queryRunner.query(`DROP INDEX "IDX_company_id_job"`);

        await queryRunner.query(`DROP INDEX "IDX_status_user"`);
        await queryRunner.query(`DROP INDEX "IDX_role_user"`);
    }

}
