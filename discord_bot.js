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
// LangFlow configuration: only an API key is read from environment; host is fixed to localhost
const LANGFLOW_BASE_URL = 'http://localhost:7860';
const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY || null; // optional API key for LangFlow

// Load card data for autocomplete suggestions (name and short name)
let CARDS = [];
try {
  CARDS = require('./card_data.js');
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

  // Build run URL using LANGFLOW_BASE_URL and the flow id
  const host = String(LANGFLOW_BASE_URL).replace(/\/$/, '');
  const runUrl = `${host}/api/v1/run/${encodeURIComponent(flow)}`;

  const headers = { 'Content-Type': 'application/json' };
  if (LANGFLOW_API_KEY) headers['Authorization'] = `Bearer ${LANGFLOW_API_KEY}`;

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
  botClient.on('ready', () => {
    console.log(`Discord bot ready as ${botClient.user && botClient.user.tag}`);
  });

  // Register slash commands
  botClient.on('ready', async () => {
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
      console.warn('Could not register slash commands during ready:', e && e.message);
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
            try { await interaction.followUp({ content: `Error: ${e.message}`, ephemeral: true }); } catch (_) {}
          }
          return;
        }

        if (id.startsWith('showimages:')) {
          const apiPath = id.slice('showimages:'.length);
          await interaction.deferReply({ ephemeral: true });
          try {
            const data = await callApi(apiPath);
            const imgs = (Array.isArray(data) ? data : []).map(it => (it.card && it.card.imagePath) ? `${TAROT_API_URL}/${it.card.imagePath.replace(/^\.\//, '')}` : null).filter(Boolean);
            await interaction.editReply({ content: imgs.length ? imgs.join('\n') : 'No images available for this spread.' });
          } catch (e) {
            console.error('Show images failed', e);
            try { await interaction.editReply({ content: `Error: ${e.message}` }); } catch (_) {}
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
          if (typeof val === 'undefined') { await interaction.reply({ content: 'No card selected', ephemeral: true }); return; }
          const idx = parseInt(val, 10);
          await interaction.deferReply({ ephemeral: true });
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
            await interaction.reply({ content: `Unknown subcommand: ${sub}`, ephemeral: true });
            return;
        }

        // Build query param (kept for clarity) but we'll forward spread info to LangFlow instead of calling local API
        const question = interaction.options.getString('question') || '';
        if (question) apiPath += (apiPath.includes('?') ? '&' : '?') + `q=${encodeURIComponent(question)}`;

        // Prepare the text input for LangFlow: include spread type and the api path
        // For the special 'flow' subcommand we expect the user to provide a flow_id option.
        const flowToUse = (sub === 'flow') ? (interaction.options.getString('flow_id') || sub) : sub;
        const inputText = `Spread: ${sub}\nAPI: ${apiPath}${question ? `\nQuestion: ${question}` : ''}`;

        await interaction.deferReply();
        try {
          const lfOut = await callLangFlow(flowToUse, inputText);
          let desc = '';
          if (lfOut == null) {
            desc = '(no output)';
          } else if (typeof lfOut === 'string') {
            desc = lfOut;
          } else {
            try { desc = JSON.stringify(lfOut, null, 2); } catch (_) { desc = String(lfOut); }
          }
          desc = desc.substring(0, 4000);
          const embed = new EmbedBuilder().setTitle(`LangFlow — ${flowToUse}`).setDescription(desc).setTimestamp();
          if (question) embed.setFooter({ text: `Query: ${question}` });
          await interaction.editReply({ embeds: [embed] });
        } catch (err) {
          console.error('LangFlow invocation error', err);
          try { await interaction.editReply({ content: `Error running LangFlow: ${err.message}` }); } catch (_) {}
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
