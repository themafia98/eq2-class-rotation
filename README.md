# eq2-class-rotation

On-screen **rotation reference overlay** for EverQuest 2, delivered as a custom UI skin.
First class: **Inquisitor** (all four roles: HEAL / SOLO / GROUP DPS / RAID). Data-driven,
so more classes are just another JSON file.

> **What it does:** shows a small window per role listing your ability priority
> (buffs to keep up → opener → sustained priority → emergency/cures → long cooldowns).
> **What it can't do:** EQ2 has no cooldown/combat scripting API for the UI, so it cannot
> detect what's off cooldown or highlight the next button (that's a WoW thing). This is a
> cheat-sheet the game draws on screen — passive, input-free, ToS-safe.

## Quick start

```
npm run build          # -> dist/UI/RotationUI/   (per-role windows; default)
npm run build:stacked  # also emits one tall "ALL ROLES" window
npm run build:smoke     # tiny test window only, to verify the load mechanism first
```

Then follow the install guide — **[INSTALL.md](./INSTALL.md)**: copy `dist/UI/RotationUI/`
into `<EQ2 install>\UI\RotationUI\`, add two lines to `eq2.ini`, and toggle windows with
`/show_window Custom.RotationHeal` (etc.).

## Project layout

```
data/inquisitor.json   # EDIT THIS: roles + ordered ability priorities (draft; verify names)
src/generate.mjs       # generator: data/*.json -> EQ2 custom-UI XML, with XML validation
dist/UI/<skin>/        # generated, copy-ready skin (git-ignored build output)
INSTALL.md             # install + usage + editing + troubleshooting manual
```

## Editing your rotation

Edit `data/inquisitor.json` — each role has `maintain / opener / priority / emergency /
cooldowns`, each an ordered list of `{ "name", "note" }` (top = do first). Rebuild, recopy,
`/loadui`. Every shipped spell name marked `(verify)` should be checked against your server
(Vushi may differ from standard Echoes of Faydwer).

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
