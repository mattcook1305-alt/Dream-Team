// Netlify Function: proxies two football data APIs so no key ever sits in
// client-side code and the browser never hits a CORS wall.
//
// - action=fixtures uses football-data.org (free tier covers the Premier
//   League fixture list - competition code "PL").
// - action=stats uses API-Football / api-sports.io, since football-data.org's
//   free tier doesn't carry player-level match stats. This needs a paid
//   API-Football plan to actually return Premier League data - see the app's
//   README. It's harmless left unused if you're sourcing stats elsewhere.
//
// Both keys are hardwired below as fallbacks so no Netlify environment
// variable setup is required. This is safe because this file only ever runs
// on Netlify's server - it's never sent to the browser. To rotate a key
// without redeploying, set FOOTBALLDATA_KEY or APIFOOTBALL_KEY in Netlify's
// environment variables and it'll take priority over the hardwired one.
//
// Usage from the app:
//   /.netlify/functions/football-proxy?action=fixtures&competition=PL&season=2026
//   /.netlify/functions/football-proxy?action=stats&fixture=123456

var FOOTBALLDATA_BASE = "https://api.football-data.org/v4";
var APIFOOTBALL_BASE = "https://v3.football.api-sports.io";

exports.handler = async function (event) {
  var fdKey = process.env.FOOTBALLDATA_KEY || "9a776e7edab6440ca3108c4e8198f9a3";
  var afKey = process.env.APIFOOTBALL_KEY || "6c2fddbb7db07d539ef4e6c6185ec0d567edf4de64e4ea06921b787a73ed2aa6";

  var params = event.queryStringParameters || {};
  var action = params.action;

  try {
    if (action === "fixtures") {
      var competition = params.competition || "PL";
      var season = params.season || "2026";
      var url = FOOTBALLDATA_BASE + "/competitions/" + encodeURIComponent(competition) + "/matches?season=" + encodeURIComponent(season);
      var resp = await fetch(url, { headers: { "X-Auth-Token": fdKey } });
      var data = await resp.json();
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
    } else if (action === "stats") {
      if (!params.fixture) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing fixture id" }) };
      }
      var statsUrl = APIFOOTBALL_BASE + "/fixtures/players?fixture=" + encodeURIComponent(params.fixture);
      var statsResp = await fetch(statsUrl, { headers: { "x-apisports-key": afKey } });
      var statsData = await statsResp.json();
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(statsData) };
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: "Unknown action. Use action=fixtures or action=stats." }) };
    }
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Upstream request failed: " + (err && err.message ? err.message : String(err)) })
    };
  }
};
