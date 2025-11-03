const api = require('./tarot_api.js');

function print(title, obj) {
  console.log('\n=== ' + title + ' ===');
  console.log(JSON.stringify(obj, null, 2));
}

print('Draw One', api.drawOne());
print('Draw Three (past/present/future)', api.drawThree());
print('Draw Five (situation/challenge/conscious/subconscious/outcome)', api.drawFive());
print('Draw 3-card generic spread', api.drawSpread(3));
print('Celtic Cross (10 cards)', api.drawCelticCross());

print('Release & Retain (2-card)', api.drawReleaseRetain());
print('Asset & Hindrance (2-card)', api.drawAssetHindrance());
print('Advice from the Universe (3-card)', api.drawAdviceFromUniverse());
print('Past, Present & Future (3-card)', api.drawPastPresentFuture());
print('Mind, Body & Spirit (3-card)', api.drawMindBodySpirit());
print('Your Existing Relationship (5-card)', api.drawExistingRelationship());
print('Your Potential Relationship (5-card)', api.drawPotentialRelationship());
print('Law of Attraction (5-card) WITHOUT significator', api.drawLawOfAttraction());
print('Law of Attraction (5-card) WITH significator (waac)', api.drawLawOfAttraction({ significator: 'waac' }));
print('Making a Decision (6-card)', api.drawMakingDecision());

console.log('\nTest complete.');
