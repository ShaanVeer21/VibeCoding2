import { handStrength } from "./engine";

export const DEFAULT_AGENTS = [
  { id:0, name:"CIPHER", role:"Aggressive Bluffer", color:"#00f5ff", icon:"⚡", isCustom:false },
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
  let action, amount, thought;

  if (agent.isCustom) {
    const risk=agent.params.risk/100, agg=agent.params.aggression/100;
    const bluff=agent.params.bluff/100, patience=agent.params.patience/100;
    const tilt=agent.params.tilt/100, adapt=agent.params.adaptability/100;
    const tiltFactor=tilt*recentLosses*0.1;
    const tableRaises=lastActions.filter(a=>a.action==="raise").length;
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
    const id=agent.id;
    if (id===0) {
      if (str>0.55||rand<0.35) { action="raise"; amount=Math.min(chips,Math.floor(callAmount+pot*(0.5+rand*0.5))); thought=str>0.7?"Strong hand. Dominate.":"Smell fear. Bluff."; }
      else if (rand<0.3) { action="fold"; amount=0; thought="Cut losses."; }
      else { action="call"; amount=callAmount; thought="Keeping pressure."; }
    } else if (id===1) {
      if (str>0.72) { action="raise"; amount=Math.min(chips,callAmount+Math.floor(pot*0.4)); thought="Edge: "+(str*100).toFixed(0)+"%. Optimal raise."; }
      else if (str>0.45) { action="call"; amount=callAmount; thought="Probability favors staying."; }
      else { action="fold"; amount=0; thought="Insufficient edge. Fold."; }
    } else if (id===2) {
      const r2=Math.random();
      if (r2<0.3) { action="fold"; amount=0; thought="Chaos fold. Why not."; }
      else if (r2<0.6) { action="call"; amount=callAmount; thought="Sure, whatever."; }
      else { action="raise"; amount=Math.min(chips,callAmount+Math.floor(Math.random()*pot)); thought="MAXIMUM CHAOS."; }
    } else {
      if (str>0.78) { action="raise"; amount=Math.min(chips,callAmount+Math.floor(pot*0.3)); thought="Premium hand. Minimal risk raise."; }
      else if (str>0.52&&callAmount<chips*0.15) { action="call"; amount=callAmount; thought="Acceptable risk."; }
      else { action="fold"; amount=0; thought="Preserve chips."; }
    }
  }
  if (action==="call"&&callAmount===0)    { action="check"; thought+=" Check."; }
  if (action==="call"&&callAmount>=chips) { action="fold";  thought="Cannot afford it."; }
  if (action==="raise"&&amount>chips)     { amount=chips; }
  return { action, amount:amount||0, thought };
}