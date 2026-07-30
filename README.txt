GRZEGORZ LUTECKI DREAM TEAM APP - SETUP

1. FIREBASE
   Already done - your dream-team-d7ba9 project config is hardwired into
   index.html, so the red "Not connected" banner will disappear once you
   deploy this version. One thing still on you: the Spark plan's test-mode
   database rules expire after 30 days (same gotcha as your other apps) -
   you'll need to extend them in Firebase console > Realtime Database >
   Rules before they lapse.

2. DEPLOY (static part - same as always)
   Zip everything except netlify/functions and netlify.toml and drag-drop
   onto Netlify exactly as usual, OR just drag the whole folder - Netlify's
   drag-and-drop ignores the functions folder either way (see point 5).

3. ADMIN
   - PIN-gated, default 0000, change immediately in Admin > Settings.
   - Admin > Settings now also has: current gameweek number, the 2 transfer
     window date ranges, and the 2 emergency transfer period date ranges -
     entrants automatically get transfer/emergency access based on today's
     date against whatever you set here.
   - Admin > Entrants shows paid/not paid per team, each team's emergency
     transfer status (not used / used / pending with effective gameweek),
     an "Apply due emergency transfers" button (run this once you've moved
     "current gameweek" on - it applies any pending emergency swaps whose
     effective gameweek has arrived), and "Sync scores" (recomputes every
     gameweek's results for all teams from whatever's in gwstats).
   - Admin > Fixtures and Admin > Stats entry both have a "Sync from API"
     button - see point 5.

4. MY TEAM / TRANSFERS (entrant-facing, no login system)
   When someone submits a team they're shown a 6-character team code -
   they need to save this. The "My Team" tab lets them re-enter that code
   to view their squad and, when a transfer window or their emergency
   transfer is available, swap a player for another of the same position.
   Regular window transfers apply immediately (max 3 per window). The
   emergency transfer locks in immediately as "used" but the actual swap
   only takes effect once you apply it in Admin (point 3) from the
   gameweek after it was requested, per the rules.

5. AUTO-SYNCING FIXTURES AND STATS
   Fixtures pull automatically from football-data.org (free tier covers the
   Premier League - competition code PL) using your key, already hardwired
   into netlify/functions/football-proxy.js. Nothing to configure.

   Player-level match stats (goals, assists, cards, shots, tackles, big
   chances) come from SofaScore via netlify/functions/sofascore-proxy.js.
   This is NOT an official API - it's SofaScore's own internal app/website
   API, used unofficially (the same approach various open-source scraping
   projects use). No key needed, but be aware:
   - SofaScore's Terms of Service don't permit this kind of automated use.
     For a small private pub league the practical risk is low, but it
     isn't zero, and there's no guarantee it keeps working indefinitely.
   - It's not a stable contract. If SofaScore changes their internal API,
     this breaks silently - a gameweek's stats might just come back empty
     until it's noticed and fixed.
   - Because I can't make live API calls from where I'm building this, the
     matching logic (finding the right SofaScore match from date + team
     names) and the stat field names are both written from general
     knowledge, not tested against a live response. Treat the first real
     sync as a test, not a given - check the per-gameweek view afterwards
     and top up anything wrong or missing by hand.
   - Bonus points (the 3/2/1 for top BPS performers) still need entering
     by hand regardless - no source, free or paid, tracks Dream Team's
     specific bonus system.

   IMPORTANT - this needs a different deploy method than drag-and-drop:
   Netlify Functions (the netlify/functions/*.js files) can't be picked up
   by a simple drag-and-drop zip - Netlify needs to build them. Easiest
   route: install the Netlify CLI on your computer
   (`npm install -g netlify-cli`), run `netlify init` in this folder once
   to link it to a Netlify site, then `netlify deploy --prod` each time you
   want to push an update. Alternatively, push this folder to a GitHub repo
   and connect that repo to Netlify - it'll build the functions
   automatically on every push. I know that's a change from your usual
   "just drag the zip" routine, but it's the only way to keep CORS from
   blocking these requests and get the functions running.

   Once deployed: Admin > Fixtures auto-syncs when you open the tab (or
   tap "Re-sync fixtures now" to force it). Admin > Stats entry has "Sync
   fixtures + stats" for everything in one go, or "Sync stats for this GW
   only" to just pull one gameweek's SofaScore stats without re-fetching
   fixtures.

6. STILL NOT AUTOMATED
   - Prize payouts (weekly, Christmas/New Year doubling, top-5, wooden
     spoon) are calculated as scores but paying out is still on you and
     Dave as before.
