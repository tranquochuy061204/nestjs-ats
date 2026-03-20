import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCertificateTable1774037440766 implements MigrationInterface {
    name = 'CreateCertificateTable1774037440766'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "certificate" ("id" SERIAL NOT NULL, "candidate_id" integer NOT NULL, "name" character varying(255) NOT NULL, "cer_img_url" character varying(255), CONSTRAINT "PK_8daddfc65f59e341c2bbc9c9e43" PRIMARY KEY ("id")); COMMENT ON COLUMN "certificate"."name" IS 'Tên chứng chỉ'; COMMENT ON COLUMN "certificate"."cer_img_url" IS 'Ảnh chụp chứng chỉ'`);
        await queryRunner.query(`ALTER TABLE "certificate" ADD CONSTRAINT "FK_ecbb7801eb205538825fa89b2bb" FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "certificate" DROP CONSTRAINT "FK_ecbb7801eb205538825fa89b2bb"`);
        await queryRunner.query(`DROP TABLE "certificate"`);
    }

}
