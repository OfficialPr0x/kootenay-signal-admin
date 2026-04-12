# Kootenay Signal Admin

Admin dashboard for managing the Kootenay Signal digital agency operations.

## Features

- **Dashboard** — Overview of leads, clients, revenue, and email activity
- **Lead Management** — Track, filter, and manage incoming leads with status workflows
- **Client Management** — Manage active clients with plan tracking and MRR visibility
- **Invoice System** — Create, track, and manage invoices per client
- **Email (Resend)** — Compose and send emails via Resend API with full send history
- **Service Management** — Configure service offerings (SignalCore, SearchVault, SmartNav, SearchSync)
- **Settings** — Profile management, password changes, environment status
- **Webhook API** — Public endpoint for your main site's contact form to submit leads

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS** (dark theme matching the agency brand)
- **Prisma + SQLite** (lightweight, zero-config database)
- **Resend** (email sending)
- **JWT Auth** (cookie-based, httpOnly)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

Configure `.env`:

```env
DATABASE_URL="file:./dev.db"
RESEND_API_KEY="re_your_api_key_here"
AUTH_SECRET="generate-a-random-secret"
FROM_EMAIL="Kootenay Signal <admin@yourdomain.com>"
```

### 3. Initialize database

```bash
npx prisma migrate dev
npx tsx prisma/seed.ts
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Default Login

- **Email:** admin@kootenaysignal.com
- **Password:** admin123

> Change this immediately in Settings after first login.

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/logout` | Yes | Logout |
| GET/PATCH | `/api/auth/me` | Yes | Get/update profile |
| POST | `/api/auth/password` | Yes | Change password |
| POST | `/api/auth/setup` | No* | Initial admin setup |
| GET/POST | `/api/leads` | Yes | List/create leads |
| GET/PATCH/DELETE | `/api/leads/[id]` | Yes | Manage individual lead |
| GET/POST | `/api/clients` | Yes | List/create clients |
| GET/PATCH/DELETE | `/api/clients/[id]` | Yes | Manage individual client |
| GET/POST | `/api/invoices` | Yes | List/create invoices |
| PATCH/DELETE | `/api/invoices/[id]` | Yes | Manage individual invoice |
| GET/POST | `/api/email` | Yes | Email history / send email |
| GET/POST | `/api/services` | Yes | List/create services |
| PATCH/DELETE | `/api/services/[id]` | Yes | Manage individual service |
| POST | `/api/webhooks/leads` | No | Public webhook for contact form |

\* Setup only works when no users exist

## Webhook Integration

Add this to your main Kootenay Signal site's contact form:

```js
fetch('https://your-admin-domain.com/api/webhooks/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, email, phone, business, message })
});
```
