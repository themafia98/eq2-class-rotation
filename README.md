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
npm install             # first time (pulls Electron)
npm test                # verify the parser + engine
npm run advisor:headless  # console demo over advisor/sample.log (no game needed)
npm run advisor         # the real Electron overlay (tails your live EQ2 log)
npm run dist            # build a portable EXE -> dist-exe\EQ2-Rotation-Advisor-<ver>.exe
```

The **.exe** is a single double-click file; on first run it seeds an editable
`config.json` + `data\` into `%APPDATA%\EQ2 Rotation Advisor\` (open it with the overlay's
⚙ button or `Ctrl+Alt+E`). See **[ADVISOR.md](./ADVISOR.md)** for enabling `/log`,
cast-pattern tuning, shortcuts, and the honest limitations.

## Project layout

```
data/inquisitor.json   # EDIT THIS: roles + ordered priorities (+ optional recast/duration timings)
src/generate.mjs       # overlay generator: data/*.json -> EQ2 custom-UI XML, with XML validation
dist/UI/<skin>/        # generated, copy-ready skin (git-ignored build output)
advisor/               # live advisor: parse/engine (pure, tested) + logtail + Electron shell
INSTALL.md             # in-game overlay: install/usage/troubleshooting
ADVISOR.md             # live advisor: setup, /log, shortcuts, limitations
```

## Editing your rotation

Edit `data/inquisitor.json` — each role has `maintain / opener / priority / emergency /
cooldowns`, each an ordered list of `{ "name", "note" }` (top = do first). Optional per-item
`recast` (seconds) / `duration` (seconds) drive the live advisor's cooldown & refresh
estimates; the overlay generator ignores them. Every shipped spell name/timing marked
`(verify)` should be checked against your server (Vushi may differ from standard Echoes of
Faydwer). After editing: rebuild the overlay (`npm run build`) and/or restart the advisor.

## Adding another class

1. Copy `data/inquisitor.json` → `data/<class>.json`.
2. Set `class`, `title`, a unique `windowName`, and fill the four roles.
3. `npm run build`. The generator picks up every `data/*.json` automatically and prints the
   `/show_window` command for each new window. No code changes needed.

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
