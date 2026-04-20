import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationTable1776707757918 implements MigrationInterface {
    name = 'CreateNotificationTable1776707757918'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_company_id_job"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_employer_id_job"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_province_id_job"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_category_id_job"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_job_type_id_job"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_status_job"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_role_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_status_user"`);
        await queryRunner.query(`CREATE TABLE "notification" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "type" character varying(50) NOT NULL, "title" character varying(255) NOT NULL, "content" text NOT NULL, "metadata" json, "is_read" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_928b7aa1754e08e1ed7052cb9d" ON "notification" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_51cb12c924d3e8c7465cc8edff" ON "job" ("company_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b29124ef862925abf6b729236e" ON "job" ("employer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_177da30403318e3e6cf960a1ea" ON "job" ("province_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_15f44c4b9fbb84e28a0346e930" ON "job" ("category_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0e112d0cb745bf1861825dfcec" ON "job" ("job_type_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_bac37f13b06c08534012dc3607" ON "job" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_6620cd026ee2b231beac7cfe57" ON "user" ("role") `);
        await queryRunner.query(`CREATE INDEX "IDX_3d44ccf43b8a0d6b9978affb88" ON "user" ("status") `);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_928b7aa1754e08e1ed7052cb9d8" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_928b7aa1754e08e1ed7052cb9d8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3d44ccf43b8a0d6b9978affb88"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6620cd026ee2b231beac7cfe57"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bac37f13b06c08534012dc3607"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e112d0cb745bf1861825dfcec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_15f44c4b9fbb84e28a0346e930"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_177da30403318e3e6cf960a1ea"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b29124ef862925abf6b729236e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_51cb12c924d3e8c7465cc8edff"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_928b7aa1754e08e1ed7052cb9d"`);
        await queryRunner.query(`DROP TABLE "notification"`);
        await queryRunner.query(`CREATE INDEX "IDX_status_user" ON "user" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_role_user" ON "user" ("role") `);
        await queryRunner.query(`CREATE INDEX "IDX_status_job" ON "job" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_job_type_id_job" ON "job" ("job_type_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_category_id_job" ON "job" ("category_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_province_id_job" ON "job" ("province_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_employer_id_job" ON "job" ("employer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_company_id_job" ON "job" ("company_id") `);
    }

}
