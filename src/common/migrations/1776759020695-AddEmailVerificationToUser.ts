import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationToUser1776759020695 implements MigrationInterface {
  name = 'AddEmailVerificationToUser1776759020695';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "is_email_verified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "email_verification_token" character varying(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "email_verification_token"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "is_email_verified"`,
    );
  }
}
