import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProvinceMetadata1774109470266 implements MigrationInterface {
  name = 'CreateProvinceMetadata1774109470266';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "province_metadata" ("code" character varying(10) NOT NULL, "name" character varying(255) NOT NULL, "slug" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e811dc8d58c1e48c95a1a06ab65" UNIQUE ("slug"), CONSTRAINT "PK_6daef35cab8470a820bf1cac0b0" PRIMARY KEY ("code"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "province_metadata"`);
  }
}
