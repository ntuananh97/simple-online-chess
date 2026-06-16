# Play Feature — Implementation Progress

This document summarizes what has been built so far for the online chess play feature in **Simple Online Chess**. It covers the room lifecycle (create, join, real-time sync) and supporting infrastructure on both client and server.

---

## Overview

The play flow is split across **REST** (persist room data in PostgreSQL) and **WebSocket** (real-time room presence and game state broadcast). Players are identified by a browser-local UUID stored in `localStorage` — no accounts or authentication.

**Typical flow today:**

1. Player A creates a room via `POST /rooms` and is redirected to `/play/{code}`.
2. Player B enters the room code on the home page, joins via `POST /rooms/join`, and is redirected to the same play URL.
3. Both clients emit `room:join` over Socket.IO to subscribe to the room channel and receive live updates.

---

## Database Layer

| Item | Status | Notes |
|------|--------|-------|
| `Room` model (Prisma) | Done | Single model with `roomCode`, `status`, `fen`, `whiteId`, `blackId`, timestamps |
| `RoomStatus` enum | Done | `WAITING`, `PLAYING`, `COMPLETED`, `ABANDONED` |
| Initial migration | Done | `prisma/migrations/20260611093126_init_db/` |
| Default FEN | Done | Standard starting position stored on room creation |
| Neon + Prisma 7 setup | Done | Pooled `DATABASE_URL` for runtime, `DIRECT_URL` for CLI |

---

## Server — REST API (Rooms)

Routes are registered at `/rooms` in `server/src/routes/room.routes.ts` and follow the MVC pattern (controller → model → view).

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/rooms` | `POST` | Done | Create a room; body `{ whiteId }`. Returns room `id`, `code`, `status`, `createdAt`. |
| `/rooms/join` | `POST` | Done | Join as black; body `{ code, blackId }`. Sets `blackId`, transitions status to `PLAYING`. |
| `/rooms/:code` | `GET` | Done | Fetch room metadata; query `playerId` required. Verifies the caller is `whiteId` or `blackId`. |

### Room business logic (`server/src/models/room.model.ts`)

| Feature | Status | Notes |
|---------|--------|-------|
| 6-character room code generation | Done | Uppercase alphanumeric (excludes ambiguous chars `0`, `O`, `1`, `I`) |
| Unique code retry | Partial | Loop exists; collision handling relies on DB unique constraint |
| Join validation | Done | Room not found (404), join own room (400), room full (409), wrong status (409) |
| Re-join by same black player | Done | Idempotent return if `blackId` already matches |
| Access verification | Done | `verifyRoomAccess` and `getRoomGameState` for REST and socket layers |
| `JoinRoomError` | Done | Typed errors with HTTP status codes |

### Response formatting (`server/src/views/room.view.ts`)

| Feature | Status |
|---------|--------|
| Consistent JSON shape for create / join / get | Done |
| ISO `createdAt` strings | Done |

---

## Server — WebSocket (Socket.IO)

Setup in `server/src/socket/index.ts`. Handlers in `server/src/socket/handlers/room.handler.ts`.

### Client → Server events

| Event | Status | Description |
|-------|--------|-------------|
| `room:join` | Done | Payload `{ code, playerId }`. Validates membership, joins `room:{id}` channel, optional ack `{ ok, room?, error? }`. |
| `room:leave` | Done | Leaves the current room channel and notifies others. |

### Server → Client events

| Event | Status | Description |
|-------|--------|-------------|
| `room:state` | Done | Sent to the joining client: `{ id, code, status, fen, turn, whiteId, blackId }`. |
| `room:player-joined` | Done | Broadcast to others in the room when a player connects. |
| `room:player-left` | Done | Broadcast when a player leaves or disconnects. |
| `room:error` | Defined only | Typed in `socket.types.ts`; no handler emits it yet. |

### Socket session data

| Feature | Status | Notes |
|---------|--------|-------|
| `socket.data.playerId` | Done | Set on join |
| `socket.data.roomId` | Done | Set on join; cleared on leave |
| Auto-leave previous room on re-join | Done | Leaves old channel if joining a different room |
| Disconnect cleanup | Done | `disconnect` triggers `leaveRoom` |

---

## Server — In-Memory Game State

`server/src/models/game.model.ts` uses **chess.js** to hold active game instances in a `Map<roomId, Chess>`.

| Function | Status | Description |
|----------|--------|-------------|
| `getOrCreateGame(roomId, fen)` | Done | Used on `room:join` to load or create a `Chess` instance from DB FEN |
| `getGame(roomId)` | Done | Lookup without creating (reserved for move handling) |
| `removeGame(roomId)` | Done | Map cleanup (not yet called from handlers) |

The RAM map is the fast path for game logic; the database `fen` field is the persistence source of truth after server restarts.

---

## Client — App Pages (`client/src/app/`)

| Page / layout | Status | Description |
|---------------|--------|-------------|
| `layout.tsx` | Done | Root layout with fonts, `SocketProvider`, and Sonner toasts |
| `page.tsx` (home) | Done | Landing page with title, decorative board, create/join actions |
| `play/[roomCode]/page.tsx` | Done | Dynamic route; renders `PlayPage` with the room code from the URL |
| `globals.css` | Done | Tailwind + shadcn theme variables |

---

## Client — Home & Room Entry

| Component / module | Status | Description |
|--------------------|--------|-------------|
| `HomeActions` | Done | "Play Game" (create room) and "Join" (enter code) with loading states and toasts |
| `ChessBoardDecoration` | Done | Static 8×8 decorative grid (not interactive) |
| `roomApi.createRoom` | Done | `POST /rooms` with local `whiteId` |
| `roomApi.joinRoom` | Done | `POST /rooms/join` with code and `blackId` |
| `roomApi.getRoom` | Done | Implemented but not used on the play page (REST load is commented out) |
| Navigation after create/join | Done | `router.push(/play/{code})` |

---

## Client — Play Page

| Feature | Status | Description |
|---------|--------|-------------|
| `PlayPage` component | Done | Main play view at `/play/[roomCode]` |
| Socket `room:join` on mount | Done | Emits with `roomCode` and local `playerId` |
| Socket `room:leave` on unmount | Done | Cleanup when leaving the page |
| Listen `room:state` | Done | Sets game state and ends loading |
| Listen `room:player-joined` | Done | Updates room status when opponent joins |
| `RoomStatusDisplay` | Done | Shows room code and status badge (`WAITING`, `PLAYING`, etc.) |
| Turn indicator | Done | Displays whose turn (`w` / `b`) from `room:state` |
| Error / loading UI | Partial | Loading spinner works; REST error path exists but REST fetch is disabled |
| Ack handling for `room:join` | Not done | Join emit does not use the ack callback for error display |

---

## Client — Shared Infrastructure

| Module | Status | Description |
|--------|--------|-------------|
| `useUserStore` (Zustand) | Done | Generates or loads UUID from `localStorage` as `userId` |
| `apiFetch` + `ApiError` | Done | Shared REST client with JSON body and error parsing |
| `getSocket` / `disconnectSocket` | Done | Typed Socket.IO singleton (`socket.io-client`) |
| `SocketProvider` | Done | React context; auto-connects on mount |
| `useListenEvent` | Done | Stable subscription hook for server events |
| `socket.types.ts` | Done | Mirrors server event payloads |
| `room.types.ts` | Done | REST response and request types |
| shadcn/ui (`Button`, `Input`, `Sonner`) | Done | Used on home and play pages |

---

## Not Yet Implemented

The following are planned or implied by the project goal but are **not** built yet:

| Area | Notes |
|------|-------|
| Interactive chess board | No piece rendering, drag-and-drop, or square selection |
| Move events | No `game:move` (or similar) socket handler or client emit |
| Move validation & broadcast | `getGame` exists server-side but no move pipeline |
| FEN persistence on moves | DB `fen` is only read on join; not updated after moves |
| Game end detection | No checkmate / stalemate / draw handling; `COMPLETED` status unused |
| Abandon on disconnect | `ABANDONED` status exists in schema but is not set when players leave |
| Random matchmaking | README describes pairing random opponents; current UX is manual create/join by code |
| `room:error` broadcasts | Event type defined, not emitted |
| `removeGame` cleanup | Helper exists, not wired to room lifecycle |
| Reconnect / resync UX | Socket re-join works; no dedicated offline or reconnect UI |

---

## File Reference

### Server

```
server/src/
├── routes/room.routes.ts
├── controllers/room.controller.ts
├── models/room.model.ts
├── models/game.model.ts
├── views/room.view.ts
├── types/room.types.ts
├── types/socket.types.ts
└── socket/
    ├── index.ts
    └── handlers/room.handler.ts
```

### Client

```
client/src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── play/[roomCode]/page.tsx
├── components/
│   ├── home/home-actions.tsx
│   ├── home/chess-board-decoration.tsx
│   └── play/play-page.tsx
│   └── play/room-status-display.tsx
├── lib/api/room.api.ts
├── lib/socket/socket.ts
├── providers/SocketProvider.tsx
├── hooks/useListenEvent.ts
└── stores/useUserStore.ts
```

---

## Summary

**Done:** End-to-end room creation and joining (REST + redirect), anonymous player identity, Socket.IO room channels, real-time presence (`player-joined` / `player-left`), initial game state sync (`fen`, `turn`, player IDs), in-memory chess.js instances per room, and basic play-page UI showing room code and status.

**Next logical steps:** Interactive board UI, move socket events with server-side validation, FEN writes to the database, game-over and abandon flows, and polish (ack errors, reconnect, matchmaking if desired).
