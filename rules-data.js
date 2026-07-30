window.DT_CONFIG = {
  seasonLabel: "2026/27",
  budgetCap: 80,
  squadSize: 11,
  maxPerClub: 3,
  entryFee: 80,
  formations: ["4-4-2", "4-3-3", "4-5-1", "3-4-3", "3-5-2", "5-4-1", "5-3-2"],
  formationShape: {
    "4-4-2": { DEF: 4, MID: 4, FWD: 2 },
    "4-3-3": { DEF: 4, MID: 3, FWD: 3 },
    "4-5-1": { DEF: 4, MID: 5, FWD: 1 },
    "3-4-3": { DEF: 3, MID: 4, FWD: 3 },
    "3-5-2": { DEF: 3, MID: 5, FWD: 2 },
    "5-4-1": { DEF: 5, MID: 4, FWD: 1 },
    "5-3-2": { DEF: 5, MID: 3, FWD: 2 }
  },
  transferWindows: [
    { label: "Window 1", opens: "2026-11-10", closes: "2026-11-19", activeFrom: "2026-11-20" },
    { label: "Window 2", opens: "2027-02-09", closes: "2027-02-18", activeFrom: "2027-02-19" }
  ],
  emergencyWindows: [
    { label: "Emergency period 1", opens: "2026-08-18", closes: "2026-10-29" },
    { label: "Emergency period 2", opens: "2026-11-24", closes: "2027-01-28" }
  ],
  transfersPerWindow: 3,
  emergencyTransfersTotal: 1,
  weekRunsFridayToThursday: true
};

window.DT_RULES_TEXT = [
  "Pick 11 players within a " + "\u00a3" + "80m budget, maximum 3 players from any one club.",
  "Formations allowed: 4-4-2, 4-3-3, 4-5-1, 3-4-3, 3-5-2, 5-4-1, 5-3-2 \u2014 always exactly 1 goalkeeper. No others accepted.",
  "Prices are fixed for the season from the starting price list and never change.",
  "If a player transfers clubs during the season and that pushes your squad over 2 players from one club, that is allowed to stand \u2014 but you cannot then use a transfer window to swap in another player from that same club while you are over the limit.",
  "Two transfer windows during the season, each open 10 days, up to 3 player changes per window.",
  "One Emergency Transfer for the whole season, usable only in the two emergency periods, not available during a transfer window or after kick-off of any match that day.",
  "Scoring: appearance 60+ mins +2, under 60 mins +1, goal +5, hat-trick (3+ goals in a match) additional +5, assist +2, big chance created +1, shot on target +1, every 2 successful tackles +1, yellow card -1, red card -5, own goal -5.",
  "Midfielders: clean sheet +2, no deduction for goals conceded.",
  "Defenders and goalkeepers: clean sheet +5, -1 point for 2 goals conceded and -1 for every goal conceded after that.",
  "Goalkeepers: penalty save +5. Nominated penalty takers: miss or have a penalty saved -5.",
  "Bonus points: top 3 performers in each match get +3, +2 and +1.",
  "A scoring week runs Friday to Thursday. Highest scoring team that week wins the weekly cash prize.",
  "Top five teams at end of season win cash prizes, plus a wooden spoon prize for last place.",
  "Christmas week and New Year week weekly prizes are doubled."
];
