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
    { label: "Emergency period 1", opens: "2026-08-25", closes: "2026-11-05" },
    { label: "Emergency period 2", opens: "2026-12-02", closes: "2027-02-04" }
  ],
  transfersPerWindow: 3,
  emergencyTransfersTotal: 1,
  weekRunsFridayToThursday: true,
  seasonKickOff: "2026-08-21",
  entryDeadline: "2026-08-16"
};

window.DT_RULES_TEXT = [
  "Pick 11 players within an " + "\u00a3" + "80m budget, maximum 3 players from any one club.",
  "Formations allowed: 4-4-2, 4-3-3, 4-5-1, 3-4-3, 3-5-2, 5-4-1, 5-3-2 \u2014 always exactly 1 goalkeeper. No others accepted.",
  "Prices are fixed for the season from the starting price list and never change.",
  "If a player transfers clubs during the season and that pushes your squad over 3 players from one club, that is allowed to stand \u2014 but you cannot then use a transfer window to swap in another player from that same club while you are over the limit.",
  "Two transfer windows during the season, each open 10 days, up to 3 player changes per window.",
  "One Emergency Transfer for the whole season, usable only in the two emergency periods, not available during a transfer window or after kick-off of any match that day. It takes effect from the start of the following gameweek, not immediately.",
  "Scoring is now based on the official Premier League Fantasy game's system rather than a ratings-based one \u2014 new for 2026/27.",
  "All players: appearance 60+ mins +2 (excluding stoppage time), under 60 mins +1, yellow card -1, red card -3, own goal -2, a missed or saved penalty for the taker -2.",
  "Defenders and goalkeepers: +2 for 10 or more combined clearances, blocks, interceptions and tackles in a match.",
  "Midfielders and forwards: +2 for 12 or more combined clearances, blocks, interceptions, tackles and recoveries in a match.",
  "Goals: goalkeeper +10, defender +6, midfielder +5, forward +4. Assists: +3 for any position.",
  "Clean sheets (no goals conceded): goalkeeper and defender +4, midfielder +1, forward none.",
  "Goalkeepers and defenders lose 1 point for each goal conceded after the first in a match.",
  "Goalkeepers: +5 for a penalty save, +1 for every 3 shots saved.",
  "Bonus points: top 3 performers in each match (by the official BPS system) get +3, +2 and +1.",
  "A scoring week runs Friday to Thursday. Highest scoring team that week wins the weekly cash prize.",
  "Top five teams at end of season win cash prizes, plus a wooden spoon prize for last place.",
  "Christmas week (w/e 31 Dec 2026) and New Year week (w/e 7 Jan 2027) weekly prizes are doubled.",
  "New this season: a 20-team sweepstake for correctly picking the Premier League champions, running for every complete block of 20 teams entered, up to 5 sweepstakes (100 teams) \u2014 each winner gets " + "\u00a3" + "100.",
  "New this season: a " + "\u00a3" + "50 draw for each position (goalkeeper, defender, midfielder, forward) among teams whose highest-scoring player in that position for the season is still in their squad at the end of the season.",
  "Entry fee is " + "\u00a3" + "80, payable in full, as " + "\u00a3" + "40 + " + "\u00a3" + "40 before the end of Transfer Window 1, or as four " + "\u00a3" + "20 instalments.",
  "Season kicks off Friday 21st August 2026. Team entries and any changes must be in before midnight Sunday 16th August 2026."
];
