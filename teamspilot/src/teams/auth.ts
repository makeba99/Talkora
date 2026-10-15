import { LogLevel, PublicClientApplication, type ICachePlugin } from "@azure/msal-node";
import type { SecretStore } from "../security/secrets.js";
import type { Settings } from "../core/types.js";
import { UserFacingError } from "../core/types.js";

/** Narrow delegated scopes. No application permissions and no *.All scopes. */
export const GRAPH_SCOPES = ["User.Read", "Chat.Read", "ChatMessage.Send"] as const;

export function authorityForTenant(tenant: string): string {
  if (!/^[A-Za-z0-9.-]{1,120}$/.test(tenant)) {
    throw new UserFacingError("The Microsoft tenant value is not valid.", "invalid_tenant", 400);
  }
  return `https://login.microsoftonline.com/${tenant}`;
}

export interface SignedInAccount {
  id: string;
  displayName: string;
  username: string;
}

export interface DeviceCodePrompt {
  userCode: string;
  verificationUri: string;
  message: string;
}

export class GraphAuth {
  private pca: PublicClientApplication | null = null;
  private pcaKey = "";
  private pending: DeviceCodePrompt | null = null;
  private inFlight: Promise<void> | null = null;
  private account: SignedInAccount | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly secrets: SecretStore,
    private readonly settings: () => Settings,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  status(): {
    configured: boolean;
    signedIn: boolean;
    account: SignedInAccount | null;
    pending: DeviceCodePrompt | null;
    lastError: string | null;
  } {
    return {
      configured: Boolean(this.settings().graphClientId),
      signedIn: Boolean(this.account),
      account: this.account,
      pending: this.pending,
      lastError: this.lastError,
    };
  }

  async trySilent(): Promise<void> {
    if (!this.settings().graphClientId) return;
    try {
      const token = await this.silentToken();
      await this.loadProfile(token);
      this.lastError = null;
    } catch {
      this.account = null;
    }
  }

  async startDeviceCode(): Promise<void> {
    if (this.inFlight) return;
    this.lastError = null;
    const pca = this.client();
    this.inFlight = pca
      .acquireTokenByDeviceCode({
        scopes: [...GRAPH_SCOPES],
        deviceCodeCallback: (response) => {
          this.pending = {
            userCode: response.userCode,
            verificationUri: response.verificationUri,
            message: response.message,
          };
        },
      })
      .then(async (result) => {
        this.pending = null;
        if (!result?.accessToken) throw new Error("empty token");
        await this.loadProfile(result.accessToken);
        this.lastError = null;
      })
      .catch((error: unknown) => {
        this.pending = null;
        this.account = null;
        const text = error instanceof Error ? error.message : "";
        const code = text.match(/AADSTS\d+/)?.[0];
        this.lastError = code
          ? `Microsoft sign-in failed (${code}). If this is a consent error, an administrator may need to grant Chat.Read for this app.`
          : "Microsoft sign-in did not finish.";
      })
      .finally(() => {
        this.inFlight = null;
      });
  }

  async getAccessToken(): Promise<string> {
    return this.silentToken();
  }

  async signOut(): Promise<void> {
    this.pending = null;
    this.account = null;
    this.pca = null;
    this.pcaKey = "";
    await this.secrets.delete("msal-cache");
  }

  private async silentToken(): Promise<string> {
    const pca = this.client();
    const accounts = await pca.getTokenCache().getAllAccounts();
    if (!accounts[0]) throw new UserFacingError("Sign in to Microsoft first.", "not_signed_in", 401);
    const result = await pca.acquireTokenSilent({ account: accounts[0], scopes: [...GRAPH_SCOPES] });
    if (!result?.accessToken) throw new UserFacingError("Microsoft sign-in expired. Sign in again.", "not_signed_in", 401);
    return result.accessToken;
  }

  private async loadProfile(accessToken: string): Promise<void> {
    const response = await this.fetchImpl("https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new UserFacingError("Microsoft Graph did not return your profile.", "profile_unavailable", 502);
    const body = (await response.json()) as { id?: unknown; displayName?: unknown; userPrincipalName?: unknown };
    if (typeof body.id !== "string" || !body.id) throw new UserFacingError("Microsoft Graph did not return your profile id.", "profile_unavailable", 502);
    this.account = {
      id: body.id,
      displayName: typeof body.displayName === "string" ? body.displayName : "Signed in",
      username: typeof body.userPrincipalName === "string" ? body.userPrincipalName : "",
    };
  }

  private client(): PublicClientApplication {
    const settings = this.settings();
    if (!settings.graphClientId) {
      throw new UserFacingError("Add the Microsoft application (client) ID in Settings.", "missing_client_id", 400);
    }
    const key = `${settings.graphClientId}|${settings.graphTenant}`;
    if (this.pca && this.pcaKey === key) return this.pca;
    this.pca = new PublicClientApplication({
      auth: {
        clientId: settings.graphClientId,
        authority: authorityForTenant(settings.graphTenant),
      },
      cache: { cachePlugin: this.cachePlugin() },
      system: {
        loggerOptions: {
          piiLoggingEnabled: false,
          logLevel: LogLevel.Error,
          loggerCallback: () => undefined,
        },
      },
    });
    this.pcaKey = key;
    return this.pca;
  }

  private cachePlugin(): ICachePlugin {
    return {
      beforeCacheAccess: async (context) => {
        const cache = await this.secrets.get("msal-cache");
        if (cache) context.tokenCache.deserialize(cache);
      },
      afterCacheAccess: async (context) => {
        if (context.cacheHasChanged) await this.secrets.set("msal-cache", context.tokenCache.serialize());
      },
    };
  }
}
