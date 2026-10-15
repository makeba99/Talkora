import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, subscribe, type Activity, type AuthState, type Chat, type Draft, type Settings, type Status } from "./api";

type Tab = "dashboard" | "inbox" | "settings" | "activity";

const STYLES = ["professional", "friendly", "casual", "concise", "detailed"] as const;
const OPEN = new Set(["detected", "generating", "pending_review", "editing", "sending", "failed", "uncertain"]);

export function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [status, setStatus] = useState<Status | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [limitations, setLimitations] = useState<string[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [nextStatus, nextDrafts, nextChats, nextSettings, nextActivity, nextLimits] = await Promise.all([
        api<Status>("/api/status"),
        api<{ drafts: Draft[] }>("/api/drafts"),
        api<{ chats: Chat[] }>("/api/chats"),
        api<{ settings: Settings; auth: AuthState }>("/api/settings"),
        api<{ activity: Activity[] }>("/api/activity"),
        api<{ limitations: string[] }>("/api/limitations"),
      ]);
      setStatus(nextStatus);
      setDrafts(nextDrafts.drafts);
      setChats(nextChats.chats);
      setSettings(nextSettings.settings);
      setAuth(nextSettings.auth);
      setActivity(nextActivity.activity);
      setLimitations(nextLimits.limitations);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "TeamsPilot could not refresh.");
    }
  }, []);

  useEffect(() => {
    void reload();
    const stop = subscribe((event) => {
      void reload();
      if (event.type === "draft_ready") setBanner("A reply is ready for review. Nothing has been sent.");
    });
    const timer = window.setInterval(() => void reload(), 3000);
    return () => {
      stop();
      window.clearInterval(timer);
    };
  }, [reload]);

  useEffect(() => {
    if (!banner || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification("TeamsPilot", { body: "A reply is ready for review. Nothing has been sent." });
  }, [banner]);

  const reviewCount = drafts.filter((draft) => draft.status === "pending_review" || draft.status === "editing").length;

  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand">
          <div className="mark">T</div>
          <div>
            <h1>TeamsPilot</h1>
            <p>{window.teamspilot?.desktop ? "Desktop" : "Local"} · approval required</p>
          </div>
        </div>
        <button type="button" data-testid="nav-dashboard" aria-current={tab === "dashboard" ? "page" : undefined} onClick={() => setTab("dashboard")}>Dashboard</button>
        <button type="button" data-testid="nav-inbox" aria-current={tab === "inbox" ? "page" : undefined} onClick={() => setTab("inbox")}>
          Inbox {reviewCount > 0 && <span className="count">{reviewCount}</span>}
        </button>
        <button type="button" data-testid="nav-settings" aria-current={tab === "settings" ? "page" : undefined} onClick={() => setTab("settings")}>Settings</button>
        <button type="button" data-testid="nav-activity" aria-current={tab === "activity" ? "page" : undefined} onClick={() => setTab("activity")}>Activity</button>
        <p className="policy">Automatic sending is not part of TeamsPilot and cannot be turned on.</p>
      </nav>
      <main className="main">
        {banner && (
          <div className="banner" role="status">
            <span>{banner}</span>
            <button type="button" className="solid" onClick={() => { setTab("inbox"); setBanner(null); }}>Open inbox</button>
          </div>
        )}
        {error && <div className="error-line">{error}</div>}
        {tab === "dashboard" && status && (
          <Dashboard status={status} chats={chats} limitations={limitations} onChange={reload} onError={setError} />
        )}
        {tab === "inbox" && <Inbox drafts={drafts} chats={chats} canSend={status?.mode === "monitoring" || Boolean(status?.account.signedIn)} onChange={reload} onError={setError} />}
        {tab === "settings" && settings && auth && <SettingsPage settings={settings} auth={auth} onChange={reload} onError={setError} />}
        {tab === "activity" && <ActivityPage entries={[...activity].reverse()} />}
      </main>
    </div>
  );
}

function Dashboard({ status, chats, limitations, onChange, onError }: { status: Status; chats: Chat[]; limitations: string[]; onChange: () => Promise<void>; onError: (value: string | null) => void }) {
  async function run(path: string) {
    try {
      if (path.endsWith("start") && typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      const result = await api<{ ok?: boolean; reason?: string }>(path, { method: "POST" });
      if (result.ok === false && result.reason) onError(result.reason);
      else onError(null);
      await onChange();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "The control failed.");
    }
  }
  return (
    <section>
      <h2>Dashboard</h2>
      <p className="lede">{status.detectionSummary}</p>
      <div className="grid">
        <article className="card"><span>Microsoft</span><strong className={status.account.signedIn ? "ok" : "warn"}>{status.account.signedIn ? status.account.displayName : "Not signed in"}</strong></article>
        <article className="card"><span>Monitoring</span><strong className={status.monitoring === "running" ? "ok" : "warn"}>{status.monitoring}</strong></article>
        <article className="card"><span>Mode</span><strong>{status.mode === "draft-only" ? "Draft only" : "Monitoring"}</strong></article>
      </div>
      <div className="controls">
        <button type="button" className="solid" data-testid="monitoring-start" onClick={() => void run("/api/monitoring/start")}>Start</button>
        <button type="button" data-testid="monitoring-pause" onClick={() => void run("/api/monitoring/pause")}>Pause</button>
        <button type="button" data-testid="monitoring-stop" onClick={() => void run("/api/monitoring/stop")}>Stop</button>
      </div>
      {status.draftOnlyReason && <div className="callout"><strong>Draft-only</strong>{status.draftOnlyReason}</div>}
      {status.lastError && <div className="error-line">{status.lastError}</div>}
      {status.detectionTruncated && <div className="callout"><strong>Detection incomplete</strong>The last poll did not reach the previous watermark. TeamsPilot is not claiming that every new message was seen.</div>}
      <article className="card">
        <span>Chat being monitored</span>
        <strong>{status.monitoredChat ? status.monitoredChat.label : "None selected"}</strong>
        <p className="fine">Graph cannot see the chat open in the Teams window. Choose the chat here.</p>
        <div className="chat-list">
          {chats.length === 0 && <p className="fine">Sign in and refresh to load your chats.</p>}
          {chats.map((chat) => (
            <button type="button" key={chat.id} className={status.monitoredChat?.id === chat.id ? "selected" : ""} onClick={() => void api("/api/monitoring/chat", { method: "POST", body: JSON.stringify({ chatId: chat.id }) }).then(onChange).catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "Could not select that chat."))}>
              {chat.label}<div className="fine">{chat.chatType}</div>
            </button>
          ))}
        </div>
      </article>
      <ProbeCard status={status} onChange={onChange} onError={onError} />
      <article className="card">
        <span>What this app does not claim</span>
        <ul className="notes">
          {limitations.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </article>
    </section>
  );
}

function ProbeCard({ status, onChange, onError }: { status: Status; onChange: () => Promise<void>; onError: (value: string | null) => void }) {
  const probe = status.lastProbe;
  return (
    <article className="card">
      <span>Teams window probe</span>
      <strong>{status.uiaSupported ? "Available on this Windows session" : "Not available on this computer"}</strong>
      <p className="fine">The probe never sends. Automated sending through UI Automation is disabled.</p>
      {probe && (
        <>
          <p>{probe.teamsWindowFound ? "A Teams window was found." : "No Teams window was confirmed."} Confidence: {probe.confidence}. Composer exposed: {probe.composerFound ? "yes" : "no"}.</p>
          <ul className="notes">{probe.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          {probe.suggestedChatId && probe.confidence !== "high" && (
            <button type="button" className="solid" onClick={() => void api("/api/monitoring/chat", { method: "POST", body: JSON.stringify({ chatId: probe.suggestedChatId }) }).then(onChange).catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "Could not use that suggestion."))}>
              Monitor {probe.suggestedLabel}
            </button>
          )}
        </>
      )}
      <div className="controls">
        <button type="button" onClick={() => void api("/api/probe", { method: "POST" }).then(onChange).catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "Probe failed."))}>Probe Teams window</button>
      </div>
    </article>
  );
}

function Inbox({ drafts, chats, canSend, onChange, onError }: { drafts: Draft[]; chats: Chat[]; canSend: boolean; onChange: () => Promise<void>; onError: (value: string | null) => void }) {
  const [showClosed, setShowClosed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(drafts[0]?.id ?? null);
  const [manualText, setManualText] = useState("");
  const [manualSender, setManualSender] = useState("");
  const [manualChat, setManualChat] = useState("");
  const visible = useMemo(() => drafts.filter((draft) => showClosed || OPEN.has(draft.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [drafts, showClosed]);
  const selected = visible.find((draft) => draft.id === selectedId) ?? visible[0] ?? null;

  async function createManual() {
    try {
      const result = await api<{ draft: Draft | null }>("/api/drafts/manual", {
        method: "POST",
        body: JSON.stringify({ text: manualText, senderLabel: manualSender || "Someone", chatId: manualChat || null }),
      });
      setManualText("");
      if (result.draft) setSelectedId(result.draft.id);
      await onChange();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "The draft could not be created.");
    }
  }

  return (
    <section>
      <h2>Draft inbox</h2>
      <p className="lede">Nothing is sent while a draft is waiting. Approve &amp; Send is the only action that can authorize a send, and it applies to that exact saved text.</p>
      <label className="check"><input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} /> Show sent and discarded</label>
      <div className="split">
        <div className="card" data-testid="draft-list">
          {visible.length === 0 && <p>No open drafts.</p>}
          {visible.map((draft) => (
            <button type="button" key={draft.id} className={`draft-button ${selected?.id === draft.id ? "selected" : ""}`} onClick={() => setSelectedId(draft.id)}>
              <strong>{draft.senderLabel}</strong>
              <div className="fine">{draft.chatLabel} · {labelFor(draft.status)}</div>
            </button>
          ))}
        </div>
        {selected ? <DraftDetail key={selected.id} draft={selected} canSend={canSend} onChange={onChange} onError={onError} /> : <article className="paper">Select a draft, or paste a message below. Pasted text is not Teams detection.</article>}
      </div>
      <form className="card" onSubmit={(event) => { event.preventDefault(); void createManual(); }}>
        <span className="label">Paste a message yourself</span>
        <p className="fine">This does not detect a Teams message. If you attach a chat, sending still requires Approve &amp; Send and a verified destination.</p>
        <div className="form">
          <label>Sender<input value={manualSender} onChange={(event) => setManualSender(event.target.value)} placeholder="Ada" /></label>
          <label>Message<textarea value={manualText} onChange={(event) => setManualText(event.target.value)} /></label>
          <label>Attach to a verified chat
            <select value={manualChat} onChange={(event) => setManualChat(event.target.value)}>
              <option value="">No Teams chat — cannot be sent</option>
              {chats.map((chat) => <option key={chat.id} value={chat.id}>{chat.label}</option>)}
            </select>
          </label>
          <button type="submit" className="solid" disabled={!manualText.trim()}>Create draft</button>
        </div>
      </form>
    </section>
  );
}

function DraftDetail({ draft, canSend, onChange, onError }: { draft: Draft; canSend: boolean; onChange: () => Promise<void>; onError: (value: string | null) => void }) {
  const [text, setText] = useState(draft.currentReply);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setText(draft.currentReply);
    setDirty(false);
  }, [draft.revision, draft.status, draft.currentReply]);
  const approvable = ["pending_review", "editing", "failed"].includes(draft.status) && !dirty && text.trim().length > 0;

  async function act(path: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    try {
      const result = await api<{ error?: string; status?: string }>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
      if (result.status === "sent" && path.endsWith("resolve")) setNotice("You confirmed it is in the chat. TeamsPilot did not send again.");
      else if (result.status === "sent") setNotice("Microsoft Graph confirmed the message.");
      else setNotice(result.error ?? "Updated. Nothing was sent.");
      onError(null);
      await onChange();
      return result.status !== "needs_review" && result.status !== "failed";
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The action failed.";
      setNotice(message);
      onError(message);
      await onChange();
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="paper">
      <span className="pill">{draft.source === "manual" ? "Pasted by you" : "From Teams"} · {labelFor(draft.status)}</span>
      <h3>{draft.senderLabel}</h3>
      <p className="fine">{draft.chatLabel || "No Teams chat"} · {new Date(draft.createdAt).toLocaleString()}</p>
      <p>{draft.originalMessage}</p>
      {draft.context.length > 0 && (
        <details>
          <summary>Context from this chat only</summary>
          {draft.context.map((turn) => <p key={turn.id}><strong>{turn.mine ? "You" : turn.senderLabel}: </strong>{turn.text}</p>)}
        </details>
      )}
      {draft.error && <p className="bad">{draft.error}</p>}
      {draft.status === "uncertain" && (
        <div className="callout">
          <strong>Check Teams before doing anything else</strong>
          This send was not confirmed. The message may or may not be in the chat. TeamsPilot will not retry on its own.
          <div className="actions">
            <button type="button" onClick={() => void act(`/api/drafts/${draft.id}/resolve`, { resolution: "not_sent" })}>I checked — it was not sent</button>
            <button type="button" onClick={() => void act(`/api/drafts/${draft.id}/resolve`, { resolution: "was_sent" })}>I checked — it is in the chat</button>
          </div>
        </div>
      )}
      {draft.generatedReply && draft.generatedReply !== text && <p className="fine">Generated draft: {draft.generatedReply}</p>}
      <label className="label" htmlFor="reply-editor">Reply</label>
      <textarea id="reply-editor" data-testid="reply-editor" value={text} spellCheck onChange={(event) => { setText(event.target.value); setDirty(true); }} />
      <div className="actions">
        <button type="button" data-testid="edit-save" disabled={!dirty || busy} onClick={() => void act(`/api/drafts/${draft.id}/edit`, { text }).then((saved) => { if (saved) setDirty(false); })}>Save edit</button>
        <button type="button" data-testid="regenerate" disabled={busy || ["sent", "discarded", "sending", "uncertain"].includes(draft.status)} onClick={() => void act(`/api/drafts/${draft.id}/regenerate`)}>Regenerate</button>
        <button type="button" data-testid="copy-reply" onClick={() => void navigator.clipboard.writeText(text).then(() => setNotice("Copied. Nothing was sent.")).catch(() => setNotice("Copy failed. Select the reply and copy it manually."))}>Copy reply</button>
        <button type="button" className="danger" data-testid="discard" disabled={busy} onClick={() => { if (window.confirm(draft.status === "uncertain" ? "Discarding this draft does not remove a message that may already be in Teams." : "Discard this draft? It cannot be sent after this.")) void act(`/api/drafts/${draft.id}/discard`); }}>Discard</button>
        <button type="button" className="send" data-testid="approve-send" disabled={!approvable || !canSend || busy || !draft.chatId} onClick={() => void act(`/api/drafts/${draft.id}/approve`, { text })}>Approve &amp; Send</button>
      </div>
      <p className="fine">{dirty ? "Save the edit first. Unsaved text is not sent." : draft.chatId ? `Approve & Send uses the saved text for ${draft.chatLabel}.` : "This draft has no verified Teams chat, so it cannot be sent."} {draft.delivery?.kind === "graph" ? "Graph confirmed delivery." : ""} {draft.delivery?.kind === "user" ? "You confirmed it was already in the chat." : ""}</p>
      {notice && <p role="status">{notice}</p>}
    </article>
  );
}

function SettingsPage({ settings, auth, onChange, onError }: { settings: Settings; auth: AuthState; onChange: () => Promise<void>; onError: (value: string | null) => void }) {
  const [form, setForm] = useState(settings);
  const [apiKey, setApiKey] = useState("");
  useEffect(() => setForm(settings), [settings]);

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify({
        model: form.model,
        style: form.style,
        languageMode: form.languageMode,
        fixedLanguage: form.fixedLanguage,
        pollIntervalMs: Number(form.pollIntervalMs),
        logMessageContent: form.logMessageContent,
        followTeamsWindow: form.followTeamsWindow,
        graphClientId: form.graphClientId,
        graphTenant: form.graphTenant,
      }) });
      onError(null);
      await onChange();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Settings were not saved.");
    }
  }

  return (
    <section>
      <h2>Settings</h2>
      <p className="lede">The OpenAI key stays on this computer. The page never receives it back. Microsoft sign-in uses the device-code flow, not your password.</p>
      <form className="form" onSubmit={(event) => void save(event)}>
        <label>Model<input data-testid="settings-model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></label>
        <label>Style
          <select data-testid="settings-style" value={form.style} onChange={(event) => setForm({ ...form, style: event.target.value })}>
            {STYLES.map((style) => <option key={style} value={style}>{style}</option>)}
          </select>
        </label>
        <label>Language
          <select value={form.languageMode} onChange={(event) => setForm({ ...form, languageMode: event.target.value as Settings["languageMode"] })}>
            <option value="match">Match the conversation</option>
            <option value="fixed">Fixed language</option>
          </select>
        </label>
        {form.languageMode === "fixed" && <label>Fixed language<input value={form.fixedLanguage} onChange={(event) => setForm({ ...form, fixedLanguage: event.target.value })} /></label>}
        <label>Poll interval (ms)<input type="number" min={3000} max={120000} value={form.pollIntervalMs} onChange={(event) => setForm({ ...form, pollIntervalMs: Number(event.target.value) })} /></label>
        <label className="check"><input type="checkbox" checked={form.logMessageContent} onChange={(event) => setForm({ ...form, logMessageContent: event.target.checked })} /> Include message excerpts in the activity log</label>
        <label className="check"><input type="checkbox" checked={form.followTeamsWindow} onChange={(event) => setForm({ ...form, followTeamsWindow: event.target.checked })} /> Follow the Teams window when UI Automation exposes a unique selected chat</label>
        <label>Microsoft application (client) ID<input value={form.graphClientId} onChange={(event) => setForm({ ...form, graphClientId: event.target.value })} placeholder="00000000-0000-0000-0000-000000000000" /></label>
        <label>Tenant<input value={form.graphTenant} onChange={(event) => setForm({ ...form, graphTenant: event.target.value })} /></label>
        <button type="submit" className="solid" data-testid="settings-save">Save settings</button>
      </form>
      <form className="form" onSubmit={(event) => { event.preventDefault(); void api("/api/settings/openai-key", { method: "PUT", body: JSON.stringify({ apiKey }) }).then(() => { setApiKey(""); return onChange(); }).catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "The key was not stored.")); }}>
        <label>OpenAI API key<input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings.openaiConfigured ? "Stored. Enter a new key to replace it." : "sk-..."} /></label>
        <div className="inline">
          <button type="submit" className="solid">Store key</button>
          <button type="button" onClick={() => void api("/api/settings/openai-key", { method: "DELETE" }).then(onChange)}>Remove key</button>
        </div>
      </form>
      <article className="card">
        <span>Microsoft</span>
        <strong>{auth.signedIn ? auth.account?.displayName : "Not signed in"}</strong>
        {auth.lastError && <p className="bad">{auth.lastError}</p>}
        {auth.pending && (
          <div>
            <p>{auth.pending.message}</p>
            <div className="device-code">{auth.pending.userCode}</div>
            <a href={auth.pending.verificationUri} target="_blank" rel="noreferrer">{auth.pending.verificationUri}</a>
          </div>
        )}
        <div className="controls">
          <button type="button" className="solid" onClick={() => void api("/api/auth/start", { method: "POST" }).then(onChange).catch((caught: unknown) => onError(caught instanceof Error ? caught.message : "Sign-in did not start."))}>Sign in with Microsoft</button>
          <button type="button" onClick={() => void api("/api/auth/sign-out", { method: "POST" }).then(onChange)}>Sign out</button>
        </div>
      </article>
      <article className="card">
        <span>Local data</span>
        <p className="fine">Conversation text is stored only in the local draft file. Clearing it also resets detection baselines.</p>
        <button type="button" className="danger" onClick={() => { if (window.confirm("Delete drafts, retained context, and the activity log on this computer?")) void api("/api/data/clear", { method: "POST" }).then(onChange); }}>Clear drafts and context</button>
      </article>
    </section>
  );
}

function ActivityPage({ entries }: { entries: Activity[] }) {
  return (
    <section>
      <h2>Activity</h2>
      <p className="lede">Message text is omitted unless you turn excerpts on in Settings. Keys and tokens are still removed.</p>
      <div className="log">
        {entries.length === 0 && <p>No events yet.</p>}
        {entries.map((entry) => (
          <article key={entry.id}>
            <div>{new Date(entry.at).toLocaleString()} · {entry.level} · {entry.event}</div>
            <div className="fine">{[entry.status, entry.outcome, entry.chatId, entry.draftId, entry.detail].filter(Boolean).join(" · ")}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function labelFor(status: string): string {
  const labels: Record<string, string> = {
    detected: "Detected",
    generating: "Writing reply",
    pending_review: "Needs your review",
    editing: "Edited, not sent",
    sending: "Sending",
    sent: "Sent",
    failed: "Not sent",
    uncertain: "Needs verification",
    discarded: "Discarded",
  };
  return labels[status] ?? status;
}
