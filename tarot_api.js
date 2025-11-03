const data = require('./card_data.js');

const ALL_CARDS = Array.isArray(data.cards) ? data.cards : [];

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


function pickUnique(n, excludeNameShorts = []) {
  if (n <= 0) return [];
  // filter exclusions by name_short
  const poolBase = ALL_CARDS.filter(c => !excludeNameShorts.includes(c.name_short));
  if (n >= poolBase.length) return poolBase.map(cloneCardWithOrientation);
  const pool = shuffle(poolBase);
  return pool.slice(0, n).map(cloneCardWithOrientation);
}

function cloneCardWithOrientation(card) {
  const orientation = Math.random() < 0.5 ? 'upright' : 'reversed';
  // shallow clone so original data isn't mutated
  const cloned = Object.assign({}, card, { orientation });
  // attach an image path based on the card's short name; clients can change extension if needed
  if (card && card.name_short) {
    cloned.image = `./images/${card.name_short}.jpeg`;
  }
  return cloned;
}

function resolveSignificator(sig) {
  if (!sig) return null;
  // if sig is an object that looks like a card, clone it
  if (typeof sig === 'object' && sig !== null && sig.name_short) return cloneCardWithOrientation(sig);
  // if sig is a string, try to find by name_short or name
  if (typeof sig === 'string') {
    const found = ALL_CARDS.find(c => c.name_short === sig || c.name === sig);
    if (found) return cloneCardWithOrientation(found);
  }
  return null;
}

function drawOne() {
  const [card] = pickUnique(1);
  return card || null;
}

function drawSpread(n) {
  return pickUnique(n);
}

function drawThree() {
  const positions = ['past', 'present', 'future'];
  const cards = pickUnique(3);
  return cards.map((c, i) => ({ position: positions[i] || `pos${i+1}`, card: c }));
}

function drawFive() {
  // A common 5-card layout: situation, challenge, conscious, subconscious, outcome
  const positions = ['situation', 'challenge', 'conscious', 'subconscious', 'outcome'];
  const cards = pickUnique(5);
  return cards.map((c, i) => ({ position: positions[i], card: c }));
}

function drawCelticCross() {
  // Typical Celtic Cross positions (1..10)
  const positions = [
    '1: Present',
    '2: Immediate Challenge (crossing)',
    '3: Distant Past',
    '4: Recent Past',
    '5: Best Outcome / Conscious',
    '6: Immediate Future / Subconscious',
    '7: Self / Attitude',
    '8: Environment / Others',
    '9: Hopes and Fears',
    '10: Outcome'
  ];

  const cards = pickUnique(10);
  return cards.map((c, i) => ({ position: positions[i] || `pos${i+1}`, card: c }));
}

// --- Additional named spreads from user's context ---
function drawReleaseRetain(options = {}) {
  const extras = Array.isArray(options.extraQuestions) ? options.extraQuestions : [];
  const total = 2 + extras.length;
  const picks = pickUnique(total);
  const main = [
    { position: '1: RELEASE', card: picks[0] },
    { position: '2: RETAIN', card: picks[1] },
  ];
  const extraCards = extras.map((q, i) => ({ position: `extra: ${q}`, card: picks[2 + i] }));
  return main.concat(extraCards);
}

function drawAssetHindrance(options = {}) {
  const extras = Array.isArray(options.extraQuestions) ? options.extraQuestions : [];
  const total = 2 + extras.length;
  const picks = pickUnique(total);
  const main = [
    { position: '1: ASSET', card: picks[0] },
    { position: '2: HINDRANCE', card: picks[1] },
  ];
  const extraCards = extras.map((q, i) => ({ position: `extra: ${q}`, card: picks[2 + i] }));
  return main.concat(extraCards);
}

function drawAdviceFromUniverse() {
  const positions = [
    '1: WHAT YOU NEED TO KNOW',
    '2: A NEW PERSPECTIVE',
    '3: ACTION TO TAKE',
  ];
  const cards = pickUnique(3);
  return cards.map((c, i) => ({ position: positions[i], card: c }));
}

function drawPastPresentFuture() {
  return drawThree();
}

function drawMindBodySpirit() {
  const positions = ['1: MIND', '2: BODY', '3: SPIRIT'];
  const cards = pickUnique(3);
  return cards.map((c, i) => ({ position: positions[i], card: c }));
}

function drawExistingRelationship() {
  const positions = ['1: ME', '2: THEM', '3: THE BRIDGE', '4: HIGHEST POTENTIAL', '5: LOWEST POTENTIAL'];
  const cards = pickUnique(5);
  return cards.map((c, i) => ({ position: positions[i], card: c }));
}

function drawPotentialRelationship() {
  const positions = ['1: ME', '2: WHAT LOVE ASKS OF ME', '3: MESSAGE FROM THE UNIVERSE', '4: ACTION TO TAKE', '5: WHAT TO RELEASE'];
  const cards = pickUnique(5);
  return cards.map((c, i) => ({ position: positions[i], card: c }));
}

function drawLawOfAttraction(options = {}) {
  // options.significator can be a name_short, name, or a card object
  const sig = resolveSignificator(options.significator);
  if (sig) {
    // reserve the significator and pick 4 more unique excluding it
    const picks = pickUnique(4, [sig.name_short]);
    const positions = ['SIGNIFICATOR', '2: YOUR CURRENT ENERGY', '3: THE ENERGY YOU NEED', '4: HOW TO GET INTO ALIGNMENT', '5: LETTING GO OF THE HOW'];
    return [
      { position: positions[0], card: sig },
      ...picks.map((c, i) => ({ position: positions[i + 1], card: c })),
    ];
  }
  const positions = ['SIGNIFICATOR', '2: YOUR CURRENT ENERGY', '3: THE ENERGY YOU NEED', '4: HOW TO GET INTO ALIGNMENT', '5: LETTING GO OF THE HOW'];
  const cards = pickUnique(5);
  return cards.map((c, i) => ({ position: positions[i], card: c }));
}

function drawMakingDecision() {
  const positions = ['1: OPTION 1', '2: OPTION 2', '3: OPTION 1 ENERGY', '4: OPTION 2 ENERGY', '5: FEARS', '6: BLESSINGS'];
  const cards = pickUnique(6);
  return cards.map((c, i) => ({ position: positions[i], card: c }));
}
module.exports = {
  drawOne,
  drawSpread,
  drawThree,
  drawFive,
  drawCelticCross,
  // additional named spreads
  drawReleaseRetain,
  drawAssetHindrance,
  drawAdviceFromUniverse,
  drawPastPresentFuture,
  drawMindBodySpirit,
  drawExistingRelationship,
  drawPotentialRelationship,
  drawLawOfAttraction,
  drawMakingDecision,
};
