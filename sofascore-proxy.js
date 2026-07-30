// Netlify Function: proxies SofaScore's internal (unofficial, undocumented)
// API so the browser doesn't hit CORS and requests look like they're coming
// from a normal browser rather than a server script.
//
// IMPORTANT CAVEATS - be aware of these before relying on this:
// - This is not an official public API. SofaScore's Terms of Service do not
//   permit automated scraping/redistribution of their data. The realistic
//   risk for a small private league is low, but it's not zero, and if
//   SofaScore tightens things up this could stop working with no warning.
// - There's no stable contract here - if SofaScore changes their internal
//   API shape, this breaks silently until someone notices and fixes it.
// - Field names below are written from general knowledge of how SofaScore's
//   API is commonly structured (as used by various open-source scraping
//   projects), not verified against a live response, since this was built
//   without live network access. The first real sync should be treated as
//   a test run, not assumed correct.
//
// Usage from the app:
//   /.netlify/functions/sofascore-proxy?action=day&date=2026-08-16
//   /.netlify/functions/sofascore-proxy?action=lineups&event=12345678

var BASE_URL = "https://api.sofascore.com/api/v1";
var BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Accept": "application/json"
};

exports.handler = async function (event) {
  var params = event.queryStringParameters || {};
  var action = params.action;

  try {
    if (action === "day") {
      if (!params.date) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing date (YYYY-MM-DD)" }) };
      }
      var dayUrl = BASE_URL + "/sport/football/scheduled-events/" + encodeURIComponent(params.date);
      var dayResp = await fetch(dayUrl, { headers: BROWSER_HEADERS });
      var dayData = await dayResp.json();
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(dayData) };
    } else if (action === "lineups") {
      if (!params.event) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing event id" }) };
      }
      var lineupUrl = BASE_URL + "/event/" + encodeURIComponent(params.event) + "/lineups";
      var lineupResp = await fetch(lineupUrl, { headers: BROWSER_HEADERS });
      var lineupData = await lineupResp.json();
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(lineupData) };
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: "Unknown action. Use action=day or action=lineups." }) };
    }
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Upstream request failed: " + (err && err.message ? err.message : String(err)) })
    };
  }
};
