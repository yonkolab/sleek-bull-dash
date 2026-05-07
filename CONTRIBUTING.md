# Contributing to Sleek Bull Dash

Thanks for taking the time to contribute! This document covers how to get the project running locally, the conventions we follow, and the process for submitting changes.

## Development Setup

### Prerequisites

- Node.js 20+
- A running Redis instance (local or via Docker)

### 1. Clone and install

```bash
git clone https://github.com/your-org/sleek-bull-dash
cd sleek-bull-dash
npm install
```

### 2. Environment

Copy `.env.local` (or create it) with at minimum:

```bash
BETTER_AUTH_SECRET=<generate with: npx @better-auth/cli secret>
BETTER_AUTH_URL=http://localhost:3001
DATABASE_URL="file:./dev.db"
REDIS_URL=redis://localhost:6379
```

For SSH tunnel support, also add:

```bash
ENCRYPTION_KEY=<64 hex chars — generate with: openssl rand -hex 32>
```

### 3. Database

```bash
npm run db:generate   # generate Prisma client
npm run db:push       # create SQLite tables
```

### 4. Start dev server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). Public sign-up is disabled, so create your first user with:

```bash
npm run db:studio
```

Create one `User` row and one `Account` row. In `Account`, set `providerId=credential`, set
`accountId` and `userId` to the same user id, and store a Better Auth-compatible password hash
in `password`.

## Project Structure

```
src/
  components/       # Shared UI components (CommandPalette, JobDetailSheet, ConnectionForm…)
  components/ui/    # shadcn/ui primitives (auto-generated, avoid editing manually)
  lib/              # Pure utilities (redis, queue, crypto, ssh-tunnel, auth-client…)
  routes/           # TanStack Router file-based routes
    _dashboard.tsx            # Pathless layout (sidebar + auth guard)
    _dashboard/               # All authenticated pages
      connections.tsx         # Redirects to default connection
      connections.$connectionId.tsx          # Redirects to first queue
      connections.$connectionId.queues.$queueName.tsx  # Main job list page
      settings/               # Connection management UI
  server/           # Server functions (queue-fns, connection-fns, auth-fns)
  integrations/     # Better Auth wrappers
prisma/             # Schema + migrations
```

## Code Conventions

- **Formatter / linter:** [Biome](https://biomejs.dev/) — run `npm run check` before committing. CI will fail on lint errors.
- **Imports:** Use the `#/` path alias (e.g. `#/lib/redis`, `#/components/ui/button`).
- **Server functions:** All BullMQ and Redis operations live in `src/server/` and are called via TanStack Start server functions (`createServerFn`). Never import BullMQ directly in client components.
- **State / data fetching:** TanStack Query for all server state. Polling intervals: 3 s for jobs, 5 s for queues, 30 s for connections.
- **Styling:** Tailwind v4 utility classes. Use `cn()` from `#/lib/utils` to merge conditional classes.
- **No secrets in code:** SSH private keys are AES-256-GCM encrypted before reaching the database. `ENCRYPTION_KEY` must never be committed.

## Submitting a Pull Request

1. Fork the repo and create a branch from `main`.
2. Make your changes, keeping commits focused and descriptive.
3. Run `npm run check` and fix any issues before pushing.
4. Open a PR against `main` with a clear description of what changed and why.
5. For bug fixes, include a minimal reproduction or test case in the description.
6. For new features, discuss the approach in an issue first if the change is significant.

## Reporting Issues

Open an issue on GitHub with:

- A clear title and description
- Steps to reproduce (for bugs)
- Your Node.js version, OS, and Redis version
- Relevant error messages or screenshots

## License

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).
