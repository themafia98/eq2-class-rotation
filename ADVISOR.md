# EQ2 Live Rotation Advisor

A transparent, always-on-top overlay that reads your EverQuest 2 **combat log** and shows,
live, what to cast next by priority for the active role. It is **suggest-only**:

> It **reads the log and displays a suggestion. It never presses keys or plays for you.**
> That's the same category of tool as ACT. Do not confuse it with a bot — automating input
> would violate EQ2/Vushi rules and is not what this does.

### Honest limitations — read these

- **Cooldowns are estimated**, not exact. The overlay times them from *when you cast*
  (as seen in the log) plus each ability's `recast` in `data/inquisitor.json`. There is no
  server-side cooldown / global-cooldown / power data available to any log reader.
- **HEAL role** is inherently reactive — there the overlay is best used as a **buff/debuff
  uptime + cooldown reminder**, not a "cast next" oracle. It shines most for **DPS** priority.
- **Check your server's rules (Vushi).** Some servers forbid even parsers/overlays. If yours
  does, use the in-game static overlay ([INSTALL.md](./INSTALL.md)) instead.

---

## 1. Enable combat logging in EQ2

1. Log in to your character.
2. Type `/log` to start logging. (Toggling `/log` off then on again ensures it writes to the
   per-character file rather than a generic one.)
3. Make sure combat text is going to the logged window (default chat is fine).

**How it detects your abilities:** modern EQ2 does **not** log "You begin casting X." Instead it
logs the *effect* of your abilities as `YOUR <ability> hits/heals/... `. The advisor keys off
those `YOUR` lines (config `effectPrefix` / `effectVerbs`). So an ability counts as "used" the
moment its effect lands — a hair after you cast it, which is fine for cooldown timing. (It still
also understands `You begin casting X.` if your client emits it.)

The log file is written to:
```
<EQ2 install>\logs\<ServerName>\eq2log_<CharacterName>.txt
```
Lines look like:
```
(1785949908)[Wed Aug  5 19:11:48 2026] YOUR Verdict hits a wooly spider for 260 divine damage.
```
The number in parentheses is a Unix timestamp — the advisor uses it for timing.

> **DoT caveat:** damage-over-time abilities log an effect line on every tick, so their estimated
> cooldown only frees up after the DoT stops ticking. Direct abilities (one hit per cast) are
> accurate. Tune `recast` per ability in `data\inquisitor.json`.

---

## 2. Install & first run

```
npm install            # first time only — downloads Electron (large)
npm test               # optional: verify parser + engine pass
```

**Try it without the game first** (replays a bundled sample log):
```
npm run advisor:replay     # Electron overlay, driven by advisor/sample.log
# or, pure console (no Electron):
npm run advisor:headless
```
You should see **NEXT** change as the sample fight progresses, with cooldown countdowns.

**Real run** (tails your live EQ2 log):
```
npm run advisor
```
Run **EQ2 in Borderless Windowed** mode so the overlay floats on top and the global
shortcuts work (exclusive Fullscreen can capture keys and hide external windows).

### Prefer a double-click .exe?

Build a standalone portable executable (no Node needed to run it afterwards):
```
npm install
npm run dist
```
The result is **`dist-exe\EQ2-Rotation-Advisor-<version>.exe`** — a single file you can copy
anywhere and double-click. No installer.

On **first launch** the exe copies an **editable** `config.json` and `data\` into your Windows
user folder so you can edit your rotation and log path (inside the exe they're read-only):
```
%APPDATA%\eq2-class-rotation\
```
Click the **⚙** in the overlay's bottom-right (or press `Ctrl+Alt+E`) to open that folder.
Edit the files there, then restart the exe.

---

## 3. Configuration — `advisor/config.json`

| Key | Meaning |
|---|---|
| `class`, `dataFile` | which class file to load (default `data/inquisitor.json`) |
| `logsDir` | `"auto"` probes common EQ2 install dirs; or set an absolute logs path |
| `logFile` | `"auto"` = newest `eq2log_*.txt` under `logsDir`; or set an absolute file path |
| `defaultRole` | `heal` / `solo` / `groupdps` / `raiddps` |
| `effectPrefix` / `effectVerbs` | how it reads `YOUR <ability> <verb> ...` lines (the main detection) |
| `castPatterns` | fallback "begin casting" lines — `{spell}` is the captured name |
| `engine.gcd` | assumed global cooldown (s) when an ability has no `recast` |
| `engine.combatWindow` | seconds of no casts before it switches back to the opener list |
| `window` | overlay opacity / corner / size |
| `shortcuts` | global hotkeys (below) |

If detection fails (`no log — set config` in the overlay footer), set `logFile` to the full
path of your active `eq2log_*.txt`.

### If your cast lines don't match (learn mode)

Different clients word things differently. To see your client's exact lines:
```
npm run advisor:learn
```
Play a bit; it prints any casting-looking line that **didn't** match. Copy the wording into
`castPatterns` (keep `{spell}` where the ability name goes), e.g.
`"You begin casting {spell}."` → add `"YOU begin casting {spell}!"` if that's what yours shows.

---

## 4. Hotkeys (global — work while EQ2 is focused, in Borderless)

| Shortcut | Action |
|---|---|
| `Ctrl+Alt+H / S / D / R` | switch role: Heal / Solo / grp Dps / Raid |
| `Ctrl+Alt+O` | toggle **click-through** (so the overlay stops eating mouse clicks) |
| `Ctrl+Alt+G` | show / hide the overlay |
| `Ctrl+Alt+Up / Down` | opacity up / down |
| `Ctrl+Alt+E` | open the settings folder (packaged .exe only) |

You can also click the role tabs in the overlay (turn click-through **off** first). Drag the
overlay by its top/bottom strip to reposition. Change any binding in `config.json → shortcuts`.

---

## 5. Tuning the rotation & cooldowns

The suggestions come from `data/inquisitor.json` (shared with the in-game overlay). Per item:
```jsonc
{ "name": "Verdict",        "note": "...", "recast": 30 }   // priority/opener: seconds to reuse
{ "name": "Heretic's Doom", "note": "...", "duration": 30 } // maintain: seconds it lasts -> REFRESH
{ "name": "Foo", "logName": "Foo Strike" }                    // if the log name differs from display
```
- Order within `priority` = the order the advisor suggests them (top first, when ready).
- All shipped names/timings are a **draft marked `(verify)`** — replace with your real Vushi
  values. Restart the advisor after editing.

---

## 6. What you see

- **NEXT** — the top-priority ability that's currently ready (green). "waiting…" if all are
  on estimated cooldown.
- **queue** — the next priority abilities with shrinking cooldown bars / `rdy`.
- **⟳ pills** — `maintain` buffs/debuffs whose duration lapsed (or were never applied) —
  refresh them.
- **footer** — green dot = log connected; role hotkey hint.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| Footer says `no log` | Set `logFile` in `config.json` to your active `eq2log_*.txt` full path; make sure `/log` is on. |
| NEXT never changes / stuck | Combat logging isn't capturing casts. Confirm the file grows and contains `begin casting` lines; use `npm run advisor:learn`. |
| Cast lines ignored | Wording differs — add your pattern to `castPatterns` (learn mode shows it). |
| Overlay not on top / hotkeys dead | Run EQ2 **Borderless Windowed**, not exclusive Fullscreen. |
| Overlay blocks my clicks | `Ctrl+Alt+O` to toggle click-through. |
| Cooldowns look wrong | They're estimates — tune each ability's `recast` in `data/inquisitor.json`. |
