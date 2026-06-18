# Play Feature — Implementation Progress

This document summarizes what has been built so far for the online chess play feature in **Simple Online Chess**. It covers the room lifecycle (create, join, real-time sync), interactive gameplay, game-over handling, and supporting infrastructure on both client and server.

---

## Overview

The play flow is split across **REST** (persist room data in PostgreSQL) and **WebSocket** (real-time room presence, moves, and game state). Players are identified by a browser-local UUID stored in `localStorage` — no accounts or authentication.

**Typical flow today:**

1. Player A creates a room via `POST /rooms` and is redirected to `/play/{code}`.
2. Player B enters the room code on the home page, joins via `POST /rooms/join`, and is redirected to the same play URL.
3. Both clients emit `room:join` over Socket.IO to subscribe to the room channel and receive live updates.
4. Once status is `PLAYING`, the interactive chess board is shown. Moves are sent via `room:move`, validated server-side, and broadcast to the opponent. When the game ends, all clients receive `room:game-over`.

---

## Database Layer

| Item | Status | Notes |
|------|--------|-------|
| `Room` model (Prisma) | Done | Single model with `roomCode`, `status`, `fen`, `whiteId`, `blackId`, timestamps |
| `RoomStatus` enum | Done | `WAITING`, `PLAYING`, `COMPLETED`, `ABANDONED` |
| Initial migration | Done | `prisma/migrations/20260611093126_init_db/` |
| Default FEN | Done | Standard starting position stored on room creation |
| Neon + Prisma 7 setup | Done | Pooled `DATABASE_URL` for runtime, `DIRECT_URL` for CLI |
| FEN updated after moves | Not done | DB `fen` is read on join only; in-memory state is authoritative during play |
| `COMPLETED` status in DB | Not done | Client sets local status on `room:game-over`; server does not persist it yet |

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
| `room:join` | Done | Payload `{ code, playerId }`. Validates membership, joins `room:{id}` channel, sets `playerColor`, optional ack `{ ok, room?, error? }`. |
| `room:leave` | Done | Leaves the current room channel and notifies others. |
| `room:move` | Done | Payload `{ move: { from, to, promotion? }, roomId }`. Validates turn and applies move via chess.js; broadcasts result or rejects. |

### Server → Client events

| Event | Status | Description |
|-------|--------|-------------|
| `room:state` | Done | Sent to the joining client: `{ id, code, status, fen, turn, whiteId, blackId }`. |
| `room:player-joined` | Done | Broadcast to others in the room when a player connects. |
| `room:player-left` | Done | Broadcast when a player leaves or disconnects. |
| `room:move-made` | Done | Broadcast to opponent(s): `{ from, to, promotion? }` after a valid move. |
| `room:move-rejected` | Done | Sent to the mover only: `{ fen, error }` — reverts client to authoritative position. |
| `room:game-over` | Done | Broadcast to entire room: `{ winner: "white" \| "black" \| null, reason: "checkmate" \| "draw" }`. |
| `room:error` | Defined only | Typed in `socket.types.ts`; no handler emits it yet. |

### Socket session data

| Feature | Status | Notes |
|---------|--------|-------|
| `socket.data.playerId` | Done | Set on join |
| `socket.data.roomId` | Done | Set on join; cleared on leave |
| `socket.data.playerColor` | Done | `"w"` or `"b"` derived from `whiteId` on join; cleared on leave |
| Auto-leave previous room on re-join | Done | Leaves old channel if joining a different room |
| Disconnect cleanup | Done | `disconnect` triggers `leaveRoom` |

### Move handling (`room:move`)

| Step | Status | Description |
|------|--------|-------------|
| Payload validation | Done | Requires `move`, active session `roomId`, `playerId`, `playerColor` |
| Room mismatch guard | Done | Rejects if payload `roomId` does not match session |
| Game initialized check | Done | Rejects if no in-memory `Chess` instance exists |
| Turn validation | Done | Rejects if `chess.turn()` !== `playerColor` ("Not your turn") |
| Move application | Done | `chess.move(move)` via chess.js |
| Opponent broadcast | Done | Emits `room:move-made` to others in the room (sender applies move optimistically) |
| Invalid move | Done | Emits `room:move-rejected` with current FEN and error message |
| Game-over detection | Done | On `chess.isGameOver()`: emits `room:game-over` to all sockets in the room |
| Checkmate winner | Done | Winner is the side that did **not** just move (`chess.turn()` after mate) |
| Draw / other endings | Partial | Non-checkmate game-over sets `winner: null`, `reason: "draw"` (covers stalemate, etc.) |

---

## Server — In-Memory Game State

`server/src/models/game.model.ts` uses **chess.js** to hold active game instances in a `Map<roomId, Chess>`.

| Function | Status | Description |
|----------|--------|-------------|
| `getOrCreateGame(roomId, fen)` | Done | Used on `room:join` to load or create a `Chess` instance from DB FEN |
| `getGame(roomId)` | Done | Used by `room:move` for validation and move application |
| `removeGame(roomId)` | Done | Map cleanup (not yet called from handlers) |

The RAM map is the fast path for game logic during an active session. The database `fen` field is loaded on join but not written back after moves.

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
| `roomApi.getRoom` | Done | Implemented but not used on the play page |
| Navigation after create/join | Done | `router.push(/play/{code})` |

---

## Client — Play Page & Gameplay

| Feature | Status | Description |
|---------|--------|-------------|
| `PlayPage` component | Done | Thin view component for `/play/[roomCode]`; delegates online game orchestration to `useOnlineGame` |
| `useOnlineGame` hook | Done | Mode-specific hook for online play; owns socket lifecycle, room state, game-over state, disconnect UI state, and board orchestration |
| Socket `room:join` on mount | Done | `useOnlineGame` emits with `roomCode` and local `playerId` |
| Socket `room:leave` on unmount | Done | `useOnlineGame` cleans up when leaving the page |
| Listen `room:state` | Done | `useOnlineGame` sets game state, calls `board.loadFen(data.fen)`, and ends loading |
| Listen `room:player-joined` | Done | `useOnlineGame` updates room status and clears opponent-disconnected state |
| Listen `room:move-made` | Done | `useOnlineGame` applies opponent move via `board.applyMove(move)` |
| Listen `room:move-rejected` | Done | `useOnlineGame` rolls back optimistic local state via `board.loadFen(fen)` |
| Listen `room:game-over` | Done | `useOnlineGame` shows game-over overlay data and sets local status to `COMPLETED` |
| Listen `room:abandoned` | Done | `useOnlineGame` loads abandoned FEN, sets local status to `ABANDONED`, and shows abandoned result |
| Waiting UI | Done | `RoomStatusDisplay` + turn hint while status is not `PLAYING` |
| Interactive board (PLAYING) | Done | `ChessBoard` component shown when `status === "PLAYING"` or after game over |
| Board orientation | Done | Derived in `useOnlineGame` from player color (`whiteId` / `blackId` vs local `userId`) |
| Move intent pipeline | Done | `useChessBoard` emits `onMoveIntent`; `useOnlineGame` applies optimistic move and emits `room:move` |
| `GameOverDisplay` overlay | Done | Win / lose / draw message with "Leave Room" button |
| `handleLeaveRoom` | Done | Implemented in `useOnlineGame`; emits `room:leave` and navigates to home |
| Ack handling for `room:join` | Not done | Join emit does not use the ack callback for error display |

### `useChessBoard` hook (`client/src/hooks/useChessBoard.ts`)

| Feature | Status | Description |
|---------|--------|-------------|
| Local chess.js engine | Done | `chessGameRef` drives move validation, FEN state, check state, and legal-move lookup |
| Click-to-move | Done | Select piece → highlight legal squares → click destination |
| Drag-and-drop | Done | `onPieceDrop` with chess.js validation |
| Legal-move highlights | Done | `optionSquares` with distinct styles for moves vs captures |
| `onMoveIntent` boundary | Done | Hook emits a move intent instead of deciding the mode-specific side effect itself |
| Mode-controlled commits | Done | Exposes `applyMove(move)` for optimistic, AI, puzzle, or analysis callers to commit moves explicitly |
| External FEN sync | Done | Exposes `loadFen(fen)` for server state, rollback, reconnect, puzzle setup, or analysis positions |
| Undo command | Done | Exposes `undo()` for future non-online modes such as analysis |
| Check state | Done | Exposes `isInCheck`; UI side effects are handled outside the hook |
| Auto-promotion policy | Done | `BoardPolicy.autoPromote` defaults online play to queen but can be disabled or changed later |
| Interaction policy | Done | `BoardPolicy.interactive` and `BoardPolicy.controllableColors` gate interaction by mode and player color |

### `ChessBoard` component (`client/src/components/chessgame/chessgame.tsx`)

| Feature | Status | Description |
|---------|--------|-------------|
| `react-chessboard` wrapper | Done | Renders `<Chessboard options={...} />` internally |
| Semantic props | Done | Receives `fen`, `orientation`, `optionSquares`, and interaction handlers instead of exposing `ChessboardOptions` to pages |
| Stable board id | Done | Uses an optional caller-provided `id` or a generated React `useId()` value |

### `useCheckToast` hook (`client/src/hooks/useCheckToast.ts`)

| Feature | Status | Description |
|---------|--------|-------------|
| Check notification | Done | Sonner toast for check is separated from `useChessBoard`, so future modes can opt in or skip it |

### `GameOverDisplay` (`client/src/components/play/game-over-display.tsx`)

| Feature | Status | Description |
|---------|--------|-------------|
| Result detection | Done | Compares `payload.winner` with `whiteId` / `blackId` and `userId` |
| Win / lose / draw UI | Done | Icon, title, description, and reason label (Checkmate / Draw) |
| Leave action | Done | Overlay with backdrop blur; calls `onLeave` callback |

---

## Client — Shared Infrastructure

| Module | Status | Description |
|--------|--------|-------------|
| `useUserStore` (Zustand) | Done | Generates or loads UUID from `localStorage` as `userId` |
| `apiFetch` + `ApiError` | Done | Shared REST client with JSON body and error parsing |
| `getSocket` / `disconnectSocket` | Done | Typed Socket.IO singleton (`socket.io-client`) |
| `SocketProvider` | Done | React context; auto-connects on mount |
| `useListenEvent` | Done | Stable subscription hook for server events |
| `socket.types.ts` | Done | Room, move, and game-over event payloads |
| `chess.types.ts` | Done | Shared `IChessMove`, `ChessColor`, `PromotionPiece`, and `BoardPolicy` types |
| `room.types.ts` | Done | REST response and request types |
| shadcn/ui (`Button`, `Input`, `Sonner`) | Done | Used on home and play pages |
| `react-chessboard` | Done | Interactive board rendering |
| `chess.js` (client) | Done | Local move validation and position sync |

---

## Not Yet Implemented

The following are planned or implied by the project goal but are **not** built yet:

| Area | Notes |
|------|-------|
| FEN persistence on moves | Server does not write updated FEN to PostgreSQL after each move |
| `COMPLETED` status in DB | Only updated in client state on `room:game-over` |
| Abandon on disconnect | `ABANDONED` status exists in schema but is not set when players leave mid-game |
| Random matchmaking | README describes pairing random opponents; current UX is manual create/join by code |
| `room:error` broadcasts | Event type defined, not emitted |
| `removeGame` cleanup | Helper exists, not wired to room lifecycle or game-over |
| Reconnect / resync UX | Socket re-join works; no dedicated offline or reconnect UI |
| Ack handling for `room:join` | Errors from join are not surfaced in the play page UI |
| Promotion picker | Always promotes to queen (`"q"`) |
| Move error toasts | `room:move-rejected` resyncs FEN silently (no user-facing message) |
| Server-side room status guard | `room:move` does not check DB `status === "PLAYING"` before accepting moves |

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
├── types/socket.types.ts        # RoomMovePayload, IGameOverPayload, move events
└── socket/
    ├── index.ts
    ├── types.ts
    └── handlers/room.handler.ts # room:join, room:leave, room:move, game-over
```

### Client

```
client/src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── play/[roomCode]/page.tsx
├── components/
│   ├── chessgame/chessgame.tsx
│   ├── home/home-actions.tsx
│   ├── home/chess-board-decoration.tsx
│   ├── play/play-page.tsx
│   ├── play/room-status-display.tsx
│   └── play/game-over-display.tsx
├── hooks/
│   ├── useCheckToast.ts
│   ├── useChessBoard.ts
│   ├── useListenEvent.ts
│   └── useOnlineGame.ts
├── types/
│   ├── chess.types.ts
│   ├── room.types.ts
│   └── socket.types.ts
├── lib/api/room.api.ts
├── lib/socket/socket.ts
├── providers/SocketProvider.tsx
└── stores/useUserStore.ts
```

---

## Summary

**Done:** End-to-end room creation and joining (REST + redirect), anonymous player identity, Socket.IO room channels, real-time presence, interactive chess board (`ChessBoard` + `useChessBoard`), client-side move-intent boundary (`onMoveIntent`), online play orchestration in `useOnlineGame`, server-authoritative move validation (`room:move` / `room:move-made` / `room:move-rejected`), checkmate and draw game-over broadcast (`room:game-over`), and client game-over overlay with leave action.

**Next logical steps:** Persist FEN and `COMPLETED` status to the database, abandon flow on disconnect, `removeGame` cleanup, promotion UI, user-facing move-error feedback, and polish (ack errors, reconnect, matchmaking if desired).
