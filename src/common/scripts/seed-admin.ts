import { DataSource } from 'typeorm';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'nestjs_ats',
    entities: [UserEntity],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('Data Source has been initialized!');

    const userRepository = dataSource.getRepository(UserEntity);

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@ats.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

    // Check if admin already exists
    const existingAdmin = await userRepository.findOne({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      console.log(`Admin with email ${adminEmail} already exists.`);
      return;
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = userRepository.create({
      email: adminEmail,
      password: hashedPassword,
      role: UserRole.ADMIN,
    });

    await userRepository.save(admin);
    console.log(`Admin user ${adminEmail} created successfully!`);
    console.log(`Password: ${adminPassword}`);
  } catch (err) {
    console.error('Error during Data Source initialization', err);
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Fatal error during seeding:', err);
  process.exit(1);
});
