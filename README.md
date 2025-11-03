# TarotBot API

Lightweight Express JSON API for tarot spreads based on the local `card_data.js`.

Start server:

```powershell
npm install
npm start
```

Endpoints (GET):
- GET /draw/one — single random card
- GET /draw/three — past/present/future
- GET /draw/five — predefined 5-card spread
- GET /draw/spread?n=NUMBER — generic n-card unique draw
- GET /draw/celtic-cross — standard 10-card Celtic Cross
- GET /draw/release-retain?extras=Q1,Q2 — 2-card Release & Retain (+ optional comma-separated extra questions)
- GET /draw/asset-hindrance?extras=Q1,Q2 — 2-card Asset & Hindrance (+ extras)
- GET /draw/advice-universe — 3-card advice spread
- GET /draw/past-present-future — 3-card past/present/future
- GET /draw/mind-body-spirit — 3-card mind/body/spirit
- GET /draw/existing-relationship — 5-card relationship spread
- GET /draw/potential-relationship — 5-card potential-relationship spread
- GET /draw/law-of-attraction?sig=waac — 5-card Law of Attraction (optional query param `sig` for significator)
- GET /draw/making-decision — 6-card decision spread

Endpoints (POST):
- POST /draw/law-of-attraction  — body: { "significator": "waac" }
- POST /draw/release-retain — body: { "extraQuestions": ["How to support?","What comes after?"] }
- POST /draw/asset-hindrance — body: { "extraQuestions": [...] }

Responses: { success: true, data: <spread data> }

Start everything (server + bot)
--------------------------------
To start both the API server and the Discord bot in one process, copy `.env.example` to `.env`, fill in `DISCORD_TOKEN` and `TAROT_API_URL`, then run:

```powershell
npm run start:app
```

This will start the Express server and attempt to log the Discord bot in if `DISCORD_TOKEN` is provided.

Supervised mode (recommended for development)
---------------------------------------------
You can run a small supervisor that launches both services as child processes, restarts them on failure with exponential backoff, and forwards logs.

```powershell
npm run start:supervised
```
## Discord usage — Slash commands

The bot now uses Discord slash commands only (message/prefix commands were removed). Use the `/tarot` command and pick a subcommand for the spread you want.

Common subcommands and options:
- /tarot one [question] — draw a single card. Optionally provide a free-text question.
- /tarot three [question] — 3-card reading (past/present/future).
- /tarot five [question] — 5-card spread.
- /tarot spread n:<number> [question] — generic n-card unique draw.
- /tarot celtic-cross [question] — Celtic Cross (10 cards).
- /tarot law-of-attraction sig:<shortname> [question] — Law of Attraction; `sig` has autocomplete based on the card short names in `card_data.js`.

Interactive features
- After running a slash command the bot reply may include buttons and a select menu:
	- Regenerate — draws the spread again.
	- Show Images — returns image URLs for the cards (if available).
	- Card select menu — inspect a single card from the spread for its detailed meaning.

Registration notes
- During development set `GUILD_ID` in your `.env` to your test server ID: this registers slash commands immediately in that guild.
- If `GUILD_ID` is not set the bot will register commands globally — global propagation can take up to an hour.
- Make sure the bot is invited to your guild with the `applications.commands` scope (and `bot` scope to run).

Environment variables relevant to Discord
- `DISCORD_TOKEN` — required to log the bot in.
- `GUILD_ID` — optional; set to a guild id for immediate, guild-scoped slash command registration.
- `TAROT_API_URL` — used when the bot builds image URLs (defaults to `http://localhost:3000`).

Start the bot

1. Copy and edit `.env.example` -> `.env`, set `DISCORD_TOKEN` and optionally `GUILD_ID`.
2. Start both services (API + bot):

```powershell
npm run start:app
```

Or use supervised mode during development:

```powershell
npm run start:supervised
```

If slash commands do not appear immediately, wait a few minutes (or set `GUILD_ID` for instant registration). If you want me to force-register commands or start the bot and show logs here, tell me and provide the `DISCORD_TOKEN` in your `.env` on this machine.

This is handy during development if you want automatic restarts when one of the services crashes. For production, consider running each service under a proper process manager (systemd, pm2, Docker, or a cloud service).
