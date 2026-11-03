# Restaurant POS SaaS

Multi-tenant restaurant point-of-sale platform organized as an npm workspace monorepo.

## Workspaces

- `frontend` — React and Vite application
- `backend` — Fastify API and PostgreSQL services
- `shared` — shared TypeScript types and schemas

## Development

Install dependencies with `npm ci`. Copy `backend/.env.example` to `backend/.env` and configure the local database and secrets, then run `npm run dev`.

Useful scripts:

- `npm run build` — build all workspaces
- `npm test` — run backend tests
- `npm run db:migrate` — apply database migrations
- `npm run db:seed` — seed the database
