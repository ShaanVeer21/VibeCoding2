import { handStrength, potOdds, estimateEquity } from "./engine";

export const DEFAULT_AGENTS = [
  { id:0, name:"CIPHER", role:"Aggressive Bluffer",  color:"#00f5ff", icon:"⚡", isCustom:false },
  { id:1, name:"NOVA",   role:"Neural Optimizer",     color:"#c084fc", icon:"✦", isCustom:false },
  { id:2, name:"GHOST",  role:"Chaos Agent",          color:"#fb923c", icon:"◈", isCustom:false },
  { id:3, name:"ATLAS",  role:"Silent Survivalist",   color:"#4ade80", icon:"◎", isCustom:false },
];

export const ICONS  = ["◉","⬡","⬢","◆","▲","★","✸","⊕","⊗","⊘","⊙","◐"];
export const COLORS = ["#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#ff6bff","#ff9f43","#00d2d3","#ff9ff3"];
export const STYLES = ["SHARK","MANIAC","ROCK","CALLING STATION","TRAPPER"];
export const DEFAULT_STATS = { wins:0, losses:0, folds:0, raises:0, calls:0 };

export const LLM_PROVIDERS = {
  groq: {
    label: "Groq (Free)", color: "#f97316", placeholder: "gsk_...",
    defaultModel: "llama-3.1-8b-instant",
    buildRequest: (prompt, model) => ({
      url: "https://api.groq.com/openai/v1/chat/completions",
      body: {
        model,
        max_tokens: 150,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a poker agent. Always respond with valid JSON only. No markdown, no extra text. Format: {action, amount, thought} where action is fold/check/call/raise." },
          { role: "user", content: prompt }
        ],
      },
      extractText: d => d.choices?.[0]?.message?.content || "",
    }),
    headerKey: "Authorization", headerPrefix: "Bearer ", extraHeaders: {},
  },
};

const BB_AMOUNT = 50; // must be defined before buildPokerPrompt

function buildPokerPrompt(agentName, hole, community, ctx) {
  const { pot, callAmount, chips, numOpponents=3, phase="UNKNOWN", round=1 } = ctx;
  const holeStr      = hole.map(c=>`${c.rank}${c.suit}`).join(" ");
  const communityStr = community.length>0 ? community.map(c=>`${c.rank}${c.suit}`).join(" ") : "none yet";
  const equity       = estimateEquity(hole, community, Math.max(1, numOpponents), 100);
  const odds         = potOdds(callAmount, pot);
  const str          = (hole && hole.length >= 2) ? handStrength(hole, community) : 0.3;
  const minRaise     = Math.min(callAmount + BB_AMOUNT, chips);

  const equityPct = (equity * 100).toFixed(0);
  const oddsPct   = (odds * 100).toFixed(0);
  const strPct    = (str * 100).toFixed(0);
  const edge      = ((equity - odds) * 100).toFixed(0);
  const isFree    = callAmount === 0;
  const canRaise  = chips > callAmount;

  return `You are ${agentName}, a No-Limit Texas Hold'em poker agent. Make the best decision.

CURRENT HAND:
  Street     : ${phase}  (Round ${round})
  Hole cards : ${holeStr}
  Board      : ${communityStr}
  Pot        : ${pot} chips
  To call    : ${callAmount} chips${isFree ? "  ← FREE, you can check" : ""}
  Your chips : ${chips}
  Opponents  : ${numOpponents} still in hand

YOUR EDGE:
  Hand strength : ${strPct}%
  Win equity    : ${equityPct}%   ← your estimated chance of winning
  Pot odds need : ${oddsPct}%   ← minimum equity to call profitably
  Your edge     : ${edge}%   ← POSITIVE means calling/raising is profitable

STRATEGY GUIDE (use your judgment, don't be passive):
  edge > +15% → raise (you have a real edge, charge opponents to stay in)
  edge > 0%   → at minimum call, consider raising
  edge < 0%   → fold unless bluffing or it's free to check
  It's FREE to check → always at least check, never fold for free
  Strong hand (equity > 60%) → raise to build the pot

RESPOND WITH EXACTLY THIS JSON FORMAT — nothing else, no markdown:
{"action":"fold|check|call|raise","amount":0,"thought":"one sentence explaining your reasoning"}

VALIDATION:
  "check" → only valid when callAmount is 0 (it's free)
  "call"  → only when callAmount > 0 and you can afford it
  "raise" → amount must be between ${minRaise} and ${chips}
  "fold"  → only when callAmount >= your chips or edge is very negative
  amount  → must be 0 for fold/check/call, the raise total for raise`;
}

// Rate limiter — ensures min 1500ms between API calls to avoid 429s
let _lastCallTime = 0;
const _minGapMs = 2000; // Groq allows 30 req/min, 2s gap is safe

// Returns { action, amount, thought } on success
// Returns { _error:true, errorMsg, _rateLimited:bool } on failure
// Caller ALWAYS falls back to agentDecide on any error
export async function llmDecide(agent, hole, community, ctx, apiKeys) {
  // Throttle: wait if last call was too recent
  const now = Date.now();
  const wait = _minGapMs - (now - _lastCallTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastCallTime = Date.now();

  const provider = agent.llmProvider || "groq";
  const key      = apiKeys?.[provider] || "";
  const cfg      = LLM_PROVIDERS[provider];
  if (!cfg || !key) return null;

  const { callAmount, chips } = ctx;
  const prompt = buildPokerPrompt(agent.name, hole, community, ctx);
  const model  = agent.llmModel || cfg.defaultModel;
  const req    = cfg.buildRequest(prompt, model);

  const headers = { "Content-Type":"application/json", ...cfg.extraHeaders };
  if (cfg.headerKey) headers[cfg.headerKey] = (cfg.headerPrefix||"") + key;

  const url = req.url;

  try {
    const response = await fetch(url, { method:"POST", headers, body:JSON.stringify(req.body) });

    // Rate limit — silent fallback, no user-visible error
    if (response.status === 429) {
      return { _error:true, _rateLimited:true, errorMsg:"rate limited" };
    }
    if (!response.ok) {
      let errBody = "";
      try { const e = await response.json(); errBody = e?.error?.message || JSON.stringify(e); } catch {}
      console.error(`[LLM:${provider}] ${response.status}:`, errBody);
      return { _error:true, errorMsg:`HTTP ${response.status}: ${errBody}` };
    }

    const data  = await response.json();
    const text  = req.extractText(data);
    const clean = text.replace(/```json[\s\S]*?```|```/g,"").trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch {
      // Try to extract JSON from anywhere in the response
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) return { _error:true, errorMsg:"bad JSON" };
      parsed = JSON.parse(match[0]);
    }

    let { action, amount, thought } = parsed;
    amount = Number(amount) || 0;
    thought = String(thought || "...").slice(0, 120);

    // Full sanitize — every possible illegal state corrected
    if (!["fold","check","call","raise"].includes(action)) action = "fold";
    if (chips <= 0)                               return { action:"check", amount:0, thought:"All-in, waiting." };
    if (action === "check" && callAmount > 0)     action = "call";
    if (action === "call"  && callAmount === 0)   action = "check";
    if (action === "call"  && callAmount >= chips) action = "fold"; // can't afford
    if (action === "raise") {
      const minR = Math.min(callAmount + 1, chips);
      amount = Math.max(minR, Math.min(chips, amount));
      if (amount <= 0 || amount <= callAmount)    { action = callAmount===0?"check":"call"; amount=0; }
    } else {
      amount = 0;
    }

    return { action, amount, thought };
  } catch (err) {
    return { _error:true, errorMsg: err?.message || "unknown" };
  }
}

// Hardcoded fallback — guaranteed to return a valid decision, no exceptions
export function agentDecide(agent, hole, community, ctx) {
  const { pot, callAmount, chips, lastActions=[], recentLosses=0, numOpponents=3 } = ctx;

  // Guard: nothing to do if no chips
  if (chips <= 0) return { action:"check", amount:0, thought:"All-in, no chips." };
  const str    = handStrength(hole, community);
  const equity = estimateEquity(hole, community, Math.max(1, numOpponents), 150);
  const odds   = potOdds(callAmount, pot);
  const hasValue   = equity > odds;
  const callRatio  = chips > 0 ? callAmount / chips : 1;
  const rand       = Math.random();
  const tableRaises= lastActions.filter(a => a.action==="raise").length;

  let action, amount = 0, thought = "";
  const id = agent.isCustom ? "custom" : agent.id;

  if (id === "custom") {
    const risk=agent.params.risk/100, agg=agent.params.aggression/100;
    const bluff=agent.params.bluff/100, patience=agent.params.patience/100;
    const tilt=agent.params.tilt/100, adapt=agent.params.adaptability/100;
    const tiltFactor = tilt * recentLosses * 0.1;
    if (adapt>0.6 && tableRaises>2 && equity<0.4) {
      action="fold"; thought="Table too hot.";
    } else if (equity+tiltFactor > (1-risk+patience*0.2)) {
      if (rand<agg) { action="raise"; amount=Math.min(chips, callAmount+Math.floor(pot*(0.3+agg*0.7))); thought=`Equity ${(equity*100).toFixed(0)}%. Raising.`; }
      else          { action="call"; thought="Equity confirmed. Calling."; }
    } else if (rand<bluff && pot<chips*0.4 && tableRaises<2) {
      action="raise"; amount=Math.min(chips, callAmount+Math.floor(pot*0.4)); thought="Bluff engaged.";
    } else if (hasValue && callRatio<0.25) {
      action="call"; thought=`Pot odds ${(odds*100).toFixed(0)}%. Worth it.`;
    } else {
      action="fold"; thought="Insufficient equity.";
    }

  } else if (id === 0) { // CIPHER — Aggressive Bluffer
    if (equity > 0.60) {
      action="raise"; amount=Math.min(chips, callAmount+Math.floor(pot*(0.5+rand*0.3))); thought=`Equity ${(equity*100).toFixed(0)}%. Dominating.`;
    } else if (equity > 0.40 && tableRaises < 2) {
      if (rand<0.45) { action="raise"; amount=Math.min(chips, callAmount+Math.floor(pot*0.4)); thought="Semi-bluff. Pressure."; }
      else           { action="call"; thought="Keeping pressure."; }
    } else if (equity < 0.30 && rand<0.22 && tableRaises<2 && pot<chips*0.3) {
      action="raise"; amount=Math.min(chips, callAmount+Math.floor(pot*0.45)); thought="Calculated bluff.";
    } else if (equity < 0.30 && (tableRaises>=2 || callRatio>0.20)) {
      action="fold"; thought="Too much heat. Fold.";
    } else if (hasValue) {
      action="call"; thought="Marginal +EV. Call.";
    } else {
      action="fold"; thought="Negative EV. Out.";
    }

  } else if (id === 1) { // NOVA fallback
    const edge = equity - odds;
    if (equity > 0.65) {
      action="raise"; amount=Math.min(chips, callAmount+Math.floor(pot*0.55)); thought=`Strong equity ${(equity*100).toFixed(0)}%. Raise.`;
    } else if (tableRaises>=2 && equity>0.45) {
      action="raise"; amount=Math.min(chips, callAmount+Math.floor(pot*0.4)); thought="Counter-raise. Likely bluff.";
    } else if (edge>0.08 && callRatio<0.20) {
      action="call"; thought=`Edge +${(edge*100).toFixed(0)}% over pot odds.`;
    } else if (hasValue && callRatio<0.10) {
      action="call"; thought="Marginal +EV. Cheap call.";
    } else {
      action="fold"; thought=`Equity ${(equity*100).toFixed(0)}% insufficient.`;
    }

  } else if (id === 2) { // GHOST — Chaos Agent
    const r2 = Math.random();
    if (equity > 0.72) {
      if (r2<0.5) { action="raise"; amount=Math.min(chips, callAmount+Math.floor(r2*pot*1.2)); thought="Spicy hand. RAISE."; }
      else        { action="call"; thought="Slowplay. Chaos."; }
    } else if (equity<0.20 && callRatio>0.15) {
      if (r2<0.55) { action="fold"; thought="Even I know this is bad."; }
      else         { action="call"; thought="Yolo."; }
    } else {
      if (r2<0.25)      { action="fold"; thought="Chaos fold. Vibes only."; }
      else if (r2<0.55) { action="call"; thought="Sure, whatever."; }
      else              { action="raise"; amount=Math.min(chips, callAmount+Math.floor(r2*pot)); thought="MAXIMUM CHAOS."; }
    }

  } else { // ATLAS — Silent Survivalist (id===3 and any unknown)
    if (equity > 0.68) {
      action="raise"; amount=Math.min(chips, callAmount+Math.floor(pot*0.45)); thought=`Equity ${(equity*100).toFixed(0)}%. Controlled raise.`;
    } else if (tableRaises>=2 && equity>0.42) {
      action="call"; thought="Table over-raising. Bluff call.";
    } else if (hasValue && callRatio<0.18) {
      if (equity>0.52 && rand<0.30) { action="raise"; amount=Math.min(chips, callAmount+Math.floor(pot*0.3)); thought="Defensive raise."; }
      else                           { action="call"; thought=`+EV call. Equity ${(equity*100).toFixed(0)}%.`; }
    } else if (callRatio > 0.20) {
      action="fold"; thought="Too expensive. Preserve chips.";
    } else if (equity>0.33 && callRatio<0.07) {
      action="call"; thought="Near free. Worth it.";
    } else {
      action="fold"; thought="Negative EV. Waiting.";
    }
  }

  // ── Final safety net — no illegal state can escape ────────────────────────
  if (!action) { action = "fold"; thought = "Safety fold."; }

  // check vs call
  if (action==="call" && callAmount===0)      { action="check"; }
  if (action==="check" && callAmount>0)        { action="call"; }

  // can't cover call → go all-in for remaining chips (never fold a short stack)
  if (action==="call" && callAmount>=chips)    { amount=chips; thought="All-in."; }

  // raise sanity
  if (action==="raise") {
    if (!amount || amount <= callAmount) amount = Math.min(chips, callAmount + Math.floor(pot*0.4)||1);
    amount = Math.min(chips, Math.max(callAmount+1, amount));
    if (amount <= callAmount || chips <= callAmount) { action = callAmount===0?"check":"call"; amount=0; }
  }

  // one last check: all-in player shouldn't be deciding anything — guard
  if (chips <= 0) return { action:"check", amount:0, thought:"All-in." };

  return { action, amount: action==="raise" ? amount : 0, thought };
}