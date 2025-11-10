require('dotenv').config();
const fetch = require('node-fetch');
const crypto = require('crypto');
const path = require('path');
const {
  Client,
  IntentsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder
} = require('discord.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TAROT_API_URL = process.env.TAROT_API_URL || 'http://localhost:3000';
const GUILD_ID = process.env.GUILD_ID || null;
// LangFlow configuration: full run URL and API key token are read from environment
// Example URL: https://xxxx.ngrok-free.app/api/v1/run/<flow-id>  OR a template containing {flow}
const LANGFLOW_API_URL = process.env.LANGFLOW_API_URL || null; // must be a URL (http/https)
const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY || null; // optional token / api key
const LANGFLOW_AUTH_HEADER = process.env.LANGFLOW_AUTH_HEADER || 'Authorization';
const LANGFLOW_DEBUG = process.env.LANGFLOW_DEBUG ? process.env.LANGFLOW_DEBUG === 'true' : true; // debug enabled by default

// Log resolved environment configuration (masked) when debugging is enabled
if (LANGFLOW_DEBUG) {
  try {
    console.log('Resolved env: ', {
      DISCORD_TOKEN: maskToken(DISCORD_TOKEN),
      TAROT_API_URL,
      LANGFLOW_API_URL: maskUrl(LANGFLOW_API_URL),
      LANGFLOW_AUTH_HEADER,
      LANGFLOW_API_KEY: maskToken(LANGFLOW_API_KEY),
      LANGFLOW_DEBUG
    });
  } catch (e) {
    // non-fatal logging error
    console.warn('Failed to log env debug info', e && e.message ? e.message : e);
  }
}

function maskToken(t) {
  if (!t) return null;
  if (t.length <= 8) return '****';
  return `${t.slice(0,4)}...${t.slice(-4)}`;
}

function maskUrl(u) {
  try {
    const url = new URL(u);
    return `${url.protocol}//${url.host}${url.pathname}${url.search ? '...' : ''}`;
  } catch (_) { return u && u.length > 40 ? u.slice(0,40) + '...' : u; }
}

async function safeDeferReply(interaction, opts) {
  try {
    if (interaction.deferred || interaction.replied || interaction.acknowledged) return true;
    const deferOpts = Object.assign({}, opts || {});
    if (deferOpts.ephemeral) { deferOpts.flags = 64; delete deferOpts.ephemeral; }
    await interaction.deferReply(deferOpts);
    return true;
  } catch (e) {
    console.warn('deferReply failed:', e && e.message ? e.message : e);
    try { await interaction.reply({ content: 'Interaction expired or cannot be deferred. Please try again.', flags: 64 }); } catch (_) {}
    return false;
  }
}

async function safeEditReply(interaction, payload) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      // Not deferred/replied - reply instead
      const rp = Object.assign({}, payload);
      if (rp.ephemeral) { rp.flags = 64; delete rp.ephemeral; }
      await interaction.reply(rp);
      return;
    }
    await interaction.editReply(payload);
  } catch (e) {
    console.warn('editReply failed:', e && e.message ? e.message : e);
    try { if (!interaction.replied) await interaction.reply({ content: 'Could not send reply.', flags: 64 }); } catch (_) {}
  }
}

// Load card data for autocomplete suggestions (name and short name)
let CARDS = [];
try {
  CARDS = require('./card_data');
} catch (e) {
  console.warn('Could not load card_data.js for autocomplete:', e.message);
}

// Load shortnames from text file for quick autocomplete
let SHORTNAMES = [];
try {
  const fs = require('fs');
  const path = require('path');
  const shortnameFile = path.join(__dirname, 'shortname_data.txt');
  if (fs.existsSync(shortnameFile)) {
    const content = fs.readFileSync(shortnameFile, 'utf8');
    SHORTNAMES = content.split('\n').map(s => s.trim()).filter(Boolean);
    console.log(`Loaded ${SHORTNAMES.length} shortnames for autocomplete`);
  }
} catch (e) {
  console.warn('Could not load shortname_data.txt for autocomplete:', e.message);
}

function createClient(includeMessageContent) {
  const intents = new IntentsBitField();
  intents.add(IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages);
  // Message Content is intentionally not added; this bot is slash-first.
  if (includeMessageContent) intents.add(IntentsBitField.Flags.MessageContent);
  return new Client({ intents });
}

const client = createClient(false);
const { callTarotApi } = require('./tarot_client');
const { renderCardsToImage, saveImageToTemp } = require('./image_renderer');

// Ensure Chrome for Puppeteer is available (robust startup check/install)
(async function ensureChromeAtStartup() {
  const fs = require('fs');
  const { execSync } = require('child_process');

  function chromeCacheExists() {
    const candidates = [
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.cache', 'puppeteer', 'chrome'),
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.local-chromium'),
      '/opt/render/.cache/puppeteer',
      path.join(process.cwd(), '.cache', 'puppeteer')
    ];
    for (const p of candidates) {
      try { if (p && fs.existsSync(p)) return true; } catch (_) {}
    }
    return false;
  }

  async function tryInstallChrome() {
    try {
      console.log('Attempting to install Chrome for Puppeteer via npx...');
      execSync('npx puppeteer@latest browsers install chrome', { stdio: 'inherit' });
      console.log('Chrome installed successfully for Puppeteer.');
      return true;
    } catch (e) {
      console.warn('Automatic puppeteer chrome install failed:', e && e.message ? e.message : e);
      return false;
    }
  }

  try {
    if (chromeCacheExists()) {
      console.log('Chrome for Puppeteer appears to be installed (cache found).');
    } else {
      console.log('Chrome not found in known cache locations. Attempting install...');
      const ok = await tryInstallChrome();
      if (!ok) {
        console.warn('Could not install Chrome automatically. Image rendering may fail. Run manually: npx puppeteer browsers install chrome');
      }
    }
  } catch (err) {
    console.warn('Could not verify/install Chrome at startup:', err && err.message ? err.message : err);
    console.warn('Image rendering may not work. Run: npx puppeteer browsers install chrome');
  }
})();

async function callApi(path) {
  const url = `${TAROT_API_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.data;
}

function summarizeSpread(data) {
  // If API returned an array of cards (most spreads), render a compact list
  if (Array.isArray(data)) {
    return data.map(item => {
      const pos = item.position || item.label || '';
      const c = item.card || item;
      const name = c.name || c.name_short || 'Unknown';
      const orient = c.orientation ? ` (${c.orientation})` : '';
      return `${pos}: ${name}${orient}`;
    }).join('\n');
  }

  // If API returned a single object (e.g. draw one), format it nicely
  if (data && typeof data === 'object') {
    const c = data.card || data;
    const name = c.name || c.name_short || 'Unknown';
    const orient = c.orientation ? ` (${c.orientation})` : '';
    const meaning = c.meaning_up || c.meaning || c.description || '';
    const extra = meaning ? `\n\n${meaning}` : '';
    return `${name}${orient}${extra}`;
  }

  // Fallback for primitives
  return String(data || '');
}

// Helper to call LangFlow run endpoint using the Run API (example provided by user)
// It will POST to: <LANGFLOW_BASE_URL>/api/v1/run/<flow-id>
// Payload format (example):
// {
//   output_type: 'text',
//   input_type: 'chat',
//   input_value: 'hello world!'
// }
// We also add a session_id via crypto.randomUUID(). If your endpoint differs, tell me the exact spec and I'll adapt.
async function callLangFlow(flow, input) {
  // Build payload following the LangFlow run API example
  let inputValue = typeof input === 'string' ? input : JSON.stringify(input);
  
  // LangFlow API has a 1024 character limit on input_value
  // If input exceeds this, truncate or summarize it
  const MAX_INPUT_LENGTH = 1024;
  if (inputValue.length > MAX_INPUT_LENGTH) {
    console.warn(`Input length ${inputValue.length} exceeds LangFlow limit ${MAX_INPUT_LENGTH}. Truncating...`);
    
    // Try to parse as JSON and keep only essential fields
    try {
      const parsed = JSON.parse(inputValue);
      const essential = {
        spread: parsed.spread,
        question: parsed.question ? parsed.question.substring(0, 200) : '',
        n: parsed.n,
        sig: parsed.sig
      };
      inputValue = JSON.stringify(essential);
      
      // If still too long, truncate the stringified version
      if (inputValue.length > MAX_INPUT_LENGTH) {
        inputValue = inputValue.substring(0, MAX_INPUT_LENGTH - 3) + '...';
      }
    } catch (_) {
      // Not JSON, just truncate
      inputValue = inputValue.substring(0, MAX_INPUT_LENGTH - 3) + '...';
    }
    
    console.log(`Truncated input to ${inputValue.length} characters`);
  }
  
  const payload = {
    output_type: 'text',
    input_type: 'chat',
    input_value: inputValue
  };
  try { payload.session_id = crypto.randomUUID(); } catch (_) { /* ignore if unavailable */ }

  // Build run URL using the LANGFLOW_API_URL and the flow id
  // LANGFLOW_API_URL must be a URL (http/https). It may optionally include a token separated by a pipe: URL|TOKEN
  let runUrl = null;
  const headers = { 'Content-Type': 'application/json' };
  const apiUrlRaw = String(LANGFLOW_API_URL || '').trim();
  if (!apiUrlRaw) throw new Error('LANGFLOW_API_URL is not set; set it to a full LangFlow run URL (e.g. https://host/api/v1/run/{flow})');
  if (apiUrlRaw.toLowerCase().startsWith('http')) {
    // LANGFLOW_API_URL may be a URL or a URL|TOKEN pair. Support both formats.
    let urlPart = apiUrlRaw;
    let tokenPart = null;
    if (apiUrlRaw.includes('|')) {
      const parts = apiUrlRaw.split('|').map(p => p.trim()).filter(Boolean);
      // prefer the part that starts with http as the URL
      urlPart = parts.find(p => p.toLowerCase().startsWith('http')) || parts[0];
      tokenPart = parts.find(p => !p.toLowerCase().startsWith('http')) || null;
    }

    const cleaned = String(urlPart).replace(/\/$/, '');
    if (cleaned.includes('{flow}')) {
      runUrl = cleaned.replace('{flow}', encodeURIComponent(flow));
    } else if (cleaned.includes('/api/v1/run')) {
      // If the URL ends with /api/v1/run, append flow; if it already has a trailing segment, assume it's a full run URL
      if (cleaned.endsWith('/api/v1/run')) runUrl = `${cleaned}/${encodeURIComponent(flow)}`;
      else runUrl = cleaned; // likely already contains the flow id
    } else {
      // Assume it's a base host
      runUrl = `${cleaned}/api/v1/run/${encodeURIComponent(flow)}`;
    }

  // If tokenPart was provided (format URL|TOKEN), send it as a header.
  // If LANGFLOW_API_KEY is present, prefer that explicit token.
  const effectiveToken = (LANGFLOW_API_KEY && String(LANGFLOW_API_KEY).trim()) ? String(LANGFLOW_API_KEY).trim() : (tokenPart || null);
  if (effectiveToken) {
    const headerName = LANGFLOW_AUTH_HEADER || 'Authorization';
    const tokenVal = String(effectiveToken);
    // For the conventional Authorization header, ensure a Bearer prefix is present
    if (headerName.toLowerCase() === 'authorization') {
      headers[headerName] = /^Bearer\s+/i.test(tokenVal) ? tokenVal : `Bearer ${tokenVal}`;
    } else {
      // For custom headers (e.g., X-API-Key), send the raw token value
      headers[headerName] = tokenVal;
    }
    if (LANGFLOW_DEBUG) console.log('LangFlow auth:', maskUrl(runUrl), headerName + ':', maskToken(tokenVal));
  }
  } else {
    // We no longer support using a bare bearer token without a run URL.
    throw new Error('LANGFLOW_API_KEY must be a full run URL (starting with http/https), or a URL and token separated by a pipe (URL|TOKEN).');
  }

  const res = await fetch(runUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`LangFlow ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json == null) return json;
  if (typeof json === 'string') return json;
  if (json.output) return json.output;
  if (json.result) return json.result;
  if (json.data) return json.data;
  if (json.data && typeof json.data === 'object') {
    if (json.data.output) return json.data.output;
    if (json.data.result) return json.data.result;
  }
  return json;
}

function buildCommandsDefinition() {
  return [
    {
      name: 'tarot',
      description: 'Tarot commands',
      options: [
        { name: 'one', description: 'Draw one card', type: 1, options: [ { name: 'question', description: 'Optional question', type: 3, required: false } ] },
        { name: 'three', description: 'Draw three-card spread', type: 1, options: [ { name: 'question', description: 'Optional question', type: 3, required: false } ] },
        { name: 'five', description: 'Draw five-card spread', type: 1, options: [ { name: 'question', description: 'Optional question', type: 3, required: false } ] },
        { name: 'spread', description: 'Draw custom spread', type: 1, options: [ { name: 'n', description: 'Number of cards', type: 4, required: true }, { name: 'question', description: 'Optional question', type: 3, required: false } ] },
        { name: 'celtic-cross', description: 'Celtic cross spread', type: 1, options: [ { name: 'question', description: 'Optional question', type: 3, required: false } ] },
        { name: 'release-retain', description: 'Release & Retain spread', type: 1, options: [ { name: 'question', description: 'Optional question', type: 3, required: false } ] },
        { name: 'asset-hindrance', description: 'Asset & Hindrance spread', type: 1, options: [ { name: 'question', description: 'Optional question', type: 3, required: false } ] },
        { name: 'advice-universe', description: 'Advice from the Universe spread', type: 1, options: [ { name: 'question', description: 'Optional question', type: 3, required: false } ] },
        { name: 'past-present-future', description: 'Past / Present / Future spread', type: 1, options: [ { name: 'question', description: 'Optional question', type: 3, required: false } ] },
        { name: 'mind-body-spirit', description: 'Mind / Body / Spirit spread', type: 1, options: [ { name: 'question', description: 'Optional question', type: 3, required: false } ] },
        { name: 'existing-relationship', description: 'Existing Relationship spread', type: 1, options: [ { name: 'question', description: 'Optional question', type: 3, required: false } ] },
        { name: 'potential-relationship', description: 'Potential Relationship spread', type: 1, options: [ { name: 'question', description: 'Optional question', type: 3, required: false } ] },
        { name: 'making-decision', description: 'Making a Decision spread', type: 1, options: [ { name: 'question', description: 'Optional question', type: 3, required: false } ] },
        { name: 'law-of-attraction', description: 'Law of Attraction (optional significator)', type: 1, options: [ { name: 'sig', description: 'Significator (short name)', type: 3, required: false, autocomplete: true }, { name: 'question', description: 'Optional question', type: 3, required: false } ] }
      ]
    }
  ];
}

function registerEventHandlers(botClient) {
  botClient.on('clientReady', () => {
    console.log(`Discord bot ready as ${botClient.user && botClient.user.tag}`);
  });

  // Register slash commands
  botClient.on('clientReady', async () => {
    try {
      const commands = buildCommandsDefinition();

      // Register to every guild we're already a member of (makes commands appear instantly in each guild)
      const guilds = botClient.guilds.cache;
      if (guilds && guilds.size > 0) {
        for (const [, g] of guilds) {
          try {
            await g.commands.set(commands);
            console.log(`Registered slash commands to guild ${g.id}`);
          } catch (errGuild) {
            console.warn(`Failed to register commands to guild ${g.id}:`, errGuild && errGuild.message);
          }
        }
      }

      // Also set global commands as a fallback (optional). Global commands may take longer to propagate.
      if (botClient.application) {
        try {
          await botClient.application.commands.set(commands);
          console.log('Registered global slash commands (fallback)');
        } catch (errGlobal) {
          console.warn('Could not register global slash commands:', errGlobal && errGlobal.message);
        }
      }
    } catch (e) {
      console.warn('Could not register slash commands during clientReady:', e && e.message);
    }
  });

  // Whenever the bot joins a new guild, register the commands there so they are available immediately
  botClient.on('guildCreate', async (guild) => {
    try {
      const commands = buildCommandsDefinition();
      await guild.commands.set(commands);
      console.log(`Registered slash commands to newly joined guild ${guild.id}`);
    } catch (e) {
      console.warn(`Could not register slash commands to guild ${guild.id}:`, e && e.message);
    }
  });

  // Interaction handler: buttons, selects, autocomplete and slash commands
  botClient.on('interactionCreate', async (interaction) => {
    try {
      // Buttons
      if (interaction.isButton && interaction.isButton()) {
        const id = interaction.customId || '';
        if (id.startsWith('regen:')) {
          const apiPath = id.slice('regen:'.length);
          await interaction.deferUpdate();
          try {
            const data = await callApi(apiPath);
            const summary = summarizeSpread(data);
            const embed = new EmbedBuilder().setTitle('Tarot — regenerated').setDescription(summary.substring(0, 2048)).setTimestamp();
            if (Array.isArray(data) && data[0] && data[0].card && data[0].card.imagePath) embed.setThumbnail(`${TAROT_API_URL}/${data[0].card.imagePath.replace(/^\.\//, '')}`);
            const btnRegen2 = new ButtonBuilder().setCustomId(`regen:${apiPath}`).setLabel('Regenerate').setStyle(ButtonStyle.Primary);
            const btnImages2 = new ButtonBuilder().setCustomId(`showimages:${apiPath}`).setLabel('Show Images').setStyle(ButtonStyle.Secondary);
            const select2 = new StringSelectMenuBuilder().setCustomId(`cardselect:${apiPath}`).setPlaceholder('Select a card to inspect').setMaxValues(1)
              .addOptions((Array.isArray(data) ? data : []).map((item, idx) => ({ label: `${idx+1}. ${(item.card||item).name|| (item.card||item).name_short || `Card ${idx+1}`}`, value: String(idx) })));
            const row1b = new ActionRowBuilder().addComponents(btnRegen2, btnImages2);
            const row2b = new ActionRowBuilder().addComponents(select2);
            await interaction.update({ embeds: [embed], components: [row1b, row2b] });
          } catch (e) {
            console.error('Regenerate failed', e);
            try { await safeEditReply(interaction, { content: `Error: ${e.message}` }); } catch (_) {}
          }
          return;
        }

        if (id.startsWith('showimages:')) {
          const apiPath = id.slice('showimages:'.length);
            if (!await safeDeferReply(interaction, { ephemeral: true })) return;
            try {
              const data = await callApi(apiPath);
              const imgs = (Array.isArray(data) ? data : []).map(it => (it.card && it.card.imagePath) ? `${TAROT_API_URL}/${it.card.imagePath.replace(/^\.\//, '')}` : null).filter(Boolean);
              await safeEditReply(interaction, { content: imgs.length ? imgs.join('\n') : 'No images available for this spread.' });
            } catch (e) {
              console.error('Show images failed', e);
              try { await safeEditReply(interaction, { content: `Error: ${e.message}` }); } catch (_) {}
            }
          return;
        }
      }

      // Select menu
      if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
        const id = interaction.customId || '';
        if (id.startsWith('cardselect:')) {
          const apiPath = id.slice('cardselect:'.length);
          const val = interaction.values && interaction.values[0];
          if (typeof val === 'undefined') { await safeEditReply(interaction, { content: 'No card selected' }); return; }
          const idx = parseInt(val, 10);
          if (!await safeDeferReply(interaction, { ephemeral: true })) return;
          try {
            const data = await callApi(apiPath);
            const item = (Array.isArray(data) && data[idx]) ? data[idx] : null;
            if (!item) { await interaction.editReply({ content: 'Card not found in that spread.' }); return; }
            const c = item.card || item;
            const name = c.name || c.name_short || 'Unknown';
            const orient = c.orientation ? ` (${c.orientation})` : '';
            const desc = `${name}${orient}\n\n${c.meaning_up || c.meaning || ''}`;
            const embed = new EmbedBuilder().setTitle(`Card: ${name}`).setDescription(desc.substring(0, 4096)).setTimestamp();
            if (c.imagePath) embed.setImage(`${TAROT_API_URL}/${c.imagePath.replace(/^\.\//, '')}`);
            await interaction.editReply({ embeds: [embed] });
          } catch (e) {
            console.error('Inspect card failed', e);
            try { await interaction.editReply({ content: `Error: ${e.message}` }); } catch (_) {}
          }
          return;
        }
      }

      // Autocomplete
      if (interaction.isAutocomplete && interaction.isAutocomplete()) {
        if (interaction.commandName !== 'tarot') return;
        const focused = interaction.options.getFocused(true);
        if (!focused || focused.name !== 'sig') return;
        const val = String(focused.value || '').toLowerCase();
        
        // Try shortnames first (faster), fall back to full card data
        let matches = [];
        if (SHORTNAMES.length > 0) {
          // Filter shortnames that match the input
          const filtered = SHORTNAMES.filter(sn => sn.toLowerCase().includes(val));
          // Convert to autocomplete format: try to get full name from CARDS, or use shortname as display
          matches = filtered.slice(0, 25).map(sn => {
            // Try to find the card with this shortname to get the full name
            const card = CARDS.cards && CARDS.cards.find(c => c.name_short === sn);
            const displayName = card ? `${card.name} (${sn})` : sn;
            return { name: displayName, value: sn };
          });
        } else if (Array.isArray(CARDS) || (CARDS.cards && Array.isArray(CARDS.cards))) {
          // Fallback to original CARDS array
          const cardsArray = Array.isArray(CARDS) ? CARDS : (CARDS.cards || []);
          matches = cardsArray
            .filter(c => (c.name && c.name.toLowerCase().includes(val)) || (c.name_short && c.name_short.toLowerCase().includes(val)))
            .slice(0, 25)
            .map(c => ({ name: `${c.name} (${c.name_short})`, value: c.name_short }));
        }
        
        await interaction.respond(matches);
        return;
      }

      // Chat input (slash) commands
      if (interaction.isChatInputCommand && interaction.isChatInputCommand()) {
        if (interaction.commandName !== 'tarot') return;
        const sub = (() => { try { return interaction.options.getSubcommand(); } catch (_) { return null; } })();
        if (!sub) { await interaction.reply('No subcommand provided.'); return; }
        let apiPath = '/draw/one';
        switch (sub) {
          case 'one': apiPath = '/draw/one'; break;
          case 'three': apiPath = '/draw/three'; break;
          case 'five': apiPath = '/draw/five'; break;
          case 'spread': {
            const n = interaction.options.getInteger('n') || 3;
            apiPath = `/draw/spread?n=${n}`;
            break;
          }
          case 'celtic-cross': apiPath = '/draw/celtic-cross'; break;
          case 'release-retain': apiPath = '/draw/release-retain'; break;
          case 'asset-hindrance': apiPath = '/draw/asset-hindrance'; break;
          case 'advice-universe': apiPath = '/draw/advice-universe'; break;
          case 'past-present-future': apiPath = '/draw/past-present-future'; break;
          case 'mind-body-spirit': apiPath = '/draw/mind-body-spirit'; break;
          case 'existing-relationship': apiPath = '/draw/existing-relationship'; break;
          case 'potential-relationship': apiPath = '/draw/potential-relationship'; break;
          case 'making-decision': apiPath = '/draw/making-decision'; break;
          case 'law-of-attraction': {
            const sig = interaction.options.getString('sig') || null;
            const q = sig ? `?sig=${encodeURIComponent(sig)}` : '';
            apiPath = `/draw/law-of-attraction${q}`;
            break;
          }
          default:
            await safeEditReply(interaction, { content: `Unknown subcommand: ${sub}` });
            return;
        }

        // Build query param (kept for clarity) but we'll forward spread info to LangFlow instead of calling local API
        const question = interaction.options.getString('question') || '';
        if (question) apiPath += (apiPath.includes('?') ? '&' : '?') + `q=${encodeURIComponent(question)}`;

        // Prepare flow id and fetch structured tarot data first
        const flowToUse = (sub === 'flow') ? (interaction.options.getString('flow_id') || sub) : sub;

        // Ensure LANGFLOW_API_URL is configured and is a URL
        if (!LANGFLOW_API_URL || !String(LANGFLOW_API_URL).toLowerCase().startsWith('http')) {
          await interaction.reply({ content: 'LangFlow integration is not configured correctly. Set LANGFLOW_API_URL to the full run URL (e.g. https://host/api/v1/run/{flow} or the exact run URL).', flags: 64 });
          return;
        }

        // Defer reply IMMEDIATELY before any async operations (LangFlow can be slow)
        // Use a non-ephemeral reply so the user can see the result
        try {
          await interaction.deferReply();
        } catch (deferErr) {
          console.error('Failed to defer reply:', deferErr && deferErr.message);
          // Interaction already expired, try to send a followup or just log
          try {
            await interaction.reply({ content: 'Request timed out. Please try again.', flags: 64 });
          } catch (_) {
            // Can't do anything, interaction is gone
          }
          return;
        }

        try {
          // Build the input object to send to LangFlow: include spread metadata only
          const lfInput = {
            spread: sub,
            apiPath,
            question: question || '',
            n: interaction.options.getInteger('n') || null,
            sig: interaction.options.getString('sig') || null
          };

          if (LANGFLOW_DEBUG) console.log('Calling LangFlow with flow=', flowToUse, 'input keys=', Object.keys(lfInput));

          const lfOut = await callLangFlow(flowToUse, lfInput);
          
          // Debug: Log the structure of LangFlow output
          if (LANGFLOW_DEBUG) {
            console.log('LangFlow response keys:', Object.keys(lfOut || {}));
            if (lfOut && lfOut.outputs && Array.isArray(lfOut.outputs)) {
              console.log('First output keys:', lfOut.outputs[0] ? Object.keys(lfOut.outputs[0]) : 'none');
              if (lfOut.outputs[0] && lfOut.outputs[0].outputs) {
                console.log('Nested outputs count:', lfOut.outputs[0].outputs.length);
              }
            }
          }

          // Helper: try to extract a human text from various possible output shapes
          function extractText(o) {
            if (!o) return '';
            if (typeof o === 'string') return o;
            if (typeof o === 'object') {
              // Deep search through nested outputs array structure
              if (Array.isArray(o.outputs)) {
                for (const output of o.outputs) {
                  if (output && output.outputs) {
                    for (const nestedOutput of output.outputs) {
                      if (nestedOutput && nestedOutput.results && nestedOutput.results.message) {
                        const msg = nestedOutput.results.message;
                        if (msg.data && msg.data.text) return msg.data.text;
                        if (msg.text) return msg.text;
                      }
                    }
                  }
                  // Also check direct results
                  if (output && output.results && output.results.message) {
                    const msg = output.results.message;
                    if (msg.data && msg.data.text) return msg.data.text;
                    if (msg.text) return msg.text;
                  }
                }
              }
              
              // Check for text field first
              if (o.text) return o.text;
              if (o.output && typeof o.output === 'string') return o.output;
              if (o.result && typeof o.result === 'string') return o.result;
              if (o.data && typeof o.data === 'string') return o.data;
              if (o.data && typeof o.data === 'object') {
                if (o.data.text) return o.data.text;
                if (o.data.output) return o.data.output;
                if (o.data.result) return o.data.result;
              }
              // Nested example from the provided sample
              if (o.results && o.results.message && o.results.message.data && o.results.message.data.text) return o.results.message.data.text;
            }
            // Don't stringify objects - return empty if no text found
            return '';
          }

          // Helper: extract image URLs and convert relative image paths to absolute https URLs
          function extractImageUrls(s) {
            if (!s) return [];
            const text = typeof s === 'string' ? s : JSON.stringify(s);
            const urls = new Set();
            // match absolute urls ending with common image extensions (including malformed ones with /n/n)
            const absRe = /https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|gif|svg)(?:\/n\/n)?/ig;
            let m;
            while ((m = absRe.exec(text))) {
              // Clean up malformed URLs
              let url = m[0].replace(/\/n\/n$/, '').replace(/^http:/,'https:');
              urls.add(url);
            }
            // match image paths like ./images/name.jpg or /images/name.jpg or images/name.jpg
            const relRe = /(?:\.\/)?\/?images\/[\w\-@%\.\(\)\[\]]+?\.(?:png|jpe?g|gif|svg)/ig;
            while ((m = relRe.exec(text))) {
              let u = m[0].replace(/^\.\//, '/');
              if (!u.startsWith('http')) {
                const base = (String(TAROT_API_URL || '').trim() || 'https://tarotbot-astc.onrender.com').replace(/\/$/, '');
                u = `${base}${u.startsWith('/') ? '' : '/'}${u.replace(/^\/+/, '')}`;
              }
              urls.add(u.replace(/^http:/,'https:'));
            }
            return Array.from(urls);
          }
          
          // Helper: Extract card information from text for rendering
          function extractCardsFromText(text) {
            const cards = [];
            const lines = text.split('\n');
            
            for (const line of lines) {
              // Match patterns like "Quá khứ: Card Name (Xuôi/Ngược)"
              const match = line.match(/^([^:]+):\s*([^(]+)\s*\(([^)]+)\)/);
              if (match) {
                const position = match[1].trim();
                const name = match[2].trim();
                const orientation = match[3].trim().toLowerCase().includes('ngược') ? 'reversed' : 'upright';
                
                cards.push({
                  position,
                  name,
                  orientation,
                  image: null // Will be filled from image URLs
                });
              }
            }
            
            return cards;
          }

          // Extract primary text from the LangFlow/agent output
          let textContent = (extractText(lfOut) || '').toString().trim();
          
          // Debug log extracted text
          if (LANGFLOW_DEBUG) {
            console.log('Extracted text length:', textContent.length);
            console.log('Text preview:', textContent.substring(0, 200));
          }
          
          // If no text found, check if this is the raw JSON response format
          if (!textContent || textContent === '(no output)') {
            // Skip JSON output entirely - don't process if it's just JSON
            textContent = '';
          }
          
          // Clean up the text: remove JSON artifacts and fix formatting
          // Remove escaped quotes and newlines from JSON stringification
          textContent = textContent.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
          // Remove any remaining JSON structure markers
          textContent = textContent.replace(/^["']|["']$/g, '');
          // Remove any leading/trailing JSON-like patterns
          textContent = textContent.replace(/^\{[^}]*"text":\s*"/i, '').replace(/"[,}]\s*$/i, '');
          // Fix malformed image URLs (remove /n/n or similar artifacts)
          textContent = textContent.replace(/\.jpeg\/n\/n/g, '.jpeg\n\n');
          textContent = textContent.replace(/\.jpg\/n\/n/g, '.jpg\n\n');
          textContent = textContent.replace(/\.png\/n\/n/g, '.png\n\n');
          // Clean up multiple consecutive newlines (more than 2)
          textContent = textContent.replace(/\n{3,}/g, '\n\n');
          
          // REMOVE DUPLICATES: Detect and remove repeated sections
          // Split by common section markers to find duplicates
          const sections = textContent.split(/(?=SIGNIFICATOR|1:|2:|3:|4:|5:|6:|7:|8:|9:|10:|Quá khứ:|Hiện tại:|Tương lai:)/);
          const uniqueSections = [];
          const seenSections = new Set();
          
          for (const section of sections) {
            const normalized = section.trim().substring(0, 200); // Compare first 200 chars
            if (normalized && !seenSections.has(normalized)) {
              seenSections.add(normalized);
              uniqueSections.push(section);
            }
          }
          
          textContent = uniqueSections.join('\n').trim();
          
          // If still no valid text, send error
          if (!textContent) {
            await safeEditReply(interaction, { content: '⚠️ Không thể trích xuất kết quả từ LangFlow. Vui lòng thử lại.' });
            return;
          }

          // Collect image URLs from any place in the output
          const imgsSet = new Set(extractImageUrls(lfOut));

          // Helper: normalize/absolute image URL from a path or name_short
          function normalizeImageUrl(u) {
            if (!u) return null;
            u = String(u).trim();
            if (u.startsWith('http://')) u = u.replace(/^http:/, 'https:');
            if (u.startsWith('https://')) return u;
            // if it's a relative path like ./images/name.jpg or /images/name.jpg or images/name.jpg
            const cleaned = u.replace(/^\.\//, '/');
            const base = (String(TAROT_API_URL || '').trim() || 'https://tarotbot-astc.onrender.com').replace(/\/$/, '');
            return `${base}${cleaned.startsWith('/') ? '' : '/'}${cleaned.replace(/^\/+/, '')}`.replace(/^http:/,'https:');
          }

          // Parse embedded input_value JSONs (some agents put original API inputs here)
          try {
            // If lfOut has an outputs array, each output may have inputs.input_value
            if (Array.isArray(lfOut.outputs)) {
              for (const outItem of lfOut.outputs) {
                if (outItem && outItem.inputs && outItem.inputs.input_value) {
                  const iv = outItem.inputs.input_value;
                  if (typeof iv === 'string') {
                    try {
                      const parsed = JSON.parse(iv);
                      if (parsed && parsed.tarot) {
                        const t = parsed.tarot.data || parsed.tarot;
                        if (t && t.image) imgsSet.add(normalizeImageUrl(t.image));
                        if (t && t.name_short) imgsSet.add(normalizeImageUrl(`/images/${t.name_short}.jpg`));
                      }
                    } catch (_) {
                      // not JSON, ignore
                    }
                  }
                }
                // sometimes text itself may contain an image path pointing to the API images
                if (outItem && outItem.results) {
                  const possibleText = extractText(outItem.results);
                  for (const u of extractImageUrls(possibleText)) imgsSet.add(normalizeImageUrl(u));
                }
              }
            }
            // also check lfOut.inputs.input_value at top level
            if (lfOut.inputs && lfOut.inputs.input_value) {
              const iv = lfOut.inputs.input_value;
              if (typeof iv === 'string') {
                try {
                  const parsed = JSON.parse(iv);
                  if (parsed && parsed.tarot) {
                    const t = parsed.tarot.data || parsed.tarot;
                    if (t && t.image) imgsSet.add(normalizeImageUrl(t.image));
                    if (t && t.name_short) imgsSet.add(normalizeImageUrl(`/images/${t.name_short}.jpg`));
                  }
                } catch (_) {}
              }
            }
          } catch (e) {
            // non-fatal
            console.warn('parse embedded inputs failed', e && e.message);
          }

          // remove falsy and duplicate, keep order by converting to array
          const imgs = Array.from(imgsSet).filter(Boolean);

          // If the main text is empty but nested outputs contain text, try to grab them
          if ((!textContent || textContent === '(no output)') && Array.isArray(lfOut.outputs)) {
            for (const outItem of lfOut.outputs) {
              const t = extractText(outItem.results || outItem);
              if (t && t !== '(no output)') {
                textContent = t; break;
              }
            }
          }

          // Build professional Discord embed from the text content
          const embed = new EmbedBuilder()
            .setColor(0x7B68EE) // mystical purple
            .setTimestamp();

          // Additional cleanup: remove stray image URLs from text (they'll be shown as embed images)
          let cleanText = textContent;
          for (const imgUrl of imgs) {
            cleanText = cleanText.replace(imgUrl, '');
          }
          // Remove standalone image URL patterns that might remain
          cleanText = cleanText.replace(/https?:\/\/[^\s]+?\.(?:jpeg|jpg|png|gif|svg)/gi, '');
          // Clean up extra whitespace and newlines after URL removal
          cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

          // Parse the text to extract title, card info, and conclusion
          const lines = cleanText.split('\n').filter(l => l.trim());
          
          // Try to extract title (first line usually contains spread type)
          let title = 'Kết quả bói Tarot';
          let description = '';
          const fields = [];
          let conclusion = '';
          
          let currentSection = '';
          let inConclusionBlock = false;
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // First line is usually the title
            if (i === 0 && line.length < 100) {
              title = line;
              continue;
            }
            
            // Detect conclusion section (case insensitive)
            if (line.toLowerCase().includes('kết luận')) {
              currentSection = 'conclusion';
              inConclusionBlock = true;
              // If the line has content after "Kết luận:", include it
              const conclusionMatch = line.match(/kết luận[:\s]*(.*)/i);
              if (conclusionMatch && conclusionMatch[1]) {
                conclusion += conclusionMatch[1] + '\n';
              }
              continue;
            }
            
            // If we're in conclusion block, keep adding lines
            if (inConclusionBlock) {
              conclusion += line + '\n';
              continue;
            }
            
            // Lines containing card names with (Xuôi) or (Ngược) followed by em dash
            if ((line.includes('(Xuôi)') || line.includes('(Ngược)')) && line.includes('—')) {
              const parts = line.split('—');
              if (parts.length >= 2) {
                const fieldName = parts[0].trim().substring(0, 256); // ensure name <= 256 chars
                let fieldValue = parts.slice(1).join('—').trim();
                
                // Split long content into multiple fields if needed
                const MAX_FIELD_LENGTH = 1020;
                if (fieldValue.length > MAX_FIELD_LENGTH) {
                  // Split into chunks at sentence boundaries
                  const sentences = fieldValue.split(/([.!?]\s+)/);
                  let currentChunk = '';
                  let chunkIndex = 0;
                  
                  for (let i = 0; i < sentences.length; i++) {
                    const sentence = sentences[i];
                    if (currentChunk.length + sentence.length <= MAX_FIELD_LENGTH) {
                      currentChunk += sentence;
                    } else {
                      if (currentChunk) {
                        fields.push({
                          name: chunkIndex === 0 ? fieldName : `${fieldName} (tiếp ${chunkIndex + 1})`,
                          value: currentChunk.trim(),
                          inline: false
                        });
                        chunkIndex++;
                      }
                      currentChunk = sentence;
                    }
                  }
                  
                  // Add remaining chunk
                  if (currentChunk.trim()) {
                    fields.push({
                      name: chunkIndex === 0 ? fieldName : `${fieldName} (tiếp ${chunkIndex + 1})`,
                      value: currentChunk.trim().substring(0, MAX_FIELD_LENGTH),
                      inline: false
                    });
                  }
                } else {
                  // Short enough, add as single field
                  fields.push({
                    name: fieldName,
                    value: fieldValue,
                    inline: false
                  });
                }
              }
              continue;
            }
            
            // Detect advice section with colon
            if (line.toLowerCase().startsWith('lời khuyên') && line.includes(':')) {
              const colonIdx = line.indexOf(':');
              const advice = line.substring(colonIdx + 1).trim();
              if (advice) {
                fields.push({
                  name: '💡 Lời khuyên',
                  value: advice.substring(0, 1020), // Discord limit 1024 chars
                  inline: false
                });
              }
              continue;
            }
            
            // Build description (only if not in conclusion and not a card line)
            if (!line.toLowerCase().startsWith('trải bài') && description.length < 2000) {
              description += line + '\n';
            }
          }
          
          // Set embed title and description
          embed.setTitle(title.substring(0, 256));
          
          // Try to render cards as a composite image (with retry/install on missing Chrome)
          let renderedImagePath = null;
          try {
            const cardsData = extractCardsFromText(cleanText);

            // Match images to cards
            if (cardsData.length > 0 && imgs.length > 0) {
              for (let i = 0; i < cardsData.length && i < imgs.length; i++) {
                cardsData[i].image = imgs[i];
              }

              // Render cards to image
              if (cardsData.every(c => c.image)) {
                console.log(`Rendering ${cardsData.length} cards to composite image...`);
                const imageBuffer = await renderCardsToImage(cardsData, { title, spread: sub });
                renderedImagePath = await saveImageToTemp(imageBuffer, `${sub}_spread`);
                console.log('Rendered image saved to:', renderedImagePath);
              }
            }
          } catch (renderErr) {
            console.warn('Failed to render composite image:', renderErr && renderErr.message ? renderErr.message : renderErr);
            // If failure looks like missing Chrome, attempt an automatic install and retry once
            const msg = renderErr && renderErr.message ? renderErr.message : '';
            if (/Could not find Chrome|Unable to launch browser|Could not find chromium|No usable sandbox|Could not find Chrome/.test(msg)) {
              try {
                console.log('Detected Chromium missing. Attempting to install Puppeteer Chrome and retry render once...');
                const { execSync } = require('child_process');
                try {
                  execSync('npx puppeteer@latest browsers install chrome', { stdio: 'inherit' });
                  console.log('Puppeteer chrome install attempt finished. Retrying render...');
                  // retry render once
                  try {
                    const cardsDataRetry = extractCardsFromText(cleanText);
                    if (cardsDataRetry.length > 0 && imgs.length > 0) {
                      for (let i = 0; i < cardsDataRetry.length && i < imgs.length; i++) cardsDataRetry[i].image = imgs[i];
                      if (cardsDataRetry.every(c => c.image)) {
                        const imageBuffer2 = await renderCardsToImage(cardsDataRetry, { title, spread: sub });
                        renderedImagePath = await saveImageToTemp(imageBuffer2, `${sub}_spread`);
                        console.log('Rendered image saved after retry to:', renderedImagePath);
                      }
                    }
                  } catch (retryErr) {
                    console.warn('Retry render still failed:', retryErr && retryErr.message ? retryErr.message : retryErr);
                  }
                } catch (instErr) {
                  console.warn('Automatic install failed or not permitted in this environment:', instErr && instErr.message ? instErr.message : instErr);
                }
              } catch (retryOuterErr) {
                console.warn('Retry/install flow failed:', retryOuterErr && retryOuterErr.message ? retryOuterErr.message : retryOuterErr);
              }
            }
            // If still no renderedImagePath, proceed without composite image
          }
          
          // Calculate current embed size for validation
          function getEmbedSize(e) {
            let size = 0;
            if (e.data.title) size += e.data.title.length;
            if (e.data.description) size += e.data.description.length;
            if (e.data.fields) {
              for (const f of e.data.fields) {
                size += (f.name || '').length + (f.value || '').length;
              }
            }
            if (e.data.footer && e.data.footer.text) size += e.data.footer.text.length;
            return size;
          }
          
          // Add description with size checking (minimize to save space for fields)
          if (description.trim() && description.trim().length > 50) {
            const maxDescLen = Math.min(2048, 2000 - title.length); // Increased from 4000 to allow more field content
            embed.setDescription(description.trim().substring(0, maxDescLen));
          }
          
          // Add fields for card meanings (validate each field and check total size)
          let currentSize = getEmbedSize(embed);
          const maxEmbedSize = 5900; // Increased from 5800 to maximize content display
          let fieldCount = 0;
          const maxFields = 24; // Increased to 24 (close to Discord's 25 max) to display more content
          let wasTruncated = false;
          
          for (const field of fields) {
            // Stop if we've reached field limit
            if (fieldCount >= maxFields) {
              wasTruncated = true;
              break;
            }
            
            // Double-check field constraints before adding
            // Discord limit: field.name max 256, field.value max 1024 chars
            if (field.name && field.name.length > 0 && field.name.length <= 256 &&
                field.value && field.value.length > 0) {
              
              // Truncate field value if it exceeds Discord's 1024 char limit
              let fieldValue = field.value;
              if (fieldValue.length > 1024) {
                fieldValue = fieldValue.substring(0, 1020) + '...';
                console.log(`Truncated field "${field.name}" from ${field.value.length} to 1024 chars`);
              }
              
              const fieldSize = field.name.length + fieldValue.length;
              
              // Check if adding this field would exceed the size limit
              if (currentSize + fieldSize > maxEmbedSize) {
                wasTruncated = true;
                // If no fields added yet, add at least a truncated version of this one
                if (fieldCount === 0) {
                  const truncatedValue = fieldValue.substring(0, Math.min(1020, maxEmbedSize - currentSize - field.name.length - 100)) + '...';
                  embed.addFields({
                    name: field.name,
                    value: truncatedValue,
                    inline: false
                  });
                  currentSize += field.name.length + truncatedValue.length;
                  fieldCount++;
                }
                break;
              }
              
              embed.addFields({
                name: field.name,
                value: fieldValue,
                inline: false
              });
              currentSize += fieldSize;
              fieldCount++;
            }
          }
          
          // Add truncation notice if content was cut (only if we have room)
          if (wasTruncated && fieldCount < 25) {
            const noticeSize = '⚠️ Nội dung bị cắt'.length + 'Kết quả quá dài. Một số thông tin đã được rút gọn.'.length;
            if (currentSize + noticeSize < maxEmbedSize) {
              embed.addFields({
                name: '⚠️ Nội dung bị cắt',
                value: 'Kết quả quá dài. Một số thông tin đã được rút gọn.',
                inline: false
              });
              currentSize += noticeSize;
              fieldCount++;
            }
          }
          
          // Add conclusion as a SINGLE field (no splitting into multiple parts)
          if (conclusion.trim() && fieldCount < 25) {
            const conclusionText = conclusion.trim();
            
            // If conclusion is longer than 2048, truncate with ellipsis
            // We'll use the split-message approach instead of multiple conclusion fields
            if (conclusionText.length > 2048) {
              const truncated = conclusionText.substring(0, 2044) + '...';
              const conclusionSize = '🔮 Kết luận'.length + truncated.length;
              
              if (currentSize + conclusionSize <= maxEmbedSize) {
                embed.addFields({
                  name: '🔮 Kết luận',
                  value: truncated,
                  inline: false
                });
                currentSize += conclusionSize;
                fieldCount++;
                
                // Store remaining conclusion for continuation embed if needed
                const remainingConclusion = conclusionText.substring(2044);
                if (remainingConclusion.length > 0) {
                  // We'll handle this in the split message logic below
                  embed._remainingConclusion = remainingConclusion;
                }
              }
            } else {
              // Short conclusion, add as single field
              const conclusionSize = '🔮 Kết luận'.length + conclusionText.length;
              if (currentSize + conclusionSize <= maxEmbedSize) {
                embed.addFields({
                  name: '🔮 Kết luận',
                  value: conclusionText,
                  inline: false
                });
                currentSize += conclusionSize;
                fieldCount++;
              }
            }
          }
          
          // Add composite image as main embed image (only show combined image, not individual URLs)
          if (renderedImagePath) {
            // Use rendered composite image
            embed.setImage(`attachment://${path.basename(renderedImagePath)}`);
          }
          // Note: Individual card image URLs are no longer displayed as fields
          
          // If question was provided, add as footer (only if size allows)
          if (question) {
            const footerText = `Câu hỏi: ${question}`.substring(0, 2048);
            const finalSize = getEmbedSize(embed) + footerText.length;
            if (finalSize <= maxEmbedSize) {
              embed.setFooter({ text: footerText });
            }
          }
          
          // Final validation: ensure total embed size is under limit
          const totalSize = getEmbedSize(embed);
          if (totalSize > 6000) {
            console.warn(`Embed size ${totalSize} exceeds 6000, splitting into multiple messages`);
            
            // Strategy: Split into multiple embeds
            const embeds = [];
            
            // First embed: Title + description + first few fields + first image
            const firstEmbed = new EmbedBuilder()
              .setColor(0x7B68EE)
              .setTitle(title.substring(0, 256))
              .setTimestamp();
            
            if (description.trim()) {
              firstEmbed.setDescription(description.trim().substring(0, 4096));
            }
            
            // Add composite image to first embed (only if available)
            if (renderedImagePath) {
              firstEmbed.setImage(`attachment://${path.basename(renderedImagePath)}`);
            }
            
            // Add fields to first embed until we hit limit
            let firstEmbedSize = getEmbedSize(firstEmbed);
            let firstEmbedFields = 0;
            for (const field of fields) {
              if (firstEmbedFields >= 20) break; // Leave room for continuation
              const fieldSize = field.name.length + field.value.length;
              if (firstEmbedSize + fieldSize > 5500) break;
              
              firstEmbed.addFields(field);
              firstEmbedSize += fieldSize;
              firstEmbedFields++;
            }
            
            embeds.push(firstEmbed);
            
            // Create continuation embeds for remaining fields
            const remainingFields = fields.slice(firstEmbedFields);
            if (remainingFields.length > 0) {
              let currentEmbed = new EmbedBuilder()
                .setColor(0x7B68EE)
                .setTitle(`${title.substring(0, 240)} (tiếp)`)
                .setTimestamp();
              
              let currentEmbedSize = getEmbedSize(currentEmbed);
              let currentFieldCount = 0;
              
              for (const field of remainingFields) {
                const fieldSize = field.name.length + field.value.length;
                
                // If adding this field would exceed limits, start new embed
                if (currentFieldCount >= 24 || currentEmbedSize + fieldSize > 5500) {
                  embeds.push(currentEmbed);
                  currentEmbed = new EmbedBuilder()
                    .setColor(0x7B68EE)
                    .setTitle(`${title.substring(0, 240)} (tiếp)`)
                    .setTimestamp();
                  currentEmbedSize = getEmbedSize(currentEmbed);
                  currentFieldCount = 0;
                }
                
                currentEmbed.addFields(field);
                currentEmbedSize += fieldSize;
                currentFieldCount++;
              }
              
              // Add the last embed if it has fields
              if (currentFieldCount > 0) {
                embeds.push(currentEmbed);
              }
            }
            
            // Add conclusion to last embed if present
            if (conclusion.trim() && embeds.length > 0) {
              const lastEmbed = embeds[embeds.length - 1];
              const conclusionText = conclusion.trim().substring(0, 2048);
              const lastEmbedSize = getEmbedSize(lastEmbed);
              const conclusionSize = '🔮 Kết luận'.length + conclusionText.length;
              
              if (lastEmbedSize + conclusionSize <= 5800 && lastEmbed.data.fields && lastEmbed.data.fields.length < 25) {
                lastEmbed.addFields({
                  name: '🔮 Kết luận',
                  value: conclusionText,
                  inline: false
                });
              }
            }
            
            // Add question footer to last embed if present
            if (question && embeds.length > 0) {
              const lastEmbed = embeds[embeds.length - 1];
              const footerText = `Câu hỏi: ${question}`.substring(0, 2048);
              const lastEmbedSize = getEmbedSize(lastEmbed);
              if (lastEmbedSize + footerText.length <= 5800) {
                lastEmbed.setFooter({ text: footerText });
              }
            }
            
            // Send first embed as reply
            const replyPayload = { embeds: [embeds[0]] };
            
            // Attach rendered image if available
            if (renderedImagePath) {
              const attachment = new AttachmentBuilder(renderedImagePath);
              replyPayload.files = [attachment];
            }
            
            await safeEditReply(interaction, replyPayload);
            
            // Send remaining embeds as follow-ups
            for (let i = 1; i < embeds.length && i < 5; i++) { // Max 5 total messages
              try {
                await interaction.followUp({ embeds: [embeds[i]] });
              } catch (followUpErr) {
                console.error(`Failed to send follow-up ${i}:`, followUpErr);
                break;
              }
            }
          } else {
            // Single embed - attach rendered image if available
            const replyPayload = { embeds: [embed] };
            
            if (renderedImagePath) {
              const attachment = new AttachmentBuilder(renderedImagePath);
              replyPayload.files = [attachment];
            }
            
            await safeEditReply(interaction, replyPayload);
          }
        } catch (err) {
          console.error('Tarot or LangFlow invocation error', err);
          try { await safeEditReply(interaction, { content: `Error: ${err.message}` }); } catch (_) {}
        }
      }
    } catch (e) {
      console.error('Interaction handler error', e);
    }
  });
}

// register handlers on the initial client
registerEventHandlers(client);

// Start the bot only if token is provided.
if (DISCORD_TOKEN) {
  (async () => {
    try {
      await client.login(DISCORD_TOKEN);
    } catch (err) {
      console.error('Failed to login Discord bot:', err && err.message);
    }
  })();
} else {
  console.log('DISCORD_TOKEN not set; bot login skipped.');
}
