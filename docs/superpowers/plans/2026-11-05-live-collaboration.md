# Rollvia Live Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Sender/Receiver real-time collaboration system to Rollvia so 2–5 users on different machines can take attendance together via a 6-character Room Code, with all data saved on the Sender's PC only.

**Architecture:** Firebase Realtime Database acts as a pure relay — the Sender pushes attendance state on every change; Receivers subscribe and mirror that state locally. A Profile icon in AppHeader opens a floating panel where users set their Connection Name and choose Sender or Receiver mode. Presence (who is online + which cell they are looking at) is tracked via Firebase `onDisconnect()` and renders as colored overlays on the attendance grid.

**Tech Stack:** React 19, TypeScript, Electron 32, Firebase JS SDK v10 (npm), Lucide React icons, existing `useFlow` / `FlowContext` pattern.

**Spec:** `C:\Users\hites_ewatwnr\.gemini\antigravity\brain\2c011d20-49b1-4871-8388-77536bdf90b4\rollvia-collab-design.md`

## Global Constraints

- Firebase project: `rollvia-collab`, Asia Southeast region
- `databaseURL`: `https://rollvia-collab-default-rtdb.asia-southeast1.firebasedatabase.app`
- `apiKey`: `[REDACTED_CLIENT_KEY]`
- `projectId`: `rollvia-collab`
- `appId`: `1:1063653835208:web:6c6b7355e3a64d6cd180fd`
- Do NOT use Firebase Analytics (`getAnalytics`) — it requires a browser environment Electron doesn't fully support
- Firebase SDK must be npm-installed (`firebase@^10`), not CDN-imported
- Connection Name stored in `localStorage` under key `rollvia_connection_name`
- Room Codes: exactly 6 uppercase alphanumeric characters (no dashes in the code itself — display only adds a dash)
- Collaborator colors palette (index 0–4): `['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']`; Sender always gets index 0
- Do not break the existing offline solo workflow — Firebase imports are deferred behind the collaboration panel
- All new files in TypeScript; follow existing project code style (named exports, React.FC, inline styles using CSS vars)
- No new test framework needed; verification is manual two-window testing

## Review Focus

- **Firebase offline / no internet**: Opening the Collaborate panel while offline must show a clear error, not hang or crash.
- **Invalid Room Code on join**: Entering a code that does not exist in Firebase must show "Room not found" within 3 seconds.
- **Sender closes app with Receivers connected**: Electron must intercept the close event and show a confirmation dialog before quitting.
- **Receiver rejoins same code**: If a Receiver leaves and re-enters the same active code, they must re-sync to Sender's latest state correctly.
- **Solo mode untouched**: A user who never opens the Profile panel must experience zero change in behavior — no Firebase imports, no extra renders.

---

## Task 1: Install Firebase and write config

**Files:**
- Modify: `d:\Projects\projects\Project 2_Attendance App\package.json`
- Create: `d:\Projects\projects\Project 2_Attendance App\src\collaboration\firebaseConfig.ts`

**Interfaces:**
- Produces: `firebaseConfig` object (typed as `FirebaseOptions`) exported as default

- [ ] **Step 1: Install firebase npm package**

  Run from `d:\Projects\projects\Project 2_Attendance App`:
  ```
  npm install firebase@^10
  ```
  Expected: `firebase` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Create `src/collaboration/firebaseConfig.ts`**

  ```ts
  import type { FirebaseOptions } from 'firebase/app';

  const firebaseConfig: FirebaseOptions = {
    apiKey: '[REDACTED_CLIENT_KEY]',
    authDomain: 'rollvia-collab.firebaseapp.com',
    databaseURL: 'https://rollvia-collab-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'rollvia-collab',
    storageBucket: 'rollvia-collab.firebasestorage.app',
    messagingSenderId: '1063653835208',
    appId: '1:1063653835208:web:6c6b7355e3a64d6cd180fd',
  };

  export default firebaseConfig;
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors related to `firebaseConfig.ts`.

- [ ] **Step 4: Commit**

  ```bash
  git add package.json package-lock.json src/collaboration/firebaseConfig.ts
  git commit -m "feat(collab): install firebase sdk and add config"
  ```

---

## Task 2: Collaboration types

**Files:**
- Create: `d:\Projects\projects\Project 2_Attendance App\src\collaboration\types.ts`

**Interfaces:**
- Produces:
  - `type UserRole = 'sender' | 'receiver' | null`
  - `interface CollaboratorPresence { displayName: string; color: string; cursor: { date: string; personId: string } | null; joinedAt: number; }`
  - `interface CollaborationSession { roomCode: string; role: UserRole; myUid: string; myColor: string; myDisplayName: string; }`
  - `interface RoomAttendanceUpdate { date: string; personId: string; classId: string; value: boolean; }`

- [ ] **Step 1: Create `src/collaboration/types.ts`** with the four types above.

- [ ] **Step 2: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/collaboration/types.ts
  git commit -m "feat(collab): add collaboration TypeScript types"
  ```

---

## Task 3: CollaborationService — room lifecycle + state sync

**Files:**
- Create: `d:\Projects\projects\Project 2_Attendance App\src\collaboration\CollaborationService.ts`

**Interfaces:**
- Consumes: `firebaseConfig` from Task 1; types from Task 2
- Produces: `CollaborationService` class with:
  - `createRoom(displayName: string, initialState: RoomFirebaseState): Promise<string>` — returns Room Code
  - `joinRoom(roomCode: string, displayName: string, onStateSnapshot: (state: RoomFirebaseState) => void, onPresenceUpdate: (presence: Record<string, CollaboratorPresence>) => void): Promise<void>`
  - `pushAttendanceChange(update: RoomAttendanceUpdate): Promise<void>` — Sender uses to relay a cell change
  - `updateCursor(date: string, personId: string): Promise<void>` — broadcast where I am looking
  - `leaveRoom(): Promise<void>` — cleans up listeners, removes presence
  - `type RoomFirebaseState = { roster: Person[]; classes: ClassSession[]; attendance: Record<string, Record<string, Record<string, boolean>>>; noClassDates: string[]; holidayReasons: Record<string, string>; academicYear: string; departmentName: string; }`

- [ ] **Step 1: Scaffold `CollaborationService.ts`**

  Import `initializeApp`, `getApps` from `firebase/app` and `getDatabase`, `ref`, `set`, `update`, `onValue`, `off`, `onDisconnect`, `serverTimestamp` from `firebase/database`.

  Initialize Firebase lazily (check `getApps().length` before calling `initializeApp`) so it only runs when the class is first instantiated.

- [ ] **Step 2: Implement `generateRoomCode(): string`** (private method)

  Returns 6 random uppercase alphanumeric chars using `Math.random()` and `'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'`.

- [ ] **Step 3: Implement `createRoom(displayName, initialState)`**

  - Call `generateRoomCode()`
  - Write to `/rooms/{code}/state` = `initialState`
  - Write to `/rooms/{code}/createdAt` = `Date.now()`
  - Write to `/rooms/{code}/presence/{this.myUid}` = `{ displayName, color: COLOR_PALETTE[0], cursor: null, joinedAt: Date.now() }`
  - Register `onDisconnect(presenceRef).remove()` so Firebase auto-removes presence when app closes
  - Store `roomCode`, `myUid`, role = `'sender'` on the instance
  - Return the room code string

- [ ] **Step 4: Implement `joinRoom(roomCode, displayName, onStateSnapshot, onPresenceUpdate)`**

  - Check `/rooms/{roomCode}/state` exists; if null throw `Error('Room not found')`
  - Assign a color from `COLOR_PALETTE` index = number of existing presence entries (capped at 4)
  - Write own presence to `/rooms/{roomCode}/presence/{myUid}`
  - Register `onDisconnect(presenceRef).remove()`
  - Subscribe `onValue` to `/rooms/{roomCode}/state` → call `onStateSnapshot` on each update
  - Subscribe `onValue` to `/rooms/{roomCode}/presence` → call `onPresenceUpdate` on each update
  - Store role = `'receiver'`, roomCode, myUid on the instance

- [ ] **Step 5: Implement `pushAttendanceChange(update)`**

  Write to `/rooms/{this.roomCode}/state/attendance/{update.date}/{update.personId}/{update.classId}` = `update.value`.

- [ ] **Step 6: Implement `updateCursor(date, personId)`**

  Write to `/rooms/{this.roomCode}/presence/{this.myUid}/cursor` = `{ date, personId }`.

- [ ] **Step 7: Implement `leaveRoom()`**

  - `off()` all active listeners
  - Remove own presence ref from Firebase
  - Reset instance state (roomCode, role, myUid to null)

- [ ] **Step 8: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no type errors.

- [ ] **Step 9: Commit**

  ```bash
  git add src/collaboration/CollaborationService.ts
  git commit -m "feat(collab): CollaborationService - room create/join/leave and state sync"
  ```

---

## Task 4: `useCollaboration` React hook

**Files:**
- Create: `d:\Projects\projects\Project 2_Attendance App\src\collaboration\useCollaboration.ts`

**Interfaces:**
- Consumes: `CollaborationService`, types from Task 2; `useFlow` from existing context
- Produces: `useCollaboration()` hook returning:
  ```ts
  {
    session: CollaborationSession | null;
    collaborators: Record<string, CollaboratorPresence>;
    connectionName: string;
    setConnectionName: (name: string) => void;
    createRoom: () => Promise<string>;
    joinRoom: (code: string) => Promise<void>;
    leaveRoom: () => Promise<void>;
    updateMyCursor: (date: string, personId: string) => void;
    isConnected: boolean;
    error: string | null;
  }
  ```

- [ ] **Step 1: Scaffold hook with state**

  State: `session`, `collaborators`, `connectionName` (init from `localStorage.getItem('rollvia_connection_name') ?? ''`), `error`, `isConnected`. Hold a `serviceRef = useRef<CollaborationService | null>(null)`.

- [ ] **Step 2: Implement `setConnectionName`**

  Set state + `localStorage.setItem('rollvia_connection_name', name)`.

- [ ] **Step 3: Implement `createRoom`**

  - Instantiate `CollaborationService` into `serviceRef.current` if null
  - Call `useFlow`'s `sessionState` to build `RoomFirebaseState` snapshot (roster = `sessionState.people`, classes = `sessionState.classes`, attendance = `sessionState.savedDailyAttendance`, noClassDates, holidayReasons, academicYear, departmentName)
  - Await `service.createRoom(connectionName, snapshot)`
  - Set `session` state
  - Subscribe `onValue` on `/rooms/{code}/presence` to update `collaborators` state
  - Also subscribe Sender to `/rooms/{code}/state/attendance` changes so incoming Receiver edits update local FlowContext via `saveDailyAttendance`
  - Return room code

- [ ] **Step 4: Implement `joinRoom(code)`**

  - Instantiate service
  - Await `service.joinRoom(code, connectionName, onStateSnapshot, onPresenceUpdate)`
  - In `onStateSnapshot`: call `updateSessionState` + `setPeople` + `setClasses` etc. from `useFlow` to hydrate local state from Sender's snapshot
  - In `onPresenceUpdate`: set `collaborators` state
  - Set `session` and `isConnected = true`

- [ ] **Step 5: Implement `leaveRoom`**

  - Await `service.leaveRoom()`
  - Reset `session`, `collaborators`, `isConnected` to defaults

- [ ] **Step 6: Implement `updateMyCursor(date, personId)`**

  Call `serviceRef.current?.updateCursor(date, personId)` (no-op if not in a session).

- [ ] **Step 7: Wire Sender's `saveDailyAttendance` to push changes**

  This wiring happens in FlowContext (Task 5); the hook exposes `serviceRef` via a getter `getService(): CollaborationService | null` so FlowContext can call `pushAttendanceChange`.

- [ ] **Step 8: Commit**

  ```bash
  git add src/collaboration/useCollaboration.ts
  git commit -m "feat(collab): useCollaboration hook with create/join/leave and cursor"
  ```

---

## Task 5: Wire collaboration into FlowContext

**Files:**
- Modify: `d:\Projects\projects\Project 2_Attendance App\src\context\FlowContextDefinition.ts`
- Modify: `d:\Projects\projects\Project 2_Attendance App\src\context\FlowContext.tsx`

**Interfaces:**
- Consumes: `useCollaboration` from Task 4
- Produces: FlowContext now exposes `collaboration: ReturnType<typeof useCollaboration>` so any component can reach it

- [ ] **Step 1: Add `collaboration` to `FlowContextType` in `FlowContextDefinition.ts`**

  ```ts
  import type { useCollaboration } from '../collaboration/useCollaboration';
  collaboration: ReturnType<typeof useCollaboration>;
  ```

- [ ] **Step 2: Call `useCollaboration()` inside `FlowProvider`**

  At the top of `FlowProvider`, call `const collaboration = useCollaboration();`

- [ ] **Step 3: Expose `collaboration` in the context value object**

  Add `collaboration` to the giant object passed to `FlowContext.Provider`.

- [ ] **Step 4: Patch `saveDailyAttendance` to relay changes when Sender**

  Inside the existing `saveDailyAttendance` implementation in `FlowContext.tsx`, after updating local state, add:
  ```ts
  if (collaboration.session?.role === 'sender') {
    // push each changed cell
    Object.entries(personAttendanceMap).forEach(([personId, classMap]) => {
      Object.entries(classMap).forEach(([classId, value]) => {
        collaboration.getService()?.pushAttendanceChange({ date: dateStr, personId, classId, value });
      });
    });
  }
  ```

- [ ] **Step 5: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/context/FlowContextDefinition.ts src/context/FlowContext.tsx
  git commit -m "feat(collab): expose useCollaboration in FlowContext and wire saveDailyAttendance relay"
  ```

---

## Task 6: Barrel export for collaboration module

**Files:**
- Create: `d:\Projects\projects\Project 2_Attendance App\src\collaboration\index.ts`

- [ ] **Step 1: Create barrel**

  ```ts
  export { CollaborationService } from './CollaborationService';
  export { useCollaboration } from './useCollaboration';
  export type { CollaborationSession, CollaboratorPresence, UserRole, RoomAttendanceUpdate } from './types';
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/collaboration/index.ts
  git commit -m "feat(collab): barrel export for collaboration module"
  ```

---

## Task 7: ProfilePanel UI (Profile icon + floating panel)

**Files:**
- Create: `d:\Projects\projects\Project 2_Attendance App\src\components\collaboration\ProfilePanel.tsx`

**Interfaces:**
- Consumes: `useFlow` (for `collaboration` from context)
- Produces: `<ProfilePanel />` self-contained component (no props)

- [ ] **Step 1: Profile icon button**

  Renders a small circle button (32×32px) with the user's initials (first char of `connectionName` or `?`). Uses `position: relative` as anchor for the panel.

  When `session` is active, the circle has a 2px green ring (`var(--success-500)`) and a small green dot labeled "LIVE" beside it.

- [ ] **Step 2: Floating panel**

  A `position: absolute; top: calc(100% + 8px); right: 0` card (`var(--bg-elevated)`, `var(--shadow-lg)`, `border-radius: var(--radius-md)`, width 320px) shown via `useState<boolean>(showPanel)`.

  Close panel on outside click via `useEffect` + `document.addEventListener('mousedown', handler)`.

- [ ] **Step 3: Connection Name field**

  `<Input>` (from existing `src/components/ui/Input.tsx`) labeled "Connection Name". On change: `collaboration.setConnectionName(val)`. Pre-filled from `collaboration.connectionName`.

- [ ] **Step 4: Sender tab content**

  When `session?.role === 'sender'` or no session:
  - Button "Start as Sender" (disabled while `session` exists) → calls `collaboration.createRoom()` → shows Room Code in a large monospace display with Copy button (`navigator.clipboard.writeText`)
  - When session active: list of `collaboration.collaborators` names with colored dots
  - "End Session" button → `collaboration.leaveRoom()`

- [ ] **Step 5: Receiver tab content**

  - `<Input>` for Room Code (uppercase, max 6 chars, auto-uppercase on change)
  - "Join" button → calls `collaboration.joinRoom(code)` → shows loading spinner during join → shows error from `collaboration.error` if thrown
  - When joined: "Connected to [code]" status + "Leave" button → `collaboration.leaveRoom()`

- [ ] **Step 6: Error display**

  If `collaboration.error` is non-null, show a red small text block below the active section.

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/collaboration/ProfilePanel.tsx
  git commit -m "feat(collab): ProfilePanel UI - profile icon, sender/receiver tabs, room code display"
  ```

---

## Task 8: Presence badges in AppHeader

**Files:**
- Create: `d:\Projects\projects\Project 2_Attendance App\src\components\collaboration\PresenceBadges.tsx`
- Modify: `d:\Projects\projects\Project 2_Attendance App\src\components\layout\AppHeader.tsx`

**Interfaces:**
- Consumes: `useFlow().collaboration.collaborators`, `useFlow().collaboration.session`
- Produces: `<PresenceBadges />` renders up to 4 colored initials circles

- [ ] **Step 1: Create `PresenceBadges.tsx`**

  Map over `Object.values(collaborators)` where `uid !== session.myUid`. Render a 24×24 circle per collaborator with their `color` as background and first initial as white text. Max 4 shown. Tooltip on hover shows full `displayName`. Use `title` attribute for tooltip.

- [ ] **Step 2: Import and add to `AppHeader.tsx`**

  In `header-right` div, before `<ThemeToggle />`, add:
  ```tsx
  <PresenceBadges />
  <ProfilePanel />
  ```
  Remove the old `<Button>` for Help or place ProfilePanel after Help button — per design, Profile goes at the far right.

- [ ] **Step 3: Verify renders without session**

  Manually run `npm run dev:electron`, open app — header should look identical to before (no visible change when not in a session).

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/collaboration/PresenceBadges.tsx src/components/layout/AppHeader.tsx
  git commit -m "feat(collab): add PresenceBadges and ProfilePanel to AppHeader"
  ```

---

## Task 9: CellCursor — collaborator cursor overlays on the attendance grid

**Files:**
- Create: `d:\Projects\projects\Project 2_Attendance App\src\components\collaboration\CellCursor.tsx`
- Modify: `d:\Projects\projects\Project 2_Attendance App\src\components\workspace\AttendanceGrid.tsx`

**Interfaces:**
- Consumes: `useFlow().collaboration.collaborators`; props `date: string`, `personId: string`
- Produces: `<CellCursor date={date} personId={personId} />` — renders a colored border overlay if any collaborator's cursor matches

- [ ] **Step 1: Create `CellCursor.tsx`**

  ```tsx
  // Props: date, personId
  // Reads collaboration.collaborators
  // Finds any collaborator where cursor.date === date && cursor.personId === personId
  // If found: renders a 2px inset box-shadow in that collaborator's color + a tiny initials label (top-right corner, 12px)
  // If not found: renders null
  ```

  Use `position: absolute; inset: 0; pointer-events: none` so it overlays without blocking clicks.

- [ ] **Step 2: Also broadcast my own cursor in AttendanceGrid**

  In `AttendanceGrid.tsx`, when a date row or person cell gains focus (`onMouseEnter` on the person row), call `useFlow().collaboration.updateMyCursor(dateStr, personId)`.

- [ ] **Step 3: Render `<CellCursor>` inside each attendance cell**

  Find the JSX element that renders an individual attendance cell (the checkbox/button per person per date). Wrap it in `position: relative` and add `<CellCursor date={dateStr} personId={person.id} />` as a sibling inside that wrapper.

- [ ] **Step 4: Verify no visual regression in solo mode**

  Open `npm run dev:electron` without joining a room — grid should look identical, `CellCursor` renders nothing.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/collaboration/CellCursor.tsx src/components/workspace/AttendanceGrid.tsx
  git commit -m "feat(collab): CellCursor overlay and cursor broadcast in AttendanceGrid"
  ```

---

## Task 10: Sender close-app guard (Electron IPC)

**Files:**
- Modify: `d:\Projects\projects\Project 2_Attendance App\electron\main.cjs`

**Interfaces:**
- Consumes: Electron `ipcMain`; renderer sends `'collab-active'` / `'collab-inactive'` IPC messages when session starts/ends

- [ ] **Step 1: Add IPC listener in renderer (FlowContext or useCollaboration)**

  In `useCollaboration.ts`, when `session` becomes non-null (useEffect on `session`):
  ```ts
  window.electronAPI?.send('collab-active');
  // on cleanup / leaveRoom:
  window.electronAPI?.send('collab-inactive');
  ```

- [ ] **Step 2: Expose `send` on `window.electronAPI` in Electron preload**

  Check `electron/main.cjs` or a separate `preload.cjs`. In the `contextBridge.exposeInMainWorld` call, add:
  ```js
  send: (channel, data) => ipcRenderer.send(channel, data)
  ```
  (Only if not already present.)

- [ ] **Step 3: Add close guard in `electron/main.cjs`**

  ```js
  let collabActive = false;
  ipcMain.on('collab-active', () => { collabActive = true; });
  ipcMain.on('collab-inactive', () => { collabActive = false; });

  mainWindow.on('close', (e) => {
    if (collabActive) {
      e.preventDefault();
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        buttons: ['End Session & Close', 'Cancel'],
        defaultId: 1,
        title: 'Collaborators Connected',
        message: 'Collaborators are still connected. Closing will end their session.',
      });
      if (choice === 0) {
        collabActive = false;
        mainWindow.close();
      }
    }
  });
  ```

- [ ] **Step 4: Verify**

  Manually test: start a sender session, attempt to close the window — dialog should appear.

- [ ] **Step 5: Commit**

  ```bash
  git add electron/main.cjs
  git commit -m "feat(collab): Electron close guard when collaborators are connected"
  ```

---

## Task 11: Firebase Security Rules

**Files:**
- Create: `d:\Projects\projects\Project 2_Attendance App\firebase\database.rules.json`

**Interfaces:**
- Produces: rules deployed to Firebase via Firebase CLI or pasted into Firebase Console

- [ ] **Step 1: Create `firebase/database.rules.json`**

  ```json
  {
    "rules": {
      "rooms": {
        "$roomCode": {
          ".read": "data.child('presence').exists()",
          ".write": "data.child('presence').exists() || !data.exists()",
          "state": {
            ".read": true,
            ".write": "data.parent().child('presence').exists() || !data.parent().exists()"
          },
          "presence": {
            "$uid": {
              ".read": true,
              ".write": "auth == null || $uid == auth.uid || !data.parent().parent().child('presence').exists()"
            }
          }
        }
      }
    }
  }
  ```

  > Note: Because Firebase Auth is not used (anonymous), rules allow write to any room. The practical protection is the 6-char code obscurity. Update to full auth rules if security becomes critical later.

  Simplified practical rules (no auth required, write-open with room-code obscurity):
  ```json
  {
    "rules": {
      ".read": false,
      ".write": false,
      "rooms": {
        "$roomCode": {
          ".read": true,
          ".write": true
        }
      }
    }
  }
  ```

- [ ] **Step 2: Paste rules into Firebase Console**

  Go to [console.firebase.google.com](https://console.firebase.google.com) → Realtime Database → Rules tab → paste the simplified rules above → Publish.

- [ ] **Step 3: Commit**

  ```bash
  git add firebase/database.rules.json
  git commit -m "feat(collab): Firebase Realtime Database security rules"
  ```

---

## Task 12: End-to-end verification

- [ ] **Step 1: Build the app**

  Run: `npm run build`
  Expected: no TypeScript or build errors.

- [ ] **Step 2: Open two Electron windows**

  Run `npm run dev:electron` twice (two terminal windows or use two separate `npm run electron:start` processes pointing at the same `dist`).

- [ ] **Step 3: Sender flow**

  Window 1 → Profile icon → set name "Hitesh" → "Start as Sender" → note the Room Code.

- [ ] **Step 4: Receiver flow**

  Window 2 → Profile icon → set name "Friend" → Receiver tab → enter code from Step 3 → Join.
  Expected: Window 2 loads Sender's attendance data.

- [ ] **Step 5: Real-time sync**

  Window 1 (Sender): toggle an attendance cell.
  Expected: Window 2 (Receiver) shows the same change within ~500ms.

  Window 2 (Receiver): toggle a different cell.
  Expected: Window 1 shows the change within ~500ms and local state is updated.

- [ ] **Step 6: Cursor presence**

  Hover over a row in Window 2.
  Expected: Window 1 shows a colored overlay on that row's cell.

- [ ] **Step 7: Leave**

  Window 2: click Leave. Expected: Window 2's presence badge disappears from Window 1 header.

- [ ] **Step 8: Close guard**

  With Receiver connected, attempt to close Window 1.
  Expected: Confirmation dialog appears.

- [ ] **Step 9: Final commit**

  ```bash
  git add -A
  git commit -m "feat(collab): Rollvia Live Collaboration v1.0 complete"
  git push
  ```

