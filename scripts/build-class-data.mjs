// Build aid (not shipped runtime): emit data/<class>.json rotation cheat-sheets for all 24 EoF
// classes. Inquisitor mixes real ZAM names with names confirmed from the user's own Wuoshi log.
//
//   node scripts/build-class-data.mjs
//
// Ability NAMES are the real EoF-era base names (tier numerals stripped) pulled from the ZAM DB
// via scripts/fetch-eq2-abilities.mjs, so the live advisor can detect them from the combat log.
// recast/duration and priority ORDER are best-effort (verify) drafts — reorder in-game via the
// overlay editor, and let the log fill in what you actually cast.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");

// ---- tiny helpers ---------------------------------------------------------
const A = (name, note, extra = {}) => ({ name, note, ...extra });

const README =
  "Auto-seeded EoF-era cheat-sheet. Ability names are real EoF base names (from the ZAM DB, " +
  "level<=70) so the live advisor detects them in your combat log. recast/duration and the " +
  "priority ORDER are best-effort (verify) DRAFTS — reorder to taste in the overlay editor and " +
  "tune timings from your own casts. Not every ability is listed; add yours as you cast them.";

// section labels per archetype
const LABELS = {
  healer: { maintain: "KEEP UP (buffs/wards)", opener: "OPENER / PULL", priority: "PRIORITY (top = first)", emergency: "EMERGENCY / CURES", cooldowns: "LONG COOLDOWNS" },
  tank: { maintain: "KEEP UP (stance/buffs)", opener: "PULL / SNAP AGGRO", priority: "PRIORITY (top = first)", emergency: "DEFENSIVES / SAVES", cooldowns: "LONG COOLDOWNS" },
  dps: { maintain: "KEEP UP (buffs/debuffs)", opener: "OPENER / STEALTH", priority: "PRIORITY (top = first)", emergency: "ESCAPE / AVOID", cooldowns: "LONG COOLDOWNS / BURST" },
  bard: { maintain: "KEEP UP (songs)", opener: "OPENER", priority: "PRIORITY (top = first)", emergency: "ESCAPE / UTILITY", cooldowns: "LONG COOLDOWNS" },
};

const ROLE_LABELS = {
  healer: { heal: "HEAL", solo: "SOLO", groupdps: "GRP DPS", raiddps: "RAID" },
  tank: { heal: "MT / AGGRO", solo: "SOLO", groupdps: "GROUP (AoE)", raiddps: "RAID (MT/OT)" },
  dps: { heal: "AOE / MULTI", solo: "SOLO", groupdps: "GRP / ST", raiddps: "RAID BURST" },
  bard: { heal: "BUFFS / UTILITY", solo: "SOLO", groupdps: "GRP DPS", raiddps: "RAID" },
};

const pick = (...xs) => xs.find((x) => Array.isArray(x) && x.length) ?? [];

// Build the 4 fixed-id roles (keeps global heal/solo/groupdps/raiddps hotkeys working) from a spec.
function buildRoles(archetype, s) {
  const L = ROLE_LABELS[archetype];
  const role = (id, blurb, o) => ({
    id, label: L[id], blurb,
    maintain: o.maintain ?? s.maintain ?? [],
    opener: o.opener ?? s.opener ?? [],
    priority: o.priority ?? [],
    emergency: o.emergency ?? s.emergency ?? [],
    cooldowns: o.cooldowns ?? s.cooldowns ?? [],
  });

  if (archetype === "healer") {
    return [
      role("heal", "Keep the group up; weave a nuke only when nobody needs healing.", { opener: pick(s.healOpener, s.opener), priority: s.heals, emergency: pick(s.emergency) }),
      role("solo", "DoT/nuke + self-heal as needed.", { priority: s.dps, emergency: pick(s.selfHeal, s.emergency) }),
      role("groupdps", "Group healing is covered — push damage, cover cures.", { priority: s.dps }),
      role("raiddps", "Damage + utility; keep buffs up, cover your group's cures.", { priority: s.dps }),
    ];
  }
  if (archetype === "tank") {
    return [
      role("heal", "Hold aggro: taunts on cooldown, then CAs for threat.", { priority: s.priority }),
      role("solo", "Kill things: CA damage order, defensives as needed.", { priority: pick(s.dps, s.priority) }),
      role("groupdps", "Multi-mob: AoE taunts first, keep everything on you.", { opener: pick(s.aoeOpener, s.opener), priority: pick(s.aoe, s.priority) }),
      role("raiddps", "Raid MT/OT: encounter taunts + threat CAs.", { priority: s.priority }),
    ];
  }
  if (archetype === "bard") {
    return [
      role("heal", "Buff/utility pass: keep songs up, apply debuffs.", { priority: pick(s.utility, s.maintain) }),
      role("solo", "Solo damage rotation.", { priority: s.priority }),
      role("groupdps", "Group DPS: keep songs up, then damage priority.", { priority: s.priority }),
      role("raiddps", "Raid: buff/debuff coverage + damage.", { priority: s.priority }),
    ];
  }
  // dps (mage/scout)
  return [
    role("heal", "Multi-target: AoE / encounter damage.", { priority: pick(s.aoe, s.priority) }),
    role("solo", "Single-target sustained damage.", { priority: s.priority }),
    role("groupdps", "Group single-target priority.", { priority: s.priority }),
    role("raiddps", "Raid burst: line up cooldowns.", { priority: pick(s.burst, s.priority) }),
  ];
}

function classFile(cls, archetype, title, s) {
  const roles = buildRoles(archetype, s);
  return {
    _readme: README,
    class: cls,
    title,
    // Unique per class so the in-game overlay page names / toggles don't collide across classes.
    windowName: cls,
    sections: ["maintain", "opener", "priority", "emergency", "cooldowns"],
    sectionLabels: LABELS[archetype],
    roles,
  };
}

// ===========================================================================
// Per-class specs. Names are real EoF base names. Timings are (verify) drafts.
// ===========================================================================
const SPECS = [];
const add = (cls, arch, title, s) => SPECS.push([cls, arch, title, s]);

// ---- FIGHTERS -------------------------------------------------------------
add("Guardian", "tank", "Guardian Rotation", {
  maintain: [A("Hold the Line", "defensive stance — keep on (persistent)"), A("Sentinel", "group mitigation buff (verify)", { duration: 300 }), A("Call to Arms", "group buff (verify)", { duration: 300 })],
  opener: [A("Provoke", "single taunt to snap aggro", { recast: 8 }), A("Taunting Blow", "taunt + hit", { recast: 12 })],
  priority: [A("Rescue", "1) taunt if you lose aggro", { recast: 30 }), A("Provoke", "2) single taunt on cd", { recast: 8 }), A("Shout", "3) AoE taunt", { recast: 15 }), A("Assault", "4) threat CA", { recast: 12 }), A("Overpower", "5) CA", { recast: 10 }), A("Sever", "6) CA", { recast: 12 }), A("Gut Kick", "7) CA + interrupt", { recast: 12 }), A("Slam", "8) CA", { recast: 15 })],
  aoe: [A("Shout", "1) AoE taunt on cd", { recast: 15 }), A("Rescue", "2) AoE aggro save", { recast: 30 }), A("Call to Arms", "3) AoE taunt", { recast: 30 }), A("Decimate", "4) AoE CA", { recast: 20 }), A("Overpower", "5) CA", { recast: 10 })],
  emergency: [A("Tower of Stone", "big damage-absorb wall", { recast: 300 }), A("Sentry Watch", "defensive cooldown", { recast: 180 }), A("Guardian Sphere", "group protection", { recast: 300 }), A("Last Man Standing", "survive lethal hit (verify)")],
  cooldowns: [A("Reinforcement", "threat/defensive burst (verify)", { recast: 180 }), A("Decimate", "big CA", { recast: 45 }), A("Unyielding Will", "break/immunity (verify)", { recast: 300 })],
});

add("Berserker", "tank", "Berserker Rotation", {
  maintain: [A("Berserk Rage", "haste/DPS stance — keep on", { duration: 300 }), A("Aggressive Defense", "riposte buff (verify)", { duration: 300 }), A("Open Wounds", "proc buff (verify)", { duration: 300 })],
  opener: [A("Mock", "single taunt to snap aggro", { recast: 8 }), A("Rupture", "opener CA", { recast: 12 })],
  priority: [A("Rescue", "1) taunt if you lose aggro", { recast: 30 }), A("Mock", "2) single taunt on cd", { recast: 8 }), A("War Cry", "3) AoE taunt", { recast: 15 }), A("Maul", "4) threat CA", { recast: 12 }), A("Head Crush", "5) CA + interrupt", { recast: 12 }), A("Rupture", "6) CA", { recast: 12 }), A("Mutilate", "7) CA", { recast: 15 }), A("Destructive Rage", "8) CA", { recast: 15 })],
  aoe: [A("War Cry", "1) AoE taunt on cd", { recast: 15 }), A("Berserker Onslaught", "2) AoE taunt + damage", { recast: 30 }), A("Rampage", "3) AoE CA", { recast: 30 }), A("Demolish", "4) AoE CA", { recast: 20 })],
  emergency: [A("Wall of Rage", "block/defensive", { recast: 180 }), A("Vision of Madness", "burst + self buff", { recast: 180 }), A("Rescue", "aggro save", { recast: 30 })],
  cooldowns: [A("Juggernaut", "big DPS/threat burst", { recast: 300 }), A("Frenzy", "melee burst", { recast: 60 }), A("Rampage", "AoE burst", { recast: 45 })],
});

add("Monk", "tank", "Monk Rotation", {
  maintain: [A("Inner Calm", "avoidance stance — keep on (persistent)"), A("Body Like Mountain", "mitigation buff (verify)", { duration: 300 })],
  opener: [A("Challenge", "single taunt to snap aggro", { recast: 8 }), A("Waking Dragon", "opener CA", { recast: 12 })],
  priority: [A("Challenge", "1) single taunt on cd", { recast: 8 }), A("Silent Threat", "2) taunt", { recast: 12 }), A("Five Rings", "3) AoE taunt/CA", { recast: 15 }), A("Waking Dragon", "4) CA", { recast: 12 }), A("Frozen Palm", "5) CA", { recast: 10 }), A("Crescent Strike", "6) CA", { recast: 12 }), A("Charging Tiger", "7) CA", { recast: 15 }), A("Arctic Talon", "8) CA", { recast: 15 })],
  aoe: [A("Five Rings", "1) AoE taunt on cd", { recast: 15 }), A("Instill Panic", "2) AoE taunt", { recast: 20 }), A("Silent Palm", "3) AoE CA", { recast: 20 }), A("Dragonfire", "4) AoE CA", { recast: 30 })],
  emergency: [A("Tsunami", "huge avoidance cooldown", { recast: 300 }), A("Mountain Stance", "mitigation cooldown (rooted)", { recast: 180 }), A("Feign Death", "drop aggro / survive")],
  cooldowns: [A("Devastation Fist", "big CA", { recast: 60 }), A("Dragonfire", "AoE nuke", { recast: 45 }), A("Fall of the Phoenix", "self-rez on death", { recast: 600 })],
});

add("Bruiser", "tank", "Bruiser Rotation", {
  maintain: [A("Brutality", "haste/DPS buff — keep on", { duration: 300 }), A("Close Mind", "control-resist buff (verify)", { duration: 300 })],
  opener: [A("Intimidate", "single taunt + stun", { recast: 8 }), A("Pummel", "opener CA", { recast: 12 })],
  priority: [A("Intimidate", "1) taunt + stun on cd", { recast: 8 }), A("Manhandle", "2) taunt/CA", { recast: 12 }), A("Instill Panic", "3) AoE taunt", { recast: 15 }), A("Pummel", "4) CA", { recast: 12 }), A("Meteor Fist", "5) CA", { recast: 10 }), A("Blaze Kick", "6) CA", { recast: 12 }), A("Eye Gouge", "7) CA", { recast: 15 }), A("Uppercut", "8) CA", { recast: 15 })],
  aoe: [A("Instill Panic", "1) AoE taunt on cd", { recast: 15 }), A("One Hundred Hand Punch", "2) AoE CA", { recast: 20 }), A("Sucker Punch", "3) AoE CA", { recast: 20 })],
  emergency: [A("Rock Skin", "stoneskin/defensive", { recast: 180 }), A("Bruising", "damage-absorb", { recast: 180 }), A("Feign Death", "drop aggro / survive")],
  cooldowns: [A("Knockout Combination", "big CA", { recast: 60 }), A("Devastation Fist", "big CA", { recast: 60 }), A("Savage Assault", "burst", { recast: 45 })],
});

add("Paladin", "tank", "Paladin Rotation", {
  maintain: [A("Knight's Stance", "defensive stance — keep on (persistent)"), A("Amends", "threat-transfer to a DPS — keep on", { duration: 1800 }), A("Blessing of the Paladin", "group buff (verify)", { duration: 300 })],
  opener: [A("Faith Strike", "taunt + hit to snap aggro", { recast: 8 }), A("Judgment", "opener nuke", { recast: 10 })],
  priority: [A("Rescue", "1) taunt if you lose aggro", { recast: 30 }), A("Faith Strike", "2) single threat on cd", { recast: 8 }), A("Holy Circle", "3) AoE taunt/ward", { recast: 15 }), A("Judgment", "4) nuke", { recast: 10 }), A("Ancient Wrath", "5) CA", { recast: 12 }), A("Power Cleave", "6) AoE CA", { recast: 15 }), A("Holy Strike", "7) CA", { recast: 15 }), A("Doom Judgment", "8) nuke", { recast: 20 })],
  aoe: [A("Holy Circle", "1) AoE taunt on cd", { recast: 15 }), A("Power Cleave", "2) AoE CA", { recast: 15 }), A("Decree", "3) AoE nuke", { recast: 20 }), A("Consecrate", "4) AoE threat", { recast: 30 })],
  emergency: [A("Lay on Hands", "huge single heal (self/tank)", { recast: 300 }), A("Sigil of Heroism", "defensive + threat", { recast: 180 }), A("Divine Favor", "death prevention (verify)", { recast: 300 }), A("Prayer of Healing", "top-up heal", { recast: 10 })],
  cooldowns: [A("Castigate", "big nuke", { recast: 45 }), A("Decree", "AoE nuke", { recast: 30 }), A("Sigil of Heroism", "burst window", { recast: 180 })],
});

add("Shadowknight", "tank", "Shadowknight Rotation", {
  maintain: [A("Unholy Blessing", "group buff (verify)", { duration: 300 }), A("Malice", "hate-gain buff (verify)", { duration: 300 }), A("Unending Agony", "DoT/debuff — keep on target", { duration: 24, dot: true })],
  opener: [A("Insidious Whisper", "taunt + threat to snap aggro", { recast: 8 }), A("Painbringer", "opener CA", { recast: 12 })],
  priority: [A("Insidious Whisper", "1) single taunt on cd", { recast: 8 }), A("Mortal Embrace", "2) taunt/root", { recast: 12 }), A("Death Cloud", "3) AoE taunt/CA", { recast: 15 }), A("Soulrend", "4) lifetap CA", { recast: 12 }), A("Painbringer", "5) CA", { recast: 12 }), A("Siphon Strike", "6) lifetap CA", { recast: 12 }), A("Grim Harbinger", "7) CA", { recast: 15 }), A("Cleave Flesh", "8) AoE CA", { recast: 15 })],
  aoe: [A("Death Cloud", "1) AoE taunt on cd", { recast: 15 }), A("Cleave Flesh", "2) AoE CA", { recast: 15 }), A("Pestilence", "3) AoE DoT", { recast: 30 }), A("Tap Veins", "4) AoE lifetap", { recast: 30 })],
  emergency: [A("Devouring Mist", "avoidance/defensive", { recast: 180 }), A("Unholy Hunger", "big lifetap", { recast: 60 }), A("Death March", "group protection (verify)", { recast: 300 })],
  cooldowns: [A("Harm Touch", "huge nuke", { recast: 300 }), A("Devouring Mist", "defensive burst", { recast: 180 }), A("Pestilence", "AoE burst", { recast: 45 })],
});

// ---- PRIEST HEALERS -------------------------------------------------------
// Inquisitor: real EoF ZAM names + names confirmed from the user's own Wuoshi log
// (Vengeful Faith / Convert Ally / Unholy Strike / Cleanse / Runic Armor) kept for detection.
add("Inquisitor", "healer", "Inquisitor Rotation", {
  maintain: [A("Vengeful Faith", "heal-on-attack proc buff — keep up (verify)", { duration: 30 }), A("Sacred Armor", "mitigation buff (verify)", { duration: 600 }), A("Fanatic's Faith", "group proc buff (verify)", { duration: 300 }), A("Runic Armor", "ward, if it's yours to cast (verify)", { duration: 60 })],
  healOpener: [A("Alleviation", "pre-cast the reactive heal on the tank", { recast: 8 })],
  heals: [A("Cure", "1) cure detrimentals FIRST", { recast: 10 }), A("Alleviation", "2) reactive heal — keep on tank", { recast: 12, duration: 15 }), A("Ministration", "3) fast single heal", { recast: 4 }), A("Convert Ally", "4) heal", { recast: 7 }), A("Reforming Soul", "5) big single heal", { recast: 10 }), A("Fervent Faith", "6) group heal", { recast: 12 }), A("Resolute Flagellant", "7) group cure", { recast: 20 })],
  opener: [A("Torment", "open with the DoT", { recast: 10, dot: true }), A("Invocation", "nuke", { recast: 5 })],
  dps: [A("Invocation", "1) main nuke on cd", { recast: 5 }), A("Torment", "2) DoT — keep ticking", { recast: 10, dot: true }), A("Condemn", "3) nuke", { recast: 8 }), A("Malevolent Diatribe", "4) encounter debuff/nuke", { recast: 15 }), A("Unholy Strike", "5) melee lifetap CA", { recast: 30 }), A("Cleanse", "6) divine damage filler", { recast: 6 }), A("Heretic's Doom", "7) nuke", { recast: 12 })],
  selfHeal: [A("Ministration", "self heal", { recast: 4 }), A("Convert Ally", "self heal", { recast: 7 })],
  emergency: [A("Resolute Flagellant", "group cure — panic", { recast: 20 }), A("Cure", "cure a nasty detrimental", { recast: 10 }), A("Redemption", "rez a dead ally", { recast: 300 })],
  cooldowns: [A("Fanaticism", "group DPS/haste buff", { recast: 60 }), A("Inquest", "damage burst (verify)", { recast: 45 }), A("Verdict", "big nuke", { recast: 20 }), A("Act of War", "melee burst", { recast: 30 })],
});

add("Templar", "healer", "Templar Rotation", {
  maintain: [A("Aegolism", "big stamina/HP group buff", { duration: 1800 }), A("Symbol of Marzin", "group buff (verify)", { duration: 1800 }), A("Holy Armor", "mitigation buff (verify)", { duration: 600 })],
  healOpener: [A("Vital Intercession", "pre-heal the tank", { recast: 8 })],
  heals: [A("Cure", "1) cure detrimentals FIRST", { recast: 10 }), A("Reverence", "2) reactive heal — keep on tank", { recast: 12 }), A("Vital Intercession", "3) group heal", { recast: 8 }), A("Meliorate", "4) fast single heal", { recast: 4 }), A("Restoration", "5) big single heal", { recast: 10 }), A("Focused Intervention", "6) emergency single heal", { recast: 15 })],
  opener: [A("Rebuke", "debuff/nuke", { recast: 10 }), A("Divine Smite", "nuke", { recast: 6 })],
  dps: [A("Divine Smite", "1) nuke on cd", { recast: 6 }), A("Rebuke", "2) debuff + damage", { recast: 10 }), A("Divine Strike", "3) melee CA", { recast: 12 }), A("Smite Corruption", "4) damage", { recast: 12 }), A("Unswerving Hammer", "5) nuke", { recast: 15 })],
  emergency: [A("Divine Arbitration", "equalize group HP — panic", { recast: 180 }), A("Unyielding Benediction", "prevent tank death", { recast: 300 }), A("Cure", "cure a nasty detrimental"), A("Sanctuary", "invuln a target (verify)", { recast: 300 })],
  cooldowns: [A("Divine Arbitration", "raid save", { recast: 180 }), A("Unyielding Benediction", "death prevention", { recast: 300 }), A("Glory", "group buff/burst (verify)", { recast: 120 })],
});

add("Warden", "healer", "Warden Rotation", {
  maintain: [A("Thorncoat", "damage-shield buff", { duration: 600 }), A("Armor of Seasons", "mitigation buff (verify)", { duration: 600 }), A("Regenerating Spores", "group regen — keep up", { duration: 60 })],
  healOpener: [A("Photosynthesis", "pre-cast tank HoT", { recast: 10 })],
  heals: [A("Cure", "1) cure detrimentals FIRST", { recast: 10 }), A("Healstorm", "2) group HoT — keep ticking", { recast: 12, duration: 20 }), A("Photosynthesis", "3) tank HoT", { recast: 10, duration: 20 }), A("Sylvan Bloom", "4) fast single heal", { recast: 4 }), A("Nature's Embrace", "5) big single heal", { recast: 10 }), A("Winds of Healing", "6) group heal", { recast: 12 })],
  opener: [A("Icefall", "nuke", { recast: 8 }), A("Dawnstrike", "nuke", { recast: 6 })],
  dps: [A("Dawnstrike", "1) nuke on cd", { recast: 6 }), A("Icefall", "2) nuke", { recast: 8 }), A("Frostbite", "3) DoT — keep ticking", { recast: 12, dot: true }), A("Winter's Sting", "4) nuke", { recast: 12 })],
  emergency: [A("Tunare's Watch", "prevent death — panic", { recast: 300 }), A("Nature's Renewal", "big emergency heal", { recast: 30 }), A("Cure", "cure a nasty detrimental"), A("Sandstorm", "group avoidance (verify)", { recast: 120 })],
  cooldowns: [A("Healing Grove", "big heal cooldown", { recast: 180 }), A("Tunare's Watch", "death save", { recast: 300 }), A("Nature's Pack", "group buff (verify)", { recast: 120 })],
});

add("Fury", "healer", "Fury Rotation", {
  maintain: [A("Thornskin", "damage-shield buff", { duration: 600 }), A("Armor of Nature", "mitigation buff (verify)", { duration: 600 }), A("Porcupine", "reactive damage-shield (verify)", { duration: 60 })],
  healOpener: [A("Regrowth", "pre-cast tank HoT", { recast: 10 })],
  heals: [A("Cure", "1) cure detrimentals FIRST", { recast: 10 }), A("Regrowth", "2) HoT — keep ticking", { recast: 10, duration: 20 }), A("Nature's Salve", "3) fast single heal", { recast: 4 }), A("Nature's Elixir", "4) big single heal", { recast: 10 }), A("Untamed Regeneration", "5) group heal-over-time", { recast: 15 })],
  opener: [A("Death Swarm", "DoT", { recast: 12, dot: true }), A("Tempest", "nuke", { recast: 6 })],
  dps: [A("Tempest", "1) nuke on cd", { recast: 6 }), A("Death Swarm", "2) DoT — keep ticking", { recast: 12, dot: true }), A("Thunderbolt", "3) nuke", { recast: 10 }), A("Starnova", "4) AoE nuke", { recast: 15 }), A("Ring of Fire", "5) AoE DoT", { recast: 20 })],
  aoe: [A("Starnova", "1) AoE nuke on cd", { recast: 15 }), A("Ring of Fire", "2) AoE DoT", { recast: 20 }), A("Maddening Swarm", "3) AoE DoT", { recast: 20 }), A("Call of Storms", "4) big AoE", { recast: 60 })],
  emergency: [A("Primal Fury", "burst heal/buff (verify)", { recast: 60 }), A("Cure", "cure a nasty detrimental"), A("Hibernation", "emergency (verify)", { recast: 120 })],
  cooldowns: [A("Call of the Hunt", "group DPS buff", { recast: 180 }), A("Feral Pulse", "burst", { recast: 60 }), A("Call of Storms", "big AoE nuke", { recast: 60 })],
});

add("Mystic", "healer", "Mystic Rotation", {
  maintain: [A("Runic Armor", "group ward — keep up", { duration: 60 }), A("Ancestral Ward", "reactive ward (verify)", { duration: 30 }), A("Spirit of the Mammoth", "stamina buff (verify)", { duration: 1800 })],
  healOpener: [A("Eidolic Ward", "pre-ward the tank", { recast: 8 })],
  heals: [A("Cure", "1) cure detrimentals FIRST", { recast: 10 }), A("Eidolic Ward", "2) tank ward — refresh", { recast: 8, duration: 15 }), A("Umbral Warding", "3) group ward", { recast: 12 }), A("Rejuvenation", "4) fast single heal", { recast: 4 }), A("Ritual Healing", "5) big single heal", { recast: 10 }), A("Ancestral Savior", "6) reactive save", { recast: 15 })],
  opener: [A("Plague", "DoT/debuff", { recast: 12, dot: true }), A("Velium Winds", "nuke", { recast: 8 })],
  dps: [A("Velium Winds", "1) nuke on cd", { recast: 8 }), A("Plague", "2) DoT — keep ticking", { recast: 12, dot: true }), A("Wrath of the Ancients", "3) nuke", { recast: 12 }), A("Glacial Flames", "4) nuke", { recast: 12 }), A("Haze", "5) slow/debuff on target", { recast: 15 })],
  emergency: [A("Torpor", "huge single heal + debuff", { recast: 60 }), A("Ancestral Balm", "group cure — panic", { recast: 120 }), A("Bolster", "group buff/save (verify)", { recast: 180 }), A("Cure", "cure a nasty detrimental")],
  cooldowns: [A("Oberon", "reactive group buff (verify)", { recast: 180 }), A("Torpor", "emergency heal", { recast: 60 }), A("Ancestral Avatar", "big cooldown (verify)", { recast: 300 })],
});

add("Defiler", "healer", "Defiler Rotation", {
  maintain: [A("Shroud of Armor", "mitigation buff (verify)", { duration: 600 }), A("Ancient Shroud", "reactive ward (verify)", { duration: 30 }), A("Carrion Warding", "group ward — keep up", { duration: 60 })],
  healOpener: [A("Eidolic Ward", "pre-ward the tank", { recast: 8 })],
  heals: [A("Cure", "1) cure detrimentals FIRST", { recast: 10 }), A("Eidolic Ward", "2) tank ward — refresh", { recast: 8, duration: 15 }), A("Wild Accretion", "3) group ward", { recast: 12 }), A("Dire Balm", "4) fast single heal", { recast: 4 }), A("Sacrificial Restoration", "5) big single heal", { recast: 10 }), A("Ancestral Avenger", "6) reactive save", { recast: 15 })],
  opener: [A("Putrefy", "DoT/debuff", { recast: 12, dot: true }), A("Imprecate", "nuke", { recast: 8 })],
  dps: [A("Imprecate", "1) nuke on cd", { recast: 8 }), A("Putrefy", "2) DoT — keep ticking", { recast: 12, dot: true }), A("Bane of Warding", "3) nuke/debuff", { recast: 12 }), A("Absolute Corruption", "4) big debuff/DoT", { recast: 15 }), A("Atrophy", "5) melee debuff on target", { recast: 15 })],
  emergency: [A("Spiritual Circle", "group save (verify)", { recast: 180 }), A("Maelstrom", "emergency (verify)", { recast: 120 }), A("Cure", "cure a nasty detrimental")],
  cooldowns: [A("Defile", "big cooldown (verify)", { recast: 300 }), A("Soul Cannibalize", "power/burst (verify)", { recast: 120 }), A("Maelstrom", "AoE burst", { recast: 120 })],
});

// ---- MAGES ----------------------------------------------------------------
add("Wizard", "dps", "Wizard Rotation", {
  maintain: [A("Magi's Shielding", "self damage-shield (verify)", { duration: 600 }), A("Fortify Elements", "resist buff (verify)", { duration: 600 })],
  opener: [A("Ice Comet", "biggest nuke — open with it", { recast: 30 }), A("Fusion", "huge nuke", { recast: 45 })],
  priority: [A("Ice Comet", "1) biggest nuke on cd", { recast: 30 }), A("Fusion", "2) huge nuke on cd", { recast: 45 }), A("Ice Spears", "3) nuke", { recast: 12 }), A("Incinerate", "4) nuke", { recast: 8 }), A("Solar Flare", "5) fast nuke", { recast: 5 }), A("Ro's Blade", "6) nuke", { recast: 12 }), A("Immolation", "7) DoT", { recast: 15, dot: true })],
  aoe: [A("Firestorm", "1) AoE nuke on cd", { recast: 15 }), A("Ball of Fire", "2) AoE nuke", { recast: 15 }), A("Storm of Lightning", "3) AoE DoT", { recast: 20 }), A("Fusion", "4) huge AoE", { recast: 45 })],
  burst: [A("Fusion", "1) biggest burst", { recast: 45 }), A("Ice Comet", "2) big nuke", { recast: 30 }), A("Storming Tempest", "3) burst nuke", { recast: 30 }), A("Furnace of Ro", "4) fire burst", { recast: 30 })],
  emergency: [A("Concussive", "stun/interrupt", { recast: 15 }), A("Absorb Magic", "self protection", { recast: 60 }), A("Depart", "self port out (verify)")],
  cooldowns: [A("Fusion", "biggest nuke", { recast: 45 }), A("Storming Tempest", "burst", { recast: 30 }), A("Numbing Cold", "debuff (verify)", { recast: 30 })],
});

add("Warlock", "dps", "Warlock Rotation", {
  maintain: [A("Magi's Shielding", "self damage-shield (verify)", { duration: 600 }), A("Aspect of Darkness", "damage buff (verify)", { duration: 600 })],
  opener: [A("Acid", "stack your DoT first", { recast: 15, dot: true }), A("Dark Nebula", "DoT", { recast: 15, dot: true })],
  priority: [A("Apocalypse", "1) big AoE nuke on cd", { recast: 30 }), A("Rift", "2) big AoE nuke", { recast: 30 }), A("Acid", "3) DoT — keep ticking", { recast: 15, dot: true }), A("Dark Pyre", "4) nuke", { recast: 10 }), A("Dissolve", "5) fast nuke", { recast: 5 }), A("Cataclysm", "6) AoE nuke", { recast: 12 }), A("Netherous Bind", "7) nuke/root", { recast: 12 })],
  aoe: [A("Apocalypse", "1) huge AoE on cd", { recast: 30 }), A("Rift", "2) huge AoE", { recast: 30 }), A("Cataclysm", "3) AoE nuke", { recast: 12 }), A("Dark Infestation", "4) AoE DoT", { recast: 20, dot: true })],
  burst: [A("Apocalypse", "1) biggest AoE burst", { recast: 30 }), A("Rift", "2) big AoE", { recast: 30 }), A("Netherlord", "3) damage buff/burst", { recast: 60 })],
  emergency: [A("Encase", "root the mob", { recast: 20 }), A("Absorb Magic", "self protection", { recast: 60 }), A("Absolution", "AoE control (verify)", { recast: 45 })],
  cooldowns: [A("Netherlord", "damage buff", { recast: 60 }), A("Gift of Bertoxxulous", "buff/burst (verify)", { recast: 120 }), A("Apocalypse", "big AoE", { recast: 30 })],
});

add("Conjuror", "dps", "Conjuror Rotation", {
  maintain: [A("Elemental Aspect", "pet damage buff (verify)", { duration: 1800 }), A("Aqueous Soul", "power regen (verify)", { duration: 1800 }), A("Flameshield", "self fire ward (verify)", { duration: 600 })],
  opener: [A("Fiery Annihilation", "big nuke opener", { recast: 15 }), A("Crystal Blast", "nuke", { recast: 6 })],
  priority: [A("Fiery Annihilation", "1) big nuke on cd", { recast: 15 }), A("Crystal Blast", "2) fast nuke", { recast: 6 }), A("Ice Storm", "3) nuke", { recast: 10 }), A("Fire Seed", "4) DoT/nuke", { recast: 12 }), A("Shattered Earth", "5) AoE nuke", { recast: 15 }), A("Roaring Flames", "6) nuke", { recast: 12 })],
  aoe: [A("Shattered Earth", "1) AoE nuke on cd", { recast: 15 }), A("Earthquake", "2) AoE nuke", { recast: 20 }), A("Roaring Flames", "3) AoE nuke", { recast: 12 })],
  burst: [A("Blazing Avatar", "1) pet burst buff", { recast: 300 }), A("Fiery Annihilation", "2) big nuke", { recast: 15 }), A("Elemental Unity", "3) burst (verify)", { recast: 180 })],
  emergency: [A("Stoneskin", "self stoneskin", { recast: 60 }), A("Master's Intervention", "pull aggro off yourself (verify)", { recast: 60 }), A("Call of The Hero", "yank an ally to you")],
  cooldowns: [A("Blazing Avatar", "pet burst", { recast: 300 }), A("Elemental Unity", "burst window (verify)", { recast: 180 }), A("Plane Shift", "reset/utility (verify)", { recast: 300 })],
});

add("Necromancer", "dps", "Necromancer Rotation", {
  maintain: [A("Unholy Covenant", "group ward/buff (verify)", { duration: 300 }), A("Lich", "power->health drain — keep on", { duration: 1800 }), A("Grisly Protection", "self ward (verify)", { duration: 600 })],
  opener: [A("Pandemic", "stack your DoTs first", { recast: 18, dot: true }), A("Soulrot", "DoT", { recast: 15, dot: true })],
  priority: [A("Pandemic", "1) DoT — keep ticking", { recast: 18, dot: true }), A("Soulrot", "2) DoT — keep ticking", { recast: 15, dot: true }), A("Bloodcoil", "3) nuke", { recast: 10 }), A("Chains of Torment", "4) DoT", { recast: 12, dot: true }), A("Bloodcloud", "5) nuke", { recast: 8 }), A("Lifetap", "6) tap nuke", { recast: 10 })],
  aoe: [A("Blighted Horde", "1) AoE DoT on cd", { recast: 20, dot: true }), A("Undead Horde", "2) AoE nuke", { recast: 30 }), A("Consumption", "3) AoE DoT", { recast: 20, dot: true })],
  burst: [A("Lich", "1) DPS mode on", { recast: 60 }), A("Awaken Grave", "2) burst pet/nuke (verify)", { recast: 120 }), A("Undead Horde", "3) AoE burst", { recast: 30 })],
  emergency: [A("Fear", "fear the mob", { recast: 20 }), A("Grasping Bones", "root", { recast: 15 }), A("Dooming Darkness", "snare/DoT", { recast: 15, dot: true })],
  cooldowns: [A("Awaken Grave", "burst (verify)", { recast: 120 }), A("Siphoning of Souls", "power/tap (verify)", { recast: 120 }), A("Undead Horde", "AoE burst", { recast: 30 })],
});

add("Illusionist", "dps", "Illusionist Rotation", {
  maintain: [A("Rune of Thought", "group power regen — keep up", { duration: 1800 }), A("Mana Cloak", "power proc buff (verify)", { duration: 300 }), A("Synergism", "group buff (verify)", { duration: 300 })],
  opener: [A("Nightmare", "DoT/debuff", { recast: 12, dot: true }), A("Ultraviolet Beam", "nuke", { recast: 10 })],
  priority: [A("Ultraviolet Beam", "1) nuke on cd", { recast: 10 }), A("Brainburst", "2) big nuke", { recast: 12 }), A("Aneurysm", "3) nuke", { recast: 10 }), A("Nightmare", "4) DoT — keep ticking", { recast: 12, dot: true }), A("Prismatic Chaos", "5) AoE nuke", { recast: 15 })],
  aoe: [A("Prismatic Chaos", "1) AoE nuke on cd", { recast: 15 }), A("Chromatic Shower", "2) AoE nuke", { recast: 20 })],
  burst: [A("Savante", "1) huge damage burst", { recast: 300 }), A("Illusory Allies", "2) summon damage adds", { recast: 180 }), A("Brainburst", "3) big nuke", { recast: 12 })],
  emergency: [A("Entrance", "mez a loose add", { recast: 12 }), A("Speechless", "stifle a caster", { recast: 20 }), A("Dismay", "AoE stun/mez", { recast: 30 })],
  cooldowns: [A("Savante", "biggest burst", { recast: 300 }), A("Illusory Allies", "damage adds", { recast: 180 }), A("Phase", "reset/utility (verify)", { recast: 300 })],
});

add("Coercer", "dps", "Coercer Rotation", {
  maintain: [A("Signet of Intellect", "group power regen — keep up", { duration: 1800 }), A("Mana Cloak", "power proc buff (verify)", { duration: 300 }), A("Channel", "group power feed (verify)", { duration: 300 })],
  opener: [A("Brainshock", "debuff/nuke", { recast: 12 }), A("Hemorrhage", "nuke", { recast: 8 })],
  priority: [A("Hemorrhage", "1) nuke on cd", { recast: 8 }), A("Brainshock", "2) nuke/debuff", { recast: 12 }), A("Ego Shock", "3) nuke + stun", { recast: 12 }), A("Destructive Mind", "4) nuke", { recast: 12 }), A("Spell Curse", "5) debuff/DoT", { recast: 15, dot: true })],
  aoe: [A("Shock Wave", "1) AoE nuke on cd", { recast: 20 }), A("Destructive Mind", "2) nuke", { recast: 12 })],
  burst: [A("Possess Essence", "1) charm a mob as a pet", { recast: 180 }), A("Shock Wave", "2) AoE nuke", { recast: 20 }), A("Mindbend", "3) burst (verify)", { recast: 60 })],
  emergency: [A("Mesmerize", "mez a loose add", { recast: 12 }), A("Silence", "stifle a caster", { recast: 20 }), A("Forced Hesitation", "AoE stun", { recast: 30 })],
  cooldowns: [A("Possess Essence", "charm pet", { recast: 180 }), A("Cannibalize Thoughts", "power to group (verify)", { recast: 120 }), A("Amnesia", "hate wipe (verify)", { recast: 120 })],
});

// ---- SCOUTS ---------------------------------------------------------------
add("Ranger", "dps", "Ranger Rotation", {
  maintain: [A("Hunter's Instinct", "group ranged buff — keep up", { duration: 1800 }), A("Archer's Fury", "damage buff (verify)", { duration: 300 })],
  opener: [A("Sniper Shot", "open from stealth — huge hit", { recast: 60 }), A("Hidden Shot", "stealth attack", { recast: 30 })],
  priority: [A("Sniper Shot", "1) biggest shot on cd", { recast: 60 }), A("Miracle Shot", "2) big shot", { recast: 30 }), A("Trick Shot", "3) shot", { recast: 15 }), A("Triple Shot", "4) shot", { recast: 15 }), A("Lightning Strike", "5) shot", { recast: 12 }), A("Searing Shot", "6) shot/DoT", { recast: 12 }), A("Snipe", "7) shot", { recast: 10 })],
  aoe: [A("Storm of Arrows", "1) AoE on cd", { recast: 30 }), A("Stream of Arrows", "2) AoE channel", { recast: 30 }), A("Arrow Rip", "3) AoE shot", { recast: 20 })],
  burst: [A("Focus Aim", "1) accuracy/crit burst", { recast: 60 }), A("Sniper Shot", "2) biggest shot", { recast: 60 }), A("Killing Instinct", "3) DPS buff", { recast: 120 })],
  emergency: [A("Evade", "drop hate", { recast: 30 }), A("Escape", "vanish", { recast: 60 }), A("Ensnare", "snare/kite")],
  cooldowns: [A("Killing Instinct", "big DPS buff", { recast: 120 }), A("Storm of Arrows", "AoE burst", { recast: 30 }), A("Focus Aim", "crit window", { recast: 60 })],
});

add("Assassin", "dps", "Assassin Rotation", {
  maintain: [A("Honed Reflexes", "haste/DPS buff (verify)", { duration: 300 }), A("Death Mark", "debuff — keep on target", { duration: 30 })],
  opener: [A("Assassinate", "open from stealth — can one-shot", { recast: 60 }), A("Massacre", "stealth attack", { recast: 30 })],
  priority: [A("Assassinate", "1) from stealth on cd", { recast: 60 }), A("Mortal Blade", "2) big CA", { recast: 30 }), A("Eviscerate", "3) CA", { recast: 15 }), A("Impale", "4) CA", { recast: 12 }), A("Gushing Wound", "5) DoT — keep ticking", { recast: 15, dot: true }), A("Quick Strike", "6) fast CA", { recast: 8 }), A("Jugular Slice", "7) CA", { recast: 12 })],
  aoe: [A("Whirling Blades", "1) AoE CA on cd", { recast: 20 }), A("Exacting", "2) AoE CA", { recast: 20 })],
  burst: [A("Deadly Focus", "1) crit/DPS burst", { recast: 60 }), A("Assassinate", "2) huge hit", { recast: 60 }), A("Death Blow", "3) execute", { recast: 30 })],
  emergency: [A("Evade", "drop hate", { recast: 30 }), A("Escape", "vanish", { recast: 60 }), A("Cheap Shot", "stun")],
  cooldowns: [A("Deadly Focus", "crit window", { recast: 60 }), A("Death Blow", "execute", { recast: 30 }), A("Apply Poison", "refresh poisons")],
});

add("Brigand", "dps", "Brigand Rotation", {
  maintain: [A("Debilitate", "big defense debuff — keep on target", { duration: 30 }), A("Ruthless Cunning", "group buff (verify)", { duration: 300 }), A("Blackguard", "self buff (verify)", { duration: 300 })],
  opener: [A("Backstab", "open from stealth (behind mob)", { recast: 15 }), A("Puncture", "positional CA", { recast: 12 })],
  priority: [A("Debilitate", "1) keep the defense debuff up", { recast: 30 }), A("Battery and Assault", "2) big CA", { recast: 20 }), A("Barroom Negotiation", "3) CA", { recast: 15 }), A("Gouge", "4) CA", { recast: 12 }), A("Backstab", "5) positional CA", { recast: 15 }), A("Shank", "6) CA", { recast: 12 }), A("Puncture", "7) CA", { recast: 12 })],
  aoe: [A("Double Blast", "1) AoE CA on cd", { recast: 20 }), A("Barroom Negotiation", "2) AoE CA", { recast: 15 }), A("Entangle", "3) AoE root", { recast: 20 })],
  burst: [A("Dispatch", "1) big burst CA", { recast: 45 }), A("Deceit", "2) burst (verify)", { recast: 60 }), A("Double Up", "3) extra CA (verify)", { recast: 30 })],
  emergency: [A("Evade", "drop hate", { recast: 30 }), A("Escape", "vanish", { recast: 60 }), A("Beg for Mercy", "big hate drop"), A("Cheap Shot", "stun")],
  cooldowns: [A("Dispatch", "big CA", { recast: 45 }), A("Band of Thugs", "summon damage adds (verify)", { recast: 180 }), A("Deceit", "burst", { recast: 60 })],
});

add("Swashbuckler", "dps", "Swashbuckler Rotation", {
  maintain: [A("Fancy Footwork", "avoidance/riposte buff (verify)", { duration: 300 }), A("Ruthless Cunning", "group buff (verify)", { duration: 300 }), A("Swarthy Deception", "self buff (verify)", { duration: 300 })],
  opener: [A("Viscerate", "open from stealth (behind mob)", { recast: 15 }), A("Kidney Stab", "positional CA", { recast: 12 })],
  priority: [A("Flash of Steel", "1) AoE CA on cd", { recast: 15 }), A("Bladeweaver", "2) CA", { recast: 15 }), A("Razor Edge", "3) CA", { recast: 12 }), A("Flurry of Blades", "4) CA", { recast: 15 }), A("Viscerate", "5) positional CA", { recast: 15 }), A("Devious Blade", "6) CA", { recast: 12 }), A("Lung Puncture", "7) CA", { recast: 12 })],
  aoe: [A("Flash of Steel", "1) AoE CA on cd", { recast: 15 }), A("Storm of Steel", "2) big AoE", { recast: 30 }), A("Dashing Swathe", "3) AoE CA", { recast: 20 })],
  burst: [A("Inspired Daring", "1) DPS burst", { recast: 60 }), A("Hurricane", "2) AoE burst", { recast: 45 }), A("Flamboyant Strike", "3) big CA", { recast: 30 })],
  emergency: [A("Evade", "drop hate", { recast: 30 }), A("Escape", "vanish", { recast: 60 }), A("Hamstring", "snare"), A("Cheap Shot", "stun")],
  cooldowns: [A("Inspired Daring", "DPS burst", { recast: 60 }), A("Storm of Steel", "AoE burst", { recast: 30 }), A("Hurricane", "AoE", { recast: 45 })],
});

// ---- BARDS ----------------------------------------------------------------
add("Troubador", "bard", "Troubador Rotation", {
  maintain: [A("Aria of Magic", "group spell-damage song — keep up", { duration: 60 }), A("Arcane Symphony", "group buff song (verify)", { duration: 60 }), A("Dancing Blade", "group melee buff (verify)", { duration: 60 }), A("Bria's Inspiring Ballad", "group power song", { duration: 60 })],
  utility: [A("Aria of Magic", "1) keep the damage song up", { recast: 15, duration: 60 }), A("Bria's Inspiring Ballad", "2) group power", { recast: 15, duration: 60 }), A("Jester's Cap", "3) big group DPS/power burst", { recast: 300 }), A("Zander's Choral Rebuff", "4) group resist debuff", { recast: 20 }), A("Requiem of Reflection", "5) group reflect (verify)", { recast: 60 })],
  opener: [A("Night Strike", "positional CA opener", { recast: 15 }), A("Perfect Shrill", "AoE nuke", { recast: 12 })],
  priority: [A("Sandra's Deafening Strike", "1) big CA on cd", { recast: 15 }), A("Night Strike", "2) positional CA", { recast: 15 }), A("Perfect Shrill", "3) AoE nuke", { recast: 12 }), A("Painful Lamentations", "4) DoT — keep ticking", { recast: 15, dot: true }), A("Singing Shot", "5) ranged CA", { recast: 12 }), A("Thunderous Overture", "6) nuke", { recast: 15 })],
  emergency: [A("Evade", "drop hate", { recast: 30 }), A("Escape", "vanish", { recast: 60 }), A("Lullaby", "AoE mez")],
  cooldowns: [A("Jester's Cap", "group DPS/power burst", { recast: 300 }), A("Perfection of the Maestro", "group buff burst (verify)", { recast: 180 }), A("Elemental Concerto", "damage burst (verify)", { recast: 120 })],
});

add("Dirge", "bard", "Dirge Rotation", {
  maintain: [A("Riana's Relentless Tune", "group melee-damage song — keep up", { duration: 60 }), A("Daro's Dull Blade", "mob damage debuff (verify)", { duration: 30 }), A("Noxious Symphony", "group buff song (verify)", { duration: 60 }), A("Bria's Inspiring Ballad", "group power song", { duration: 60 })],
  utility: [A("Riana's Relentless Tune", "1) keep the melee song up", { recast: 15, duration: 60 }), A("Bria's Inspiring Ballad", "2) group power", { recast: 15, duration: 60 }), A("Oration of Sacrifice", "3) big group survival burst", { recast: 300 }), A("Jael's Dreadful Deprivation", "4) group resist debuff", { recast: 20 }), A("Dead Calm", "5) group aggro/threat (verify)", { recast: 60 })],
  opener: [A("Thuri's Doleful Thrust", "positional CA opener", { recast: 15 }), A("Misfortune's Kiss", "CA", { recast: 12 })],
  priority: [A("Thuri's Doleful Thrust", "1) positional CA on cd", { recast: 15 }), A("Misfortune's Kiss", "2) CA", { recast: 12 }), A("Luda's Nefarious Wail", "3) AoE nuke", { recast: 12 }), A("Jarol's Sorrowful Requiem", "4) DoT — keep ticking", { recast: 15, dot: true }), A("Lanet's Excruciating Scream", "5) nuke", { recast: 12 }), A("Garsin's Funeral March", "6) nuke", { recast: 15 })],
  emergency: [A("Evade", "drop hate", { recast: 30 }), A("Escape", "vanish", { recast: 60 }), A("Howl of Death", "group death save (verify)", { recast: 300 })],
  cooldowns: [A("Oration of Sacrifice", "group survival burst", { recast: 300 }), A("Elegy at Death's Door", "group DPS song (verify)", { recast: 180 }), A("Wail of the Banshee", "AoE nuke burst", { recast: 120 })],
});

// ---- emit -----------------------------------------------------------------
let n = 0;
for (const [cls, arch, title, s] of SPECS) {
  const out = classFile(cls, arch, title, s);
  const file = join(DATA, `${cls.toLowerCase()}.json`);
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n", "utf8");
  n++;
  console.log(`wrote data/${cls.toLowerCase()}.json  (${arch})`);
}
console.log(`\n${n} class files written.`);
