const fetch = require('node-fetch');
const { TAROT_API_URL, TAROT_API_KEY, LANGFLOW_API_KEY } = process.env;

function buildQuery(params) {
  const q = [];
  for (const k in params) {
    const v = params[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      q.push(`${encodeURIComponent(k)}=${encodeURIComponent(v.join(','))}`);
    } else {
      q.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return q.length ? `?${q.join('&')}` : '';
}

async function callTarotApi(options = {}) {
  // options: { spread, n, sig, extraQuestions, question, apiUrl }
  const spread = options.spread || 'one';
  const apiBase = options.apiUrl || TAROT_API_URL;
  if (!apiBase) throw new Error('TAROT_API_URL not configured and no apiUrl provided');

  let path = '/draw/one';
  let method = 'GET';
  let body = null;
  const qparams = {};

  switch (spread) {
    case 'one': path = '/draw/one'; break;
    case 'three': path = '/draw/three'; break;
    case 'five': path = '/draw/five'; break;
    case 'spread': {
      const n = options.n || 3;
      path = '/draw/spread';
      qparams.n = n;
      break;
    }
    case 'celtic-cross': path = '/draw/celtic-cross'; break;
    case 'release-retain': {
      path = '/draw/release-retain';
      if (Array.isArray(options.extraQuestions) && options.extraQuestions.length) {
        // prefer POST when extras provided
        method = 'POST';
        body = { extraQuestions: options.extraQuestions };
      } else if (options.extraQuestions && typeof options.extraQuestions === 'string') {
        qparams.extras = options.extraQuestions;
      }
      break;
    }
    case 'asset-hindrance': {
      path = '/draw/asset-hindrance';
      if (Array.isArray(options.extraQuestions) && options.extraQuestions.length) {
        method = 'POST';
        body = { extraQuestions: options.extraQuestions };
      }
      break;
    }
    case 'advice-universe': path = '/draw/advice-universe'; break;
    case 'past-present-future': path = '/draw/past-present-future'; break;
    case 'mind-body-spirit': path = '/draw/mind-body-spirit'; break;
    case 'existing-relationship': path = '/draw/existing-relationship'; break;
    case 'potential-relationship': path = '/draw/potential-relationship'; break;
    case 'making-decision': path = '/draw/making-decision'; break;
    case 'law-of-attraction': {
      path = '/draw/law-of-attraction';
      if (options.sig) qparams.sig = options.sig;
      break;
    }
    default:
      throw new Error(`Unknown spread '${spread}'. Valid: one, three, five, spread, celtic-cross, release-retain, asset-hindrance, advice-universe, past-present-future, mind-body-spirit, existing-relationship, potential-relationship, making-decision, law-of-attraction`);
  }

  if (options.question) qparams.q = options.question;

  const query = buildQuery(qparams);
  const url = `${apiBase.replace(/\/$/, '')}${path}${query}`;

  // Build headers
  const headers = { 'Content-Type': 'application/json' };
  const key = TAROT_API_KEY || LANGFLOW_API_KEY || null;
  if (key) headers['x-api-key'] = key;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Tarot API returned ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  return json;
}

module.exports = { callTarotApi };
