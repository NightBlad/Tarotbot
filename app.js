// app.js — start both the Tarot API server and the Discord bot in one process
// It will load .env automatically so both modules can use environment variables.
require('dotenv').config();

// Require the server (server.js starts the express server on load)
require('./server.js');

// Require the Discord bot (discord_bot.js will attempt login if DISCORD_TOKEN is set)
require('./discord_bot.js');

console.log('Application started: server + discord bot (if DISCORD_TOKEN set)');
