/* Grzegorz Lutecki Dream Team - main app */

var CFG = window.DT_CONFIG;
var ALL_PLAYERS = window.DT_PLAYERS;
var ALL_CLUBS = window.DT_CLUBS;

var PLAYERS_BY_ID = {};
for (var pbi = 0; pbi < ALL_PLAYERS.length; pbi++) {
  PLAYERS_BY_ID[ALL_PLAYERS[pbi].id] = ALL_PLAYERS[pbi];
}
var STATIC_PLAYER_COUNT = ALL_PLAYERS.length;

function fmtMoney(n) {
  var v = Math.round(n * 10) / 10;
  return "\u00a3" + v.toFixed(1) + "m";
}

function computeScore(stat, pos) {
  if (!stat) return 0;
  var mins = stat.mins || 0;
  if (mins <= 0) return 0;
  var pts = 0;
  if (mins >= 60) pts += 2;
  else pts += 1;

  pts += (stat.assists || 0) * 3;
  pts -= (stat.ownGoals || 0) * 2;
  pts -= (stat.yellow || 0) * 1;
  if (stat.red) pts -= 3;
  pts -= (stat.penMissTaker || 0) * 2;

  var cbit = stat.cbit || 0;
  if (pos === "GK" || pos === "DEF") {
    if (cbit >= 10) pts += 2;
  } else if (pos === "MID" || pos === "FWD") {
    if (cbit >= 12) pts += 2;
  }

  var goals = stat.goals || 0;
  if (pos === "GK") pts += goals * 10;
  else if (pos === "DEF") pts += goals * 6;
  else if (pos === "MID") pts += goals * 5;
  else if (pos === "FWD") pts += goals * 4;

  var gc = stat.goalsConceded || 0;
  var cleanSheet = gc === 0;
  if (pos === "GK" || pos === "DEF") {
    if (cleanSheet) pts += 4;
    pts -= Math.max(0, gc - 1);
  } else if (pos === "MID") {
    if (cleanSheet) pts += 1;
  }

  if (pos === "GK") {
    pts += (stat.penSaveGK || 0) * 5;
    pts += Math.floor((stat.saves || 0) / 3) * 1;
  }

  pts += (stat.bonus || 0);
  return pts;
}

function scoreBreakdown(stat, pos) {
  var lines = [];
  var total = 0;
  function add(label, val) {
    if (val !== 0) { lines.push({ label: label, pts: val }); total += val; }
  }
  if (!stat) return { lines: [{ label: "No stats recorded for this gameweek", pts: 0 }], total: 0 };
  var mins = stat.mins || 0;
  if (mins <= 0) return { lines: [{ label: "Did not play", pts: 0 }], total: 0 };

  if (mins >= 60) add("Appearance (60+ mins)", 2);
  else add("Appearance (under 60 mins)", 1);

  if (stat.assists) add("Assists (\u00d7" + stat.assists + ")", stat.assists * 3);
  if (stat.ownGoals) add("Own goals (\u00d7" + stat.ownGoals + ")", -stat.ownGoals * 2);
  if (stat.yellow) add("Yellow cards (\u00d7" + stat.yellow + ")", -stat.yellow * 1);
  if (stat.red) add("Red card", -3);
  if (stat.penMissTaker) add("Penalty missed/saved (\u00d7" + stat.penMissTaker + ")", -stat.penMissTaker * 2);

  var cbit = stat.cbit || 0;
  if (pos === "GK" || pos === "DEF") {
    if (cbit >= 10) add("Defensive contribution (" + cbit + " CBIT)", 2);
  } else if (pos === "MID" || pos === "FWD") {
    if (cbit >= 12) add("Defensive contribution (" + cbit + " CBIRT)", 2);
  }

  var goals = stat.goals || 0;
  if (goals) {
    var perGoal = pos === "GK" ? 10 : pos === "DEF" ? 6 : pos === "MID" ? 5 : 4;
    add("Goals (\u00d7" + goals + ")", goals * perGoal);
  }

  var gc = stat.goalsConceded || 0;
  var cleanSheet = gc === 0;
  if (pos === "GK" || pos === "DEF") {
    if (cleanSheet) add("Clean sheet", 4);
    var conc = Math.max(0, gc - 1);
    if (conc) add("Goals conceded (" + gc + ")", -conc);
  } else if (pos === "MID") {
    if (cleanSheet) add("Clean sheet", 1);
  }

  if (pos === "GK") {
    if (stat.penSaveGK) add("Penalty save (\u00d7" + stat.penSaveGK + ")", stat.penSaveGK * 5);
    var saveBonus = Math.floor((stat.saves || 0) / 3);
    if (saveBonus) add("Shot saves (" + (stat.saves || 0) + ")", saveBonus);
  }

  if (stat.bonus) add("Bonus points", stat.bonus);

  return { lines: lines, total: total };
}

function formationCounts(playerIds) {
  var counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (var i = 0; i < playerIds.length; i++) {
    var pl = PLAYERS_BY_ID[playerIds[i]];
    if (pl) counts[pl.pos] = (counts[pl.pos] || 0) + 1;
  }
  return counts;
}

function matchesFormation(counts) {
  var shapes = CFG.formationShape;
  for (var key in shapes) {
    var s = shapes[key];
    if (counts.GK === 1 && counts.DEF === s.DEF && counts.MID === s.MID && counts.FWD === s.FWD) {
      return key;
    }
  }
  return null;
}

function reachableFormations(counts) {
  var out = [];
  for (var i = 0; i < CFG.formations.length; i++) {
    var f = CFG.formations[i];
    var shape = CFG.formationShape[f];
    if (counts.GK <= 1 && counts.DEF <= shape.DEF && counts.MID <= shape.MID && counts.FWD <= shape.FWD) {
      out.push(f);
    }
  }
  return out;
}

function canAddPos(counts, pos) {
  if (pos === "GK") return counts.GK < 1;
  var newCounts = { GK: counts.GK, DEF: counts.DEF, MID: counts.MID, FWD: counts.FWD };
  newCounts[pos] = newCounts[pos] + 1;
  return reachableFormations(newCounts).length > 0;
}

function pickDisplayFormation(counts, preferred, lastDisplay) {
  var reach = reachableFormations(counts);
  if (reach.length === 0) return lastDisplay || CFG.formations[0];
  if (preferred && reach.indexOf(preferred) >= 0) return preferred;
  if (lastDisplay && reach.indexOf(lastDisplay) >= 0) return lastDisplay;
  return reach[0];
}

function clubCounts(playerIds) {
  var counts = {};
  for (var i = 0; i < playerIds.length; i++) {
    var pl = PLAYERS_BY_ID[playerIds[i]];
    if (!pl) continue;
    counts[pl.club] = (counts[pl.club] || 0) + 1;
  }
  return counts;
}

function squadCost(playerIds) {
  var total = 0;
  for (var i = 0; i < playerIds.length; i++) {
    var pl = PLAYERS_BY_ID[playerIds[i]];
    if (pl) total += pl.price;
  }
  return Math.round(total * 10) / 10;
}

function playerPointsMaps(gwstatsAll) {
  var totals = {};
  var byGw = {};
  var gwIds = Object.keys(gwstatsAll || {});
  var gwNums = [];
  for (var gi = 0; gi < gwIds.length; gi++) {
    var n = parseInt(gwIds[gi].replace("gw", ""), 10);
    if (!isNaN(n)) gwNums.push(n);
    var statsForGw = gwstatsAll[gwIds[gi]];
    var pids = Object.keys(statsForGw || {});
    for (var pi = 0; pi < pids.length; pi++) {
      var pl = PLAYERS_BY_ID[pids[pi]];
      if (!pl) continue;
      var sc = computeScore(statsForGw[pids[pi]], pl.pos);
      totals[pids[pi]] = (totals[pids[pi]] || 0) + sc;
      if (!byGw[n]) byGw[n] = {};
      byGw[n][pids[pi]] = sc;
    }
  }
  gwNums.sort(function (a, b) { return b - a; });
  var last3Gws = gwNums.slice(0, 3);
  var last3 = {};
  for (var l = 0; l < last3Gws.length; l++) {
    var gwScores = byGw[last3Gws[l]] || {};
    for (var pid in gwScores) {
      last3[pid] = (last3[pid] || 0) + gwScores[pid];
    }
  }
  return { totals: totals, last3: last3, gwNums: gwNums };
}

function dtSaveLogin(teamId) {
  try { window.localStorage.setItem("dt_team_id", teamId); } catch (e) { }
}
function dtLoadLogin() {
  try { return window.localStorage.getItem("dt_team_id"); } catch (e) { return null; }
}
function dtClearLogin() {
  try { window.localStorage.removeItem("dt_team_id"); } catch (e) { }
}

function dtSaveAdmin() {
  try { window.localStorage.setItem("dt_admin_ok", "1"); } catch (e) { }
}
function dtLoadAdmin() {
  try { return window.localStorage.getItem("dt_admin_ok") === "1"; } catch (e) { return false; }
}
function dtClearAdmin() {
  try { window.localStorage.removeItem("dt_admin_ok"); } catch (e) { }
}

function effectiveSquad(team, gwNum) {
  var ids = (team.playerIds || []).slice();
  var pend = team.pendingEmergency;
  if (pend && gwNum >= pend.effectiveGw) {
    var idx = ids.indexOf(pend.outId);
    if (idx >= 0) {
      ids = ids.slice(0, idx).concat([pend.inId]).concat(ids.slice(idx + 1));
    }
  }
  return ids;
}

function csvEscape(val) {
  var s = (val === null || val === undefined) ? "" : String(val);
  if (s.indexOf(",") >= 0 || s.indexOf("\"") >= 0 || s.indexOf("\n") >= 0) {
    s = "\"" + s.replace(/"/g, "\"\"") + "\"";
  }
  return s;
}

function nowMs() { return Date.now(); }

function dateInRange(now, openStr, closeStr) {
  if (!openStr || !closeStr) return false;
  var open = new Date(openStr + "T00:00:00").getTime();
  var close = new Date(closeStr + "T23:59:59").getTime();
  return now >= open && now <= close;
}

function activeWindowIndex(windows, now) {
  if (!windows) return -1;
  for (var i = 0; i < windows.length; i++) {
    if (dateInRange(now, windows[i].opens, windows[i].closes)) return i;
  }
  return -1;
}

function inAnyPeriod(periods, now) {
  if (!periods) return false;
  for (var i = 0; i < periods.length; i++) {
    if (dateInRange(now, periods[i].opens, periods[i].closes)) return true;
  }
  return false;
}

function normName(s) {
  if (!s) return "";
  return s.toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findSofaEventForMatch(dayEvents, homeName, awayName) {
  var targetHome = normName(homeName);
  var targetAway = normName(awayName);
  var list = (dayEvents && dayEvents.events) || [];
  for (var i = 0; i < list.length; i++) {
    var ev = list[i];
    var tourName = ev.tournament && ev.tournament.name ? normName(ev.tournament.name) : "";
    var uniqueTourName = ev.tournament && ev.tournament.uniqueTournament && ev.tournament.uniqueTournament.name ? normName(ev.tournament.uniqueTournament.name) : "";
    var isPL = tourName.indexOf("premier league") >= 0 || uniqueTourName.indexOf("premier league") >= 0;
    if (!isPL) continue;
    var evHome = ev.homeTeam ? normName(ev.homeTeam.name) : "";
    var evAway = ev.awayTeam ? normName(ev.awayTeam.name) : "";
    var homeMatch = evHome === targetHome || evHome.indexOf(targetHome) >= 0 || targetHome.indexOf(evHome) >= 0;
    var awayMatch = evAway === targetAway || evAway.indexOf(targetAway) >= 0 || targetAway.indexOf(evAway) >= 0;
    if (homeMatch && awayMatch) return ev;
  }
  return null;
}

function statNum(statistics, keys) {
  for (var i = 0; i < keys.length; i++) {
    if (statistics && statistics[keys[i]] !== undefined && statistics[keys[i]] !== null) return statistics[keys[i]];
  }
  return 0;
}

function mapSofaLineupsToUpdates(lineupData, homeConceded, awayConceded, homeTeamName, awayTeamName) {
  var updates = {};
  var matchedCount = 0;
  var unmatchedNames = [];
  var sides = [
    { block: lineupData && lineupData.home, conceded: homeConceded, teamName: homeTeamName },
    { block: lineupData && lineupData.away, conceded: awayConceded, teamName: awayTeamName }
  ];
  for (var s = 0; s < sides.length; s++) {
    var players = (sides[s].block && sides[s].block.players) || [];
    var conceded = sides[s].conceded;
    var teamName = sides[s].teamName;
    for (var pi = 0; pi < players.length; pi++) {
      var entry = players[pi];
      var pname = entry.player ? entry.player.name : "";
      var stat = entry.statistics || {};
      var localP = findLocalPlayerMatch(pname, teamName);
      if (!localP) { unmatchedNames.push(pname + " (" + teamName + ")"); continue; }
      matchedCount++;
      var mins = statNum(stat, ["minutesPlayed"]);
      var goals = statNum(stat, ["goals"]);
      var assists = statNum(stat, ["goalAssist"]);
      var yellow = statNum(stat, ["yellowCard"]);
      var red = !!statNum(stat, ["redCard", "redYellowCard"]);
      var ownGoals = statNum(stat, ["ownGoals"]);
      var penSaveGK = statNum(stat, ["penaltySave"]);
      var penMissTaker = statNum(stat, ["penaltyMiss"]);
      var saves = statNum(stat, ["saves", "totalSaves"]);
      var clearances = statNum(stat, ["totalClearance", "clearanceOffLine"]);
      var blocks = statNum(stat, ["blockedScoringAttempt", "outfielderBlock"]);
      var interceptions = statNum(stat, ["interceptionWon", "totalInterception"]);
      var tackles = statNum(stat, ["totalTackle", "tackle"]);
      var recoveries = (localP.pos === "MID" || localP.pos === "FWD") ? statNum(stat, ["ballRecovery", "possessionWonAttThird"]) : 0;
      var cbit = clearances + blocks + interceptions + tackles + recoveries;
      updates[localP.id] = {
        mins: mins, goals: goals, assists: assists, yellow: yellow, red: red, ownGoals: ownGoals,
        cbit: cbit, saves: saves,
        penSaveGK: penSaveGK, penMissTaker: penMissTaker,
        goalsConceded: (conceded || 0)
      };
    }
  }
  return { updates: updates, matchedCount: matchedCount, unmatchedNames: unmatchedNames };
}

function fetchSofaScoreStatsForFixture(dateStr, home, away) {
  var day = (dateStr || "").slice(0, 10);
  return fetch("/.netlify/functions/sofascore-proxy?action=day&date=" + day)
    .then(function (r) { return r.json(); })
    .then(function (dayData) {
      if (dayData && dayData.error) {
        var errDetail = typeof dayData.error === "string" ? dayData.error : JSON.stringify(dayData.error);
        throw new Error("Proxy error for " + day + ": " + errDetail);
      }
      var evList = (dayData && dayData.events) || [];
      var ev = findSofaEventForMatch(dayData, home, away);
      if (!ev) {
        var diag;
        if (!dayData) {
          diag = "response was empty/null";
        } else if (!evList.length) {
          var keys = Object.keys(dayData).join(",");
          diag = evList.length + " events in response; top-level keys: [" + keys + "]";
        } else {
          var plNames = [];
          for (var di = 0; di < evList.length && di < 6; di++) {
            var de = evList[di];
            var tourN = de.tournament && de.tournament.name ? de.tournament.name : "?";
            var hN = de.homeTeam ? de.homeTeam.name : "?";
            var aN = de.awayTeam ? de.awayTeam.name : "?";
            plNames.push(tourN + ": " + hN + " v " + aN);
          }
          diag = evList.length + " events found, none matched. Sample: " + plNames.join(" | ");
        }
        throw new Error("Couldn't find " + home + " v " + away + " on " + day + " \u2014 " + diag);
      }
      var homeConceded = ev.awayScore ? ev.awayScore.current : null;
      var awayConceded = ev.homeScore ? ev.homeScore.current : null;
      return fetch("/.netlify/functions/sofascore-proxy?action=lineups&event=" + ev.id)
        .then(function (r) { return r.json(); })
        .then(function (lineupData) {
          return mapSofaLineupsToUpdates(lineupData, homeConceded, awayConceded, home, away);
        });
    });
}

var fplBootstrapCache = null;

function fetchFplBootstrap() {
  if (fplBootstrapCache) return Promise.resolve(fplBootstrapCache);
  return fetch("/.netlify/functions/fpl-proxy?action=bootstrap")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data && data.error) {
        throw new Error("FPL proxy error: " + (typeof data.error === "string" ? data.error : JSON.stringify(data.error)));
      }
      if (!data || !data.elements) throw new Error("FPL bootstrap returned no player data.");
      var teamNames = {};
      var teams = data.teams || [];
      for (var i = 0; i < teams.length; i++) teamNames[teams[i].id] = teams[i].name;
      var elementsById = {};
      for (var j = 0; j < data.elements.length; j++) elementsById[data.elements[j].id] = data.elements[j];
      var result = { elementsById: elementsById, teamNames: teamNames };
      fplBootstrapCache = result;
      return result;
    });
}

function mapFplLiveToUpdates(liveData, bootstrap) {
  var updates = {};
  var matchedCount = 0;
  var unmatchedNames = [];
  var liveElements = (liveData && liveData.elements) || [];
  for (var j = 0; j < liveElements.length; j++) {
    var le = liveElements[j];
    var stat = le.stats || {};
    if (!stat.minutes) continue;
    var meta = bootstrap.elementsById[le.id];
    if (!meta) continue;
    var clubName = bootstrap.teamNames[meta.team] || "";
    var localP = findLocalPlayerMatch(meta.web_name, clubName) || findLocalPlayerMatch(meta.first_name + " " + meta.second_name, clubName);
    if (!localP) { unmatchedNames.push(meta.web_name + " (" + clubName + ")"); continue; }
    matchedCount++;
    var cbit = (stat.clearances_blocks_interceptions || 0) + (stat.tackles || 0) + (stat.recoveries || 0);
    updates[localP.id] = {
      mins: stat.minutes || 0,
      goals: stat.goals_scored || 0,
      assists: stat.assists || 0,
      ownGoals: stat.own_goals || 0,
      yellow: stat.yellow_cards || 0,
      red: (stat.red_cards || 0) > 0,
      goalsConceded: stat.goals_conceded || 0,
      saves: stat.saves || 0,
      penSaveGK: stat.penalties_saved || 0,
      penMissTaker: stat.penalties_missed || 0,
      cbit: cbit,
      bonus: stat.bonus || 0
    };
  }
  return { updates: updates, matchedCount: matchedCount, unmatchedNames: unmatchedNames };
}

function fetchFplStatsForGw(gwNum) {
  return fetchFplBootstrap().then(function (bootstrap) {
    return fetch("/.netlify/functions/fpl-proxy?action=live&gw=" + gwNum)
      .then(function (r) { return r.json(); })
      .then(function (liveData) {
        if (liveData && liveData.error) {
          throw new Error("FPL proxy error: " + (typeof liveData.error === "string" ? liveData.error : JSON.stringify(liveData.error)));
        }
        return mapFplLiveToUpdates(liveData, bootstrap);
      });
  });
}

function mapApiStatsToUpdates(matches, apiDataByFixture) {
  var updates = {};
  var matchedCount = 0;
  var unmatchedNames = [];
  for (var mi = 0; mi < matches.length; mi++) {
    var m = matches[mi];
    var data = apiDataByFixture[m.fixtureApiId];
    var teamsData = (data && data.response) || [];
    for (var ti = 0; ti < teamsData.length; ti++) {
      var teamBlock = teamsData[ti];
      var teamName = teamBlock.team ? teamBlock.team.name : "";
      var isHome = teamName === m.home;
      var concededScore = isHome ? m.awayScore : m.homeScore;
      var playersArr = teamBlock.players || [];
      for (var pi = 0; pi < playersArr.length; pi++) {
        var pentry = playersArr[pi];
        var apiPlayerName = pentry.player ? pentry.player.name : "";
        var statBlock = (pentry.statistics && pentry.statistics[0]) || {};
        var localP = findLocalPlayerMatch(apiPlayerName, teamName);
        if (!localP) { unmatchedNames.push(apiPlayerName + " (" + teamName + ")"); continue; }
        matchedCount++;
        var mins = (statBlock.games && statBlock.games.minutes) || 0;
        var goals = (statBlock.goals && statBlock.goals.total) || 0;
        var assists = (statBlock.goals && statBlock.goals.assists) || 0;
        var yellow = (statBlock.cards && statBlock.cards.yellow) || 0;
        var red = !!(statBlock.cards && statBlock.cards.red);
        var shotsOnTarget = (statBlock.shots && statBlock.shots.on) || 0;
        var tackles = (statBlock.tackles && statBlock.tackles.total) || 0;
        var penSaveGK = (statBlock.penalty && statBlock.penalty.saved) || 0;
        var penMissTaker = (statBlock.penalty && statBlock.penalty.missed) || 0;
        updates[localP.id] = {
          mins: mins, goals: goals, assists: assists, yellow: yellow, red: red,
          shotsOnTarget: shotsOnTarget, tackles: tackles,
          penSaveGK: penSaveGK, penMissTaker: penMissTaker,
          goalsConceded: (concededScore || 0)
        };
      }
    }
  }
  return { updates: updates, matchedCount: matchedCount, unmatchedNames: unmatchedNames };
}

function fetchApiFixtures(competition, season) {
  var url = "/.netlify/functions/football-proxy?action=fixtures&competition=" + competition + "&season=" + season;
  return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
    if (data.error) throw new Error(data.error);
    if (data.errorCode || data.message) {
      throw new Error("football-data.org says: " + (data.message || data.errorCode));
    }
    var list = data.matches || [];
    if (!list.length) {
      throw new Error("football-data.org returned 0 fixtures for competition " + competition + ", season " + season + ". Check the competition code and season year.");
    }
    var byGw = {};
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      var gwNum = f.matchday;
      if (!gwNum) continue;
      var gwId = "gw" + gwNum;
      if (!byGw[gwId]) byGw[gwId] = { gw: gwNum, label: "Gameweek " + gwNum, matches: [] };
      byGw[gwId].matches.push({
        home: f.homeTeam ? f.homeTeam.name : "",
        away: f.awayTeam ? f.awayTeam.name : "",
        date: f.utcDate ? f.utcDate.slice(0, 16).replace("T", " ") : "",
        fdMatchId: f.id,
        homeScore: f.score && f.score.fullTime ? f.score.fullTime.home : null,
        awayScore: f.score && f.score.fullTime ? f.score.fullTime.away : null,
        status: f.status || ""
      });
    }
    return byGw;
  });
}

var CLUB_ALIASES = {
  "nott m forest": "nottingham forest",
  "notts forest": "nottingham forest",
  "man utd": "manchester united",
  "man united": "manchester united",
  "man city": "manchester city",
  "spurs": "tottenham hotspur",
  "tottenham": "tottenham hotspur",
  "wolves": "wolverhampton wanderers",
  "leicester": "leicester city",
  "sheffield utd": "sheffield united",
  "west brom": "west bromwich albion",
  "newcastle utd": "newcastle united",
  "brighton": "brighton hove albion",
  "brighton and hove albion": "brighton hove albion"
};

function canonClub(normed) {
  return CLUB_ALIASES[normed] || normed;
}

function extractSurname(normed) {
  var tokens = normed.split(" ").filter(function (t) { return t.length > 0; });
  if (tokens.length === 2) {
    if (tokens[0].length === 1 && tokens[1].length > 1) return tokens[1];
    if (tokens[1].length === 1 && tokens[0].length > 1) return tokens[0];
  }
  return tokens.length ? tokens[tokens.length - 1] : "";
}

function findLocalPlayerMatch(apiName, clubName) {
  var target = normName(apiName);
  var targetClub = canonClub(normName(clubName));
  var best = null;
  for (var i = 0; i < ALL_PLAYERS.length; i++) {
    var p = ALL_PLAYERS[i];
    var pn = normName(p.name);
    var pc = canonClub(normName(p.club));
    var clubOk = targetClub && (pc.indexOf(targetClub) >= 0 || targetClub.indexOf(pc) >= 0);
    if (pn === target && clubOk) return p;
    if (pn === target && !best) best = p;
    var lastTarget = extractSurname(target);
    var lastLocal = extractSurname(pn);
    if (clubOk && lastTarget && lastTarget === lastLocal && lastTarget.length > 2) best = best || p;
  }
  return best;
}

function useDbValue(path, defaultVal) {
  var stateArr = React.useState(defaultVal);
  var val = stateArr[0];
  var setVal = stateArr[1];
  React.useEffect(function () {
    var ref = window.db.ref(path);
    var cb = function (snap) {
      var v = snap.val();
      setVal(v === null ? defaultVal : v);
    };
    ref.on("value", cb);
    return function () { ref.off("value", cb); };
  }, [path]);
  return [val, setVal];
}

function TopNav(props) {
  var tabs = props.tabs;
  var active = props.active;
  var onSelect = props.onSelect;
  var items = [];
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    var isActive = t.key === active;
    items.push(
      React.createElement("button", {
        key: t.key,
        onClick: function (k) { return function () { onSelect(k); }; }(t.key),
        style: {
          flex: 1, padding: "10px 4px", background: isActive ? "#274b8c" : "transparent",
          color: "#fff", border: "none", borderBottom: isActive ? "3px solid #ffd23f" : "3px solid transparent",
          fontSize: 12, fontWeight: isActive ? "700" : "500"
        }
      }, t.label)
    );
  }
  return React.createElement("div", {
    style: { position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "#12233f", zIndex: 50, boxShadow: "0 -2px 8px rgba(0,0,0,0.4)" }
  }, items);
}

function Header(props) {
  return React.createElement("div", {
    style: { background: "linear-gradient(135deg,#1a2a4a,#274b8c)", padding: "16px 16px 12px", textAlign: "center" }
  },
    React.createElement("div", { style: { fontSize: 20, fontWeight: 800, letterSpacing: 0.5 } }, "Grzegorz Lutecki Dream Team"),
    React.createElement("div", { style: { fontSize: 12, opacity: 0.8, marginTop: 2 } }, CFG.seasonLabel + " season" + (props.sub ? " \u2014 " + props.sub : ""))
  );
}

function Card(props) {
  return React.createElement("div", {
    style: { background: "#152a4d", borderRadius: 14, padding: 14, margin: "10px 14px", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }
  }, props.children);
}

function Btn(props) {
  var style = {
    padding: "10px 16px", borderRadius: 10, fontWeight: 700,
    border: props.variant === "ghost" ? "1px solid #ffd23f" : "none",
    background: props.variant === "ghost" ? "transparent" : (props.variant === "danger" ? "#c0392b" : "#ffd23f"),
    color: props.variant === "ghost" ? "#ffd23f" : (props.variant === "danger" ? "#fff" : "#12233f"),
    opacity: props.disabled ? 0.5 : 1
  };
  return React.createElement("button", { onClick: props.onClick, disabled: props.disabled, style: style }, props.children);
}

/* ---------------- Logo / Home ---------------- */

function Logo(props) {
  var size = props.size || 88;
  return React.createElement("div", {
    style: {
      width: size, height: size, borderRadius: "50%", margin: "0 auto",
      background: "radial-gradient(circle at 35% 30%, #ffe27a, #ffd23f 55%, #c99a00 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 4px 14px rgba(0,0,0,0.4)", border: "3px solid #12233f"
    }
  },
    React.createElement("span", { style: { fontSize: size * 0.42, lineHeight: 1 } }, "\u26bd")
  );
}

function Home(props) {
  var loggedIn = !!dtLoadLogin();
  var installArr = React.useState(!!window.dtDeferredInstallPrompt);
  var canInstall = installArr[0];
  var setCanInstall = installArr[1];
  var showAndroidHelpArr = React.useState(false);
  var showAndroidHelp = showAndroidHelpArr[0];
  var setShowAndroidHelp = showAndroidHelpArr[1];

  var isAndroid = /android/i.test(navigator.userAgent || "");

  React.useEffect(function () {
    function onAvailable() { setCanInstall(true); }
    window.addEventListener("dtInstallAvailable", onAvailable);
    return function () { window.removeEventListener("dtInstallAvailable", onAvailable); };
  }, []);

  function doInstall() {
    if (window.dtDeferredInstallPrompt) {
      window.dtDeferredInstallPrompt.prompt();
      window.dtDeferredInstallPrompt.userChoice.then(function () {
        window.dtDeferredInstallPrompt = null;
        setCanInstall(false);
      });
    } else {
      setShowAndroidHelp(true);
    }
  }

  var mainCards;
  if (loggedIn) {
    mainCards = [
      React.createElement("div", {
        key: "myteam", onClick: function () { props.onNav("myteam"); },
        style: { background: "#ffd23f", color: "#12233f", borderRadius: 16, padding: "22px", textAlign: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.3)", marginBottom: 16 }
      },
        React.createElement("div", { style: { fontSize: 20, fontWeight: 800, marginBottom: 4 } }, "\ud83d\udcc4 My Team"),
        React.createElement("div", { style: { fontSize: 12, opacity: 0.8 } }, "View your squad and make transfers")
      ),
      React.createElement("div", {
        key: "rules", onClick: function () { props.onNav("rules"); },
        style: { background: "#152a4d", borderRadius: 16, padding: "20px", marginBottom: 16, textAlign: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }
      },
        React.createElement("div", { style: { fontSize: 18, fontWeight: 800, marginBottom: 4 } }, "\ud83d\udcd6 Rules"),
        React.createElement("div", { style: { fontSize: 12, opacity: 0.75 } }, "How the competition and scoring works")
      ),
      React.createElement("div", {
        key: "another", onClick: function () { props.onNav("team"); },
        style: { textAlign: "center", fontSize: 13, color: "#ffd23f", textDecoration: "underline" }
      }, "Enter another team")
    ];
  } else {
    mainCards = [
      React.createElement("div", {
        key: "rules", onClick: function () { props.onNav("rules"); },
        style: { background: "#152a4d", borderRadius: 16, padding: "20px", marginBottom: 16, textAlign: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }
      },
        React.createElement("div", { style: { fontSize: 18, fontWeight: 800, marginBottom: 4 } }, "\ud83d\udcd6 Rules"),
        React.createElement("div", { style: { fontSize: 12, opacity: 0.75 } }, "How the competition and scoring works")
      ),
      React.createElement("div", {
        key: "enter", onClick: function () { props.onNav("team"); },
        style: { background: "#ffd23f", color: "#12233f", borderRadius: 16, padding: "22px", textAlign: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.3)", marginBottom: 16 }
      },
        React.createElement("div", { style: { fontSize: 20, fontWeight: 800, marginBottom: 4 } }, "\u26bd Enter"),
        React.createElement("div", { style: { fontSize: 12, opacity: 0.8 } }, "Set up your account and pick your 11")
      ),
      React.createElement("div", {
        key: "login", onClick: function () { props.onNav("myteam"); },
        style: { background: "#1c3253", borderRadius: 16, padding: "18px", textAlign: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }
      },
        React.createElement("div", { style: { fontSize: 16, fontWeight: 800, marginBottom: 4 } }, "\ud83d\udd11 Login"),
        React.createElement("div", { style: { fontSize: 12, opacity: 0.75 } }, "Already entered? Sign in to manage your team")
      )
    ];
  }
  return React.createElement(React.Fragment, null,
    React.createElement("div", {
      style: { background: "linear-gradient(135deg,#1a2a4a,#274b8c)", padding: "34px 20px 26px", textAlign: "center" }
    },
      React.createElement(Logo, { size: 96 }),
      React.createElement("div", { style: { fontSize: 24, fontWeight: 800, marginTop: 14, letterSpacing: 0.5 } }, "Grzegorz Lutecki"),
      React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: "#ffd23f", marginTop: 2 } }, "DREAM TEAM"),
      React.createElement("div", { style: { fontSize: 12, opacity: 0.8, marginTop: 6 } }, CFG.seasonLabel + " season")
    ),
    isAndroid ? React.createElement("div", { style: { padding: "0 20px 14px" } },
      React.createElement("div", {
        onClick: doInstall,
        style: { background: "#1c3253", border: "1px solid #6fcf6f", borderRadius: 12, padding: "12px", textAlign: "center", fontSize: 13, fontWeight: 700, color: "#6fcf6f" }
      }, "\u2b07\ufe0f Install app on this device"),
      showAndroidHelp ? React.createElement("div", { style: { fontSize: 12, opacity: 0.85, marginTop: 8, textAlign: "center" } },
        "Couldn't install automatically \u2014 open this page in Chrome, then tap the \u22ee menu (top right) and choose \"Add to Home screen\" or \"Install app\"."
      ) : null
    ) : null,
    React.createElement("div", { style: { padding: "24px 20px" } }, mainCards)
  );
}

/* ---------------- Account Setup ---------------- */

function findExistingTeamForName(teamsObj, name) {
  var target = (name || "").trim().toLowerCase();
  if (!target) return null;
  var ids = Object.keys(teamsObj || {});
  for (var i = 0; i < ids.length; i++) {
    var t = teamsObj[ids[i]];
    if (t && (t.entrantName || "").trim().toLowerCase() === target) return t;
  }
  return null;
}

function AccountSetup(props) {
  var formArr = React.useState({ entrantName: "", teamName: "", phone: "", email: "", pin: "" });
  var form = formArr[0];
  var setForm = formArr[1];
  var errArr = React.useState("");
  var err = errArr[0];
  var setErr = errArr[1];

  var existingMatch = findExistingTeamForName(props.teams, form.entrantName);

  function next() {
    if (!form.entrantName.trim() || !form.teamName.trim()) { setErr("Enter your name and a team name."); return; }
    if (!form.phone.trim()) { setErr("Phone number is required."); return; }
    var emailTrim = form.email.trim();
    if (!emailTrim || emailTrim.indexOf("@") < 0 || emailTrim.indexOf(".") < 0) { setErr("Enter a valid email address."); return; }
    var finalPin;
    if (existingMatch) {
      finalPin = existingMatch.pin;
    } else {
      if (!form.pin || form.pin.trim().length < 4) { setErr("Choose a PIN of at least 4 digits \u2014 you'll use it to sign in later."); return; }
      finalPin = form.pin.trim();
    }
    setErr("");
    props.onDone({
      entrantName: form.entrantName.trim(),
      teamName: form.teamName.trim(),
      phone: form.phone.trim(),
      email: emailTrim,
      pin: finalPin
    });
  }

  return React.createElement(React.Fragment, null,
    React.createElement(Header, { sub: "Set up your team" }),
    React.createElement(Card, null,
      React.createElement("div", { style: { fontSize: 13, marginBottom: 10 } }, "First, a few details. You'll pick your 11 players next."),
      React.createElement("input", {
        placeholder: "Your name", value: form.entrantName,
        onChange: function (e) { setForm(Object.assign({}, form, { entrantName: e.target.value })); },
        style: { width: "100%", padding: 10, borderRadius: 8, marginBottom: 8, background: "#1c3253", color: "#fff", border: "none" }
      }),
      React.createElement("input", {
        placeholder: "Team name", value: form.teamName,
        onChange: function (e) { setForm(Object.assign({}, form, { teamName: e.target.value })); },
        style: { width: "100%", padding: 10, borderRadius: 8, marginBottom: 8, background: "#1c3253", color: "#fff", border: "none" }
      }),
      React.createElement("input", {
        placeholder: "Phone number", value: form.phone, inputMode: "tel",
        onChange: function (e) { setForm(Object.assign({}, form, { phone: e.target.value })); },
        style: { width: "100%", padding: 10, borderRadius: 8, marginBottom: 8, background: "#1c3253", color: "#fff", border: "none" }
      }),
      React.createElement("input", {
        placeholder: "Email address", value: form.email, inputMode: "email",
        onChange: function (e) { setForm(Object.assign({}, form, { email: e.target.value })); },
        style: { width: "100%", padding: 10, borderRadius: 8, marginBottom: 8, background: "#1c3253", color: "#fff", border: "none" }
      }),
      existingMatch
        ? React.createElement("div", { style: { fontSize: 12, color: "#6fcf6f", marginBottom: 10 } }, "Welcome back \u2014 this team will use the same PIN as your other team(s) under this name, so one sign-in covers all of them.")
        : React.createElement("input", {
            placeholder: "Choose a PIN (4+ digits)", value: form.pin, type: "password", inputMode: "numeric",
            onChange: function (e) { setForm(Object.assign({}, form, { pin: e.target.value })); },
            style: { width: "100%", padding: 10, borderRadius: 8, marginBottom: 10, background: "#1c3253", color: "#fff", border: "none" }
          }),
      err ? React.createElement("div", { style: { fontSize: 12, color: "#ff9a9a", marginBottom: 8 } }, err) : null,
      React.createElement(Btn, { onClick: next }, "Continue to pick your team")
    )
  );
}

/* ---------------- Team Builder ---------------- */

var POS_ORDER = ["GK", "DEF", "MID", "FWD"];
var POS_LABEL = { GK: "Goalkeeper", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards" };

function reqCounts(formation) {
  var shape = CFG.formationShape[formation];
  return { GK: 1, DEF: shape.DEF, MID: shape.MID, FWD: shape.FWD };
}

function groupByPos(ids) {
  var g = { GK: [], DEF: [], MID: [], FWD: [] };
  for (var i = 0; i < ids.length; i++) {
    var pl = PLAYERS_BY_ID[ids[i]];
    if (pl) g[pl.pos].push(ids[i]);
  }
  return g;
}

function sortIdsByPos(ids) {
  var g = groupByPos(ids);
  return g.GK.concat(g.DEF).concat(g.MID).concat(g.FWD);
}

function TeamBuilder(props) {
  var players = props.players;
  var stateArr = React.useState(props.initialSelected ? props.initialSelected.slice() : []);
  var selected = stateArr[0];
  var setSelected = stateArr[1];
  var preferredArr = React.useState(null);
  var preferred = preferredArr[0];
  var setPreferred = preferredArr[1];
  var viewArr = React.useState("pitch");
  var view = viewArr[0];
  var setView = viewArr[1];
  var pickerArr = React.useState(null);
  var pickerPos = pickerArr[0];
  var setPickerPos = pickerArr[1];
  var pickerClubArr = React.useState("ALL");
  var pickerClub = pickerClubArr[0];
  var setPickerClub = pickerClubArr[1];
  var pickerSearchArr = React.useState("");
  var pickerSearch = pickerSearchArr[0];
  var setPickerSearch = pickerSearchArr[1];
  var pickerSortArr = React.useState("price");
  var pickerSort = pickerSortArr[0];
  var setPickerSort = pickerSortArr[1];
  var showFormPickerArr = React.useState(false);
  var showFormPicker = showFormPickerArr[0];
  var setShowFormPicker = showFormPickerArr[1];
  var msgArr = React.useState("");
  var msg = msgArr[0];
  var setMsg = msgArr[1];
  var lastDisplayRef = React.useRef(CFG.formations[0]);

  var grouped = groupByPos(selected);
  var counts = { GK: grouped.GK.length, DEF: grouped.DEF.length, MID: grouped.MID.length, FWD: grouped.FWD.length };
  var displayFormation = pickDisplayFormation(counts, preferred, lastDisplayRef.current);
  lastDisplayRef.current = displayFormation;
  var shape = CFG.formationShape[displayFormation];
  var req = { GK: 1, DEF: shape.DEF, MID: shape.MID, FWD: shape.FWD };

  function eligibility(player) {
    if (selected.indexOf(player.id) >= 0) return { ok: false, reason: "Already in your team." };
    if (selected.length >= CFG.squadSize) return { ok: false, reason: "Squad is full." };
    if (!canAddPos(counts, player.pos)) return { ok: false, reason: "No valid formation allows another " + POS_LABEL[player.pos].toLowerCase().replace(/s$/, "") + "." };
    var cc = clubCounts(selected);
    if ((cc[player.club] || 0) >= CFG.maxPerClub) return { ok: false, reason: "Max " + CFG.maxPerClub + " from " + player.club + "." };
    if (squadCost(selected.concat([player.id])) > CFG.budgetCap) return { ok: false, reason: "Over the " + fmtMoney(CFG.budgetCap) + " budget." };
    return { ok: true, reason: "" };
  }

  function removePlayer(id) {
    var idx = selected.indexOf(id);
    if (idx < 0) return;
    setSelected(selected.slice(0, idx).concat(selected.slice(idx + 1)));
    setMsg("");
  }

  function addPlayer(id) {
    var pl = PLAYERS_BY_ID[id];
    if (!pl) return;
    var check = eligibility(pl);
    if (!check.ok) { setMsg(check.reason); return; }
    setMsg("");
    setSelected(selected.concat([id]));
    setPickerPos(null);
    setPickerClub("ALL");
    setPickerSearch("");
  }

  function tryChangeFormation(f) {
    var reach = reachableFormations(counts);
    if (reach.indexOf(f) < 0) { setMsg("Not possible with your current picks \u2014 remove some players first."); return; }
    setPreferred(f);
    setShowFormPicker(false);
    setMsg("");
  }

  var cost = squadCost(selected);
  var remaining = Math.round((CFG.budgetCap - cost) * 10) / 10;

  function submitTeam() {
    if (selected.length !== CFG.squadSize) { setMsg("Fill every position first."); return; }
    var finalFormation = matchesFormation(counts) || displayFormation;
    if (props.mode === "edit") {
      window.db.ref("teams/" + props.teamId).update({
        formation: finalFormation,
        playerIds: selected,
        cost: cost
      }).then(function () {
        if (props.onSaved) props.onSaved();
      });
      return;
    }
    var reg = props.regInfo || {};
    var newRef = window.db.ref("teams").push();
    var code = newRef.key.slice(-6).toUpperCase();
    newRef.set({
      entrantName: reg.entrantName || "",
      phone: reg.phone || "",
      email: reg.email || "",
      teamName: reg.teamName || "",
      pin: reg.pin || "",
      formation: finalFormation,
      playerIds: selected,
      code: code,
      transfersUsed: 0,
      emergencyUsed: false,
      pendingEmergency: null,
      transferLog: [],
      payments: { a: false, b: false, c: false },
      cost: cost,
      createdAt: Date.now()
    }).then(function () {
      dtSaveLogin(newRef.key);
      if (props.onSubmitted) props.onSubmitted(newRef.key);
    });
  }

  if (showFormPicker) {
    var reach = reachableFormations(counts);
    var fButtons = CFG.formations.map(function (f) {
      var possible = reach.indexOf(f) >= 0;
      return React.createElement("button", {
        key: f, onClick: function (ff) { return function () { tryChangeFormation(ff); }; }(f),
        style: {
          padding: "12px 10px", borderRadius: 10, border: f === displayFormation ? "2px solid #ffd23f" : "none",
          background: possible ? "#1c3253" : "#3a1c1c", color: possible ? "#fff" : "#e05555",
          fontSize: 15, fontWeight: 700, marginBottom: 8, width: "100%"
        }
      }, f + (possible ? "" : "  (not possible with current picks)"));
    });
    return React.createElement(React.Fragment, null,
      React.createElement(Header, { sub: "Choose formation" }),
      React.createElement(Card, null,
        React.createElement(Btn, { variant: "ghost", onClick: function () { setShowFormPicker(false); } }, "\u2190 Back"),
        React.createElement("div", { style: { marginTop: 10 } }, fButtons)
      )
    );
  }

  if (pickerPos) {
    var already = selected;
    var pointsMaps = playerPointsMaps(props.gwstats);
    var eligible = players.filter(function (p) {
      if (p.pos !== pickerPos) return false;
      if (already.indexOf(p.id) >= 0) return false;
      if (pickerClub !== "ALL" && p.club !== pickerClub) return false;
      if (pickerSearch && p.name.toLowerCase().indexOf(pickerSearch.toLowerCase()) === -1) return false;
      return true;
    });
    eligible = eligible.slice().sort(function (a, b) {
      if (pickerSort === "total") return (pointsMaps.totals[b.id] || 0) - (pointsMaps.totals[a.id] || 0);
      if (pickerSort === "last3") return (pointsMaps.last3[b.id] || 0) - (pointsMaps.last3[a.id] || 0);
      return b.price - a.price;
    });
    var clubOptions = [React.createElement("option", { key: "ALL", value: "ALL" }, "All clubs")];
    for (var ci = 0; ci < ALL_CLUBS.length; ci++) {
      clubOptions.push(React.createElement("option", { key: ALL_CLUBS[ci], value: ALL_CLUBS[ci] }, ALL_CLUBS[ci]));
    }
    var sortOptions = [
      { key: "price", label: "Price" },
      { key: "total", label: "Total pts" },
      { key: "last3", label: "Last 3 GW" }
    ];
    var sortButtons = sortOptions.map(function (s) {
      return React.createElement("button", {
        key: s.key, onClick: function (k) { return function () { setPickerSort(k); }; }(s.key),
        style: { padding: "6px 10px", borderRadius: 8, border: "none", background: pickerSort === s.key ? "#ffd23f" : "#1c3253", color: pickerSort === s.key ? "#12233f" : "#fff", fontSize: 11, fontWeight: 700 }
      }, s.label);
    });
    var pickerRows = eligible.map(function (p) {
      var check = eligibility(p);
      return React.createElement("div", {
        key: p.id, onClick: function (pid) { return function () { addPlayer(pid); }; }(p.id),
        style: {
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "9px 10px", borderRadius: 8, marginBottom: 6,
          background: check.ok ? "#1c3253" : "#3a1c1c",
          border: check.ok ? "1px solid transparent" : "1px solid #e05555",
          opacity: check.ok ? 1 : 0.75
        }
      },
        React.createElement("div", null,
          React.createElement("div", { style: { fontWeight: 600, fontSize: 14, color: check.ok ? "#fff" : "#ff9a9a" } }, p.name),
          React.createElement("div", { style: { fontSize: 11, opacity: 0.7 } }, p.club + (check.ok ? "" : " \u2014 " + check.reason))
        ),
        React.createElement("div", { style: { textAlign: "right" } },
          React.createElement("div", { style: { fontWeight: 700, color: "#ffd23f" } }, fmtMoney(p.price)),
          React.createElement("div", { style: { fontSize: 10, opacity: 0.7 } }, (pointsMaps.totals[p.id] || 0) + " pts total \u00b7 " + (pointsMaps.last3[p.id] || 0) + " last 3")
        )
      );
    });
    return React.createElement(React.Fragment, null,
      React.createElement(Header, { sub: "Pick a " + POS_LABEL[pickerPos] }),
      React.createElement(Card, null,
        React.createElement(Btn, { variant: "ghost", onClick: function () { setPickerPos(null); } }, "\u2190 Back to pitch"),
        React.createElement("div", { style: { marginTop: 10 } },
          React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 8 } }, sortButtons),
          React.createElement("select", {
            value: pickerClub, onChange: function (e) { setPickerClub(e.target.value); },
            style: { width: "100%", padding: 8, borderRadius: 8, marginBottom: 8, background: "#1c3253", color: "#fff", border: "none" }
          }, clubOptions),
          React.createElement("input", {
            placeholder: "Search player", value: pickerSearch,
            onChange: function (e) { setPickerSearch(e.target.value); },
            style: { width: "100%", padding: 8, borderRadius: 8, marginBottom: 10, background: "#1c3253", color: "#fff", border: "none" }
          }),
          React.createElement("div", { style: { maxHeight: 420, overflowY: "auto" } }, pickerRows)
        )
      )
    );
  }

  var lockedFormation = matchesFormation(counts);
  var summary = React.createElement(Card, null,
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 } },
      React.createElement("div", null, React.createElement("b", null, lockedFormation || (displayFormation + " (auto)"))),
      React.createElement("div", null, React.createElement("b", null, selected.length), " / 11"),
      React.createElement("div", null, "Left ", React.createElement("b", { style: { color: remaining < 0 ? "#e05555" : "#6fcf6f" } }, fmtMoney(remaining)))
    ),
    React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
      React.createElement(Btn, { variant: "ghost", onClick: function () { setShowFormPicker(true); } }, "Change formation"),
      React.createElement(Btn, { variant: "ghost", onClick: function () { setView(view === "pitch" ? "list" : "pitch"); } }, view === "pitch" ? "List view" : "Pitch view"),
      props.mode === "edit" && selected.length === CFG.squadSize ? React.createElement(Btn, { onClick: submitTeam }, "Save team") : null
    ),
    msg ? React.createElement("div", { style: { fontSize: 12, color: "#ffd23f", marginTop: 8 } }, msg) : null
  );

  var mainContent;
  if (view === "pitch") {
    var pitchRows = POS_ORDER.map(function (pos) {
      var slots = [];
      var filledIds = grouped[pos];
      for (var s = 0; s < req[pos]; s++) {
        if (s < filledIds.length) {
          var pl = PLAYERS_BY_ID[filledIds[s]];
          slots.push(React.createElement("div", {
            key: pos + s, onClick: function (pid) { return function () { removePlayer(pid); }; }(filledIds[s]),
            style: { background: "#274b8c", borderRadius: 10, padding: "8px 6px", textAlign: "center", flex: 1, minWidth: 78, margin: 3 }
          },
            React.createElement("div", { style: { fontSize: 12, fontWeight: 700 } }, pl.name),
            React.createElement("div", { style: { fontSize: 10, opacity: 0.8 } }, pl.club),
            React.createElement("div", { style: { fontSize: 11, color: "#ffd23f", fontWeight: 700 } }, fmtMoney(pl.price)),
            React.createElement("div", { style: { fontSize: 10, opacity: 0.7, marginTop: 2 } }, "tap to remove")
          ));
        } else {
          var canFill = canAddPos(counts, pos);
          slots.push(React.createElement("div", {
            key: pos + s, onClick: function (p) { return function () { setPickerPos(p); }; }(pos),
            style: {
              background: "#1c3253", border: canFill ? "2px dashed #3d5a8a" : "2px dashed #e05555",
              borderRadius: 10, padding: "12px 6px", textAlign: "center", flex: 1, minWidth: 78, margin: 3,
              fontSize: 22, fontWeight: 800, color: canFill ? "#ffd23f" : "#e05555"
            }
          }, "+"));
        }
      }
      return React.createElement("div", { key: pos, style: { marginBottom: 10 } },
        React.createElement("div", { style: { fontSize: 11, opacity: 0.7, marginBottom: 4, marginLeft: 4 } }, POS_LABEL[pos]),
        React.createElement("div", { style: { display: "flex", flexWrap: "wrap" } }, slots)
      );
    });
    mainContent = React.createElement("div", {
      style: { background: "linear-gradient(180deg,#1d5c2e,#164623)", borderRadius: 16, margin: "10px 14px", padding: "14px 8px" }
    }, pitchRows);
  } else {
    var listBlocks = POS_ORDER.map(function (pos) {
      var ids = grouped[pos];
      var items = ids.map(function (id) {
        var pl = PLAYERS_BY_ID[id];
        return React.createElement("div", {
          key: id, onClick: function (pid) { return function () { removePlayer(pid); }; }(id),
          style: { display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, marginBottom: 6, background: "#1c3253" }
        },
          React.createElement("div", null,
            React.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, pl.name),
            React.createElement("div", { style: { fontSize: 11, opacity: 0.7 } }, pl.club)
          ),
          React.createElement("div", { style: { fontWeight: 700, color: "#ffd23f" } }, fmtMoney(pl.price))
        );
      });
      var emptyCount = req[pos] - ids.length;
      var canFillList = canAddPos(counts, pos);
      for (var e = 0; e < emptyCount; e++) {
        items.push(React.createElement("div", {
          key: pos + "empty" + e, onClick: function (p) { return function () { setPickerPos(p); }; }(pos),
          style: {
            padding: "8px 10px", borderRadius: 8, marginBottom: 6, background: "#1c325388",
            border: canFillList ? "1px dashed #3d5a8a" : "1px dashed #e05555", fontSize: 13,
            color: canFillList ? "#ffd23f" : "#e05555"
          }
        }, "+ Add " + POS_LABEL[pos].toLowerCase().replace(/s$/, "")));
      }
      return React.createElement("div", { key: pos, style: { marginBottom: 12 } },
        React.createElement("div", { style: { fontSize: 12, fontWeight: 700, opacity: 0.8, marginBottom: 4 } }, POS_LABEL[pos]),
        items
      );
    });
    mainContent = React.createElement(Card, null, listBlocks);
  }

  var footer = null;
  if (selected.length === CFG.squadSize) {
    footer = React.createElement(Card, null,
      props.mode === "edit" ? null : React.createElement("div", { style: { fontSize: 13, marginBottom: 10 } }, "Team: " + ((props.regInfo && props.regInfo.teamName) || "") + " \u00b7 Manager: " + ((props.regInfo && props.regInfo.entrantName) || "")),
      msg ? React.createElement("div", { style: { fontSize: 12, color: "#ffd23f", marginBottom: 8 } }, msg) : null,
      React.createElement(Btn, { onClick: submitTeam }, props.mode === "edit" ? "Save team" : ("Submit team (\u00a3" + CFG.entryFee + " entry)"))
    );
  } else if (msg) {
    footer = React.createElement(Card, null, React.createElement("div", { style: { fontSize: 12, color: "#ffd23f" } }, msg));
  }

  return React.createElement(React.Fragment, null,
    React.createElement(Header, { sub: props.mode === "edit" ? "Edit your team" : "Build your team" }),
    props.mode === "edit" && props.onCancel
      ? React.createElement(Card, null, React.createElement(Btn, { variant: "ghost", onClick: props.onCancel }, "\u2190 Cancel, discard changes"))
      : null,
    summary,
    mainContent,
    footer
  );
}

/* ---------------- League Table ---------------- */


function LeagueTable(props) {
  var teamsObj = props.teams;
  var resultsObj = props.results || {};
  var gwstatsObj = props.gwstats || {};
  var teamIds = Object.keys(teamsObj || {});
  var canViewDetail = dtLoadAdmin() || nowMs() > new Date(CFG.entryDeadline + "T23:59:59").getTime();

  var gwOptionsArr = Object.keys(resultsObj).map(function (k) {
    return parseInt(k.replace("gw", ""), 10);
  }).filter(function (n) { return !isNaN(n); });
  gwOptionsArr.sort(function (a, b) { return a - b; });

  var gwArr = React.useState("overall");
  var gwSel = gwArr[0];
  var setGwSel = gwArr[1];
  var detailArr = React.useState(null);
  var detailTeam = detailArr[0];
  var setDetailTeam = detailArr[1];

  var rowsData;
  if (gwSel === "overall") {
    rowsData = teamIds.map(function (tid) {
      var t = teamsObj[tid];
      var total = 0;
      for (var i = 0; i < gwOptionsArr.length; i++) {
        var res = resultsObj["gw" + gwOptionsArr[i]];
        if (res && res.teamScores && res.teamScores[tid] !== undefined) total += res.teamScores[tid];
      }
      return { id: tid, teamName: t.teamName, entrantName: t.entrantName, score: total };
    });
  } else {
    var res2 = resultsObj["gw" + gwSel];
    rowsData = teamIds.map(function (tid) {
      var t = teamsObj[tid];
      var score = (res2 && res2.teamScores && res2.teamScores[tid] !== undefined) ? res2.teamScores[tid] : 0;
      return { id: tid, teamName: t.teamName, entrantName: t.entrantName, score: score };
    });
  }
  rowsData.sort(function (a, b) { return b.score - a.score; });

  if (detailTeam && canViewDetail) {
    var team = teamsObj[detailTeam];
    var body;
    if (gwSel === "overall") {
      var histRows = gwOptionsArr.map(function (n) {
        var res3 = resultsObj["gw" + n];
        var sc = (res3 && res3.teamScores && res3.teamScores[detailTeam] !== undefined) ? res3.teamScores[detailTeam] : 0;
        return React.createElement("div", { key: n, style: { display: "flex", justifyContent: "space-between", padding: "6px 4px", borderBottom: "1px solid #1c3253", fontSize: 13 } },
          React.createElement("span", null, "Gameweek " + n),
          React.createElement("b", { style: { color: "#ffd23f" } }, sc)
        );
      });
      body = histRows.length ? histRows : React.createElement("div", { style: { fontSize: 13, opacity: 0.7 } }, "No gameweeks scored yet.");
    } else {
      var statsForGw = gwstatsObj["gw" + gwSel] || {};
      var pids = sortIdsByPos(effectiveSquad(team, gwSel));
      var playerRows = pids.map(function (pid) {
        var pl = PLAYERS_BY_ID[pid];
        if (!pl) return null;
        var sc = computeScore(statsForGw[pid], pl.pos);
        return React.createElement("div", {
          key: pid, onClick: function (pidx, st) { return function () { openPlayerBreakdown(pidx, st, "GW" + gwSel); }; }(pid, statsForGw[pid]),
          style: { display: "flex", justifyContent: "space-between", padding: "6px 4px", borderBottom: "1px solid #1c3253", fontSize: 13 }
        },
          React.createElement("span", null, pl.name + " (" + pl.pos + ")"),
          React.createElement("b", { style: { color: "#ffd23f" } }, sc)
        );
      });
      body = playerRows;
    }
    var squadRowsDetail = sortIdsByPos(team.playerIds || []).map(function (pid) {
      var pl = PLAYERS_BY_ID[pid];
      if (!pl) return null;
      return React.createElement("div", { key: pid, style: { display: "flex", justifyContent: "space-between", padding: "5px 4px", borderBottom: "1px solid #1c3253", fontSize: 13 } },
        React.createElement("span", null, pl.name + " (" + pl.pos + ")"),
        React.createElement("span", { style: { opacity: 0.7 } }, pl.club + " \u00b7 " + fmtMoney(pl.price))
      );
    });
    return React.createElement(React.Fragment, null,
      React.createElement(Header, { sub: team.teamName }),
      React.createElement(Card, null,
        React.createElement(Btn, { variant: "ghost", onClick: function () { setDetailTeam(null); } }, "\u2190 Back to table"),
        React.createElement("div", { style: { marginTop: 10, fontSize: 13 } }, team.entrantName + " \u00b7 " + team.formation + " \u00b7 " + fmtMoney(team.cost || 0)),
        team.sweepstakeClub ? React.createElement("div", { style: { fontSize: 12, color: "#ffd23f", marginTop: 4 } }, "\ud83c\udfc6 Sweepstake team: " + team.sweepstakeClub) : null
      ),
      React.createElement(Card, null,
        React.createElement("div", { style: { fontWeight: 700, marginBottom: 8 } }, "Squad"),
        squadRowsDetail
      ),
      React.createElement(Card, null,
        React.createElement("div", { style: { fontSize: 12, opacity: 0.7, marginBottom: 8 } }, gwSel === "overall" ? "Score by gameweek" : ("Gameweek " + gwSel + " player scores")),
        body
      )
    );
  }

  var gwSelectOptions = [React.createElement("option", { key: "overall", value: "overall" }, "Overall")];
  for (var g = 0; g < gwOptionsArr.length; g++) {
    gwSelectOptions.push(React.createElement("option", { key: gwOptionsArr[g], value: gwOptionsArr[g] }, "Gameweek " + gwOptionsArr[g]));
  }

  var rows = rowsData.map(function (row, idx) {
    return React.createElement("div", {
      key: row.id, onClick: canViewDetail ? function (tid) { return function () { setDetailTeam(tid); }; }(row.id) : undefined,
      style: { display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, marginBottom: 6, background: idx < 5 ? "#2c5f2d33" : "#1c3253" }
    },
      React.createElement("div", null,
        React.createElement("span", { style: { opacity: 0.6, marginRight: 8 } }, idx + 1),
        React.createElement("b", null, row.teamName),
        React.createElement("div", { style: { fontSize: 11, opacity: 0.7, marginLeft: 20 } }, row.entrantName)
      ),
      React.createElement("b", { style: { color: "#ffd23f" } }, row.score)
    );
  });

  return React.createElement(React.Fragment, null,
    React.createElement(Header, { sub: "League table" }),
    React.createElement(Card, null,
      React.createElement("select", {
        value: gwSel, onChange: function (e) { setGwSel(e.target.value === "overall" ? "overall" : parseInt(e.target.value, 10)); },
        style: { width: "100%", padding: 10, borderRadius: 8, marginBottom: 10, background: "#1c3253", color: "#fff", border: "none", fontSize: 14 }
      }, gwSelectOptions),
      canViewDetail ? React.createElement("div", { style: { fontSize: 11, opacity: 0.6, marginBottom: 8 } }, "Tap a team to see " + (gwSel === "overall" ? "their score history" : "their player-by-player score for that week")) : null,
      rowsData.length ? rows : React.createElement("div", { style: { opacity: 0.7, fontSize: 13 } }, "No teams entered yet.")
    )
  );
}

/* ---------------- Fixtures ---------------- */

function fmtFixtureDate(d) {
  if (!d) return "";
  var parts = d.split(" ");
  var datePart = parts[0];
  var timePart = parts[1] || "";
  var ymd = datePart.split("-");
  if (ymd.length !== 3) return d;
  return ymd[2] + "/" + ymd[1] + "/" + ymd[0] + (timePart ? " " + timePart : "");
}

function fmtGwDateRange(matches) {
  var dates = (matches || []).map(function (m) { return (m.date || "").slice(0, 10); }).filter(function (d) { return d; });
  if (!dates.length) return "";
  dates.sort();
  var first = dates[0].split("-");
  var last = dates[dates.length - 1].split("-");
  var months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  var mIdx = parseInt(last[1], 10) - 1;
  if (first[2] === last[2]) {
    return first[2] + "-" + last[2] + " " + months[mIdx] + " " + last[0];
  }
  return first[2] + " " + months[parseInt(first[1], 10) - 1] + " - " + last[2] + " " + months[mIdx] + " " + last[0];
}

function Fixtures(props) {
  var fixturesObj = props.fixtures || {};
  var gwstatsObj = props.gwstats || {};
  var selArr = React.useState(null);
  var selMatch = selArr[0];
  var setSelMatch = selArr[1];

  var gwNums = Object.keys(fixturesObj).map(function (k) {
    return (fixturesObj[k] && fixturesObj[k].gw) || 0;
  }).filter(function (n) { return n; });
  gwNums = gwNums.filter(function (n, i) { return gwNums.indexOf(n) === i; });
  gwNums.sort(function (a, b) { return a - b; });

  var defaultGw = gwNums.length ? gwNums[gwNums.length - 1] : 1;
  for (var dgi = 0; dgi < gwNums.length; dgi++) {
    var gwCheck = fixturesObj["gw" + gwNums[dgi]];
    var stillToPlay = (gwCheck && gwCheck.matches || []).some(function (m) { return m.status !== "FINISHED"; });
    if (stillToPlay) { defaultGw = gwNums[dgi]; break; }
  }
  var activeGwArr = React.useState(defaultGw);
  var activeGw = activeGwArr[0];
  var setActiveGw = activeGwArr[1];
  var activeGwId = "gw" + activeGw;

  if (selMatch) {
    var statsForGw = gwstatsObj[selMatch.gwId] || {};
    var synced = Object.keys(statsForGw).length > 0;
    var sides = [
      { club: selMatch.match.home },
      { club: selMatch.match.away }
    ];
    var sideBlocks = sides.map(function (side) {
      var clubPlayers = ALL_PLAYERS.filter(function (p) { return p.club === side.club; }).slice().sort(function (a, b) {
        return POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos);
      });
      var rows = clubPlayers.map(function (p) {
        var st = statsForGw[p.id];
        if (!st) return null;
        var sc = computeScore(st, p.pos);
        return React.createElement("div", {
          key: p.id, onClick: function (pid, stat) { return function () { openPlayerBreakdown(pid, stat, selMatch.gwId.toUpperCase()); }; }(p.id, st),
          style: { display: "flex", justifyContent: "space-between", padding: "5px 4px", borderBottom: "1px solid #1c3253", fontSize: 13 }
        },
          React.createElement("span", null, p.name + " (" + p.pos + ")"),
          React.createElement("b", { style: { color: "#ffd23f" } }, sc)
        );
      }).filter(function (r) { return r; });
      return React.createElement("div", { key: side.club, style: { marginBottom: 14 } },
        React.createElement("div", { style: { fontWeight: 700, marginBottom: 6 } }, side.club),
        rows.length ? rows : React.createElement("div", { style: { fontSize: 12, opacity: 0.6 } }, "No synced stats for this club yet.")
      );
    });
    return React.createElement(React.Fragment, null,
      React.createElement(Header, { sub: selMatch.match.home + " v " + selMatch.match.away }),
      React.createElement(Card, null,
        React.createElement(Btn, { variant: "ghost", onClick: function () { setSelMatch(null); } }, "\u2190 Back to fixtures"),
        React.createElement("div", { style: { marginTop: 10 } },
          !synced
            ? React.createElement("div", { style: { fontSize: 13, opacity: 0.7 } }, "Stats for this gameweek haven't been synced yet.")
            : sideBlocks
        )
      )
    );
  }

  if (!gwNums.length) {
    return React.createElement(React.Fragment, null,
      React.createElement(Header, { sub: "Fixtures" }),
      React.createElement(Card, null, React.createElement("div", { style: { opacity: 0.7, fontSize: 13 } }, "No fixtures added yet."))
    );
  }

  var gwPills = gwNums.map(function (n) {
    var isActive = n === activeGw;
    return React.createElement("button", {
      key: n, onClick: function (num) { return function () { setActiveGw(num); }; }(n),
      style: {
        padding: "8px 16px", borderRadius: 20, border: "none", fontWeight: 800, fontSize: 13,
        background: isActive ? "#6fcf6f" : "#1c3253", color: isActive ? "#0e1b33" : "#fff",
        marginRight: 8, flexShrink: 0
      }
    }, "GW" + n);
  });

  var gw = fixturesObj[activeGwId];
  var hasStats = Object.keys(gwstatsObj[activeGwId] || {}).length > 0;
  var matches = gw ? (gw.matches || []) : [];
  var matchRows = matches.map(function (m, i) {
    var clickable = m.status === "FINISHED" && hasStats;
    var finished = m.status === "FINISHED";
    return React.createElement("div", {
      key: i,
      onClick: clickable ? function (gwid, match) { return function () { setSelMatch({ gwId: gwid, match: match }); }; }(activeGwId, m) : undefined,
      style: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "9px 10px", borderRadius: 8, marginBottom: 5,
        background: i % 2 === 0 ? "#182c50" : "#152a4d",
        border: clickable ? "1px solid #6fcf6f55" : "1px solid transparent"
      }
    },
      React.createElement("div", { style: { flex: 1, fontSize: 13, fontWeight: 600, textAlign: "right" } }, m.home),
      React.createElement("div", { style: { flexShrink: 0, padding: "0 14px", fontSize: 12, fontWeight: 800, color: finished ? "#ffd23f" : "#6b7fa8" } },
        finished ? ((m.homeScore != null ? m.homeScore : "?") + " - " + (m.awayScore != null ? m.awayScore : "?")) : "vs"
      ),
      React.createElement("div", { style: { flex: 1, fontSize: 13, fontWeight: 600 } }, m.away),
      React.createElement("div", { style: { flexShrink: 0, marginLeft: 10, fontSize: 11, opacity: 0.6, minWidth: 60, textAlign: "right" } }, fmtFixtureDate(m.date).split(" ")[0])
    );
  });

  return React.createElement(React.Fragment, null,
    React.createElement(Header, { sub: "Fixtures" }),
    React.createElement("div", { style: { display: "flex", overflowX: "auto", padding: "0 14px 4px" } }, gwPills),
    React.createElement(Card, null,
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 } },
        React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: "#6fcf6f" } }, "GW" + activeGw),
        React.createElement("div", { style: { fontSize: 12, opacity: 0.7 } }, fmtGwDateRange(matches))
      ),
      matchRows.length ? matchRows : React.createElement("div", { style: { fontSize: 13, opacity: 0.7 } }, "No matches for this gameweek."),
      React.createElement("div", { style: { fontSize: 11, opacity: 0.6, marginTop: 8 } }, "Finished matches with synced stats are tappable to see every player's score.")
    )
  );
}

/* ---------------- Rules ---------------- */

function RulesTab(props) {
  var items = window.DT_RULES_TEXT.map(function (r, i) {
    return React.createElement("li", { key: i, style: { marginBottom: 8, fontSize: 13, lineHeight: 1.4 } }, r);
  });
  return React.createElement(React.Fragment, null,
    React.createElement(Header, { sub: "Rules" }),
    React.createElement(Card, null, React.createElement("ul", { style: { paddingLeft: 18, margin: 0 } }, items))
  );
}

/* ---------------- Player Scores ---------------- */

function PlayersScoresTab(props) {
  var gwstatsAll = props.gwstats || {};
  var filterArr = React.useState({ pos: "ALL", club: "ALL", search: "" });
  var filter = filterArr[0];
  var setFilter = filterArr[1];

  var gwIds = Object.keys(gwstatsAll);
  var maxGwNum = 0;
  var maxGwId = null;
  for (var gx = 0; gx < gwIds.length; gx++) {
    var n = parseInt(gwIds[gx].replace("gw", ""), 10);
    if (!isNaN(n) && n > maxGwNum) { maxGwNum = n; maxGwId = gwIds[gx]; }
  }

  var totals = {};
  for (var gi = 0; gi < gwIds.length; gi++) {
    var statsForGw = gwstatsAll[gwIds[gi]];
    var pids = Object.keys(statsForGw || {});
    for (var pi = 0; pi < pids.length; pi++) {
      var pl = PLAYERS_BY_ID[pids[pi]];
      if (!pl) continue;
      var sc = computeScore(statsForGw[pids[pi]], pl.pos);
      totals[pids[pi]] = (totals[pids[pi]] || 0) + sc;
    }
  }

  var recentScores = {};
  if (maxGwId) {
    var statsRecent = gwstatsAll[maxGwId] || {};
    for (var pj = 0; pj < ALL_PLAYERS.length; pj++) {
      var pl2 = ALL_PLAYERS[pj];
      recentScores[pl2.id] = computeScore(statsRecent[pl2.id], pl2.pos);
    }
  }

  var filtered = ALL_PLAYERS.filter(function (p) {
    if (filter.pos !== "ALL" && p.pos !== filter.pos) return false;
    if (filter.club !== "ALL" && p.club !== filter.club) return false;
    if (filter.search && p.name.toLowerCase().indexOf(filter.search.toLowerCase()) === -1) return false;
    return true;
  });
  filtered = filtered.slice().sort(function (a, b) {
    return (totals[b.id] || 0) - (totals[a.id] || 0);
  });

  var clubOptions = [React.createElement("option", { key: "ALL", value: "ALL" }, "All clubs")];
  for (var ci = 0; ci < ALL_CLUBS.length; ci++) {
    clubOptions.push(React.createElement("option", { key: ALL_CLUBS[ci], value: ALL_CLUBS[ci] }, ALL_CLUBS[ci]));
  }

  var rows = filtered.map(function (p) {
    var tot = totals[p.id] || 0;
    var recent = recentScores[p.id] || 0;
    var recentStat = maxGwId ? (gwstatsAll[maxGwId] || {})[p.id] : null;
    return React.createElement("div", {
      key: p.id, onClick: function (pid, stat, lbl) { return function () { openPlayerBreakdown(pid, stat, lbl); }; }(p.id, recentStat, maxGwId ? ("GW" + maxGwNum) : ""),
      style: { display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, marginBottom: 6, background: "#1c3253" }
    },
      React.createElement("div", null,
        React.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, p.name),
        React.createElement("div", { style: { fontSize: 11, opacity: 0.7 } }, p.pos + " \u00b7 " + p.club)
      ),
      React.createElement("div", { style: { textAlign: "right" } },
        React.createElement("div", { style: { fontWeight: 700, color: "#ffd23f" } }, tot + " pts"),
        React.createElement("div", { style: { fontSize: 11, opacity: 0.7 } }, maxGwId ? ("GW" + maxGwNum + ": " + recent) : "\u2014")
      )
    );
  });

  return React.createElement(React.Fragment, null,
    React.createElement(Header, { sub: "Stats" }),
    React.createElement(Card, null,
      React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" } },
        ["ALL", "GK", "DEF", "MID", "FWD"].map(function (p) {
          return React.createElement("button", {
            key: p, onClick: function (val) { return function () { setFilter(Object.assign({}, filter, { pos: val })); }; }(p),
            style: { padding: "6px 10px", borderRadius: 8, border: "none", background: filter.pos === p ? "#ffd23f" : "#1c3253", color: filter.pos === p ? "#12233f" : "#fff", fontSize: 12, fontWeight: 700 }
          }, p);
        })
      ),
      React.createElement("select", {
        value: filter.club, onChange: function (e) { setFilter(Object.assign({}, filter, { club: e.target.value })); },
        style: { width: "100%", padding: 8, borderRadius: 8, marginBottom: 8, background: "#1c3253", color: "#fff", border: "none" }
      }, clubOptions),
      React.createElement("input", {
        placeholder: "Search player", value: filter.search,
        onChange: function (e) { setFilter(Object.assign({}, filter, { search: e.target.value })); },
        style: { width: "100%", padding: 8, borderRadius: 8, marginBottom: 10, background: "#1c3253", color: "#fff", border: "none" }
      }),
      gwIds.length === 0
        ? React.createElement("div", { style: { fontSize: 12, opacity: 0.7, marginBottom: 8 } }, "No stats synced yet \u2014 scores appear once the admin enters gameweek stats and syncs.")
        : React.createElement("div", { style: { fontSize: 11, opacity: 0.7, marginBottom: 8 } }, "Most recent gameweek: GW" + maxGwNum),
      React.createElement("div", { style: { maxHeight: 460, overflowY: "auto" } }, rows)
    )
  );
}

/* ---------------- Admin ---------------- */

function AdminGate(props) {
  var stateArr = React.useState("");
  var pin = stateArr[0];
  var setPin = stateArr[1];
  var okArr = React.useState(dtLoadAdmin());
  var ok = okArr[0];
  var setOk = okArr[1];
  var errArr = React.useState("");
  var err = errArr[0];
  var setErr = errArr[1];
  var realPinArr = useDbValue("config/adminPin", "0000");
  var realPin = realPinArr[0];

  if (ok) return React.createElement(React.Fragment, null, props.children);

  function tryUnlock() {
    var entered = (pin || "").trim();
    var expected = (realPin || "0000").toString().trim();
    if (entered.length > 0 && entered === expected) {
      dtSaveAdmin();
      setOk(true);
      setErr("");
    } else {
      setErr("Incorrect PIN \u2014 try again.");
    }
  }

  return React.createElement(React.Fragment, null,
    React.createElement(Header, { sub: "Admin" }),
    React.createElement(Card, null,
      React.createElement("input", {
        placeholder: "Enter admin PIN", value: pin, type: "password", inputMode: "numeric",
        onChange: function (e) { setPin(e.target.value); setErr(""); },
        onKeyDown: function (e) { if (e.key === "Enter") tryUnlock(); },
        style: { width: "100%", padding: 10, borderRadius: 8, marginBottom: 10, background: "#1c3253", color: "#fff", border: "none" }
      }),
      err ? React.createElement("div", { style: { fontSize: 12, color: "#ff9a9a", marginBottom: 8 } }, err) : null,
      React.createElement(Btn, { onClick: tryUnlock }, "Unlock")
    )
  );
}

function AdminPlayers(props) {
  var playersObj = props.playersDb;
  var stateArr = React.useState(null);
  var editId = stateArr[0];
  var setEditId = stateArr[1];
  var filterArr = React.useState({ pos: "ALL", club: "ALL", search: "" });
  var filter = filterArr[0];
  var setFilter = filterArr[1];
  var newArr = React.useState({ name: "", club: ALL_CLUBS[0], pos: "MID", price: "" });
  var newP = newArr[0];
  var setNewP = newArr[1];
  var addMsgArr = React.useState("");
  var addMsg = addMsgArr[0];
  var setAddMsg = addMsgArr[1];

  function deletePlayer(id, name) {
    var teamsObj = props.teams || {};
    var affected = Object.keys(teamsObj).filter(function (tid) {
      return (teamsObj[tid].playerIds || []).indexOf(id) >= 0;
    });
    if (affected.length) {
      window.alert("Can't delete \"" + name + "\" \u2014 they're in " + affected.length + " submitted squad" + (affected.length === 1 ? "" : "s") + ". Those entrants need to transfer them out first (or you can do it for them) before this player can be removed.");
      return;
    }
    var ok = window.confirm("Delete \"" + name + "\" permanently? This can't be undone.");
    if (!ok) return;
    window.db.ref("players/" + id).remove();
  }

  function addPlayer() {
    if (!newP.name.trim()) { setAddMsg("Enter a player name."); return; }
    var price = parseFloat(newP.price);
    if (isNaN(price) || price <= 0) { setAddMsg("Enter a valid price."); return; }
    var ref = window.db.ref("players").push();
    ref.set({
      name: newP.name.trim(),
      club: newP.club,
      pos: newP.pos,
      price: price
    }).then(function () {
      setAddMsg("Added " + newP.name.trim() + ".");
      setNewP({ name: "", club: newP.club, pos: newP.pos, price: "" });
    });
  }

  var filtered = ALL_PLAYERS.filter(function (p) {
    if (filter.pos !== "ALL" && p.pos !== filter.pos) return false;
    if (filter.club !== "ALL" && p.club !== filter.club) return false;
    if (filter.search && p.name.toLowerCase().indexOf(filter.search.toLowerCase()) === -1) return false;
    return true;
  });

  var clubOptions = ALL_CLUBS.map(function (c) { return React.createElement("option", { key: c, value: c }, c); });
  var clubFilterOptions = [React.createElement("option", { key: "ALL", value: "ALL" }, "All clubs")].concat(clubOptions);

  var editArr = React.useState({ name: "", price: "", club: "", pos: "" });
  var editVals = editArr[0];
  var setEditVals = editArr[1];

  var rows = filtered.map(function (p) {
    var dbP = (playersObj && playersObj[p.id]) || p;
    return React.createElement("div", { key: p.id, style: { padding: "6px 8px", borderBottom: "1px solid #1c3253", fontSize: 13 } },
      editId === p.id
        ? React.createElement("div", null,
            React.createElement("input", {
              value: editVals.name, onChange: function (e) { setEditVals(Object.assign({}, editVals, { name: e.target.value })); },
              style: { width: "100%", padding: 6, borderRadius: 6, marginBottom: 6, background: "#1c3253", color: "#fff", border: "none", fontWeight: 700 }
            }),
            React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 6 } },
              React.createElement("select", {
                value: editVals.club, onChange: function (e) { setEditVals(Object.assign({}, editVals, { club: e.target.value })); },
                style: { flex: 1, padding: 6, borderRadius: 6, background: "#1c3253", color: "#fff", border: "none" }
              }, clubOptions),
              React.createElement("select", {
                value: editVals.pos, onChange: function (e) { setEditVals(Object.assign({}, editVals, { pos: e.target.value })); },
                style: { width: 70, padding: 6, borderRadius: 6, background: "#1c3253", color: "#fff", border: "none" }
              }, ["GK", "DEF", "MID", "FWD"].map(function (pp) { return React.createElement("option", { key: pp, value: pp }, pp); }))
            ),
            React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
              React.createElement("input", {
                value: editVals.price, onChange: function (e) { setEditVals(Object.assign({}, editVals, { price: e.target.value })); },
                style: { width: 60, padding: 6, borderRadius: 6, background: "#1c3253", color: "#fff", border: "none" }
              }),
              React.createElement("button", {
                onClick: function (id) { return function () {
                  window.db.ref("players/" + id).update({ name: editVals.name.trim(), price: parseFloat(editVals.price), club: editVals.club, pos: editVals.pos });
                  setEditId(null);
                }; }(p.id)
              }, "Save"),
              React.createElement("button", { onClick: function () { setEditId(null); } }, "Cancel")
            ),
            React.createElement("div", { style: { fontSize: 10, opacity: 0.6, marginTop: 4 } }, "Changing club here is how you handle a real mid-season transfer \u2014 it updates this player everywhere they're already picked, unlike adding a new player entry.")
          )
        : React.createElement("div", { style: { display: "flex", justifyContent: "space-between" } },
            React.createElement("div", null, dbP.name + " (" + dbP.pos + ", " + dbP.club + ")"),
            React.createElement("div", null,
              fmtMoney(dbP.price) + "  ",
              React.createElement("button", { onClick: function (id, d) { return function () { setEditId(id); setEditVals({ name: d.name, price: String(d.price), club: d.club, pos: d.pos }); }; }(p.id, dbP) }, "Edit"),
              React.createElement("button", {
                onClick: function (id, name) { return function () { deletePlayer(id, name); }; }(p.id, dbP.name),
                style: { marginLeft: 6, color: "#ff9a9a" }
              }, "Delete")
            )
          )
    );
  });

  return React.createElement(React.Fragment, null,
    React.createElement(Card, null,
      React.createElement("div", { style: { fontWeight: 700, marginBottom: 8 } }, "Add a new player"),
      React.createElement("input", {
        placeholder: "Player name", value: newP.name,
        onChange: function (e) { setNewP(Object.assign({}, newP, { name: e.target.value })); },
        style: { width: "100%", padding: 8, borderRadius: 6, marginBottom: 6, background: "#1c3253", color: "#fff", border: "none" }
      }),
      React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 6 } },
        React.createElement("select", {
          value: newP.club, onChange: function (e) { setNewP(Object.assign({}, newP, { club: e.target.value })); },
          style: { flex: 1, padding: 8, borderRadius: 6, background: "#1c3253", color: "#fff", border: "none" }
        }, clubOptions),
        React.createElement("select", {
          value: newP.pos, onChange: function (e) { setNewP(Object.assign({}, newP, { pos: e.target.value })); },
          style: { width: 80, padding: 8, borderRadius: 6, background: "#1c3253", color: "#fff", border: "none" }
        }, ["GK", "DEF", "MID", "FWD"].map(function (p) { return React.createElement("option", { key: p, value: p }, p); }))
      ),
      React.createElement("input", {
        placeholder: "Price (e.g. 5.5)", value: newP.price, inputMode: "decimal",
        onChange: function (e) { setNewP(Object.assign({}, newP, { price: e.target.value })); },
        style: { width: "100%", padding: 8, borderRadius: 6, marginBottom: 8, background: "#1c3253", color: "#fff", border: "none" }
      }),
      addMsg ? React.createElement("div", { style: { fontSize: 11, color: "#ffd23f", marginBottom: 8 } }, addMsg) : null,
      React.createElement(Btn, { onClick: addPlayer }, "Add player"),
      React.createElement("div", { style: { fontSize: 11, opacity: 0.6, marginTop: 8 } }, "New players appear immediately in the team builder and everywhere else in the app for everyone to pick.")
    ),
    React.createElement(Card, null,
      React.createElement("div", { style: { fontWeight: 700, marginBottom: 8 } }, "Players & prices (" + filtered.length + " of " + ALL_PLAYERS.length + ")"),
      React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" } },
        ["ALL", "GK", "DEF", "MID", "FWD"].map(function (p) {
          return React.createElement("button", {
            key: p, onClick: function (val) { return function () { setFilter(Object.assign({}, filter, { pos: val })); }; }(p),
            style: { padding: "6px 10px", borderRadius: 8, border: "none", background: filter.pos === p ? "#ffd23f" : "#1c3253", color: filter.pos === p ? "#12233f" : "#fff", fontSize: 11, fontWeight: 700 }
          }, p);
        })
      ),
      React.createElement("select", {
        value: filter.club, onChange: function (e) { setFilter(Object.assign({}, filter, { club: e.target.value })); },
        style: { width: "100%", padding: 8, borderRadius: 8, marginBottom: 8, background: "#1c3253", color: "#fff", border: "none" }
      }, clubFilterOptions),
      React.createElement("input", {
        placeholder: "Search player", value: filter.search,
        onChange: function (e) { setFilter(Object.assign({}, filter, { search: e.target.value })); },
        style: { width: "100%", padding: 8, borderRadius: 8, marginBottom: 10, background: "#1c3253", color: "#fff", border: "none" }
      }),
      React.createElement("div", { style: { maxHeight: 400, overflowY: "auto" } }, rows)
    )
  );
}

function AdminFixtures(props) {
  var fixturesObj = props.fixtures;
  var stateArr = React.useState({ gw: "", label: "", home: "", away: "", date: "" });
  var form = stateArr[0];
  var setForm = stateArr[1];
  var apiArr = React.useState({ competition: "PL", season: "2026" });
  var apiCfg = apiArr[0];
  var setApiCfg = apiArr[1];
  var syncMsgArr = React.useState("");
  var syncMsg = syncMsgArr[0];
  var setSyncMsg = syncMsgArr[1];
  var autoRanRef = React.useRef(false);

  function addMatch() {
    if (!form.gw || !form.home || !form.away) return;
    var gwId = "gw" + form.gw;
    var existing = (fixturesObj && fixturesObj[gwId]) || { gw: parseInt(form.gw, 10), label: form.label || ("Gameweek " + form.gw), matches: [] };
    var matches = existing.matches || [];
    matches.push({ home: form.home, away: form.away, date: form.date });
    window.db.ref("fixtures/" + gwId).set(Object.assign({}, existing, { matches: matches }));
    setForm(Object.assign({}, form, { home: "", away: "" }));
  }

  function syncFixtures() {
    setSyncMsg("Fetching fixtures...");
    fetchApiFixtures(apiCfg.competition, apiCfg.season).then(function (byGw) {
      var gwKeys = Object.keys(byGw);
      if (!gwKeys.length) { setSyncMsg("No fixtures returned \u2014 check competition/season."); return; }
      var writes = [];
      var totalMatches = 0;
      for (var i = 0; i < gwKeys.length; i++) {
        writes.push(window.db.ref("fixtures/" + gwKeys[i]).set(byGw[gwKeys[i]]));
        totalMatches += byGw[gwKeys[i]].matches.length;
      }
      Promise.all(writes).then(function () {
        setSyncMsg("Synced " + totalMatches + " fixtures across " + gwKeys.length + " gameweeks.");
      });
    }).catch(function (e) {
      setSyncMsg("Sync failed: " + (e && e.message ? e.message : e) + " (check the football-proxy function is deployed)");
    });
  }

  React.useEffect(function () {
    if (autoRanRef.current) return;
    autoRanRef.current = true;
    syncFixtures();
  }, []);

  return React.createElement(React.Fragment, null,
    React.createElement(Card, null,
      React.createElement("div", { style: { fontWeight: 700, marginBottom: 8 } }, "Sync fixtures from API"),
      React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 8 } },
        React.createElement("input", { placeholder: "Competition code", value: apiCfg.competition, onChange: function (e) { setApiCfg(Object.assign({}, apiCfg, { competition: e.target.value })); }, style: { flex: 1, padding: 8, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } }),
        React.createElement("input", { placeholder: "Season", value: apiCfg.season, onChange: function (e) { setApiCfg(Object.assign({}, apiCfg, { season: e.target.value })); }, style: { flex: 1, padding: 8, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } })
      ),
      React.createElement("div", { style: { fontSize: 11, opacity: 0.7, marginBottom: 8 } }, "Premier League's football-data.org competition code is PL. This runs automatically whenever this tab opens \u2014 use the button below only if you want to force a re-check."),
      syncMsg ? React.createElement("div", { style: { fontSize: 11, color: "#ffd23f", marginBottom: 8 } }, syncMsg) : null,
      React.createElement(Btn, { onClick: syncFixtures }, "Re-sync fixtures now")
    ),
    React.createElement(Card, null,
      React.createElement("div", { style: { fontWeight: 700, marginBottom: 8 } }, "Add fixture manually"),
      React.createElement("input", { placeholder: "GW number e.g. 1", value: form.gw, onChange: function (e) { setForm(Object.assign({}, form, { gw: e.target.value })); }, style: { width: "100%", padding: 8, marginBottom: 6, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } }),
      React.createElement("input", { placeholder: "Home team", value: form.home, onChange: function (e) { setForm(Object.assign({}, form, { home: e.target.value })); }, style: { width: "100%", padding: 8, marginBottom: 6, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } }),
      React.createElement("input", { placeholder: "Away team", value: form.away, onChange: function (e) { setForm(Object.assign({}, form, { away: e.target.value })); }, style: { width: "100%", padding: 8, marginBottom: 6, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } }),
      React.createElement("input", { placeholder: "Date/time text", value: form.date, onChange: function (e) { setForm(Object.assign({}, form, { date: e.target.value })); }, style: { width: "100%", padding: 8, marginBottom: 10, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } }),
      React.createElement(Btn, { onClick: addMatch }, "Add match")
    )
  );
}

function AdminStats(props) {
  var teamsObj = props.teams;
  var fixturesObj = props.fixtures;
  var stateArr = React.useState("1");
  var gw = stateArr[0];
  var setGw = stateArr[1];
  var syncMsgArr = React.useState("");
  var syncMsg = syncMsgArr[0];
  var setSyncMsg = syncMsgArr[1];
  var statsArr = useDbValue("gwstats/gw" + gw, {});
  var statsObj = statsArr[0];
  var teamIds = Object.keys(teamsObj || {});

  var filterArr = React.useState({ pos: "ALL", club: "ALL", search: "" });
  var filter = filterArr[0];
  var setFilter = filterArr[1];

  function syncStatsFromApi() {
    var gwId = "gw" + gw;
    var gwNum = parseInt(gw, 10);
    setSyncMsg("Fetching stats from the FPL API for GW" + gwNum + "...");
    fetchFplStatsForGw(gwNum).then(function (mapped) {
      var writes = [];
      for (var pid in mapped.updates) {
        writes.push(window.db.ref("gwstats/" + gwId + "/" + pid).update(mapped.updates[pid]));
      }
      return Promise.all(writes).then(function () {
        var statsForGwLocal = Object.assign({}, statsObj, mapped.updates);
        return recomputeResultsForGw(gwId, statsForGwLocal).then(function () {
          var msg = "Matched " + mapped.matchedCount + " players from the FPL API. Scores recalculated (bonus points included).";
          if (mapped.unmatchedNames.length) {
            msg += " Couldn't match: " + mapped.unmatchedNames.join(", ") + " \u2014 enter these manually below.";
          }
          setSyncMsg(msg);
        });
      });
    }).catch(function (e) {
      setSyncMsg("Sync failed: " + (e && e.message ? e.message : e));
    });
  }

  function recomputeResultsForGw(gwId, statsForGw) {
    var gwNum = parseInt(gwId.replace("gw", ""), 10);
    var scores = {};
    for (var i2 = 0; i2 < teamIds.length; i2++) {
      var tid = teamIds[i2];
      var team = teamsObj[tid];
      var total = 0;
      var pids = effectiveSquad(team, gwNum);
      for (var k = 0; k < pids.length; k++) {
        var pl = PLAYERS_BY_ID[pids[k]];
        var st = statsForGw ? statsForGw[pids[k]] : null;
        total += computeScore(st, pl ? pl.pos : "MID");
      }
      scores[tid] = total;
    }
    var best = null;
    for (var tid2 in scores) {
      if (best === null || scores[tid2] > scores[best]) best = tid2;
    }
    return window.db.ref("results/" + gwId).set({
      teamScores: scores,
      winnerTeamId: best,
      winnerPoints: best !== null ? scores[best] : 0
    });
  }

  function syncEverything() {
    setSyncMsg("Fetching fixtures...");
    fetchApiFixtures("PL", "2026").then(function (byGw) {
      var gwKeys = Object.keys(byGw);
      if (!gwKeys.length) { setSyncMsg("No fixtures returned from the API."); return null; }
      var fixtureWrites = [];
      for (var i = 0; i < gwKeys.length; i++) fixtureWrites.push(window.db.ref("fixtures/" + gwKeys[i]).set(byGw[gwKeys[i]]));
      return Promise.all(fixtureWrites).then(function () {
        var finishedGwNumsAll = [];
        for (var gk = 0; gk < gwKeys.length; gk++) {
          var finished = byGw[gwKeys[gk]].matches.filter(function (m) { return m.status === "FINISHED"; });
          if (finished.length) finishedGwNumsAll.push(byGw[gwKeys[gk]].gw);
        }
        if (!finishedGwNumsAll.length) {
          setSyncMsg("Fixtures synced (" + gwKeys.length + " gameweeks). No finished matches yet to pull stats for.");
          return null;
        }
        return window.db.ref("results").once("value").then(function (snap) {
          var already = snap.val() || {};
          var finishedGwNums = finishedGwNumsAll.filter(function (n) { return !already["gw" + n]; });
          if (!finishedGwNums.length) {
            setSyncMsg("Fixtures synced (" + gwKeys.length + " gameweeks). All finished gameweeks are already synced \u2014 previous games left untouched. Use \"Sync stats for this GW only\" to force a re-check on a specific week.");
            return null;
          }
          setSyncMsg("Fetching FPL stats for " + finishedGwNums.length + " finished gameweek(s)...");
          var gwPromises = finishedGwNums.map(function (n) {
            return fetchFplStatsForGw(n).then(function (mapped) {
              return { gwId: "gw" + n, stats: mapped.updates, matched: mapped.matchedCount, unmatched: mapped.unmatchedNames.length };
            }).catch(function (e) {
              return { gwId: "gw" + n, stats: {}, matched: 0, unmatched: 0, error: "GW" + n + ": " + (e && e.message ? e.message : e) };
            });
          });
          return Promise.all(gwPromises).then(function (gwResults) {
            var totalMatched = 0;
            var totalUnmatched = 0;
            var errors = [];
            var statWrites = [];
            for (var g = 0; g < gwResults.length; g++) {
              totalMatched += gwResults[g].matched;
              totalUnmatched += gwResults[g].unmatched;
              if (gwResults[g].error) errors.push(gwResults[g].error);
              for (var pid2 in gwResults[g].stats) {
                statWrites.push(window.db.ref("gwstats/" + gwResults[g].gwId + "/" + pid2).update(gwResults[g].stats[pid2]));
              }
            }
            setSyncMsg("Saving scores...");
            return Promise.all(statWrites).then(function () {
              var resultWrites = gwResults.map(function (r) { return recomputeResultsForGw(r.gwId, r.stats); });
              return Promise.all(resultWrites).then(function () {
                var msg = "Done. " + gwKeys.length + " gameweeks of fixtures, stats pulled for " + finishedGwNums.length + " finished gameweek(s), " + totalMatched + " players matched (bonus points included)" + (totalUnmatched ? (", " + totalUnmatched + " unmatched (check per-gameweek view)") : "") + ".";
                if (errors.length) msg += " Errors: " + errors.join(" | ");
                setSyncMsg(msg);
              });
            });
          });
        });
      });
    }).catch(function (e) {
      setSyncMsg("Sync failed: " + (e && e.message ? e.message : e));
    });
  }

  function updateStat(pid, field, value) {
    var num = field === "red" ? value : parseFloat(value || "0");
    window.db.ref("gwstats/gw" + gw + "/" + pid).update((function () {
      var o = {}; o[field] = num; return o;
    })());
  }

  function computeAndSave() {
    recomputeResultsForGw("gw" + gw, statsObj);
  }

  var filteredPlayers = ALL_PLAYERS.filter(function (p) {
    if (filter.pos !== "ALL" && p.pos !== filter.pos) return false;
    if (filter.club !== "ALL" && p.club !== filter.club) return false;
    if (filter.search && p.name.toLowerCase().indexOf(filter.search.toLowerCase()) === -1) return false;
    return true;
  });

  var rows = filteredPlayers.map(function (p) {
    var pid = p.id;
    var pl = p;
    var st = (statsObj && statsObj[pid]) || {};
    return React.createElement("div", { key: pid, style: { borderBottom: "1px solid #1c3253", padding: "8px 4px" } },
      React.createElement("div", { style: { fontWeight: 700, fontSize: 13, marginBottom: 4 } }, pl.name + " (" + pl.pos + ", " + pl.club + ")"),
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
        ["mins", "goals", "assists", "cbit", "saves", "ownGoals", "yellow", "goalsConceded", "penSaveGK", "penMissTaker", "bonus"].map(function (field) {
          return React.createElement("input", {
            key: field, placeholder: field, defaultValue: st[field] || "",
            onBlur: function (e) { updateStat(pid, field, e.target.value); },
            style: { width: 62, padding: 6, fontSize: 11, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 }
          });
        }),
        React.createElement("label", { style: { fontSize: 11, display: "flex", alignItems: "center", gap: 4 } },
          React.createElement("input", { type: "checkbox", defaultChecked: !!st.red, onChange: function (e) { updateStat(pid, "red", e.target.checked); } }),
          "Red"
        )
      )
    );
  });

  return React.createElement(Card, null,
    React.createElement(Btn, { onClick: syncEverything }, "\u21bb Sync fixtures + stats"),
    React.createElement("div", { style: { fontSize: 11, opacity: 0.7, margin: "8px 0 14px" } }, "Pulls all season fixtures from football-data.org (free), then match stats from the official Fantasy Premier League API for every finished gameweek (goals, assists, cards, defensive contribution, and bonus points all included), then recalculates every team's scores. If a sync looks wrong or comes back empty, check the per-gameweek view below and top up by hand."),
    React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid #1c3253", paddingTop: 12 } },
      React.createElement("span", { style: { fontSize: 13 } }, "Gameweek"),
      React.createElement("input", { value: gw, onChange: function (e) { setGw(e.target.value); }, style: { width: 50, padding: 6, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } }),
      React.createElement(Btn, { variant: "ghost", onClick: syncStatsFromApi }, "Sync stats for this GW only"),
      React.createElement(Btn, { variant: "ghost", onClick: computeAndSave }, "Recompute this GW only")
    ),
    syncMsg ? React.createElement("div", { style: { fontSize: 11, color: "#ffd23f", marginBottom: 8 } }, syncMsg) : null,
    React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" } },
      ["ALL", "GK", "DEF", "MID", "FWD"].map(function (p) {
        return React.createElement("button", {
          key: p, onClick: function (val) { return function () { setFilter(Object.assign({}, filter, { pos: val })); }; }(p),
          style: { padding: "6px 10px", borderRadius: 8, border: "none", background: filter.pos === p ? "#ffd23f" : "#1c3253", color: filter.pos === p ? "#12233f" : "#fff", fontSize: 11, fontWeight: 700 }
        }, p);
      })
    ),
    React.createElement("select", {
      value: filter.club, onChange: function (e) { setFilter(Object.assign({}, filter, { club: e.target.value })); },
      style: { width: "100%", padding: 8, borderRadius: 8, marginBottom: 8, background: "#1c3253", color: "#fff", border: "none" }
    }, [React.createElement("option", { key: "ALL", value: "ALL" }, "All clubs")].concat(ALL_CLUBS.map(function (c) { return React.createElement("option", { key: c, value: c }, c); }))),
    React.createElement("input", {
      placeholder: "Search player", value: filter.search,
      onChange: function (e) { setFilter(Object.assign({}, filter, { search: e.target.value })); },
      style: { width: "100%", padding: 8, borderRadius: 8, marginBottom: 10, background: "#1c3253", color: "#fff", border: "none" }
    }),
    React.createElement("div", { style: { fontSize: 11, opacity: 0.7, marginBottom: 8 } }, "Showing " + filteredPlayers.length + " of " + ALL_PLAYERS.length + " players. Fields blur-save individually. \"cbit\" = combined clearances + blocks + interceptions + tackles (+ recoveries for MID/FWD) \u2014 needs 10 (GK/DEF) or 12 (MID/FWD) for the +2 bonus. \"saves\" is GK shot saves (every 3 = +1). Clean sheet is worked out automatically from goalsConceded \u2014 no separate tick needed."),
    React.createElement("div", { style: { maxHeight: 420, overflowY: "auto" } }, rows)
  );
}

function AdminEntrants(props) {
  var teamsObj = props.teams;
  var teamIds = Object.keys(teamsObj || {});
  var syncArr = React.useState("");
  var syncMsg = syncArr[0];
  var setSyncMsg = syncArr[1];
  var gwArr = useDbValue("config/currentGameweek", 1);
  var currentGw = gwArr[0];
  var editIdArr = React.useState(null);
  var editId = editIdArr[0];
  var setEditId = editIdArr[1];
  var editValArr = React.useState({ teamName: "", entrantName: "" });
  var editVal = editValArr[0];
  var setEditVal = editValArr[1];

  function setSweepstake(tid, club) {
    window.db.ref("teams/" + tid).update({ sweepstakeClub: club || null });
  }

  function startEdit(tid, t) {
    setEditId(tid);
    setEditVal({ teamName: t.teamName || "", entrantName: t.entrantName || "" });
  }

  function saveEdit(tid) {
    if (!editVal.teamName.trim() || !editVal.entrantName.trim()) return;
    window.db.ref("teams/" + tid).update({
      teamName: editVal.teamName.trim(),
      entrantName: editVal.entrantName.trim()
    }).then(function () {
      setEditId(null);
    });
  }

  function exportTeamsCSV() {
    var lines = [];
    for (var i = 0; i < teamIds.length; i++) {
      var tid = teamIds[i];
      var t = teamsObj[tid];
      var pmt = t.payments || {};
      var totalPaid = (pmt.a ? 40 : 0) + (pmt.b ? 20 : 0) + (pmt.c ? 20 : 0);
      var owed = 80 - totalPaid;
      var emStatus = "Not used";
      if (t.pendingEmergency) {
        emStatus = t.pendingEmergency.effectiveGw <= currentGw
          ? "Applied (from GW" + t.pendingEmergency.effectiveGw + ")"
          : "Pending, effective GW" + t.pendingEmergency.effectiveGw;
      } else if (t.emergencyUsed) {
        emStatus = "Used";
      }
      var sortedIds = sortIdsByPos(t.playerIds || []);

      lines.push(["Entrant Name", t.entrantName || ""].map(csvEscape).join(","));
      lines.push(["Phone Number", t.phone || ""].map(csvEscape).join(","));
      lines.push(["Email", t.email || ""].map(csvEscape).join(","));
      lines.push(["Team Name", t.teamName || ""].map(csvEscape).join(","));
      lines.push(["Payment Status", "Paid \u00a3" + totalPaid + ", Owed \u00a3" + owed].map(csvEscape).join(","));
      lines.push(["Emergency Transfer", emStatus].map(csvEscape).join(","));
      lines.push(["Sweepstake Team", t.sweepstakeClub || ""].map(csvEscape).join(","));
      for (var s = 0; s < 11; s++) {
        var pl = sortedIds[s] ? PLAYERS_BY_ID[sortedIds[s]] : null;
        var label = "Player " + (s + 1);
        lines.push([label, pl ? (pl.name + " (" + pl.pos + ", " + pl.club + ")") : ""].map(csvEscape).join(","));
      }
      lines.push("");
    }
    var csv = lines.join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "dreamteam-entrants-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function togglePayment(tid, key, current) {
    window.db.ref("teams/" + tid + "/payments").update((function () { var o = {}; o[key] = !current; return o; })());
  }

  function deleteTeam(tid, teamName) {
    var ok = window.confirm("Delete \"" + teamName + "\" permanently? This can't be undone.");
    if (!ok) return;
    window.db.ref("teams/" + tid).remove();
  }

  var paidCount = 0;
  for (var pc = 0; pc < teamIds.length; pc++) {
    var pmt = teamIds[pc] && teamsObj[teamIds[pc]].payments;
    if (pmt && pmt.a && pmt.b && pmt.c) paidCount++;
  }

  var sweepstakeOptions = [React.createElement("option", { key: "none", value: "" }, "\u2014 not assigned \u2014")].concat(
    ALL_CLUBS.map(function (c) { return React.createElement("option", { key: c, value: c }, c); })
  );

  var rows = teamIds.map(function (tid) {
    var t = teamsObj[tid];
    var pmt = t.payments || {};
    var totalPaid = (pmt.a ? 40 : 0) + (pmt.b ? 20 : 0) + (pmt.c ? 20 : 0);
    var emStatus = "not used";
    if (t.pendingEmergency) {
      emStatus = t.pendingEmergency.effectiveGw <= currentGw
        ? "applied (from GW" + t.pendingEmergency.effectiveGw + ")"
        : "pending \u2014 auto-applies from GW" + t.pendingEmergency.effectiveGw;
    } else if (t.emergencyUsed) {
      emStatus = "used";
    }
    var payButtons = [
      { key: "a", label: "\u00a340" },
      { key: "b", label: "\u00a320" },
      { key: "c", label: "\u00a320" }
    ].map(function (p) {
      var on = !!pmt[p.key];
      return React.createElement("button", {
        key: p.key,
        onClick: function (id, k, cur) { return function () { togglePayment(id, k, cur); }; }(tid, p.key, on),
        style: {
          padding: "5px 8px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 11,
          background: on ? "#2c5f2d" : "#c0392b", color: "#fff", marginLeft: 4
        }
      }, p.label);
    });
    var isEditing = editId === tid;
    var nameBlock = isEditing
      ? React.createElement("div", { style: { marginBottom: 6 } },
          React.createElement("input", {
            placeholder: "Team name", value: editVal.teamName,
            onChange: function (e) { setEditVal(Object.assign({}, editVal, { teamName: e.target.value })); },
            style: { width: "100%", padding: 8, borderRadius: 6, marginBottom: 6, background: "#12233f", color: "#fff", border: "1px solid #3d5a8a", fontSize: 12 }
          }),
          React.createElement("input", {
            placeholder: "Entrant name", value: editVal.entrantName,
            onChange: function (e) { setEditVal(Object.assign({}, editVal, { entrantName: e.target.value })); },
            style: { width: "100%", padding: 8, borderRadius: 6, background: "#12233f", color: "#fff", border: "1px solid #3d5a8a", fontSize: 12 }
          })
        )
      : React.createElement("div", null,
          React.createElement("b", null, t.teamName), " \u2014 ", t.entrantName, " \u00b7 ", t.formation, " \u00b7 ", fmtMoney(t.cost || 0)
        );
    return React.createElement("div", { key: tid, style: { padding: "8px 4px", borderBottom: "1px solid #1c3253", fontSize: 12 } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 4 } },
        nameBlock,
        React.createElement("div", { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 } },
          isEditing ? null : payButtons,
          isEditing
            ? React.createElement("button", {
                onClick: function (id) { return function () { saveEdit(id); }; }(tid),
                style: { padding: "5px 10px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 11, background: "#2c5f2d", color: "#fff" }
              }, "Save details")
            : React.createElement("button", {
                onClick: function (id, team) { return function () { startEdit(id, team); }; }(tid, t),
                style: { padding: "5px 8px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 11, background: "#1c3253", color: "#ffd23f", marginLeft: 4 }
              }, "Edit"),
          React.createElement("button", {
            onClick: function (id, name) { return function () { deleteTeam(id, name); }; }(tid, t.teamName),
            style: { padding: "5px 8px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 11, background: "#3a1c1c", color: "#ff9a9a", marginLeft: 4 }
          }, "Delete")
        )
      ),
      React.createElement("div", { style: { opacity: 0.85, fontSize: 11, marginTop: 4 } },
        "\ud83d\udcde " + (t.phone || "\u2014") + "  \u2709\ufe0f " + (t.email || "\u2014")
      ),
      React.createElement("div", { style: { opacity: 0.6, fontSize: 11, marginTop: 2 } },
        "Paid \u00a3" + totalPaid + " of \u00a380 \u00b7 transfers logged: ", (t.transferLog || []).length, " \u00b7 emergency: ", emStatus
      ),
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginTop: 6 } },
        React.createElement("span", { style: { fontSize: 11, opacity: 0.8 } }, "\ud83c\udfc6 Sweepstake team:"),
        React.createElement("select", {
          value: t.sweepstakeClub || "", onChange: function (id) { return function (e) { setSweepstake(id, e.target.value); }; }(tid),
          style: { flex: 1, padding: 6, borderRadius: 6, background: "#12233f", color: "#fff", border: "1px solid #3d5a8a", fontSize: 11 }
        }, sweepstakeOptions)
      )
    );
  });

  return React.createElement(Card, null,
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 } },
      React.createElement("div", { style: { fontWeight: 700 } }, "Entrants (" + teamIds.length + " teams, " + paidCount + " fully paid)"),
      React.createElement(Btn, { variant: "ghost", onClick: exportTeamsCSV }, "\u2b07\ufe0f Export")
    ),
    React.createElement("div", { style: { fontSize: 11, opacity: 0.7, marginBottom: 8 } }, "Emergency transfers apply automatically once their effective gameweek arrives \u2014 no action needed here. Scores recalculate automatically whenever fixtures/stats are synced from Admin > Stats entry."),
    syncMsg ? React.createElement("div", { style: { fontSize: 11, color: "#ffd23f", marginBottom: 8 } }, syncMsg) : null,
    rows
  );
}

/* ---------------- My Team / Transfers ---------------- */

function MyTeam(props) {
  var teamsObj = props.teams || {};
  var config = props.config || {};
  var nameArr = React.useState("");
  var nameInput = nameArr[0];
  var setNameInput = nameArr[1];
  var pinArr = React.useState("");
  var pinInput = pinArr[0];
  var setPinInput = pinArr[1];
  var matchIdsArr = React.useState([]);
  var matchIds = matchIdsArr[0];
  var setMatchIds = matchIdsArr[1];
  var foundArr = React.useState(null);
  var foundId = foundArr[0];
  var setFoundId = foundArr[1];
  var errArr = React.useState("");
  var err = errArr[0];
  var setErr = errArr[1];
  var outArr = React.useState(null);
  var outId = outArr[0];
  var setOutId = outArr[1];
  var editingArr = React.useState(false);
  var editing = editingArr[0];
  var setEditing = editingArr[1];
  var squadViewArr = React.useState("list");
  var squadView = squadViewArr[0];
  var setSquadView = squadViewArr[1];
  var modeArr = React.useState(null);
  var mode = modeArr[0];
  var setMode = modeArr[1];
  var msgArr = React.useState("");
  var msg = msgArr[0];
  var setMsg = msgArr[1];

  function trySignIn() {
    var name = nameInput.trim().toLowerCase();
    var pin = pinInput.trim();
    if (!name || !pin) { setErr("Enter your name (or team name) and your PIN."); return; }
    var ids = Object.keys(teamsObj);
    var matches = [];
    for (var i = 0; i < ids.length; i++) {
      var t = teamsObj[ids[i]];
      if (!t || (t.pin || "") !== pin) continue;
      var entrantMatch = (t.entrantName || "").trim().toLowerCase() === name;
      var teamMatch = (t.teamName || "").trim().toLowerCase() === name;
      if (entrantMatch || teamMatch) matches.push(ids[i]);
    }
    if (!matches.length) { setErr("No team found with that name and PIN."); return; }
    setErr("");
    if (matches.length === 1) {
      dtSaveLogin(matches[0]);
      setFoundId(matches[0]);
    } else {
      setMatchIds(matches);
    }
  }

  function signOut() {
    dtClearLogin();
    setFoundId(null);
    setNameInput("");
    setPinInput("");
    setMatchIds([]);
  }

  React.useEffect(function () {
    if (foundId) return;
    var savedId = dtLoadLogin();
    if (savedId && teamsObj[savedId]) {
      setFoundId(savedId);
    }
  }, [teamsObj]);

  React.useEffect(function () {
    if (!foundId) return;
    var t = teamsObj[foundId];
    if (!t) return;
    var pend = t.pendingEmergency;
    var curGw = (config.currentGameweek) || 1;
    if (!pend || pend.effectiveGw > curGw) return;
    var ids = t.playerIds || [];
    var idx = ids.indexOf(pend.outId);
    if (idx < 0) return;
    var newIds = ids.slice(0, idx).concat([pend.inId]).concat(ids.slice(idx + 1));
    var entry = { type: "emergency", outId: pend.outId, inId: pend.inId, outName: pend.outName, inName: pend.inName, timestamp: nowMs() };
    window.db.ref("teams/" + foundId).update({
      playerIds: newIds,
      cost: squadCost(newIds),
      pendingEmergency: null,
      transferLog: (t.transferLog || []).concat([entry])
    });
  }, [foundId, teamsObj, config]);

  if (matchIds.length > 0 && !foundId) {
    var pickRows = matchIds.map(function (id) {
      var t = teamsObj[id];
      return React.createElement("div", {
        key: id, onClick: function (tid) { return function () { dtSaveLogin(tid); setFoundId(tid); setMatchIds([]); }; }(id),
        style: { padding: "10px 12px", borderRadius: 8, marginBottom: 6, background: "#1c3253" }
      },
        React.createElement("div", { style: { fontWeight: 700, fontSize: 14 } }, t.teamName),
        React.createElement("div", { style: { fontSize: 11, opacity: 0.7 } }, t.entrantName + " \u00b7 " + t.formation)
      );
    });
    return React.createElement(React.Fragment, null,
      React.createElement(Header, { sub: "Choose a team" }),
      React.createElement(Card, null,
        React.createElement("div", { style: { fontSize: 12, opacity: 0.7, marginBottom: 8 } }, "You have more than one team with that name and PIN \u2014 pick which one to manage."),
        pickRows
      )
    );
  }

  if (!foundId) {
    return React.createElement(React.Fragment, null,
      React.createElement(Header, { sub: "My team" }),
      React.createElement(Card, null,
        React.createElement("div", { style: { fontSize: 13, marginBottom: 10 } }, "Sign in with your name (or your team name) and the PIN you chose when you submitted your team."),
        React.createElement("input", {
          placeholder: "Your name or team name", value: nameInput,
          onChange: function (e) { setNameInput(e.target.value); },
          style: { width: "100%", padding: 10, borderRadius: 8, marginBottom: 8, background: "#1c3253", color: "#fff", border: "none" }
        }),
        React.createElement("input", {
          placeholder: "PIN", value: pinInput, type: "password", inputMode: "numeric",
          onChange: function (e) { setPinInput(e.target.value); },
          onKeyDown: function (e) { if (e.key === "Enter") trySignIn(); },
          style: { width: "100%", padding: 10, borderRadius: 8, marginBottom: 10, background: "#1c3253", color: "#fff", border: "none" }
        }),
        err ? React.createElement("div", { style: { fontSize: 12, color: "#ff9a9a", marginBottom: 8 } }, err) : null,
        React.createElement(Btn, { onClick: trySignIn }, "Sign in")
      )
    );
  }

  var team = teamsObj[foundId];
  var siblingIds = Object.keys(teamsObj).filter(function (id) {
    var t = teamsObj[id];
    return t && t.pin === team.pin && (t.entrantName || "").trim().toLowerCase() === (team.entrantName || "").trim().toLowerCase();
  });

  function switchTeam(id) {
    if (id === foundId) return;
    dtSaveLogin(id);
    setFoundId(id);
    setOutId(null);
    setMode(null);
    setEditing(false);
  }

  var now = nowMs();
  var deadlineMs = new Date(CFG.entryDeadline + "T23:59:59").getTime();
  var preSeasonUnlimited = now < deadlineMs;
  var windows = config.transferWindows || CFG.transferWindows;
  var emergencyPeriods = config.emergencyWindows || CFG.emergencyWindows;
  var currentGw = config.currentGameweek || 1;
  var winIdx = activeWindowIndex(windows, now);
  var windowOpen = winIdx >= 0;
  var usedThisWindow = 0;
  var log = team.transferLog || [];
  for (var li = 0; li < log.length; li++) {
    if (log[li].type === "window" && log[li].windowIndex === winIdx) usedThisWindow++;
  }
  var windowTransfersLeft = CFG.transfersPerWindow - usedThisWindow;
  var emergencyAvailable = !team.emergencyUsed && !windowOpen && inAnyPeriod(emergencyPeriods, now);
  var pending = team.pendingEmergency || null;
  var teamPmt = team.payments || {};
  var teamPaid = (teamPmt.a ? 40 : 0) + (teamPmt.b ? 20 : 0) + (teamPmt.c ? 20 : 0);
  var teamOwed = 80 - teamPaid;

  if (editing) {
    return React.createElement(TeamBuilder, {
      players: ALL_PLAYERS, gwstats: props.gwstats,
      mode: "edit", teamId: foundId, initialSelected: team.playerIds || [],
      onSaved: function () { setEditing(false); },
      onCancel: function () { setEditing(false); }
    });
  }

  function doRemove(id) { setOutId(id); setMode(null); }

  function startTransfer(kind) {
    if (!outId) { setMsg("Pick a player to transfer out first."); return; }
    setMode(kind);
    setMsg("");
  }

  function completeTransfer(inId) {
    var outPl = PLAYERS_BY_ID[outId];
    var inPl = PLAYERS_BY_ID[inId];
    if (!outPl || !inPl) return;
    var ids = team.playerIds || [];
    var idx = ids.indexOf(outId);
    if (idx < 0) return;
    var newIds = ids.slice(0, idx).concat([inId]).concat(ids.slice(idx + 1));
    if (squadCost(newIds) > CFG.budgetCap) { setMsg("That would take the squad over " + fmtMoney(CFG.budgetCap) + "."); return; }
    var cc = clubCounts(ids.slice(0, idx).concat(ids.slice(idx + 1)));
    if ((cc[inPl.club] || 0) >= CFG.maxPerClub) { setMsg("Already have " + CFG.maxPerClub + " players from " + inPl.club + "."); return; }

    if (mode === "window") {
      var entry = { type: "window", windowIndex: winIdx, outId: outId, inId: inId, outName: outPl.name, inName: inPl.name, timestamp: now };
      window.db.ref("teams/" + foundId).update({
        playerIds: newIds,
        cost: squadCost(newIds),
        transferLog: log.concat([entry])
      }).then(function () {
        setOutId(null);
        setMode(null);
        setMsg("Transfer complete.");
      });
    } else if (mode === "unlimited") {
      var freeEntry = { type: "unlimited", outId: outId, inId: inId, outName: outPl.name, inName: inPl.name, timestamp: now };
      window.db.ref("teams/" + foundId).update({
        playerIds: newIds,
        cost: squadCost(newIds),
        transferLog: log.concat([freeEntry])
      }).then(function () {
        setOutId(null);
        setMode(null);
        setMsg("Swap complete \u2014 unlimited changes are still available until midnight 16th August.");
      });
    } else if (mode === "emergency") {
      var pendingEntry = { outId: outId, inId: inId, outName: outPl.name, inName: inPl.name, effectiveGw: currentGw + 1, requestedAt: now };
      window.db.ref("teams/" + foundId).update({
        emergencyUsed: true,
        pendingEmergency: pendingEntry
      }).then(function () {
        setOutId(null);
        setMode(null);
        setMsg("Emergency transfer locked in \u2014 it will take effect from the start of Gameweek " + (currentGw + 1) + " kick-off.");
      });
    }
  }

  if (mode) {
    var outPos = PLAYERS_BY_ID[outId].pos;
    var already = team.playerIds || [];
    var eligible = ALL_PLAYERS.filter(function (p) {
      return p.pos === outPos && already.indexOf(p.id) < 0;
    });
    var rows = eligible.map(function (p) {
      return React.createElement("div", {
        key: p.id, onClick: function (pid) { return function () { completeTransfer(pid); }; }(p.id),
        style: { display: "flex", justifyContent: "space-between", padding: "9px 10px", borderRadius: 8, marginBottom: 6, background: "#1c3253" }
      },
        React.createElement("div", null,
          React.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, p.name),
          React.createElement("div", { style: { fontSize: 11, opacity: 0.7 } }, p.club)
        ),
        React.createElement("div", { style: { fontWeight: 700, color: "#ffd23f" } }, fmtMoney(p.price))
      );
    });
    return React.createElement(React.Fragment, null,
      React.createElement(Header, { sub: "Transfer in a " + POS_LABEL[outPos] }),
      React.createElement(Card, null,
        React.createElement(Btn, { variant: "ghost", onClick: function () { setMode(null); } }, "\u2190 Cancel"),
        msg ? React.createElement("div", { style: { fontSize: 12, color: "#ff9a9a", margin: "10px 0" } }, msg) : null,
        React.createElement("div", { style: { maxHeight: 420, overflowY: "auto", marginTop: 10 } }, rows)
      )
    );
  }

  var gwstatsAll = props.gwstats || {};
  var gwstatsKeysAll = Object.keys(gwstatsAll);
  var maxSyncedGwNum = 0;
  var maxSyncedGwId = null;
  for (var gsx = 0; gsx < gwstatsKeysAll.length; gsx++) {
    var gn = parseInt(gwstatsKeysAll[gsx].replace("gw", ""), 10);
    if (!isNaN(gn) && gn > maxSyncedGwNum) { maxSyncedGwNum = gn; maxSyncedGwId = gwstatsKeysAll[gsx]; }
  }
  var latestStats = maxSyncedGwId ? gwstatsAll[maxSyncedGwId] : {};
  var effIdsForWeek = maxSyncedGwNum ? effectiveSquad(team, maxSyncedGwNum) : (team.playerIds || []);
  var teamWeeklyPoints = 0;
  for (var wpi = 0; wpi < effIdsForWeek.length; wpi++) {
    var wpl = PLAYERS_BY_ID[effIdsForWeek[wpi]];
    if (wpl) teamWeeklyPoints += computeScore(latestStats[effIdsForWeek[wpi]], wpl.pos);
  }

  var squadRows = sortIdsByPos(team.playerIds || []).map(function (id) {
    var pl = PLAYERS_BY_ID[id];
    if (!pl) return null;
    var isOut = outId === id;
    var pts = maxSyncedGwId ? computeScore(latestStats[id], pl.pos) : null;
    return React.createElement("div", {
      key: id, onClick: function (pid) { return function () { doRemove(pid); }; }(id),
      style: { display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, marginBottom: 6, background: isOut ? "#c0392b" : "#1c3253" }
    },
      React.createElement("div", null,
        React.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, pl.name),
        React.createElement("div", { style: { fontSize: 11, opacity: 0.7 } }, pl.pos + " \u00b7 " + pl.club)
      ),
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
        pts !== null ? React.createElement("button", {
          onClick: function (pid, st, lbl) { return function (e) { e.stopPropagation(); openPlayerBreakdown(pid, st, lbl); }; }(id, latestStats[id], "GW" + maxSyncedGwNum),
          style: { background: "#274b8c", border: "none", borderRadius: 8, padding: "4px 8px", color: "#ffd23f", fontWeight: 700, fontSize: 12 }
        }, pts + " pts") : null,
        React.createElement("div", { style: { fontWeight: 700, color: "#ffd23f" } }, fmtMoney(pl.price))
      )
    );
  });

  var groupedSquad = groupByPos(team.playerIds || []);
  var pitchRowsSquad = POS_ORDER.map(function (pos) {
    var chips = groupedSquad[pos].map(function (id) {
      var pl = PLAYERS_BY_ID[id];
      if (!pl) return null;
      var isOut = outId === id;
      var pts = maxSyncedGwId ? computeScore(latestStats[id], pl.pos) : null;
      return React.createElement("div", {
        key: id, onClick: function (pid) { return function () { doRemove(pid); }; }(id),
        style: { background: isOut ? "#c0392b" : "#274b8c", borderRadius: 10, padding: "8px 6px", textAlign: "center", flex: 1, minWidth: 78, margin: 3 }
      },
        React.createElement("div", { style: { fontSize: 12, fontWeight: 700 } }, pl.name),
        React.createElement("div", { style: { fontSize: 10, opacity: 0.8 } }, pl.club),
        React.createElement("div", { style: { fontSize: 11, color: "#ffd23f", fontWeight: 700 } }, fmtMoney(pl.price)),
        pts !== null ? React.createElement("button", {
          onClick: function (pid, st, lbl) { return function (e) { e.stopPropagation(); openPlayerBreakdown(pid, st, lbl); }; }(id, latestStats[id], "GW" + maxSyncedGwNum),
          style: { marginTop: 4, background: "#12233f", border: "none", borderRadius: 6, padding: "2px 6px", color: "#ffd23f", fontWeight: 700, fontSize: 11, width: "100%" }
        }, pts + " pts") : null
      );
    });
    return React.createElement("div", { key: pos, style: { marginBottom: 10 } },
      React.createElement("div", { style: { fontSize: 11, opacity: 0.7, marginBottom: 4, marginLeft: 4 } }, POS_LABEL[pos]),
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap" } }, chips)
    );
  });
  var squadPitchView = React.createElement("div", {
    style: { background: "linear-gradient(180deg,#1d5c2e,#164623)", borderRadius: 16, margin: "0 0 10px", padding: "14px 8px" }
  }, pitchRowsSquad);

  var statusLines = [];
  if (preSeasonUnlimited) {
    statusLines.push(React.createElement("div", { key: "unlimited", style: { fontSize: 12, color: "#6fcf6f", marginBottom: 6 } }, "Unlimited changes available until midnight on the 16th August \u2014 use Edit team below."));
  }
  if (pending) {
    statusLines.push(React.createElement("div", { key: "pend", style: { fontSize: 12, color: "#ffd23f", marginBottom: 6 } },
      "Emergency transfer pending: " + pending.outName + " \u2192 " + pending.inName + ", effective from Gameweek " + pending.effectiveGw + " kick-off."));
  } else if (team.emergencyUsed) {
    statusLines.push(React.createElement("div", { key: "used", style: { fontSize: 12, opacity: 0.7, marginBottom: 6 } }, "Emergency transfer: already used."));
  } else if (emergencyAvailable) {
    statusLines.push(React.createElement("div", { key: "avail", style: { fontSize: 12, color: "#6fcf6f", marginBottom: 6 } }, "Emergency transfer available."));
  }
  if (!preSeasonUnlimited) {
    if (windowOpen) {
      statusLines.push(React.createElement("div", { key: "win", style: { fontSize: 12, color: "#6fcf6f", marginBottom: 6 } }, windows[winIdx].label + " is open \u2014 " + windowTransfersLeft + " of " + CFG.transfersPerWindow + " transfers left."));
    } else {
      statusLines.push(React.createElement("div", { key: "nowin", style: { fontSize: 12, opacity: 0.7, marginBottom: 6 } }, "No transfer window currently open."));
    }
  }

  return React.createElement(React.Fragment, null,
    React.createElement(Header, { sub: team.teamName }),
    siblingIds.length > 1 ? React.createElement("div", { style: { display: "flex", gap: 8, overflowX: "auto", padding: "0 14px 4px" } },
      siblingIds.map(function (id) {
        var t = teamsObj[id];
        var isActive = id === foundId;
        return React.createElement("button", {
          key: id, onClick: function (tid) { return function () { switchTeam(tid); }; }(id),
          style: {
            padding: "8px 14px", borderRadius: 20, border: "none", fontWeight: 800, fontSize: 12,
            background: isActive ? "#6fcf6f" : "#1c3253", color: isActive ? "#0e1b33" : "#fff", flexShrink: 0
          }
        }, t.teamName);
      })
    ) : null,
    React.createElement(Card, null,
      React.createElement("div", { style: { fontSize: 13, marginBottom: 4 } }, team.entrantName + " \u00b7 " + team.formation + " \u00b7 " + fmtMoney(team.cost || 0)),
      maxSyncedGwId ? React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: "#6fcf6f", marginBottom: 4 } }, "\u26bd GW" + maxSyncedGwNum + ": " + teamWeeklyPoints + " pts") : React.createElement("div", { style: { fontSize: 12, opacity: 0.6, marginBottom: 4 } }, "No gameweek scores synced yet"),
      React.createElement("div", { style: { fontSize: 12, marginBottom: 4 } },
        "\ud83d\udcb0 Paid \u00a3" + teamPaid + " of \u00a380",
        teamOwed > 0 ? React.createElement("span", { style: { color: "#ff9a9a" } }, " \u2014 " + "\u00a3" + teamOwed + " still owed") : React.createElement("span", { style: { color: "#6fcf6f" } }, " \u2014 fully paid")
      ),
      team.sweepstakeClub ? React.createElement("div", { style: { fontSize: 12, color: "#ffd23f", marginBottom: 4 } }, "\ud83c\udfc6 Sweepstake team: " + team.sweepstakeClub) : null,
      statusLines,
      React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        preSeasonUnlimited ? React.createElement(Btn, { onClick: function () { setEditing(true); } }, "Edit team") : null,
        React.createElement(Btn, { variant: "ghost", onClick: function () { setSquadView(squadView === "list" ? "pitch" : "list"); } }, squadView === "list" ? "Pitch view" : "List view"),
        React.createElement(Btn, { variant: "ghost", onClick: signOut }, "Sign out")
      )
    ),
    React.createElement(Card, null,
      React.createElement("div", { style: { fontSize: 12, opacity: 0.7, marginBottom: 8 } }, outId ? "Tap a replacement type below, or tap another player to change your out choice." : "Tap a player to transfer them out."),
      squadView === "list" ? squadRows : squadPitchView,
      outId ? React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" } },
        preSeasonUnlimited ? React.createElement(Btn, { onClick: function () { startTransfer("unlimited"); } }, "Swap player") : null,
        !preSeasonUnlimited && windowOpen && windowTransfersLeft > 0 ? React.createElement(Btn, { onClick: function () { startTransfer("window"); } }, "Use window transfer") : null,
        !preSeasonUnlimited && emergencyAvailable ? React.createElement(Btn, { variant: "danger", onClick: function () { startTransfer("emergency"); } }, "Use emergency transfer") : null
      ) : null,
      msg ? React.createElement("div", { style: { fontSize: 12, color: "#ffd23f", marginTop: 10 } }, msg) : null
    )
  );
}

function AdminSettings(props) {
  var pinArr = useDbValue("config/adminPin", "0000");
  var pin = pinArr[0];
  var stateArr = React.useState(pin);
  var val = stateArr[0];
  var setVal = stateArr[1];

  var winArr = useDbValue("config/transferWindows", CFG.transferWindows);
  var windows = winArr[0];
  var localWinArr = React.useState(windows);
  var localWindows = localWinArr[0];
  var setLocalWindows = localWinArr[1];

  var emArr = useDbValue("config/emergencyWindows", CFG.emergencyWindows);
  var emergencyPeriods = emArr[0];
  var localEmArr = React.useState(emergencyPeriods);
  var localEm = localEmArr[0];
  var setLocalEm = localEmArr[1];

  var gwArr = useDbValue("config/currentGameweek", 1);
  var currentGw = gwArr[0];
  var localGwArr = React.useState(currentGw);
  var localGw = localGwArr[0];
  var setLocalGw = localGwArr[1];

  function updateWindow(idx, field, value) {
    var next = localWindows.map(function (w, i) { return i === idx ? Object.assign({}, w, (function () { var o = {}; o[field] = value; return o; })()) : w; });
    setLocalWindows(next);
  }
  function updateEm(idx, field, value) {
    var next = localEm.map(function (w, i) { return i === idx ? Object.assign({}, w, (function () { var o = {}; o[field] = value; return o; })()) : w; });
    setLocalEm(next);
  }

  var winRows = (localWindows || []).map(function (w, idx) {
    return React.createElement("div", { key: idx, style: { marginBottom: 10 } },
      React.createElement("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 4 } }, w.label || ("Window " + (idx + 1))),
      React.createElement("div", { style: { display: "flex", gap: 6 } },
        React.createElement("input", { type: "date", value: w.opens, onChange: function (e) { updateWindow(idx, "opens", e.target.value); }, style: { flex: 1, padding: 8, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } }),
        React.createElement("input", { type: "date", value: w.closes, onChange: function (e) { updateWindow(idx, "closes", e.target.value); }, style: { flex: 1, padding: 8, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } })
      )
    );
  });
  var emRows = (localEm || []).map(function (w, idx) {
    return React.createElement("div", { key: idx, style: { marginBottom: 10 } },
      React.createElement("div", { style: { fontSize: 12, fontWeight: 700, marginBottom: 4 } }, w.label || ("Emergency period " + (idx + 1))),
      React.createElement("div", { style: { display: "flex", gap: 6 } },
        React.createElement("input", { type: "date", value: w.opens, onChange: function (e) { updateEm(idx, "opens", e.target.value); }, style: { flex: 1, padding: 8, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } }),
        React.createElement("input", { type: "date", value: w.closes, onChange: function (e) { updateEm(idx, "closes", e.target.value); }, style: { flex: 1, padding: 8, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } })
      )
    );
  });

  return React.createElement(React.Fragment, null,
    React.createElement(Card, null,
      React.createElement("div", { style: { fontWeight: 700, marginBottom: 8 } }, "Admin PIN"),
      React.createElement("input", { value: val, onChange: function (e) { setVal(e.target.value); }, style: { padding: 8, marginRight: 8, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } }),
      React.createElement(Btn, { onClick: function () { window.db.ref("config/adminPin").set(val); } }, "Save PIN")
    ),
    React.createElement(Card, null,
      React.createElement("div", { style: { fontWeight: 700, marginBottom: 8 } }, "Current gameweek"),
      React.createElement("div", { style: { fontSize: 11, opacity: 0.7, marginBottom: 8 } }, "Used to work out when a pending emergency transfer takes effect (the gameweek after this one)."),
      React.createElement("input", { value: localGw, onChange: function (e) { setLocalGw(e.target.value); }, style: { width: 60, padding: 8, marginRight: 8, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } }),
      React.createElement(Btn, { onClick: function () { window.db.ref("config/currentGameweek").set(parseInt(localGw, 10) || 1); } }, "Save")
    ),
    React.createElement(Card, null,
      React.createElement("div", { style: { fontWeight: 700, marginBottom: 8 } }, "Transfer windows"),
      winRows,
      React.createElement(Btn, { onClick: function () { window.db.ref("config/transferWindows").set(localWindows); } }, "Save transfer windows")
    ),
    React.createElement(Card, null,
      React.createElement("div", { style: { fontWeight: 700, marginBottom: 8 } }, "Emergency transfer periods"),
      React.createElement("div", { style: { fontSize: 11, opacity: 0.7, marginBottom: 8 } }, "Emergency transfer is never available while a transfer window above is open, even if the dates overlap here."),
      emRows,
      React.createElement(Btn, { onClick: function () { window.db.ref("config/emergencyWindows").set(localEm); } }, "Save emergency periods")
    )
  );
}

function AdminTab(props) {
  var subArr = React.useState("stats");
  var sub = subArr[0];
  var setSub = subArr[1];
  var subs = [
    { key: "stats", label: "Stats entry" },
    { key: "fixtures", label: "Fixtures" },
    { key: "players", label: "Players" },
    { key: "entrants", label: "Entrants" },
    { key: "settings", label: "Settings" }
  ];
  return React.createElement(AdminGate, null,
    React.createElement(Header, { sub: "Admin" }),
    React.createElement("div", { style: { display: "flex", gap: 6, padding: "0 14px 10px", flexWrap: "wrap", justifyContent: "space-between" } },
      React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
        subs.map(function (s) {
          return React.createElement("button", {
            key: s.key, onClick: function (k) { return function () { setSub(k); }; }(s.key),
            style: { padding: "6px 10px", borderRadius: 8, border: "none", background: sub === s.key ? "#ffd23f" : "#1c3253", color: sub === s.key ? "#12233f" : "#fff", fontSize: 11, fontWeight: 700 }
          }, s.label);
        })
      ),
      React.createElement("button", {
        onClick: function () { dtClearAdmin(); window.location.reload(); },
        style: { padding: "6px 10px", borderRadius: 8, border: "1px solid #ff9a9a", background: "transparent", color: "#ff9a9a", fontSize: 11, fontWeight: 700 }
      }, "Lock")
    ),
    sub === "stats" ? React.createElement(AdminStats, { teams: props.teams, fixtures: props.fixtures }) : null,
    sub === "fixtures" ? React.createElement(AdminFixtures, { fixtures: props.fixtures }) : null,
    sub === "players" ? React.createElement(AdminPlayers, { playersDb: props.playersDb, teams: props.teams }) : null,
    sub === "entrants" ? React.createElement(AdminEntrants, { teams: props.teams }) : null,
    sub === "settings" ? React.createElement(AdminSettings, null) : null
  );
}

/* ---------------- Root App ---------------- */

function openPlayerBreakdown(playerId, stat, gwLabel) {
  window.dispatchEvent(new CustomEvent("dtShowBreakdown", { detail: { playerId: playerId, stat: stat || null, gwLabel: gwLabel || "" } }));
}

function PlayerBreakdownOverlay() {
  var stateArr = React.useState(null);
  var data = stateArr[0];
  var setData = stateArr[1];

  React.useEffect(function () {
    function onShow(e) { setData(e.detail); }
    window.addEventListener("dtShowBreakdown", onShow);
    return function () { window.removeEventListener("dtShowBreakdown", onShow); };
  }, []);

  if (!data) return null;
  var pl = PLAYERS_BY_ID[data.playerId];
  if (!pl) return null;
  var breakdown = scoreBreakdown(data.stat, pl.pos);
  var lineRows = breakdown.lines.map(function (l, i) {
    return React.createElement("div", { key: i, style: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #26406e", fontSize: 13 } },
      React.createElement("span", null, l.label),
      React.createElement("b", { style: { color: l.pts >= 0 ? "#6fcf6f" : "#ff9a9a" } }, (l.pts >= 0 ? "+" : "") + l.pts)
    );
  });

  return React.createElement("div", {
    onClick: function () { setData(null); },
    style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.75)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }
  },
    React.createElement("div", {
      onClick: function (e) { e.stopPropagation(); },
      style: { background: "#152a4d", borderRadius: 16, padding: 18, maxWidth: 360, width: "100%", maxHeight: "80vh", overflowY: "auto" }
    },
      React.createElement("div", { style: { fontWeight: 800, fontSize: 17 } }, pl.name),
      React.createElement("div", { style: { fontSize: 12, opacity: 0.7, marginBottom: 12 } }, pl.pos + " \u00b7 " + pl.club + (data.gwLabel ? " \u00b7 " + data.gwLabel : "")),
      lineRows,
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid #3d5a8a", fontWeight: 800, fontSize: 15 } },
        React.createElement("span", null, "Total"),
        React.createElement("span", { style: { color: "#ffd23f" } }, breakdown.total)
      ),
      React.createElement("div", { style: { marginTop: 14 } },
        React.createElement(Btn, { variant: "ghost", onClick: function () { setData(null); } }, "Close")
      )
    )
  );
}

function App() {
  var tabArr = React.useState("home");
  var tab = tabArr[0];
  var setTab = tabArr[1];
  var regInfoArr = React.useState(null);
  var regInfo = regInfoArr[0];
  var setRegInfo = regInfoArr[1];

  var teamsArr = useDbValue("teams", {});
  var teams = teamsArr[0];
  var fixturesArr = useDbValue("fixtures", {});
  var fixtures = fixturesArr[0];
  var resultsArr = useDbValue("results", {});
  var results = resultsArr[0];
  var playersDbArr = useDbValue("players", {});
  var playersDb = playersDbArr[0];
  var gwstatsArr = useDbValue("gwstats", {});
  var gwstats = gwstatsArr[0];
  var configArr = useDbValue("config", {});
  var config = configArr[0];

  React.useEffect(function () {
    window.db.ref("players").once("value").then(function (snap) {
      if (!snap.exists()) {
        var updates = {};
        for (var i = 0; i < ALL_PLAYERS.length; i++) {
          updates[ALL_PLAYERS[i].id] = ALL_PLAYERS[i];
        }
        window.db.ref("players").set(updates);
      }
    });
  }, []);

  var playersVersionArr = React.useState(0);
  var setPlayersVersion = playersVersionArr[1];

  var seededRef = React.useRef(false);

  React.useEffect(function () {
    var ids = Object.keys(playersDb || {});
    var changed = false;
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var dbP = playersDb[id];
      if (!dbP || !dbP.name) continue;
      var existing = PLAYERS_BY_ID[id];
      if (existing) {
        if (existing.price !== dbP.price || existing.club !== dbP.club || existing.pos !== dbP.pos || existing.name !== dbP.name) {
          existing.price = dbP.price;
          existing.club = dbP.club;
          existing.pos = dbP.pos;
          existing.name = dbP.name;
          changed = true;
        }
      } else {
        var newP = { id: id, name: dbP.name, club: dbP.club, pos: dbP.pos, price: dbP.price };
        ALL_PLAYERS.push(newP);
        PLAYERS_BY_ID[id] = newP;
        if (ALL_CLUBS.indexOf(dbP.club) < 0) ALL_CLUBS.push(dbP.club);
        changed = true;
      }
    }
    if (!seededRef.current && ids.length >= STATIC_PLAYER_COUNT) {
      seededRef.current = true;
    }
    if (seededRef.current) {
      var dbIdSet = {};
      for (var j = 0; j < ids.length; j++) dbIdSet[ids[j]] = true;
      for (var k = ALL_PLAYERS.length - 1; k >= 0; k--) {
        var pid = ALL_PLAYERS[k].id;
        if (!dbIdSet[pid]) {
          ALL_PLAYERS.splice(k, 1);
          delete PLAYERS_BY_ID[pid];
          changed = true;
        }
      }
    }
    if (changed) setPlayersVersion(function (v) { return v + 1; });
  }, [playersDb]);

  var tabs = [
    { key: "home", label: "Home" },
    { key: "team", label: "Build" },
    { key: "myteam", label: "My Team" },
    { key: "table", label: "Table" },
    { key: "fixtures", label: "Fixtures" },
    { key: "scores", label: "Stats" },
    { key: "rules", label: "Rules" },
    { key: "admin", label: "Admin" }
  ];

  var body = null;
  if (tab === "home") body = React.createElement(Home, { onNav: setTab });
  else if (tab === "team" && !regInfo) body = React.createElement(AccountSetup, { onDone: function (info) { setRegInfo(info); }, teams: teams });
  else if (tab === "team") body = React.createElement(TeamBuilder, {
    players: ALL_PLAYERS, gwstats: gwstats, regInfo: regInfo,
    onSubmitted: function () { setRegInfo(null); setTab("myteam"); }
  });
  else if (tab === "myteam") body = React.createElement(MyTeam, { teams: teams, config: config, gwstats: gwstats });
  else if (tab === "table") body = React.createElement(LeagueTable, { teams: teams, results: results, gwstats: gwstats });
  else if (tab === "fixtures") body = React.createElement(Fixtures, { fixtures: fixtures, gwstats: gwstats });
  else if (tab === "scores") body = React.createElement(PlayersScoresTab, { gwstats: gwstats });
  else if (tab === "rules") body = React.createElement(RulesTab, null);
  else if (tab === "admin") body = React.createElement(AdminTab, { teams: teams, fixtures: fixtures, playersDb: playersDb });

  var fbWarning = window.DT_FIREBASE_OK ? null : React.createElement("div", {
    style: { background: "#c0392b", color: "#fff", fontSize: 12, padding: "8px 12px", textAlign: "center" }
  }, "Not connected to Firebase yet \u2014 paste your project keys into index.html. Nothing will save until then.");

  return React.createElement(React.Fragment, null,
    fbWarning,
    body,
    React.createElement(TopNav, { tabs: tabs, active: tab, onSelect: setTab }),
    React.createElement(PlayerBreakdownOverlay, null)
  );
}

var rootEl = document.getElementById("root");
var root = ReactDOM.createRoot(rootEl);
root.render(React.createElement(App, null));
