# Server

Express API for Simple Online Chess. The backend follows **MVC architecture**.

## MVC Architecture

Each endpoint is split across five layers. When adding a new endpoint, create **all** of the following files for that feature.

| Layer | Folder | Responsibility |
|-------|--------|----------------|
| **Types** | `src/types/` | Shared TypeScript types and interfaces (request bodies, domain data, API shapes) |
| **Model** | `src/models/` | Business rules and data access |
| **View** | `src/views/` | Response formatting (JSON shape sent to the client) |
| **Controller** | `src/controllers/` | HTTP handling — reads the request, calls the model, uses the view, sends the response |
| **Routes** | `src/routes/` | URL paths and HTTP methods, wired to controller handlers |

### Types convention

Keep types in **dedicated files** under `src/types/` — do not define `interface` / `type` inline in models, controllers, or views unless they are private helpers used only in that single file.

- **One file per feature**: `src/types/<feature>.types.ts` (e.g. `room.types.ts`, `game.types.ts`)
- **Export from the types file**; import elsewhere with `import type { ... } from "../types/<feature>.types"`
- **Group related types** in the same file: domain entities (`RoomData`), request bodies (`CreateRoomBody`), and other shared shapes for that feature
- **Socket events** — `src/types/socket.types.ts` for WebSocket payloads (separate from REST types)
- **Prisma enums** (e.g. `RoomStatus`) stay in the generated client; re-export or reference them from types files when needed

### Directory layout

```
server/src/
├── index.ts              # Entry point — starts the server
├── app.ts                # Express app setup (middleware, route mounting)
├── types/
│   ├── room.types.ts     # add <feature>.types.ts per endpoint (e.g. health.types.ts)
│   └── socket.types.ts   # WebSocket event payloads
├── models/
│   ├── health.model.ts
│   └── room.model.ts
├── views/
│   ├── health.view.ts
│   └── room.view.ts
├── controllers/
│   ├── health.controller.ts
│   └── room.controller.ts
├── routes/
│   ├── index.ts          # Combines and mounts all route modules
│   ├── health.routes.ts
│   └── room.routes.ts
└── socket/
    ├── index.ts          # Socket.IO setup — attach to HTTP server
    ├── types.ts          # Typed Server / Socket aliases
    └── handlers/
        └── room.handler.ts   # Real-time room events
```

### Adding a new endpoint

Example: `GET /games/:id`

1. **Types** — `src/types/game.types.ts`  
   Define interfaces for domain data (`GameData`), request bodies, and any shared shapes used across layers.

2. **Model** — `src/models/game.model.ts`  
   Import types from `src/types/game.types.ts`. Implement functions that load or compute game data.

3. **View** — `src/views/game.view.ts`  
   Export formatters that turn model data into the API response shape.

4. **Controller** — `src/controllers/game.controller.ts`  
   Export handler(s) that call the model, pass results through the view, and `res.json(...)`.

5. **Routes** — `src/routes/game.routes.ts`  
   Define paths and bind them to controller handlers.

6. **Register routes** — import and mount in `src/routes/index.ts`:

   ```ts
   import gameRoutes from "./game.routes";
   router.use("/games", gameRoutes);
   ```

### Flow

```
Request → Routes → Controller → Model  (imports types from src/types/)
                      ↓
                    View → Response
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |

Default port: `5000` (override with `PORT` environment variable). The Next.js client uses port `3000` by default.

## WebSocket (Socket.IO)

Real-time game events use **Socket.IO 4** on the same HTTP server as Express. CORS for WebSocket connections follows `CLIENT_ORIGIN` (same as REST).

### Architecture

Socket handlers live under `src/socket/` and follow the same separation as HTTP:

| Piece | Location | Responsibility |
|-------|----------|----------------|
| **Types** | `src/types/socket.types.ts` | Client ↔ server event names and payload shapes |
| **Setup** | `src/socket/index.ts` | Create `Socket.IO` server, register connection handlers |
| **Handlers** | `src/socket/handlers/` | Event logic (like controllers for WebSocket) |
| **Model** | `src/models/` | Shared business rules (e.g. `verifyRoomAccess`) |

Entry point (`src/index.ts`) creates an `http.Server` from the Express app, attaches Socket.IO, then listens on `PORT`.

### Client connection

Connect from the Next.js client to the same host as the REST API:

```ts
import { io } from "socket.io-client";

const socket = io(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000");
```

### Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `{ code: string; playerId: string }` | Join a Socket.IO room after creating/joining via REST. Optional ack callback returns `{ ok, room?, error? }`. |
| `room:leave` | — | Leave the current room channel |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room:player-joined` | `{ playerId, status }` | Another player connected to the room |
| `room:player-left` | `{ playerId }` | A player disconnected or left |
| `room:error` | `{ message }` | Reserved for future error broadcasts |

### Typical flow

1. **REST** — `POST /rooms` or `POST /rooms/join` to create or join a room in the database.
2. **WebSocket** — emit `room:join` with the room code and local `playerId` to subscribe to real-time updates.
3. Opponents receive `room:player-joined` / `room:player-left` when players connect or disconnect.

### Adding a new socket event

1. **Types** — add payloads to `ClientToServerEvents` or `ServerToClientEvents` in `src/types/socket.types.ts`.
2. **Handler** — implement the event in `src/socket/handlers/<feature>.handler.ts` (call model layer for validation).
3. **Register** — import and call the handler from `src/socket/index.ts` inside the `connection` callback.

## Database (Prisma + Neon PostgreSQL)

The backend uses **Prisma 7** with the **`@prisma/adapter-neon`** driver adapter and a hosted **[Neon](https://neon.tech/)** PostgreSQL database.

### Setup

1. Create a project on [Neon](https://console.neon.tech/) and copy both connection strings from **Connect**:
   - **Pooled connection** → `DATABASE_URL` (app runtime)
   - **Direct connection** → `DIRECT_URL` (Prisma CLI: migrate, push, studio)

2. Copy the example env file and paste your Neon URLs:

   ```bash
   cp .env.example .env
   ```

3. Apply migrations (after you add models to `prisma/schema.prisma`):

   ```bash
   npm run db:migrate
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

`GET /` reports `database: "connected"` when Prisma can reach Neon.

### Prisma files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Data models and generator config |
| `prisma.config.ts` | CLI config — uses `DIRECT_URL` for migrations |
| `src/lib/prisma.ts` | Singleton `PrismaClient` with Neon adapter (`DATABASE_URL`) |
| `src/generated/prisma/` | Generated client (gitignored; run `npm run db:generate`) |

### Environment variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `DATABASE_URL` | App runtime | Neon pooled connection (`-pooler` host) |
| `DIRECT_URL` | Prisma CLI | Neon direct connection (required for migrations) |

### Database scripts

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Create and apply migrations in dev |
| `npm run db:push` | Push schema changes without migration files |
| `npm run db:studio` | Open Prisma Studio |

### Adding models

Define models in `prisma/schema.prisma`, then run:

```bash
npm run db:migrate
```

Use the shared client from `src/lib/prisma.ts` in model layer files under `src/models/`.
