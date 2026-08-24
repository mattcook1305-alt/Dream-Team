// Netlify Function: proxies the official Fantasy Premier League API.
// This is a genuinely official, public data source (the real FPL backend
// millions of managers' apps already hit) - unlike SofaScore, it isn't
// blocking server-originated requests, and it already tracks exactly the
// stats this competition's scoring needs (including clearances/blocks/
// interceptions/tackles/recoveries for the defensive contribution bonus,
// since this season's rules are modeled on FPL's own current system).
//
// No key needed - this is a public, unauthenticated API.
//
// Usage from the app:
//   /.netlify/functions/fpl-proxy?action=bootstrap
//   /.netlify/functions/fpl-proxy?action=live&gw=1

var BASE_URL = "https://fantasy.premierleague.com/api";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Accept": "application/json"
};

exports.handler = async function (event) {
  var params = event.queryStringParameters || {};
  var action = params.action;

  try {
    if (action === "bootstrap") {
      var bResp = await fetch(BASE_URL + "/bootstrap-static/", { headers: HEADERS });
      var bData = await bResp.json();
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(bData) };
    } else if (action === "live") {
      if (!params.gw) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing gw" }) };
      }
      var lResp = await fetch(BASE_URL + "/event/" + encodeURIComponent(params.gw) + "/live/", { headers: HEADERS });
      var lData = await lResp.json();
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(lData) };
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: "Unknown action. Use action=bootstrap or action=live." }) };
    }
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Upstream request failed: " + (err && err.message ? err.message : String(err)) })
    };
  }
};
