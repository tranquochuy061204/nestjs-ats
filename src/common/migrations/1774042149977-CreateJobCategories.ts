import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobCategories1774042149977 implements MigrationInterface {
  name = 'CreateJobCategories1774042149977';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "job_category_metadata" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "slug" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9242bc184751fefa2284680c7bf" UNIQUE ("slug"), CONSTRAINT "PK_b6a82590c4f899e7a8a48a577fa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "candidate_job_category" ("id" SERIAL NOT NULL, "candidate_id" integer NOT NULL, "job_category_id" integer NOT NULL, CONSTRAINT "PK_834c64cc9c6637c0d6bb555ecab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_job_category" ADD CONSTRAINT "FK_7c8809be2c6678f1865b5d8329a" FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_job_category" ADD CONSTRAINT "FK_15f686594fadaa8343c1328ac12" FOREIGN KEY ("job_category_id") REFERENCES "job_category_metadata"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "candidate_job_category" DROP CONSTRAINT "FK_15f686594fadaa8343c1328ac12"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_job_category" DROP CONSTRAINT "FK_7c8809be2c6678f1865b5d8329a"`,
    );
    await queryRunner.query(`DROP TABLE "candidate_job_category"`);
    await queryRunner.query(`DROP TABLE "job_category_metadata"`);
  }
}
