import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { query } from './connection.js';

dotenv.config();

export async function seedDatabase() {
  console.log('Seeding initial subscription plans...');

  const plans = [
    {
      name: 'Starter Plan',
      code: 'STARTER',
      description: 'Ideal for single-location cafés, food trucks, and small takeaway shops.',
      monthlyPrice: 5000,
      annualPrice: 50000,
      currency: 'PKR',
      trialDays: 14,
      gracePeriodDays: 3,
      entitlements: {
        maxBranches: 1,
        maxStaff: 5,
        maxDevices: 2,
        features: {
          inventory: true,
          kds: false,
          advancedReports: false,
          multiBranch: false,
          customerManagement: true,
          dataExport: false,
          advancedPermissions: false,
        },
      },
    },
    {
      name: 'Growth Plan',
      code: 'GROWTH',
      description: 'Perfect for busy dine-in restaurants needing Kitchen Display and Multi-Branch.',
      monthlyPrice: 12000,
      annualPrice: 120000,
      currency: 'PKR',
      trialDays: 14,
      gracePeriodDays: 5,
      entitlements: {
        maxBranches: 3,
        maxStaff: 20,
        maxDevices: 6,
        features: {
          inventory: true,
          kds: true,
          advancedReports: true,
          multiBranch: true,
          customerManagement: true,
          dataExport: true,
          advancedPermissions: true,
        },
      },
    },
    {
      name: 'Enterprise Plan',
      code: 'ENTERPRISE',
      description: 'Unlimited branches, staff, advanced franchise controls, and custom integrations.',
      monthlyPrice: 25000,
      annualPrice: 250000,
      currency: 'PKR',
      trialDays: 30,
      gracePeriodDays: 7,
      entitlements: {
        maxBranches: -1,
        maxStaff: -1,
        maxDevices: -1,
        features: {
          inventory: true,
          kds: true,
          advancedReports: true,
          multiBranch: true,
          customerManagement: true,
          dataExport: true,
          advancedPermissions: true,
        },
      },
    },
  ];

  for (const plan of plans) {
    await query(
      `
      INSERT INTO subscription_plans (name, code, description, monthly_price, annual_price, currency, trial_days, grace_period_days, entitlements, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        monthly_price = EXCLUDED.monthly_price,
        annual_price = EXCLUDED.annual_price,
        entitlements = EXCLUDED.entitlements,
        updated_at = CURRENT_TIMESTAMP;
      `,
      [
        plan.name,
        plan.code,
        plan.description,
        plan.monthlyPrice,
        plan.annualPrice,
        plan.currency,
        plan.trialDays,
        plan.gracePeriodDays,
        JSON.stringify(plan.entitlements),
      ],
      { isSuperAdmin: true }
    );
  }

  // Check if initial Super Admin exists
  const superAdminEmail = process.env.SUPER_ADMIN_DEFAULT_EMAIL || 'admin@posplatform.com';
  const superAdminPassword = process.env.SUPER_ADMIN_DEFAULT_PASSWORD || 'AdminPass123!';

  const { rows: existingAdmins } = await query(
    'SELECT id FROM platform_admins WHERE email = $1',
    [superAdminEmail],
    { isSuperAdmin: true }
  );

  if (existingAdmins.length === 0) {
    const passwordHash = await bcrypt.hash(superAdminPassword, 10);
    await query(
      `
      INSERT INTO platform_admins (email, password_hash, full_name, is_active)
      VALUES ($1, $2, $3, true)
      `,
      [superAdminEmail, passwordHash, 'Platform Administrator'],
      { isSuperAdmin: true }
    );
    console.log(`Created default Super Admin: ${superAdminEmail}`);
  }

  console.log('Database seeding completed.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
