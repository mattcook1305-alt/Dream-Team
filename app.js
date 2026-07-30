/* Grzegorz Lutecki Dream Team - main app */

var CFG = window.DT_CONFIG;
var ALL_PLAYERS = window.DT_PLAYERS;
var ALL_CLUBS = window.DT_CLUBS;

var PLAYERS_BY_ID = {};
for (var pbi = 0; pbi < ALL_PLAYERS.length; pbi++) {
  PLAYERS_BY_ID[ALL_PLAYERS[pbi].id] = ALL_PLAYERS[pbi];
}

function fmtMoney(n) {
  var v = Math.round(n * 10) / 10;
  return "\u00a3" + v.toFixed(1) + "m";
}

function computeScore(stat, pos) {
  if (!stat) return 0;
  var pts = 0;
  var mins = stat.mins || 0;
  if (mins >= 60) pts += 2;
  else if (mins > 0) pts += 1;

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
    .replace(/[^a-z0-9 ]/g, "")
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
      var ev = findSofaEventForMatch(dayData, home, away);
      if (!ev) throw new Error("Couldn't find " + home + " v " + away + " on " + day + " in SofaScore's day list.");
      var homeConceded = ev.awayScore ? ev.awayScore.current : null;
      var awayConceded = ev.homeScore ? ev.homeScore.current : null;
      return fetch("/.netlify/functions/sofascore-proxy?action=lineups&event=" + ev.id)
        .then(function (r) { return r.json(); })
        .then(function (lineupData) {
          return mapSofaLineupsToUpdates(lineupData, homeConceded, awayConceded, home, away);
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

function findLocalPlayerMatch(apiName, clubName) {
  var target = normName(apiName);
  var targetClub = normName(clubName);
  var best = null;
  for (var i = 0; i < ALL_PLAYERS.length; i++) {
    var p = ALL_PLAYERS[i];
    var pn = normName(p.name);
    var pc = normName(p.club);
    var clubOk = targetClub && (pc.indexOf(targetClub) >= 0 || targetClub.indexOf(pc) >= 0);
    if (pn === target && clubOk) return p;
    if (pn === target && !best) best = p;
    var lastTarget = target.split(" ").slice(-1)[0];
    var lastLocal = pn.split(" ").slice(-1)[0];
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
    padding: "10px 16px", borderRadius: 10, border: "none", fontWeight: 700,
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
  var formArr = React.useState({ entrantName: "", teamName: "", phone: "", pin: "" });
  var form = formArr[0];
  var setForm = formArr[1];
  var errArr = React.useState("");
  var err = errArr[0];
  var setErr = errArr[1];

  var existingMatch = findExistingTeamForName(props.teams, form.entrantName);

  function next() {
    if (!form.entrantName.trim() || !form.teamName.trim()) { setErr("Enter your name and a team name."); return; }
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
        placeholder: "Phone (optional)", value: form.phone,
        onChange: function (e) { setForm(Object.assign({}, form, { phone: e.target.value })); },
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
    React.createElement("div", { style: { display: "flex", gap: 8 } },
      React.createElement(Btn, { variant: "ghost", onClick: function () { setShowFormPicker(true); } }, "Change formation"),
      React.createElement(Btn, { variant: "ghost", onClick: function () { setView(view === "pitch" ? "list" : "pitch"); } }, view === "pitch" ? "List view" : "Pitch view")
    )
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

  if (detailTeam) {
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
      var pids = team.playerIds || [];
      var playerRows = pids.map(function (pid) {
        var pl = PLAYERS_BY_ID[pid];
        if (!pl) return null;
        var sc = computeScore(statsForGw[pid], pl.pos);
        return React.createElement("div", { key: pid, style: { display: "flex", justifyContent: "space-between", padding: "6px 4px", borderBottom: "1px solid #1c3253", fontSize: 13 } },
          React.createElement("span", null, pl.name + " (" + pl.pos + ")"),
          React.createElement("b", { style: { color: "#ffd23f" } }, sc)
        );
      });
      body = playerRows;
    }
    return React.createElement(React.Fragment, null,
      React.createElement(Header, { sub: team.teamName }),
      React.createElement(Card, null,
        React.createElement(Btn, { variant: "ghost", onClick: function () { setDetailTeam(null); } }, "\u2190 Back to table"),
        React.createElement("div", { style: { marginTop: 10, fontSize: 12, opacity: 0.7, marginBottom: 8 } }, gwSel === "overall" ? "Score by gameweek" : ("Gameweek " + gwSel + " player scores")),
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
      key: row.id, onClick: function (tid) { return function () { setDetailTeam(tid); }; }(row.id),
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
      React.createElement("div", { style: { fontSize: 11, opacity: 0.6, marginBottom: 8 } }, "Tap a team to see " + (gwSel === "overall" ? "their score history" : "their player-by-player score for that week")),
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

function Fixtures(props) {
  var fixturesObj = props.fixtures;
  var gwstatsObj = props.gwstats || {};
  var selArr = React.useState(null);
  var selMatch = selArr[0];
  var setSelMatch = selArr[1];

  var gwKeys = Object.keys(fixturesObj || {}).sort(function (a, b) {
    var ga = (fixturesObj[a] && fixturesObj[a].gw) || 0;
    var gb = (fixturesObj[b] && fixturesObj[b].gw) || 0;
    return ga - gb;
  });

  if (selMatch) {
    var statsForGw = gwstatsObj[selMatch.gwId] || {};
    var synced = Object.keys(statsForGw).length > 0;
    var sides = [
      { label: selMatch.match.home, club: selMatch.match.home },
      { label: selMatch.match.away, club: selMatch.match.away }
    ];
    var sideBlocks = sides.map(function (side) {
      var clubPlayers = ALL_PLAYERS.filter(function (p) { return p.club === side.club; });
      var rows = clubPlayers.map(function (p) {
        var st = statsForGw[p.id];
        if (!st) return null;
        var sc = computeScore(st, p.pos);
        return React.createElement("div", { key: p.id, style: { display: "flex", justifyContent: "space-between", padding: "5px 4px", borderBottom: "1px solid #1c3253", fontSize: 13 } },
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

  var blocks = gwKeys.map(function (gwId) {
    var gw = fixturesObj[gwId];
    var hasStats = Object.keys(gwstatsObj[gwId] || {}).length > 0;
    var matches = (gw.matches || []).map(function (m, i) {
      var clickable = m.status === "FINISHED" && hasStats;
      return React.createElement("div", {
        key: i,
        onClick: clickable ? function (gwid, match) { return function () { setSelMatch({ gwId: gwid, match: match }); }; }(gwId, m) : undefined,
        style: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 4px", borderRadius: 6, background: clickable ? "#1c3253" : "transparent", marginBottom: 2 }
      },
        React.createElement("span", null, m.home + " v " + m.away + (m.status === "FINISHED" ? (" (" + (m.homeScore != null ? m.homeScore : "?") + "-" + (m.awayScore != null ? m.awayScore : "?") + ")") : "")),
        React.createElement("span", { style: { opacity: 0.7 } }, fmtFixtureDate(m.date))
      );
    });
    return React.createElement(Card, { key: gwId },
      React.createElement("div", { style: { fontWeight: 700, marginBottom: 6 } }, gw.label || ("Gameweek " + gw.gw)),
      matches
    );
  });
  return React.createElement(React.Fragment, null,
    React.createElement(Header, { sub: "Fixtures" }),
    gwKeys.length ? blocks : React.createElement(Card, null, React.createElement("div", { style: { opacity: 0.7, fontSize: 13 } }, "No fixtures added yet.")),
    gwKeys.length ? React.createElement("div", { style: { fontSize: 11, opacity: 0.6, padding: "0 14px 14px" } }, "Finished matches with synced stats are tappable to see every player's score.") : null
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
    var pids2 = Object.keys(statsRecent);
    for (var pj = 0; pj < pids2.length; pj++) {
      var pl2 = PLAYERS_BY_ID[pids2[pj]];
      if (!pl2) continue;
      recentScores[pids2[pj]] = computeScore(statsRecent[pids2[pj]], pl2.pos);
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
    var hasRecent = Object.prototype.hasOwnProperty.call(recentScores, p.id);
    return React.createElement("div", {
      key: p.id, style: { display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, marginBottom: 6, background: "#1c3253" }
    },
      React.createElement("div", null,
        React.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, p.name),
        React.createElement("div", { style: { fontSize: 11, opacity: 0.7 } }, p.pos + " \u00b7 " + p.club)
      ),
      React.createElement("div", { style: { textAlign: "right" } },
        React.createElement("div", { style: { fontWeight: 700, color: "#ffd23f" } }, tot + " pts"),
        React.createElement("div", { style: { fontSize: 11, opacity: 0.7 } }, hasRecent ? ("GW" + maxGwNum + ": " + recentScores[p.id]) : "\u2014")
      )
    );
  });

  return React.createElement(React.Fragment, null,
    React.createElement(Header, { sub: "Player scores" }),
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
  var okArr = React.useState(false);
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
  var priceArr = React.useState("");
  var priceVal = priceArr[0];
  var setPriceVal = priceArr[1];

  var rows = ALL_PLAYERS.slice(0, 60).map(function (p) {
    var dbP = (playersObj && playersObj[p.id]) || p;
    return React.createElement("div", { key: p.id, style: { display: "flex", justifyContent: "space-between", padding: "6px 8px", fontSize: 13, borderBottom: "1px solid #1c3253" } },
      React.createElement("div", null, dbP.name + " (" + dbP.club + ")"),
      editId === p.id
        ? React.createElement("div", null,
            React.createElement("input", { value: priceVal, onChange: function (e) { setPriceVal(e.target.value); }, style: { width: 50, marginRight: 6 } }),
            React.createElement("button", {
              onClick: function () {
                window.db.ref("players/" + p.id).update({ price: parseFloat(priceVal) });
                setEditId(null);
              }
            }, "Save")
          )
        : React.createElement("div", null,
            fmtMoney(dbP.price) + "  ",
            React.createElement("button", { onClick: function () { setEditId(p.id); setPriceVal(String(dbP.price)); } }, "Edit")
          )
    );
  });

  return React.createElement(Card, null,
    React.createElement("div", { style: { fontWeight: 700, marginBottom: 8 } }, "Players & prices (showing first 60 \u2014 use search to find more via team builder list)"),
    React.createElement("div", { style: { maxHeight: 400, overflowY: "auto" } }, rows)
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

  var squadPlayerIds = {};
  var teamIds = Object.keys(teamsObj || {});
  for (var i = 0; i < teamIds.length; i++) {
    var t = teamsObj[teamIds[i]];
    var ids = t.playerIds || [];
    for (var j = 0; j < ids.length; j++) squadPlayerIds[ids[j]] = true;
  }
  var relevantIds = Object.keys(squadPlayerIds);

  function syncStatsFromApi() {
    var gwId = "gw" + gw;
    var fx = (fixturesObj && fixturesObj[gwId]) || { matches: [] };
    var matches = fx.matches || [];
    if (!matches.length) { setSyncMsg("No fixtures stored for this gameweek \u2014 sync fixtures first."); return; }
    setSyncMsg("Fetching stats from SofaScore for " + matches.length + " fixture(s)...");
    var promises = matches.map(function (m) {
      return fetchSofaScoreStatsForFixture(m.date, m.home, m.away).catch(function (e) {
        return { updates: {}, matchedCount: 0, unmatchedNames: [], error: (m.home + " v " + m.away + ": " + (e && e.message ? e.message : e)) };
      });
    });
    Promise.all(promises).then(function (results) {
      var allUpdates = {};
      var totalMatched = 0;
      var allUnmatched = [];
      var errors = [];
      for (var ri = 0; ri < results.length; ri++) {
        var r = results[ri];
        totalMatched += r.matchedCount;
        allUnmatched = allUnmatched.concat(r.unmatchedNames);
        if (r.error) errors.push(r.error);
        for (var pid in r.updates) allUpdates[pid] = r.updates[pid];
      }
      var writes = [];
      for (var pid2 in allUpdates) {
        writes.push(window.db.ref("gwstats/" + gwId + "/" + pid2).update(allUpdates[pid2]));
      }
      Promise.all(writes).then(function () {
        var statsForGwLocal = Object.assign({}, statsObj, allUpdates);
        return recomputeResultsForGw(gwId, statsForGwLocal).then(function () {
          var msg = "Matched " + totalMatched + " players from SofaScore. Scores recalculated.";
          if (allUnmatched.length) {
            msg += " Couldn't match: " + allUnmatched.slice(0, 8).join(", ") + (allUnmatched.length > 8 ? " +" + (allUnmatched.length - 8) + " more" : "") + " \u2014 enter these manually below.";
          }
          if (errors.length) msg += " Errors: " + errors.join(" | ");
          msg += " Bonus points still need entering manually.";
          setSyncMsg(msg);
        });
      });
    }).catch(function (e) {
      setSyncMsg("Sync failed: " + (e && e.message ? e.message : e));
    });
  }

  function recomputeResultsForGw(gwId, statsForGw) {
    var scores = {};
    for (var i2 = 0; i2 < teamIds.length; i2++) {
      var tid = teamIds[i2];
      var team = teamsObj[tid];
      var total = 0;
      var pids = team.playerIds || [];
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
        var finishedByGw = {};
        for (var gk = 0; gk < gwKeys.length; gk++) {
          var finished = byGw[gwKeys[gk]].matches.filter(function (m) { return m.status === "FINISHED"; });
          if (finished.length) finishedByGw[gwKeys[gk]] = finished;
        }
        var finishedGwKeysAll = Object.keys(finishedByGw);
        if (!finishedGwKeysAll.length) {
          setSyncMsg("Fixtures synced (" + gwKeys.length + " gameweeks). No finished matches yet to pull stats for.");
          return null;
        }
        return window.db.ref("results").once("value").then(function (snap) {
          var already = snap.val() || {};
          var finishedGwKeys = finishedGwKeysAll.filter(function (k) { return !already[k]; });
          if (!finishedGwKeys.length) {
            setSyncMsg("Fixtures synced (" + gwKeys.length + " gameweeks). All finished gameweeks are already synced \u2014 previous games left untouched. Use \"Sync stats for this GW only\" to force a re-check on a specific week.");
            return null;
          }
          setSyncMsg("Fetching SofaScore stats for " + finishedGwKeys.length + " finished gameweek(s)...");
          var gwPromises = finishedGwKeys.map(function (gwId3) {
            var ms = finishedByGw[gwId3];
            var matchPromises = ms.map(function (m) {
              return fetchSofaScoreStatsForFixture(m.date, m.home, m.away).catch(function (e) {
                return { updates: {}, matchedCount: 0, unmatchedNames: [], error: (m.home + " v " + m.away + ": " + (e && e.message ? e.message : e)) };
              });
            });
            return Promise.all(matchPromises).then(function (results) {
              var statsForGwLocal = {};
              var matched = 0;
              var unmatched = 0;
              for (var ri = 0; ri < results.length; ri++) {
                matched += results[ri].matchedCount;
                unmatched += results[ri].unmatchedNames.length;
                for (var pid in results[ri].updates) statsForGwLocal[pid] = results[ri].updates[pid];
              }
              return { gwId: gwId3, stats: statsForGwLocal, matched: matched, unmatched: unmatched };
            });
          });
          return Promise.all(gwPromises).then(function (gwResults) {
            var totalMatched = 0;
            var totalUnmatched = 0;
            var statWrites = [];
            for (var g = 0; g < gwResults.length; g++) {
              totalMatched += gwResults[g].matched;
              totalUnmatched += gwResults[g].unmatched;
              for (var pid2 in gwResults[g].stats) {
                statWrites.push(window.db.ref("gwstats/" + gwResults[g].gwId + "/" + pid2).update(gwResults[g].stats[pid2]));
              }
            }
            setSyncMsg("Saving scores...");
            return Promise.all(statWrites).then(function () {
              var resultWrites = gwResults.map(function (r) { return recomputeResultsForGw(r.gwId, r.stats); });
              return Promise.all(resultWrites).then(function () {
                setSyncMsg("Done. " + gwKeys.length + " gameweeks of fixtures, stats pulled for " + finishedGwKeys.length + " finished gameweek(s), " + totalMatched + " players matched" + (totalUnmatched ? (", " + totalUnmatched + " unmatched (check per-gameweek view)") : "") + ". Bonus still needs entering by hand.");
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
    var scores = {};
    for (var i2 = 0; i2 < teamIds.length; i2++) {
      var tid = teamIds[i2];
      var team = teamsObj[tid];
      var total = 0;
      var pids = team.playerIds || [];
      for (var k = 0; k < pids.length; k++) {
        var pl = PLAYERS_BY_ID[pids[k]];
        var st = statsObj ? statsObj[pids[k]] : null;
        total += computeScore(st, pl ? pl.pos : "MID");
      }
      scores[tid] = total;
    }
    var best = null;
    for (var tid2 in scores) {
      if (best === null || scores[tid2] > scores[best]) best = tid2;
    }
    window.db.ref("results/gw" + gw).set({
      teamScores: scores,
      winnerTeamId: best,
      winnerPoints: best !== null ? scores[best] : 0
    });
  }

  var rows = relevantIds.map(function (pid) {
    var pl = PLAYERS_BY_ID[pid];
    var st = (statsObj && statsObj[pid]) || {};
    if (!pl) return null;
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
    React.createElement("div", { style: { fontSize: 11, opacity: 0.7, margin: "8px 0 14px" } }, "Pulls all season fixtures from football-data.org (free), then match stats from SofaScore for every finished gameweek, then recalculates every team's scores. SofaScore is an unofficial source \u2014 if a sync looks wrong or comes back empty, check the per-gameweek view below and top up by hand."),
    React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid #1c3253", paddingTop: 12 } },
      React.createElement("span", { style: { fontSize: 13 } }, "Gameweek"),
      React.createElement("input", { value: gw, onChange: function (e) { setGw(e.target.value); }, style: { width: 50, padding: 6, background: "#1c3253", color: "#fff", border: "none", borderRadius: 6 } }),
      React.createElement(Btn, { variant: "ghost", onClick: syncStatsFromApi }, "Sync stats for this GW only"),
      React.createElement(Btn, { variant: "ghost", onClick: computeAndSave }, "Recompute this GW only")
    ),
    syncMsg ? React.createElement("div", { style: { fontSize: 11, color: "#ffd23f", marginBottom: 8 } }, syncMsg) : null,
    React.createElement("div", { style: { fontSize: 11, opacity: 0.7, marginBottom: 8 } }, "Only players who appear in at least one submitted squad are listed. Fields blur-save individually. \"cbit\" = combined clearances + blocks + interceptions + tackles (+ recoveries for MID/FWD) \u2014 needs 10 (GK/DEF) or 12 (MID/FWD) for the +2 bonus. \"saves\" is GK shot saves (every 3 = +1). Clean sheet is worked out automatically from goalsConceded \u2014 no separate tick needed."),
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

  function togglePayment(tid, key, current) {
    window.db.ref("teams/" + tid + "/payments").update((function () { var o = {}; o[key] = !current; return o; })());
  }

  function applyDueEmergencyTransfers() {
    var writes = [];
    var applied = 0;
    for (var i = 0; i < teamIds.length; i++) {
      var tid = teamIds[i];
      var t = teamsObj[tid];
      var pend = t.pendingEmergency;
      if (pend && pend.effectiveGw <= currentGw) {
        var ids = t.playerIds || [];
        var idx = ids.indexOf(pend.outId);
        if (idx >= 0) {
          var newIds = ids.slice(0, idx).concat([pend.inId]).concat(ids.slice(idx + 1));
          var log = t.transferLog || [];
          var entry = { type: "emergency", outId: pend.outId, inId: pend.inId, outName: pend.outName, inName: pend.inName, timestamp: Date.now() };
          writes.push(window.db.ref("teams/" + tid).update({
            playerIds: newIds,
            cost: squadCost(newIds),
            pendingEmergency: null,
            transferLog: log.concat([entry])
          }));
          applied++;
        }
      }
    }
    Promise.all(writes).then(function () {
      setSyncMsg("Applied " + applied + " due emergency transfer" + (applied === 1 ? "" : "s") + ".");
    });
  }

  function syncAll() {
    setSyncMsg("Syncing...");
    window.db.ref("gwstats").once("value").then(function (snap) {
      var all = snap.val() || {};
      var gwIds = Object.keys(all);
      var writes = [];
      for (var g = 0; g < gwIds.length; g++) {
        var gwId = gwIds[g];
        var statsForGw = all[gwId];
        var scores = {};
        for (var i = 0; i < teamIds.length; i++) {
          var tid = teamIds[i];
          var team = teamsObj[tid];
          var total = 0;
          var pids = team.playerIds || [];
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
        writes.push(window.db.ref("results/" + gwId).set({
          teamScores: scores,
          winnerTeamId: best,
          winnerPoints: best !== null ? scores[best] : 0
        }));
      }
      Promise.all(writes).then(function () {
        setSyncMsg("Synced " + gwIds.length + " gameweek" + (gwIds.length === 1 ? "" : "s") + " for all teams.");
      });
    }).catch(function (e) {
      setSyncMsg("Sync failed: " + (e && e.message ? e.message : e));
    });
  }

  var paidCount = 0;
  for (var pc = 0; pc < teamIds.length; pc++) {
    var pmt = teamIds[pc] && teamsObj[teamIds[pc]].payments;
    if (pmt && pmt.a && pmt.b && pmt.c) paidCount++;
  }

  var rows = teamIds.map(function (tid) {
    var t = teamsObj[tid];
    var pmt = t.payments || {};
    var totalPaid = (pmt.a ? 40 : 0) + (pmt.b ? 20 : 0) + (pmt.c ? 20 : 0);
    var emStatus = "not used";
    if (t.pendingEmergency) emStatus = "pending, effective GW" + t.pendingEmergency.effectiveGw;
    else if (t.emergencyUsed) emStatus = "used";
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
    return React.createElement("div", { key: tid, style: { padding: "8px 4px", borderBottom: "1px solid #1c3253", fontSize: 12 } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 } },
        React.createElement("div", null,
          React.createElement("b", null, t.teamName), " \u2014 ", t.entrantName, " \u00b7 ", t.formation, " \u00b7 ", fmtMoney(t.cost || 0)
        ),
        React.createElement("div", { style: { display: "flex", alignItems: "center" } }, payButtons)
      ),
      React.createElement("div", { style: { opacity: 0.6, fontSize: 11, marginTop: 4 } },
        "Paid \u00a3" + totalPaid + " of \u00a380 \u00b7 transfers logged: ", (t.transferLog || []).length, " \u00b7 emergency: ", emStatus
      )
    );
  });

  return React.createElement(Card, null,
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 } },
      React.createElement("div", { style: { fontWeight: 700 } }, "Entrants (" + teamIds.length + " teams, " + paidCount + " fully paid)"),
      React.createElement("div", { style: { display: "flex", gap: 6 } },
        React.createElement(Btn, { variant: "ghost", onClick: applyDueEmergencyTransfers }, "Apply due emergency transfers"),
        React.createElement(Btn, { variant: "ghost", onClick: syncAll }, "Sync scores")
      )
    ),
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

  var squadRows = (team.playerIds || []).map(function (id) {
    var pl = PLAYERS_BY_ID[id];
    if (!pl) return null;
    var isOut = outId === id;
    return React.createElement("div", {
      key: id, onClick: function (pid) { return function () { doRemove(pid); }; }(id),
      style: { display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, marginBottom: 6, background: isOut ? "#c0392b" : "#1c3253" }
    },
      React.createElement("div", null,
        React.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, pl.name),
        React.createElement("div", { style: { fontSize: 11, opacity: 0.7 } }, pl.pos + " \u00b7 " + pl.club)
      ),
      React.createElement("div", { style: { fontWeight: 700, color: "#ffd23f" } }, fmtMoney(pl.price))
    );
  });

  var groupedSquad = groupByPos(team.playerIds || []);
  var pitchRowsSquad = POS_ORDER.map(function (pos) {
    var chips = groupedSquad[pos].map(function (id) {
      var pl = PLAYERS_BY_ID[id];
      if (!pl) return null;
      var isOut = outId === id;
      return React.createElement("div", {
        key: id, onClick: function (pid) { return function () { doRemove(pid); }; }(id),
        style: { background: isOut ? "#c0392b" : "#274b8c", borderRadius: 10, padding: "8px 6px", textAlign: "center", flex: 1, minWidth: 78, margin: 3 }
      },
        React.createElement("div", { style: { fontSize: 12, fontWeight: 700 } }, pl.name),
        React.createElement("div", { style: { fontSize: 10, opacity: 0.8 } }, pl.club),
        React.createElement("div", { style: { fontSize: 11, color: "#ffd23f", fontWeight: 700 } }, fmtMoney(pl.price))
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
    React.createElement(Card, null,
      React.createElement("div", { style: { fontSize: 13, marginBottom: 4 } }, team.entrantName + " \u00b7 " + team.formation + " \u00b7 " + fmtMoney(team.cost || 0)),
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
    React.createElement("div", { style: { display: "flex", gap: 6, padding: "0 14px 10px", flexWrap: "wrap" } },
      subs.map(function (s) {
        return React.createElement("button", {
          key: s.key, onClick: function (k) { return function () { setSub(k); }; }(s.key),
          style: { padding: "6px 10px", borderRadius: 8, border: "none", background: sub === s.key ? "#ffd23f" : "#1c3253", color: sub === s.key ? "#12233f" : "#fff", fontSize: 11, fontWeight: 700 }
        }, s.label);
      })
    ),
    sub === "stats" ? React.createElement(AdminStats, { teams: props.teams, fixtures: props.fixtures }) : null,
    sub === "fixtures" ? React.createElement(AdminFixtures, { fixtures: props.fixtures }) : null,
    sub === "players" ? React.createElement(AdminPlayers, { playersDb: props.playersDb }) : null,
    sub === "entrants" ? React.createElement(AdminEntrants, { teams: props.teams }) : null,
    sub === "settings" ? React.createElement(AdminSettings, null) : null
  );
}

/* ---------------- Root App ---------------- */

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

  var tabs = [
    { key: "home", label: "Home" },
    { key: "team", label: "Build" },
    { key: "myteam", label: "My Team" },
    { key: "table", label: "Table" },
    { key: "fixtures", label: "Fixtures" },
    { key: "scores", label: "Players" },
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
    React.createElement(TopNav, { tabs: tabs, active: tab, onSelect: setTab })
  );
}

var rootEl = document.getElementById("root");
var root = ReactDOM.createRoot(rootEl);
root.render(React.createElement(App, null));
