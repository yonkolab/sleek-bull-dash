# Sleek Bull Dash

An open-source, self-hosted BullMQ dashboard built with TanStack Start, shadcn/ui, and Better Auth.

## Features

- **Queue monitoring** — view all BullMQ queues with job counts per status
- **Job management** — retry failed jobs, remove jobs, clean queues
- **Lifecycle timeline** — per-job wait/run/finish durations at a glance
- **Auto-discovery** — automatically discovers queues by scanning Redis keys
- **Dark mode** — system preference aware, persisted to localStorage
- **Authentication** — login protected with Better Auth (email/password)
- **Real-time** — auto-refresh every 3s with TanStack Query

## Stack

| Layer | Tech |
|---|---|
| Framework | TanStack Start (React SSR, Node.js) |
| Routing | TanStack Router (file-based) |
| Data fetching | TanStack Query |
| UI components | shadcn/ui (New York, Zinc, Tailwind v4) |
| Auth | Better Auth |
| Database (auth only) | Prisma + SQLite |
| Queue | BullMQ + ioredis |

## Getting Started

### Prerequisites

- Node.js 20+
- A running Redis instance with BullMQ queues

### Installation

```bash
git clone https://github.com/your-org/sleek-bull-dash
cd sleek-bull-dash
npm install
```

### Configuration

Edit `.env.local`:

```bash
# Authentication
BETTER_AUTH_SECRET=<generate with: npx @better-auth/cli secret>
BETTER_AUTH_URL=http://localhost:3000

# Database (stores user accounts and sessions)
DATABASE_URL="file:./dev.db"

# Redis connection
REDIS_URL=redis://localhost:6379

# Queue names — leave empty to auto-discover from Redis
BULLMQ_QUEUES=
```

### Database setup

```bash
# Generate Prisma client
npm run db:generate

# Push auth tables to SQLite
npm run db:push
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

## Queue Discovery

If `BULLMQ_QUEUES` is not set, the dashboard scans Redis for `*:meta` keys to auto-discover queues. Works with both `bull:name` and `{bull:name}` (Redis Cluster) key patterns.

For explicit control (recommended in production):

```bash
BULLMQ_QUEUES=payments,emails,notifications
```

## Development

```bash
npm run dev            # start dev server
npm run build          # production build
npm run start          # run production build
npm run lint           # biome lint
npm run check          # biome check (lint + format)
npm run db:generate    # regenerate Prisma client after schema changes
npm run db:push        # push schema changes to database
npm run storybook      # component development
```

## License

MIT
