import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { authRoutes } from './routes/auth.routes.js';
import { platformRoutes } from './routes/platform.routes.js';
import { restaurantRoutes } from './routes/restaurant.routes.js';
import { menuRoutes } from './routes/menu.routes.js';
import { orderRoutes } from './routes/order.routes.js';
import { kdsRoutes } from './routes/kds.routes.js';
import { inventoryRoutes } from './routes/inventory.routes.js';
import { financialRoutes } from './routes/financial.routes.js';
import { customerRoutes } from './routes/customer.routes.js';
import { syncRoutes } from './routes/sync.routes.js';
import { costingRoutes } from './routes/costing.routes.js';
import { reservationRoutes } from './routes/reservation.routes.js';
import { pool } from './db/connection.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: process.env.NODE_ENV === 'test' ? false : {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Security Headers
  app.register(helmet, {
    contentSecurityPolicy: false, // relaxed for development & swagger
  });

  // CORS
  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000').split(',');
  app.register(cors, {
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Rate Limiter
  app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
  });

  // OpenAPI / Swagger Documentation
  app.register(swagger, {
    openapi: {
      info: {
        title: 'Multi-Tenant Restaurant POS SaaS API',
        description: 'Production-ready REST API for Restaurant POS SaaS platform',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:4000', description: 'Local Development Server' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Health and Readiness checks
  app.get('/health', async () => ({ status: 'healthy', timestamp: new Date().toISOString() }));
  app.get('/ready', async (_, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ready', database: 'connected' };
    } catch (err: any) {
      return reply.status(503).send({ status: 'unready', error: err.message });
    }
  });

  // Register Routes
  app.register(authRoutes);
  app.register(platformRoutes);
  app.register(restaurantRoutes);
  app.register(menuRoutes);
  app.register(orderRoutes);
  app.register(kdsRoutes);
  app.register(inventoryRoutes);
  app.register(financialRoutes);
  app.register(customerRoutes);
  app.register(syncRoutes);
  app.register(costingRoutes);
  app.register(reservationRoutes);

  // Global Error Handler
  app.setErrorHandler((error: any, request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: error.message || 'Internal Server Error',
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      statusCode,
    });
  });

  return app;
}
