import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanySlug1775976271310 implements MigrationInterface {
  name = 'AddCompanySlug1775976271310';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company" ADD "slug" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "company" ADD CONSTRAINT "UQ_47216baa0f0c8ebc6ee5a74989c" UNIQUE ("slug")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company" DROP CONSTRAINT "UQ_47216baa0f0c8ebc6ee5a74989c"`,
    );
    await queryRunner.query(`ALTER TABLE "company" DROP COLUMN "slug"`);
  }
}
