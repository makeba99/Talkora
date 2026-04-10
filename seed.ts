import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const useGoogle = !!process.env.GOOGLE_CLIENT_ID;

  if (useGoogle) {
    const { Strategy: GoogleStrategy } = await import("passport-google-oauth20");

    const googleVerify = async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
      try {
        const email =
          (profile.emails && profile.emails[0]?.value) ||
          `${profile.id}@google.com`;
        const firstName = profile.name?.givenName || profile.displayName?.split(" ")[0] || "User";
        const lastName = profile.name?.familyName || null;
        const profileImageUrl =
          profile.photos && profile.photos[0]?.value ? profile.photos[0].value : null;

        const user = await authStorage.upsertUser({
          id: `google_${profile.id}`,
          email,
          firstName,
          lastName,
          profileImageUrl,
        });

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    };

    passport.serializeUser((user: any, cb) => cb(null, user.id));
    passport.deserializeUser(async (id: string, cb) => {
      try {
        const user = await authStorage.getUser(id);
        cb(null, user || false);
      } catch (err) {
        cb(err);
      }
    });

    const getCallbackURL = (req: any) => {
      if (process.env.CALLBACK_URL) return process.env.CALLBACK_URL;
      const proto = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      return `${proto}://${host}/api/auth/callback`;
    };

    app.get("/api/login", (req, res, next) => {
      const callbackURL = getCallbackURL(req);
      console.log("[auth] Google OAuth callbackURL:", callbackURL);
      const strategy = new GoogleStrategy(
        { clientID: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, callbackURL },
        googleVerify
      );
      passport.use(strategy);
      passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
    });

    app.get("/api/auth/callback", (req, res, next) => {
      const callbackURL = getCallbackURL(req);
      const strategy = new GoogleStrategy(
        { clientID: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, callbackURL },
        googleVerify
      );
      passport.use(strategy);
      passport.authenticate("google", { successRedirect: "/", failureRedirect: "/api/login" })(req, res, next);
    });

    app.get("/api/callback", (req, res, next) => {
      const callbackURL = getCallbackURL(req);
      const strategy = new GoogleStrategy(
        { clientID: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, callbackURL },
        googleVerify
      );
      passport.use(strategy);
      passport.authenticate("google", { successRedirect: "/", failureRedirect: "/api/login" })(req, res, next);
    });

    app.get("/api/logout", (req, res) => {
      req.logout(() => res.redirect("/"));
    });

  } else if (!process.env.REPL_ID) {
    // Local fallback when neither Google OAuth nor Replit Auth are configured
    console.log("[auth] Using local mock authentication fallback");
    
    app.get("/api/login", async (req, res, next) => {
      try {
        const user = await authStorage.upsertUser({
          id: "local_dev_1",
          email: "dev@localhost.local",
          firstName: "Local",
          lastName: "Developer",
          profileImageUrl: null,
        });
        req.login(user, (err) => {
          if (err) return next(err);
          return res.redirect("/");
        });
      } catch (err) {
        next(err);
      }
    });
    
    passport.serializeUser((user: any, cb) => cb(null, user.id));
    passport.deserializeUser(async (id: string, cb) => {
      try {
        const user = await authStorage.getUser(id);
        cb(null, user || false);
      } catch (err) {
        cb(err);
      }
    });

    app.get("/api/logout", (req, res) => req.logout(() => res.redirect("/")));

  } else {
    // Replit OIDC — used in development on Replit
    const memoize = (await import("memoizee")).default;
    const oidcClient = await import("openid-client");
    const { Strategy } = await import("openid-client/passport");

    const getOidcConfig = memoize(
      async () => {
        return await oidcClient.discovery(
          new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
          process.env.REPL_ID!
        );
      },
      { maxAge: 3600 * 1000 }
    );

    const registeredStrategies = new Set<string>();

    const ensureStrategy = async (domain: string) => {
      const strategyName = `replitauth:${domain}`;
      if (!registeredStrategies.has(strategyName)) {
        const config = await getOidcConfig();
        const verify = async (
          tokens: any,
          verified: passport.AuthenticateCallback
        ) => {
          const user: any = {};
          user.claims = tokens.claims();
          user.access_token = tokens.access_token;
          user.refresh_token = tokens.refresh_token;
          user.expires_at = user.claims?.exp;
          user.id = user.claims?.sub;
          const claims = tokens.claims();
          await authStorage.upsertUser({
            id: claims["sub"],
            email: claims["email"],
            firstName: claims["first_name"],
            lastName: claims["last_name"],
            profileImageUrl: claims["profile_image_url"],
          });
          verified(null, user);
        };
        const strategy = new Strategy(
          {
            name: strategyName,
            config,
            scope: "openid email profile offline_access",
            callbackURL: `https://${domain}/api/callback`,
          },
          verify
        );
        passport.use(strategy);
        registeredStrategies.add(strategyName);
      }
    };

    passport.serializeUser((user: Express.User, cb) => cb(null, user));
    passport.deserializeUser((user: Express.User, cb) => cb(null, user));

    app.get("/api/login", async (req, res, next) => {
      await ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    });

    app.get("/api/callback", async (req, res, next) => {
      await ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        successReturnToOrRedirect: "/",
        failureRedirect: "/api/login",
      })(req, res, next);
    });

    app.get("/api/logout", async (req, res) => {
      const config = await getOidcConfig();
      req.logout(() => {
        res.redirect(
          oidcClient.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      });
    });
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as any;

  // Google OAuth users — always valid while session exists
  if (!user.expires_at) return next();

  // Replit OIDC users — check token expiry and refresh
  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) return next();

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const memoize = (await import("memoizee")).default;
    const oidcClient = await import("openid-client");
    const getOidcConfig = memoize(
      async () => oidcClient.discovery(
        new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
        process.env.REPL_ID!
      ),
      { maxAge: 3600 * 1000 }
    );
    const config = await getOidcConfig();
    const tokenResponse = await oidcClient.refreshTokenGrant(config, refreshToken);
    user.claims = tokenResponse.claims();
    user.access_token = tokenResponse.access_token;
    user.refresh_token = tokenResponse.refresh_token;
    user.expires_at = user.claims?.exp;
    user.id = user.claims?.sub;
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
