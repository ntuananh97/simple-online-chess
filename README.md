# Simple Online Chess

A lightweight web app for playing chess online with another visitor. No accounts or sign-up — open the site, get matched, and play.

## Project Goal

Simple Online Chess lets two anonymous players play a standard chess game in the browser. The focus is on a frictionless experience: no registration, no passwords, and no persistent user profiles.

When someone visits the site for the first time, the client generates a UUID and stores it in `localStorage`. That identifier is used to distinguish players in a game session. Two visitors are paired as random opponents and can play a full game of chess in real time.

There is intentionally **no user system** — no login, no accounts, and no server-side user database. Identity is limited to the browser-local UUID for the current session.

## Repository Structure

```
simple-online-chess/
├── client/     # Frontend (Next.js)
└── server/     # Backend (Express API)
```

## Tech Stack

### Frontend (`client/`)

| Technology | Purpose |
|------------|---------|
| [Next.js](https://nextjs.org/) 16 | React framework (App Router) |
| [React](https://react.dev/) 19 | UI library |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [Tailwind CSS](https://tailwindcss.com/) 4 | Utility-first styling |
| [shadcn/ui](https://ui.shadcn.com/) | Accessible UI components (Radix Nova style) |
| [Radix UI](https://www.radix-ui.com/) | Headless primitives for shadcn components |
| [Lucide React](https://lucide.dev/) | Icon library |
| [ESLint](https://eslint.org/) | Linting (Next.js config) |

The frontend runs on the default Next.js dev port (`http://localhost:3000` unless configured otherwise).

#### API client (fetch)

The client talks to the Express backend via a small fetch wrapper in `client/src/lib/api/`.

| File | Role |
|------|------|
| `src/lib/api/config.ts` | Base URL from `NEXT_PUBLIC_API_URL` |
| `src/lib/api/fetch.ts` | Shared `apiFetch()` helper and `ApiError` |
| `src/lib/api/<feature>.api.ts` | One module per API resource (e.g. `health.api.ts`) |
| `src/types/<feature>.types.ts` | Response and request TypeScript types |

Copy the example env file and point it at the backend (default port `5000`):

```bash
cd client
cp .env.example .env.local
```

Example — call the health endpoint:

```ts
import { healthApi } from "@/lib/api";

const health = await healthApi.getHealth();
// { message: "Simple Online Chess API", database: "connected" }
```

When adding a new endpoint, create matching types and an `*.api.ts` module that uses `apiFetch`.

#### Socket client (Socket.IO)

Real-time events use **Socket.IO 4** on the same host as the REST API (`NEXT_PUBLIC_API_URL`). Event types mirror `server/src/types/socket.types.ts`.

| File | Role |
|------|------|
| `src/lib/socket/config.ts` | WebSocket URL from `NEXT_PUBLIC_API_URL` |
| `src/lib/socket/socket.ts` | Typed singleton via `getSocket()` / `disconnectSocket()` |
| `src/types/socket.types.ts` | Client ↔ server event payloads |

Example — join a room channel after REST create/join:

```ts
import { getSocket } from "@/lib/socket";

const socket = getSocket();

if (!socket.connected) {
  socket.connect();
}

socket.emit("room:join", { code: roomCode, playerId }, (ack) => {
  if (ack.ok) {
  console.log("Joined room:", ack.room);
  }
});

socket.on("room:player-joined", ({ playerId, status }) => {
  console.log("Player joined:", playerId, status);
});
```

See [server/README.md](server/README.md) for the full event list and typical REST → WebSocket flow.

#### UI components (shadcn/ui)

The client uses [shadcn/ui](https://ui.shadcn.com/) for reusable, accessible components. Configuration lives in `client/components.json` (style: `radix-nova`, CSS variables in `src/app/globals.css`).

| Path | Role |
|------|------|
| `components.json` | shadcn CLI config (aliases, style, Tailwind paths) |
| `src/components/ui/` | Installed shadcn components (e.g. `button.tsx`) |
| `src/lib/utils.ts` | `cn()` helper — merges Tailwind classes with `clsx` + `tailwind-merge` |

Add more components from the `client/` directory:

```bash
cd client
npx shadcn@latest add card dialog input
```

Example usage:

```tsx
import { Button } from "@/components/ui/button";

<Button variant="outline">Play</Button>
```

### Backend (`server/`)

| Technology | Purpose |
|------------|---------|
| [Node.js](https://nodejs.org/) | Runtime |
| [Express](https://expressjs.com/) 5 | HTTP API server |
| [PostgreSQL](https://www.postgresql.org/) ([Neon](https://neon.tech/)) | Hosted relational database |
| [Prisma](https://www.prisma.io/) 7 | ORM and database migrations |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [tsx](https://github.com/privatenumber/tsx) | Dev server with watch mode |

The API server listens on port `5000` by default (override with the `PORT` environment variable). Run the Next.js client on port `3000` so both apps can run side by side in development.

#### MVC architecture

The backend uses **Model–View–Controller**. Every endpoint is implemented across four layers — when adding a new endpoint, create all of them:

| Layer | Folder | Role |
|-------|--------|------|
| Model | `server/src/models/` | Data types, business logic, data access |
| View | `server/src/views/` | JSON response formatting |
| Controller | `server/src/controllers/` | HTTP handlers (request → model → view → response) |
| Routes | `server/src/routes/` | URL paths and method bindings |

```
Request → Routes → Controller → Model
                      ↓
                    View → Response
```

Example layout for a `GET /games/:id` endpoint:

```
server/src/
├── models/game.model.ts
├── views/game.view.ts
├── controllers/game.controller.ts
└── routes/game.routes.ts   → registered in routes/index.ts
```

See [server/README.md](server/README.md) for full backend conventions and step-by-step endpoint guide.

## Getting Started

Install dependencies and run each app from its directory.

**Frontend**

```bash
cd client
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL → backend (default http://localhost:5000)
npm run dev
```

**Backend**

```bash
cd server
npm install
cp .env.example .env   # add Neon DATABASE_URL and DIRECT_URL
npm run dev
```

Build for production:

```bash
# Frontend
cd client && npm run build && npm start

# Backend
cd server && npm run build && npm start
```

## Player Identity (Planned Behavior)

1. On first visit, the client creates a UUID (e.g. via `crypto.randomUUID()`).
2. The UUID is saved in `localStorage` and reused on later visits from the same browser.
3. The server uses this identifier to assign players to games and sync moves — without storing personal data or requiring authentication.
