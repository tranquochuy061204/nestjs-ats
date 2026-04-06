import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobApplicationTables1775450400000 implements MigrationInterface {
  name = 'AddJobApplicationTables1775450400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create job_application table
    await queryRunner.query(`
      CREATE TABLE "job_application" (
        "id" SERIAL NOT NULL,
        "job_id" integer NOT NULL,
        "candidate_id" integer NOT NULL,
        "cv_url_snapshot" character varying(512),
        "cover_letter" text,
        "status" character varying(20) NOT NULL DEFAULT 'received',
        "rejection_reason" text,
        "employer_note" text,
        "applied_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_application" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_job_application_job_candidate" UNIQUE ("job_id", "candidate_id"),
        CONSTRAINT "FK_job_application_job" FOREIGN KEY ("job_id")
          REFERENCES "job"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_job_application_candidate" FOREIGN KEY ("candidate_id")
          REFERENCES "candidate"("id") ON DELETE CASCADE
      )
    `);

    // 2. Create application_status_history table
    await queryRunner.query(`
      CREATE TABLE "application_status_history" (
        "id" SERIAL NOT NULL,
        "application_id" integer NOT NULL,
        "old_status" character varying(20),
        "new_status" character varying(20) NOT NULL,
        "reason" text,
        "changed_by_id" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_application_status_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_application_status_history_application" FOREIGN KEY ("application_id")
          REFERENCES "job_application"("id") ON DELETE CASCADE
      )
    `);

    // 3. Performance indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_job_application_job_id" ON "job_application" ("job_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_application_candidate_id" ON "job_application" ("candidate_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_application_status" ON "job_application" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_app_status_history_application_id" ON "application_status_history" ("application_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "application_status_history"`);
    await queryRunner.query(`DROP TABLE "job_application"`);
  }
}
