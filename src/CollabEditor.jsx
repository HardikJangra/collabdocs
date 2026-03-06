import { useState, useEffect, useRef, useCallback } from "react";

// ─── Simulated OT Engine ─────────────────────────────────────────────────────
class OTEngine {
  constructor() { this.version = 0; this.history = []; }
  apply(doc, op) {
    if (op.type === "insert") return doc.slice(0, op.pos) + op.text + doc.slice(op.pos);
    if (op.type === "delete") return doc.slice(0, op.pos) + doc.slice(op.pos + op.len);
    if (op.type === "replace") return op.text;
    return doc;
  }
  transform(op1, op2) {
    if (op1.type === "insert" && op2.type === "insert") {
      if (op1.pos <= op2.pos) return { ...op2, pos: op2.pos + op1.text.length };
    }
    return op2;
  }
  commit(op) {
    this.history.push({ ...op, version: ++this.version, timestamp: Date.now() });
    return this.version;
  }
}

// ─── Simulated WebSocket / Multi-user presence ───────────────────────────────
const COLORS = ["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FECA57","#FF9FF3","#54A0FF","#5F27CD"];
const NAMES  = ["Alex","Sam","Jordan","Taylor","Morgan","Casey","Riley","Drew"];

function useCollabSim(docId, currentUser) {
  const [peers, setPeers]           = useState([]);
  const [incomingOps, setIncoming]  = useState([]);
  const peersRef = useRef([]);

  useEffect(() => {
    const joined = [
      { id: "peer1", name: NAMES[1], color: COLORS[1], cursor: 0, active: true },
      { id: "peer2", name: NAMES[2], color: COLORS[2], cursor: 0, active: false },
    ];
    peersRef.current = joined;
    setPeers([...joined]);

    const tick = setInterval(() => {
      peersRef.current = peersRef.current.map(p => ({
        ...p,
        cursor: Math.floor(Math.random() * 200),
        active: Math.random() > 0.3,
      }));
      setPeers([...peersRef.current]);
    }, 2800);
    return () => clearInterval(tick);
  }, [docId]);

  const broadcastOp = useCallback((op) => {
    // simulate echo back from server
  }, []);

  return { peers, incomingOps, broadcastOp };
}

// ─── Markdown Renderer ───────────────────────────────────────────────────────
function renderMarkdown(md) {
  if (!md) return "";
  let html = md
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    // headings
    .replace(/^###### (.+)$/gm,"<h6>$1</h6>")
    .replace(/^##### (.+)$/gm,"<h5>$1</h5>")
    .replace(/^#### (.+)$/gm,"<h4>$1</h4>")
    .replace(/^### (.+)$/gm,"<h3>$1</h3>")
    .replace(/^## (.+)$/gm,"<h2>$1</h2>")
    .replace(/^# (.+)$/gm,"<h1>$1</h1>")
    // bold, italic, code
    .replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em>$1</em>")
    .replace(/`(.+?)`/g,"<code>$1</code>")
    // blockquote
    .replace(/^&gt; (.+)$/gm,"<blockquote>$1</blockquote>")
    // hr
    .replace(/^---$/gm,"<hr/>")
    // unordered list
    .replace(/^\* (.+)$/gm,"<li>$1</li>")
    .replace(/^- (.+)$/gm,"<li>$1</li>")
    // ordered list
    .replace(/^\d+\. (.+)$/gm,"<li>$1</li>")
    // links
    .replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2" target="_blank">$1</a>')
    // paragraphs
    .replace(/\n\n/g,"</p><p>")
    .replace(/\n/g,"<br/>");
  return `<p>${html}</p>`;
}

// ─── Tiny UUID ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2,10);

// ─── Initial Demo Documents ───────────────────────────────────────────────────
const DEMO_DOC = `# Welcome to CollabDocs ✦

## Getting Started

This is a **real-time collaborative** markdown editor. Multiple users can edit simultaneously using *Operational Transforms* to resolve conflicts.

---

## Features

- **Live sync** via WebSocket simulation
- **OT conflict resolution** engine built-in
- **Version history** with restore capability
- **Collaborator cursors** tracked in real-time
- **Auth system** with JWT-style session tokens

## Code Example

\`const ot = new OTEngine();\`

> "The best collaboration tools disappear — you just see the work." 

## Try It Out

Edit this document and watch the version counter increment. Switch to **Preview** mode to see rendered output. Check the **History** panel to restore previous versions.

---

*Built with React · OT Engine · WebSocket simulation*
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function CollabEditor() {
  // Auth state
  const [authScreen, setAuthScreen]   = useState("login"); // login | signup | app
  const [authForm, setAuthForm]       = useState({ email:"", password:"", name:"" });
  const [authError, setAuthError]     = useState("");
  const [users, setUsers]             = useState([{ id:"u1", name:"Alex Chen", email:"alex@demo.com", password:"demo123", color: COLORS[0] }]);
  const [currentUser, setCurrentUser] = useState(null);

  // Doc state
  const [docs, setDocs]               = useState([
    { id:"d1", title:"Getting Started", content: DEMO_DOC, userId:"u1", collaborators:[], createdAt: new Date(Date.now()-86400000), updatedAt: new Date() },
    { id:"d2", title:"Project Roadmap", content:"# Q2 Roadmap\n\n## Goals\n\n- Launch v1.0\n- Onboard 100 users\n- Build mobile app\n\n---\n\n## Milestones\n\n* **April** — Beta release\n* **May** — Public launch\n* **June** — Mobile beta", userId:"u1", collaborators:[], createdAt: new Date(Date.now()-3600000), updatedAt: new Date() },
  ]);
  const [activeDoc, setActiveDoc]     = useState(null);
  const [content, setContent]         = useState("");
  const [title, setTitle]             = useState("");
  const [view, setView]               = useState("split"); // edit | split | preview
  const [panel, setPanel]             = useState("none"); // none | history | collab
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(true);
  const [wordCount, setWordCount]     = useState(0);

  // History
  const [history, setHistory]         = useState([]);
  const otRef                         = useRef(new OTEngine());
  const saveTimer                     = useRef(null);
  const textareaRef                   = useRef(null);

  // Collab sim
  const { peers, broadcastOp }        = useCollabSim(activeDoc?.id, currentUser);

  // ── Auth handlers ──────────────────────────────────────────────────────────
  const handleLogin = () => {
    const u = users.find(u => u.email === authForm.email && u.password === authForm.password);
    if (!u) { setAuthError("Invalid credentials. Try alex@demo.com / demo123"); return; }
    setCurrentUser(u);
    setAuthScreen("app");
    setAuthError("");
  };

  const handleSignup = () => {
    if (!authForm.name || !authForm.email || !authForm.password) { setAuthError("All fields required"); return; }
    if (users.find(u => u.email === authForm.email)) { setAuthError("Email already registered"); return; }
    const nu = { id: uid(), name: authForm.name, email: authForm.email, password: authForm.password, color: COLORS[users.length % COLORS.length] };
    setUsers(prev => [...prev, nu]);
    setCurrentUser(nu);
    setAuthScreen("app");
    setAuthError("");
  };

  // ── Doc handlers ───────────────────────────────────────────────────────────
  const openDoc = (doc) => {
    setActiveDoc(doc);
    setContent(doc.content);
    setTitle(doc.title);
    setSaved(true);
    // Seed history
    setHistory([{ version:1, content: doc.content, timestamp: doc.updatedAt, label:"Last saved" }]);
  };

  const newDoc = () => {
    const doc = { id: uid(), title:"Untitled Document", content:"# Untitled Document\n\nStart writing...", userId: currentUser.id, collaborators:[], createdAt: new Date(), updatedAt: new Date() };
    setDocs(prev => [doc, ...prev]);
    openDoc(doc);
  };

  const deleteDoc = (id, e) => {
    e.stopPropagation();
    setDocs(prev => prev.filter(d => d.id !== id));
    if (activeDoc?.id === id) { setActiveDoc(null); setContent(""); setTitle(""); }
  };

  const handleContentChange = (val) => {
    setContent(val);
    setSaved(false);
    setWordCount(val.trim().split(/\s+/).filter(Boolean).length);

    // OT commit
    const op = { type:"replace", text: val };
    otRef.current.commit(op);
    broadcastOp(op);

    // Debounce save
    clearTimeout(saveTimer.current);
    setSaving(false);
    saveTimer.current = setTimeout(() => {
      setSaving(true);
      setTimeout(() => {
        setDocs(prev => prev.map(d => d.id === activeDoc?.id ? { ...d, content: val, title, updatedAt: new Date() } : d));
        setHistory(prev => [{ version: otRef.current.version, content: val, timestamp: new Date(), label:`v${otRef.current.version}` }, ...prev.slice(0,19)]);
        setSaving(false);
        setSaved(true);
      }, 400);
    }, 1200);
  };

  const handleTitleChange = (val) => {
    setTitle(val);
    setSaved(false);
    setDocs(prev => prev.map(d => d.id === activeDoc?.id ? { ...d, title: val } : d));
  };

  const restoreVersion = (snapshot) => {
    setContent(snapshot.content);
    setSaved(false);
    handleContentChange(snapshot.content);
  };

  const insertMarkdown = (syntax) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const selected = content.slice(start, end);
    let inserted = "";
    switch(syntax) {
      case "bold":   inserted = `**${selected||"bold text"}**`; break;
      case "italic": inserted = `*${selected||"italic text"}*`; break;
      case "code":   inserted = `\`${selected||"code"}\``; break;
      case "h1":     inserted = `\n# ${selected||"Heading 1"}\n`; break;
      case "h2":     inserted = `\n## ${selected||"Heading 2"}\n`; break;
      case "quote":  inserted = `\n> ${selected||"Quote"}\n`; break;
      case "ul":     inserted = `\n- ${selected||"List item"}\n`; break;
      case "hr":     inserted = `\n---\n`; break;
      case "link":   inserted = `[${selected||"link text"}](https://)`; break;
      default: inserted = selected;
    }
    const newContent = content.slice(0,start) + inserted + content.slice(end);
    setContent(newContent);
    handleContentChange(newContent);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start+inserted.length, start+inserted.length); }, 0);
  };

  const logout = () => { setCurrentUser(null); setAuthScreen("login"); setActiveDoc(null); setAuthForm({email:"",password:"",name:""}); };

  // ── Screens ────────────────────────────────────────────────────────────────
  if (authScreen !== "app") {
    return (
      <div style={{ minHeight:"100vh", background:"#0a0a0f", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Crimson Pro', Georgia, serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap');
          * { box-sizing:border-box; margin:0; padding:0; }
          .auth-input { width:100%; padding:12px 16px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#e8e8e8; font-family:inherit; font-size:15px; outline:none; transition:border-color 0.2s; }
          .auth-input:focus { border-color:rgba(255,200,80,0.5); background:rgba(255,200,80,0.03); }
          .auth-input::placeholder { color:rgba(255,255,255,0.3); }
          .auth-btn { width:100%; padding:13px; background:linear-gradient(135deg,#f5c842,#e8a020); border:none; border-radius:8px; color:#0a0a0f; font-family:'JetBrains Mono',monospace; font-size:14px; font-weight:600; cursor:pointer; letter-spacing:0.05em; transition:opacity 0.2s,transform 0.1s; }
          .auth-btn:hover { opacity:0.9; transform:translateY(-1px); }
          .auth-link { background:none; border:none; color:#f5c842; cursor:pointer; font-family:inherit; font-size:14px; text-decoration:underline; }
        `}</style>

        {/* bg grid */}
        <div style={{ position:"fixed", inset:0, backgroundImage:"linear-gradient(rgba(255,200,80,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,200,80,0.03) 1px,transparent 1px)", backgroundSize:"48px 48px", pointerEvents:"none" }} />

        <div style={{ position:"relative", width:420, padding:"48px 40px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, backdropFilter:"blur(20px)" }}>
          {/* logo */}
          <div style={{ textAlign:"center", marginBottom:36 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ width:36, height:36, background:"linear-gradient(135deg,#f5c842,#e8a020)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>✦</div>
              <span style={{ fontSize:24, fontWeight:600, color:"#e8e8e8", letterSpacing:"-0.02em" }}>CollabDocs</span>
            </div>
            <p style={{ color:"rgba(255,255,255,0.4)", fontSize:14, fontFamily:"'JetBrains Mono',monospace" }}>
              {authScreen === "login" ? "sign in to your workspace" : "create your workspace"}
            </p>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {authScreen === "signup" && (
              <input className="auth-input" placeholder="Full name" value={authForm.name} onChange={e => setAuthForm(f=>({...f,name:e.target.value}))} />
            )}
            <input className="auth-input" placeholder="Email address" type="email" value={authForm.email} onChange={e => setAuthForm(f=>({...f,email:e.target.value}))} onKeyDown={e => e.key==="Enter" && (authScreen==="login"?handleLogin():handleSignup())} />
            <input className="auth-input" placeholder="Password" type="password" value={authForm.password} onChange={e => setAuthForm(f=>({...f,password:e.target.value}))} onKeyDown={e => e.key==="Enter" && (authScreen==="login"?handleLogin():handleSignup())} />

            {authError && <p style={{ color:"#FF6B6B", fontSize:13, fontFamily:"'JetBrains Mono',monospace", textAlign:"center" }}>{authError}</p>}

            <button className="auth-btn" onClick={authScreen==="login"?handleLogin:handleSignup}>
              {authScreen==="login" ? "SIGN IN →" : "CREATE ACCOUNT →"}
            </button>

            <p style={{ textAlign:"center", color:"rgba(255,255,255,0.4)", fontSize:14 }}>
              {authScreen==="login" ? "No account? " : "Have an account? "}
              <button className="auth-link" onClick={() => { setAuthScreen(authScreen==="login"?"signup":"login"); setAuthError(""); }}>
                {authScreen==="login" ? "Sign up" : "Sign in"}
              </button>
            </p>

            {authScreen === "login" && (
              <p style={{ textAlign:"center", color:"rgba(255,255,255,0.25)", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>
                demo: alex@demo.com / demo123
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main App ───────────────────────────────────────────────────────────────
  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"#0d0d14", fontFamily:"'Crimson Pro',Georgia,serif", color:"#e0e0e8", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; scrollbar-width:thin; scrollbar-color:rgba(245,200,66,0.2) transparent; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:rgba(245,200,66,0.2); border-radius:4px; }
        .sidebar-doc { padding:12px 14px; border-radius:10px; cursor:pointer; transition:background 0.15s; border:1px solid transparent; position:relative; }
        .sidebar-doc:hover { background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.06); }
        .sidebar-doc.active { background:rgba(245,200,66,0.07); border-color:rgba(245,200,66,0.2); }
        .toolbar-btn { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); color:#c0c0cc; padding:5px 10px; border-radius:6px; cursor:pointer; font-family:'JetBrains Mono',monospace; font-size:12px; transition:all 0.15s; white-space:nowrap; }
        .toolbar-btn:hover { background:rgba(245,200,66,0.12); border-color:rgba(245,200,66,0.3); color:#f5c842; }
        .toolbar-btn.active { background:rgba(245,200,66,0.15); border-color:rgba(245,200,66,0.4); color:#f5c842; }
        .view-btn { background:none; border:none; color:rgba(255,255,255,0.35); padding:6px 12px; border-radius:6px; cursor:pointer; font-family:'JetBrains Mono',monospace; font-size:11px; transition:all 0.15s; letter-spacing:0.05em; }
        .view-btn:hover { color:#e0e0e8; background:rgba(255,255,255,0.05); }
        .view-btn.active { color:#f5c842; background:rgba(245,200,66,0.1); }
        .editor-textarea { width:100%; height:100%; resize:none; background:transparent; border:none; outline:none; color:#d8d8e4; font-family:'JetBrains Mono',monospace; font-size:14px; line-height:1.8; padding:32px 40px; caret-color:#f5c842; }
        .preview-area { padding:32px 40px; overflow-y:auto; height:100%; }
        .preview-area h1 { font-size:2em; font-weight:600; color:#f0f0f8; margin-bottom:0.6em; letter-spacing:-0.02em; line-height:1.2; }
        .preview-area h2 { font-size:1.5em; font-weight:600; color:#e0e0ec; margin:1.4em 0 0.5em; border-bottom:1px solid rgba(245,200,66,0.15); padding-bottom:0.3em; }
        .preview-area h3 { font-size:1.2em; font-weight:600; color:#d8d8e8; margin:1.2em 0 0.4em; }
        .preview-area p { line-height:1.8; color:#c0c0cc; margin-bottom:0.8em; font-size:15px; }
        .preview-area strong { color:#e8e8f0; font-weight:600; }
        .preview-area em { color:#d0d0e0; font-style:italic; }
        .preview-area code { background:rgba(245,200,66,0.1); color:#f5c842; padding:2px 7px; border-radius:4px; font-family:'JetBrains Mono',monospace; font-size:0.88em; border:1px solid rgba(245,200,66,0.2); }
        .preview-area blockquote { border-left:3px solid #f5c842; padding:8px 16px; margin:12px 0; background:rgba(245,200,66,0.04); border-radius:0 8px 8px 0; color:#a0a0b0; font-style:italic; }
        .preview-area hr { border:none; border-top:1px solid rgba(255,255,255,0.08); margin:20px 0; }
        .preview-area li { color:#b8b8c8; line-height:1.7; margin-left:20px; list-style:disc; font-size:15px; }
        .preview-area a { color:#f5c842; text-decoration:none; border-bottom:1px solid rgba(245,200,66,0.3); }
        .preview-area a:hover { border-bottom-color:#f5c842; }
        .panel-btn { background:none; border:none; color:rgba(255,255,255,0.3); cursor:pointer; font-family:'JetBrains Mono',monospace; font-size:11px; padding:6px 10px; border-radius:6px; transition:all 0.15s; letter-spacing:0.04em; display:flex; align-items:center; gap:5px; }
        .panel-btn:hover { color:#e0e0e8; background:rgba(255,255,255,0.05); }
        .panel-btn.active { color:#f5c842; background:rgba(245,200,66,0.08); }
        .hist-item { padding:10px 12px; border-radius:8px; cursor:pointer; border:1px solid rgba(255,255,255,0.05); transition:all 0.15s; margin-bottom:6px; }
        .hist-item:hover { background:rgba(245,200,66,0.06); border-color:rgba(245,200,66,0.2); }
        .delete-btn { background:none; border:none; color:rgba(255,80,80,0.4); cursor:pointer; padding:3px 6px; border-radius:4px; font-size:12px; transition:all 0.15s; opacity:0; }
        .sidebar-doc:hover .delete-btn { opacity:1; }
        .delete-btn:hover { color:#FF6B6B; background:rgba(255,80,80,0.1); }
        .peer-dot { width:8px; height:8px; border-radius:50%; animation:pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .status-dot { width:7px; height:7px; border-radius:50%; }
        .new-doc-btn { width:100%; padding:9px; background:rgba(245,200,66,0.08); border:1px dashed rgba(245,200,66,0.25); border-radius:8px; color:#f5c842; cursor:pointer; font-family:'JetBrains Mono',monospace; font-size:12px; transition:all 0.15s; letter-spacing:0.04em; }
        .new-doc-btn:hover { background:rgba(245,200,66,0.14); border-style:solid; }
      `}</style>

      {/* ── Top Nav ── */}
      <div style={{ height:52, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(13,13,20,0.95)", backdropFilter:"blur(12px)", flexShrink:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:28, height:28, background:"linear-gradient(135deg,#f5c842,#e8a020)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>✦</div>
          <span style={{ fontWeight:600, fontSize:16, color:"#e8e8f0", letterSpacing:"-0.01em" }}>CollabDocs</span>
          {activeDoc && (
            <>
              <span style={{ color:"rgba(255,255,255,0.2)", fontSize:16 }}>/</span>
              <input
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                style={{ background:"none", border:"none", outline:"none", color:"#c0c0cc", fontFamily:"'Crimson Pro',serif", fontSize:15, minWidth:120, maxWidth:280 }}
              />
            </>
          )}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {/* WS status */}
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", background:"rgba(78,205,196,0.08)", border:"1px solid rgba(78,205,196,0.15)", borderRadius:20 }}>
            <div className="status-dot" style={{ background:"#4ECDC4", boxShadow:"0 0 6px #4ECDC4" }} />
            <span style={{ color:"#4ECDC4", fontFamily:"'JetBrains Mono',monospace", fontSize:11 }}>LIVE</span>
          </div>

          {/* Peers */}
          {peers.filter(p=>p.active).map(p => (
            <div key={p.id} title={p.name} style={{ width:28, height:28, borderRadius:"50%", background:p.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#0a0a0f", border:"2px solid #0d0d14", cursor:"default" }}>
              {p.name[0]}
            </div>
          ))}
          <div title={currentUser.name} style={{ width:28, height:28, borderRadius:"50%", background:currentUser.color||COLORS[0], display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#0a0a0f", border:"2px solid #f5c842" }}>
            {currentUser.name[0]}
          </div>

          <button onClick={logout} style={{ background:"none", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)", padding:"4px 12px", borderRadius:6, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace", fontSize:11, transition:"all 0.15s" }}
            onMouseOver={e=>{e.target.style.color="#FF6B6B";e.target.style.borderColor="rgba(255,107,107,0.3)"}}
            onMouseOut={e=>{e.target.style.color="rgba(255,255,255,0.4)";e.target.style.borderColor="rgba(255,255,255,0.1)"}}>
            logout
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* Sidebar */}
        <div style={{ width:240, borderRight:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", padding:14, gap:8, overflowY:"auto", flexShrink:0 }}>
          <button className="new-doc-btn" onClick={newDoc}>+ New Document</button>

          <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:"0.1em", padding:"8px 4px 2px", textTransform:"uppercase" }}>My Documents</p>

          {docs.filter(d => d.userId === currentUser.id).map(doc => (
            <div key={doc.id} className={`sidebar-doc ${activeDoc?.id===doc.id?"active":""}`} onClick={() => openDoc(doc)}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:6 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, color: activeDoc?.id===doc.id ? "#f5c842":"#c8c8d8", fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{doc.title}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", fontFamily:"'JetBrains Mono',monospace", marginTop:2 }}>
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <button className="delete-btn" onClick={(e) => deleteDoc(doc.id, e)}>✕</button>
              </div>
            </div>
          ))}

          <div style={{ marginTop:"auto", padding:"8px 4px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:24, height:24, borderRadius:"50%", background:currentUser.color||COLORS[0], display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#0a0a0f" }}>{currentUser.name[0]}</div>
              <div>
                <div style={{ fontSize:12, color:"#c0c0cc" }}>{currentUser.name}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontFamily:"'JetBrains Mono',monospace" }}>{currentUser.email}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Editor Area */}
        {activeDoc ? (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Toolbar */}
            <div style={{ padding:"8px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", flexShrink:0 }}>
              {/* Format btns */}
              {[["bold","B"],["italic","I"],["code","`"],["h1","H1"],["h2","H2"],["quote",'"'],["ul","•"],["hr","—"],["link","⌘"]].map(([cmd,lbl]) => (
                <button key={cmd} className="toolbar-btn" onClick={() => insertMarkdown(cmd)} title={cmd}>{lbl}</button>
              ))}

              <div style={{ flex:1 }} />

              {/* View toggle */}
              <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", borderRadius:8, border:"1px solid rgba(255,255,255,0.07)", padding:3 }}>
                {[["edit","edit"],["split","split"],["preview","preview"]].map(([v,l]) => (
                  <button key={v} className={`view-btn ${view===v?"active":""}`} onClick={() => setView(v)}>{l}</button>
                ))}
              </div>

              {/* Panels */}
              <button className={`panel-btn ${panel==="history"?"active":""}`} onClick={() => setPanel(panel==="history"?"none":"history")}>
                <span>⏱</span> history
              </button>
              <button className={`panel-btn ${panel==="collab"?"active":""}`} onClick={() => setPanel(panel==="collab"?"none":"collab")}>
                <span>👥</span> collab
              </button>

              {/* Save status */}
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color: saving?"#f5c842": saved?"rgba(78,205,196,0.7)":"rgba(255,255,255,0.3)", display:"flex", alignItems:"center", gap:5 }}>
                {saving ? "saving…" : saved ? "✓ saved" : "unsaved"}
              </div>
            </div>

            {/* Editor + Panels */}
            <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

              {/* Editor panes */}
              <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
                {(view==="edit"||view==="split") && (
                  <div style={{ flex:1, overflow:"hidden", borderRight: view==="split"?"1px solid rgba(255,255,255,0.06)":"none" }}>
                    <textarea
                      ref={textareaRef}
                      className="editor-textarea"
                      value={content}
                      onChange={e => handleContentChange(e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                )}
                {(view==="preview"||view==="split") && (
                  <div style={{ flex:1, overflow:"hidden" }}>
                    <div className="preview-area" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
                  </div>
                )}
              </div>

              {/* Side panels */}
              {panel==="history" && (
                <div style={{ width:260, borderLeft:"1px solid rgba(255,255,255,0.06)", padding:16, overflowY:"auto", flexShrink:0 }}>
                  <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"rgba(255,255,255,0.4)", letterSpacing:"0.08em", marginBottom:12, textTransform:"uppercase" }}>Version History</p>
                  {history.map((snap, i) => (
                    <div key={i} className="hist-item">
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#f5c842" }}>{snap.label}</span>
                        <button onClick={() => restoreVersion(snap)} style={{ background:"rgba(245,200,66,0.1)", border:"1px solid rgba(245,200,66,0.2)", color:"#f5c842", padding:"2px 8px", borderRadius:4, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace", fontSize:10 }}>restore</button>
                      </div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", fontFamily:"'JetBrains Mono',monospace" }}>
                        {new Date(snap.timestamp).toLocaleTimeString()}
                      </div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", marginTop:3 }}>
                        {snap.content.slice(0,48).replace(/[#*`]/g,"").trim()}…
                      </div>
                    </div>
                  ))}
                  {history.length===0 && <p style={{ color:"rgba(255,255,255,0.25)", fontSize:13 }}>No history yet.</p>}
                </div>
              )}

              {panel==="collab" && (
                <div style={{ width:260, borderLeft:"1px solid rgba(255,255,255,0.06)", padding:16, overflowY:"auto", flexShrink:0 }}>
                  <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"rgba(255,255,255,0.4)", letterSpacing:"0.08em", marginBottom:12, textTransform:"uppercase" }}>Collaborators</p>

                  {/* Current user */}
                  <div style={{ padding:"10px 12px", background:"rgba(245,200,66,0.06)", border:"1px solid rgba(245,200,66,0.15)", borderRadius:8, marginBottom:8, display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:30, height:30, borderRadius:"50%", background:currentUser.color||COLORS[0], display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#0a0a0f" }}>{currentUser.name[0]}</div>
                    <div>
                      <div style={{ fontSize:13, color:"#e0e0e8" }}>{currentUser.name} <span style={{ fontSize:11, color:"rgba(245,200,66,0.6)" }}>(you)</span></div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", fontFamily:"'JetBrains Mono',monospace" }}>editing</div>
                    </div>
                  </div>

                  {peers.map(p => (
                    <div key={p.id} style={{ padding:"10px 12px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8, marginBottom:8, display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ position:"relative" }}>
                        <div style={{ width:30, height:30, borderRadius:"50%", background:p.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#0a0a0f" }}>{p.name[0]}</div>
                        <div style={{ position:"absolute", bottom:0, right:0, width:9, height:9, borderRadius:"50%", background: p.active?"#4ECDC4":"rgba(255,255,255,0.2)", border:"1.5px solid #0d0d14" }} />
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, color:"#c0c0cc" }}>{p.name}</div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", fontFamily:"'JetBrains Mono',monospace" }}>
                          {p.active ? `cursor: ${p.cursor}` : "away"}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* OT stats */}
                  <div style={{ marginTop:16, padding:"12px", background:"rgba(78,205,196,0.04)", border:"1px solid rgba(78,205,196,0.1)", borderRadius:8 }}>
                    <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"rgba(78,205,196,0.6)", letterSpacing:"0.08em", marginBottom:8, textTransform:"uppercase" }}>OT Engine</p>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>version</span>
                      <span style={{ fontSize:12, color:"#4ECDC4", fontFamily:"'JetBrains Mono',monospace" }}>v{otRef.current.version}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>ops</span>
                      <span style={{ fontSize:12, color:"#4ECDC4", fontFamily:"'JetBrains Mono',monospace" }}>{otRef.current.history.length}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>words</span>
                      <span style={{ fontSize:12, color:"#4ECDC4", fontFamily:"'JetBrains Mono',monospace" }}>{wordCount}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom status bar */}
            <div style={{ height:28, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", borderTop:"1px solid rgba(255,255,255,0.05)", background:"rgba(0,0,0,0.3)", flexShrink:0 }}>
              <div style={{ display:"flex", gap:16 }}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"rgba(255,255,255,0.25)" }}>
                  {content.length} chars · {wordCount} words
                </span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"rgba(255,255,255,0.25)" }}>
                  v{otRef.current.version}
                </span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div className="peer-dot" style={{ background:"#4ECDC4" }} />
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"rgba(78,205,196,0.6)" }}>
                  {peers.filter(p=>p.active).length + 1} user{peers.filter(p=>p.active).length>0?"s":""} online
                </span>
              </div>
            </div>
          </div>
        ) : (
          // No doc selected
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:48, opacity:0.15 }}>✦</div>
            <p style={{ color:"rgba(255,255,255,0.2)", fontSize:18 }}>Select a document or create a new one</p>
            <button className="new-doc-btn" style={{ width:200 }} onClick={newDoc}>+ New Document</button>
          </div>
        )}
      </div>
    </div>
  );
}