import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCandidateTable1773626787578 implements MigrationInterface {
    name = 'CreateCandidateTable1773626787578'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "candidate" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "full_name" character varying(255), "gender" character varying(10), "phone" character varying(20), "avatar_url" character varying(255), "cv_url" character varying(255), "bio" text, "province_id" integer, "position" character varying(255), "salary_min" numeric(15,2), "salary_max" numeric(15,2), "job_type_id" integer, "year_working_experience" integer, CONSTRAINT "UQ_77af458165fe750934e8425031b" UNIQUE ("user_id"), CONSTRAINT "REL_77af458165fe750934e8425031" UNIQUE ("user_id"), CONSTRAINT "PK_b0ddec158a9a60fbc785281581b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD CONSTRAINT "FK_77af458165fe750934e8425031b" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidate" DROP CONSTRAINT "FK_77af458165fe750934e8425031b"`);
        await queryRunner.query(`DROP TABLE "candidate"`);
    }

}
