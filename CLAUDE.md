# Склад Батьків — Warehouse Manager

## Project Overview
Warehouse management system for Tesla auto parts. Web app + Telegram AI bot (planned).

## Architecture
- **Frontend:** React 19 + TypeScript + Vite 8 (no Tailwind — inline styles)
- **Backend:** Supabase (PostgreSQL + REST API)
- **Telegram Bot:** Node.js + Telegraf + Google Gemini (planned, not yet created)
- **Hosting:** Vercel (frontend) + Supabase Edge Functions (backend)

## Repository Structure
```
warehouse-manager/
├── frontend/              # React + TypeScript app
│   ├── src/
│   │   ├── lib/           # supabase client
│   │   ├── pages/         # route components (Products, ProductDetail, ProductForm)
│   │   ├── types.ts       # Product, StockMovement, ProductForm, MovementForm
│   │   ├── App.tsx        # BrowserRouter with routes
│   │   └── main.tsx       # entry point
│   ├── .env.local         # VITE_SUPABASE_URL, VITE_SUPABASE_KEY
│   └── package.json
└── CLAUDE.md
```

## Key Commands
```bash
# Frontend dev server
cd frontend && npm run dev        # http://localhost:5173

# Type check
cd frontend && npx tsc -b --noEmit

# Lint
cd frontend && npm run lint

# Build
cd frontend && npm run build
```

## TypeScript Conventions
- **verbatimModuleSyntax is ON** — always use `import type { X }` for type-only imports
- Target: ES2023, strict mode enabled
- noUnusedLocals and noUnusedParameters enabled

## Database Schema (Supabase)

### products
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, auto-generated |
| name | text | NOT NULL |
| articles | text[] | array of article codes |
| shelf_location | text | nullable |
| current_stock | int4 | managed by triggers |
| boss_quantity | int4 | nullable, reference from BOSS system |
| is_active | boolean | DEFAULT true, soft delete |
| notes | text | nullable |
| created_at | timestamptz | auto |
| updated_at | timestamptz | auto |

### stock_movements
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, auto-generated |
| product_id | uuid | FK -> products.id |
| type | text | 'IN', 'OUT', or 'MOVE' |
| quantity | int4 | |
| counterparty | text | nullable |
| invoice_number | text | nullable |
| note | text | nullable |
| created_at | timestamptz | auto |

## Business Rules
- **NO hard deletes** — use `is_active = false` (soft delete / deactivation)
- `current_stock` is updated by DB triggers on stock_movements insert
- Products list filters `is_active = true` by default; toggle shows inactive
- UI language: Ukrainian (uk-UA)

## Environment Variables
Frontend `.env.local` (never commit):
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_KEY` — Supabase publishable/anon key

## Notion Documentation
- Project HQ: https://www.notion.so/anatomyfinancial/Project-HQ-33950a2c0f95811fa89fef41eb25ff2f
- Ground truth (v2): https://www.notion.so/33950a2c0f95819fb651e524ab4abb4e
