import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./api";

const ROUTES = [
  { href: "/", label: "Dashboard" },
  { href: "/inbox", label: "Unified Inbox" },
  { href: "/conversations", label: "Conversations" },
  { href: "/pending", label: "Pending Replies" },
  { href: "/platforms", label: "Platforms" },
  { href: "/free4talk", label: "Free4Talk" },
  { href: "/teams", label: "Teams" },
  { href: "/sent", label: "Sent Messages" },
  { href: "/activity", label: "Agent Activity" },
  { href: "/style", label: "My Style" },
  { href: "/memory", label: "Memory" },
  { href: "/settings", label: "Settings" },
];

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const go = (href: string) => {
    history.pushState({}, "", href);
    setPath(href);
  };
  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          Personal AI
          <br />
          Messaging Agent
        </div>
        <nav className="nav">
          <div className="section">Desk</div>
          {ROUTES.slice(0, 4).map((r) => (
            <a key={r.href} className={path === r.href || (r.href !== "/" && path.startsWith(r.href)) ? "active" : ""} href={r.href} onClick={(e) => { e.preventDefault(); go(r.href); }}>
              {r.label}
            </a>
          ))}
          <div className="section">Platforms</div>
          {ROUTES.slice(4, 7).map((r) => (
            <a key={r.href} className={path === r.href ? "active" : ""} href={r.href} onClick={(e) => { e.preventDefault(); go(r.href); }}>
              {r.label}
            </a>
          ))}
          <div className="section">Agent</div>
          {ROUTES.slice(7).map((r) => (
            <a key={r.href} className={path === r.href ? "active" : ""} href={r.href} onClick={(e) => { e.preventDefault(); go(r.href); }}>
              {r.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="main">
        <Page path={path} go={go} />
      </main>
    </div>
  );
}

function Page({ path, go }: { path: string; go: (h: string) => void }) {
  if (path.startsWith("/conversations/") && path !== "/conversations") {
    return <ConversationPage id={path.split("/")[2]} go={go} />;
  }
  switch (path) {
    case "/inbox":
      return <InboxPage go={go} />;
    case "/conversations":
      return <InboxPage go={go} title="Conversations" />;
    case "/pending":
      return <PendingPage />;
    case "/platforms":
      return <PlatformsPage />;
    case "/free4talk":
      return <PlatformDetail id="free4talk" />;
    case "/teams":
      return <PlatformDetail id="teams" />;
    case "/sent":
      return <SentPage />;
    case "/activity":
      return <ActivityPage />;
    case "/style":
      return <StylePage />;
    case "/memory":
      return <MemoryPage />;
    case "/settings":
      return <SettingsPage />;
    default:
      return <Dashboard go={go} />;
  }
}

function Shell({ title, sub, extra }: { title: string; sub: string; extra?: ReactNode }) {
  const [dash, setDash] = useState<any>(null);
  useEffect(() => {
    api("/api/dashboard").then(setDash).catch(() => undefined);
  }, []);
  return (
    <>
      <div className="top">
        <div>
          <h1>{title}</h1>
          <p className="sub">{sub}</p>
        </div>
        <div className="stack" style={{ alignItems: "flex-end" }}>
          {dash?.settings?.emergencyStop ? <div className="banner halt">STOP ALL AGENTS is on. Nothing will send.</div> : null}
          {dash?.simulationBanner && !dash?.settings?.emergencyStop ? (
            <div className="banner">Simulation is on. Live send is off. Approve drafts locally until you explicitly enable live send in Settings.</div>
          ) : null}
          {extra}
        </div>
      </div>
    </>
  );
}

function Dashboard({ go }: { go: (h: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const refresh = () => api("/api/dashboard").then(setData).catch((e) => setErr(e.message));
  useEffect(() => { refresh(); }, []);
  const stop = async () => { await api("/api/emergency-stop", { method: "POST" }); refresh(); };
  const resume = async () => { await api("/api/emergency-resume", { method: "POST" }); refresh(); };
  const tick = async () => { await api("/api/agent/tick", { method: "POST" }); refresh(); };
  return (
    <>
      <Shell title="Dashboard" sub="Local desk. Shared AI brain. Independent connectors." extra={
        <div className="row">
          <button className="danger" onClick={stop}>STOP ALL AGENTS</button>
          <button onClick={resume}>Resume</button>
          <button className="primary" onClick={tick}>Run tick</button>
        </div>
      } />
      {err ? <p className="pill bad">{err}</p> : null}
      <div className="grid">
        <div className="card"><h2>Mode</h2><div className="value">{data?.settings?.mode || "—"}</div></div>
        <div className="card"><h2>Pending drafts</h2><div className="value">{data?.pendingDrafts ?? "—"}</div></div>
        <div className="card"><h2>Conversations</h2><div className="value">{data?.conversationCount ?? "—"}</div></div>
        <div className="card"><h2>Recorded sends</h2><div className="value">{data?.sentCount ?? "—"}</div></div>
      </div>
      <div className="stack" style={{ marginTop: 18 }}>
        {(data?.platforms || []).map((p: any) => (
          <div className="card" key={p.id}>
            <h2>{p.id}</h2>
            <p><span className={`pill ${p.status === "connected" ? "ok" : "warn"}`}>{p.status}</span> {p.message}</p>
            <button onClick={() => go(p.id === "teams" ? "/teams" : "/free4talk")}>Open {p.id}</button>
          </div>
        ))}
      </div>
    </>
  );
}

function InboxPage({ go, title = "Unified Inbox" }: { go: (h: string) => void; title?: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api("/api/inbox").then(setData); }, []);
  return (
    <>
      <Shell title={title} sub="Normalized conversations from connectors. Free4Talk stays empty until an official API exists." />
      <table>
        <thead><tr><th>Platform</th><th>Title</th><th>Category</th><th>Last</th></tr></thead>
        <tbody>
          {(data?.conversations || []).map((c: any) => (
            <tr key={c.id}>
              <td>{c.platform}</td>
              <td><a href={`/conversations/${c.id}`} onClick={(e) => { e.preventDefault(); go(`/conversations/${c.id}`); }}>{c.title}</a></td>
              <td>{c.category}</td>
              <td className="muted">{c.last_body || c.last_message_at || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data?.conversations?.length ? <p className="muted">No conversations stored yet. Connect Teams and run a tick, or wait — Free4Talk cannot populate this inbox.</p> : null}
    </>
  );
}

function ConversationPage({ id, go }: { id: string; go: (h: string) => void }) {
  const [data, setData] = useState<any>(null);
  const refresh = () => api(`/api/conversations/${id}`).then(setData);
  useEffect(() => { refresh(); }, [id]);
  if (!data?.conversation) return <Shell title="Conversation" sub="Loading…" />;
  const c = data.conversation;
  return (
    <>
      <Shell title={c.title} sub={`${c.platform} · ${c.external_id}`} extra={<button onClick={() => go("/inbox")}>Back to inbox</button>} />
      <div className="row" style={{ marginBottom: 12 }}>
        <button onClick={() => api(`/api/conversations/${id}/category`, { method: "POST", body: JSON.stringify({ category: "work" }) }).then(refresh)}>Work</button>
        <button onClick={() => api(`/api/conversations/${id}/category`, { method: "POST", body: JSON.stringify({ category: "personal" }) }).then(refresh)}>Personal</button>
        <button onClick={() => api(`/api/conversations/${id}/auto`, { method: "POST", body: JSON.stringify({ auto: !c.auto_enabled }) }).then(refresh)}>
          Auto {c.auto_enabled ? "on" : "off"} (opt-in)
        </button>
        <span className="pill">{c.category}</span>
      </div>
      <div className="stack">
        {data.messages.map((m: any) => (
          <div className="card" key={m.id}>
            <h2>{m.direction} · {m.sender_name || m.sender_id || "unknown"}</h2>
            <p>{m.body}</p>
            <p className="muted">{m.sent_at}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function PendingPage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const refresh = () => api("/api/drafts").then(setData);
  useEffect(() => { refresh(); }, []);
  const act = async (id: string, action: "approve" | "reject") => {
    setErr("");
    try {
      await api(`/api/drafts/${id}/${action}`, { method: "POST" });
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <>
      <Shell title="Pending Replies" sub="Default mode is Approval. Nothing leaves the machine until you approve, and live send is still off in simulation." />
      {err ? <p className="pill bad">{err}</p> : null}
      {(data?.drafts || []).filter((d: any) => d.status === "pending").map((d: any) => (
        <div className="card" key={d.id} style={{ marginBottom: 12 }}>
          <h2>{d.platform} · {d.conversation_title || d.conversation_id}</h2>
          <textarea defaultValue={d.body} onBlur={(e) => api(`/api/drafts/${d.id}/edit`, { method: "POST", body: JSON.stringify({ body: e.target.value }) })} />
          <p className="muted">{d.reason} · {d.language} · confidence {d.confidence}</p>
          <div className="row">
            <button className="good" onClick={() => act(d.id, "approve")}>Approve</button>
            <button className="danger" onClick={() => act(d.id, "reject")}>Reject</button>
          </div>
        </div>
      ))}
      {!data?.drafts?.filter((d: any) => d.status === "pending").length ? <p className="muted">No pending drafts.</p> : null}
    </>
  );
}

function PlatformsPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api("/api/platforms").then(setData); }, []);
  return (
    <>
      <Shell title="Platforms" sub="Connectors only. The AI brain does not know platform APIs." />
      {(data?.platforms || []).map((p: any) => (
        <div className="card" key={p.id} style={{ marginBottom: 12 }}>
          <h2>{p.id}</h2>
          <p><span className={`pill ${p.status === "connected" ? "ok" : "warn"}`}>{p.status}</span> {p.message}</p>
          {!p.integration?.available ? (
            <div>
              <p className="pill bad">Integration unavailable</p>
              <pre>{JSON.stringify(p.integration, null, 2)}</pre>
            </div>
          ) : <p className="muted">Official API path available when configured.</p>}
        </div>
      ))}
    </>
  );
}

function PlatformDetail({ id }: { id: "free4talk" | "teams" }) {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const refresh = () => api("/api/platforms").then(setData);
  useEffect(() => { refresh(); }, []);
  const p = (data?.platforms || []).find((x: any) => x.id === id);
  const call = async (path: string) => {
    setBusy(path);
    try {
      await api(path, { method: "POST" });
      await refresh();
    } finally {
      setBusy("");
    }
  };
  const open = async () => {
    const r = await api<{ url: string }>(`/api/platforms/${id}/open`);
    window.open(r.url, "_blank", "noopener");
  };
  return (
    <>
      <Shell title={id === "teams" ? "Microsoft Teams" : "Free4Talk"} sub="Session controls. No passwords collected here." />
      {!p ? <p>Loading…</p> : (
        <div className="stack">
          <div className="card">
            <h2>Session status</h2>
            <p><span className={`pill ${p.status === "connected" ? "ok" : "warn"}`}>{p.status}</span></p>
            <p>{p.message}</p>
            {p.deviceLogin ? (
              <div className="banner">
                Open <strong>{p.deviceLogin.verificationUri}</strong> and enter <strong>{p.deviceLogin.userCode}</strong>. Sign in with your work or school account on Microsoft’s page — not here.
              </div>
            ) : null}
            <div className="row">
              <button className="primary" disabled={!!busy} onClick={() => call(`/api/platforms/${id}/connect`)}>Connect</button>
              <button disabled={!!busy} onClick={() => call(`/api/platforms/${id}/disconnect`)}>Disconnect</button>
              <button disabled={!!busy} onClick={() => call(`/api/platforms/${id}/reconnect`)}>Reconnect</button>
              <button disabled={!!busy} onClick={() => call(`/api/platforms/${id}/logout`)}>Logout</button>
              <button onClick={open}>Open Platform</button>
              <button onClick={() => call(`/api/platforms/${id}/pause`)}>Pause</button>
              <button onClick={() => call(`/api/platforms/${id}/resume`)}>Resume</button>
            </div>
          </div>
          {p.integration ? (
            <div className="card">
              <h2>
                {p.status === "not_configured"
                  ? "Not configured"
                  : p.integration.available
                    ? "Official API"
                    : "Integration unavailable"}
              </h2>
              <p>{p.integration.reason}</p>
              <p className="muted">Exists</p>
              <ul>{(p.integration.exists || []).map((x: string) => <li key={x}>{x}</li>)}</ul>
              <p className="muted">Does not exist / not used</p>
              <ul>{(p.integration.missing || []).map((x: string) => <li key={x}>{x}</li>)}</ul>
              <p className="muted">Required configuration</p>
              <ul>{(p.integration.requiredConfig || []).map((x: string) => <li key={x}>{x}</li>)}</ul>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

function SentPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api("/api/sent").then(setData); }, []);
  return (
    <>
      <Shell title="Sent Messages" sub="Simulated sends are labeled. Failed Graph calls are errors, not successes." />
      <table>
        <thead><tr><th>When</th><th>Platform</th><th>Mode</th><th>Simulated</th><th>Body</th><th>Error</th></tr></thead>
        <tbody>
          {(data?.sent || []).map((s: any) => (
            <tr key={s.id}>
              <td>{s.created_at}</td>
              <td>{s.platform}</td>
              <td>{s.mode}</td>
              <td>{s.simulated ? "yes" : "no"}</td>
              <td>{s.body}</td>
              <td className="muted">{s.error || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ActivityPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api("/api/activity").then(setData); }, []);
  return (
    <>
      <Shell title="Agent Activity" sub="Local logs. Tokens, cookies, and passwords are redacted or never stored in this table." />
      {(data?.logs || []).map((l: any) => (
        <div className="card" key={l.id} style={{ marginBottom: 8 }}>
          <h2>{l.event} · {l.level} · {l.platform || "app"}</h2>
          <pre>{JSON.stringify(l.detail, null, 2)}</pre>
          <p className="muted">{l.created_at}</p>
        </div>
      ))}
    </>
  );
}

function StylePage() {
  const [examples, setExamples] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    api<{ examples: string[]; notes: string }>("/api/style").then((s) => {
      setExamples((s.examples || []).join("\n---\n"));
      setNotes(s.notes || "");
    });
  }, []);
  const save = async () => {
    const list = examples.split(/\n---\n/).map((s) => s.trim()).filter(Boolean);
    await api("/api/style", { method: "PUT", body: JSON.stringify({ examples: list, notes }) });
    setSaved("Saved");
  };
  return (
    <>
      <Shell title="My Style" sub="Only your own examples. Separate samples with a line that is exactly ---" />
      <div className="stack">
        <textarea value={examples} onChange={(e) => setExamples(e.target.value)} placeholder="Paste how you actually write…" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes (tone, languages, things to avoid)" />
        <button className="primary" onClick={save}>Save style</button>
        <p className="muted">{saved}</p>
      </div>
    </>
  );
}

function MemoryPage() {
  const [data, setData] = useState<any>(null);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const refresh = () => api("/api/memory").then(setData);
  useEffect(() => { refresh(); }, []);
  return (
    <>
      <Shell title="Memory" sub="Facts you choose to keep. Stored in local SQLite." />
      <div className="row">
        <input placeholder="key" value={key} onChange={(e) => setKey(e.target.value)} />
        <input placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="primary" onClick={async () => { await api("/api/memory", { method: "POST", body: JSON.stringify({ key, value }) }); setKey(""); setValue(""); refresh(); }}>Add</button>
      </div>
      {(data?.memory || []).map((m: any) => (
        <div className="card" key={m.id} style={{ marginTop: 8 }}>
          <h2>{m.key}</h2>
          <p>{m.value}</p>
          <button onClick={async () => { await api(`/api/memory/${m.id}`, { method: "DELETE" }); refresh(); }}>Delete</button>
        </div>
      ))}
    </>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const refresh = () => api<{ settings: any }>("/api/settings").then((r) => setSettings(r.settings));
  useEffect(() => { refresh(); }, []);
  if (!settings) return <Shell title="Settings" sub="Loading…" />;
  const save = async (patch: any) => {
    const r = await api<{ settings: any }>("/api/settings", { method: "PUT", body: JSON.stringify(patch) });
    setSettings(r.settings);
  };
  return (
    <>
      <Shell title="Settings" sub="Approval is the default. Auto requires explicit per-platform and per-conversation opt-in. Live send is a separate switch." />
      <div className="stack">
        <div className="card">
          <h2>Operating mode</h2>
          <select value={settings.mode} onChange={(e) => save({ mode: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="approval">Approval (default)</option>
            <option value="auto">Auto (opt-in)</option>
          </select>
        </div>
        <div className="card">
          <h2>Simulation / live send</h2>
          <p className="muted">Live send calls Microsoft Graph POST /chats/{"{id}"}/messages. Simulation never does.</p>
          <div className="row">
            <button className={settings.simulationEnabled ? "good" : ""} onClick={() => save({ simulationEnabled: !settings.simulationEnabled })}>
              Simulation {settings.simulationEnabled ? "ON" : "off"}
            </button>
            <button className={settings.liveSendEnabled ? "danger" : ""} onClick={() => save({ liveSendEnabled: !settings.liveSendEnabled })}>
              Live send {settings.liveSendEnabled ? "ENABLED" : "off"}
            </button>
          </div>
        </div>
        <div className="card">
          <h2>Emergency</h2>
          <div className="row">
            <button className="danger" onClick={async () => { await api("/api/emergency-stop", { method: "POST" }); refresh(); }}>STOP ALL AGENTS</button>
            <button onClick={async () => { await api("/api/emergency-resume", { method: "POST" }); refresh(); }}>Resume</button>
          </div>
        </div>
      </div>
    </>
  );
}
