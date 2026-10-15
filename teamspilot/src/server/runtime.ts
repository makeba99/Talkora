import { randomBytes } from "node:crypto";
import http from "node:http";
import path from "node:path";
import { createActivity } from "../core/redact.js";
import { recoverDrafts } from "../core/recovery.js";
import { isPlaceholderSecret } from "../core/settings.js";
import { DraftStore } from "../core/store.js";
import type { Settings } from "../core/types.js";
import { OpenAiProvider } from "../ai/openai.js";
import { DraftPipeline } from "../pipeline/handle.js";
import { asPipelineStore } from "../pipeline/view.js";
import { ApprovalGate } from "../send/gate.js";
import { GraphMessageSender } from "../send/graph-sender.js";
import { createSecretStore, type SecretStore } from "../security/secrets.js";
import { loadEnvFile } from "../storage/env.js";
import { defaultDataDir } from "../storage/paths.js";
import { loadState, persistState } from "../storage/state-file.js";
import { GraphAuth } from "../teams/auth.js";
import { AuthorizedGraphRequest } from "../teams/graph-request.js";
import { GraphTeamsReader } from "../teams/graph-reader.js";
import { ChatMonitor } from "../teams/monitor.js";
import { probeTeamsWindow } from "../teams/uia.js";
import { attachUi, createApp, createEventHub } from "./app.js";

export async function startServer(): Promise<{ url: string; close: () => Promise<void> }> {
  loadEnvFile(path.resolve(process.cwd(), ".env"));
  const dataDir = defaultDataDir();
  const stateFile = path.join(dataDir, "state.json");
  const loaded = loadState(stateFile);
  const seeded = applyEnvSettings(loaded.state.settings);
  const store = new DraftStore({ ...loaded.state, settings: seeded }, (state) => persistState(stateFile, state));
  const secrets = createSecretStore(dataDir);
  await seedOpenAiKey(secrets, store);
  const recovered = recoverDrafts(store);
  const hub = createEventHub();
  const log = createStoreLogger(store);
  if (recovered) log.info("startup_recovered", { count: recovered, detail: "In-progress work was recovered. Nothing was sent." });
  if (loaded.ignoredAutoSend) log.info("auto_send_ignored", { detail: "Ignored an automatic-send setting. TeamsPilot cannot send automatically." });

  const auth = new GraphAuth(secrets, () => store.getSettings());
  const graph = new AuthorizedGraphRequest(() => auth.getAccessToken());
  const reader = new GraphTeamsReader(graph, () => {
    const status = auth.status();
    return { signedIn: status.signedIn, selfId: status.account?.id ?? null };
  });
  const sender = new GraphMessageSender(graph);
  const pipeline = new DraftPipeline({
    store: asPipelineStore(store),
    ai: new OpenAiProvider({ apiKey: () => secrets.get("openai-api-key") }),
    context: reader,
    settings: () => store.getSettings(),
    selfId: () => auth.status().account?.id ?? null,
    log,
    notify: {
      draftReady(info) {
        hub.publish({ type: "draft_ready", draftId: info.draftId, chatLabel: info.chatLabel, senderLabel: info.senderLabel });
      },
      changed() {
        hub.publish({ type: "changed" });
      },
    },
  });
  const gate = new ApprovalGate(store, sender, reader, (level, event, fields) => log[level](event, fields));
  const monitor = new ChatMonitor({
    reader,
    pipeline,
    store,
    settings: () => store.getSettings(),
    saveSettings: (settings) => store.saveSettings(settings),
    probe: { probe: probeTeamsWindow },
    log,
  });
  await auth.trySilent();

  const app = createApp({
    store,
    pipeline,
    gate,
    monitor,
    reader,
    auth,
    secrets,
    hub,
    sessionToken: randomBytes(32).toString("hex"),
    dataDir,
    probe: async () => {
      const chats = reader.canDetect() ? await reader.listChats() : [];
      return probeTeamsWindow(chats);
    },
  });
  const server = http.createServer(app);
  await attachUi(app, server);
  const port = await listen(server);
  const url = `http://127.0.0.1:${port}`;
  console.log(`TeamsPilot is running at ${url}`);
  console.log("Bound to localhost only. Automatic sending is disabled.");
  return {
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function createStoreLogger(store: DraftStore) {
  const write = (level: "info" | "error", event: string, fields?: { draftId?: string; chatId?: string; detail?: string; status?: string; outcome?: string; count?: number }) => {
    const settings = store.getSettings();
    store.addActivity(createActivity(level, event, fields, store.sensitiveSnippets(), settings.logMessageContent));
  };
  return {
    info: (event: string, fields?: { draftId?: string; chatId?: string; detail?: string; status?: string; outcome?: string; count?: number }) => write("info", event, fields),
    error: (event: string, fields?: { draftId?: string; chatId?: string; detail?: string; status?: string; outcome?: string; count?: number }) => write("error", event, fields),
  };
}

function applyEnvSettings(settings: Settings): Settings {
  const next = { ...settings };
  const clientId = process.env.TEAMSPILOT_GRAPH_CLIENT_ID?.trim();
  if (!next.graphClientId && clientId && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(clientId)) {
    next.graphClientId = clientId;
  }
  const tenant = process.env.TEAMSPILOT_GRAPH_TENANT?.trim();
  if (tenant && /^[A-Za-z0-9.-]{1,120}$/.test(tenant)) next.graphTenant = tenant;
  return next;
}

async function seedOpenAiKey(secrets: SecretStore, store: DraftStore): Promise<void> {
  const seeded = process.env.TEAMSPILOT_OPENAI_API_KEY;
  delete process.env.TEAMSPILOT_OPENAI_API_KEY;
  if (!seeded || isPlaceholderSecret(seeded)) return;
  try {
    if (!(await secrets.get("openai-api-key"))) await secrets.set("openai-api-key", seeded);
  } catch {
    store.addActivity(
      createActivity("error", "openai_key_seed_failed", { detail: "The API key from the environment could not be stored." }, [seeded], false),
    );
  }
}

function listen(server: http.Server): Promise<number> {
  const preferred = Number(process.env.PORT || 47321);
  const start = Number.isInteger(preferred) && preferred > 0 ? preferred : 47321;
  return new Promise((resolve, reject) => {
    const attempt = (port: number) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off("listening", onListening);
        if (error.code === "EADDRINUSE" && port < start + 20) {
          attempt(port + 1);
          return;
        }
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        const address = server.address();
        if (!address || typeof address === "string" || address.address !== "127.0.0.1") {
          reject(new Error("TeamsPilot refused to bind to anything except 127.0.0.1."));
          return;
        }
        resolve(address.port);
      };
      server.once("error", onError);
      server.listen(port, "127.0.0.1", onListening);
    };
    attempt(start);
  });
}
