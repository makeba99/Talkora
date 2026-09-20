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
      return <Free4TalkPage />;
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
      <Shell title={title} sub="Normalized conversations. Free4Talk only lists the room whose URL you pasted, and only currently visible public chat." />
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
      <Shell title="Pending Replies" sub="Default mode is Approval. Free4Talk approve types into the signed-in room ChatBox only when Live send is on and simulation is off." />
      {err ? <p className="pill bad">{err}</p> : null}
      {(data?.drafts || []).filter((d: any) => d.status === "pending").map((d: any) => (
        <div className="card" key={d.id} style={{ marginBottom: 12 }}>
          <h2>{d.platform} · {d.conversation_title || d.conversation_id}</h2>
          <textarea defaultValue={d.body} onBlur={(e) => api(`/api/drafts/${d.id}/edit`, { method: "POST", body: JSON.stringify({ body: e.target.value }) })} />
          <p className="muted">Why this reply: {d.reason}</p>
          <p className="muted">{d.language} · confidence {d.confidence}</p>
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
          ) : (
            <p className="muted">
              {p.integration?.mode === "authorized_browser"
                ? "Authorized headed browser. Paste a room URL after you sign in on their site."
                : "Official API path available when configured."}
            </p>
          )}
        </div>
      ))}
    </>
  );
}

const HILDA_ROOM_URL = "https://www.free4talk.com/room/z2ee2";

function Free4TalkPage() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const [roomUrl, setRoomUrl] = useState(HILDA_ROOM_URL);
  const [roomMsg, setRoomMsg] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [companionDrafts, setCompanionDrafts] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [sendMsg, setSendMsg] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [monitor, setMonitor] = useState<any>(null);
  const refresh = () => api("/api/platforms").then(setData);
  const refreshSettings = () => api<{ settings: any }>("/api/settings").then((r) => setSettings(r.settings));
  const refreshMonitor = () =>
    api("/api/platforms/free4talk/monitor").then(setMonitor).catch(() => undefined);
  const refreshCompanion = () =>
    api<{ drafts?: any[] }>("/api/drafts")
      .then((r) => {
        const list = (r.drafts || []).filter((d: any) => d.platform === "free4talk");
        setCompanionDrafts(list.slice(0, 8));
      })
      .catch(() => undefined);
  useEffect(() => { refresh(); refreshSettings(); refreshMonitor(); refreshCompanion(); }, []);
  useEffect(() => {
    api<{ url?: string; suggestedUrl?: string }>("/api/platforms/free4talk/room").then((r) => {
      setRoomUrl(r.url || r.suggestedUrl || HILDA_ROOM_URL);
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    const tick = () => {
      api<{ messages?: any[] }>("/api/platforms/free4talk/room/messages")
        .then((r) => { if (Array.isArray(r.messages)) setMessages(r.messages); })
        .catch(() => undefined);
      refreshMonitor();
      refreshCompanion();
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, []);
  const p = (data?.platforms || []).find((x: any) => x.id === "free4talk");
  const call = async (path: string) => {
    setBusy(path);
    try {
      await api(path, { method: "POST" });
      await refresh();
    } finally {
      setBusy("");
    }
  };
  const saveSettings = async (patch: any) => {
    const r = await api<{ settings: any }>("/api/settings", { method: "PUT", body: JSON.stringify(patch) });
    setSettings(r.settings);
    await refreshMonitor();
  };
  const openRoom = async () => {
    setBusy("room");
    setRoomMsg("");
    try {
      const r = await api<{ message: string; ok: boolean }>("/api/platforms/free4talk/room", {
        method: "POST",
        body: JSON.stringify({ url: roomUrl }),
      });
      setRoomMsg(r.message);
      await refresh();
    } catch (e: any) {
      setRoomMsg(e.message || "Could not open room URL");
    } finally {
      setBusy("");
    }
  };
  const send = async (asSignedInAccount: boolean) => {
    setBusy("send");
    setSendMsg("");
    try {
      const r = await api<{ simulated: boolean; asSignedInAccount?: boolean }>("/api/platforms/free4talk/room/send", {
        method: "POST",
        body: JSON.stringify({ body: draft, asSignedInAccount }),
      });
      setSendMsg(
        r.asSignedInAccount
          ? "Sent as the signed-in room account: typed into the page input and clicked Send."
          : "Simulation: typed into the page input, then cleared — Send was not clicked.",
      );
      setDraft("");
    } catch (e: any) {
      setSendMsg(e.message || "Send failed");
    } finally {
      setBusy("");
    }
  };
  const open = async () => {
    const r = await api<{ url: string }>("/api/platforms/free4talk/open");
    window.open(r.url, "_blank", "noopener");
  };
  const liveReady = settings && !settings.simulationEnabled && settings.liveSendEnabled && !settings.emergencyStop;
  const autoReplyActive = Boolean(monitor?.autoReplyActive);
  const setMonitoring = async (on: boolean) => {
    setBusy("monitor");
    try {
      await api("/api/platforms/free4talk/monitor", { method: "POST", body: JSON.stringify({ on }) });
      await refreshMonitor();
      await refresh();
    } finally {
      setBusy("");
    }
  };
  const setAuto = async (auto: boolean) => {
    setBusy("auto");
    try {
      await api("/api/platforms/free4talk/auto", { method: "POST", body: JSON.stringify({ auto }) });
      await refreshMonitor();
      await refresh();
    } finally {
      setBusy("");
    }
  };
  const stopAll = async () => {
    setBusy("stop");
    try {
      await api("/api/emergency-stop", { method: "POST" });
      await refreshSettings();
      await refreshMonitor();
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <Shell title="Free4Talk" sub="You sign in on free4talk.com. Room URL defaults to https://www.free4talk.com/room/z2ee2. Watching ChatBox does not click Send while simulation is on." />
      {!p ? <p>Loading…</p> : (
        <div className="stack">
          {autoReplyActive ? <div className="banner live">AUTO REPLY IS ACTIVE</div> : null}
          {settings?.emergencyStop ? <div className="banner halt">STOP ALL AGENTS is on. Nothing will send.</div> : null}
          <div className="card">
            <h2>1. Connect</h2>
            <p><span className={`pill ${p.status === "connected" ? "ok" : "warn"}`}>{p.status}</span></p>
            <p>{p.message}</p>
            <div className="row">
              <button className="primary" disabled={!!busy} onClick={() => call("/api/platforms/free4talk/connect")}>Connect</button>
              <button disabled={!!busy} onClick={() => call("/api/platforms/free4talk/disconnect")}>Disconnect</button>
              <button disabled={!!busy} onClick={() => call("/api/platforms/free4talk/reconnect")}>Reconnect</button>
              <button disabled={!!busy} onClick={() => call("/api/platforms/free4talk/logout")}>Logout</button>
              <button onClick={open}>Open Platform</button>
            </div>
            <p className="muted">A headed Chromium window opens with a local profile. Sign in with Google on their page. Never paste that password here.</p>
          </div>
          <div className="card">
            <h2>2. Room URL</h2>
            <p className="muted">Prefills https://www.free4talk.com/room/z2ee2. Only that public host is accepted. Heroku hosts and tokens are rejected.</p>
            <div className="row">
              <input
                placeholder="https://www.free4talk.com/room/z2ee2"
                value={roomUrl}
                onChange={(e) => setRoomUrl(e.target.value)}
              />
              <button className="primary" disabled={!!busy || !roomUrl.trim()} onClick={openRoom}>Open room</button>
            </div>
            {roomMsg ? <p>{roomMsg}</p> : null}
          </div>
          <div className="card">
            <h2>Live monitor</h2>
            <p className="muted">Watch the signed-in ChatBox. Each new public inbound (not you, not PM) gets a companion draft immediately. Send is clicked only if Free4Talk Auto is on, simulation is off, Live send is on, and STOP is off. Otherwise Approve uses the same ChatBox path. Default stays simulation.</p>
            <div className="row">
              <button className={monitor?.monitoring ? "good" : ""} disabled={!!busy} onClick={() => setMonitoring(!monitor?.monitoring)}>
                Monitoring {monitor?.monitoring ? "ON" : "OFF"}
              </button>
              <button className={monitor?.autoEnabled ? "danger" : ""} disabled={!!busy} onClick={() => setAuto(!monitor?.autoEnabled)}>
                Free4Talk Auto {monitor?.autoEnabled ? "ON" : "off"}
              </button>
              <button className="danger" disabled={!!busy} onClick={stopAll}>STOP ALL AGENTS</button>
              <span className={`pill ${monitor?.monitoring ? "ok" : "warn"}`}>{monitor?.monitoring ? "watching ChatBox" : "not watching"}</span>
              <span className={`pill ${autoReplyActive ? "ok" : "warn"}`}>{autoReplyActive ? "AUTO REPLY IS ACTIVE" : "will not click Send"}</span>
            </div>
          </div>
          <div className="card">
            <h2>3. Visible public chat</h2>
            <p className="muted">Only messages currently rendered in the room DOM. Your own bubbles are labeled as the signed-in room account. Private/PM bubbles are skipped.</p>
            {(messages || []).map((m: any) => (
              <div className="card" key={m.externalId} style={{ marginTop: 8 }}>
                <h2>{m.direction === "outbound" ? "You (signed-in account)" : m.senderName} · {m.direction}</h2>
                <p>{m.body}</p>
              </div>
            ))}
            {!messages.length ? <p className="muted">No visible public messages yet. Connect, sign in, paste a room URL, and wait for ChatBox to mount.</p> : null}
          </div>
          <div className="card">
            <h2>Companion reply</h2>
            <p className="muted">Present, kind, same language as the room. Not assistant voice. Approve types into ChatBox as the signed-in account only when Live send is on and simulation is off.</p>
            {companionDrafts.filter((d: any) => d.status === "pending" || d.status === "simulated" || d.status === "sent").map((d: any) => (
              <div className="card" key={d.id} style={{ marginTop: 8 }}>
                <h2>{d.status === "pending" ? "Pending" : d.status} · companion</h2>
                <p style={{ whiteSpace: "pre-wrap" }}>{d.body}</p>
                <p className="muted">Why this reply: {d.reason}</p>
                {d.status === "pending" ? (
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="good" disabled={!!busy} onClick={async () => {
                      setBusy("approve");
                      try {
                        await api(`/api/drafts/${d.id}/approve`, { method: "POST" });
                        await refreshCompanion();
                      } catch (e: any) {
                        setSendMsg(e.message || "Approve failed");
                      } finally {
                        setBusy("");
                      }
                    }}>Approve into ChatBox</button>
                    <button className="danger" disabled={!!busy} onClick={async () => {
                      setBusy("reject");
                      try {
                        await api(`/api/drafts/${d.id}/reject`, { method: "POST" });
                        await refreshCompanion();
                      } finally {
                        setBusy("");
                      }
                    }}>Reject</button>
                  </div>
                ) : null}
              </div>
            ))}
            {!companionDrafts.filter((d: any) => d.status === "pending" || d.status === "simulated" || d.status === "sent").length ? (
              <p className="muted">No companion draft yet. Monitoring watches ChatBox; a new public inbound generates one here.</p>
            ) : null}
          </div>
          <div className="card">
            <h2>4. Send as signed-in room account</h2>
            <p className="muted">Live send types into Free4Talk’s “Type a message…” box and clicks Send while you are signed in. Simulation never clicks Send. Approving a draft uses the same path.</p>
            {settings ? (
              <div className="row" style={{ marginBottom: 8 }}>
                <button className={settings.simulationEnabled ? "good" : ""} onClick={() => saveSettings({ simulationEnabled: !settings.simulationEnabled })}>
                  Simulation {settings.simulationEnabled ? "ON" : "off"}
                </button>
                <button className={settings.liveSendEnabled ? "danger" : ""} onClick={() => saveSettings({ liveSendEnabled: !settings.liveSendEnabled })}>
                  Live send {settings.liveSendEnabled ? "ENABLED" : "off"}
                </button>
                <span className={`pill ${liveReady ? "ok" : "warn"}`}>{liveReady ? "will click Send as signed-in account" : "will not click Send yet"}</span>
              </div>
            ) : null}
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Reply to type into the room as the signed-in account…" />
            <div className="row">
              <button disabled={!!busy || !draft.trim()} onClick={() => send(false)}>Simulate only</button>
              <button className="primary" disabled={!!busy || !draft.trim()} onClick={() => send(true)}>Send as signed-in account</button>
            </div>
            {sendMsg ? <p>{sendMsg}</p> : null}
          </div>
          {p.integration ? (
            <div className="card">
              <h2>{p.integration.available ? "Authorized browser" : "Integration unavailable"}</h2>
              <p>{p.integration.reason}</p>
              <p className="muted">Exists</p>
              <ul>{(p.integration.exists || []).map((x: string) => <li key={x}>{x}</li>)}</ul>
              <p className="muted">Does not exist / not used</p>
              <ul>{(p.integration.missing || []).map((x: string) => <li key={x}>{x}</li>)}</ul>
            </div>
          ) : null}
        </div>
      )}
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
                    ? p.integration.mode === "authorized_browser"
                      ? "Authorized browser"
                      : "Official API"
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
          <p className="muted">Live send: Teams uses Graph POST /chats/{"{id}"}/messages. Free4Talk types into the signed-in room ChatBox and clicks Send. Simulation never does.</p>
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
