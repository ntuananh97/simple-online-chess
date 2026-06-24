# Play Feature — Implementation Progress

This document summarizes what has been built so far for the online chess play feature in **Simple Online Chess**. It covers the room lifecycle (create, join, real-time sync), interactive gameplay, game-over handling, and supporting infrastructure on both client and server.

---

## Overview

The play flow is split across **REST** (persist room data in PostgreSQL) and **WebSocket** (real-time room presence, moves, and game state). Players are identified by a browser-local UUID stored in `localStorage` — no accounts or authentication.

**Typical flow today:**

1. Player A creates a room via `POST /rooms` and is redirected to `/play/{code}`.
2. Player B enters the room code on the home page, joins via `POST /rooms/join`, and is redirected to the same play URL.
3. Both clients emit `room:join` over Socket.IO to subscribe to the room channel and receive live updates.
4. Once status is `PLAYING`, the interactive chess board and player clocks are shown. Moves are sent via `room:move`, validated server-side, timed server-side, and broadcast to the opponent. When the game ends, all clients receive `room:game-over`.

---

## Database Layer

| Item | Status | Notes |
|------|--------|-------|
| `Room` model (Prisma) | Done | Single model with `roomCode`, `status`, `fen`, `whiteId`, `blackId`, `whiteTime`, `blackTime`, timestamps |
| `RoomStatus` enum | Done | `WAITING`, `PLAYING`, `COMPLETED`, `ABANDONED` |
| Initial migration | Done | `prisma/migrations/20260611093126_init_db/` |
| Default FEN | Done | Standard starting position stored on room creation |
| Neon + Prisma 7 setup | Done | Pooled `DATABASE_URL` for runtime, `DIRECT_URL` for CLI |
| Time control columns | Done | `whiteTime` and `blackTime` store remaining milliseconds; defaults are 10 minutes per side |
| FEN updated after moves | Partial | DB `fen` is read on join and persisted only when a game completes or is abandoned; in-memory state is authoritative during play |
| `COMPLETED` status in DB | Done | Server persists `COMPLETED`, final FEN, and final remaining time when checkmate, draw, or timeout ends a game |

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
| `room:move` | Done | Payload `{ move: { from, to, promotion? }, roomId }`. Validates turn, applies move via chess.js, updates server-side clock, and optionally acks `{ whiteTimeLeft, blackTimeLeft }`. |

### Server → Client events

| Event | Status | Description |
|-------|--------|-------------|
| `room:state` | Done | Sent to the joining client: `{ id, code, status, fen, turn, whiteId, blackId, whiteTimeLeft, blackTimeLeft }`. |
| `room:player-joined` | Done | Broadcast to others in the room when a player connects; includes current time snapshot `{ whiteTimeLeft, blackTimeLeft }`. |
| `room:player-left` | Done | Broadcast when a player leaves or disconnects. |
| `room:move-made` | Done | Broadcast to opponent(s): `{ from, to, promotion?, whiteTimeLeft, blackTimeLeft }` after a valid move. |
| `room:move-rejected` | Done | Sent to the mover only: `{ fen, error }` — reverts client to authoritative position. |
| `room:game-over` | Done | Broadcast to entire room: `{ winner: "white" \| "black" \| null, reason: "checkmate" \| "draw" \| "timeout" }`. |
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
| Time accounting | Done | Server subtracts elapsed time from the player who moved, sends remaining time in the move ack, and includes remaining time in `room:move-made` for the opponent |
| Opponent broadcast | Done | Emits `room:move-made` with move and time data to others in the room (sender applies move optimistically) |
| Invalid move | Done | Emits `room:move-rejected` with current FEN and error message |
| Game-over detection | Done | On `chess.isGameOver()`: emits `room:game-over` to all sockets in the room and persists final FEN/time/status |
| Checkmate winner | Done | Winner is the side that did **not** just move (`chess.turn()` after mate) |
| Draw / other endings | Partial | Non-checkmate game-over sets `winner: null`, `reason: "draw"` (covers stalemate, etc.) |
| Timeout game-over | Done | Server starts an in-memory timer for the side to move; when it expires, that side loses and final time is persisted |

---

## Server — In-Memory Game State

`server/src/models/game.model.ts` uses **chess.js** and in-memory timers to hold active game sessions in a `Map<roomId, GameSession>`.

| Function | Status | Description |
|----------|--------|-------------|
| `getOrCreateGame(roomId, gameSession)` | Done | Used on `room:join` to load or create a `GameSession` from DB FEN/time |
| `getGame(roomId)` | Done | Used by `room:move` for validation, move application, and access to time control state |
| `startClock(roomId)` | Done | Starts the game clock once the room is `PLAYING`; white is timed first because white moves first |
| `applyMoveTime(roomId, playerColor)` | Done | Deducts elapsed time from the player who just moved and returns `{ whiteTimeLeft, blackTimeLeft }` |
| `startGameTimer(roomId)` | Done | Clears the previous timer and schedules timeout for the current side to move |
| `getTimeSnapshot(roomId)` | Done | Returns current remaining time, including live elapsed time for the side currently on clock |
| `removeGame(roomId)` | Done | Clears game timer, clears grace timer, and removes the session from memory on game completion or abandonment |

The RAM map is the fast path for game logic and clock state during an active session. The database `fen`, `whiteTime`, and `blackTime` fields are loaded on join but only written back when the game completes or is abandoned.

### Server-side time control

| Feature | Status | Notes |
|---------|--------|-------|
| Initial clock start | Done | When a room becomes `PLAYING` and a socket joins, `lastMoveTime` is set to now and the first timer is scheduled for white |
| Per-move time deduction | Done | After a valid move, server deducts elapsed time from the mover and schedules the next timer for the side to move |
| Time sync payloads | Done | Mover receives remaining time via `room:move` ack; opponent receives it in `room:move-made` |
| Timeout result | Done | If the current side's timer expires, the opponent wins with `reason: "timeout"` |
| DB persistence policy | Done | Remaining time is kept in memory during play and persisted only on `COMPLETED` or `ABANDONED` |
| GracePeriod interaction | Done | Clock continues during GracePeriod; timeout can end the game before the GracePeriod abandonment fires |

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
| `PlayPage` component | Done | Thin view component for `/play/[roomCode]`; delegates online game orchestration to `useOnlineGame` and renders the board clock UI |
| `useOnlineGame` hook | Done | Mode-specific hook for online play; owns socket lifecycle, room state, game-over state, disconnect UI state, board orchestration, and client clock synchronization |
| Socket `room:join` on mount | Done | `useOnlineGame` emits with `roomCode` and local `playerId` |
| Socket `room:leave` on unmount | Done | `useOnlineGame` cleans up when leaving the page |
| Listen `room:state` | Done | `useOnlineGame` sets game state, syncs clock from `whiteTimeLeft` / `blackTimeLeft`, calls `board.loadFen(data.fen)`, and ends loading |
| Listen `room:player-joined` | Done | `useOnlineGame` updates room status, syncs clock from the server snapshot, and clears opponent-disconnected state |
| Listen `room:move-made` | Done | `useOnlineGame` applies opponent move via `board.applyMove(move)` and syncs clock from the move payload |
| Listen `room:move-rejected` | Done | `useOnlineGame` rolls back optimistic local state via `board.loadFen(fen)` |
| Listen `room:game-over` | Done | `useOnlineGame` shows game-over overlay data and sets local status to `COMPLETED` |
| Listen `room:abandoned` | Done | `useOnlineGame` loads abandoned FEN, sets local status to `ABANDONED`, and shows abandoned result |
| Waiting UI | Done | `RoomStatusDisplay` + turn hint while status is not `PLAYING` |
| Interactive board (PLAYING) | Done | `ChessBoard` component shown when `status === "PLAYING"` or after game over |
| Client clock UI | Done | `GameClock` renders both player clocks above the board, ordered by board orientation, with active-player highlighting and low-time styling |
| Board orientation | Done | Derived in `useOnlineGame` from player color (`whiteId` / `blackId` vs local `userId`) |
| Move intent pipeline | Done | `useChessBoard` emits `onMoveIntent`; `useOnlineGame` applies optimistic move, emits `room:move`, and syncs clock from the ack |
| `GameOverDisplay` overlay | Done | Win / lose / draw message with "Leave Room" button |
| `handleLeaveRoom` | Done | Implemented in `useOnlineGame`; emits `room:leave` and navigates to home |
| Ack handling for `room:join` | Not done | Join emit does not use the ack callback for error display |

### `useGameClock` hook (`client/src/hooks/useGameClock.ts`)

| Feature | Status | Description |
|---------|--------|-------------|
| Client clock baseline | Done | Stores the latest server `TimeSnapshot` plus local sync timestamp |
| Active side detection | Done | `getTurnFromFen(fen)` derives whose clock is running from the current board FEN |
| Local ticking | Done | Updates display every 100ms while the game is running, decrementing only the active side |
| Server sync boundary | Done | Exposes `syncTime(snapshot)` so `useOnlineGame` can resync on `room:state`, `room:player-joined`, move ack, and `room:move-made` |
| Non-running state | Done | Stops ticking when the game is not `PLAYING` or after `gameOver` |

### `GameClock` component (`client/src/components/chessgame/game-clock.tsx`)

| Feature | Status | Description |
|---------|--------|-------------|
| Clock formatting | Done | Formats milliseconds as `m:ss` with ceiling seconds and clamps negative values to zero |
| Orientation-aware order | Done | Shows the opponent clock above and the local-side clock below based on board orientation |
| Active clock styling | Done | Highlights the side whose turn is active |
| Low-time styling | Done | Applies red time text below 60 seconds |

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
| Promotion trigger | Done | Detects pawn promotion moves, stores `pendingPromotion`, and exposes `confirmPromotion(piece)` / `cancelPromotion()` for mode-specific UI |
| Auto-promotion policy | Done | `BoardPolicy.autoPromote` supports automatic promotion for modes that want it; online play disables auto-promotion and uses the picker |
| Interaction policy | Done | `BoardPolicy.interactive` and `BoardPolicy.controllableColors` gate interaction by mode and player color |

### `ChessBoard` component (`client/src/components/chessgame/chessgame.tsx`)

| Feature | Status | Description |
|---------|--------|-------------|
| `react-chessboard` wrapper | Done | Renders `<Chessboard options={...} />` internally |
| Semantic props | Done | Receives `fen`, `orientation`, `optionSquares`, and interaction handlers instead of exposing `ChessboardOptions` to pages |
| Stable board id | Done | Uses an optional caller-provided `id` or a generated React `useId()` value |
| Promotion picker integration | Done | Renders `PromotionPicker` as an overlay when `pendingPromotion` is provided |

### `PromotionPicker` component (`client/src/components/chessgame/promotion-picker.tsx`)

| Feature | Status | Description |
|---------|--------|-------------|
| Promotion choices | Done | Lets the player choose queen, rook, bishop, or knight for pawn promotion |
| Color-aware symbols | Done | Shows white or black piece symbols based on the promoting pawn color |
| Cancel action | Done | Allows the player to close the picker and clear the pending promotion |

### `useCheckToast` hook (`client/src/hooks/useCheckToast.ts`)

| Feature | Status | Description |
|---------|--------|-------------|
| Check notification | Done | Sonner toast for check is separated from `useChessBoard`, so future modes can opt in or skip it |

### `GameOverDisplay` (`client/src/components/play/game-over-display.tsx`)

| Feature | Status | Description |
|---------|--------|-------------|
| Result detection | Done | Compares `payload.winner` with `whiteId` / `blackId` and `userId`; draw and abandoned reasons are handled separately |
| Win / lose / draw / abandoned UI | Done | Icon, title, description, and reason label (Checkmate / Draw / Timeout / Abandoned) |
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
| `socket.types.ts` | Done | Room, move, game-over, abandoned, and time snapshot event payloads |
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
| FEN persistence on each move | Server intentionally does not write updated FEN to PostgreSQL after each move; final FEN is persisted on completion/abandonment |
| Random matchmaking | README describes pairing random opponents; current UX is manual create/join by code |
| `room:error` broadcasts | Event type defined, not emitted |
| Reconnect / resync UX | Socket re-join works; no dedicated offline or reconnect UI |
| Ack handling for `room:join` | Errors from join are not surfaced in the play page UI |
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
├── types/socket.types.ts        # RoomMovePayload, RoomMoveAck, IGameOverPayload, time-aware move events
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
│   ├── chessgame/game-clock.tsx
│   ├── chessgame/promotion-picker.tsx
│   ├── home/home-actions.tsx
│   ├── home/chess-board-decoration.tsx
│   ├── play/play-page.tsx
│   ├── play/room-status-display.tsx
│   └── play/game-over-display.tsx
├── hooks/
│   ├── useCheckToast.ts
│   ├── useChessBoard.ts
│   ├── useGameClock.ts
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

**Done:** End-to-end room creation and joining (REST + redirect), anonymous player identity, Socket.IO room channels, real-time presence, interactive chess board (`ChessBoard` + `useChessBoard`), client-side move-intent boundary (`onMoveIntent`), promotion picker flow for online play, online play orchestration in `useOnlineGame`, client clock rendering and synchronization (`useGameClock` + `GameClock`), server-authoritative move validation (`room:move` / `room:move-made` / `room:move-rejected`), server-side time control with timeout wins, final FEN/status/time persistence on completion or abandonment, checkmate/draw/timeout game-over broadcast (`room:game-over`), and client game-over overlay with leave action.

**Next logical steps:** Add a server-side `PLAYING` status guard for moves, polish reconnect/resync behavior, add user-facing move-error feedback, and matchmaking if desired.
