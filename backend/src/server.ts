import dotenv from 'dotenv';
import { buildApp } from './app.js';
import { runMigrations } from './db/migrator.js';
import { seedDatabase } from './db/seed.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    // Run migrations and seed on startup if needed
    await runMigrations();
    await seedDatabase();

    const app = buildApp();
    await app.listen({ port: PORT, host: HOST });
    console.log(`Server listening on http://${HOST}:${PORT}`);
    console.log(`API Documentation available at http://${HOST}:${PORT}/documentation`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();
