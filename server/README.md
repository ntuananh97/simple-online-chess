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
- **Prisma enums** (e.g. `RoomStatus`) stay in the generated client; re-export or reference them from types files when needed

### Directory layout

```
server/src/
├── index.ts              # Entry point — starts the server
├── app.ts                # Express app setup (middleware, route mounting)
├── types/
│   └── room.types.ts     # add <feature>.types.ts per endpoint (e.g. health.types.ts)
├── models/
│   ├── health.model.ts
│   └── room.model.ts
├── views/
│   ├── health.view.ts
│   └── room.view.ts
├── controllers/
│   ├── health.controller.ts
│   └── room.controller.ts
└── routes/
    ├── index.ts          # Combines and mounts all route modules
    ├── health.routes.ts
    └── room.routes.ts
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

Default port: `3000` (override with `PORT` environment variable).

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
