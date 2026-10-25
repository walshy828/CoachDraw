# CoachDraw

A web app for hockey coaches to design drills and plays on an accurate NHL-size rink, draw player movement, and play the drill back step by step.

## Run with Docker

```sh
cp .env.example .env          # then set SESSION_SECRET (openssl rand -hex 32)
docker compose up --build -d
open http://localhost:8080
```

Accounts and drills are stored in SQLite in the `coachdraw-data` Docker volume (`/data`). Create an account on the sign-in page; new accounts start with seven editable sample drills.
Set `COOKIE_SECURE=true` when serving over HTTPS.

## Using it

- **Layout**: the ice fills the screen. A tool rail (Select, Players, Draw, Erase) sits beside it, with steps and playback along the bottom and undo/redo/menu on top. On a phone held upright, a full-length rink turns 90° so it uses the tall screen (⋯ menu → turn the ice to override). Details, steps, timing and the selected item's options open in a side panel (iPad) or bottom sheet (phone) that the ice makes room for. Everything is sized for fingers; installing to the iPad/iPhone home screen gives a chrome-free full-screen app.
- **Rink**: full ice or half ice (right/left), from the ⋯ menu. Drill data always uses full-ice coordinates, so switching views never loses anything.
- **Players**: tap *Players*, pick a team and a position (or puck/cone), then tap the ice. Offense/Defense team colors are editable (palette or custom color). *Standard lineup* drops C/LW/RW (offense) and LD/RD (defense) on the ice.
- **Draw movement**: tap *Draw*, pick a line type, then drag on the ice starting on a player (tap *Done* when finished): Skate (dashed), Carry (wavy, puck follows), Back (backward skating), Pass (double line, moves the puck), Shot (heavy line).
  *Clean up my lines* straightens near-straight strokes, rounds hand-drawn circles into true circles, and smooths curves.
- **One per position**: each team can have only one C, LW, RW, LD, RD and G (plus any number of generic X players) and one puck. Taken positions are greyed out; changing a player to a taken position swaps the two.
- **Quick actions**: tap a player or line (right-click with a mouse) to change position/team, start a line, change a line's type, or delete it. Long-press (right-click) empty ice to add a player right there or pick a draw tool.
- **Timing within a step** (the Timing panel, clock button in the bottom bar): every line is a bar on a mini timeline. Empty space before a bar is the player *holding in place*. Drag a bar to delay it, drag its right edge to change speed. Or select a line and choose *Start when another line reaches a point…*: the player holds until the other player is, say, 55% along their line (shown as a ◇ marker you can drag on the ice). Use *Preview step* to test just that step.
- **Steps** are chapters: everything drawn in a step happens at the same time, steps play in order. Each step has a title and coaching points. Players appear in each step where the previous one ended.
- **Playback**: play/pause, previous/next step, scrub, play all or one step, 0.5×/1×/2×. Players, puck, passes and shots animate.
- **Share** a read-only link (with playback), download a **PNG**, **Print / Save as PDF**, export/import **JSON**.
- Shortcuts: ⌘/Ctrl+Z undo, ⇧⌘Z redo, Delete removes selection, Space play/pause, Esc deselect.

## Development

```sh
npm install
npm run dev        # API on :3000, Vite on :5173
npm test           # vitest: geometry cleanup, playback engine, sample drills, API auth/ownership
npm run typecheck
```

Layout: `shared/` (types, geometry, playback engine — used by both sides), `server/` (Express + SQLite), `web/` (React + Vite, SVG rink).
