# Installing the EQ2 Rotation Overlay

This is a **custom UI skin** for EverQuest 2. It adds small on-screen windows that
show your Inquisitor rotation priority for each role (HEAL / SOLO / GRP DPS / RAID).
It is a **reference cheat-sheet** — EQ2 has no cooldown API, so it cannot detect what
is off cooldown and highlight the next button. It just shows the priority list.

> Everything here uses the English game client. Spell names in the windows come from
> `data/inquisitor.json` — see "Editing your rotation" below.

---

## Step 0 (recommended first): smoke test

Before installing the full thing, prove the load mechanism works on **your** client.

1. Build the tiny test skin:
   ```
   node src/generate.mjs --smoke --skin=RotationUI_Smoke
   ```
2. Copy `dist/UI/RotationUI_Smoke/` into your EQ2 UI folder (see Step 2 for the path).
3. In `eq2.ini` set `cl_ui_skinname RotationUI_Smoke` (Step 3).
4. Launch, then type `/show_window Custom.RotSmoke`.
   - A little window should appear that you can drag. **If it does, the mechanism works** —
     switch `cl_ui_skinname` back to `RotationUI` and continue with the real build.
   - If `/show_window Custom.RotSmoke` does nothing, try `/show_window RotSmoke`
     (older clients sometimes address the window without the `Custom.` prefix). Note which
     one works — you'll use the same prefix for the real windows.

---

## Step 1: Build the overlay

From the project folder:
```
npm run build
```
This writes the skin to `dist/UI/RotationUI/`. The console prints the exact
`/show_window` command for each role window — keep that output handy.

Optional: `npm run build:stacked` → also builds one tall "ALL ROLES" window
(`/show_window Custom.RotationAll`) if you'd rather have a single window.

---

## Step 2: Find your EQ2 install and copy the skin

Your EQ2 folder is the one that contains **`eq2.ini`** and a **`UI/`** subfolder.
Common locations:

- `C:\Program Files\Sony\EverQuest II\`
- `C:\Program Files (x86)\Sony\EverQuest II\`
- `C:\Users\Public\Daybreak Game Company\Installed Games\EverQuest II\`
- On a private/emu server (e.g. Vushi) it's wherever you extracted the client — look for `eq2.ini`.

Copy the built folder so you end up with:
```
<EQ2 install>\UI\RotationUI\eq2ui_custom.xml
<EQ2 install>\UI\RotationUI\eq2ui_custom_inquisitor_heal.xml
<EQ2 install>\UI\RotationUI\eq2ui_custom_inquisitor_solo.xml
<EQ2 install>\UI\RotationUI\eq2ui_custom_inquisitor_groupdps.xml
<EQ2 install>\UI\RotationUI\eq2ui_custom_inquisitor_raiddps.xml
```

> A custom skin only needs the files it changes — every other UI file falls back to the
> default automatically. This skin only adds the `eq2ui_custom.xml` hook (empty in the
> default UI) plus the rotation windows, so **nothing else about your UI changes.**

---

## Step 3: Tell EQ2 to load the skin

Open `<EQ2 install>\eq2.ini` in a text editor and make sure these two lines exist
(add them if missing; if a `cl_ui_skinname` line already exists, change its value):
```
cl_ui_subdir UI/
cl_ui_skinname RotationUI
```
Save. (If you already use another custom UI like ProfitUI/DrumsUI, see
"Using this alongside another custom UI" below — don't just overwrite its name.)

---

## Step 4: Open and position the windows

Log in, then for each role type the matching command (also printed by the build):
```
/show_window Custom.RotationHeal
/show_window Custom.RotationSolo
/show_window Custom.RotationGrpDps
/show_window Custom.RotationRaid
```
The window appears; **drag it** where you want it. `/show_window` toggles it on/off,
so the same command hides it again. Position persists with your UI settings.

### Make a quick toggle (macro + optional key)

1. Right-click an empty hotbar slot → **Create Macro** (or `Socials` window → New Macro).
2. Name it e.g. `Heal Rotation`, command line:
   ```
   /show_window Custom.RotationHeal
   ```
3. Drag the macro onto a hotbar. Clicking it now toggles that window.
4. (Optional) Bind a key: **EQ2 Options → Controls → Keys**, find the hotbar slot's
   keybind, or bind the macro directly if your client lists it.

---

## Editing your rotation (this is the important part)

The spell names shipped are a **draft** and every uncertain one is marked `(verify)`.
Replace them with your real Vushi/EoF Inquisitor spells:

1. Open `data/inquisitor.json`.
2. Each role has five sections: `maintain`, `opener`, `priority`, `emergency`, `cooldowns`.
   Each entry is `{ "name": "Spell Name", "note": "why / when" }`.
   **Order matters** — top item = do it first.
3. Change names/notes, add or delete entries freely.
4. Rebuild and recopy:
   ```
   npm run build
   ```
   then copy `dist/UI/RotationUI/` over the one in your EQ2 folder again.
5. In-game, run `/loadui` (or relog) to reload the UI.

> Prefer not to use Node? You can edit the text directly in
> `<EQ2 install>\UI\RotationUI\eq2ui_custom_inquisitor_*.xml` — change the text inside
> `LocalText="..."`. Keep the XML valid (matching quotes/tags). Rebuilding is safer.

---

## Using this alongside another custom UI (ProfitUI, DrumsUI, etc.)

A skin folder is loaded as a whole, so you can't point `cl_ui_skinname` at two folders.
To combine, copy this skin's files **into your existing skin folder**:

- Copy the four `eq2ui_custom_inquisitor_*.xml` files into `<EQ2>\UI\<YourSkin>\`.
- If `<YourSkin>` already has its own `eq2ui_custom.xml`, **don't overwrite it** — instead
  open it and add these lines inside the `<Page Name="Custom"> ... </Page>`:
  ```xml
  <include>eq2ui_custom_inquisitor_heal.xml</include>
  <include>eq2ui_custom_inquisitor_solo.xml</include>
  <include>eq2ui_custom_inquisitor_groupdps.xml</include>
  <include>eq2ui_custom_inquisitor_raiddps.xml</include>
  ```
- If it has no `eq2ui_custom.xml`, just copy ours in.

Leave `cl_ui_skinname` pointing at your existing skin.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `/show_window Custom.RotationHeal` does nothing | Try without the prefix: `/show_window RotationHeal`. Use whichever worked in the smoke test for all windows. |
| Nothing loads at all | Re-check `eq2.ini` has both `cl_ui_subdir UI/` and `cl_ui_skinname RotationUI`, and that files are in `UI\RotationUI\` (not `UI\RotationUI\RotationUI\`). Relog. |
| Windows show but text is cramped/overflows | Widen the window: increase `320` (width) in `src/generate.mjs` (`const W = 320;`) and rebuild. |
| I changed the data but nothing updated | You must **rebuild and recopy**, then `/loadui` or relog. |
| I want to remove it | In `eq2.ini`, set `cl_ui_skinname` back to your previous value (or `Default`), relog. Delete the `UI\RotationUI\` folder if you like. |

---

## What this is not

- Not automation and not a live "press this next" bot — it's a static reference the game
  renders on screen. It reads nothing from combat and sends no input. This keeps it safe
  under EQ2's UI-modding rules.
