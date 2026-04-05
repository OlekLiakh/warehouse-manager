# Склад Батьків — Warehouse Manager

Warehouse management system for Tesla auto parts.

## Quick Start

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

## Environment Setup

This project uses two Supabase instances:

| Environment | File | In Git? | Purpose |
|-------------|------|---------|---------|
| **Staging** | `frontend/.env.local` | No (gitignored) | Local development |
| **Production** | Vercel env vars | N/A | Live deployment |

### Local development (staging)

Create `frontend/.env.local`:

```env
VITE_SUPABASE_URL=<staging supabase url>
VITE_SUPABASE_KEY=<staging publishable key>
```

### Production (Vercel)

Production environment variables are configured directly in the Vercel dashboard. Do not store production keys in files committed to git.

## Scripts

```bash
npm run dev          # Dev server with HMR
npm run build        # TypeScript check + production build
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run lint         # ESLint
```

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 8
- **Backend:** Supabase (PostgreSQL + REST API)
- **Testing:** Vitest + Testing Library
- **Hosting:** Vercel
