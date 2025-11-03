const express = require('express');
const api = require('./tarot_api.js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// serve images statically so Discord bot or clients can fetch imagePath URLs
app.use('/images', express.static(path.join(__dirname, 'images')));

function jsonOk(res, data) {
  res.json({ success: true, data });
}

function jsonErr(res, message, code = 400) {
  res.status(code).json({ success: false, error: message });
}

// generic GET that maps a type to a spread
app.get('/draw/:type', (req, res) => {
  const { type } = req.params;
  const q = req.query || {};
  try {
    switch (type) {
      case 'one':
        return jsonOk(res, api.drawOne());
      case 'three':
        return jsonOk(res, api.drawThree());
      case 'five':
        return jsonOk(res, api.drawFive());
      case 'spread': {
        const n = parseInt(q.n || '3', 10);
        return jsonOk(res, api.drawSpread(n));
      }
      case 'celtic-cross':
        return jsonOk(res, api.drawCelticCross());
      case 'release-retain': {
        const extras = q.extras ? q.extras.split(',').map(s => s.trim()).filter(Boolean) : [];
        return jsonOk(res, api.drawReleaseRetain({ extraQuestions: extras }));
      }
      case 'asset-hindrance': {
        const extras = q.extras ? q.extras.split(',').map(s => s.trim()).filter(Boolean) : [];
        return jsonOk(res, api.drawAssetHindrance({ extraQuestions: extras }));
      }
      case 'advice-universe':
        return jsonOk(res, api.drawAdviceFromUniverse());
      case 'past-present-future':
        return jsonOk(res, api.drawPastPresentFuture());
      case 'mind-body-spirit':
        return jsonOk(res, api.drawMindBodySpirit());
      case 'existing-relationship':
        return jsonOk(res, api.drawExistingRelationship());
      case 'potential-relationship':
        return jsonOk(res, api.drawPotentialRelationship());
      case 'law-of-attraction': {
        // accept significator via query param 'sig' (name_short or name)
        const sig = q.sig || null;
        return jsonOk(res, api.drawLawOfAttraction({ significator: sig }));
      }
      case 'making-decision':
        return jsonOk(res, api.drawMakingDecision());
      default:
        return jsonErr(res, `Unknown spread type: ${type}`, 404);
    }
  } catch (err) {
    console.error('draw error', err);
    return jsonErr(res, 'Internal server error', 500);
  }
});

// POST endpoints for actions that need body data (significator, extras)
app.post('/draw/law-of-attraction', (req, res) => {
  const { significator } = req.body || {};
  try {
    return jsonOk(res, api.drawLawOfAttraction({ significator }));
  } catch (err) {
    console.error(err);
    return jsonErr(res, 'Internal server error', 500);
  }
});

app.post('/draw/release-retain', (req, res) => {
  const { extraQuestions } = req.body || {};
  return jsonOk(res, api.drawReleaseRetain({ extraQuestions }));
});

app.post('/draw/asset-hindrance', (req, res) => {
  const { extraQuestions } = req.body || {};
  return jsonOk(res, api.drawAssetHindrance({ extraQuestions }));
});

app.listen(PORT, () => {
  console.log(`Tarot API server listening on http://localhost:${PORT}`);
});
