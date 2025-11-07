require('dotenv').config();
const fetch = require('node-fetch');
const crypto = require('crypto');
const {
  Client,
  IntentsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
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

function createClient(includeMessageContent) {
  const intents = new IntentsBitField();
  intents.add(IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages);
  // Message Content is intentionally not added; this bot is slash-first.
  if (includeMessageContent) intents.add(IntentsBitField.Flags.MessageContent);
  return new Client({ intents });
}

const client = createClient(false);
const { callTarotApi } = require('./tarot_client');

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
  const payload = {
    output_type: 'text',
    input_type: 'chat',
    input_value: typeof input === 'string' ? input : JSON.stringify(input)
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
        if (!Array.isArray(CARDS) || CARDS.length === 0) { await interaction.respond([]); return; }
        const matches = CARDS.filter(c => (c.name && c.name.toLowerCase().includes(val)) || (c.name_short && c.name_short.toLowerCase().includes(val))).slice(0,25).map(c => ({ name: `${c.name} (${c.name_short})`, value: c.name_short }));
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
          await safeEditReply(interaction, { content: 'LangFlow integration is not configured correctly. Set LANGFLOW_API_URL to the full run URL (e.g. https://host/api/v1/run/{flow} or the exact run URL).', ephemeral: true });
          return;
        }

        // We no longer call the local Tarot API during slash commands. Instead send the spread metadata to LangFlow directly.
        if (!await safeDeferReply(interaction)) return;
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

          // Helper: try to extract a human text from various possible output shapes
          function extractText(o) {
            if (!o) return '';
            if (typeof o === 'string') return o;
            if (typeof o === 'object') {
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
            try { return JSON.stringify(o); } catch (_) { return String(o); }
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

          // Extract primary text from the LangFlow/agent output
          let textContent = (extractText(lfOut) || '(no output)').toString().trim();
          
          // Clean up the text: remove JSON artifacts and fix formatting
          // Remove escaped quotes and newlines from JSON stringification
          textContent = textContent.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
          // Remove any remaining JSON structure markers
          textContent = textContent.replace(/^["']|["']$/g, '');
          // Fix malformed image URLs (remove /n/n or similar artifacts)
          textContent = textContent.replace(/\.jpeg\/n\/n/g, '.jpeg\n\n');
          textContent = textContent.replace(/\.jpg\/n\/n/g, '.jpg\n\n');
          textContent = textContent.replace(/\.png\/n\/n/g, '.png\n\n');
          // Clean up multiple consecutive newlines (more than 2)
          textContent = textContent.replace(/\n{3,}/g, '\n\n');

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
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // First line is usually the title
            if (i === 0 && line.length < 100) {
              title = line;
              continue;
            }
            
            // Lines containing card names with (Xuôi) or (Ngược) followed by em dash
            if ((line.includes('(Xuôi)') || line.includes('(Ngược)')) && line.includes('—')) {
              const parts = line.split('—');
              if (parts.length >= 2) {
                const fieldName = parts[0].trim().substring(0, 256); // ensure name <= 256 chars
                const fieldValue = parts.slice(1).join('—').trim().substring(0, 1024); // ensure value <= 1024 chars
                if (fieldName && fieldValue) {
                  fields.push({
                    name: fieldName,
                    value: fieldValue,
                    inline: false
                  });
                }
              }
              continue;
            }
            
            // Detect conclusion section
            if (line.toLowerCase().startsWith('kết luận')) {
              currentSection = 'conclusion';
              continue;
            }
            
            // Detect advice section with colon
            if (line.toLowerCase().startsWith('lời khuyên') && line.includes(':')) {
              const colonIdx = line.indexOf(':');
              const advice = line.substring(colonIdx + 1).trim();
              if (advice) {
                fields.push({
                  name: '💡 Lời khuyên',
                  value: advice.substring(0, 1024),
                  inline: false
                });
              }
              continue;
            }
            
            // Build description or conclusion
            if (currentSection === 'conclusion') {
              conclusion += line + '\n';
            } else if (!line.toLowerCase().startsWith('trải bài') && description.length < 2000) {
              description += line + '\n';
            }
          }
          
          // Set embed title and description
          embed.setTitle(title.substring(0, 256));
          
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
          
          // Add description with size checking
          if (description.trim()) {
            const maxDescLen = Math.min(4096, 4000 - title.length); // leave room for other content
            embed.setDescription(description.trim().substring(0, maxDescLen));
          }
          
          // Add fields for card meanings (validate each field and check total size)
          let currentSize = getEmbedSize(embed);
          const maxEmbedSize = 5800; // safety margin below 6000
          let fieldCount = 0;
          const maxFields = 24; // Reserve 1 field for truncation notice or conclusion
          let wasTruncated = false;
          
          for (const field of fields) {
            // Stop if we've reached field limit
            if (fieldCount >= maxFields) {
              wasTruncated = true;
              break;
            }
            
            // Double-check field constraints before adding
            if (field.name && field.name.length > 0 && field.name.length <= 256 &&
                field.value && field.value.length > 0 && field.value.length <= 1024) {
              
              const fieldSize = field.name.length + field.value.length;
              
              // Check if adding this field would exceed the size limit
              if (currentSize + fieldSize > maxEmbedSize) {
                wasTruncated = true;
                // If no fields added yet, add at least a truncated version of this one
                if (fieldCount === 0) {
                  const truncatedValue = field.value.substring(0, Math.min(1024, maxEmbedSize - currentSize - field.name.length - 100)) + '...';
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
              
              embed.addFields(field);
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
          
          // Add conclusion as a field if present and size allows
          if (conclusion.trim() && fieldCount < 25) {
            const conclusionText = conclusion.trim().substring(0, 1024);
            const conclusionSize = '🔮 Kết luận'.length + conclusionText.length;
            
            if (currentSize + conclusionSize <= maxEmbedSize && conclusionText) {
              embed.addFields({
                name: '🔮 Kết luận',
                value: conclusionText,
                inline: false
              });
              currentSize += conclusionSize;
              fieldCount++;
            }
          }
          
          // Add first image as main embed image
          if (imgs.length > 0) {
            embed.setImage(imgs[0]);
          }
          
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
            console.warn(`Embed size ${totalSize} exceeds 6000, attempting emergency truncation`);
            // Emergency fallback: create simplified embed
            const fallbackEmbed = new EmbedBuilder()
              .setColor(0x7B68EE)
              .setTitle(title.substring(0, 256))
              .setDescription('⚠️ Kết quả bói quá dài để hiển thị đầy đủ. Dưới đây là tóm tắt:\n\n' + 
                cleanText.substring(0, 1500) + '\n\n...(nội dung đã được rút gọn)')
              .setTimestamp();
            if (imgs.length > 0) fallbackEmbed.setImage(imgs[0]);
            await safeEditReply(interaction, { embeds: [fallbackEmbed] });
          } else {
            await safeEditReply(interaction, { embeds: [embed] });
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
