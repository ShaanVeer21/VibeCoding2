// ─── POKER ENGINE ────────────────────────────────────────────────────────────

export const SUITS = ["♠","♥","♦","♣"];
export const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const RANK_VAL = Object.fromEntries(RANKS.map((r,i) => [r, i+2]));

export const createDeck = () => shuffle(
  SUITS.flatMap(s => RANKS.map(r => ({ suit: s, rank: r })))
);

export const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

export const cardValue = (c) => RANK_VAL[c.rank];

const getCombos = (arr, k) => {
  if (k === 0) return [[]];
  if (!arr.length) return [];
  const [f, ...r] = arr;
  return [...getCombos(r, k-1).map(c => [f, ...c]), ...getCombos(r, k)];
};

const score5 = (cards) => {
  const vals  = cards.map(cardValue).sort((a,b) => b-a);
  const suits = cards.map(c => c.suit);
  const flush    = new Set(suits).size === 1;
  const straight = vals.every((v,i) => i===0 || vals[i-1]-v===1) ||
    (vals[0]===14 && vals[1]===5 && vals[2]===4 && vals[3]===3 && vals[4]===2);
  const counts = {};
  for (const v of vals) counts[v] = (counts[v]||0)+1;
  const groups = Object.values(counts).sort((a,b) => b-a);

  let rank, name;
  if (flush && straight && vals[0]===14 && vals[4]===10) { rank=9; name="Royal Flush"; }
  else if (flush && straight)              { rank=8; name="Straight Flush"; }
  else if (groups[0]===4)                  { rank=7; name="Four of a Kind"; }
  else if (groups[0]===3&&groups[1]===2)   { rank=6; name="Full House"; }
  else if (flush)                          { rank=5; name="Flush"; }
  else if (straight)                       { rank=4; name="Straight"; }
  else if (groups[0]===3)                  { rank=3; name="Three of a Kind"; }
  else if (groups[0]===2&&groups[1]===2)   { rank=2; name="Two Pair"; }
  else if (groups[0]===2)                  { rank=1; name="One Pair"; }
  else                                     { rank=0; name="High Card"; }

  const value = rank * 1e10 + vals.reduce((acc,v,i) => acc + v * Math.pow(100, 4-i), 0);
  return { rank, name, value };
};

export const evaluateHand = (cards) => {
  if (cards.length < 5) return { rank:0, name:"High Card", value:0 };
  const combos = getCombos(cards, 5);
  let best = null;
  for (const c of combos) {
    const s = score5(c);
    if (!best || s.value > best.value) best = s;
  }
  return best;
};

// ── Hand strength 0-1 for decision making ────────────────────────────────────
export const handStrength = (hole, community) => {
  const all = [...hole, ...community];
  if (all.length < 2) return 0.3;
  if (all.length < 5) {
    // pre-flop: use Chen formula approximation
    const v1 = cardValue(hole[0]), v2 = cardValue(hole[1]);
    const suited  = hole[0].suit === hole[1].suit;
    const paired  = hole[0].rank === hole[1].rank;
    const gap     = Math.abs(v1 - v2);
    let score = Math.max(v1, v2) / 14;
    if (paired)         score += 0.2;
    if (suited)         score += 0.08;
    if (gap <= 1)       score += 0.05;
    return Math.min(1, score);
  }
  const r = evaluateHand(all);
  return Math.min(1, (r.rank + 1) / 10 + (r.value % 1e10) / 1e12);
};

// ── Pot odds calculation ──────────────────────────────────────────────────────
// Returns the minimum equity needed to profitably call
export const potOdds = (callAmount, pot) => {
  if (callAmount <= 0) return 0;
  return callAmount / (pot + callAmount);
};

// ── Monte Carlo equity estimation (fast, ~200 simulations) ───────────────────
// Estimates win probability for given hole cards vs N opponents with unknown cards
export const estimateEquity = (hole, community, numOpponents = 1, simulations = 200) => {
  if (hole.length < 2) return 0.5;
  const known = new Set([...hole, ...community].map(c => c.rank + c.suit));
  let wins = 0;

  for (let i = 0; i < simulations; i++) {
    // build remaining deck
    const deck = shuffle(
      SUITS.flatMap(s => RANKS.map(r => ({ suit:s, rank:r })))
        .filter(c => !known.has(c.rank + c.suit))
    );

    // fill community to 5
    const board = [...community];
    let di = 0;
    while (board.length < 5) board.push(deck[di++]);

    // deal opponents
    const oppHands = [];
    for (let o = 0; o < numOpponents; o++) {
      oppHands.push([deck[di++], deck[di++]]);
    }

    // evaluate
    const myScore  = evaluateHand([...hole, ...board]);
    const oppScores = oppHands.map(oh => evaluateHand([...oh, ...board]));
    const bestOpp  = Math.max(...oppScores.map(s => s.value));

    if (myScore.value > bestOpp) wins++;
    else if (myScore.value === bestOpp) wins += 0.5; // split
  }

  return wins / simulations;
};