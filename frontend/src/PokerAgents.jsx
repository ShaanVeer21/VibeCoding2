import { useState, useEffect, useRef, useCallback } from "react";
import { createDeck, evaluateHand } from "./engine";
import { DEFAULT_AGENTS, DEFAULT_STATS, ICONS, COLORS, agentDecide, llmDecide, LLM_PROVIDERS } from "./agents";

const API   = "http://localhost:8000";
const SB    = 25;
const BB    = 50;
const START = 1500;

// ── Hand History tab ──────────────────────────────────────────────────────────
// handHistory is passed in as prop — array of completed hand records
function HandHistoryPanel({ hands }) {
  const [selected, setSelected] = useState(null);

  if (!hands || hands.length === 0) return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",
      flexDirection:"column",gap:12,background:"rgba(0,3,12,0.98)"}}>
      <div style={{fontSize:13,color:"#1a4050",letterSpacing:3}}>NO HANDS PLAYED YET</div>
      <div style={{fontSize:11,color:"#0d2535",letterSpacing:2}}>START A GAME TO SEE HAND HISTORY</div>
    </div>
  );

  const detail = selected !== null ? hands[selected] : null;

  return (
    <div style={{flex:1,display:"flex",overflow:"hidden",background:"rgba(0,3,12,0.98)"}}>

      {/* LEFT: hand list */}
      <div style={{width:260,borderRight:"1px solid #091e30",overflowY:"auto",
        scrollbarWidth:"thin",scrollbarColor:"#0a1e30 transparent"}}>
        <div style={{padding:"12px 14px",borderBottom:"1px solid #091e30",
          fontSize:12,letterSpacing:3,color:"#3a7a90"}}>
          HAND HISTORY · {hands.length} HANDS
        </div>
        {[...hands].reverse().map((h, ri) => {
          const i = hands.length - 1 - ri;
          const isSelected = selected === i;
          return (
            <div key={i} onClick={()=>setSelected(i)}
              style={{padding:"10px 14px",borderBottom:"1px solid #081520",
                cursor:"pointer",transition:"background 0.12s",
                borderLeft:`3px solid ${isSelected?h.winnerColor:"transparent"}`,
                background:isSelected?"rgba(0,245,255,0.04)":"transparent"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:11,color:"#3a6070",letterSpacing:2}}>HAND #{h.round}</span>
                <span style={{fontSize:12,color:"#f0cc55",fontWeight:"bold"}}>◈ {h.pot}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                <span style={{fontSize:14}}>{h.winnerIcon}</span>
                <span style={{fontSize:12,color:h.winnerColor,fontWeight:"bold",letterSpacing:1}}>
                  {h.winner}
                </span>
                <span style={{fontSize:10,color:"#4ade80",marginLeft:"auto",
                  background:"rgba(74,222,128,0.08)",padding:"1px 6px",
                  border:"1px solid #4ade8033"}}>WINS</span>
              </div>
              {h.hand && h.hand !== "—" && (
                <div style={{fontSize:11,color:"#5a9070",letterSpacing:1}}>{h.hand}</div>
              )}
              {/* mini community cards */}
              <div style={{display:"flex",gap:3,marginTop:4,flexWrap:"wrap"}}>
                {(h.community||[]).map((c,ci)=>{
                  const red=c.includes("♥")||c.includes("♦");
                  return <span key={ci} style={{fontSize:10,color:red?"#ff8899":"#6090b0",
                    background:"rgba(0,10,25,0.8)",padding:"1px 4px",
                    border:`1px solid ${red?"#ff334422":"#1a3a55"}`,borderRadius:2}}>{c}</span>;
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* RIGHT: hand detail */}
      <div style={{flex:1,overflowY:"auto",padding:20,
        scrollbarWidth:"thin",scrollbarColor:"#0a1e30 transparent"}}>
        {!detail ? (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",
            height:"100%",fontSize:13,color:"#1a4050",letterSpacing:3}}>
            ← SELECT A HAND TO REVIEW
          </div>
        ) : (
          <>
            {/* hand header */}
            <div style={{marginBottom:20,paddingBottom:16,borderBottom:"1px solid #091e30"}}>
              <div style={{display:"flex",alignItems:"baseline",gap:14,marginBottom:10,flexWrap:"wrap"}}>
                <span style={{fontSize:20,color:"#00f5ff",fontWeight:"bold",letterSpacing:3}}>
                  HAND #{detail.round}
                </span>
                <span style={{fontSize:13,color:"#3a6070",letterSpacing:2}}>{detail.phase}</span>
                <span style={{fontSize:14,color:"#f0cc55",fontWeight:"bold",marginLeft:"auto"}}>
                  POT: ◈ {detail.pot}
                </span>
              </div>
              {/* positions row */}
              <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:10}}>
                {[
                  ["DEALER",detail.dealer,"#f0cc55"],
                  ["SMALL BLIND",detail.sb,"#fb923c"],
                  ["BIG BLIND",detail.bb,"#4ade80"],
                ].map(([role,name,col])=> name ? (
                  <div key={role} style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:10,padding:"2px 7px",letterSpacing:1,fontWeight:"bold",
                      background:`${col}18`,border:`1px solid ${col}44`,color:col,
                      borderRadius:2}}>{role}</span>
                    <span style={{fontSize:12,color:"#8ab0c0"}}>{name}</span>
                  </div>
                ) : null)}
              </div>
              {/* board / community cards */}
              {(detail.community||[]).length > 0 && (
                <div>
                  <div style={{fontSize:10,letterSpacing:2,color:"#3a6070",marginBottom:6}}>BOARD</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {(detail.community||[]).map((c,ci)=>{
                      const red=c.includes("♥")||c.includes("♦");
                      return (
                        <div key={ci} style={{width:40,height:58,borderRadius:5,
                          display:"flex",flexDirection:"column",alignItems:"center",
                          justifyContent:"center",fontWeight:"bold",
                          background:"linear-gradient(135deg,#0d1b2a,#162032)",
                          border:`1px solid ${red?"#ff4466":"#6699cc"}`,
                          boxShadow:`0 0 8px ${red?"rgba(255,68,102,0.25)":"rgba(100,160,220,0.15)"}`,
                          color:red?"#ff6688":"#c8d8f0"}}>
                          <span style={{fontSize:10}}>{c.slice(0,-1)}</span>
                          <span style={{fontSize:15}}>{c.slice(-1)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* winner */}
            <div style={{marginBottom:16,padding:"12px 16px",
              background:`${detail.winnerColor}0c`,
              border:`1px solid ${detail.winnerColor}33`,borderRadius:4}}>
              <div style={{fontSize:10,letterSpacing:2,color:"#3a7060",marginBottom:5}}>WINNER</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:22}}>{detail.winnerIcon}</span>
                <div>
                  <div style={{fontSize:16,color:detail.winnerColor,fontWeight:"bold",letterSpacing:2}}>
                    {detail.winner}
                  </div>
                  {detail.hand && detail.hand!=="—" && (
                    <div style={{fontSize:12,color:"#7ad0a0",marginTop:2}}>
                      {detail.hand}
                    </div>
                  )}
                </div>
                <div style={{marginLeft:"auto",fontSize:14,color:"#f0cc55",fontWeight:"bold"}}>
                  +◈ {detail.pot}
                </div>
              </div>
            </div>

            {/* per-player action breakdown */}
            <div style={{fontSize:11,letterSpacing:2,color:"#3a6070",marginBottom:10}}>
              ACTION LOG
            </div>
            {(detail.players||[]).map((p,pi)=>(
              <div key={pi} style={{marginBottom:12,padding:"10px 14px",
                background:"rgba(0,8,22,0.7)",border:"1px solid #0a2030",borderRadius:4,
                borderLeft:`3px solid ${p.color||"#2a4060"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:15}}>{p.icon||"◎"}</span>
                  <span style={{fontSize:13,color:p.color||"#7ab8cc",fontWeight:"bold",
                    letterSpacing:1,flex:1}}>{p.name}</span>
                  {/* hole cards */}
                  {(p.holeCards||[]).length===2&&(
                    <div style={{display:"flex",gap:3}}>
                      {p.holeCards.map((c,ci)=>{
                        const red=c.includes("♥")||c.includes("♦");
                        return <span key={ci} style={{fontSize:12,padding:"2px 5px",
                          color:red?"#ff8899":"#90b8e0",
                          background:"rgba(0,10,30,0.9)",
                          border:`1px solid ${red?"#ff446633":"#335577"}`,
                          borderRadius:3}}>{c}</span>;
                      })}
                    </div>
                  )}
                  {p.handRank&&(
                    <span style={{fontSize:11,color:"#7ad0a0",letterSpacing:1}}>{p.handRank}</span>
                  )}
                  {p.folded&&!p.won&&(
                    <span style={{fontSize:10,color:"#3a5060",letterSpacing:1,
                      background:"rgba(0,0,0,0.3)",padding:"1px 6px",border:"1px solid #1a3040"}}>
                      FOLDED
                    </span>
                  )}
                  {p.won&&(
                    <span style={{fontSize:10,color:"#4ade80",letterSpacing:1,
                      background:"rgba(74,222,128,0.1)",padding:"1px 6px",
                      border:"1px solid #4ade8033"}}>WON</span>
                  )}
                </div>
                {/* street-by-street actions */}
                {(p.streetActions||[]).length > 0 && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {p.streetActions.map((sa,si)=>{
                      const actionColor = {
                        fold:"#ff5555",check:"#7ab8cc",call:"#60a0e0",
                        raise:"#f0cc55","all-in":"#ff6bff"
                      }[sa.action]||"#5a8090";
                      return (
                        <div key={si} style={{display:"flex",alignItems:"center",gap:4,
                          padding:"3px 8px",borderRadius:2,
                          background:`${actionColor}12`,
                          border:`1px solid ${actionColor}33`}}>
                          <span style={{fontSize:9,color:"#3a5060",letterSpacing:1}}>
                            {sa.street}
                          </span>
                          <span style={{fontSize:11,color:actionColor,fontWeight:"bold",
                            letterSpacing:1,textTransform:"uppercase"}}>
                            {sa.action}{sa.amount>0?` ◈${sa.amount}`:""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {p.thought&&(
                  <div style={{marginTop:5,fontSize:11,color:"#4a7080",fontStyle:"italic"}}>
                    "{p.thought}"
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}


function Card({ card, hidden, delay=0, sm }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(()=>setVis(true),delay); return ()=>clearTimeout(t); },[card,delay]);
  const red = card && (card.suit==="♥"||card.suit==="♦");
  const w=sm?32:44, h=sm?44:64;
  const base={ width:w,height:h,borderRadius:6,display:"flex",flexDirection:"column",
    alignItems:"center",justifyContent:"center",fontWeight:"bold" };
  if (hidden) return (
    <div style={{...base,background:"linear-gradient(135deg,#0a0f1e,#1a2744)",
      border:"1px solid #1e3a5f",boxShadow:"0 0 8px rgba(0,245,255,0.12)"}}>
      <span style={{color:"#1e3a5f",fontSize:sm?14:20}}>⬡</span>
    </div>
  );
  return (
    <div style={{...base,transition:"all 0.45s",opacity:vis?1:0,
      transform:vis?"translateY(0)":"translateY(-8px)",
      background:"linear-gradient(135deg,#0d1b2a,#162032)",
      border:`1px solid ${red?"#ff4466":"#6699cc"}`,
      boxShadow:`0 0 10px ${red?"rgba(255,68,102,0.3)":"rgba(100,160,220,0.2)"}`,
      color:red?"#ff6688":"#c8d8f0"}}>
      <span style={{fontSize:sm?9:11,lineHeight:1}}>{card.rank}</span>
      <span style={{fontSize:sm?12:17,lineHeight:1}}>{card.suit}</span>
    </div>
  );
}

// ── Slider ────────────────────────────────────────────────────────────────────
function Slider({ label, value, onChange, color="#00f5ff" }) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:13,letterSpacing:2,color:"#7ab8cc"}}>{label}</span>
        <span style={{fontSize:14,color,fontWeight:"bold"}}>{value}</span>
      </div>
      <div style={{position:"relative",height:4,background:"#0a1e30",borderRadius:2}}>
        <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${value}%`,
          background:`linear-gradient(90deg,${color}66,${color})`,borderRadius:2,transition:"width 0.1s"}}/>
        <input type="range" min={0} max={100} value={value}
          onChange={e=>onChange(Number(e.target.value))}
          style={{position:"absolute",inset:0,width:"100%",opacity:0,cursor:"pointer",height:"100%",margin:0}}/>
      </div>
    </div>
  );
}

// ── AgentPod ──────────────────────────────────────────────────────────────────
function AgentPod({ p, pos, gameActive, showCards, onRename, onRemove, isActive, isDealer }) {
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(p.name);
  const isElim=p.eliminated, isFold=p.folded&&!isElim, isQueued=p._queued;
  const statusLabel=isQueued?"NEXT HAND":isElim?"ELIM":isFold?"FOLD":isActive?"ACTING":p.lastAction?p.lastAction.toUpperCase():"WAIT";
  const statusColor=isQueued?"#ffd700":isElim?"#ff4444":isFold?"#334466":p.color;
  const commitName=()=>{if(draft.trim())onRename(p.id,draft.trim());setEditing(false);};

  return (
    <div style={{position:"absolute",...pos,width:215,
      opacity:isElim?0.2:1,filter:isElim?"grayscale(1)":"none",
      transition:"opacity 0.5s",zIndex:isActive?8:5}}>

      {isActive&&(
        <div style={{position:"absolute",inset:-4,borderRadius:6,zIndex:-1,
          border:`2px solid ${p.color}`,
          boxShadow:`0 0 20px ${p.color}cc,0 0 40px ${p.color}66,0 0 60px ${p.color}33`,
          animation:"turnGlow 0.6s ease-in-out infinite alternate",pointerEvents:"none"}}/>
      )}


      <div style={{background:"rgba(2,8,18,0.97)",
        border:`1px solid ${isElim?"#0a1830":isFold?"#1a3050":isActive?p.color+"cc":p.color+"66"}`,
        borderRadius:4,padding:"12px 14px",position:"relative",
        boxShadow:isActive?`0 0 28px ${p.color}40`:"none",
        transition:"border-color 0.2s,box-shadow 0.2s"}}>

        {[{top:0,left:0,borderTop:`2px solid ${p.color}`,borderLeft:`2px solid ${p.color}`},
          {bottom:0,right:0,borderBottom:`2px solid ${p.color}`,borderRight:`2px solid ${p.color}`}
        ].map((s,i)=>(
          <div key={i} style={{position:"absolute",...s,width:14,height:14,
            opacity:isElim?0.1:isFold?0.25:isActive?1:0.8}}/>
        ))}

        {/* name row */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{display:"flex",alignItems:"center",gap:5,flex:1,minWidth:0}}>
            <span style={{color:p.color,fontSize:17,flexShrink:0}}>{p.icon}</span>
            {editing?(
              <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={e=>{if(e.key==="Enter")commitName();if(e.key==="Escape")setEditing(false);}}
                style={{background:"transparent",border:"none",borderBottom:`1px solid ${p.color}`,
                  color:p.color,fontSize:14,letterSpacing:2,fontFamily:"inherit",
                  fontWeight:"bold",outline:"none",width:100}}/>
            ):(
              <span onClick={()=>{setDraft(p.name);setEditing(true);}} title="Click to rename"
                style={{color:p.color,fontSize:14,letterSpacing:2,fontWeight:"bold",
                  cursor:"text",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {p.name}
              </span>
            )}
          </div>
          <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
            {p.isCustom&&!isElim&&(
              <button onClick={()=>onRemove(p.id)}
                style={{background:"transparent",border:"none",color:"#ff666688",
                  cursor:"pointer",fontSize:13,padding:0,lineHeight:1}}>✕</button>
            )}
            <div style={{fontSize:11,padding:"2px 7px",
              background:`${p.color}18`,border:`1px solid ${p.color}44`,
              color:statusColor,letterSpacing:1,fontWeight:"bold"}}>{statusLabel}</div>
          </div>
        </div>

        {/* role */}
        <div style={{fontSize:12,color:"#7ab8cc",letterSpacing:1,marginBottom:7}}>
          {p.role||"Custom Agent"}
          {p.isCustom&&<span style={{color:"#ffd70044",marginLeft:6}}>CUSTOM</span>}
        </div>

        {/* chips */}
        <div style={{fontSize:16,color:"#f0cc66",letterSpacing:1,marginBottom:4,fontWeight:"bold"}}>
          ◈ {p.chips??START}
        </div>

        {/* blinds indicator */}
        {isDealer&&gameActive&&!isElim&&(
          <div style={{fontSize:10,color:"#f0cc5588",letterSpacing:2,marginBottom:6}}>DEALER</div>
        )}

        {/* hole cards */}
        <div style={{display:"flex",gap:4,marginBottom:6}}>
          {gameActive&&!isElim?(
            p.holeCards?.length===2?(
              showCards
                ?p.holeCards.map((c,ci)=><Card key={ci} card={c} sm delay={ci*80}/>)
                :[0,1].map(ci=><Card key={ci} card={null} hidden sm/>)
            ):[0,1].map(ci=><Card key={ci} card={null} hidden sm/>)
          ):(
            [0,1].map(ci=><div key={ci} style={{width:38,height:54,borderRadius:4,
              border:"1px dashed #1a3050",background:"rgba(0,5,15,0.5)"}}/>)
          )}
        </div>

        {/* stats W L F R */}
        <div style={{display:"flex",gap:5,marginBottom:8}}>
          {[["W",p.stats?.wins||0,"#4ade80"],
            ["L",p.stats?.losses||0,"#ff7766"],
            ["F",p.stats?.folds||0,"#7a9ab0"],
            ["R↑",p.stats?.raises||0,"#f0cc66"]
          ].map(([lbl,val,col])=>(
            <div key={lbl} style={{flex:1,textAlign:"center",
              background:"rgba(0,15,30,0.7)",borderRadius:3,padding:"4px 2px"}}>
              <div style={{fontSize:11,color:"#6090a8",letterSpacing:1}}>{lbl}</div>
              <div style={{fontSize:14,color:col,fontWeight:"bold"}}>{val}</div>
            </div>
          ))}
        </div>

        {/* thought */}
        {!isElim&&(
          <div style={{borderTop:"1px solid #091828",paddingTop:5,minHeight:20}}>
            {p.thinking?(
              <div style={{display:"flex",gap:3,alignItems:"center"}}>
                <span style={{fontSize:11,color:"#4a7080",letterSpacing:1}}>PROCESSING</span>
                {[0,1,2].map(i=>(
                  <div key={i} style={{width:4,height:4,borderRadius:"50%",
                    background:p.color,opacity:0.9,
                    animation:`pulse 0.9s ${i*0.18}s infinite`}}/>
                ))}
              </div>
            ):(
              <div style={{fontSize:12,color:isFold?"#4a7080":"#88bbcc",
                fontStyle:"italic",lineHeight:1.4,maxHeight:34,overflow:"hidden"}}>
                {p.thought?`"${p.thought}"`:""}
              </div>
            )}
          </div>
        )}
        {isElim&&(
          <div style={{fontSize:12,color:"#ff555566",letterSpacing:2,textAlign:"center",marginTop:4}}>
            TERMINATED
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agent Builder Panel ───────────────────────────────────────────────────────
function AgentBuilder({ custom, setCustom, onDeploy }) {
  return (
    <div style={{borderBottom:"1px solid #081e30",padding:16,
      overflowY:"auto",maxHeight:"65vh",
      scrollbarWidth:"thin",scrollbarColor:"#0a1e30 transparent"}}>

      <div style={{fontSize:13,letterSpacing:3,color:"#ffd700",marginBottom:14}}>◈ DEPLOY CUSTOM AGENT</div>

      <div style={{marginBottom:12}}>
        <div style={{fontSize:12,letterSpacing:2,color:"#6a9aaa",marginBottom:5}}>DESIGNATION</div>
        <input value={custom.name} onChange={e=>setCustom(p=>({...p,name:e.target.value}))}
          style={{background:"transparent",border:"1px solid #0d2035",color:"#c0d8e8",
            padding:"6px 10px",width:"100%",fontFamily:"inherit",
            fontSize:14,letterSpacing:2,boxSizing:"border-box"}}/>
      </div>

      <div style={{marginBottom:5,fontSize:12,color:"#6a9aaa",letterSpacing:2}}>ICON</div>
      <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
        {ICONS.map(ic=>(
          <button key={ic} onClick={()=>setCustom(p=>({...p,icon:ic}))}
            style={{background:custom.icon===ic?"rgba(255,215,0,0.14)":"transparent",
              border:`1px solid ${custom.icon===ic?"#ffd700":"#0d2035"}`,
              color:custom.icon===ic?"#ffd700":"#6a8090",
              width:30,height:30,cursor:"pointer",fontSize:15}}>{ic}</button>
        ))}
      </div>

      <div style={{marginBottom:5,fontSize:12,color:"#6a9aaa",letterSpacing:2}}>COLOR</div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {COLORS.map(c=>(
          <button key={c} onClick={()=>setCustom(p=>({...p,color:c}))}
            style={{width:24,height:24,background:c,cursor:"pointer",borderRadius:3,
              border:custom.color===c?"3px solid #fff":"2px solid transparent"}}/>
        ))}
      </div>

      <div style={{fontSize:12,letterSpacing:2,color:"#6a9aaa",marginBottom:10}}>BEHAVIORAL PARAMETERS</div>
      {[["RISK","risk","#ff6b6b"],["AGGRESSION","aggression","#fb923c"],
        ["BLUFF","bluff","#ffd93d"],["PATIENCE","patience","#34d399"],
        ["TILT","tilt","#f472b6"],["ADAPTABILITY","adaptability","#a78bfa"],
      ].map(([label,key,col])=>(
        <Slider key={key} label={label} value={custom.params[key]} color={col}
          onChange={val=>setCustom(p=>({...p,params:{...p.params,[key]:val}}))}/>
      ))}

      <div style={{marginBottom:12}}>
        <div style={{fontSize:12,letterSpacing:2,color:"#6a9aaa",marginBottom:7}}>BUY-IN CHIPS</div>
        <div style={{display:"flex",gap:5}}>
          {[500,1000,1500,2000].map(v=>(
            <button key={v} onClick={()=>setCustom(p=>({...p,buyIn:v}))}
              style={{flex:1,background:custom.buyIn===v?"rgba(255,215,0,0.1)":"transparent",
                border:`1px solid ${custom.buyIn===v?"#ffd70055":"#0d2035"}`,
                color:custom.buyIn===v?"#ffd700":"#6a8898",
                padding:"6px 0",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>{v}</button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <div style={{fontSize:12,letterSpacing:2,color:"#6a9aaa",marginBottom:7}}>ENTRY TRIGGER</div>
        <div style={{display:"flex",gap:5}}>
          {[["NOW","immediate"],["NEXT ROUND","next"]].map(([l,v])=>(
            <button key={v} onClick={()=>setCustom(p=>({...p,entryTrigger:v}))}
              style={{flex:1,background:custom.entryTrigger===v?"rgba(0,245,255,0.1)":"transparent",
                border:`1px solid ${custom.entryTrigger===v?"#00f5ff44":"#0d2035"}`,
                color:custom.entryTrigger===v?"#00f5ff":"#6a8898",
                padding:"6px 0",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:14}}>
        <div style={{fontSize:12,letterSpacing:2,color:"#6a9aaa",marginBottom:7}}>EXIT CONDITION</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {[["CHIPS BELOW","chips_below"],["CHIPS ABOVE","chips_above"],["MANUAL","manual"]].map(([l,v])=>(
            <button key={v} onClick={()=>setCustom(p=>({...p,exitCondition:v}))}
              style={{flex:1,background:custom.exitCondition===v?"rgba(255,100,50,0.1)":"transparent",
                border:`1px solid ${custom.exitCondition===v?"#ff643244":"#0d2035"}`,
                color:custom.exitCondition===v?"#ff6432":"#6a8898",
                padding:"6px 0",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>
        {custom.exitCondition!=="manual"&&(
          <input type="number" value={custom.exitValue}
            onChange={e=>setCustom(p=>({...p,exitValue:Number(e.target.value)}))}
            placeholder="chip threshold"
            style={{background:"transparent",border:"1px solid #0d2035",color:"#c0d8e8",
              padding:"6px 10px",width:"100%",fontFamily:"inherit",marginTop:7,
              fontSize:13,boxSizing:"border-box"}}/>
        )}
      </div>

      <button onClick={onDeploy}
        style={{width:"100%",background:"rgba(255,215,0,0.08)",
          border:"1px solid #ffd70066",color:"#ffd700",
          padding:"10px 0",cursor:"pointer",fontSize:14,
          letterSpacing:3,fontFamily:"inherit"}}>◈ DEPLOY</button>
    </div>
  );
}

// ── Positions clockwise from top ──────────────────────────────────────────────
function getPositions(n) {
  if (n<=4) return [
    {top:"2%",left:"50%",transform:"translateX(-50%)"},
    {top:"12%",right:"1%"},
    {bottom:"2%",left:"50%",transform:"translateX(-50%)"},
    {top:"12%",left:"1%"},
  ];
  if (n===5) return [
    {top:"2%",left:"50%",transform:"translateX(-50%)"},
    {top:"12%",right:"1%"},
    {bottom:"2%",right:"14%"},
    {bottom:"2%",left:"14%"},
    {top:"12%",left:"1%"},
  ];
  return [
    {top:"2%",left:"50%",transform:"translateX(-50%)"},
    {top:"12%",right:"1%"},
    {bottom:"2%",right:"1%"},
    {bottom:"2%",left:"50%",transform:"translateX(-50%)"},
    {bottom:"2%",left:"1%"},
    {top:"12%",left:"1%"},
  ];
}

const apiPost  = async(url,body)=>{try{const r=await fetch(`${API}${url}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});return await r.json();}catch{return null;}};
const apiPatch = async(url,body)=>{try{await fetch(`${API}${url}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});}catch{}};

// ── Main Component ────────────────────────────────────────────────────────────
export default function PokerAgents() {
  const [players,        setPlayers]        = useState(null);
  const [community,      setCommunity]      = useState([]);
  const [pot,            setPot]            = useState(0);
  const [phase,          setPhase]          = useState("STANDBY");
  const [logs,           setLogs]           = useState([]);
  const [running,        setRunning]        = useState(false);
  const [paused,         setPaused]         = useState(false);
  const [roundNum,       setRoundNum]       = useState(0);
  const [gameOver,       setGameOver]       = useState(false);
  const [champion,       setChampion]       = useState(null);
  const [showCards,      setShowCards]      = useState(false);
  const [speed,          setSpeed]          = useState(6000);
  const [gameId,         setGameId]         = useState(null);
  const [showBuilder,    setShowBuilder]    = useState(false);
  const [agentsList,     setAgentsList]     = useState(DEFAULT_AGENTS);
  const [pendingAgent,   setPendingAgent]   = useState(null);
  const [activeTab,      setActiveTab]      = useState("table");
  const [handHistory,    setHandHistory]    = useState([]);
  const [liveHandLog,    setLiveHandLog]    = useState([]); // live action log for current hand
  const [logTab,         setLogTab]         = useState("hand"); // "hand" | "event"
  const [sessions,       setSessions]       = useState([]);
  const [selSession,     setSelSession]     = useState(null);
  const [selRounds,      setSelRounds]      = useState([]);
  const [loadingSess,    setLoadingSess]    = useState(false);
  const [activePlayerId, setActivePlayerId] = useState(null);
  const [dealerIdx,      setDealerIdx]      = useState(0);
  const [showGlossary,   setShowGlossary]   = useState(false);
  const [showLLMPanel,   setShowLLMPanel]   = useState(false);
  // apiKeys: { groq: "gsk_..." }
  const [apiKeys,        setApiKeys]        = useState(() => {
    try { return JSON.parse(localStorage.getItem("poker_api_keys")||"{}"); } catch { return {}; }
  });
  // agentLLM: { [agentId]: "groq" | null }
  const [agentLLM,       setAgentLLM]       = useState({ 1: "groq" }); // NOVA defaults to groq
  const [sbId,           setSbId]           = useState(null);
  const [bbId,           setBbId]           = useState(null);
  const [handNum,        setHandNum]        = useState(0);

  const [custom, setCustom] = useState({
    name:"AGENT-X",icon:"◉",color:"#ff6b6b",
    params:{risk:50,aggression:50,bluff:30,patience:50,tilt:20,adaptability:50,style:"SHARK"},
    buyIn:1500,exitCondition:"manual",exitValue:500,entryTrigger:"next",
  });

  const runRef      = useRef(false);
  const pauseRef    = useRef(false); // true = pause after current hand completes
  const speedRef    = useRef(speed);
  const logRef      = useRef(null);
  const pendingRef  = useRef(null);
  const removedIdsRef = useRef(new Set()); // ids removed mid-game via handleRemove
  const apiKeysRef  = useRef(apiKeys);
  const agentLLMRef = useRef(agentLLM);

  useEffect(()=>{speedRef.current=speed;},[speed]);
  useEffect(()=>{pendingRef.current=pendingAgent;},[pendingAgent]);
  useEffect(()=>{apiKeysRef.current=apiKeys;},[apiKeys]);
  useEffect(()=>{agentLLMRef.current=agentLLM;},[agentLLM]);

  const saveApiKey = (provider, key) => {
    const updated = {...apiKeysRef.current, [provider]: key};
    setApiKeys(updated);
    apiKeysRef.current = updated;
    try { localStorage.setItem("poker_api_keys", JSON.stringify(updated)); } catch {}
  };

  const setAgentProvider = (agentId, provider) => {
    const updated = {...agentLLMRef.current, [agentId]: provider||null};
    setAgentLLM(updated);
    agentLLMRef.current = updated;
  };

  const addLog = useCallback((entry, color="#8899aa") => {
    const item = typeof entry==="string"
      ?{type:"msg",msg:entry,color,id:Date.now()+Math.random()}
      :{...entry,id:Date.now()+Math.random()};
    setLogs(p=>[...p.slice(-80),item]);
    setTimeout(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},40);
  },[]);

  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  const initPlayers = useCallback((agents) =>
    agents.map(a=>({...a,chips:a.chips||START,holeCards:[],folded:false,
      eliminated:false,currentBet:0,thought:"Standby.",thinking:false,
      lastAction:null,stats:a.stats||{...DEFAULT_STATS}}))
  ,[]);

  // ── Game loop ──────────────────────────────────────────────────────────────
  const runGame = useCallback(async () => {
    if (runRef.current) return;
    runRef.current = true;
    setRunning(true); setGameOver(false); setChampion(null); setLogs([]); setRoundNum(0); setHandNum(0);

    let pList = initPlayers(agentsList);
    setPlayers(pList);
    addLog("◈ SYSTEM BOOT — POKER AGENTS INITIALIZED","#00f5ff");
    await sleep(500);

    const gData = await apiPost("/games",{});
    const gid   = gData?.id||null;
    setGameId(gid);
    if (gid) addLog(`▸ Session #${gid} opened`,"#1a3a55");

    let round = 0;
    const recentLosses = {};

    while (true) {
      if (!runRef.current) break;

      // apply any mid-game removals (handleRemove called while loop was running)
      if (removedIdsRef.current.size > 0) {
        pList = pList.map(p =>
          removedIdsRef.current.has(p.id) ? {...p, eliminated:true} : p
        );
        removedIdsRef.current = new Set(); // clear after applying
      }

      // inject pending custom agent
      const pending = pendingRef.current;
      if (pending) {
        const enter = pending.entryTrigger==="immediate"||(pending.entryTrigger==="next"&&round>0);
        if (enter) {
          // Only add to pList if not already there (players state already has them as _queued)
          if (!pList.find(x => x.id === pending.id)) {
            pList=[...pList,{...pending,chips:pending.buyIn||1500,holeCards:[],
              folded:false,eliminated:false,currentBet:0,thought:"Joining...",
              thinking:false,lastAction:null,stats:{...DEFAULT_STATS}}];
          } else {
            // Already in pList as _queued — remove the flag so they play normally
            pList = pList.map(p => p.id===pending.id ? {...p, _queued:false, folded:false, thought:"Ready."} : p);
          }
          // Remove _queued flag from React players state too
          setPlayers(prev => prev ? prev.map(p => p.id===pending.id ? {...p, _queued:false, folded:false, thought:"Ready."} : p) : prev);
          setPendingAgent(null); pendingRef.current=null;
        }
      }

      const active = pList.filter(p=>!p.eliminated);
      if (active.length<=1) {
        const w=active[0];
        setChampion(w); setGameOver(true);
        addLog(`▶ TOURNAMENT OVER — ${w?.name} DOMINATES`,w?.color||"#00f5ff");
        if (gid&&w) await apiPatch(`/games/${gid}/end`,{winner_name:w.name,total_rounds:round});
        break;
      }
      if (round>50) {
        const w=[...active].sort((a,b)=>b.chips-a.chips)[0];
        setChampion(w); setGameOver(true);
        addLog(`▶ MAX ROUNDS — ${w.name} LEADS`,w.color);
        if (gid) await apiPatch(`/games/${gid}/end`,{winner_name:w.name,total_rounds:round});
        break;
      }

      round++; setRoundNum(round);

      // custom agent exit check
      const exitingIds=[];
      pList=pList.map(p=>{
        if (!p.isCustom||p.eliminated) return p;
        if (p.exitCondition==="chips_below"&&p.chips<p.exitValue){exitingIds.push(p.id);addLog(`◈ ${p.name} EXITS (chips low)`,"#ffd700");return{...p,eliminated:true};}
        if (p.exitCondition==="chips_above"&&p.chips>p.exitValue){exitingIds.push(p.id);addLog(`◈ ${p.name} EXITS (profit!)`,"#ffd700");return{...p,eliminated:true};}
        return p;
      });
      if (exitingIds.length>0) setAgentsList(prev=>prev.filter(a=>!exitingIds.includes(a.id)));

      let deck = createDeck();
      let comm = [];
      setLiveHandLog([]); // clear log for new hand
      pList = pList.map(p=>({...p,holeCards:[],folded:p.eliminated,currentBet:0,lastAction:null}));

      const seatIds = pList.filter(p=>!p.eliminated && !p._queued).map(p=>p.id);
      if (seatIds.length<2) break;

      // Dealer rotates by finding next seat after last dealer (stable when players join/leave)
      const lastDealerId = pList.find(p=>p._wasDealer)?.id ?? null;
      let dealerPos;
      if (lastDealerId && seatIds.includes(lastDealerId)) {
        dealerPos = (seatIds.indexOf(lastDealerId) + 1) % seatIds.length;
      } else {
        dealerPos = (round-1) % seatIds.length;
      }
      // Mark new dealer
      pList = pList.map(p => ({...p, _wasDealer: p.id === seatIds[dealerPos]}));

      // Heads-up rule: dealer = SB, other player = BB
      // 3+ players: SB = dealer+1, BB = dealer+2 (standard)
      const headsUp = seatIds.length === 2;
      const sbPos   = headsUp ? dealerPos : (dealerPos+1)%seatIds.length;
      const bbPos   = headsUp ? (dealerPos+1)%seatIds.length : (dealerPos+2)%seatIds.length;
      const _sbId   = seatIds[sbPos];
      const _bbId   = seatIds[bbPos];
      setSbId(_sbId); setBbId(_bbId);

      // Pre-flop: action starts left of BB (UTG). Heads-up: dealer/SB acts first preflop.
      // Post-flop: action starts left of dealer (SB in 3+, BB in heads-up).
      const preFlopOrder = headsUp
        ? [seatIds[sbPos], seatIds[bbPos]]  // heads-up: SB acts first preflop
        : [...Array(seatIds.length).keys()].map(i=>seatIds[(bbPos+1+i)%seatIds.length]);
      const postFlopOrder = headsUp
        ? [seatIds[bbPos], seatIds[sbPos]]  // heads-up post-flop: BB acts first
        : [...Array(seatIds.length).keys()].map(i=>seatIds[(dealerPos+1+i)%seatIds.length]);
      setDealerIdx(dealerPos);

      // Post blinds — capped at player chips (short stack all-in blind)
      const sbPost = Math.min(SB, pList.find(p=>p.id===_sbId)?.chips||0);
      const bbPost = Math.min(BB, pList.find(p=>p.id===_bbId)?.chips||0);
      pList = pList.map(p=>{
        if (p.id===_sbId) return{...p,chips:p.chips-sbPost,currentBet:sbPost};
        if (p.id===_bbId) return{...p,chips:p.chips-bbPost,currentBet:bbPost};
        return p;
      });
      let curPot = sbPost + bbPost;
      // Log blind posts as first entries of this hand
      setLiveHandLog([
        { agent_name: pList.find(p=>p.id===_sbId)?.name||"SB", action:"blind", amount:sbPost, thought:"Posts small blind.", color:pList.find(p=>p.id===_sbId)?.color||"#fb923c", icon:pList.find(p=>p.id===_sbId)?.icon||"◈", street:"PRE-FLOP", isBlind:true, role:"SB" },
        { agent_name: pList.find(p=>p.id===_bbId)?.name||"BB", action:"blind", amount:bbPost, thought:"Posts big blind.",   color:pList.find(p=>p.id===_bbId)?.color||"#4ade80", icon:pList.find(p=>p.id===_bbId)?.icon||"◈", street:"PRE-FLOP", isBlind:true, role:"BB" },
      ]);
      await sleep(speedRef.current*0.3);

      // deal hole cards
      pList = pList.map(p=>p.eliminated||p.folded?p:{...p,holeCards:[deck.pop(),deck.pop()]});
      setPlayers([...pList]); setCommunity([]); setPot(curPot); setShowCards(false);
      await sleep(speedRef.current*0.4);

      const roundActions=[];

      // Per-street LLM cache: one call per player per street max
      const llmStreetCache = {}; // key: `${playerId}_${street}`

      for (const ph of ["PRE-FLOP","FLOP","TURN","RIVER"]) {
        if (!runRef.current) break;
        setPhase(ph);
        // Burn one card before each community street (standard poker rule)
        if (ph==="FLOP")  { deck.pop(); comm=[deck.pop(),deck.pop(),deck.pop()]; }
        if (ph==="TURN")  { deck.pop(); comm=[...comm,deck.pop()]; }
        if (ph==="RIVER") { deck.pop(); comm=[...comm,deck.pop()]; }
        setCommunity([...comm]);
        await sleep(speedRef.current*0.35);

        // ── Who can still act this street? ──────────────────────────────────
        // Active = not folded, not eliminated, still has chips OR is all-in but
        // all-in players CANNOT act — they just wait for showdown.
        // Only players with chips > 0 AND not folded/eliminated act.
        const canAct = id => {
          const p = pList.find(x=>x.id===id);
          return p && !p.folded && !p.eliminated && p.chips > 0;
        };

        const actionOrder = ph==="PRE-FLOP" ? preFlopOrder : postFlopOrder;

        // Build ordered list of seat ids for this street (only those who CAN act)
        const streetSeats = actionOrder.filter(id => canAct(id));
        // If nobody can act (all all-in or folded) — still deal community cards
        // but skip betting. Use continue NOT break so FLOP/TURN/RIVER still dealt.
        const contendingCount = pList.filter(p=>!p.folded&&!p.eliminated).length;
        if (contendingCount <= 1) break; // only one player left — hand over
        if (streetSeats.length < 1) continue; // all-in runout: deal cards, skip betting

        // ── Pre-flop special: BB already put in BB chips, but gets option ──
        // roundMax starts at BB for preflop (blinds already posted)
        // Pre-flop: roundMax = what BB actually posted (may be less if short-stacked)
        let roundMax = ph==="PRE-FLOP"
          ? (pList.find(p=>p.id===_bbId)?.currentBet || BB)
          : 0;
        // Minimum raise = last raise increment (starts at BB preflop, 1 chip post-flop)
        let minRaiseSize = ph==="PRE-FLOP" ? BB : 1;

        // Reset currentBet for post-flop streets
        if (ph !== "PRE-FLOP") {
          pList = pList.map(p=>({...p, currentBet:0}));
          roundMax = 0;
        }

        // ── Betting loop ─────────────────────────────────────────────────────
        // Rules:
        // 1. Each player acts once per cycle in clockwise order
        // 2. When someone raises, everyone ELSE gets one more action (re-queue)
        //    but the raiser does NOT act again until someone raises after them
        // 3. Max 4 bets per street (1 bet + 3 raises) — standard casino rule
        // 4. Street ends when queue is empty (everyone called/checked/folded)
        // 5. Pre-flop: BB gets option last even if nobody raised

        // Build initial action queue in clockwise order
        // Pre-flop: everyone acts in order UTG → ... → SB → BB
        // BB goes LAST so they get the option (can raise even if everyone called)
        // SB is NOT removed — they posted the blind but still need to act
        let actionQueue;
        if (ph === "PRE-FLOP") {
          // streetSeats is already in preFlopOrder (UTG first)
          // Just ensure BB is at the end for the option
          const bbInSeats = streetSeats.filter(id => id === _bbId);
          const notBB     = streetSeats.filter(id => id !== _bbId);
          actionQueue = [...notBB, ...bbInSeats];
        } else {
          actionQueue = [...streetSeats];
        }

        let lastRaiserId = null;
        let betCount = 0; // track bet+raise count for cap enforcement
        // Heads-up (2 players): no bet cap — unlimited raising allowed
        // 3+ players: standard 4-bet cap (1 open + 3 raises)
        const activePlayers = pList.filter(p=>!p.eliminated).length;
        const BET_CAP = activePlayers <= 2 ? Infinity : 4;

        while (actionQueue.length > 0) {
          if (!runRef.current) break;

          // Remove players who can no longer act (folded/all-in/eliminated)
          actionQueue = actionQueue.filter(id => canAct(id));
          if (actionQueue.length === 0) break;

          // If only one contender left, stop
          const activePot = pList.filter(p=>!p.folded&&!p.eliminated);
          if (activePot.length <= 1) break;

          const pid = actionQueue.shift(); // dequeue next player
          if (!canAct(pid)) continue;

          const player = pList.find(p=>p.id===pid);
          const callAmt = Math.max(0, roundMax - player.currentBet);

          // ── Player acts ──────────────────────────────────────────────────
          setActivePlayerId(pid);
          pList = pList.map(p=>p.id===pid?{...p,thinking:true}:p);
          setPlayers([...pList]);
          await sleep(speedRef.current*0.35 + Math.random()*180);

          let dec;
          const assignedProvider = agentLLMRef.current[player.id];
          const hasLLMKey = assignedProvider && !!apiKeysRef.current[assignedProvider];

          if (assignedProvider && hasLLMKey) {
            // Per-hand cache: call LLM once per hand, reuse decision all streets
            // This keeps API calls to 1/hand max — safe even on free tier (3 req/min)
            const cacheKey = `${player.id}_${ph}`;
            if (llmStreetCache[cacheKey]) {
              dec = llmStreetCache[cacheKey];
            } else {
              const llmResult = await llmDecide(
                {...player, llmProvider:assignedProvider},
                player.holeCards, comm,
                { pot:curPot, callAmount:callAmt, chips:player.chips,
                  numOpponents:pList.filter(p=>!p.folded&&!p.eliminated&&p.id!==player.id).length,
                  phase:ph, round },
                apiKeysRef.current
              );
              if (llmResult && !llmResult._error) {
                dec = llmResult;
                llmStreetCache[cacheKey] = llmResult; // cache within this street only
              }
            }
            // _rateLimited or any error: silent fallback, no log noise
          }

          if (!dec) {
            dec = agentDecide(player, player.holeCards, comm, {
              pot:curPot, callAmount:callAmt, chips:player.chips,
              lastActions:pList.map(p=>({action:p.lastAction})),
              recentLosses:recentLosses[player.name]||0,
              numOpponents:pList.filter(p=>!p.folded&&!p.eliminated&&p.id!==player.id).length,
            });
          }

          // ── Apply decision ────────────────────────────────────────────────
          let potAdd = 0;
          let up = { ...player, thinking:false, thought:dec.thought, lastAction:dec.action };

          // ── Validate + fix illegal actions ──────────────────────────────
          // Free check fix: if agent says "check" but there's a bet to call → call or fold
          if (dec.action === "check" && callAmt > 0) {
            dec = { ...dec, action: callAmt <= player.chips * 0.15 ? "call" : "fold",
              thought: dec.thought + " [auto-corrected]" };
          }
          // Prevent folding for free
          if (dec.action === "fold" && callAmt === 0) {
            dec = { ...dec, action: "check", thought: dec.thought + " [check instead]" };
          }
          // Short-stack: can't cover call → go all-in instead of folding
          if (dec.action === "call" && callAmt > player.chips) {
            dec = { ...dec, action: "call", amount: player.chips, thought: "All-in." };
          }

          // ── Enforce bet cap: convert raise to call if cap already reached ──
          if (dec.action === "raise" && betCount >= BET_CAP) {
            dec = { ...dec, action: "call", thought: dec.thought + " [cap reached]" };
            up.thought = dec.thought;
            up.lastAction = "call";
          }

          if (dec.action === "fold") {
            up.folded = true;

          } else if (dec.action === "check") {
            // callAmt guaranteed 0 here

          } else if (dec.action === "call") {
            const pay = Math.min(player.chips, callAmt);
            up.chips       = player.chips - pay;
            up.currentBet  = player.currentBet + pay;
            potAdd = pay;
            if (up.chips === 0) { up.lastAction = "all-in"; up.folded = false; }

          } else if (dec.action === "raise") {
            const minTotal = roundMax + minRaiseSize;
            const raiseTotal = Math.min(
              player.chips,
              Math.max(dec.amount, minTotal - player.currentBet)
            );
            up.chips      = player.chips - raiseTotal;
            up.currentBet = player.currentBet + raiseTotal;
            potAdd = raiseTotal;
            if (up.currentBet > roundMax) {
              minRaiseSize = up.currentBet - roundMax;
              roundMax = up.currentBet;
              betCount++;
              lastRaiserId = pid;
              if (betCount < BET_CAP) {
                // Re-open: give every OTHER active player one more action, in clockwise order
                // Preserve seat order, start from player after raiser, exclude raiser
                const raiserPos = streetSeats.indexOf(pid);
                actionQueue = [
                  ...streetSeats.slice(raiserPos + 1),
                  ...streetSeats.slice(0, raiserPos),
                ].filter(id => id !== pid && canAct(id));
              } else {
                // Bet cap reached — no more raises allowed, drain remaining callers
                actionQueue = streetSeats
                  .filter(id => id !== pid && canAct(id) && Math.max(0, roundMax - (pList.find(p=>p.id===id)?.currentBet||0)) > 0);
              }
            } else {
              // Short stack couldn't raise — treat as call
              up.lastAction = "call";
            }
            if (up.chips === 0) up.lastAction = "all-in";
          }

          pList    = pList.map(p=>p.id===pid ? up : p);
          curPot  += potAdd;
          setPot(curPot);
          setPlayers([...pList]);
          const currentStreet = ph; // explicit capture — avoids any closure ambiguity
          const actionEntry = {
            agent_name: player.name, action: dec.action,
            amount: dec.action==="raise" ? potAdd : dec.action==="call" ? potAdd : 0,
            thought: dec.thought, color: player.color, icon: player.icon,
            hole_cards: player.holeCards, hand_rank: null, street: currentStreet,
          };
          roundActions.push(actionEntry);
          setLiveHandLog(prev => [...prev, actionEntry]); // update live log
          await sleep(speedRef.current*0.55);

        } // end betting while

        // Reset currentBet for next street
        pList = pList.map(p=>({...p, currentBet:0}));

        const stillIn = pList.filter(p=>!p.folded&&!p.eliminated);
        if (stillIn.length <= 1) break;
      } // end streets for

      // showdown
      setPhase("SHOWDOWN"); setShowCards(true); setActivePlayerId(null);
      await sleep(speedRef.current*0.3);

      const contenders=pList.filter(p=>!p.folded&&!p.eliminated);
      // Safety: if somehow everyone folded, last non-eliminated player wins
      const showdownPool = contenders.length > 0
        ? contenders
        : pList.filter(p=>!p.eliminated);
      let roundWinner = showdownPool[0] || pList[0];
      let winnerHand = "—";
      if (showdownPool.length > 1) {
        let best = -1;
        for (const p of showdownPool) {
          const all = [...(p.holeCards||[]), ...comm];
          if (all.length >= 5) {
            const s = evaluateHand(all);
            if (s && s.value > best) { best = s.value; roundWinner = p; winnerHand = s.name; }
          }
        }
      } else if (showdownPool.length === 1) {
        const p = showdownPool[0];
        const all = [...(p.holeCards||[]), ...comm];
        if (all.length >= 5) { const s = evaluateHand(all); if (s) winnerHand = s.name; }
      }
      // Annotate hand ranks in actions
      for (const p of showdownPool) {
        const all = [...(p.holeCards||[]), ...comm];
        const hr = all.length >= 5 ? evaluateHand(all) : null;
        const idx = roundActions.findLastIndex(a=>a.agent_name===p.name);
        if (idx >= 0) roundActions[idx].hand_rank = hr?.name || "—";
      }

      // ── Side pot calculation ──────────────────────────────────────────────
      // Each player can only win as much as they put in, times the number of players
      // who matched that amount. Excess goes to next-best hand.
      const potContribs = {}; // playerId -> total contributed this hand
      for (const a of roundActions) {
        const p = pList.find(x=>x.name===a.agent_name);
        if (p) potContribs[p.id] = (potContribs[p.id]||0) + (a.amount||0);
      }
      // Add blind contributions not in roundActions
      potContribs[_sbId] = (potContribs[_sbId]||0) + sbPost;
      potContribs[_bbId] = (potContribs[_bbId]||0) + bbPost;

      // Build side pots: sorted by contribution level
      const allContribs = Object.entries(potContribs).map(([id,amt])=>({id:Number(id),amt}))
        .filter(x=>x.amt>0).sort((a,b)=>a.amt-b.amt);
      let pots = []; // [{amount, eligibleIds}]
      let prevLevel = 0;
      for (const {id, amt} of allContribs) {
        if (amt > prevLevel) {
          const level = amt;
          const potSlice = (level - prevLevel) * allContribs.filter(x=>x.amt>=level).length;
          const eligible = pList.filter(p=>!p.folded&&!p.eliminated&&(potContribs[p.id]||0)>=level).map(p=>p.id);
          if (potSlice > 0 && eligible.length > 0) pots.push({amount:potSlice, eligibleIds:eligible});
          prevLevel = level;
        }
      }
      // Any remaining pot amount goes to all non-folded players
      const totalInPots = pots.reduce((a,p)=>a+p.amount,0);
      if (curPot > totalInPots) pots.push({amount:curPot-totalInPots, eligibleIds:pList.filter(p=>!p.folded&&!p.eliminated).map(p=>p.id)});
      if (pots.length === 0) pots = [{amount:curPot, eligibleIds:pList.filter(p=>!p.folded&&!p.eliminated).map(p=>p.id)}];

      // Award each pot to best hand among eligible players
      const chipsWon = {}; // playerId -> chips won
      for (const pot of pots) {
        const eligible = showdownPool.filter(p=>pot.eligibleIds.includes(p.id));
        if (eligible.length === 0) continue;
        let potWinner = eligible[0];
        let best = -1;
        for (const p of eligible) {
          const all = [...(p.holeCards||[]), ...comm];
          if (all.length >= 5) { const s = evaluateHand(all); if (s && s.value > best) { best=s.value; potWinner=p; } }
        }
        chipsWon[potWinner.id] = (chipsWon[potWinner.id]||0) + pot.amount;
      }
      // If no side pot calc worked, fallback to roundWinner takes all
      if (Object.keys(chipsWon).length === 0) chipsWon[roundWinner?.id] = curPot;

      // update stats + chips
      pList=pList.map(p=>{
        const isW = roundWinner && p.id===roundWinner.id;
        const ns={...p.stats};
        if(isW) ns.wins=(ns.wins||0)+1; else if(!p.eliminated) ns.losses=(ns.losses||0)+1;
        if(p.folded&&!p.eliminated) ns.folds=(ns.folds||0)+1;
        const myA=roundActions.filter(a=>a.agent_name===p.name);
        ns.raises=(ns.raises||0)+myA.filter(a=>a.action==="raise").length;
        ns.calls=(ns.calls||0)+myA.filter(a=>a.action==="call"||a.action==="check").length;
        return{...p, chips:p.chips+(chipsWon[p.id]||0), stats:ns};
      });

      for (const p of pList.filter(p=>p.id!==roundWinner?.id&&!p.eliminated))
        recentLosses[p.name]=(recentLosses[p.name]||0)+1;
      if(roundWinner) recentLosses[roundWinner.name]=0;

      const foldedNames=roundActions.filter(a=>a.action==="fold").map(a=>a.agent_name);
      addLog({type:"round",round,winner:roundWinner?.name,winnerColor:roundWinner?.color,
        winnerIcon:roundWinner?.icon,hand:winnerHand,pot:curPot,
        folded:foldedNames,community:comm.map(c=>c.rank+c.suit)});

      // ── build hand history record ─────────────────────────────────────────
      const dealerPlayer = pList.find(p=>p.id===seatIds[dealerPos]);
      const sbPlayer     = pList.find(p=>p.id===_sbId);
      const bbPlayer     = pList.find(p=>p.id===_bbId);

      const handRecord = {
        round,
        pot: curPot,
        phase: "SHOWDOWN",
        winner: roundWinner?.name,
        winnerColor: roundWinner?.color,
        winnerIcon: roundWinner?.icon,
        hand: winnerHand,
        community: comm.map(c=>c.rank+c.suit),
        dealer: dealerPlayer?.name || seatIds[dealerPos] || null,
        sb: sbPlayer?.name || _sbId || null,
        bb: bbPlayer?.name || _bbId || null,
        actions: roundActions, // full ordered action log for event timeline
        players: pList.filter(p=>!p.eliminated||roundActions.some(a=>a.agent_name===p.name)).map(p=>{
          const myActions = roundActions.filter(a=>a.agent_name===p.name);
          const streetActions = myActions.map(a=>({
            street: a.street||"PRE-FLOP",
            action: a.action,
            amount: a.amount||0,
          }));
          const lastThought = myActions[myActions.length-1]?.thought||"";
          const holeCards = p.holeCards?.map(c=>c.rank+c.suit)||[];
          const hr = p.holeCards?.length>=2 ? evaluateHand([...p.holeCards,...comm])?.name||"" : "";
          return {
            name: p.name, icon: p.icon, color: p.color,
            holeCards, handRank: hr,
            folded: p.folded||false,
            won: p.id===roundWinner?.id,
            streetActions,
            thought: lastThought,
          };
        }),
      };
      setHandHistory(prev=>[...prev, handRecord]);

      pList=pList.map(p=>({...p,eliminated:p.eliminated||p.chips<=0,folded:false,currentBet:0}));
      setPlayers([...pList]); setPot(0);

      if (gid) await apiPost(`/games/${gid}/rounds`,{
        round_number:round,winner_name:roundWinner?.name||"unknown",
        pot_size:curPot,community_cards:comm,actions:roundActions,
      });

      await sleep(speedRef.current*0.4);

      // ── Pause check — only between complete hands ─────────────────────────
      if (pauseRef.current) {
        setRunning(false);
        setPaused(true);
        addLog("⏸ PAUSED — hand complete. Click RESUME to continue.", "#ff9944");
        // Wait until unpaused (pauseRef cleared) or stopped (runRef cleared)
        await new Promise(resolve => {
          const check = setInterval(() => {
            // Inject pending agent into local pList (players state already updated)
            const p = pendingRef.current;
            if (p && !pList.find(x => x.id === p.id)) {
              pList=[...pList,{...p,chips:p.buyIn||1500,holeCards:[],
                folded:false,eliminated:false,currentBet:0,thought:"Joining...",
                thinking:false,lastAction:null,stats:{...DEFAULT_STATS}}];
              setPendingAgent(null); pendingRef.current=null;
            } else if (p) {
              setPendingAgent(null); pendingRef.current=null; // already added
            }
            if (!pauseRef.current || !runRef.current) {
              clearInterval(check);
              resolve();
            }
          }, 200);
        });
        setPaused(false);
        if (!runRef.current) break; // reset was clicked while paused
        pauseRef.current = false;
        setRunning(true);
        addLog("▶ RESUMED", "#00f5ff");
      }
    }
    runRef.current=false; setRunning(false);
  },[agentsList,initPlayers,addLog]);

  const handleReset = async () => {
    runRef.current=false;
    pauseRef.current=false;
    setPaused(false);
    if (gameId&&roundNum>0) {
      const winner=champion?.name||(players?[...players].sort((a,b)=>b.chips-a.chips)[0]?.name:"unknown");
      await apiPatch(`/games/${gameId}/end`,{winner_name:winner||"unknown",total_rounds:roundNum});
    }
    setRunning(false);setPlayers(null);setLogs([]);setRoundNum(0);setHandNum(0);setHandHistory([]);
    setGameOver(false);setChampion(null);setPhase("STANDBY");
    setCommunity([]);setPot(0);setShowCards(false);setGameId(null);
    setPendingAgent(null);pendingRef.current=null;removedIdsRef.current=new Set();setAgentsList(DEFAULT_AGENTS);
    setSbId(null);setBbId(null);setActivePlayerId(null);
  };

  const loadSessions = async () => {
    setLoadingSess(true);
    try{const r=await fetch(`${API}/games?limit=50`);const data=await r.json();setSessions(data);}catch{}
    setLoadingSess(false);
  };

  const loadRounds = async (gid) => {
    setSelSession(gid); setSelRounds([]);
    try{const r=await fetch(`${API}/games/${gid}/rounds`);const data=await r.json();setSelRounds(data);}catch{}
  };

  const deployCustom = () => {
    if (customCount>=2){addLog("◈ TABLE FULL — max 2 custom agents","#ff4444");setShowBuilder(false);return;}
    const agent={...custom,id:Date.now(),isCustom:true};

    if (!running && !paused) {
      // Game not started — seat immediately, pod shows as Ready
      setAgentsList(prev=>[...prev,agent]);
      setPlayers(prev => {
        const base = prev || initPlayers(agentsList);
        return [...base, {...agent, chips:agent.buyIn||1500, holeCards:[], folded:false,
          eliminated:false, currentBet:0, thought:"Ready.", thinking:false,
          lastAction:null, stats:{...DEFAULT_STATS}}];
      });
      addLog(`◈ ${agent.name} seated at table`,"#ffd700");
    } else {
      // Game running or paused — always queue for next hand boundary
      // Pod shows immediately as "NEXT HAND" but agent is NOT in pList yet
      // Game loop injects at top of next hand iteration via pendingRef
      setAgentsList(prev=>[...prev,agent]);
      setPendingAgent(agent);
      pendingRef.current = agent;
      // Show pod in UI as queued (no hole cards, thought = waiting)
      setPlayers(prev => prev ? [...prev, {
        ...agent, chips:agent.buyIn||1500, holeCards:[], folded:true,
        eliminated:false, currentBet:0, thought:"Waiting for next hand...",
        thinking:false, lastAction:"queue", stats:{...DEFAULT_STATS},
        _queued:true, // flag so game loop knows this pod is display-only
      }] : prev);
      addLog(`◈ ${agent.name} queued — joins next hand`,"#ffd700");
    }
    setShowBuilder(false);
  };

  const handleRename=(id,n)=>{setPlayers(prev=>prev?.map(p=>p.id===id?{...p,name:n}:p));setAgentsList(prev=>prev.map(a=>a.id===id?{...a,name:n}:a));};
  const handleRemove=(id)=>{
    setPlayers(prev=>prev?prev.filter(p=>p.id!==id):prev);
    setAgentsList(prev=>prev.filter(a=>a.id!==id));
    if(pendingRef.current?.id===id){setPendingAgent(null);pendingRef.current=null;}
    removedIdsRef.current.add(id); // signal game loop to eliminate this player
    addLog("◈ Agent removed from table","#ff9944");
  };

  const customCount = agentsList.filter(a=>a.isCustom).length;
  // Merge live players with any custom agents in agentsList not yet in players state
  const basePlayers = players || initPlayers(agentsList);
  const allPlayers = basePlayers.filter(p => !p.eliminated);
  const anyLLMActive = Object.values(agentLLM).some(v=>v) && Object.values(apiKeys).some(v=>v);

  return (
    <div style={{background:"#020b14",minHeight:"100vh",
      fontFamily:"'Courier New',monospace",color:"#a0b4c8",overflow:"hidden",position:"relative",display:"flex",flexDirection:"column",height:"100vh"}}>

      {/* scanlines */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:1,
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)"}}/>

      {/* ── HEADER ── */}
      <div style={{borderBottom:"1px solid #091e30",padding:"10px 20px",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        background:"rgba(0,5,14,0.97)",position:"relative",zIndex:10}}>

        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{color:"#00f5ff",fontSize:22,letterSpacing:4,fontWeight:"bold"}}>POKER//AGENTS</span>

          {/* tabs */}
          {[["table","◈ TABLE"],["sessions","◉ SESSIONS"]].map(([tab,label])=>(
            <button key={tab} onClick={()=>{setActiveTab(tab);if(tab==="sessions")loadSessions();}}
              style={{background:activeTab===tab?"rgba(0,245,255,0.1)":"transparent",
                border:`1px solid ${activeTab===tab?"#00f5ff55":"#0a2030"}`,
                color:activeTab===tab?"#00f5ff":"#3a6070",
                padding:"4px 12px",cursor:"pointer",fontSize:12,letterSpacing:2,fontFamily:"inherit"}}>
              {label}
            </button>
          ))}

          <span style={{background:running?"rgba(0,245,255,0.07)":"rgba(255,100,50,0.07)",
            border:`1px solid ${running?"#00f5ff44":"#ff643244"}`,
            color:running?"#00f5ff":"#ff6432",fontSize:12,padding:"3px 10px",letterSpacing:2}}>
            {running?"● LIVE":"○ IDLE"}
          </span>
          {phase!=="STANDBY"&&<span style={{background:`rgba(120,80,200,0.1)`,border:"1px solid #7050c044",
            color:"#a070e0",fontSize:12,padding:"3px 10px",letterSpacing:2}}>{phase}</span>}
          {roundNum>0&&<span style={{color:"#4a8aaa",fontSize:13}}>HAND {roundNum}</span>}
          {handHistory.length>0&&<span style={{color:"#7a9ab0",fontSize:11,
            background:"rgba(0,245,255,0.05)",border:"1px solid #00f5ff22",padding:"2px 8px",letterSpacing:1}}>
            {handHistory.length} HANDS PLAYED
          </span>}
          {sbId&&<span style={{color:"#fb923c88",fontSize:11}}>SB: {allPlayers.find(p=>p.id===sbId)?.name||"?"}</span>}
          {bbId&&<span style={{color:"#4ade8088",fontSize:11}}>BB: {allPlayers.find(p=>p.id===bbId)?.name||"?"}</span>}
          {pendingAgent&&<span style={{color:"#ffd700aa",fontSize:12,letterSpacing:1}}>◈ {pendingAgent.name} QUEUED</span>}

          {/* AI config button */}
          <button onClick={()=>setShowLLMPanel(v=>!v)}
            style={{background:anyLLMActive?"rgba(192,132,252,0.12)":showLLMPanel?"rgba(0,245,255,0.08)":"rgba(255,215,0,0.05)",
              border:`1px solid ${anyLLMActive?"#c084fc55":showLLMPanel?"#00f5ff44":"#ffd70033"}`,
              color:anyLLMActive?"#c084fc":showLLMPanel?"#00f5ff":"#ffd70088",
              padding:"3px 10px",cursor:"pointer",fontSize:11,letterSpacing:1,fontFamily:"inherit"}}>
            {anyLLMActive?"⚙ GROQ: ACTIVE":"⚙ GROQ CONFIG"}
          </button>
        </div>

        <div style={{display:"flex",gap:7,alignItems:"center"}}>
          <span style={{fontSize:13,color:"#4a7080"}}>SPEED</span>
          {[["SLOW",6000],["MED",4500],["FAST",3000]].map(([l,v])=>(
            <button key={l} onClick={()=>setSpeed(v)}
              style={{background:speed===v?"rgba(0,245,255,0.1)":"transparent",
                border:`1px solid ${speed===v?"#00f5ff44":"#0a1e30"}`,
                color:speed===v?"#00f5ff":"#5a8090",
                padding:"4px 12px",cursor:"pointer",fontSize:13,letterSpacing:1,fontFamily:"inherit"}}>{l}</button>
          ))}
          <div style={{width:1,height:16,background:"#0a1e30",margin:"0 3px"}}/>
          {!running&&!paused&&!gameOver&&(
            <button onClick={runGame}
              style={{background:"rgba(0,245,255,0.08)",border:"1px solid #00f5ff44",
                color:"#00f5ff",padding:"6px 18px",cursor:"pointer",
                fontSize:13,letterSpacing:2,fontFamily:"inherit"}}>▶ RUN</button>
          )}
          {running&&!pauseRef.current&&(
            <button onClick={()=>{ pauseRef.current = true; }}
              style={{background:"rgba(255,150,50,0.08)",border:"1px solid #ff993333",
                color:"#ff9933",padding:"6px 18px",cursor:"pointer",
                fontSize:13,letterSpacing:2,fontFamily:"inherit"}}>⏸ PAUSE AFTER HAND</button>
          )}
          {running&&pauseRef.current&&(
            <button disabled
              style={{background:"rgba(255,150,50,0.04)",border:"1px solid #ff993322",
                color:"#ff993366",padding:"6px 18px",cursor:"default",
                fontSize:13,letterSpacing:2,fontFamily:"inherit"}}>⏸ PAUSING...</button>
          )}
          {paused&&(
            <button onClick={()=>{ pauseRef.current = false; }}
              style={{background:"rgba(0,245,255,0.08)",border:"1px solid #00f5ff44",
                color:"#00f5ff",padding:"6px 18px",cursor:"pointer",
                fontSize:13,letterSpacing:2,fontFamily:"inherit"}}>▶ RESUME</button>
          )}
          {(gameOver||(!running&&players))&&(
            <button onClick={handleReset}
              style={{background:"rgba(50,50,50,0.1)",border:"1px solid #0a1e30",
                color:"#667788",padding:"6px 18px",cursor:"pointer",
                fontSize:13,letterSpacing:2,fontFamily:"inherit"}}>↺ RESET</button>
          )}

          {players&&(
            <button onClick={()=>setShowCards(v=>!v)}
              style={{background:showCards?"rgba(255,215,0,0.12)":"rgba(255,215,0,0.03)",
                border:`1px solid ${showCards?"#ffd70088":"#ffd70022"}`,
                color:showCards?"#ffd700":"#ffd70055",
                padding:"6px 14px",cursor:"pointer",fontSize:13,letterSpacing:1,fontFamily:"inherit",
                transition:"all 0.2s"}}>
              {showCards?"🂠 HIDE CARDS":"🂠 REVEAL CARDS"}
            </button>
          )}
          <div style={{width:1,height:16,background:"#0a1e30",margin:"0 3px"}}/>
          <button onClick={()=>customCount<2&&setShowBuilder(!showBuilder)}
            style={{background:customCount>=2?"rgba(80,0,0,0.1)":showBuilder?"rgba(255,215,0,0.1)":"rgba(255,215,0,0.04)",
              border:`1px solid ${customCount>=2?"#ff444444":showBuilder?"#ffd70066":"#ffd70022"}`,
              color:customCount>=2?"#ff6666":showBuilder?"#ffd700":"#ffd70088",
              padding:"6px 14px",cursor:customCount>=2?"not-allowed":"pointer",
              fontSize:13,letterSpacing:1,fontFamily:"inherit"}}>
            {customCount>=2?"◈ TABLE FULL":`+ DEPLOY AGENT (${customCount}/2)`}
          </button>
        </div>
      </div>

      {/* API key input dropdown */}
      {/* ── LLM CONFIG PANEL ── */}
      {showLLMPanel&&(
        <div style={{position:"absolute",top:51,left:0,right:0,zIndex:50,
          background:"rgba(0,3,12,0.99)",borderBottom:"2px solid #0d2035",
          padding:"16px 24px"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:32,flexWrap:"wrap"}}>

            {/* Left: per-agent LLM assignment */}
            <div style={{minWidth:320}}>
              <div style={{fontSize:12,letterSpacing:3,color:"#ffd700",marginBottom:12}}>
                ⚙ ASSIGN AI TO AGENTS
              </div>
              <div style={{fontSize:11,color:"#3a5060",marginBottom:10,lineHeight:1.5}}>
                Choose an LLM provider per agent. If no key is set for a provider,<br/>
                that agent plays with its built-in hardcoded strategy instead.
              </div>
              {DEFAULT_AGENTS.map(agent=>{
                const assigned = agentLLM[agent.id] || null;
                return (
                  <div key={agent.id} style={{display:"flex",alignItems:"center",gap:8,
                    marginBottom:8,padding:"8px 10px",
                    background:"rgba(0,10,25,0.7)",border:"1px solid #0a1e30",borderRadius:3}}>
                    <span style={{color:agent.color,fontSize:15,width:20}}>{agent.icon}</span>
                    <span style={{fontSize:13,color:agent.color,fontWeight:"bold",
                      letterSpacing:1,width:70}}>{agent.name}</span>
                    <span style={{fontSize:11,color:"#3a6070",flex:1}}>{agent.role}</span>
                    {/* provider buttons */}
                    <div style={{display:"flex",gap:4}}>
                      {["groq"].map(prov=>{
                        const cfg = LLM_PROVIDERS[prov];
                        const hasKey = !!apiKeys[prov];
                        const active = assigned===prov;
                        return (
                          <button key={prov} onClick={()=>setAgentProvider(agent.id, active?null:prov)}
                            title={hasKey?`${cfg.label} — key set`:`${cfg.label} — no key`}
                            style={{padding:"3px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit",
                              letterSpacing:1,
                              background:active?`${cfg.color}22`:"transparent",
                              border:`1px solid ${active?cfg.color:hasKey?cfg.color+"44":"#1a3040"}`,
                              color:active?cfg.color:hasKey?cfg.color+"88":"#2a4050",
                              position:"relative"}}>
                            "GROQ"
                            {hasKey&&<span style={{position:"absolute",top:-3,right:-3,
                              width:6,height:6,borderRadius:"50%",background:cfg.color}}/>}
                          </button>
                        );
                      })}
                      <button onClick={()=>setAgentProvider(agent.id,null)}
                        title="Use built-in hardcoded logic"
                        style={{padding:"3px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit",
                          letterSpacing:1,
                          background:!assigned?"rgba(255,255,255,0.05)":"transparent",
                          border:`1px solid ${!assigned?"#445566":"#1a3040"}`,
                          color:!assigned?"#aabbcc":"#334455"}}>
                        PRESET
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: API key inputs per provider */}
            <div style={{flex:1,minWidth:320}}>
              <div style={{fontSize:12,letterSpacing:3,color:"#ffd700",marginBottom:12}}>
                ⚙ API KEYS
              </div>
              {Object.entries(LLM_PROVIDERS).map(([provId, cfg])=>(
                <div key={provId} style={{marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:cfg.color}}/>
                    <span style={{fontSize:12,color:cfg.color,letterSpacing:2}}>{cfg.label.toUpperCase()}</span>
                    {apiKeys[provId]
                      ? <span style={{fontSize:10,color:"#4ade80",letterSpacing:1}}>● KEY SET</span>
                      : <span style={{fontSize:10,color:"#ff6644",letterSpacing:1}}>○ NO KEY</span>}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <input type="password"
                      value={apiKeys[provId]||""}
                      onChange={e=>saveApiKey(provId, e.target.value)}
                      placeholder={cfg.placeholder}
                      style={{flex:1,background:"rgba(0,10,25,0.8)",
                        border:`1px solid ${apiKeys[provId]?cfg.color+"55":"#0d2035"}`,
                        color:"#c0d8e8",padding:"6px 10px",fontFamily:"inherit",fontSize:12,
                        outline:"none"}}/>
                    {apiKeys[provId]&&(
                      <button onClick={()=>saveApiKey(provId,"")}
                        style={{background:"transparent",border:"1px solid #ff444433",
                          color:"#ff6644",padding:"6px 10px",cursor:"pointer",
                          fontSize:11,fontFamily:"inherit"}}>✕ CLEAR</button>
                    )}
                  </div>
                  <div style={{fontSize:10,color:"#2a4050",marginTop:3,lineHeight:1.4}}>
                    {provId==="groq"&&"console.groq.com → API Keys → Create API Key (free)"}
                    
                  </div>
                </div>
              ))}
            </div>

          </div>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
            <button onClick={()=>setShowLLMPanel(false)}
              style={{background:"rgba(0,245,255,0.06)",border:"1px solid #00f5ff33",
                color:"#00f5ff",padding:"7px 20px",cursor:"pointer",
                fontSize:12,letterSpacing:2,fontFamily:"inherit"}}>
              ✓ DONE
            </button>
          </div>
        </div>
      )}

      {/* ── BODY ── */}
      <div style={{display:"flex",height:`calc(100vh - 88px)`}}>

      {activeTab==="table"?(<>

        {/* TABLE AREA */}
        <div style={{flex:1,position:"relative",overflow:"hidden",minHeight:0,display:"flex",flexDirection:"column"}}>
          <div style={{position:"absolute",inset:0,
            backgroundImage:"linear-gradient(rgba(0,40,80,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(0,40,80,0.08) 1px,transparent 1px)",
            backgroundSize:"40px 40px"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",
            transform:"translate(-50%,-50%)",width:460,height:280,
            background:"radial-gradient(ellipse,rgba(0,30,70,0.5) 0%,transparent 70%)",
            pointerEvents:"none"}}/>

          {/* oval table */}
          <div style={{position:"absolute",top:"50%",left:"50%",
            transform:"translate(-50%,-50%)",width:420,height:230,
            borderRadius:"50%",
            background:"radial-gradient(ellipse,#030e1c 0%,#020b14 100%)",
            border:"2px solid #091e34",
            boxShadow:"0 0 50px rgba(0,30,80,0.4),inset 0 0 35px rgba(0,10,30,0.7)"}}>

            <div style={{position:"absolute",inset:10,borderRadius:"50%",
              border:"1px solid rgba(0,60,120,0.2)"}}/>

            {/* phase + street info */}
            <div style={{position:"absolute",top:10,left:"50%",transform:"translateX(-50%)",
              textAlign:"center"}}>
              <div style={{fontSize:13,letterSpacing:3,color:"#2a6080"}}>{phase}</div>
              {phase!=="STANDBY"&&phase!=="SHOWDOWN"&&(
                <div style={{fontSize:10,color:"#1a3a50",letterSpacing:1,marginTop:2}}>
                  {phase==="PRE-FLOP"?"2 hole cards dealt · betting begins":
                   phase==="FLOP"?"3 community cards · second round":
                   phase==="TURN"?"4th community card · third round":
                   phase==="RIVER"?"5th community card · final round":""}
                </div>
              )}
            </div>

            {/* community cards */}
            <div style={{position:"absolute",top:"50%",left:"50%",
              transform:"translate(-50%,-50%)",display:"flex",gap:5,alignItems:"center"}}>
              {community.length>0
                ?community.map((c,i)=><Card key={i} card={c} delay={i*110}/>)
                :Array.from({length:5}).map((_,i)=>(
                  <div key={i} style={{width:44,height:64,borderRadius:6,
                    border:"1px dashed #091e30",background:"rgba(0,8,20,0.5)"}}/>
                ))
              }
            </div>

            {/* pot */}
            {pot>0&&(
              <div style={{position:"absolute",bottom:22,left:"50%",
                transform:"translateX(-50%)",display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{fontSize:16,letterSpacing:2,color:"#f0cc55",fontWeight:"bold"}}>
                  POT: {pot}
                </div>
                <div style={{fontSize:10,color:"#6a5020",letterSpacing:1}}>MAIN POT</div>
              </div>
            )}
          </div>

          {/* agent pods */}
          {allPlayers.map((p,i)=>{
            const activeSeatIds=allPlayers.filter(x=>!x.eliminated).map(x=>x.id);
            const isDealer=activeSeatIds.length>0&&activeSeatIds[dealerIdx%activeSeatIds.length]===p.id;
            return(
              <AgentPod key={p.id} p={p} pos={getPositions(allPlayers.length)[i]||getPositions(5)[0]}
                gameActive={!!players} showCards={showCards}
                isActive={activePlayerId===p.id}
                isDealer={isDealer}
                onRename={handleRename} onRemove={handleRemove}/>
            );
          })}

          {allPlayers.length>=6&&(
            <div style={{position:"absolute",bottom:"46%",left:"50%",
              transform:"translateX(-50%)",fontSize:10,letterSpacing:4,
              color:"#ff444455",pointerEvents:"none",zIndex:6}}>
              ◈ TABLE FULL
            </div>
          )}

          {/* hand rankings legend */}
          <div style={{position:"absolute",bottom:8,left:8,
            background:"rgba(0,5,14,0.85)",border:"1px solid #091e30",
            borderRadius:4,padding:"8px 12px",fontSize:10,color:"#2a5060",
            display:"flex",flexDirection:"column",gap:2,zIndex:4}}>
            <div style={{fontSize:11,color:"#1a4050",letterSpacing:2,marginBottom:4}}>HAND RANKINGS</div>
            {[["Royal Flush","#ffd700"],["Straight Flush","#f0a020"],["Four of a Kind","#e060e0"],
              ["Full House","#c040c0"],["Flush","#6090e0"],["Straight","#60b060"],
              ["Three of a Kind","#6090a0"],["Two Pair","#507080"],["One Pair","#405060"],["High Card","#304050"]
            ].map(([h,c])=>(
              <div key={h} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:c,flexShrink:0}}/>
                <span style={{color:c}}>{h}</span>
              </div>
            ))}
          </div>

          {/* GAME OVER overlay */}
          {gameOver&&champion&&(
            <div style={{position:"absolute",inset:0,
              background:"rgba(0,3,10,0.9)",display:"flex",
              alignItems:"center",justifyContent:"center",
              zIndex:20,backdropFilter:"blur(4px)"}}>
              <div style={{textAlign:"center",
                border:`1px solid ${champion.color}`,
                padding:"38px 55px",background:"rgba(0,5,14,0.99)",
                boxShadow:`0 0 70px ${champion.color}44`}}>
                <div style={{fontSize:9,letterSpacing:4,color:"#1a3050",marginBottom:8}}>SIMULATION COMPLETE</div>
                <div style={{fontSize:36,marginBottom:8}}>{champion.icon}</div>
                <div style={{fontSize:28,letterSpacing:5,color:champion.color,fontWeight:"bold",marginBottom:4}}>{champion.name}</div>
                <div style={{fontSize:11,color:"#445566",letterSpacing:2,marginBottom:3}}>{champion.role}</div>
                <div style={{fontSize:15,color:"#e8c050",marginBottom:6}}>◈ {champion.chips}</div>
                <div style={{display:"flex",gap:14,justifyContent:"center",fontSize:9,color:"#445566",marginBottom:18}}>
                  <span>W: {champion.stats?.wins||0}</span>
                  <span>L: {champion.stats?.losses||0}</span>
                  <span>R↑: {champion.stats?.raises||0}</span>
                </div>
                <button onClick={handleReset}
                  style={{background:`${champion.color}14`,border:`1px solid ${champion.color}`,
                    color:champion.color,padding:"9px 28px",cursor:"pointer",
                    fontSize:11,letterSpacing:3,fontFamily:"inherit"}}>↺ RUN AGAIN</button>
              </div>
            </div>
          )}

          {/* idle state */}
          {!players&&!running&&(
            <div style={{position:"absolute",inset:0,
              display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:9,letterSpacing:4,color:"#0a1e30",marginBottom:5}}>SYSTEM READY</div>
                <div style={{fontSize:9,letterSpacing:2,color:"#071525"}}>PRESS RUN TO INITIALIZE AGENTS</div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{width:300,borderLeft:"1px solid #091e30",
          display:"flex",flexDirection:"column",background:"rgba(0,3,12,0.95)"}}>

          {showBuilder&&<AgentBuilder custom={custom} setCustom={setCustom} onDeploy={deployCustom}/>}

          {/* log header — tabbed: HAND LOG | EVENT LOG */}
          <div style={{borderBottom:"1px solid #091e30",display:"flex"}}>
            {[["hand","HAND LOG"],["event","EVENT LOG"]].map(([tab,label])=>(
              <button key={tab}
                onClick={()=>setLogTab(tab)}
                style={{flex:1,padding:"10px 6px",fontSize:11,letterSpacing:2,
                  background:logTab===tab?"rgba(0,245,255,0.05)":"transparent",
                  color:logTab===tab?"#00f5ff":"#2a5060",
                  border:"none",borderBottom:`2px solid ${logTab===tab?"#00f5ff":"transparent"}`,
                  cursor:"pointer",fontFamily:"'Courier New',monospace"}}>
                {label}
              </button>
            ))}
          </div>

          {/* ── HAND LOG TAB ── live street-by-street action log */}
          {logTab==="hand"&&(
            <div ref={logRef} style={{flex:1,overflowY:"auto",padding:"10px",
              scrollbarWidth:"thin",scrollbarColor:"#0a1e30 transparent"}}>
              {(()=>{
                const streets=["PRE-FLOP","FLOP","TURN","RIVER"];
                const ac={fold:"#ff5555",check:"#7ab8cc",call:"#60a0e0",raise:"#f0cc55","all-in":"#ff6bff",blind:"#fb923c"};
                const byStreet={};
                streets.forEach(st=>{ byStreet[st]=liveHandLog.filter(a=>a.street===st); });
                const anyActions = liveHandLog.length>0;
                if(!anyActions) return(
                  <div style={{padding:"14px 6px",fontSize:12,color:"#2a4a5a",letterSpacing:2}}>
                    {running?"WAITING FOR HAND...":"AWAITING SIGNAL..."}
                  </div>
                );
                // Dealer/SB/BB header
                const dealerName = allPlayers.find(p=>{
                  const ids=allPlayers.filter(x=>!x.eliminated).map(x=>x.id);
                  return ids[dealerIdx%ids.length]===p.id;
                })?.name;
                return(
                  <div>
                    {/* positions header */}
                    <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap",
                      padding:"6px 8px",background:"rgba(0,5,18,0.8)",borderRadius:4,
                      border:"1px solid #091e30"}}>
                      <span style={{fontSize:9,color:"#2a5060",letterSpacing:2,alignSelf:"center"}}>HAND {roundNum}</span>
                      {[[dealerName,"DEALER","#f0cc55"],[allPlayers.find(p=>p.id===sbId)?.name,"SB","#fb923c"],[allPlayers.find(p=>p.id===bbId)?.name,"BB","#4ade80"]].filter(([n])=>n).map(([name,role,col])=>(
                        <span key={role} style={{fontSize:9,color:col,padding:"1px 6px",
                          background:`${col}12`,border:`1px solid ${col}33`,borderRadius:2,letterSpacing:1}}>
                          {role}: {name}
                        </span>
                      ))}
                    </div>
                    {/* streets */}
                    {streets.map(st=>{
                      const acts=byStreet[st];
                      if(!acts||acts.length===0) return null;
                      return(
                        <div key={st} style={{marginBottom:10}}>
                          {/* street label */}
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                            <span style={{fontSize:9,color:"#00f5ff88",letterSpacing:2,fontWeight:"bold",
                              padding:"2px 7px",background:"rgba(0,245,255,0.06)",
                              border:"1px solid #00f5ff22",borderRadius:2}}>{st}</span>
                            {/* community cards for this street */}
                            {st==="FLOP"&&community.slice(0,3).map((c,i)=>{
                              const red=c.suit==="♥"||c.suit==="♦";
                              return <span key={i} style={{fontSize:11,color:red?"#ff8899":"#90b8e0",
                                background:"rgba(0,15,35,0.9)",padding:"1px 5px",
                                border:`1px solid ${red?"#ff446633":"#335577"}`,borderRadius:2}}>
                                {c.rank}{c.suit}</span>;
                            })}
                            {st==="TURN"&&community[3]&&(()=>{const c=community[3];const red=c.suit==="♥"||c.suit==="♦";return <span style={{fontSize:11,color:red?"#ff8899":"#90b8e0",background:"rgba(0,15,35,0.9)",padding:"1px 5px",border:`1px solid ${red?"#ff446633":"#335577"}`,borderRadius:2}}>{c.rank}{c.suit}</span>;})()}
                            {st==="RIVER"&&community[4]&&(()=>{const c=community[4];const red=c.suit==="♥"||c.suit==="♦";return <span style={{fontSize:11,color:red?"#ff8899":"#90b8e0",background:"rgba(0,15,35,0.9)",padding:"1px 5px",border:`1px solid ${red?"#ff446633":"#335577"}`,borderRadius:2}}>{c.rank}{c.suit}</span>;})()}
                            <div style={{flex:1,height:"1px",background:"#091e30"}}/>
                          </div>
                          {/* actions */}
                          {acts.map((a,i)=>{
                            const col=ac[a.action]||"#5a8090";
                            return(
                              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6,
                                padding:"3px 4px",marginBottom:1,borderRadius:2,
                                background:a.action==="raise"||a.action==="all-in"?"rgba(240,204,85,0.03)":"transparent",
                                borderLeft:a.isBlind?`2px solid #fb923c44`:a.action==="raise"?`2px solid ${col}55`:"2px solid transparent"}}>
                                <span style={{fontSize:9,color:"#1a4050",minWidth:14,paddingTop:2,fontFamily:"monospace"}}>{i+1}.</span>
                                <span style={{fontSize:11}}>{a.icon}</span>
                                <span style={{fontSize:11,color:a.color,fontWeight:"bold",minWidth:56,letterSpacing:0.5,
                                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.agent_name}</span>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                                    <span style={{fontSize:10,color:col,fontWeight:"bold",letterSpacing:1,
                                      padding:"0 5px",background:`${col}12`,border:`1px solid ${col}33`,borderRadius:2,
                                      textTransform:"uppercase"}}>
                                      {a.isBlind?`${a.role} blind`:a.action}
                                    </span>
                                    {a.amount>0&&<span style={{fontSize:10,color:"#f0cc55"}}>◈{a.amount}</span>}
                                  </div>
                                  {a.thought&&<div style={{fontSize:9,color:"#3a6070",fontStyle:"italic",
                                    marginTop:1,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",
                                    whiteSpace:"nowrap",maxWidth:130}}>"{a.thought}"</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── EVENT LOG TAB ── mission log */}
          {logTab==="event"&&(
            <div ref={logTab==="event"?logRef:null} style={{flex:1,overflowY:"auto",padding:"8px 10px",
              scrollbarWidth:"thin",scrollbarColor:"#0a1e30 transparent"}}>
              {logs.map(e=>e.type==="round"?(
                <div key={e.id} style={{marginBottom:10,border:`1px solid ${e.winnerColor}33`,
                  borderLeft:`3px solid ${e.winnerColor}`,borderRadius:4,
                  background:"rgba(0,8,20,0.7)",padding:"9px 11px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:11,color:"#3a6878",letterSpacing:2}}>ROUND {e.round}</span>
                    <span style={{fontSize:13,color:"#f0cc55",fontWeight:"bold"}}>◈ {e.pot}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <span style={{fontSize:18}}>{e.winnerIcon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,color:e.winnerColor,fontWeight:"bold",letterSpacing:1}}>{e.winner}</div>
                      {e.hand!=="—"&&<div style={{fontSize:12,color:"#7ad0a0"}}>{e.hand}</div>}
                    </div>
                    <span style={{fontSize:13,color:"#4ade80",fontWeight:"bold",
                      background:"rgba(74,222,128,0.1)",padding:"2px 8px",
                      border:"1px solid #4ade8033",borderRadius:3}}>WIN</span>
                  </div>
                  {e.community?.length>0&&(
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:5}}>
                      {e.community.map((c,i)=>{
                        const red=c.includes("♥")||c.includes("♦");
                        return<span key={i} style={{fontSize:12,color:red?"#ff8899":"#90b8e0",
                          background:"rgba(0,15,35,0.9)",padding:"2px 6px",
                          border:`1px solid ${red?"#ff446633":"#335577"}`,borderRadius:3}}>{c}</span>;
                      })}
                    </div>
                  )}
                  {e.folded?.length>0&&(
                    <div style={{fontSize:11,color:"#4a7080"}}>folded: {e.folded.join(", ")}</div>
                  )}
                </div>
              ):(
                <div key={e.id} style={{padding:"4px 6px",fontSize:13,lineHeight:1.5,
                  color:e.color,marginBottom:2}}>{e.msg}</div>
              ))}
              {!logs.length&&(
                <div style={{padding:"14px 6px",fontSize:13,color:"#2a4a5a",letterSpacing:2}}>
                  AWAITING SIGNAL...
                </div>
              )}
            </div>
          )}

          {/* ── TABLE POSITIONS WIDGET ── */}
          {running && (
            <div style={{borderTop:"1px solid #091e30",padding:"10px 14px",
              background:"rgba(0,5,18,0.95)"}}>
              <div style={{fontSize:11,letterSpacing:3,color:"#3a6070",marginBottom:8}}>TABLE POSITIONS</div>
              {allPlayers.filter(p=>!p.eliminated).map(p=>{
                const activeSeatIds = allPlayers.filter(x=>!x.eliminated).map(x=>x.id);
                const isDealer = activeSeatIds[dealerIdx % activeSeatIds.length] === p.id;
                const isSB     = p.id === sbId;
                const isBB     = p.id === bbId;
                const badges   = [];
                if (isDealer) badges.push({lbl:"DEALER",color:"#f0cc55",bg:"rgba(240,204,85,0.12)"});
                if (isSB)     badges.push({lbl:"SB",color:"#fb923c",bg:"rgba(251,146,60,0.12)"});
                if (isBB)     badges.push({lbl:"BB",color:"#4ade80",bg:"rgba(74,222,128,0.12)"});
                const assignedProv = agentLLM[p.id];
                const provCfg = assignedProv ? LLM_PROVIDERS[assignedProv] : null;
                const hasKey  = provCfg && !!apiKeys[assignedProv];
                return (
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,
                    marginBottom:6,padding:"5px 8px",borderRadius:3,
                    background: activePlayerId===p.id?`${p.color}0e`:"transparent",
                    border:`1px solid ${activePlayerId===p.id?p.color+"33":"transparent"}`,
                    transition:"all 0.2s"}}>
                    <span style={{color:p.color,fontSize:14,flexShrink:0}}>{p.icon}</span>
                    <span style={{fontSize:12,color:p.color,fontWeight:"bold",letterSpacing:1,
                      flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {p.name}
                    </span>
                    {/* position badges */}
                    <div style={{display:"flex",gap:3,flexShrink:0}}>
                      {badges.map(b=>(
                        <span key={b.lbl} style={{fontSize:10,padding:"1px 5px",
                          background:b.bg,border:`1px solid ${b.color}55`,
                          color:b.color,letterSpacing:1,borderRadius:2,fontWeight:"bold"}}>
                          {b.lbl}
                        </span>
                      ))}
                    </div>
                    {/* LLM badge */}
                    {provCfg && (
                      <span style={{fontSize:9,padding:"1px 4px",
                        background:`${provCfg.color}18`,
                        border:`1px solid ${hasKey?provCfg.color+"55":"#1a3040"}`,
                        color:hasKey?provCfg.color:"#2a4050",letterSpacing:1,borderRadius:2}}>
                        "GROQ"
                        {hasKey?"":"?"}
                      </span>
                    )}
                    <span style={{fontSize:11,color:"#f0cc55",flexShrink:0}}>◈{p.chips}</span>
                  </div>
                );
              })}
              {/* blinds info */}
              {(sbId||bbId) && (
                <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #091428",
                  display:"flex",gap:10,flexWrap:"wrap"}}>
                  <div style={{fontSize:11,color:"#3a5060"}}>
                    <span style={{color:"#fb923c",fontWeight:"bold"}}>SB </span>
                    {allPlayers.find(p=>p.id===sbId)?.name||"—"}
                    <span style={{color:"#fb923c44",marginLeft:4}}>◈{SB}</span>
                  </div>
                  <div style={{fontSize:11,color:"#3a5060"}}>
                    <span style={{color:"#4ade80",fontWeight:"bold"}}>BB </span>
                    {allPlayers.find(p=>p.id===bbId)?.name||"—"}
                    <span style={{color:"#4ade8044",marginLeft:4}}>◈{BB}</span>
                  </div>
                  <div style={{fontSize:11,color:"#3a5060"}}>
                    <span style={{color:"#f0cc55",fontWeight:"bold"}}>DEALER </span>
                    {allPlayers.filter(p=>!p.eliminated)[dealerIdx % Math.max(1,allPlayers.filter(p=>!p.eliminated).length)]?.name||"—"}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* agents legend (pre-game / always visible) */}
          <div style={{borderTop:"1px solid #091e30",padding:"10px 14px"}}>
            <div style={{fontSize:11,letterSpacing:3,color:"#3a6070",marginBottom:8}}>AGENTS</div>
            {allPlayers.map(p=>{
              const assignedProv = agentLLM[p.id];
              const provCfg = assignedProv ? LLM_PROVIDERS[assignedProv] : null;
              const hasKey  = provCfg && !!apiKeys[assignedProv];
              return (
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
                  <span style={{color:p.color,fontSize:14}}>{p.icon}</span>
                  <span style={{fontSize:12,color:p.eliminated?"#2a4050":p.color,
                    flex:1,letterSpacing:1,fontWeight:"bold"}}>{p.name}</span>
                  {provCfg?(
                    <span style={{fontSize:9,padding:"1px 5px",letterSpacing:1,
                      background:`${provCfg.color}18`,borderRadius:2,
                      border:`1px solid ${hasKey?provCfg.color+"44":"#1a3040"}`,
                      color:hasKey?provCfg.color:"#2a4050"}}>
                      "GROQ"
                      {!hasKey&&" (no key)"}
                    </span>
                  ):(
                    <span style={{fontSize:9,color:"#2a4050",letterSpacing:1}}>PRESET</span>
                  )}
                  <span style={{fontSize:11,color:"#f0cc55"}}>◈{p.chips||START}</span>
                </div>
              );
            })}
          </div>
        </div>

      </>):(
        /* ── SESSIONS TAB ── */
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>

          {/* LEFT: session list */}
          <div style={{width:240,borderRight:"1px solid #091e30",overflowY:"auto",flexShrink:0,
            background:"rgba(0,3,12,0.98)",scrollbarWidth:"thin",scrollbarColor:"#0a1e30 transparent"}}>
            <div style={{padding:"12px 14px",borderBottom:"1px solid #091e30",
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,letterSpacing:3,color:"#3a7a90"}}>SESSIONS</span>
              <button onClick={loadSessions}
                style={{background:"transparent",border:"1px solid #0a2030",color:"#3a7090",
                  padding:"2px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>
                {loadingSess?"...":"↻"}
              </button>
            </div>

            {/* current live session at top if running */}
            {handHistory.length>0&&(
              <div onClick={()=>{setSessions(prev=>prev);setSelSession("live");setSelRounds([]);}}
                style={{padding:"10px 14px",borderBottom:"1px solid #0a2030",cursor:"pointer",
                  background:selSession==="live"?"rgba(0,245,255,0.06)":"rgba(0,245,255,0.02)",
                  borderLeft:`3px solid ${selSession==="live"?"#00f5ff":"#00f5ff33"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:12,color:"#00f5ff",fontWeight:"bold",letterSpacing:1}}>● LIVE</span>
                  <span style={{fontSize:11,color:"#f0cc55"}}>◈ {handHistory.reduce((a,h)=>a+h.pot,0)}</span>
                </div>
                <div style={{fontSize:11,color:"#3a6070"}}>{handHistory.length} hands played</div>
              </div>
            )}

            {sessions.map(s=>(
              <div key={s.id} onClick={()=>loadRounds(s.id)}
                style={{padding:"10px 14px",borderBottom:"1px solid #081520",cursor:"pointer",
                  background:selSession===s.id?"rgba(0,245,255,0.04)":"transparent",
                  borderLeft:`3px solid ${selSession===s.id?"#00f5ff":"transparent"}`,
                  transition:"background 0.15s"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:12,color:selSession===s.id?"#00f5ff":"#5a8898",
                    fontWeight:"bold",letterSpacing:1}}>#{s.id}</span>
                  <span style={{fontSize:10,color:s.ended_at?"#4ade80":"#fb923c"}}>
                    {s.ended_at?"DONE":"OPEN"}
                  </span>
                </div>
                <div style={{fontSize:10,color:"#3a6070",marginBottom:2}}>
                  {new Date(s.started_at).toLocaleString()}
                </div>
                <div style={{display:"flex",gap:8,fontSize:10}}>
                  <span style={{color:"#4a8090"}}>{s.total_rounds||"?"} rounds</span>
                  {s.winner_name&&<span style={{color:"#f0cc55"}}>▶ {s.winner_name}</span>}
                </div>
              </div>
            ))}
            {sessions.length===0&&handHistory.length===0&&(
              <div style={{padding:20,fontSize:11,color:"#1a3a50",textAlign:"center",letterSpacing:2}}>
                NO SESSIONS YET
              </div>
            )}
          </div>

          {/* RIGHT: hand-by-hand detail */}
          <div style={{flex:1,overflowY:"auto",background:"rgba(0,5,14,0.97)",
            scrollbarWidth:"thin",scrollbarColor:"#0a1e30 transparent"}}>
            {(()=>{
              // Determine what to show
              const isLive = selSession==="live";
              const hands = isLive ? handHistory : selRounds.map(r=>({
                round: r.round_number,
                pot: r.pot_size,
                winner: r.winner_name,
                winnerColor: "#00f5ff",
                winnerIcon: "◈",
                hand: (r.actions||[]).find(a=>a.agent_name===r.winner_name&&a.hand_rank)?.hand_rank||"—",
                community: (r.community_cards||[]).map(c=>typeof c==="string"?c:(c?.rank||"")+(c?.suit||"")),
                dealer: null, sb: null, bb: null,
                players: [...new Set((r.actions||[]).map(a=>a.agent_name))].map(name=>{
                  const acts=(r.actions||[]).filter(a=>a.agent_name===name);
                  const streets=["PRE-FLOP","FLOP","TURN","RIVER"];
                  return {
                    name, icon:"◈", color:"#7ab8cc",
                    holeCards: acts[0]?.hole_cards?.map(c=>typeof c==="string"?c:(c?.rank||"")+(c?.suit||""))||[],
                    handRank: acts.find(a=>a.hand_rank)?.hand_rank||"",
                    folded: acts.some(a=>a.action==="fold"),
                    won: name===r.winner_name,
                    streetActions: acts.map(a=>({street:a.street||"PRE-FLOP",action:a.action,amount:a.amount||0})),
                    thought: acts[acts.length-1]?.thought||"",
                  };
                }),
              }));

              if (!selSession) return (
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",
                  height:"100%",flexDirection:"column",gap:10}}>
                  <div style={{fontSize:13,color:"#1a4050",letterSpacing:3}}>SELECT A SESSION</div>
                  {handHistory.length>0&&<div style={{fontSize:11,color:"#1a3040",letterSpacing:2}}>OR CLICK ● LIVE ABOVE</div>}
                </div>
              );

              if (hands.length===0) return (
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",
                  height:"100%",fontSize:13,color:"#1a4050",letterSpacing:3}}>NO HANDS RECORDED</div>
              );

              const actionColor={fold:"#ff5555",check:"#7ab8cc",call:"#60a0e0",raise:"#f0cc55","all-in":"#ff6bff"};

              return (
                <div style={{padding:16}}>
                  {/* session header */}
                  <div style={{marginBottom:16,paddingBottom:14,borderBottom:"1px solid #091e30",
                    display:"flex",gap:24,flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{fontSize:16,color:"#00f5ff",fontWeight:"bold",letterSpacing:3}}>
                      {isLive?"● LIVE SESSION":`SESSION #${selSession}`}
                    </span>
                    {[["HANDS",hands.length],
                      ["TOTAL POT","◈ "+hands.reduce((a,h)=>a+h.pot,0)],
                    ].map(([l,v])=>(
                      <div key={l}>
                        <div style={{fontSize:10,color:"#3a6070",letterSpacing:2}}>{l}</div>
                        <div style={{fontSize:13,color:"#7ab8cc"}}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* hand cards — newest first */}
                  {[...hands].reverse().map((h,ri)=>(
                    <div key={h.round} style={{marginBottom:14,background:"rgba(0,8,22,0.9)",
                      border:"1px solid #0a2030",borderRadius:5,overflow:"hidden"}}>

                      {/* hand header bar */}
                      <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",
                        background:"rgba(0,15,35,0.6)",borderBottom:"1px solid #091e30",flexWrap:"wrap"}}>
                        <span style={{fontSize:13,color:"#3a7888",letterSpacing:2,fontWeight:"bold"}}>
                          HAND #{h.round}
                        </span>
                        {/* positions */}
                        {[["DEALER",h.dealer,"#f0cc55"],["SB",h.sb,"#fb923c"],["BB",h.bb,"#4ade80"]].map(([role,name,col])=>
                          name?(
                            <span key={role} style={{fontSize:10,color:col,background:`${col}15`,
                              border:`1px solid ${col}44`,padding:"1px 7px",letterSpacing:1}}>
                              {role}: {name}
                            </span>
                          ):null
                        )}
                        <span style={{marginLeft:"auto",fontSize:14,color:"#f0cc55",fontWeight:"bold"}}>
                          POT ◈ {h.pot}
                        </span>
                      </div>

                      {/* ── POSITIONS ROW — always visible ── */}
                      <div style={{display:"flex",gap:6,padding:"8px 14px",
                        background:"rgba(0,5,14,0.8)",borderBottom:"1px solid #091e30",flexWrap:"wrap"}}>
                        <span style={{fontSize:9,color:"#2a5060",letterSpacing:2,alignSelf:"center",marginRight:4}}>SEATS →</span>
                        {(h.players||[]).map((p,pi)=>{
                          const name=typeof p==="string"?p:p.name;
                          const isDealer=name===h.dealer, isSB=name===h.sb, isBB=name===h.bb;
                          const col=p.color||"#5a8090";
                          const isWinner=name===h.winner;
                          return(
                            <div key={pi} style={{display:"flex",alignItems:"center",gap:4,
                              padding:"3px 8px",borderRadius:3,
                              background:isWinner?"rgba(0,245,255,0.06)":"rgba(0,5,18,0.6)",
                              border:`1px solid ${isWinner?"#00f5ff22":"#0a1e30"}`}}>
                              <span style={{fontSize:10,color:col,fontWeight:"bold"}}>{name}</span>
                              {isDealer&&<span style={{fontSize:8,color:"#f0cc55",background:"rgba(240,204,85,0.12)",
                                padding:"0 4px",border:"1px solid #f0cc5544",letterSpacing:1}}>DEALER</span>}
                              {isSB&&<span style={{fontSize:8,color:"#fb923c",background:"rgba(251,146,60,0.12)",
                                padding:"0 4px",border:"1px solid #fb923c44",letterSpacing:1}}>SB</span>}
                              {isBB&&<span style={{fontSize:8,color:"#4ade80",background:"rgba(74,222,128,0.12)",
                                padding:"0 4px",border:"1px solid #4ade8044",letterSpacing:1}}>BB</span>}
                              {isWinner&&<span style={{fontSize:8,color:"#00f5ff",letterSpacing:1}}>★WIN</span>}
                            </div>
                          );
                        })}
                      </div>

                      <div style={{padding:"12px 14px"}}>

                        {/* ── HOLE CARDS GRID ── */}
                        {(h.players||[]).filter(p=>p.holeCards?.length>0).length>0&&(
                          <div style={{marginBottom:14}}>
                            <div style={{fontSize:10,letterSpacing:2,color:"#3a6070",marginBottom:8}}>HOLE CARDS</div>
                            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                              {(h.players||[]).map((p,pi)=>{
                                if(!p.holeCards?.length) return null;
                                const name=typeof p==="string"?p:p.name;
                                const isWinner=name===h.winner;
                                const col=p.color||(isWinner?"#00f5ff":"#5a8090");
                                const role=name===h.dealer?"DEALER":name===h.sb?"SB":name===h.bb?"BB":"";
                                return(
                                  <div key={pi} style={{display:"flex",flexDirection:"column",gap:4,
                                    padding:"7px 10px",borderRadius:4,
                                    background:isWinner?"rgba(0,245,255,0.04)":"rgba(0,5,18,0.6)",
                                    border:`1px solid ${isWinner?"#00f5ff22":"#0a1e30"}`,
                                    borderTop:`2px solid ${col}`}}>
                                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                                      <span style={{fontSize:11,color:col,fontWeight:"bold",letterSpacing:1}}>{name}</span>
                                      {role&&<span style={{fontSize:9,color:"#f0cc5599",letterSpacing:1,
                                        background:"rgba(240,204,85,0.08)",padding:"0 4px",border:"1px solid #f0cc5522"}}>{role}</span>}
                                      {isWinner&&<span style={{fontSize:9,color:"#4ade80",marginLeft:"auto",
                                        background:"rgba(74,222,128,0.08)",padding:"0 5px",border:"1px solid #4ade8033"}}>WON</span>}
                                      {p.folded&&!isWinner&&<span style={{fontSize:9,color:"#3a5060",marginLeft:"auto"}}>FOLDED</span>}
                                    </div>
                                    <div style={{display:"flex",gap:3}}>
                                      {p.holeCards.map((c,ci)=>{
                                        const cs=typeof c==="string"?c:(c?.rank||"")+(c?.suit||"");
                                        const red=cs.includes("♥")||cs.includes("♦");
                                        return(
                                          <div key={ci} style={{width:32,height:44,borderRadius:3,display:"flex",
                                            flexDirection:"column",alignItems:"center",justifyContent:"center",
                                            fontWeight:"bold",background:"linear-gradient(135deg,#0d1b2a,#162032)",
                                            border:`1px solid ${red?"#ff4466":"#6699cc"}`,
                                            color:red?"#ff6688":"#c8d8f0"}}>
                                            <span style={{fontSize:8}}>{cs.slice(0,-1)}</span>
                                            <span style={{fontSize:12}}>{cs.slice(-1)}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {p.handRank&&<span style={{fontSize:9,color:"#7ad0a0",letterSpacing:1}}>{p.handRank}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── BOARD ── */}
                        {h.community?.length>0&&(
                          <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
                            <div style={{fontSize:10,letterSpacing:2,color:"#3a6070",minWidth:40}}>BOARD</div>
                            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                              {h.community.map((c,ci)=>{
                                const cs=typeof c==="string"?c:(c?.rank||"")+(c?.suit||"");
                                const red=cs.includes("♥")||cs.includes("♦");
                                const streetLabel=ci===0?"FLOP":ci===3?"TURN":ci===4?"RIVER":"";
                                return(
                                  <div key={ci} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                    {streetLabel&&<span style={{fontSize:8,color:"#2a5060",letterSpacing:1}}>{streetLabel}</span>}
                                    <div style={{width:34,height:48,borderRadius:4,display:"flex",
                                      flexDirection:"column",alignItems:"center",justifyContent:"center",
                                      fontWeight:"bold",background:"linear-gradient(135deg,#0d1b2a,#162032)",
                                      border:`1px solid ${red?"#ff4466":"#6699cc"}`,
                                      color:red?"#ff6688":"#c8d8f0"}}>
                                      <span style={{fontSize:8}}>{cs.slice(0,-1)}</span>
                                      <span style={{fontSize:12}}>{cs.slice(-1)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {/* winner */}
                            <div style={{marginLeft:"auto",padding:"6px 12px",borderRadius:4,
                              background:"rgba(0,245,255,0.04)",border:"1px solid #00f5ff22",textAlign:"right"}}>
                              <div style={{fontSize:9,color:"#3a7060",letterSpacing:2}}>WINNER</div>
                              <div style={{fontSize:13,color:h.winnerColor||"#00f5ff",fontWeight:"bold",letterSpacing:1}}>
                                {h.winnerIcon} {h.winner}
                              </div>
                              {h.hand&&h.hand!=="—"&&<div style={{fontSize:10,color:"#7ad0a0"}}>{h.hand}</div>}
                            </div>
                          </div>
                        )}

                        {/* ── CHRONOLOGICAL EVENT LOG ── */}
                        {(()=>{
                          // Build full ordered event log from streetActions across all players
                          // Reconstruct chronological order: group by street, preserve action order within
                          const streets=["PRE-FLOP","FLOP","TURN","RIVER"];
                          const allActions=[];

                          // Blinds posted first
                          if(h.sb) allActions.push({type:"blind",role:"SB",name:h.sb,amount:25,street:"PRE-FLOP"});
                          if(h.bb) allActions.push({type:"blind",role:"BB",name:h.bb,amount:50,street:"PRE-FLOP"});

                          // Rebuild ordered actions from streetActions per player
                          // Use the original roundActions order stored in h.actions if available
                          const ordered = h.actions && h.actions.length>0
                            ? h.actions
                            : streets.flatMap(st=>{
                                // collect all actions for this street across all players in seat order
                                const streetActs=[];
                                (h.players||[]).forEach(p=>{
                                  (p.streetActions||[]).filter(a=>a.street===st).forEach(a=>{
                                    streetActs.push({...a,name:p.name,thought:p.thought,color:p.color,icon:p.icon});
                                  });
                                });
                                return streetActs;
                              });

                          // Group into streets for rendering
                          const byStreet={};
                          streets.forEach(st=>{
                            byStreet[st]= h.actions
                              ? h.actions.filter(a=>(a.street||"PRE-FLOP")===st).map(a=>({
                                  name:a.agent_name||a.name, action:a.action,
                                  amount:a.amount||0, thought:a.thought||"",
                                  color:(h.players||[]).find(p=>p.name===(a.agent_name||a.name))?.color||"#7ab8cc",
                                  icon:(h.players||[]).find(p=>p.name===(a.agent_name||a.name))?.icon||"◈",
                                }))
                              : (h.players||[]).flatMap(p=>
                                  (p.streetActions||[]).filter(a=>a.street===st).map(a=>({
                                    name:p.name,action:a.action,amount:a.amount||0,
                                    thought:p.thought||"",color:p.color||"#7ab8cc",icon:p.icon||"◈"
                                  }))
                                );
                          });

                          const streetCards={"FLOP":h.community?.slice(0,3)||[],"TURN":[h.community?.[3]],"RIVER":[h.community?.[4]]};
                          // Show street if it has actions OR if community cards were dealt for it
                          const streetHasContent=st=>{
                            if(byStreet[st]?.length>0) return true;
                            if(st==="FLOP"&&h.community?.length>=3) return true;
                            if(st==="TURN"&&h.community?.length>=4) return true;
                            if(st==="RIVER"&&h.community?.length>=5) return true;
                            if(st==="PRE-FLOP") return true; // always show preflop
                            return false;
                          };

                          return(
                            <div>
                              <div style={{fontSize:10,letterSpacing:2,color:"#3a6070",marginBottom:10}}>
                                EVENT LOG — {(h.actions||ordered).length} ACTIONS
                              </div>
                              {streets.filter(streetHasContent).map(st=>(
                                <div key={st} style={{marginBottom:12}}>
                                  {/* street header */}
                                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                                    <div style={{fontSize:10,letterSpacing:2,color:"#00f5ff88",fontWeight:"bold",
                                      padding:"2px 8px",background:"rgba(0,245,255,0.05)",
                                      border:"1px solid #00f5ff22",borderRadius:2}}>{st}</div>
                                    {/* show new community cards revealed this street */}
                                    {st!=="PRE-FLOP"&&(streetCards[st]||[]).filter(Boolean).map((c,ci)=>{
                                      const cs=typeof c==="string"?c:(c?.rank||"")+(c?.suit||"");
                                      if(!cs) return null;
                                      const red=cs.includes("♥")||cs.includes("♦");
                                      return(
                                        <div key={ci} style={{width:24,height:32,borderRadius:2,display:"flex",
                                          flexDirection:"column",alignItems:"center",justifyContent:"center",
                                          fontWeight:"bold",background:"linear-gradient(135deg,#0d1b2a,#162032)",
                                          border:`1px solid ${red?"#ff4466":"#6699cc"}`,
                                          color:red?"#ff6688":"#c8d8f0",fontSize:9}}>
                                          {cs}
                                        </div>
                                      );
                                    })}
                                    <div style={{flex:1,height:"1px",background:"#091e30"}}/>
                                  </div>

                                  {/* blinds line for pre-flop */}
                                  {st==="PRE-FLOP"&&(h.sb||h.bb)&&(
                                    <div style={{display:"flex",gap:8,marginBottom:4,paddingLeft:8,flexWrap:"wrap"}}>
                                      {[[h.sb,"SB","#fb923c"],[h.bb,"BB","#4ade80"]].filter(([n])=>n).map(([name,role,col])=>(
                                        <div key={role} style={{display:"flex",alignItems:"center",gap:5,
                                          padding:"3px 8px",borderRadius:2,
                                          background:`${col}0a`,border:`1px solid ${col}22`}}>
                                          <span style={{fontSize:9,color:col,letterSpacing:1,fontWeight:"bold"}}>{role}</span>
                                          <span style={{fontSize:11,color:"#7ab8cc"}}>{name}</span>
                                          <span style={{fontSize:10,color:"#f0cc55"}}>posts blind</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* actions in order */}
                                  {(byStreet[st]||[]).map((a,ai)=>{
                                    const ac=actionColor[a.action]||"#5a8090";
                                    const isRaise=a.action==="raise"||a.action==="all-in";
                                    return(
                                      <div key={ai} style={{display:"flex",alignItems:"flex-start",gap:8,
                                        padding:"4px 8px",marginBottom:2,borderRadius:2,
                                        background:isRaise?"rgba(240,204,85,0.03)":"transparent",
                                        borderLeft:`2px solid ${isRaise?ac+"44":"#0a1e30"}`}}>
                                        {/* step number */}
                                        <span style={{fontSize:9,color:"#1a4050",minWidth:16,paddingTop:2,
                                          fontFamily:"monospace"}}>{ai+1}.</span>
                                        {/* icon */}
                                        <span style={{fontSize:11,paddingTop:1}}>{a.icon||"◈"}</span>
                                        {/* name */}
                                        <span style={{fontSize:12,color:a.color||"#7ab8cc",fontWeight:"bold",
                                          minWidth:70,letterSpacing:0.5}}>{a.name}</span>
                                        {/* action badge */}
                                        <div style={{display:"flex",alignItems:"center",gap:4,flex:1,flexWrap:"wrap"}}>
                                          <span style={{fontSize:11,color:ac,fontWeight:"bold",letterSpacing:1,
                                            textTransform:"uppercase",padding:"1px 7px",
                                            background:`${ac}12`,border:`1px solid ${ac}33`,borderRadius:2}}>
                                            {a.action}
                                          </span>
                                          {a.amount>0&&(
                                            <span style={{fontSize:11,color:"#f0cc55",fontWeight:"bold"}}>
                                              ◈ {a.amount}
                                            </span>
                                          )}
                                          {a.thought&&(
                                            <span style={{fontSize:10,color:"#3a6070",fontStyle:"italic",
                                              flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",
                                              whiteSpace:"nowrap"}}>
                                              "{a.thought}"
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      </div>
    </div>
  );
}