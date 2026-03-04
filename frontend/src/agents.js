import { handStrength } from "./engine";

export const DEFAULT_AGENTS = [
  { id:0, name:"CIPHER", role:"Aggressive Bluffer",  color:"#00f5ff", icon:"⚡", isCustom:false },
  { id:1, name:"NOVA",   role:"Calculated Analyst",  color:"#c084fc", icon:"✦", isCustom:false },
  { id:2, name:"GHOST",  role:"Chaos Agent",          color:"#fb923c", icon:"◈", isCustom:false },
  { id:3, name:"ATLAS",  role:"Silent Survivalist",   color:"#4ade80", icon:"◎", isCustom:false },
];

export const ICONS  = ["◉","⬡","⬢","◆","▲","★","✸","⊕","⊗","⊘","⊙","◐"];
export const COLORS = ["#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#ff6bff","#ff9f43","#00d2d3","#ff9ff3"];
export const STYLES = ["SHARK","MANIAC","ROCK","CALLING STATION","TRAPPER"];
export const DEFAULT_STATS = { wins:0, losses:0, folds:0, raises:0, calls:0 };

export function agentDecide(agent, hole, community, ctx) {
  const { pot, callAmount, chips, lastActions=[], recentLosses=0 } = ctx;
  const str  = handStrength(hole, community);
  const rand = Math.random();
  const tableRaises = lastActions.filter(a => a.action==="raise").length;
  const callRatio   = chips > 0 ? callAmount / chips : 1; // how expensive is the call relative to stack
  let action, amount, thought;

  if (agent.isCustom) {
    const risk=agent.params.risk/100, agg=agent.params.aggression/100;
    const bluff=agent.params.bluff/100, patience=agent.params.patience/100;
    const tilt=agent.params.tilt/100, adapt=agent.params.adaptability/100;
    const tiltFactor=tilt*recentLosses*0.1;
    if (adapt>0.6&&tableRaises>2&&str<0.5) {
      action="fold"; amount=0; thought="Table too hot. Stepping back.";
    } else if (str+tiltFactor>(1-risk+patience*0.2)) {
      if (rand<agg) { action="raise"; amount=Math.min(chips,callAmount+Math.floor(pot*(0.3+agg*0.7))); thought="Risk:"+agent.params.risk+" Agg:"+agent.params.aggression+" — Raise."; }
      else { action="call"; amount=callAmount; thought="Strength confirmed. Calling."; }
    } else if (str+bluff>0.6&&rand<bluff) {
      action="raise"; amount=Math.min(chips,callAmount+Math.floor(pot*0.4)); thought="Bluff engaged.";
    } else if (str>(0.55-risk*0.2)) {
      action="call"; amount=callAmount; thought="Acceptable odds.";
    } else { action="fold"; amount=0; thought="Not worth it."; }

  } else {
    const id = agent.id;

    if (id === 0) {
      // ── CIPHER: Aggressive Bluffer ──────────────────────────────────────────
      // Nerfed: bluff rate cut from 35% → 20%, and only when pot is small.
      // Now folds to re-raises if hand is weak (was never folding enough).
      // Bet sizing reduced so it doesn't overbull every pot.
      const facingReRaise = tableRaises >= 2;
      if (str > 0.65) {
        // Strong hand — raise but size it proportionally
        amount = Math.min(chips, callAmount + Math.floor(pot * (0.4 + rand * 0.3)));
        action = "raise"; thought = "Strong hand. Time to extract value.";
      } else if (str > 0.45 && !facingReRaise) {
        // Medium hand, no re-raise pressure — call or small raise
        if (rand < 0.4) { action="raise"; amount=Math.min(chips,callAmount+Math.floor(pot*0.35)); thought="Applying pressure."; }
        else { action="call"; amount=callAmount; thought="Keeping pressure, staying in."; }
      } else if (str < 0.35 && rand < 0.20 && pot < chips * 0.3 && !facingReRaise) {
        // Bluff only with weak hand, small pot, no re-raise, 20% chance
        action="raise"; amount=Math.min(chips,callAmount+Math.floor(pot*0.4)); thought="Smell fear. Calculated bluff.";
      } else if (str < 0.35 && (facingReRaise || callRatio > 0.2)) {
        // Weak hand facing heat — fold
        action="fold"; amount=0; thought="Too much heat. Cutting losses.";
      } else {
        action="call"; amount=callAmount; thought="Staying in, watching the table.";
      }

    } else if (id === 1) {
      // ── NOVA: Calculated Analyst ─────────────────────────────────────────────
      // Buffed: was folding too much below 0.45. Now calls wider (>0.38)
      // and re-raises bluffs when it detects over-aggression at the table.
      // Uses pot odds — won't fold if call is cheap relative to pot.
      const potOdds = pot > 0 ? callAmount / (pot + callAmount) : 1;
      const worthCalling = str > potOdds * 1.2; // call if equity exceeds pot odds

      if (str > 0.68) {
        // Strong — raise to build pot
        action="raise"; amount=Math.min(chips,callAmount+Math.floor(pot*0.5)); thought="Edge: "+(str*100).toFixed(0)+"%. Optimal raise.";
      } else if (str > 0.50) {
        // Medium strong — re-raise if table is over-aggressive (likely bluffing)
        if (tableRaises >= 2 && rand < 0.45) { action="raise"; amount=Math.min(chips,callAmount+Math.floor(pot*0.35)); thought="Table bluffing. Counter-raise."; }
        else { action="call"; amount=callAmount; thought="Solid hand. Pot odds favor staying."; }
      } else if (worthCalling && callRatio < 0.15) {
        // Pot odds justify a cheap call
        action="call"; amount=callAmount; thought="Pot odds: "+(potOdds*100).toFixed(0)+"%. Worth it.";
      } else if (str > 0.38 && callRatio < 0.1) {
        // Decent hand, very cheap call
        action="call"; amount=callAmount; thought="Marginal but cheap. Staying in.";
      } else {
        action="fold"; amount=0; thought="Insufficient edge. Fold.";
      }

    } else if (id === 2) {
      // ── GHOST: Chaos Agent ───────────────────────────────────────────────────
      // Rebalanced: was too random and fed chips to CIPHER.
      // Now has a slight hand-awareness layer — won't raise with truly terrible
      // hands, and won't fold strong hands. Still mostly unpredictable.
      const r2 = Math.random();
      if (str > 0.70) {
        // Good hand — Ghost still plays it weird but doesn't throw it away
        if (r2 < 0.5) { action="raise"; amount=Math.min(chips,callAmount+Math.floor(rand*pot*0.8)); thought="Ooh, shiny cards. RAISE."; }
        else { action="call"; amount=callAmount; thought="Maybe I'll slowplay. Chaos."; }
      } else if (str < 0.25 && callRatio > 0.15) {
        // Genuinely bad hand and expensive — even Ghost notices
        if (r2 < 0.6) { action="fold"; amount=0; thought="Even I know when to quit. Maybe."; }
        else { action="call"; amount=callAmount; thought="Nah let's gamble."; }
      } else {
        // Full chaos zone
        if (r2 < 0.25)      { action="fold";  amount=0;                thought="Chaos fold. Vibes only."; }
        else if (r2 < 0.55) { action="call";  amount=callAmount;       thought="Sure, whatever."; }
        else                 { action="raise"; amount=Math.min(chips,callAmount+Math.floor(r2*pot)); thought="MAXIMUM CHAOS."; }
      }

    } else {
      // ── ATLAS: Silent Survivalist ────────────────────────────────────────────
      // Buffed: was too passive (0.78 raise threshold). Now raises at 0.65,
      // calls wider (down to 0.42), and actively defends against bluffs
      // by calling more when pot odds are good and table is over-aggressive.
      const potOdds = pot > 0 ? callAmount / (pot + callAmount) : 1;
      const likelyBluff = tableRaises >= 2 && str > 0.45;

      if (str > 0.72) {
        // Strong — raise, but Atlas keeps sizing controlled
        action="raise"; amount=Math.min(chips,callAmount+Math.floor(pot*0.45)); thought="Premium hand. Controlled raise.";
      } else if (str > 0.55 && likelyBluff) {
        // Medium hand, table is over-raising — Atlas calls the bluff
        action="call"; amount=callAmount; thought="Smells like a bluff. I'll call.";
      } else if (str > 0.55) {
        if (rand < 0.35) { action="raise"; amount=Math.min(chips,callAmount+Math.floor(pot*0.3)); thought="Good hand. Small raise."; }
        else { action="call"; amount=callAmount; thought="Solid. Calling."; }
      } else if (str > 0.42 && potOdds < 0.25) {
        // Decent hand, pot odds reasonable
        action="call"; amount=callAmount; thought="Pot odds acceptable. Staying in.";
      } else if (callRatio > 0.18) {
        // Call too expensive for weak hand
        action="fold"; amount=0; thought="Too expensive. Preserve chips.";
      } else if (str > 0.35 && callRatio < 0.08) {
        // Weak but almost free to call
        action="call"; amount=callAmount; thought="Cheap enough to see the next card.";
      } else {
        action="fold"; amount=0; thought="Not worth the risk. Waiting.";
      }
    }
  }

  if (action==="call"&&callAmount===0)    { action="check"; thought+=" Check."; }
  if (action==="call"&&callAmount>=chips) { action="fold";  thought="Cannot afford it."; }
  if (action==="raise"&&amount>chips)     { amount=chips; }
  return { action, amount:amount||0, thought };
}