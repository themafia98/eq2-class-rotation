# eq2-class-rotation

Two EverQuest 2 rotation tools for the **Inquisitor** (all four roles: HEAL / SOLO / GROUP
DPS / RAID), data-driven so more classes are just another JSON file:

1. **In-game reference overlay** — a custom UI skin showing your ability priority on screen.
   Passive, input-free, ToS-safe. See **[INSTALL.md](./INSTALL.md)**.
2. **Live rotation advisor** — an Electron always-on-top overlay that reads the EQ2 combat
   log and shows *"cast next: X"* live. **Suggest-only** (you press the keys) — see
   **[ADVISOR.md](./ADVISOR.md)**.

> Neither tool automates input or plays for you. The overlay just draws a cheat-sheet; the
> advisor only *reads the log* and suggests — same category of tool as ACT. EQ2 has no
> cooldown API, so advisor cooldowns are **estimated** from your casts in the log.

## ⬇️ For players — download & install (no coding)

1. Open the **[Releases](https://github.com/themafia98/eq2-class-rotation/releases/latest)** page.
2. Download **`EQ2-Rotation-Advisor-Setup-<version>.exe`** (installer) — or the
   `...-portable.exe` if you'd rather not install, just run.
3. Double-click it. Windows may show **"Windows protected your PC"** (the app isn't code-signed):
   click **More info → Run anyway**. This is normal for free indie apps.
4. Launch **EQ2 Rotation Advisor** from the Start menu / desktop shortcut.
5. In EQ2: type `/log` once to enable logging, and play in **Borderless Windowed** so the
   overlay stays on top. Roles switch with `Ctrl+Alt+H/S/D/R`; the ⚙ button (or `Ctrl+Alt+E`)
   opens your editable rotation files.

That's it — full details in **[ADVISOR.md](./ADVISOR.md)**.

## Quick start — in-game overlay

```
npm run build           # -> dist/UI/RotationUI/   (per-role windows; default)
npm run build:combined  # also emits one tall "ALL ROLES" window
npm run build:smoke     # tiny test window only, to verify the load mechanism first
```

Then follow **[INSTALL.md](./INSTALL.md)**: copy `dist/UI/RotationUI/` into
`<EQ2 install>\UI\RotationUI\`, add two lines to `eq2.ini`, and toggle windows with
`/show_window Custom.RotationHeal` (etc.).

## Quick start — live advisor

```
npm install             # first time (pulls Electron + toolchain)
npm run typecheck       # tsgo (TypeScript 7 native preview)
npm test                # tsx test runner (parser/engine/detect/ingest)
npm run build           # esbuild -> build/
npm run advisor:headless -- --replay=advisor/sample.log   # console demo (no game needed)
npm run advisor         # the real Electron overlay (tails your live EQ2 log)
npm run dist            # build installer + portable EXE -> dist-exe/
```

The **.exe** is a double-click app; on first run it seeds an editable `config.json` + `data\`
into `%APPDATA%\eq2-class-rotation\` (open it with the overlay's ⚙ button or `Ctrl+Alt+E`),
and **refreshes them on version upgrade** (old copies saved as `.bak`). It also **auto-updates**
from GitHub Releases, **auto-detects your character/class** from the log, and has an in-overlay
**rotation editor** (`Ctrl+Alt+P`). See **[ADVISOR.md](./ADVISOR.md)** for details.

## Project layout (TypeScript)

```
src/shared/types.ts        # domain model + typed IPC contract (single source of truth)
src/overlay/generate.ts    # EQ2 custom-UI XML generator (+ cli.ts)
src/advisor/*.ts           # pure core: parse, ingest (DoT-aware), engine, logtail, detect, config, core
src/advisor/electron/*.ts  # main + preload (bundled to build/*.cjs)
src/advisor/renderer/*     # overlay.html + overlay.ts (editor)
tests/*.test.ts            # tsx/node --test
data/*.json                # EDIT THIS: rotations (one file per class)
build/ , dist/ , dist-exe/ # generated (git-ignored)
```

Tooling: **tsgo** (TS7) typecheck · **esbuild** bundle · **tsx** run/test · **electron-builder** package.

## Editing your rotation

Edit `data/inquisitor.json` — each role has `maintain / opener / priority / emergency /
cooldowns`, each an ordered list of `{ "name", "note" }` (top = do first). Optional per-item
`recast` (seconds) / `duration` (seconds) drive the live advisor's cooldown & refresh
estimates; the overlay generator ignores them. Every shipped spell name/timing marked
`(verify)` should be checked against your server. After editing: rebuild the in-game overlay
with `npm run build:overlay`, and/or restart the advisor (or edit live in the overlay editor).

## Adding another class

1. Copy `data/inquisitor.json` → `data/<class>.json`.
2. Set `class`, `title`, a unique `windowName`, and fill the four roles.
3. `npm run build:overlay` regenerates the in-game skin; the advisor auto-detects and loads the
   matching class from the log. No code changes needed.

## CLI flags

| Flag | Effect |
|---|---|
| _(none)_ | one draggable window per role (default) |
| `--combined` | also emit one tall all-roles window per class |
| `--smoke` | emit only a minimal test window |
| `--skin=Name` | output folder / skin name (default `RotationUI`) |

## Notes / limitations

- Exact `/show_window` path and some window attributes can vary by client build — run the
  **smoke test** (INSTALL.md Step 0) first to confirm on your client.
- Text-only windows (no custom textures) so there are no missing-asset risks; drag to place.
