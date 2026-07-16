"use client";
import { useEffect, useMemo, useRef, useState } from "react";

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
  :root{
    --bg:#f4f6f8; --panel:#ffffff; --panel-2:#f7f9fb; --line:#e4e9ed; --line-soft:#edf1f4;
    --text:#1c2530; --text-dim:#6b7787; --text-faint:#9aa5b1;
    --accent:#c9972b; --accent-2:#8a6415; --accent-dim:#f8ecd0;
    --graphite:#52565c; --graphite-bg:#eceef0; --red:#d1453d; --red-bg:#fbeaea; --green:#1fa15c; --blue:#2f7fe0;
    --mono:'IBM Plex Mono', ui-monospace, monospace; --sans:'Inter', ui-sans-serif, sans-serif;
    --shadow:0 1px 2px rgba(20,30,40,0.04), 0 6px 20px -10px rgba(20,30,40,0.08);
  }
  *{ box-sizing:border-box; }
  body{ background:var(--bg); color:var(--text); font-family:var(--sans); margin:0; }
  .app{ display:flex; min-height:100vh; }
  .sidebar{ width:232px; flex:none; background:var(--panel); border-right:1px solid var(--line); padding:18px 14px; display:flex; flex-direction:column; gap:22px; }
  .brand{ display:flex; flex-direction:column; align-items:center; gap:8px; padding:10px 4px; }
  .brand-logo{ width:56px; height:56px; border-radius:14px; background:linear-gradient(160deg,var(--accent),var(--accent-2)); display:flex; align-items:center; justify-content:center; font-size:26px; box-shadow:0 6px 16px -6px rgba(201,151,43,0.5); }
  .brand-text{ text-align:center; line-height:1.3; }
  .brand-text b{ font-size:13px; font-weight:800; display:block; }
  .brand-text span{ font-size:9.5px; color:var(--text-faint); font-family:var(--mono); letter-spacing:0.5px; }
  .nav-title{ font-size:10.5px; text-transform:uppercase; letter-spacing:1px; color:var(--text-faint); font-weight:700; padding:0 8px; }
  .nav{ display:flex; flex-direction:column; gap:3px; margin-top:8px; }
  .nav-item{ display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:8px; font-size:13px; font-weight:600; color:var(--text-dim); cursor:pointer; border:1px solid transparent; transition:all .15s ease; }
  .nav-item:hover{ background:var(--panel-2); color:var(--text); }
  .nav-item.active{ background:var(--accent-dim); color:#7a5a12; border-color:#eddca2; }
  
  .badge { background: var(--red); color: #fff; border-radius: 10px; padding: 2px 6px; font-size: 10px; margin-left: auto; font-weight: 700; line-height: 1; }
  .ignore-panel { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
  .ignore-header h2 { margin: 0 0 8px 0; font-size: 18px; color: var(--text); }
  .ignore-header p { margin: 0; font-size: 13px; color: var(--text-faint); }
  .ignore-input-group { display: flex; gap: 10px; }
  .ignore-input { flex: 1; padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel-2); font-family: var(--sans); font-size: 14px; color: var(--text); outline: none; transition: border .2s; }
  .ignore-input:focus { border-color: var(--blue); }
  .ignore-select { width: 160px; padding: 12px 16px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel-2); font-family: var(--sans); font-size: 13px; color: var(--text); outline: none; cursor: pointer; }
  .ignore-select:focus { border-color: var(--blue); }
  .ignore-btn { padding: 0 20px; background: var(--red); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: opacity .2s; }
  .ignore-btn:hover { opacity: 0.9; }
  .ignore-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .ignore-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--panel); border-bottom: 1px solid var(--line); font-family: var(--mono); font-size: 13px; color: var(--text-dim); }
  .ignore-item:last-child { border-bottom: none; }
  .ignore-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; font-weight: 600; text-transform: uppercase; transition: color .2s; }
  .ignore-remove:hover { color: var(--red); }
  .ignore-empty { padding: 20px; text-align: center; font-size: 13px; color: var(--text-faint); }
  .search-bar { position: relative; flex: 1; display: flex; }
  .search-bar input { flex: 1; padding-left: 36px; }
  .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; opacity: 0.5; }

  .health-mini{ display:flex; flex-direction:column; gap:7px; padding:12px 10px; background:var(--panel-2); border:1px solid var(--line); border-radius:10px; margin-top:auto; }
  .health-mini-title{ font-size:10px; text-transform:uppercase; color:var(--text-faint); font-weight:700; }
  .health-row{ display:flex; align-items:center; gap:8px; font-size:11.5px; color:var(--text-dim); font-family:var(--mono); }
  .health-row b{ color:var(--text); font-weight:600; margin-left:auto; }
  .dot{ width:7px; height:7px; border-radius:50%; background:var(--text-faint); flex:none; }
  .dot.on{ background:var(--green); box-shadow:0 0 0 3px rgba(31,161,92,0.15); animation:pulse 1.8s infinite; }
  .dot.off{ background:var(--red); box-shadow:0 0 0 3px rgba(209,69,61,0.13); }
  @keyframes pulse{ 0%,100%{opacity:1;} 50%{opacity:.4;} }
  .main{ flex:1; min-width:0; padding:18px 24px 28px; display:flex; flex-direction:column; gap:16px; }
  .panel{ background:var(--panel); border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow); }
  .topbar{ display:flex; align-items:center; gap:20px; padding:14px 20px; flex-wrap:wrap; }
  .page-title b{ font-size:16px; font-weight:800; display:block; }
  .page-title span{ font-size:11.5px; color:var(--text-faint); }
  .status-pill{ display:flex; align-items:center; gap:8px; padding:6px 13px 6px 10px; border-radius:999px; border:1px solid var(--line); background:var(--panel-2); font-family:var(--mono); font-size:12px; font-weight:700; letter-spacing:0.3px; }
  .uptime{ font-family:var(--mono); font-size:12px; color:var(--text-dim); line-height:1.2; }
  .uptime b{ display:block; color:var(--text); font-size:14.5px; font-weight:700; }
  .uptime small{ font-size:9.5px; text-transform:uppercase; letter-spacing:0.8px; color:var(--text-faint); }
  .spacer{ flex:1; }
  .stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
  @media (max-width:900px){ .stats{ grid-template-columns:repeat(2,1fr); } }
  .stat{ padding:16px 18px; display:flex; flex-direction:column; gap:9px; }
  .stat-top{ display:flex; align-items:center; justify-content:space-between; }
  .stat-label{ font-size:11px; text-transform:uppercase; letter-spacing:0.6px; color:var(--text-faint); font-weight:700; }
  .stat-icon{ width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; }
  .stat.scanned .stat-icon{ background:#e7f6ff; color:var(--blue); }
  .stat.tokens .stat-icon{ background:var(--accent-dim); color:var(--accent); }
  .stat.tickets .stat-icon{ background:var(--graphite-bg); color:var(--graphite); }
  .stat.errors .stat-icon{ background:var(--red-bg); color:var(--red); }
  .stat-value{ font-family:var(--mono); font-size:29px; font-weight:700; letter-spacing:-0.5px; }
  .stat-sub{ font-size:11.5px; color:var(--text-faint); }
  .charts-row{ display:grid; grid-template-columns:1.4fr 1fr; gap:14px; }
  @media (max-width:900px){ .charts-row{ grid-template-columns:1fr; } }
  .chart-card{ padding:16px 18px 12px; display:flex; flex-direction:column; gap:10px; }
  .chart-head{ display:flex; align-items:center; justify-content:space-between; }
  .chart-head b{ font-size:13px; font-weight:700; }
  .chart-head span{ font-size:11px; color:var(--text-faint); font-family:var(--mono); }
  .legend{ display:flex; gap:12px; font-size:11px; color:var(--text-dim); }
  .legend i{ display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:5px; }
  .health{ display:flex; align-items:center; gap:10px; padding:13px 18px; flex-wrap:wrap; }
  .health-title{ font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:var(--text-faint); font-weight:700; margin-right:4px; }
  .health-item{ display:flex; align-items:center; gap:8px; padding:7px 13px; border-radius:8px; background:var(--panel-2); border:1px solid var(--line); font-size:12px; font-family:var(--mono); color:var(--text-dim); }
  .health-item b{ color:var(--text); font-weight:600; }
  .term-wrap{ display:flex; flex-direction:column; height:560px; overflow:hidden; }
  .term-tabbar{ display:flex; align-items:center; gap:8px; padding:0 10px; height:42px; background:#f1f3f5; border-bottom:1px solid var(--line); border-radius:12px 12px 0 0; }
  .traffic{ display:flex; gap:6px; margin-right:6px; }
  .traffic span{ width:10px; height:10px; border-radius:50%; display:block; }
  .term-tab{ display:flex; align-items:center; gap:7px; font-family:var(--mono); font-size:12px; color:var(--text-dim); padding:8px 12px; }
  .term-tab .dotsmall{ width:6px; height:6px; border-radius:50%; background:var(--green); }
  .term-spacer{ flex:1; }
  .term-body{ flex:1; overflow-y:auto; background:#12161b; padding:12px 14px; font-family:var(--mono); font-size:12.5px; line-height:1.65; }
  .term-line{ white-space:pre-wrap; word-break:break-word; display:flex; gap:8px; }
  .term-line .ts{ color:#5a6672; flex:none; }
  .term-line.info .msg{ color:#d7dde2; }
  .term-line.ok .msg{ color:#5fdc9a; }
  .term-line.warn .msg{ color:#f0b658; }
  .term-line.err .msg{ color:#ef6b64; }
  .term-line.sys .msg{ color:#57d8c4; }
  .no-data{ padding:16px 20px; color:var(--red); font-family:var(--mono); font-size:12.5px; }
`;

function timeStr(ts) { return new Date(ts).toTimeString().slice(0, 8); }
function pad(n) { return String(n).padStart(2, '0'); }

function LineChart({ history }) {
  const w = 620, h = 170, p = 18;
  let cum = [], run = 0;
  for (let i = 0; i < history.length; i++) { run = run * 0.55 + history[i] * 3.2; cum.push(run); }
  const max = Math.max(1, ...cum);
  const stepX = (w - p * 2) / Math.max(1, cum.length - 1);
  const pts = cum.map((v, i) => [p + i * stepX, h - p - (v / max) * (h - p * 2)]);
  const path = pts.length ? 'M' + pts.map(pt => pt[0].toFixed(1) + ',' + pt[1].toFixed(1)).join(' L') : '';
  const area = pts.length ? path + ` L${pts[pts.length - 1][0]},${h - p} L${pts[0][0]},${h - p} Z` : '';
  let grid = '';
  for (let i = 1; i < 4; i++) { const y = p + i * ((h - p * 2) / 4); grid += `<line x1="${p}" y1="${y}" x2="${w - p}" y2="${y}" stroke="#eef1f4" stroke-width="1"/>`; }
  const last = pts[pts.length - 1] || [p, h - p];
  const svg = `
    <defs><linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c9972b" stop-opacity="0.30"/><stop offset="100%" stop-color="#c9972b" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#fillGrad)"/>
    <path d="${path}" fill="none" stroke="#c9972b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="#c9972b" stroke="#fff" stroke-width="2"/>
  `;
  return <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '170px' }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

function BarChart({ stats }) {
  const w = 260, h = 170, baseY = h - 24;
  const vals = [
    { label: 'Tokens', v: stats.tokens, color: '#c9972b' },
    { label: 'Tickets', v: stats.tickets, color: '#52565c' },
    { label: 'Errors', v: stats.errors, color: '#d1453d' },
  ];
  const max = Math.max(1, ...vals.map(v => v.v));
  const bw = 46, gap = (w - bw * 3) / 4;
  let bars = `<line x1="0" y1="${baseY}" x2="${w}" y2="${baseY}" stroke="#eef1f4" stroke-width="1"/>`;
  vals.forEach((v, i) => {
    const x = gap + i * (bw + gap);
    const bh = (v.v / max) * (baseY - 16);
    const y = baseY - bh;
    bars += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6" fill="${v.color}" opacity="0.9"/>`;
    bars += `<text x="${x + bw / 2}" y="${y - 7}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="12" font-weight="600" fill="#1c2530">${v.v}</text>`;
    bars += `<text x="${x + bw / 2}" y="${baseY + 15}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" fill="#9aa5b1">${v.label}</text>`;
  });
  return <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '170px' }} dangerouslySetInnerHTML={{ __html: bars }} />;
}

export default function Dashboard() {
  const [section, setSection] = useState('overview');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(new Array(24).fill(0));
  const termRef = useRef(null);
  const prevScanned = useRef(0);

  const [ignoreList, setIgnoreList] = useState([]);
  const [newIgnoreEmail, setNewIgnoreEmail] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  useEffect(() => {
    fetch('/api/ignore-list')
      .then(res => res.json())
      .then(data => setIgnoreList(data || []))
      .catch(() => console.log('Failed to fetch ignore list'));
  }, []);

  const handleIgnoreAction = async (action, email) => {
    if (action === 'add' && !email) return;
    const res = await fetch('/api/ignore-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, email })
    });
    const updatedList = await res.json();
    setIgnoreList(updatedList);
    setNewIgnoreEmail('');
  };

  const processedIgnoreList = useMemo(() => {
    let filtered = ignoreList.filter(email => 
      email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (sortOrder === 'newest') {
      filtered = [...filtered].reverse();
    } else if (sortOrder === 'oldest') {
      // already oldest first from api
    } else if (sortOrder === 'az') {
      filtered = [...filtered].sort((a, b) => a.localeCompare(b));
    } else if (sortOrder === 'za') {
      filtered = [...filtered].sort((a, b) => b.localeCompare(a));
    }
    
    return filtered;
  }, [ignoreList, searchQuery, sortOrder]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/stats', { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        if (json.ok) {
          setError(null);
          const scanned = json.stats?.scanned || 0;
          const delta = Math.max(0, scanned - prevScanned.current);
          prevScanned.current = scanned;
          setHistory(h => { const nh = [...h.slice(1), delta]; return nh; });
          setData(json);
        } else {
          setError(json.message);
        }
      } catch (e) {}
    }
    poll();
    const t = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [data]);

  const isRunning = !!(data && data.lastHeartbeat && Date.now() - data.lastHeartbeat < 15000);
  const stats = data?.stats || { scanned: 0, tokens: 0, tickets: 0, errors: 0 };
  const health = data?.health || { imap: false, radius: false, ticket: false };
  const logs = data?.logs || [];
  const uptimeSec = data?.startedAt ? Math.max(0, Math.floor((Date.now() - data.startedAt) / 1000)) : 0;
  const uptimeStr = `${pad(Math.floor(uptimeSec / 3600))}:${pad(Math.floor((uptimeSec % 3600) / 60))}:${pad(uptimeSec % 60)}`;

  const titles = {
    overview: ['Overview', 'Live status of the automation bot — real data'],
    console: ['Live Console', 'Real console output from index.js'],
    ignore: ['Ignore List', 'Manage emails that the bot should ignore completely'],
  };

  return (
    <div className="app">
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />

      <div className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="Circle Network" style={{ width: '100%', maxWidth: '150px', height: 'auto', display: 'block' }} />
          <div className="brand-text"><b>R-T-M Dual Engine</b><span>CONTROL CONSOLE</span></div>
        </div>
        <div>
          <div className="nav-title">Sections</div>
          <div className="nav">
            <div className={`nav-item ${section === 'overview' ? 'active' : ''}`} onClick={() => setSection('overview')}><span>📊</span> Overview</div>
            <div className={`nav-item ${section === 'console' ? 'active' : ''}`} onClick={() => setSection('console')}><span>💻</span> Live Console</div>
            <div className={`nav-item ${section === 'ignore' ? 'active' : ''}`} onClick={() => setSection('ignore')}>
                <span>🚫</span> Ignore List
                {ignoreList.length > 0 && <span className="badge">{ignoreList.length}</span>}
            </div>
          </div>
        </div>
        <div className="health-mini">
          <div className="health-mini-title">System Health</div>
          <div className="health-row"><span className={`dot ${health.imap ? 'on' : 'off'}`}></span> IMAP (Gmail) <b>{health.imap ? 'Connected' : 'Offline'}</b></div>
          <div className="health-row"><span className={`dot ${health.radius ? 'on' : 'off'}`}></span> Radius API <b>{health.radius ? 'Connected' : 'Offline'}</b></div>
          <div className="health-row"><span className={`dot ${health.ticket ? 'on' : 'off'}`}></span> Ticket API <b>{health.ticket ? 'Connected' : 'Offline'}</b></div>
        </div>
      </div>

      <div className="main">
        <div className="panel topbar">
          <div className="page-title"><b>{titles[section][0]}</b><span>{titles[section][1]}</span></div>
          <div className="status-pill"><span className={`dot ${isRunning ? 'on' : 'off'}`}></span><span>{error ? 'NO DATA' : isRunning ? 'ACTIVE' : 'STOPPED'}</span></div>
          <div className="uptime"><small>Uptime</small><b>{uptimeStr}</b></div>
          <div className="spacer"></div>
        </div>

        {error && <div className="panel no-data">{error}</div>}

        {section === 'overview' && (
          <>
            <div className="stats">
              <div className="panel stat scanned">
                <div className="stat-top"><span className="stat-label">Emails Scanned</span><span className="stat-icon">✉</span></div>
                <div className="stat-value">{stats.scanned}</div>
                <div className="stat-sub">{isRunning ? 'listening — real-time' : 'idle'}</div>
              </div>
              <div className="panel stat tokens">
                <div className="stat-top"><span className="stat-label">Radius Tokens</span><span className="stat-icon">⚙</span></div>
                <div className="stat-value">{stats.tokens}</div>
                <div className="stat-sub">{stats.tokens} total (since start)</div>
              </div>
              <div className="panel stat tickets">
                <div className="stat-top"><span className="stat-label">Tickets Created</span><span className="stat-icon">🎫</span></div>
                <div className="stat-value">{stats.tickets}</div>
                <div className="stat-sub">{stats.tickets} total (since start)</div>
              </div>
              <div className="panel stat errors">
                <div className="stat-top"><span className="stat-label">Errors / Skipped</span><span className="stat-icon">⚠</span></div>
                <div className="stat-value">{stats.errors}</div>
                <div className="stat-sub">{stats.errors} total (since start)</div>
              </div>
            </div>

            <div className="charts-row">
              <div className="panel chart-card">
                <div className="chart-head"><b>Email Activity</b><span>live — per poll</span></div>
                <LineChart history={history} />
              </div>
              <div className="panel chart-card">
                <div className="chart-head"><b>Outcome Breakdown</b></div>
                <BarChart stats={stats} />
                <div className="legend">
                  <span><i style={{ background: 'var(--accent)' }}></i>Tokens</span>
                  <span><i style={{ background: 'var(--graphite)' }}></i>Tickets</span>
                  <span><i style={{ background: 'var(--red)' }}></i>Errors</span>
                </div>
              </div>
            </div>

            <div className="panel health">
              <span className="health-title">System Health</span>
              <div className="health-item">IMAP: <b>{health.imap ? 'Connected' : 'Offline'}</b></div>
              <div className="health-item">Radius API: <b>{health.radius ? 'Connected' : 'Offline'}</b></div>
              <div className="health-item">Ticket API: <b>{health.ticket ? 'Connected' : 'Offline'}</b></div>
            </div>
          </>
        )}

        {section === 'console' && (
          <div className="panel term-wrap">
            <div className="term-tabbar">
              <div className="traffic"><span style={{ background: '#ff5f57' }}></span><span style={{ background: '#febc2e' }}></span><span style={{ background: '#28c840' }}></span></div>
              <div className="term-tab"><span className="dotsmall"></span> bash — rtm-dual-engine (real logs)</div>
              <div className="term-spacer"></div>
            </div>
            <div className="term-body" ref={termRef}>
              {logs.length === 0 && <div className="term-line info"><span className="msg">কোনো লগ এখনো নেই — বট চালু হলে এখানে সত্যিকারের console output দেখা যাবে।</span></div>}
              {logs.map((l, i) => (
                <div className={`term-line ${l.type}`} key={i}>
                  <span className="ts">{timeStr(l.ts)}</span>
                  <span className="msg">{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'ignore' && (
          <div className="panel ignore-panel">
            <div className="ignore-header">
              <h2>🚫 Ignore List Management</h2>
              <p>Add spam or promotional email addresses here. The bot will instantly ignore them without processing.</p>
            </div>
            
            <div className="ignore-input-group">
              <input 
                  type="email" 
                  placeholder="Type an email to block (e.g. spammer@promotions.com)" 
                  className="ignore-input"
                  value={newIgnoreEmail}
                  onChange={(e) => setNewIgnoreEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleIgnoreAction('add', newIgnoreEmail)}
              />
              <button 
                  onClick={() => handleIgnoreAction('add', newIgnoreEmail)}
                  className="ignore-btn"
              >
                  Block Email
              </button>
            </div>

            {ignoreList.length > 0 && (
                <div className="ignore-input-group" style={{ marginTop: '10px' }}>
                    <div className="search-bar">
                        <span className="search-icon">🔍</span>
                        <input 
                            type="text" 
                            placeholder="Search in blocked emails..." 
                            className="ignore-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select 
                        className="ignore-select"
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="az">A - Z</option>
                        <option value="za">Z - A</option>
                    </select>
                </div>
            )}

            <ul className="ignore-list">
              {processedIgnoreList.map((email, idx) => (
                  <li key={idx} className="ignore-item">
                      <span>{email}</span>
                      <button 
                          onClick={() => handleIgnoreAction('remove', email)}
                          className="ignore-remove"
                      >
                          Unblock
                      </button>
                  </li>
              ))}
              
              {ignoreList.length === 0 && (
                  <li className="ignore-empty">No emails are currently blocked.</li>
              )}
              
              {ignoreList.length > 0 && processedIgnoreList.length === 0 && (
                  <li className="ignore-empty text-red-500">No emails matched your search "{searchQuery}" ❌</li>
              )}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}