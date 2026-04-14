import { MigrationInterface, QueryRunner } from "typeorm";

export class HeadhuntingSchema1776167689526 implements MigrationInterface {
    name = 'HeadhuntingSchema1776167689526'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "application_note" DROP CONSTRAINT "FK_application_note_author_user"`);
        await queryRunner.query(`CREATE TYPE "public"."job_invitation_status_enum" AS ENUM('pending', 'accepted', 'declined')`);
        await queryRunner.query(`CREATE TABLE "job_invitation" ("id" SERIAL NOT NULL, "employer_id" integer NOT NULL, "candidate_id" integer NOT NULL, "job_id" integer NOT NULL, "message" text, "status" "public"."job_invitation_status_enum" NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c6235185e458d778605e6974eb2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "saved_candidate" ("id" SERIAL NOT NULL, "employer_id" integer NOT NULL, "candidate_id" integer NOT NULL, "note" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d5526781b1ef0c83ecf6c6bdd34" UNIQUE ("employer_id", "candidate_id"), CONSTRAINT "PK_c1f9e20bf8f1561424981e6dbc4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD "is_public" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD "linkedin_url" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD "github_url" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD "portfolio_url" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "application_note" ADD CONSTRAINT "FK_9fd116a1c093195a7049de0000d" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "job_invitation" ADD CONSTRAINT "FK_7e6a23e6c0ded3d4c07d4f77b16" FOREIGN KEY ("employer_id") REFERENCES "employer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "job_invitation" ADD CONSTRAINT "FK_c21a57f870e6f9cd935cfee2568" FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "job_invitation" ADD CONSTRAINT "FK_e69629aa41088d169889c1146e8" FOREIGN KEY ("job_id") REFERENCES "job"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "saved_candidate" ADD CONSTRAINT "FK_03d630c27bd48f44d65639934db" FOREIGN KEY ("employer_id") REFERENCES "employer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "saved_candidate" ADD CONSTRAINT "FK_b3362e32d0a9c4bfe9a999106e6" FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "saved_candidate" DROP CONSTRAINT "FK_b3362e32d0a9c4bfe9a999106e6"`);
        await queryRunner.query(`ALTER TABLE "saved_candidate" DROP CONSTRAINT "FK_03d630c27bd48f44d65639934db"`);
        await queryRunner.query(`ALTER TABLE "job_invitation" DROP CONSTRAINT "FK_e69629aa41088d169889c1146e8"`);
        await queryRunner.query(`ALTER TABLE "job_invitation" DROP CONSTRAINT "FK_c21a57f870e6f9cd935cfee2568"`);
        await queryRunner.query(`ALTER TABLE "job_invitation" DROP CONSTRAINT "FK_7e6a23e6c0ded3d4c07d4f77b16"`);
        await queryRunner.query(`ALTER TABLE "application_note" DROP CONSTRAINT "FK_9fd116a1c093195a7049de0000d"`);
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "portfolio_url"`);
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "github_url"`);
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "linkedin_url"`);
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "is_public"`);
        await queryRunner.query(`DROP TABLE "saved_candidate"`);
        await queryRunner.query(`DROP TABLE "job_invitation"`);
        await queryRunner.query(`DROP TYPE "public"."job_invitation_status_enum"`);
        await queryRunner.query(`ALTER TABLE "application_note" ADD CONSTRAINT "FK_application_note_author_user" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
