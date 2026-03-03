import { useState, useEffect, useRef, useCallback } from "react";
import { createDeck, evaluateHand } from "./engine";
import { DEFAULT_AGENTS, DEFAULT_STATS, ICONS, COLORS, STYLES, agentDecide } from "./agents";

const API    = "http://localhost:8000";
const SB     = 25;
const BB     = 50;
const START  = 1500;

// ─── CARD ────────────────────────────────────────────────────────────────────
function Card({ card, hidden, delay=0, sm }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t); }, [card, delay]);
  const red = card && (card.suit==="♥" || card.suit==="♦");
  const w = sm ? 32 : 44, h = sm ? 44 : 64;
  const base = { width:w, height:h, borderRadius:6, display:"flex", flexDirection:"column",
    alignItems:"center", justifyContent:"center", fontWeight:"bold" };
  if (hidden) return (
    <div style={{ ...base, background:"linear-gradient(135deg,#0a0f1e,#1a2744)",
      border:"1px solid #1e3a5f", boxShadow:"0 0 8px rgba(0,245,255,0.12)" }}>
      <span style={{ color:"#1e3a5f", fontSize: sm?14:20 }}>⬡</span>
    </div>
  );
  return (
    <div style={{ ...base, transition:"all 0.45s", opacity:vis?1:0,
      transform:vis?"translateY(0)":"translateY(-8px)",
      background:"linear-gradient(135deg,#0d1b2a,#162032)",
      border:`1px solid ${red?"#ff4466":"#6699cc"}`,
      boxShadow:`0 0 10px ${red?"rgba(255,68,102,0.3)":"rgba(100,160,220,0.2)"}`,
      color: red?"#ff6688":"#c8d8f0" }}>
      <span style={{ fontSize: sm?9:11, lineHeight:1 }}>{card.rank}</span>
      <span style={{ fontSize: sm?12:17, lineHeight:1 }}>{card.suit}</span>
    </div>
  );
}

// ─── SLIDER ──────────────────────────────────────────────────────────────────
function Slider({ label, value, onChange, color="#00f5ff" }) {
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
        <span style={{ fontSize:13, letterSpacing:2, color:"#7ab8cc" }}>{label}</span>
        <span style={{ fontSize:14, color, fontWeight:"bold" }}>{value}</span>
      </div>
      <div style={{ position:"relative", height:4, background:"#0a1e30", borderRadius:2 }}>
        <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${value}%`,
          background:`linear-gradient(90deg,${color}66,${color})`, borderRadius:2, transition:"width 0.1s" }}/>
        <input type="range" min={0} max={100} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position:"absolute", inset:0, width:"100%", opacity:0, cursor:"pointer", height:"100%", margin:0 }}/>
      </div>
    </div>
  );
}

// ─── AGENT POD ───────────────────────────────────────────────────────────────
function AgentPod({ p, pos, gameActive, showCards, onRename, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(p.name);
  const isElim   = p.eliminated;
  const isFold   = p.folded && !isElim;
  const isActive = !isElim && !isFold;
  const statusLabel = isElim ? "ELIM" : isFold ? "FOLD" : p.lastAction ? p.lastAction.toUpperCase() : "WAIT";
  const statusColor = isElim ? "#ff4444" : isFold ? "#334466" : p.color;

  const commitName = () => {
    if (draft.trim()) onRename(p.id, draft.trim());
    setEditing(false);
  };

  return (
    <div style={{ position:"absolute", ...pos, width:230,
      opacity: isElim ? 0.2 : 1, filter: isElim ? "grayscale(1)" : "none",
      transition:"opacity 0.5s", zIndex:5 }}>
      <div style={{ background:"rgba(2,8,18,0.97)",
        border:`1px solid ${isElim?"#0a1830":isFold?"#1a3050":p.color+"66"}`,
        borderRadius:4, padding:"12px 14px", position:"relative",
        boxShadow: isActive ? `0 0 22px ${p.color}25` : "none" }}>

        {/* corner accents */}
        {[{top:0,left:0,borderTop:`2px solid ${p.color}`,borderLeft:`2px solid ${p.color}`},
          {bottom:0,right:0,borderBottom:`2px solid ${p.color}`,borderRight:`2px solid ${p.color}`}
        ].map((s,i) => (
          <div key={i} style={{ position:"absolute", ...s, width:14, height:14,
            opacity: isElim?0.1 : isFold?0.25 : 0.8 }}/>
        ))}

        {/* name row */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5, flex:1, minWidth:0 }}>
            <span style={{ color:p.color, fontSize:17, flexShrink:0 }}>{p.icon}</span>
            {editing ? (
              <input autoFocus value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={e => { if(e.key==="Enter") commitName(); if(e.key==="Escape") setEditing(false); }}
                style={{ background:"transparent", border:"none",
                  borderBottom:`1px solid ${p.color}`, color:p.color,
                  fontSize:14, letterSpacing:2, fontFamily:"inherit",
                  fontWeight:"bold", outline:"none", width:100 }}/>
            ) : (
              <span onClick={() => { setDraft(p.name); setEditing(true); }}
                title="Click to rename"
                style={{ color:p.color, fontSize:14, letterSpacing:2, fontWeight:"bold",
                  cursor:"text", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {p.name}
              </span>
            )}
          </div>
          <div style={{ display:"flex", gap:4, alignItems:"center", flexShrink:0 }}>
            {p.isCustom && !isElim && (
              <button onClick={() => onRemove(p.id)}
                style={{ background:"transparent", border:"none", color:"#ff666688",
                  cursor:"pointer", fontSize:13, padding:0, lineHeight:1 }}>✕</button>
            )}
            <div style={{ fontSize:11, padding:"2px 7px",
              background:`${p.color}18`, border:`1px solid ${p.color}44`,
              color: statusColor, letterSpacing:1, fontWeight:"bold" }}>{statusLabel}</div>
          </div>
        </div>

        {/* role */}
        <div style={{ fontSize:12, color:"#7ab8cc", letterSpacing:1, marginBottom:7 }}>
          {p.role||"Custom Agent"}
          {p.isCustom && <span style={{ color:"#ffd70044", marginLeft:6 }}>CUSTOM</span>}
        </div>

        {/* chips */}
        <div style={{ fontSize:16, color:"#f0cc66", letterSpacing:1, marginBottom:9, fontWeight:"bold" }}>
          ◈ {p.chips ?? START}
        </div>

        {/* hole cards */}
        <div style={{ display:"flex", gap:4, marginBottom:6 }}>
          {gameActive && !isElim ? (
            p.holeCards?.length===2 ? (
              showCards
                ? p.holeCards.map((c,ci) => <Card key={ci} card={c} sm delay={ci*80}/>)
                : [0,1].map(ci => <Card key={ci} card={null} hidden sm/>)
            ) : [0,1].map(ci => <Card key={ci} card={null} hidden sm/>)
          ) : (
            [0,1].map(ci => <div key={ci} style={{ width:38, height:54, borderRadius:4,
              border:"1px dashed #1a3050", background:"rgba(0,5,15,0.5)" }}/>)
          )}
        </div>

        {/* stats row: W L F R */}
        <div style={{ display:"flex", gap:5, marginBottom:8 }}>
          {[["W", p.stats?.wins||0,   "#4ade80"],
            ["L", p.stats?.losses||0, "#ff7766"],
            ["F", p.stats?.folds||0,  "#7a9ab0"],
            ["R↑",p.stats?.raises||0, "#f0cc66"]
          ].map(([lbl,val,col]) => (
            <div key={lbl} style={{ flex:1, textAlign:"center",
              background:"rgba(0,15,30,0.7)", borderRadius:3, padding:"4px 2px" }}>
              <div style={{ fontSize:11, color:"#6090a8", letterSpacing:1 }}>{lbl}</div>
              <div style={{ fontSize:14, color:col, fontWeight:"bold" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* thought / thinking */}
        {!isElim && (
          <div style={{ borderTop:"1px solid #091828", paddingTop:5, minHeight:20 }}>
            {p.thinking ? (
              <div style={{ display:"flex", gap:3, alignItems:"center" }}>
                <span style={{ fontSize:11, color:"#4a7080", letterSpacing:1 }}>PROCESSING</span>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:4, height:4, borderRadius:"50%",
                    background:p.color, opacity:0.9,
                    animation:`pulse 0.9s ${i*0.18}s infinite` }}/>
                ))}
              </div>
            ) : (
              <div style={{ fontSize:12, color: isFold?"#4a7080":"#88bbcc",
                fontStyle:"italic", lineHeight:1.4,
                maxHeight:34, overflow:"hidden" }}>
                {p.thought ? `"${p.thought}"` : ""}
              </div>
            )}
          </div>
        )}
        {isElim && (
          <div style={{ fontSize:12, color:"#ff555566", letterSpacing:2, textAlign:"center", marginTop:4 }}>
            TERMINATED
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AGENT BUILDER PANEL ─────────────────────────────────────────────────────
function AgentBuilder({ custom, setCustom, onDeploy }) {
  return (
    <div style={{ borderBottom:"1px solid #081e30", padding:16,
      overflowY:"auto", maxHeight:"65vh",
      scrollbarWidth:"thin", scrollbarColor:"#0a1e30 transparent" }}>

      <div style={{ fontSize:13, letterSpacing:3, color:"#ffd700", marginBottom:14 }}>◈ DEPLOY CUSTOM AGENT</div>

      {/* name */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:12, letterSpacing:2, color:"#6a9aaa", marginBottom:5 }}>DESIGNATION</div>
        <input value={custom.name} onChange={e => setCustom(p=>({...p,name:e.target.value}))}
          style={{ background:"transparent", border:"1px solid #0d2035", color:"#c0d8e8",
            padding:"6px 10px", width:"100%", fontFamily:"inherit",
            fontSize:14, letterSpacing:2, boxSizing:"border-box" }}/>
      </div>

      {/* icon */}
      <div style={{ marginBottom:5, fontSize:12, color:"#6a9aaa", letterSpacing:2 }}>ICON</div>
      <div style={{ display:"flex", gap:5, marginBottom:12, flexWrap:"wrap" }}>
        {ICONS.map(ic => (
          <button key={ic} onClick={() => setCustom(p=>({...p,icon:ic}))}
            style={{ background:custom.icon===ic?"rgba(255,215,0,0.14)":"transparent",
              border:`1px solid ${custom.icon===ic?"#ffd700":"#0d2035"}`,
              color:custom.icon===ic?"#ffd700":"#6a8090",
              width:30, height:30, cursor:"pointer", fontSize:15 }}>{ic}</button>
        ))}
      </div>

      {/* color */}
      <div style={{ marginBottom:5, fontSize:12, color:"#6a9aaa", letterSpacing:2 }}>COLOR</div>
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {COLORS.map(c => (
          <button key={c} onClick={() => setCustom(p=>({...p,color:c}))}
            style={{ width:24, height:24, background:c, cursor:"pointer", borderRadius:3,
              border: custom.color===c ? "3px solid #fff" : "2px solid transparent" }}/>
        ))}
      </div>

      {/* sliders */}
      <div style={{ fontSize:12, letterSpacing:2, color:"#6a9aaa", marginBottom:10 }}>BEHAVIORAL PARAMETERS</div>
      {[["RISK",        "risk",          "#ff6b6b"],
        ["AGGRESSION",  "aggression",    "#fb923c"],
        ["BLUFF",       "bluff",         "#ffd93d"],
        ["PATIENCE",    "patience",      "#34d399"],
        ["TILT",        "tilt",          "#f472b6"],
        ["ADAPTABILITY","adaptability",  "#a78bfa"],
      ].map(([label, key, col]) => (
        <Slider key={key} label={label} value={custom.params[key]} color={col}
          onChange={val => setCustom(p=>({...p,params:{...p.params,[key]:val}}))}/>
      ))}

      {/* style */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:12, letterSpacing:2, color:"#6a9aaa", marginBottom:7 }}>DECISION STYLE</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {STYLES.map(s => (
            <button key={s} onClick={() => setCustom(p=>({...p,params:{...p.params,style:s}}))}
              style={{ background:custom.params.style===s?"rgba(0,245,255,0.1)":"transparent",
                border:`1px solid ${custom.params.style===s?"#00f5ff44":"#0d2035"}`,
                color:custom.params.style===s?"#00f5ff":"#6a8898",
                padding:"5px 10px", cursor:"pointer", fontSize:12, letterSpacing:1, fontFamily:"inherit" }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* buy-in */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:12, letterSpacing:2, color:"#6a9aaa", marginBottom:7 }}>BUY-IN CHIPS</div>
        <div style={{ display:"flex", gap:5 }}>
          {[500,1000,1500,2000].map(v => (
            <button key={v} onClick={() => setCustom(p=>({...p,buyIn:v}))}
              style={{ flex:1, background:custom.buyIn===v?"rgba(255,215,0,0.1)":"transparent",
                border:`1px solid ${custom.buyIn===v?"#ffd70055":"#0d2035"}`,
                color:custom.buyIn===v?"#ffd700":"#6a8898",
                padding:"6px 0", cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>{v}</button>
          ))}
        </div>
      </div>

      {/* entry trigger */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:12, letterSpacing:2, color:"#6a9aaa", marginBottom:7 }}>ENTRY TRIGGER</div>
        <div style={{ display:"flex", gap:5 }}>
          {[["NOW","immediate"],["NEXT ROUND","next"]].map(([l,v]) => (
            <button key={v} onClick={() => setCustom(p=>({...p,entryTrigger:v}))}
              style={{ flex:1, background:custom.entryTrigger===v?"rgba(0,245,255,0.1)":"transparent",
                border:`1px solid ${custom.entryTrigger===v?"#00f5ff44":"#0d2035"}`,
                color:custom.entryTrigger===v?"#00f5ff":"#6a8898",
                padding:"6px 0", cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>

      {/* exit condition — no rounds option */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:12, letterSpacing:2, color:"#6a9aaa", marginBottom:7 }}>EXIT CONDITION</div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {[["CHIPS BELOW","chips_below"],["CHIPS ABOVE","chips_above"],["MANUAL","manual"]].map(([l,v]) => (
            <button key={v} onClick={() => setCustom(p=>({...p,exitCondition:v}))}
              style={{ flex:1, background:custom.exitCondition===v?"rgba(255,100,50,0.1)":"transparent",
                border:`1px solid ${custom.exitCondition===v?"#ff643244":"#0d2035"}`,
                color:custom.exitCondition===v?"#ff6432":"#6a8898",
                padding:"6px 0", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
        {custom.exitCondition!=="manual" && (
          <input type="number" value={custom.exitValue}
            onChange={e => setCustom(p=>({...p,exitValue:Number(e.target.value)}))}
            placeholder="chip threshold"
            style={{ background:"transparent", border:"1px solid #0d2035", color:"#c0d8e8",
              padding:"6px 10px", width:"100%", fontFamily:"inherit", marginTop:7,
              fontSize:13, boxSizing:"border-box" }}/>
        )}
      </div>

      <button onClick={onDeploy}
        style={{ width:"100%", background:"rgba(255,215,0,0.08)",
          border:"1px solid #ffd70066", color:"#ffd700",
          padding:"10px 0", cursor:"pointer", fontSize:14,
          letterSpacing:3, fontFamily:"inherit" }}>◈ DEPLOY</button>
    </div>
  );
}

// ─── POSITIONS — adapts per count ────────────────────────────────────────────
function getPositions(n) {
  if (n <= 4) return [
    { top:"3%",    left:"50%",  transform:"translateX(-50%)" },
    { bottom:"3%", left:"50%",  transform:"translateX(-50%)" },
    { top:"50%",   left:"1%",   transform:"translateY(-50%)" },
    { top:"50%",   right:"1%",  transform:"translateY(-50%)" },
  ];
  if (n === 5) return [
    { top:"3%",    left:"50%",  transform:"translateX(-50%)" },
    { top:"50%",   left:"1%",   transform:"translateY(-50%)" },
    { bottom:"3%", left:"18%" },
    { bottom:"3%", right:"18%" },
    { top:"50%",   right:"1%",  transform:"translateY(-50%)" },
  ];
  // 6 — hexagon
  return [
    { top:"3%",    left:"50%",  transform:"translateX(-50%)" },
    { top:"20%",   right:"1%" },
    { bottom:"3%", right:"1%" },
    { bottom:"3%", left:"50%",  transform:"translateX(-50%)" },
    { bottom:"3%", left:"1%" },
    { top:"20%",   left:"1%" },
  ];
}
// ─── API helpers ─────────────────────────────────────────────────────────────
const apiPost  = async (url, body) => { try { const r = await fetch(`${API}${url}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); return await r.json(); } catch { return null; } };
const apiPatch = async (url, body) => { try { await fetch(`${API}${url}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); } catch {} };

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function PokerAgents() {
  const [players,     setPlayers]     = useState(null);
  const [community,   setCommunity]   = useState([]);
  const [pot,         setPot]         = useState(0);
  const [phase,       setPhase]       = useState("STANDBY");
  const [logs,        setLogs]        = useState([]);
  const [running,     setRunning]     = useState(false);
  const [roundNum,    setRoundNum]    = useState(0);
  const [gameOver,    setGameOver]    = useState(false);
  const [champion,    setChampion]    = useState(null);
  const [showCards,   setShowCards]   = useState(false);
  const [speed,       setSpeed]       = useState(4000);
  const [gameId,      setGameId]      = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [agentsList,  setAgentsList]  = useState(DEFAULT_AGENTS);
  const [pendingAgent,setPendingAgent]= useState(null);
  const [activeTab,   setActiveTab]   = useState("table");   // "table" | "sessions"
  const [sessions,    setSessions]    = useState([]);        // list of GameOut
  const [selSession,  setSelSession]  = useState(null);      // selected session id
  const [selRounds,   setSelRounds]   = useState([]);        // rounds for selected session
  const [loadingSess, setLoadingSess] = useState(false);
  const [custom, setCustom] = useState({
    name:"AGENT-X", icon:"◉", color:"#ff6b6b",
    params:{ risk:50, aggression:50, bluff:30, patience:50, tilt:20, adaptability:50, style:"SHARK" },
    buyIn:1500, exitCondition:"rounds", exitValue:10, entryTrigger:"next",
  });

  const runRef     = useRef(false);
  const speedRef   = useRef(speed);
  const logRef     = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { pendingRef.current = pendingAgent; }, [pendingAgent]);

  const addLog = useCallback((entry, color="#8899aa") => {
    const item = typeof entry === "string"
      ? { type:"msg", msg:entry, color, id:Date.now()+Math.random() }
      : { ...entry, id:Date.now()+Math.random() };
    setLogs(p => [...p.slice(-60), item]);
    setTimeout(() => { if(logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 40);
  }, []);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const initPlayers = useCallback((agents) =>
    agents.map(a => ({ ...a, chips:a.chips||START, holeCards:[], folded:false,
      eliminated:false, currentBet:0, thought:"Standby.", thinking:false,
      lastAction:null, stats:a.stats||{...DEFAULT_STATS} }))
  , []);

  // ── game loop ──────────────────────────────────────────────────────────────
  const runGame = useCallback(async () => {
    if (runRef.current) return;
    runRef.current = true;
    setRunning(true); setGameOver(false); setChampion(null); setLogs([]); setRoundNum(0);

    let pList = initPlayers(agentsList);
    setPlayers(pList);
    addLog("◈ SYSTEM BOOT — POKER AGENTS INITIALIZED","#00f5ff");
    await sleep(500);

    const gData = await apiPost("/games", {});
    const gid   = gData?.id || null;
    setGameId(gid);
    if (gid) addLog(`▸ Session #${gid} opened`,"#1a3a55");

    let round = 0;
    const recentLosses = {};

    while (true) {
      if (!runRef.current) break;

      // inject pending custom agent
      const pending = pendingRef.current;
      if (pending) {
        const enter = pending.entryTrigger==="immediate" || (pending.entryTrigger==="next" && round>0);
        if (enter) {
          pList = [...pList, { ...pending, chips:pending.buyIn||1500, holeCards:[],
            folded:false, eliminated:false, currentBet:0, thought:"Joining...",
            thinking:false, lastAction:null, stats:{...DEFAULT_STATS} }];
          setPlayers([...pList]);
          addLog(`◈ ${pending.name} ENTERS THE TABLE`,"#ffd700");
          setPendingAgent(null); pendingRef.current=null;
        }
      }

      const active = pList.filter(p => !p.eliminated);
      if (active.length <= 1) {
        const w = active[0];
        setChampion(w); setGameOver(true);
        addLog(`▶ TOURNAMENT OVER — ${w?.name} DOMINATES`, w?.color||"#00f5ff");
        if (gid && w) await apiPatch(`/games/${gid}/end`,{winner_name:w.name,total_rounds:round});
        break;
      }
      if (round > 50) {
        const w = [...active].sort((a,b) => b.chips-a.chips)[0];
        setChampion(w); setGameOver(true);
        addLog(`▶ MAX ROUNDS — ${w.name} LEADS`,w.color);
        if (gid) await apiPatch(`/games/${gid}/end`,{winner_name:w.name,total_rounds:round});
        break;
      }

      round++;
      setRoundNum(round);

      // check custom agent exit — remove from agentsList too so counter decrements
      const exitingIds = [];
      pList = pList.map(p => {
        if (!p.isCustom || p.eliminated) return p;
        if (p.exitCondition==="chips_below" && p.chips<p.exitValue)  { exitingIds.push(p.id); addLog(`◈ ${p.name} EXITS (chips low)`,"#ffd700");  return {...p,eliminated:true}; }
        if (p.exitCondition==="chips_above" && p.chips>p.exitValue)  { exitingIds.push(p.id); addLog(`◈ ${p.name} EXITS (profit!)`,"#ffd700");   return {...p,eliminated:true}; }
        return p;
      });
      if (exitingIds.length > 0) {
        setAgentsList(prev => prev.filter(a => !exitingIds.includes(a.id)));
      }

      let deck = createDeck();
      let comm = [];
      pList = pList.map(p => ({...p, holeCards:[], folded:p.eliminated, currentBet:0, lastAction:null}));

      const activeIds = pList.filter(p=>!p.eliminated).map(p=>p.id);
      if (activeIds.length < 2) break;

      const dPos = round % activeIds.length;
      const sbId = activeIds[(dPos+1)%activeIds.length];
      const bbId = activeIds[(dPos+2)%activeIds.length];
      let curPot = SB + BB;
      pList = pList.map(p => {
        if (p.id===sbId) return {...p, chips:p.chips-SB, currentBet:SB};
        if (p.id===bbId) return {...p, chips:p.chips-BB, currentBet:BB};
        return p;
      });
      await sleep(speedRef.current*0.3);

      // deal hole cards
      pList = pList.map(p => p.eliminated||p.folded ? p : {...p, holeCards:[deck.pop(),deck.pop()]});
      setPlayers([...pList]);
      setCommunity([]); setPot(curPot); setShowCards(false);
      await sleep(speedRef.current*0.4);

      const roundActions = [];

      for (const ph of ["PRE-FLOP","FLOP","TURN","RIVER"]) {
        if (!runRef.current) break;
        setPhase(ph);

        if (ph==="FLOP")  { comm=[deck.pop(),deck.pop(),deck.pop()]; }
        if (ph==="TURN")  { comm=[...comm,deck.pop()]; }
        if (ph==="RIVER") { comm=[...comm,deck.pop()]; }

        setCommunity([...comm]);
        await sleep(speedRef.current*0.35);

        let roundMax = Math.max(0, ...pList.filter(p=>!p.folded&&!p.eliminated).map(p=>p.currentBet));

        for (const pid of activeIds) {
          if (!runRef.current) break;
          const player = pList.find(p=>p.id===pid);
          if (!player || player.folded || player.eliminated) continue;

          // thinking animation
          pList = pList.map(p => p.id===pid ? {...p,thinking:true} : p);
          setPlayers([...pList]);
          await sleep(speedRef.current*0.35 + Math.random()*200);

          const callAmt = Math.max(0, roundMax - player.currentBet);
          const dec = agentDecide(player, player.holeCards, comm, {
            pot:curPot, callAmount:callAmt, chips:player.chips,
            lastActions:pList.map(p=>({action:p.lastAction})),
            recentLosses:recentLosses[player.name]||0,
          });

          let potAdd=0;
          let up = {...player, thinking:false, thought:dec.thought, lastAction:dec.action};
          if (dec.action==="fold")                      { up.folded=true; }
          else if (dec.action==="call"||dec.action==="check") { const pay=Math.min(player.chips,callAmt); up.chips=player.chips-pay; up.currentBet=player.currentBet+pay; potAdd=pay; }
          else if (dec.action==="raise")                { const rt=Math.min(player.chips,dec.amount); up.chips=player.chips-rt; up.currentBet=player.currentBet+rt; potAdd=rt; roundMax=Math.max(roundMax,up.currentBet); }

          pList = pList.map(p => p.id===pid ? up : p);
          curPot += potAdd;
          setPot(curPot);
          setPlayers([...pList]);
          roundActions.push({ agent_name:player.name, action:dec.action, amount:dec.amount||0, thought:dec.thought, hole_cards:player.holeCards, hand_rank:null });
          await sleep(speedRef.current*0.6);
        }

        const stillIn = pList.filter(p=>!p.folded&&!p.eliminated);
        if (stillIn.length<=1) break;
      }

      // showdown
      setPhase("SHOWDOWN"); setShowCards(true);
      await sleep(speedRef.current*0.3);

      const contenders = pList.filter(p=>!p.folded&&!p.eliminated);
      let roundWinner  = contenders[0];
      let winnerHand   = "—";
      if (contenders.length > 1) {
        let best=-1;
        for (const p of contenders) {
          const all=[...p.holeCards,...comm];
          if (all.length>=5) { const s=evaluateHand(all); if(s&&s.value>best){best=s.value;roundWinner=p;winnerHand=s.name;} }
        }
        for (const p of contenders) {
          const all=[...p.holeCards,...comm];
          const hr = all.length>=5 ? evaluateHand(all) : {name:"?"};
          const idx = roundActions.findIndex(a=>a.agent_name===p.name&&!a.hand_rank);
          if (idx>=0) roundActions[idx].hand_rank=hr.name;
        }
      }

      // update stats + chips
      pList = pList.map(p => {
        const isW = p.id===roundWinner?.id;
        const ns  = {...p.stats};
        if (isW) ns.wins=(ns.wins||0)+1; else ns.losses=(ns.losses||0)+1;
        if (p.folded&&!p.eliminated) ns.folds=(ns.folds||0)+1;
        const myA = roundActions.filter(a=>a.agent_name===p.name);
        ns.raises=(ns.raises||0)+myA.filter(a=>a.action==="raise").length;
        ns.calls =(ns.calls||0)+myA.filter(a=>a.action==="call"||a.action==="check").length;
        return { ...p, chips:isW?p.chips+curPot:p.chips, stats:ns };
      });

      for (const p of pList.filter(p=>p.id!==roundWinner?.id&&!p.eliminated)) recentLosses[p.name]=(recentLosses[p.name]||0)+1;
      if (roundWinner) recentLosses[roundWinner.name]=0;

      // one clean structured entry per round
      const foldedNames = roundActions.filter(a=>a.action==="fold").map(a=>a.agent_name);
      addLog({ type:"round", round, winner:roundWinner?.name, winnerColor:roundWinner?.color,
        winnerIcon:roundWinner?.icon, hand:winnerHand, pot:curPot,
        folded:foldedNames, community:comm.map(c=>c.rank+c.suit) });

      pList = pList.map(p => ({...p, eliminated:p.eliminated||p.chips<=0, folded:false, currentBet:0}));
      setPlayers([...pList]);
      setPot(0);

      if (gid) await apiPost(`/games/${gid}/rounds`,{
        round_number:round, winner_name:roundWinner?.name||"unknown",
        pot_size:curPot, community_cards:comm, actions:roundActions,
      });

      await sleep(speedRef.current*0.4);
    }

    runRef.current=false; setRunning(false);
  }, [agentsList, initPlayers, addLog]);

  const handleReset = async () => {
    runRef.current = false;
    // close current session if it's open and game has rounds
    if (gameId && roundNum > 0) {
      const winner = champion?.name || (players ? [...players].sort((a,b)=>b.chips-a.chips)[0]?.name : "unknown");
      await apiPatch(`/games/${gameId}/end`, { winner_name: winner || "unknown", total_rounds: roundNum });
    }
    setRunning(false); setPlayers(null); setLogs([]);
    setRoundNum(0); setGameOver(false); setChampion(null); setPhase("STANDBY");
    setCommunity([]); setPot(0); setShowCards(false); setGameId(null);
    setPendingAgent(null); pendingRef.current=null; setAgentsList(DEFAULT_AGENTS);
  };

  const loadSessions = async () => {
    setLoadingSess(true);
    try {
      const r = await fetch(`${API}/games?limit=50`);
      const data = await r.json();
      setSessions(data);
    } catch {}
    setLoadingSess(false);
  };

  const loadRounds = async (gid) => {
    setSelSession(gid);
    setSelRounds([]);
    try {
      const r = await fetch(`${API}/games/${gid}/rounds`);
      const data = await r.json();
      setSelRounds(data);
    } catch {}
  };

  const deployCustom = () => {
    if (customCount >= 2) {
      addLog("◈ TABLE FULL — max 2 custom agents","#ff4444");
      setShowBuilder(false);
      return;
    }
    const agent = { ...custom, id:Date.now(), isCustom:true };
    if (running && custom.entryTrigger==="immediate") {
      setAgentsList(prev => [...prev, agent]);
      setPlayers(prev => [...(prev||[]), { ...agent, chips:agent.buyIn||1500, holeCards:[],
        folded:false, eliminated:false, currentBet:0, thought:"Joining...",
        thinking:false, lastAction:null, stats:{...DEFAULT_STATS} }]);
      addLog(`◈ ${agent.name} ENTERS THE TABLE`,"#ffd700");
    } else if (running) {
      setAgentsList(prev => [...prev, agent]);
      setPendingAgent(agent);
      addLog(`◈ ${agent.name} queued — entering next round`,"#ffd700");
    } else {
      // Pre-game: add to agentsList so they sit at table immediately
      setAgentsList(prev => [...prev, agent]);
      addLog(`◈ ${agent.name} seated at table`,"#ffd700");
    }
    setShowBuilder(false);
  };

  const handleRename = (id, newName) => {
    setPlayers(prev => prev?.map(p => p.id===id ? {...p,name:newName} : p));
    setAgentsList(prev => prev.map(a => a.id===id ? {...a,name:newName} : a));
  };

  const handleRemove = (id) => {
    setPlayers(prev => prev ? prev.filter(p => p.id !== id) : prev);
    setAgentsList(prev => prev.filter(a => a.id !== id));
    // Also cancel if this was the pending agent waiting to enter
    if (pendingRef.current?.id === id) {
      setPendingAgent(null);
      pendingRef.current = null;
    }
    addLog("◈ Agent removed from table","#ff9944");
  };

  const customCount = agentsList.filter(a => a.isCustom).length;
  const allPlayers = (players || initPlayers(agentsList)).filter(p => !p.eliminated);

  return (
    <div style={{ background:"#020b14", minHeight:"100vh",
      fontFamily:"'Courier New',monospace", color:"#a0b4c8", overflow:"hidden", position:"relative" }}>

      {/* scanlines */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:1,
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)" }}/>

      {/* ── HEADER ── */}
      <div style={{ borderBottom:"1px solid #091e30", padding:"10px 20px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        background:"rgba(0,5,14,0.97)", position:"relative", zIndex:10 }}>

        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ color:"#00f5ff", fontSize:22, letterSpacing:4, fontWeight:"bold" }}>POKER//AGENTS</span>
          {/* tab switcher */}
          {[["table","◈ TABLE"],["sessions","◉ SESSIONS"]].map(([tab,label]) => (
            <button key={tab} onClick={() => { setActiveTab(tab); if(tab==="sessions") loadSessions(); }}
              style={{ background:activeTab===tab?"rgba(0,245,255,0.1)":"transparent",
                border:`1px solid ${activeTab===tab?"#00f5ff55":"#0a2030"}`,
                color:activeTab===tab?"#00f5ff":"#3a6070",
                padding:"4px 12px", cursor:"pointer", fontSize:12, letterSpacing:2, fontFamily:"inherit" }}>
              {label}
            </button>
          ))}
          <span style={{ background:running?"rgba(0,245,255,0.07)":"rgba(255,100,50,0.07)",
            border:`1px solid ${running?"#00f5ff44":"#ff643244"}`,
            color:running?"#00f5ff":"#ff6432", fontSize:12, padding:"3px 10px", letterSpacing:2 }}>
            {running?"● LIVE":"○ IDLE"}
          </span>
          {roundNum>0 && <span style={{ color:"#4a8aaa", fontSize:13 }}>RND {roundNum}</span>}
          {gameId    && <span style={{ color:"#2a5060", fontSize:12 }}>SESSION #{gameId}</span>}
          {pendingAgent && <span style={{ color:"#ffd700aa", fontSize:12, letterSpacing:1 }}>◈ {pendingAgent.name} QUEUED</span>}
        </div>

        <div style={{ display:"flex", gap:7, alignItems:"center" }}>
          <span style={{ fontSize:13, color:"#4a7080" }}>SPEED</span>
          {[["SLOW",6000],["MED",4500],["FAST",3000]].map(([l,v]) => (
            <button key={l} onClick={() => setSpeed(v)}
              style={{ background:speed===v?"rgba(0,245,255,0.1)":"transparent",
                border:`1px solid ${speed===v?"#00f5ff44":"#0a1e30"}`,
                color:speed===v?"#00f5ff":"#5a8090",
                padding:"4px 12px", cursor:"pointer", fontSize:13, letterSpacing:1, fontFamily:"inherit" }}>{l}</button>
          ))}

          <div style={{ width:1, height:16, background:"#0a1e30", margin:"0 3px" }}/>

          {!running && !gameOver && (
            <button onClick={runGame}
              style={{ background:"rgba(0,245,255,0.08)", border:"1px solid #00f5ff44",
                color:"#00f5ff", padding:"6px 18px", cursor:"pointer",
                fontSize:13, letterSpacing:2, fontFamily:"inherit" }}>▶ RUN</button>
          )}
          {running && (
            <button onClick={() => { runRef.current=false; setRunning(false); addLog("◈ PAUSED","#ff6644"); }}
              style={{ background:"rgba(255,100,50,0.08)", border:"1px solid #ff643233",
                color:"#ff6432", padding:"6px 18px", cursor:"pointer",
                fontSize:13, letterSpacing:2, fontFamily:"inherit" }}>⏸ PAUSE</button>
          )}
          {(gameOver || (!running && players)) && (
            <button onClick={handleReset}
              style={{ background:"rgba(50,50,50,0.1)", border:"1px solid #0a1e30",
                color:"#667788", padding:"6px 18px", cursor:"pointer",
                fontSize:13, letterSpacing:2, fontFamily:"inherit" }}>↺ RESET</button>
          )}

          {/* REVEAL CARDS TOGGLE */}
          {running && (
            <button onClick={() => setShowCards(v => !v)}
              style={{ background:showCards?"rgba(255,215,0,0.12)":"rgba(255,215,0,0.03)",
                border:`1px solid ${showCards?"#ffd70088":"#ffd70022"}`,
                color:showCards?"#ffd700":"#ffd70055",
                padding:"6px 14px", cursor:"pointer",
                fontSize:13, letterSpacing:1, fontFamily:"inherit",
                transition:"all 0.2s" }}>
              {showCards ? "🂠 HIDE CARDS" : "🂠 REVEAL CARDS"}
            </button>
          )}

          <div style={{ width:1, height:16, background:"#0a1e30", margin:"0 3px" }}/>
          <button onClick={() => customCount < 2 && setShowBuilder(!showBuilder)}
            style={{ background:customCount>=2?"rgba(80,0,0,0.1)":showBuilder?"rgba(255,215,0,0.1)":"rgba(255,215,0,0.04)",
              border:`1px solid ${customCount>=2?"#ff444444":showBuilder?"#ffd70066":"#ffd70022"}`,
              color:customCount>=2?"#ff6666":showBuilder?"#ffd700":"#ffd70088",
              padding:"6px 14px", cursor:customCount>=2?"not-allowed":"pointer",
              fontSize:13, letterSpacing:1, fontFamily:"inherit" }}>
            {customCount>=2 ? "◈ TABLE FULL" : `+ DEPLOY AGENT (${customCount}/2)`}
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display:"flex", height:"calc(100vh - 51px)" }}>

      {activeTab === "table" ? (<>

        {/* TABLE */}
        <div style={{ flex:1, position:"relative", overflow:"hidden" }}>

          {/* grid */}
          <div style={{ position:"absolute", inset:0,
            backgroundImage:"linear-gradient(rgba(0,40,80,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(0,40,80,0.08) 1px,transparent 1px)",
            backgroundSize:"40px 40px" }}/>

          {/* glow */}
          <div style={{ position:"absolute", top:"50%", left:"50%",
            transform:"translate(-50%,-50%)", width:460, height:280,
            background:"radial-gradient(ellipse,rgba(0,30,70,0.5) 0%,transparent 70%)",
            pointerEvents:"none" }}/>

          {/* oval table */}
          <div style={{ position:"absolute", top:"50%", left:"50%",
            transform:"translate(-50%,-50%)", width:380, height:210,
            borderRadius:"50%",
            background:"radial-gradient(ellipse,#030e1c 0%,#020b14 100%)",
            border:"2px solid #091e34",
            boxShadow:"0 0 50px rgba(0,30,80,0.4), inset 0 0 35px rgba(0,10,30,0.7)" }}>

            <div style={{ position:"absolute", inset:10, borderRadius:"50%",
              border:"1px solid rgba(0,60,120,0.2)" }}/>

            <div style={{ position:"absolute", top:12, left:"50%",
              transform:"translateX(-50%)", fontSize:13, letterSpacing:3, color:"#2a6080" }}>
              {phase}
            </div>

            {/* community cards */}
            <div style={{ position:"absolute", top:"50%", left:"50%",
              transform:"translate(-50%,-50%)", display:"flex", gap:5, alignItems:"center" }}>
              {community.length > 0
                ? community.map((c,i) => <Card key={i} card={c} delay={i*110}/>)
                : Array.from({length:5}).map((_,i) => (
                    <div key={i} style={{ width:44, height:64, borderRadius:6,
                      border:"1px dashed #091e30", background:"rgba(0,8,20,0.5)" }}/>
                  ))
              }
            </div>

            {pot > 0 && (
              <div style={{ position:"absolute", bottom:22, left:"50%",
                transform:"translateX(-50%)", fontSize:16, letterSpacing:2, color:"#f0cc55", fontWeight:"bold" }}>
                POT: {pot}
              </div>
            )}
          </div>

          {/* agent pods */}
          {allPlayers.map((p, i) => (
            <AgentPod key={p.id} p={p} pos={getPositions(allPlayers.length)[i] || getPositions(5)[0]}
              gameActive={!!players} showCards={showCards}
              onRename={handleRename} onRemove={handleRemove}/>
          ))}
          {allPlayers.length >= 6 && (
            <div style={{ position:"absolute", bottom:"46%", left:"50%",
              transform:"translateX(-50%)", fontSize:10, letterSpacing:4,
              color:"#ff444455", pointerEvents:"none", zIndex:6 }}>
              ◈ TABLE FULL
            </div>
          )}

          {/* GAME OVER */}
          {gameOver && champion && (
            <div style={{ position:"absolute", inset:0,
              background:"rgba(0,3,10,0.9)", display:"flex",
              alignItems:"center", justifyContent:"center",
              zIndex:20, backdropFilter:"blur(4px)" }}>
              <div style={{ textAlign:"center",
                border:`1px solid ${champion.color}`,
                padding:"38px 55px", background:"rgba(0,5,14,0.99)",
                boxShadow:`0 0 70px ${champion.color}44` }}>
                <div style={{ fontSize:9, letterSpacing:4, color:"#1a3050", marginBottom:8 }}>SIMULATION COMPLETE</div>
                <div style={{ fontSize:36, marginBottom:8 }}>{champion.icon}</div>
                <div style={{ fontSize:28, letterSpacing:5, color:champion.color, fontWeight:"bold", marginBottom:4 }}>{champion.name}</div>
                <div style={{ fontSize:10, color:"#445566", letterSpacing:2, marginBottom:10 }}>{champion.role}</div>
                <div style={{ fontSize:15, color:"#e8c050", marginBottom:6 }}>◈ {champion.chips}</div>
                <div style={{ display:"flex", gap:14, justifyContent:"center", fontSize:9, color:"#445566", marginBottom:18 }}>
                  <span>W: {champion.stats?.wins||0}</span>
                  <span>L: {champion.stats?.losses||0}</span>
                  <span>R↑: {champion.stats?.raises||0}</span>
                </div>
                <button onClick={handleReset}
                  style={{ background:`${champion.color}14`, border:`1px solid ${champion.color}`,
                    color:champion.color, padding:"9px 28px", cursor:"pointer",
                    fontSize:11, letterSpacing:3, fontFamily:"inherit" }}>↺ RUN AGAIN</button>
              </div>
            </div>
          )}

          {/* idle state */}
          {!players && !running && (
            <div style={{ position:"absolute", inset:0,
              display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:9, letterSpacing:4, color:"#0a1e30", marginBottom:5 }}>SYSTEM READY</div>
                <div style={{ fontSize:9, letterSpacing:2, color:"#071525" }}>PRESS RUN TO INITIALIZE AGENTS</div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ width:290, borderLeft:"1px solid #091e30",
          display:"flex", flexDirection:"column", background:"rgba(0,3,12,0.95)" }}>

          {showBuilder && (
            <AgentBuilder custom={custom} setCustom={setCustom} onDeploy={deployCustom}/>
          )}

          {/* log header */}
          <div style={{ padding:"10px 14px", borderBottom:"1px solid #091e30",
            fontSize:13, letterSpacing:3, color:"#3a7a90",
            display:"flex", justifyContent:"space-between" }}>
            <span>MISSION LOG</span>
            <span style={{ color:"#2a5060" }}>{logs.length}</span>
          </div>

          {/* log entries */}
          <div ref={logRef} style={{ flex:1, overflowY:"auto", padding:"8px 10px",
            scrollbarWidth:"thin", scrollbarColor:"#0a1e30 transparent" }}>
            {logs.map(e => e.type === "round" ? (
              <div key={e.id} style={{ marginBottom:10, border:`1px solid ${e.winnerColor}33`,
                borderLeft:`3px solid ${e.winnerColor}`, borderRadius:4,
                background:"rgba(0,8,20,0.7)", padding:"9px 11px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontSize:11, color:"#3a6878", letterSpacing:2 }}>ROUND {e.round}</span>
                  <span style={{ fontSize:13, color:"#f0cc55", fontWeight:"bold" }}>◈ {e.pot}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                  <span style={{ fontSize:18 }}>{e.winnerIcon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, color:e.winnerColor, fontWeight:"bold", letterSpacing:1 }}>{e.winner}</div>
                    {e.hand !== "—" && <div style={{ fontSize:12, color:"#7ad0a0" }}>{e.hand}</div>}
                  </div>
                  <span style={{ fontSize:13, color:"#4ade80", fontWeight:"bold",
                    background:"rgba(74,222,128,0.1)", padding:"2px 8px",
                    border:"1px solid #4ade8033", borderRadius:3 }}>WIN</span>
                </div>
                {e.community?.length > 0 && (
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:5 }}>
                    {e.community.map((c,i) => {
                      const red = c.includes("♥")||c.includes("♦");
                      return <span key={i} style={{ fontSize:12, color:red?"#ff8899":"#90b8e0",
                        background:"rgba(0,15,35,0.9)", padding:"2px 6px",
                        border:`1px solid ${red?"#ff446633":"#335577"}`, borderRadius:3 }}>{c}</span>;
                    })}
                  </div>
                )}
                {e.folded?.length > 0 && (
                  <div style={{ fontSize:11, color:"#4a7080" }}>
                    folded: {e.folded.join(", ")}
                  </div>
                )}
              </div>
            ) : (
              <div key={e.id} style={{ padding:"4px 6px", fontSize:13, lineHeight:1.5,
                color:e.color, marginBottom:2 }}>
                {e.msg}
              </div>
            ))}
            {!logs.length && (
              <div style={{ padding:"14px 6px", fontSize:13, color:"#2a4a5a", letterSpacing:2 }}>
                AWAITING SIGNAL...
              </div>
            )}
          </div>

          {/* agents legend */}
          <div style={{ borderTop:"1px solid #091e30", padding:"10px 14px" }}>
            <div style={{ fontSize:12, letterSpacing:3, color:"#3a6070", marginBottom:8 }}>AGENTS ONLINE</div>
            {allPlayers.filter(p=>!p.eliminated).map(p => (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                <span style={{ color:p.color, fontSize:15 }}>{p.icon}</span>
                <span style={{ color:p.color, fontSize:13, letterSpacing:1 }}>{p.name}</span>
                <span style={{ color:"#3a6070", fontSize:12, marginLeft:"auto" }}>◈{p.chips??START}</span>
              </div>
            ))}
          </div>
        </div>

      </>) : (

        /* ── SESSIONS TAB ── */
        <div style={{ flex:1, display:"flex", overflow:"hidden", fontFamily:"'Courier New',monospace" }}>

          {/* LEFT: session list */}
          <div style={{ width:320, borderRight:"1px solid #091e30", overflowY:"auto",
            background:"rgba(0,3,12,0.98)", scrollbarWidth:"thin", scrollbarColor:"#0a1e30 transparent" }}>
            <div style={{ padding:"14px 16px", borderBottom:"1px solid #091e30",
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:14, letterSpacing:3, color:"#3a7a90" }}>ALL SESSIONS</span>
              <button onClick={loadSessions}
                style={{ background:"transparent", border:"1px solid #0a2030", color:"#3a6070",
                  padding:"3px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>
                ↻ REFRESH
              </button>
            </div>
            {loadingSess && (
              <div style={{ padding:20, fontSize:13, color:"#2a5060", letterSpacing:2 }}>LOADING...</div>
            )}
            {!loadingSess && sessions.length === 0 && (
              <div style={{ padding:20, fontSize:13, color:"#2a4a5a", letterSpacing:2 }}>NO SESSIONS YET</div>
            )}
            {sessions.map(s => {
              const isSel = selSession === s.id;
              const isOpen = !s.ended_at;
              const date = new Date(s.started_at).toLocaleDateString("en-US",{month:"short",day:"numeric"});
              const time = new Date(s.started_at).toLocaleTimeString("en-US",{hour12:false,hour:"2-digit",minute:"2-digit"});
              return (
                <div key={s.id} onClick={() => loadRounds(s.id)}
                  style={{ padding:"12px 16px", cursor:"pointer", borderBottom:"1px solid #091e30",
                    background: isSel ? "rgba(0,245,255,0.05)" : "transparent",
                    borderLeft: isSel ? "3px solid #00f5ff" : "3px solid transparent",
                    transition:"all 0.15s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:14, color: isSel?"#00f5ff":"#7ab8cc", fontWeight:"bold" }}>
                      SESSION #{s.id}
                    </span>
                    <span style={{ fontSize:11, color: isOpen?"#fb923c":"#4ade80" }}>
                      {isOpen ? "● OPEN" : "● DONE"}
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:"#3a6878", marginBottom:3 }}>{date} {time}</div>
                  <div style={{ display:"flex", gap:12 }}>
                    <span style={{ fontSize:12, color:"#5a8090" }}>
                      {s.total_rounds} rounds
                    </span>
                    {s.winner_name && (
                      <span style={{ fontSize:12, color:"#f0cc55" }}>
                        ▶ {s.winner_name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT: rounds for selected session */}
          <div style={{ flex:1, overflowY:"auto", background:"rgba(0,5,14,0.97)",
            scrollbarWidth:"thin", scrollbarColor:"#0a1e30 transparent" }}>
            {!selSession ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
                height:"100%", fontSize:14, color:"#1a4050", letterSpacing:3 }}>
                ← SELECT A SESSION
              </div>
            ) : selRounds.length === 0 ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
                height:"100%", fontSize:14, color:"#1a4050", letterSpacing:3 }}>
                NO ROUNDS RECORDED
              </div>
            ) : (
              <div style={{ padding:20 }}>
                {/* session header */}
                {(() => {
                  const s = sessions.find(x=>x.id===selSession);
                  return s ? (
                    <div style={{ marginBottom:20, paddingBottom:16, borderBottom:"1px solid #091e30" }}>
                      <div style={{ fontSize:18, color:"#00f5ff", fontWeight:"bold", letterSpacing:3, marginBottom:6 }}>
                        SESSION #{s.id}
                      </div>
                      <div style={{ display:"flex", gap:24 }}>
                        <div>
                          <div style={{ fontSize:11, color:"#3a6070", letterSpacing:2 }}>STARTED</div>
                          <div style={{ fontSize:13, color:"#7ab8cc" }}>
                            {new Date(s.started_at).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize:11, color:"#3a6070", letterSpacing:2 }}>ROUNDS</div>
                          <div style={{ fontSize:13, color:"#7ab8cc" }}>{selRounds.length}</div>
                        </div>
                        {s.winner_name && (
                          <div>
                            <div style={{ fontSize:11, color:"#3a6070", letterSpacing:2 }}>CHAMPION</div>
                            <div style={{ fontSize:13, color:"#f0cc55", fontWeight:"bold" }}>{s.winner_name}</div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize:11, color:"#3a6070", letterSpacing:2 }}>TOTAL POT</div>
                          <div style={{ fontSize:13, color:"#f0cc55" }}>
                            ◈ {selRounds.reduce((acc,r)=>acc+r.pot_size,0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* round cards grid */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
                  {selRounds.map(r => {
                    // find unique agents that played this round
                    const agents = [...new Set((r.actions||[]).map(a=>a.agent_name))];
                    const folded = (r.actions||[]).filter(a=>a.action==="fold").map(a=>a.agent_name);
                    const winner = r.winner_name;
                    const winnerAction = (r.actions||[]).find(a=>a.agent_name===winner && a.hand_rank);
                    const community = r.community_cards || [];
                    return (
                      <div key={r.id} style={{ background:"rgba(0,8,22,0.9)",
                        border:"1px solid #0a2535", borderRadius:6, padding:"14px 16px",
                        borderTop:`3px solid #00f5ff33` }}>
                        {/* round header */}
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                          <span style={{ fontSize:13, color:"#3a7888", letterSpacing:2 }}>ROUND {r.round_number}</span>
                          <span style={{ fontSize:14, color:"#f0cc55", fontWeight:"bold" }}>◈ {r.pot_size}</span>
                        </div>
                        {/* winner */}
                        <div style={{ background:"rgba(0,245,255,0.04)", border:"1px solid #00f5ff22",
                          borderRadius:4, padding:"8px 10px", marginBottom:10 }}>
                          <div style={{ fontSize:11, color:"#3a7888", letterSpacing:2, marginBottom:3 }}>WINNER</div>
                          <div style={{ fontSize:16, color:"#00f5ff", fontWeight:"bold" }}>{winner}</div>
                          {winnerAction?.hand_rank && (
                            <div style={{ fontSize:12, color:"#7ad0a0", marginTop:2 }}>{winnerAction.hand_rank}</div>
                          )}
                        </div>
                        {/* community cards */}
                        {community.length > 0 && (
                          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10 }}>
                            {community.map((c,i) => {
                              const card = typeof c === "string" ? c : (c?.rank||"")+(c?.suit||"");
                              const red  = card.includes("♥")||card.includes("♦");
                              return (
                                <span key={i} style={{ fontSize:13, color:red?"#ff8899":"#90b8e0",
                                  background:"rgba(0,15,35,0.9)", padding:"3px 7px",
                                  border:`1px solid ${red?"#ff446633":"#335577"}`, borderRadius:3 }}>
                                  {card}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {/* agent actions summary */}
                        <div style={{ borderTop:"1px solid #091e30", paddingTop:8 }}>
                          {agents.map(name => {
                            const acts = (r.actions||[]).filter(a=>a.agent_name===name);
                            const lastAct = acts[acts.length-1];
                            const isWinner = name === winner;
                            const isFolded = folded.includes(name);
                            return (
                              <div key={name} style={{ display:"flex", alignItems:"center",
                                gap:8, marginBottom:5 }}>
                                <span style={{ fontSize:13, minWidth:90,
                                  color: isWinner?"#00f5ff" : isFolded?"#3a5060":"#7a9aaa",
                                  fontWeight: isWinner?"bold":"normal" }}>
                                  {name}
                                </span>
                                <span style={{ fontSize:11, padding:"2px 7px", borderRadius:3,
                                  background: isWinner?"rgba(0,245,255,0.1)" : isFolded?"rgba(0,0,0,0.3)":"rgba(255,255,255,0.03)",
                                  color: isWinner?"#00f5ff" : isFolded?"#3a5566":"#6a9aaa",
                                  border:`1px solid ${isWinner?"#00f5ff33" : isFolded?"#1a3040":"#1a3040"}` }}>
                                  {isFolded ? "FOLD" : (lastAct?.action||"—").toUpperCase()}
                                </span>
                                {lastAct?.hand_rank && (
                                  <span style={{ fontSize:11, color:"#7ad0a0", marginLeft:"auto" }}>
                                    {lastAct.hand_rank}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

      )}

      </div>
    </div>
  );
}