import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusHistory1775125902668 implements MigrationInterface {
  name = 'AddStatusHistory1775125902668';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "job_status_history" ("id" SERIAL NOT NULL, "job_id" integer NOT NULL, "old_status" character varying(20), "new_status" character varying(20) NOT NULL, "reason" text, "changed_by_id" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_971859ffd3de1d3118837cb4d9d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "company_status_history" ("id" SERIAL NOT NULL, "company_id" integer NOT NULL, "old_status" character varying(20), "new_status" character varying(20) NOT NULL, "reason" text, "changed_by_id" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9cdfbc39cf85da7027670118e12" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_status_history" ADD CONSTRAINT "FK_9b7b17a213607c7036e948701b7" FOREIGN KEY ("job_id") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_status_history" ADD CONSTRAINT "FK_c463cfaf2be90d9a12a03dd950a" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_status_history" DROP CONSTRAINT "FK_c463cfaf2be90d9a12a03dd950a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_status_history" DROP CONSTRAINT "FK_9b7b17a213607c7036e948701b7"`,
    );
    await queryRunner.query(`DROP TABLE "company_status_history"`);
    await queryRunner.query(`DROP TABLE "job_status_history"`);
  }
}
