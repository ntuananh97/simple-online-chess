# Client

Next.js frontend for Simple Online Chess.

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Start the backend separately (see [server/README.md](../server/README.md)).

## Environment

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Express API base URL (default `http://localhost:5000`) |

## API layer

HTTP calls use native `fetch` through a shared helper in `src/lib/api/`.

```
src/lib/api/
├── config.ts       # API_BASE_URL
├── fetch.ts        # apiFetch(), ApiError
├── health.api.ts   # sample: GET /
└── index.ts        # public exports
```

### Sample: health check

```ts
import { healthApi } from "@/lib/api";

const health = await healthApi.getHealth();
```

### Adding a new API module

1. Add types in `src/types/<feature>.types.ts`
2. Create `src/lib/api/<feature>.api.ts` using `apiFetch`
3. Export from `src/lib/api/index.ts`

```ts
// src/lib/api/room.api.ts
import { apiFetch } from "./fetch";

export const roomApi = {
  create: (whiteId: string) =>
    apiFetch("/rooms", { method: "POST", body: { whiteId } }),
};
```
