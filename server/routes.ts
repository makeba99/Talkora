import type { Express } from "express";
import { type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { insertRoomSchema, insertMessageSchema, insertFollowSchema, insertBlockSchema, insertReportSchema, insertUserCommentSchema, insertBadgeApplicationSchema, insertAnnouncementSchema, BADGE_TYPES } from "@shared/schema";
import type { User } from "@shared/schema";
import { z } from "zod";
import multer, { type StorageEngine } from "multer";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import webpush from "web-push";
import { externalCache } from "./cache";
import { securityBus, logSecurityEvent, authRateLimiter, apiRateLimiter, uploadRateLimiter, aiTutorRateLimiter, messageRateLimiter, threatDetectionMiddleware, privilegeCheckMiddleware } from "./security";
import { setCleanupContext, getCleanupStats, runCleanupNow } from "./cleanup";
import { isElevenLabsConfigured, elevenLabsSynthesize, elevenLabsHealth } from "./elevenlabs";
import { getAiTutorConfig, setAiTutorConfig, maskConfig, mergeIncoming, type AiTutorConfig } from "./ai-config";
import { openAiSynthesize, openAiTtsHealth } from "./openai-tts";
import { huggingFaceSynthesize, huggingFaceTtsHealth } from "./huggingface-tts";
import { checkContent, checkFields, getBlockLog, clearBlockLog } from "./content-filter";
import { recordStrike, isStrikeMuted, clearUserStrikes, unmuteUser, getStrikeRecords } from "./strike-tracker";
import { startStream, writeChunk, stopStream, getStreamInfo, stopAllStreamsForUser, getViewerCounts } from "./streaming";
import {
  renderIndexHtml,
  getOrigin,
  escapeHtml,
  type BreadcrumbItem,
} from "./seo-meta";
import sharp from "sharp";
import { getPrecomputedHtml } from "./static";
import { registerImageProxy } from "./image-proxy";
import { detectCountry } from "./geo";

const onlineUsers = new Set<string>();
const roomParticipants = new Map<string, Map<string, User>>();
// Persistent mood/gif state so new joiners see what existing participants set
const roomMoods = new Map<string, Map<string, string>>();
const roomAvatarGifs = new Map<string, Map<string, string>>();
const roomVideoStatus = new Map<string, Set<string>>();
const roomScreenShareStatus = new Map<string, string | null>();
// Per-host YouTube state: each user can independently host their own video
// (e.g. they pick a video to watch). Other users opt-in to "watch together"
// by clicking the host's avatar — they can switch between hosts freely
// without disturbing each other. Outer Map = roomId → inner Map = hostId → state.
type YtHostState = { videoId: string; startedBy: string; playing: boolean; lastTime: number; lastTs: number };
const roomYoutubeState = new Map<string, Map<string, YtHostState>>();
function getYtHost(roomId: string, hostId: string): YtHostState | undefined {
  return roomYoutubeState.get(roomId)?.get(hostId);
}
function setYtHost(roomId: string, hostId: string, state: YtHostState) {
  let m = roomYoutubeState.get(roomId);
  if (!m) { m = new Map(); roomYoutubeState.set(roomId, m); }
  m.set(hostId, state);
}
function deleteYtHost(roomId: string, hostId: string): boolean {
  const m = roomYoutubeState.get(roomId);
  if (!m) return false;
  const had = m.delete(hostId);
  if (m.size === 0) roomYoutubeState.delete(roomId);
  return had;
}
function listYtHosts(roomId: string): Array<{ hostId: string; state: YtHostState }> {
  const m = roomYoutubeState.get(roomId);
  if (!m) return [];
  return Array.from(m.entries()).map(([hostId, state]) => ({ hostId, state }));
}
// Per-host vote tally: votes are now scoped to (roomId, hostId, videoId) so two
// people watching different hosts don't share a vote pool. Resets whenever a
// host swaps their video.
const roomYoutubeVotes = new Map<string, Map<string, { videoId: string; likes: Set<string>; dislikes: Set<string>; skip: Set<string> }>>();
function getYtVotes(roomId: string, hostId: string) {
  return roomYoutubeVotes.get(roomId)?.get(hostId);
}
function setYtVotes(roomId: string, hostId: string, v: { videoId: string; likes: Set<string>; dislikes: Set<string>; skip: Set<string> }) {
  let m = roomYoutubeVotes.get(roomId);
  if (!m) { m = new Map(); roomYoutubeVotes.set(roomId, m); }
  m.set(hostId, v);
}
function deleteYtVotes(roomId: string, hostId: string) {
  const m = roomYoutubeVotes.get(roomId);
  if (!m) return;
  m.delete(hostId);
  if (m.size === 0) roomYoutubeVotes.delete(roomId);
}
type YtQueueItem = { id: string; videoId: string; title?: string; thumbnail?: string; addedBy: string };
const roomYoutubeQueue = new Map<string, YtQueueItem[]>();
// Per-host movie watch-party state: roomId → Map<hostId, MovieHostState>
type MovieHostState = { movieId: string; movieTitle: string; posterPath: string; startedBy: string; startedAt: number; playing: boolean; lastTime: number; lastTs: number };
const roomMovieState = new Map<string, Map<string, MovieHostState>>();
function getMovieHost(roomId: string, hostId: string) { return roomMovieState.get(roomId)?.get(hostId); }
function setMovieHost(roomId: string, hostId: string, state: MovieHostState) {
  let m = roomMovieState.get(roomId);
  if (!m) { m = new Map(); roomMovieState.set(roomId, m); }
  m.set(hostId, state);
}
function deleteMovieHost(roomId: string, hostId: string): boolean {
  const m = roomMovieState.get(roomId);
  if (!m) return false;
  const had = m.delete(hostId);
  if (m.size === 0) roomMovieState.delete(roomId);
  return had;
}
function listMovieHosts(roomId: string): Array<{ hostId: string; state: MovieHostState }> {
  const m = roomMovieState.get(roomId);
  if (!m) return [];
  return Array.from(m.entries()).map(([hostId, state]) => ({ hostId, state }));
}
// Archive.org movie identifiers — embeds at https://archive.org/embed/{id}
// Thumbnails at https://archive.org/services/img/{id}
// All confirmed embeddable (no X-Frame-Options, no Cloudflare blocking).
const POPULAR_MOVIES: Array<{ id: string; title: string; poster: string | null; year: string; rating: string; overview: string; keywords?: string }> = [
  // ── All-time famous horror classics ──
  { id: "Nosferatu", title: "Nosferatu (1922)", poster: "https://archive.org/services/img/Nosferatu", year: "1922", rating: "8.1", overview: "Count Orlok, an ancient vampire, terrorizes a young couple after a real estate agent visits his Transylvanian castle.", keywords: "vampire horror silent german expressionism nosferatu classic gothic" },
  { id: "Night.Of.The.Living.Dead_1080p", title: "Night of the Living Dead", poster: "https://archive.org/services/img/Night.Of.The.Living.Dead_1080p", year: "1968", rating: "7.9", overview: "The recently deceased rise from the grave and terrorize a group of survivors trapped in a rural farmhouse.", keywords: "zombie horror romero undead george romero siege classic" },
  { id: "dracula-colorized", title: "Dracula (1931)", poster: "https://archive.org/services/img/dracula-colorized", year: "1931", rating: "7.6", overview: "Count Dracula, an immortal vampire, leaves Transylvania for England to feed on fresh victims.", keywords: "dracula vampire bela lugosi universal monster horror gothic classic" },
  { id: "invisible-man-1933", title: "The Invisible Man (1933)", poster: "https://archive.org/services/img/invisible-man-1933", year: "1933", rating: "7.7", overview: "A scientist's invisibility formula drives him to madness and murder, terrorizing an English village.", keywords: "invisible man universal monster horror sci-fi h.g. wells james whale" },
  { id: "army-of-darkness-directors-cut", title: "Army of Darkness", poster: "https://archive.org/services/img/army-of-darkness-directors-cut", year: "1992", rating: "7.5", overview: "A man is accidentally transported to 1300 A.D., where he must battle an army of the dead using a chainsaw and a shotgun.", keywords: "horror comedy bruce campbell sam raimi evil dead medieval groovy cult" },
  { id: "invasion-of-the-body-snatchers-1956-colorized", title: "Invasion of the Body Snatchers", poster: "https://archive.org/services/img/invasion-of-the-body-snatchers-1956-colorized", year: "1956", rating: "7.7", overview: "A small-town doctor discovers his townspeople are being replaced one by one by emotionless alien duplicates.", keywords: "sci-fi horror alien paranoia cold war classic body snatchers pods" },
  { id: "TheGolem_893", title: "The Golem (1920)", poster: "https://archive.org/services/img/TheGolem_893", year: "1920", rating: "7.4", overview: "In medieval Prague, a rabbi creates a giant clay figure to protect the Jewish community from persecution.", keywords: "german expressionism silent horror fantasy clay monster prague golem" },
  { id: "curse-of-the-demon", title: "Curse of the Demon", poster: "https://archive.org/services/img/curse-of-the-demon", year: "1957", rating: "7.5", overview: "A sceptical psychologist investigates a Satanic cult and is cursed by a sorcerer who summons a demon.", keywords: "horror supernatural demon satanic mystery thriller night creature" },
  { id: "IBuryTheLiving1958", title: "I Bury the Living", poster: "https://archive.org/services/img/IBuryTheLiving1958", year: "1958", rating: "6.8", overview: "A cemetery manager suspects he has supernatural power over life and death when every plot he marks dies.", keywords: "horror mystery thriller cemetery death supernatural 1950s" },
  // ── Legendary sci-fi ──
  { id: "Metropolis_1927", title: "Metropolis (1927)", poster: "https://archive.org/services/img/Metropolis_1927", year: "1927", rating: "8.3", overview: "In a futuristic city sharply divided between workers and the elite, a young man falls for a prophet who speaks of a mediator.", keywords: "fritz lang sci-fi dystopia robot silent german masterpiece future city" },
  { id: "day-the-earth-stood-still-1951", title: "The Day the Earth Stood Still", poster: "https://archive.org/services/img/day-the-earth-stood-still-1951", year: "1951", rating: "7.8", overview: "An alien lands in Washington D.C. with a powerful robot and a message for all mankind — stop the violence, or face destruction.", keywords: "sci-fi alien cold war space robot 1950s classic peace klaatu" },
  { id: "earth-vs-the-flying-saucers-color", title: "Earth vs. the Flying Saucers", poster: "https://archive.org/services/img/earth-vs-the-flying-saucers-color", year: "1956", rating: "6.7", overview: "When alien saucers begin destroying Earth's satellites, scientists must find a weapon to fight back.", keywords: "sci-fi alien invasion flying saucers ray harryhausen stop motion 1950s" },
  { id: "tarantula-1955-colorized", title: "Tarantula!", poster: "https://archive.org/services/img/tarantula-1955-colorized", year: "1955", rating: "6.7", overview: "A laboratory accident unleashes an enormous tarantula that grows to monstrous size and terrorizes an Arizona desert town.", keywords: "sci-fi monster giant spider 1950s creature feature horror classic" },
  { id: "Plan9FromOuterSpace", title: "Plan 9 from Outer Space", poster: "https://archive.org/services/img/Plan9FromOuterSpace", year: "1957", rating: "4.0", overview: "Aliens resurrect the dead to conquer Earth in this legendary cult classic — widely celebrated as the greatest bad movie ever made.", keywords: "sci-fi aliens undead ed wood cult classic bad movie legendary" },
  // ── Charlie Chaplin & Silent Comedy icons ──
  { id: "OGrandeDitadorTheGreatDictatorCharlieChaplin1940", title: "The Great Dictator", poster: "https://archive.org/services/img/OGrandeDitadorTheGreatDictatorCharlieChaplin1940", year: "1940", rating: "8.4", overview: "Chaplin's first sound film — a Jewish barber is mistaken for the megalomaniacal Dictator Hynkel in a devastating satire of fascism.", keywords: "charlie chaplin comedy satire fascism wwii hitler speech classic masterpiece" },
  { id: "TheGeneralBusterKeaton", title: "The General (1926)", poster: "https://archive.org/services/img/TheGeneralBusterKeaton", year: "1926", rating: "8.2", overview: "A Confederate train engineer single-handedly chases and recaptures his stolen locomotive during the Civil War.", keywords: "buster keaton silent comedy action adventure train civil war classic stunt" },
  { id: "SherlockJr", title: "Sherlock Jr. (1924)", poster: "https://archive.org/services/img/SherlockJr", year: "1924", rating: "8.2", overview: "A projectionist who dreams of being a detective falls asleep and enters the movie screen to solve a crime.", keywords: "buster keaton silent comedy detective dream surreal classic stunt" },
  { id: "chaplin-the-kid", title: "The Kid (1921)", poster: "https://archive.org/services/img/chaplin-the-kid", year: "1921", rating: "8.3", overview: "The Tramp raises an abandoned child, forming an unbreakable bond — until authorities threaten to separate them.", keywords: "charlie chaplin silent comedy drama kid orphan tramp classic emotional" },
  // ── Hitchcock & classic thriller ──
  { id: "saboteur-1942", title: "Saboteur (1942)", poster: "https://archive.org/services/img/saboteur-1942", year: "1942", rating: "7.1", overview: "A munitions factory worker, falsely accused of sabotage, races cross-country to expose the real traitor.", keywords: "hitchcock thriller spy wwii action chase fugitive suspense classic" },
  { id: "Dr.MabuseTheGamblerdr.MabuseDerSpieler1922Part1", title: "Dr. Mabuse, the Gambler", poster: "https://archive.org/services/img/Dr.MabuseTheGamblerdr.MabuseDerSpieler1922Part1", year: "1922", rating: "8.0", overview: "Germany's most dangerous criminal mastermind manipulates, hypnotizes and destroys everything in his path for pure power.", keywords: "fritz lang german silent crime thriller expressionism mabuse masterpiece" },
  // ── Classic drama & comedy everyone knows ──
  { id: "harvey-colorized", title: "Harvey (1950)", poster: "https://archive.org/services/img/harvey-colorized", year: "1950", rating: "8.0", overview: "A kindly man's best friend is Harvey — a 6-foot 3.5-inch invisible rabbit that only he can see.", keywords: "james stewart comedy fantasy classic whimsical rabbit pooka 1950s" },
  { id: "HisGirlFriday", title: "His Girl Friday (1940)", poster: "https://archive.org/services/img/HisGirlFriday", year: "1940", rating: "7.9", overview: "A fast-talking newspaper editor tricks his ex-wife reporter into covering one last story — and remarrying him.", keywords: "screwball comedy cary grant journalism romance classic fast talk" },
  { id: "ItHappenedOneNight", title: "It Happened One Night (1934)", poster: "https://archive.org/services/img/ItHappenedOneNight", year: "1934", rating: "8.1", overview: "A runaway heiress and a roguish reporter fall in love on a cross-country bus trip. The first film to win all five major Oscars.", keywords: "clark gable claudette colbert romance comedy road trip oscar classic" },
  { id: "D-O-A-1950", title: "D.O.A. (1950)", poster: "https://archive.org/services/img/D-O-A-1950", year: "1950", rating: "7.5", overview: "A man poisoned with a slow-acting substance has just days to find out who murdered him and why.", keywords: "film noir thriller mystery detective poison murder race against time classic" },
  { id: "double-indemnity-1944", title: "Double Indemnity (1944)", poster: "https://archive.org/services/img/double-indemnity-1944", year: "1944", rating: "8.3", overview: "An insurance agent is seduced into helping a woman murder her husband to collect the payout — with fatal results.", keywords: "film noir thriller crime murder billy wilder barbara stanwyck fred macmurray classic" },
  // ── Action & adventure ──
  { id: "TheMaskOfZorro1920", title: "The Mark of Zorro (1920)", poster: "https://archive.org/services/img/TheMaskOfZorro1920", year: "1920", rating: "7.5", overview: "By day he is foppish Don Diego, but by night he becomes the masked hero Zorro, defender of the oppressed.", keywords: "zorro action adventure mask hero silent swashbuckler fairbanks classic" },
  { id: "robin-hood-1922", title: "Robin Hood (1922)", poster: "https://archive.org/services/img/robin-hood-1922", year: "1922", rating: "7.4", overview: "The Earl of Huntington becomes the legendary outlaw Robin Hood to battle the corrupt Prince John.", keywords: "robin hood adventure action silent film fairbanks medieval hero classic" },
  { id: "twenty_thousand_leagues", title: "20,000 Leagues Under the Sea (1916)", poster: "https://archive.org/services/img/twenty_thousand_leagues", year: "1916", rating: "6.9", overview: "Captain Nemo and his submarine Nautilus embark on breathtaking underwater adventures in Jules Verne's classic tale.", keywords: "jules verne adventure submarine sea nautilus captain nemo silent classic" },
  // ── Famous westerns ──
  { id: "StagecoachJohnFord", title: "Stagecoach (1939)", poster: "https://archive.org/services/img/StagecoachJohnFord", year: "1939", rating: "7.9", overview: "A group of strangers travels by stagecoach through dangerous Apache territory in John Ford's landmark western.", keywords: "john ford john wayne western stagecoach classic landmark apache frontier" },
  { id: "high-noon-1952", title: "High Noon (1952)", poster: "https://archive.org/services/img/high-noon-1952", year: "1952", rating: "8.0", overview: "A retiring marshal is abandoned by the townspeople he protected when a deadly outlaw returns for revenge at noon.", keywords: "western gary cooper grace kelly marshal outlaw showdown classic oscar" },
  { id: "AgainstACrookedSky", title: "Against a Crooked Sky (1975)", poster: "https://archive.org/services/img/AgainstACrookedSky", year: "1975", rating: "5.9", overview: "A young man embarks on a desperate journey through the frontier to rescue his sister from a Native American tribe.", keywords: "western adventure family frontier 1970s survival quest" },
].filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i);
const roomBookState = new Map<string, { book: any; hostId: string; scrollPct: number; watchers: Set<string> }>();
const roomRoles = new Map<string, Map<string, string>>();
const trollVoteState = new Map<string, { targetUserId: string; votes: Set<string> }>();
const hostVoteState = new Map<string, { nomineeId: string; nomineeName: string; nominatorId: string; nominatorName: string; yesVotes: Set<string>; noVotes: Set<string>; timer: NodeJS.Timeout }>();
const trollCooldown = new Map<string, number>();
const roomMuteStatus = new Map<string, Map<string, boolean>>();
const userSockets = new Map<string, string>();
const userCurrentRoom = new Map<string, string>();
// Ephemeral per-room set of userIds whom the host has Allowed via knock —
// these users get to bypass the capacity check on their next room:join, then
// the grant is consumed.
const roomKnockGrants = new Map<string, Set<string>>();
// Knock denial history — tracks progressive cooldowns per room+user.
// key: `${roomId}:${userId}` → { count: denials so far, cooldownUntil: ms timestamp }
// Cooldown ladder (minutes): 5 → 10 → 20 → 40 → permanently banned after 5 denials.
const KNOCK_COOLDOWN_MINUTES = [5, 10, 20, 40, 80];
const MAX_KNOCK_DENIALS = 5; // 5th denial = permanently banned
const knockDenials = new Map<string, { count: number; cooldownUntil: number }>();
const roomDeleteTimers = new Map<string, NodeJS.Timeout>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();
const socketCountries = new Map<string, string>();
const roomMessageReactions = new Map<string, Map<string, Set<string>>>();
const roomPinnedMessages = new Map<string, { message: any; pinnedBy: string; pinnedByName: string; pinnedAt: number } | null>();
// DJ scene system — tracks which scene index each room is on so skip broadcasts are in sync
const roomDjSceneIdx = new Map<string, number>();
const DJ_SCENE_LIST = ["spotlight","namestorm","disco","kiss","cocktails","boomer","laser","fireworks","aurora","vortex","matrix"];
// Disco overlay scene — tracks which of the 7 cinematic scenes is showing so all clients stay in sync
const roomDiscoOverlaySceneIdx = new Map<string, number>();
// DJ move style — tracks the current sling/animation style so late-joiners get the same theme
const roomDjMoveStyle = new Map<string, string>();
// Join deduplication — prevents doubled "X joined" system messages caused by the race
// between initMedia() emitting room:join and the socket "connect" listener (handleReconnect)
// both firing almost simultaneously on first page load.
const joiningNow = new Set<string>();

// ── Follower room-join push notifications ──────────────────────────────────
// Cooldown prevents a follower from receiving more than one push per joiner
// within a 15-minute window (handles reconnects, room hops, etc.).
// Key: `${followerUserId}:${joiningUserId}`
const followerNotifyCooldown = new Map<string, number>();
const FOLLOWER_NOTIFY_COOLDOWN_MS = 15 * 60 * 1000;

async function notifyFollowersRoomJoin(
  joiningUser: User,
  room: { id: string; name: string },
): Promise<void> {
  try {
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) return;

    const followers = await storage.getFollowers(joiningUser.id);
    if (followers.length === 0) return;

    webpush.setVapidDetails("mailto:hello@vextorn.app", vapidPublic, vapidPrivate);

    const joinerName =
      joiningUser.displayName ||
      joiningUser.firstName ||
      joiningUser.email?.split("@")[0] ||
      "Someone you follow";

    const roomParticipantsInRoom = roomParticipants.get(room.id);
    const followerIds = followers.map((f) => f.followerId);
    const now = Date.now();

    // Batch-fetch each follower's notification preference
    const prefs = await storage.getRoomJoinNotifyPrefs(followerIds);

    // For followers who prefer "mutual only", we need to know if the joining
    // user also follows them back. Fetch once and build a Set for O(1) lookup.
    const hasMutualPref = followerIds.some((id) => prefs[id] === "mutual");
    let joiningUserFollowingSet: Set<string> = new Set();
    if (hasMutualPref) {
      const joiningUserFollowing = await storage.getFollowing(joiningUser.id);
      joiningUserFollowingSet = new Set(joiningUserFollowing.map((f) => f.followingId));
    }

    // Fetch per-follower explicit notification preferences (overrides global pref when set)
    const explicitNotifPrefs = await storage.getFollowerNotifPrefs(joiningUser.id, followerIds);

    const payload = JSON.stringify({
      title: `${joinerName} joined a room`,
      body: `"${room.name}" — tap to listen in`,
      url: `/rooms/${room.id}`,
      icon: joiningUser.profileImageUrl || "/vextorn-icon-192.png",
    });

    await Promise.allSettled(
      followers.map(async (follow) => {
        const followerUserId = follow.followerId;

        // Check per-user explicit prefs first (overrides global preference)
        const explicitPref = explicitNotifPrefs[followerUserId];
        if (explicitPref) {
          if (!explicitPref.notifyRoomJoin) return; // explicitly disabled
          // else: explicitly enabled — skip the global pref check entirely
        } else {
          // Fall back to follower's global notification preference
          const pref = prefs[followerUserId] ?? "mutual";
          if (pref === "none") return;
          if (pref === "mutual" && !joiningUserFollowingSet.has(followerUserId)) return;
        }

        // Skip if the follower is already inside the same room
        if (roomParticipantsInRoom?.has(followerUserId)) return;

        // Cooldown check — max one push per joiner per follower per 15 min
        const cooldownKey = `${followerUserId}:${joiningUser.id}`;
        const lastNotified = followerNotifyCooldown.get(cooldownKey) ?? 0;
        if (now - lastNotified < FOLLOWER_NOTIFY_COOLDOWN_MS) return;
        followerNotifyCooldown.set(cooldownKey, now);

        const subs = await storage.getPushSubscriptionsByUser(followerUserId);
        if (subs.length === 0) return;

        await Promise.allSettled(
          subs.map(async (sub) => {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
              );
            } catch (err: any) {
              if (err.statusCode === 410) {
                await storage.deletePushSubscription(sub.endpoint).catch(() => {});
              }
            }
          }),
        );
      }),
    );

    // Purge stale cooldown entries older than the window to prevent unbounded growth
    if (followerNotifyCooldown.size > 5000) {
      for (const [key, ts] of followerNotifyCooldown) {
        if (now - ts > FOLLOWER_NOTIFY_COOLDOWN_MS) followerNotifyCooldown.delete(key);
      }
    }
  } catch (err: any) {
    console.error("[push] notifyFollowersRoomJoin error:", err?.message || err);
  }
}

// Push notification when a non-mutual user follows you
async function notifyNewFollowerPush(followerId: string, followedId: string): Promise<void> {
  try {
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) return;

    const subs = await storage.getPushSubscriptionsByUser(followedId);
    if (subs.length === 0) return;

    const follower = await storage.getUser(followerId);
    if (!follower) return;

    const followerName = follower.displayName || follower.firstName || follower.email?.split("@")[0] || "Someone";
    webpush.setVapidDetails("mailto:hello@vextorn.app", vapidPublic, vapidPrivate);

    const payload = JSON.stringify({
      title: `${followerName} started following you`,
      body: "You have a new follower — tap to view their profile",
      url: `/profile/${followerId}`,
      icon: follower.profileImageUrl || "/vextorn-icon-192.png",
    });

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } catch (err: any) {
          if (err.statusCode === 410) await storage.deletePushSubscription(sub.endpoint).catch(() => {});
        }
      }),
    );
  } catch (err: any) {
    console.error("[push] notifyNewFollowerPush error:", err?.message || err);
  }
}

// Per-DM push cooldown: max one push per sender-recipient pair per 2 min
const dmNotifyCooldown = new Map<string, number>();
const DM_NOTIFY_COOLDOWN_MS = 2 * 60 * 1000;

async function notifyDmPush(senderId: string, recipientId: string, senderUser: User | null | undefined): Promise<void> {
  try {
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) return;

    const cooldownKey = `${senderId}:${recipientId}`;
    const now = Date.now();
    const lastNotified = dmNotifyCooldown.get(cooldownKey) ?? 0;
    if (now - lastNotified < DM_NOTIFY_COOLDOWN_MS) return;

    const blocked = await storage.getDmNotifBlocked(senderId, recipientId);
    if (blocked) return;

    const subs = await storage.getPushSubscriptionsByUser(recipientId);
    if (subs.length === 0) return;

    dmNotifyCooldown.set(cooldownKey, now);
    if (dmNotifyCooldown.size > 5000) {
      for (const [key, ts] of dmNotifyCooldown) {
        if (now - ts > DM_NOTIFY_COOLDOWN_MS) dmNotifyCooldown.delete(key);
      }
    }

    webpush.setVapidDetails("mailto:hello@vextorn.app", vapidPublic, vapidPrivate);
    const senderName = senderUser?.displayName || senderUser?.firstName || senderUser?.email?.split("@")[0] || "Someone";
    const payload = JSON.stringify({
      title: `New message from ${senderName}`,
      body: "Tap to open your messages",
      url: `/messages`,
      icon: senderUser?.profileImageUrl || "/vextorn-icon-192.png",
    });

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        } catch (err: any) {
          if (err.statusCode === 410) await storage.deletePushSubscription(sub.endpoint).catch(() => {});
        }
      }),
    );
  } catch (err: any) {
    console.error("[push] notifyDmPush error:", err?.message || err);
  }
}
// AI Tutor room state: one active session per room
const roomAiTutorState = new Map<string, { userId: string; username: string; speaking: boolean; avatarId?: string | null; voice?: "Female" | "Male" | null; voiceId?: string | null } | null>();
// SSE clients subscribed to real-time room list updates.
// Each entry holds the Express Response and its keepalive heartbeat timer.
const sseRoomClients = new Set<{ res: any; timer: ReturnType<typeof setInterval> }>();
const roomAiTutorEnabled = new Map<string, boolean>(); // host can disable
// Chess: one active built-in match per room
type ChessSeat = { userId: string; username: string; avatar?: string | null } | null;
const roomChessState = new Map<string, {
  fen: string;
  pgn: string;
  white: ChessSeat;
  black: ChessSeat;
  turn: "w" | "b";
  status: "waiting" | "playing" | "ended";
  winner?: "white" | "black" | "draw" | null;
  endReason?: string | null;
  startedAt: number;
  lastMove?: { from: string; to: string; san: string } | null;
  timeControl?: number | null;
  clocks?: { white: number; black: number; lastTickAt: number } | null;
  mode?: "standard" | "timed" | null;
}>();

type TttSeat = { userId: string; username: string; avatar: string | null } | null;
const roomTttState = new Map<string, {
  board: (null | "X" | "O")[];
  turn: "X" | "O";
  status: "active" | "ended";
  winner: "X" | "O" | "draw" | null;
  winLine: number[] | null;
  x: TttSeat;
  o: TttSeat;
  scores: { x: number; o: number; draws: number };
  startedAt: number;
}>();

const pendingTttChallenges = new Map<string, { challengerId: string; challengerName: string; challengerAvatar: string | null; roomId: string }>();

// Connect Four: one active match per room
type C4Seat = { userId: string; username: string; avatar: string | null } | null;
const roomC4State = new Map<string, {
  board: (null | "red" | "yellow")[][];
  turn: "red" | "yellow";
  status: "playing" | "ended";
  winner: "red" | "yellow" | "draw" | null;
  winLine: [number, number][] | null;
  red: C4Seat;
  yellow: C4Seat;
  scores: { red: number; yellow: number; draws: number };
  startedAt: number;
}>();
const pendingC4Challenges = new Map<string, { challengerId: string; challengerName: string; challengerAvatar: string | null; roomId: string }>();

function c4CheckWin(board: (null | "red" | "yellow")[][]): { winner: "red" | "yellow" | "draw"; line: [number, number][] } | null {
  const ROWS = 6, COLS = 7;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]] as [number,number][]) {
        const line: [number,number][] = [];
        for (let i = 0; i < 4; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== cell) break;
          line.push([nr, nc]);
        }
        if (line.length === 4) return { winner: cell as "red" | "yellow", line };
      }
    }
  }
  if (board[0].every(c => c !== null)) return { winner: "draw", line: [] };
  return null;
}

// Lichess shared embed per room (URL string of game/study/tv)
const roomLichessState = new Map<string, { url: string; sharedBy: string } | null>();

// JKLM.fun shared game per room
const roomJklmState = new Map<string, { url: string; sharedBy: string; sharedByName: string } | null>();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const legacyAssetPattern = /^\/((?:avatar|image|hologram|announcement|welcome)[-_][A-Za-z0-9_.-]+\.(?:png|jpe?g|gif|webp|mp4|webm|mov|ogg))$/i;

function normalizeProfileImageUrl(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(https?:|data:|blob:|\/uploads\/)/i.test(trimmed)) return trimmed;
  const filename = path.basename(trimmed);
  if (!/\.(png|jpe?g|gif|webp)$/i.test(filename)) return trimmed.startsWith("/") ? trimmed : `/${filename}`;
  if (fs.existsSync(path.join(uploadsDir, filename))) return `/uploads/${filename}`;
  return trimmed.startsWith("/") ? trimmed : `/${filename}`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Fetch a remote image URL and return it as a Buffer (2-second timeout). */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

/** Return a circular-masked avatar PNG buffer for the given user. Falls back to a coloured initial circle. */
async function makeAvatarCircle(user: User, size: number): Promise<Buffer> {
  const half = size / 2;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${half}" cy="${half}" r="${half}" fill="white"/></svg>`
  );
  const url = user.profileImageUrl;
  if (url) {
    const raw = await fetchImageBuffer(url.startsWith("http") ? url : `https://vextorn.com${url}`);
    if (raw) {
      try {
        return await sharp(raw)
          .resize(size, size, { fit: "cover", position: "center" })
          .composite([{ input: mask, blend: "dest-in" }])
          .png()
          .toBuffer();
      } catch { /* fall through to initials */ }
    }
  }
  const PALETTE = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#c026d3"];
  const color = PALETTE[(user.id.charCodeAt(0) || 0) % PALETTE.length];
  const initials = escapeHtml(
    ((user as any).firstName?.[0] || (user as any).username?.[0] || "?").toUpperCase()
  );
  return await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <circle cx="${half}" cy="${half}" r="${half}" fill="${color}"/>
        <text x="${half}" y="${half + size * 0.14}" text-anchor="middle" font-family="sans-serif"
              font-size="${Math.round(size * 0.38)}px" font-weight="700" fill="white">${initials}</text>
      </svg>`
    )
  ).png().toBuffer();
}

function roomPublicPayload(room: any, includeAccessKey = false) {
  if (!room) return room;
  return includeAccessKey ? room : { ...room, accessKey: null };
}

// Push the current full room list to every SSE subscriber.
// Full snapshots avoid diff-sync edge-cases and compress well (≈ 2 KB Brotli).
async function broadcastRooms() {
  if (sseRoomClients.size === 0) return;
  try {
    const allRooms = await storage.getAllRooms();
    const rooms = allRooms.filter((r) => (r.activeUsers ?? 0) > 0).map((r) => roomPublicPayload(r));
    const payload = `event: rooms\ndata: ${JSON.stringify(rooms)}\n\n`;
    for (const client of sseRoomClients) {
      try { client.res.write(payload); } catch {}
    }
  } catch {}
}

function canManageRoomLink(user: User | undefined | null, room: any) {
  return !!user && (
    user.id === room.ownerId ||
    user.role === "admin" ||
    user.role === "superadmin" ||
    user.email === "dj55jggg@gmail.com"
  );
}

const uploadStorage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

const videoStorage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `hologram-${Date.now()}${ext}`);
  },
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    /* Hologram backgrounds may be a video (mp4/webm/mov/ogg) OR a still
       image / GIF (jpeg/png/gif/webp). The frontend renders the file with
       a <video> tag for video MIME types and an <img> tag otherwise. */
    const allowedExt = /\.(mp4|webm|mov|ogg|jpe?g|png|gif|webp)$/i.test(file.originalname);
    const allowedMime =
      /video\/(mp4|webm|quicktime|ogg)/.test(file.mimetype) ||
      /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    cb(null, allowedExt && allowedMime);
  },
});

const announcementMediaStorage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `announcement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const uploadAnnouncementMedia = multer({
  storage: announcementMediaStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExt = /\.(jpe?g|png|gif|webp)$/i.test(file.originalname);
    const allowedMime = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    cb(null, allowedExt && allowedMime);
  },
});

const welcomeMediaStorage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `welcome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const uploadWelcomeMedia = multer({
  storage: welcomeMediaStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExt = /\.(jpe?g|png|gif|webp)$/i.test(file.originalname);
    const allowedMime = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    cb(null, allowedExt && allowedMime);
  },
});

const pushImageStorage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const uploadPushImage = multer({
  storage: pushImageStorage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExt = /\.(jpe?g|png|gif|webp)$/i.test(file.originalname);
    const allowedMime = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    cb(null, allowedExt && allowedMime);
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const allowedOrigins = [
    /^https?:\/\/localhost(:\d+)?$/,
    /\.railway\.app$/,
    /\.replit\.dev$/,
    /\.replit\.app$/,
    /^https:\/\/(www\.)?vextorn\.com$/,
    /^https:\/\/(www\.)?afikgang\.online$/,
  ];
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production"
        ? (origin, cb) => {
            if (!origin || allowedOrigins.some(p => p.test(origin))) cb(null, true);
            else cb(null, false);
          }
        : "*",
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    allowUpgrades: true,
  });

  registerImageProxy(app);

  app.use("/api", apiRateLimiter);
  app.use("/api/auth", authRateLimiter);
  app.use("/api", threatDetectionMiddleware);
  app.use("/api", privilegeCheckMiddleware);

  securityBus.on("security:event", async (event) => {
    try {
      const adminUsers = await storage.getAllUsers();
      const admins = adminUsers.filter(
        (u) => u.role === "admin" || u.role === "superadmin" || u.email === "dj55jggg@gmail.com"
      );
      for (const admin of admins) {
        const socketId = userSockets.get(admin.id);
        if (socketId) {
          io.to(socketId).emit("security:admin_alert", {
            id: event.id,
            eventType: event.eventType,
            severity: event.severity,
            description: event.description,
            requestPath: event.requestPath,
            createdAt: event.createdAt,
          });
        }
      }
    } catch {}
  });

  // Uploaded files are content-addressed (multer hash names that never change
  // for the same file), so we can cache them aggressively. 30 days + must-
  // revalidate gives Lighthouse the long-cache TTL it wants for "Use efficient
  // cache lifetimes" while still letting the user hard-refresh to bypass.
  app.use("/uploads", (_req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=2592000, must-revalidate");
    next();
  });
  const expressStatic = (await import("express")).default.static;
  app.use("/uploads", expressStatic(uploadsDir, { maxAge: "30d", immutable: false }));

  app.get(legacyAssetPattern, (req, res, next) => {
    const filename = req.params[0];
    const filePath = path.join(process.cwd(), filename);
    if (!filePath.startsWith(process.cwd() + path.sep) || !fs.existsSync(filePath)) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=2592000, must-revalidate");
    res.sendFile(filePath);
  });

  /* ──────────────────────────────────────────────────────────────────
   * Lobby (root "/") — dynamic title with live room count.
   * Googlebot lands here first; a title like "42 live rooms · Vextorn"
   * signals freshness and boosts click-through from search results.
   * We count only public rooms, cache the rendered HTML for 60 seconds
   * so the DB is hit at most once per minute even under crawler bursts,
   * and set matching Cache-Control so CDN edges do the same.
   * Only runs in production where dist/public/index.html exists; dev
   * traffic falls through to Vite's HMR catch-all unchanged.
   * ────────────────────────────────────────────────────────────────── */
  const lobbyHtmlCache = new Map<string, { html: string; expiresAt: number }>();
  const LOBBY_TTL_MS = 60_000; // 60 seconds

  app.get("/", async (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    const accept = req.headers.accept || "";
    if (!accept.includes("text/html")) return next();
    try {
      const origin = getOrigin(req);
      const now = Date.now();
      const cached = lobbyHtmlCache.get(origin);
      if (cached && cached.expiresAt > now) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
        res.setHeader("X-Cache", "HIT");
        res.send(cached.html);
        return;
      }

      const rooms = await storage.getAllRooms();
      const publicCount = rooms.filter((r) => r.isPublic).length;
      const countPrefix = publicCount > 0
        ? `${publicCount} live room${publicCount === 1 ? "" : "s"} · `
        : "";

      // Use the fully-transformed precomputed HTML (CSS-async, modulepreload
      // injections) as the base so the lobby loads correctly in production.
      // Falls back to the raw on-disk template if precomputed isn't ready yet.
      const html = renderIndexHtml(origin, {
        title: `${countPrefix}Vextorn — Talk. Share. Belong.`,
        description:
          "Join live voice rooms to practice languages with speakers worldwide. Beginner to advanced levels in English, Spanish, French, Japanese and more.",
        canonical: `${origin}/`,
        breadcrumbs: [{ name: "Home", url: "/" }],
      }, getPrecomputedHtml());
      if (!html) return next();

      lobbyHtmlCache.set(origin, { html, expiresAt: now + LOBBY_TTL_MS });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
      res.send(html);
    } catch {
      next();
    }
  });

  // Dynamic sitemap — listed in robots.txt and pinged from Google Search
  // Console. Lists every public room (using its short ID URL) and every
  // teacher (deep-linked into /teachers) so each one can be discovered and
  // ranked individually instead of buried behind a SPA navigation. Cached
  // for 1 hour at the edge so we don't hit the DB on every crawler request.
  /* ──────────────────────────────────────────────────────────────────
   * Per-room dynamic Open Graph + Twitter Card meta tag injection.
   * When a social media crawler (WhatsApp, Discord, Slack, X, iMessage,
   * etc.) fetches /room/:id, we serve the built index.html with the
   * OG title / description / image / canonical / JSON-LD rewritten to
   * describe THIS room — so a shared link gets a rich preview with the
   * room name, language, level and avatar/hologram art instead of the
   * generic site card. Only runs in production (where we have a built
   * dist/public/index.html); in development we let Vite's catch-all
   * serve the regular HTML so HMR keeps working for the developer.
   * ────────────────────────────────────────────────────────────────── */
  app.get("/room/:roomId", async (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    const accept = req.headers.accept || "";
    if (!accept.includes("text/html")) return next();
    try {
      const roomParam = req.params.roomId;
      if (!roomParam) return next();
      const room = isUuid(roomParam)
        ? await storage.getRoom(roomParam)
        : await storage.getRoomByShortId(roomParam);
      if (!room) return next();

      const origin = getOrigin(req);
      const slug = room.shortId || room.id;
      const url = `${origin}/room/${slug}`;

      const title = `${room.title} — Live ${room.language} (${room.level}) voice room | Vextorn`;
      const description = `Join "${room.title}", a live ${room.language} (${room.level}) voice room on Vextorn. ${room.activeUsers} talking now${room.maxUsers ? ` · ${room.maxUsers} max` : ""}.`;

      // Dynamic OG image: always use the live-participant thumbnail endpoint
      // so the social card shows whoever is in the room right now.
      // Crawlers that follow this URL will get a 1200×630 PNG generated
      // on-the-fly by /api/rooms/:id/og-image.
      const ogImage = `${origin}/api/rooms/${room.shortId || room.id}/og-image`;

      // Breadcrumb: Home > Rooms > {Room Title}. We point "Rooms" at /
      // because the lobby IS the rooms index — keeping the trail honest.
      const breadcrumbs: BreadcrumbItem[] = [
        { name: "Home", url: "/" },
        { name: "Voice Rooms", url: "/" },
        { name: room.title, url: `/room/${slug}` },
      ];

      const html = renderIndexHtml(origin, {
        title,
        description,
        canonical: url,
        ogImage,
        breadcrumbs,
      });
      if (!html) return next();

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      // Short cache: the og:image URL itself is stable (endpoint is always the
      // same) — crawlers re-fetch it on demand; the HTML can cache a bit longer.
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
      res.send(html);
    } catch {
      next();
    }
  });

  /* ──────────────────────────────────────────────────────────────────
   * /teachers — Find Teachers landing page.
   * Per-route title + description + BreadcrumbList JSON-LD so this page
   * gets its own rich-result entry instead of inheriting the lobby's.
   * ────────────────────────────────────────────────────────────────── */
  app.get("/teachers", (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    const accept = req.headers.accept || "";
    if (!accept.includes("text/html")) return next();
    try {
      const origin = getOrigin(req);
      const url = `${origin}/teachers`;
      const html = renderIndexHtml(origin, {
        title: "Find Teachers — Book a 1-on-1 language tutor | Vextorn",
        description:
          "Browse verified language teachers on Vextorn and book a 1-on-1 conversation session. Find tutors for English, Spanish, French, Korean, Japanese and more.",
        canonical: url,
        breadcrumbs: [
          { name: "Home", url: "/" },
          { name: "Find Teachers", url: "/teachers" },
        ],
      });
      if (!html) return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      // Teachers list updates when admins add/remove tutors — 5 min is a
      // good balance between freshness and crawler-burst protection.
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
      res.send(html);
    } catch {
      next();
    }
  });

  /* /teachers/:teacherId — Individual teacher profile (deep-link). */
  app.get("/teachers/:teacherId", async (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    const accept = req.headers.accept || "";
    if (!accept.includes("text/html")) return next();
    try {
      const teacherId = req.params.teacherId;
      if (!teacherId) return next();
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) return next();

      const origin = getOrigin(req);
      const url = `${origin}/teachers/${teacherId}`;
      const langs = Array.isArray(teacher.languages) ? teacher.languages.join(", ") : "";
      const title = `${teacher.name} — ${langs || "Language"} Teacher | Vextorn`;
      const desc =
        (teacher.bio && teacher.bio.length > 0
          ? teacher.bio.slice(0, 155).replace(/\s+/g, " ").trim()
          : `Book a 1-on-1 ${langs || "language"} session with ${teacher.name} on Vextorn.`);

      const html = renderIndexHtml(origin, {
        title,
        description: desc,
        canonical: url,
        ogImage: teacher.avatarUrl || undefined,
        breadcrumbs: [
          { name: "Home", url: "/" },
          { name: "Find Teachers", url: "/teachers" },
          { name: teacher.name, url: `/teachers/${teacherId}` },
        ],
      });
      if (!html) return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
      res.send(html);
    } catch {
      next();
    }
  });

  /* /admin — Admin dashboard. Noindex (gated), but breadcrumb still helps
     screen-reader users orient themselves. */
  app.get("/admin", (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    const accept = req.headers.accept || "";
    if (!accept.includes("text/html")) return next();
    try {
      const origin = getOrigin(req);
      const html = renderIndexHtml(origin, {
        title: "Admin Dashboard | Vextorn",
        description: "Vextorn admin dashboard — moderation, analytics and configuration.",
        canonical: `${origin}/admin`,
        noindex: true,
        breadcrumbs: [
          { name: "Home", url: "/" },
          { name: "Admin", url: "/admin" },
        ],
      });
      if (!html) return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      // Admin pages should never be CDN-cached — set private+no-store so
      // shared caches never serve them to other users.
      res.setHeader("Cache-Control", "private, no-store");
      res.send(html);
    } catch {
      next();
    }
  });

  /* /payment-methods — User payment methods management. */
  app.get("/payment-methods", (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    const accept = req.headers.accept || "";
    if (!accept.includes("text/html")) return next();
    try {
      const origin = getOrigin(req);
      const html = renderIndexHtml(origin, {
        title: "Payment Methods | Vextorn",
        description: "Manage your saved payment methods on Vextorn.",
        canonical: `${origin}/payment-methods`,
        noindex: true,
        breadcrumbs: [
          { name: "Home", url: "/" },
          { name: "Payment Methods", url: "/payment-methods" },
        ],
      });
      if (!html) return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "private, no-store");
      res.send(html);
    } catch {
      next();
    }
  });

  /* /messages/:userId — Direct-message thread. Authenticated-only. */
  app.get("/messages/:userId", (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    const accept = req.headers.accept || "";
    if (!accept.includes("text/html")) return next();
    try {
      const origin = getOrigin(req);
      const otherId = req.params.userId;
      if (!otherId) return next();
      const html = renderIndexHtml(origin, {
        title: "Direct Messages | Vextorn",
        description: "Continue your conversation on Vextorn.",
        canonical: `${origin}/messages/${otherId}`,
        noindex: true,
        breadcrumbs: [
          { name: "Home", url: "/" },
          { name: "Messages", url: `/messages/${otherId}` },
        ],
      });
      if (!html) return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "private, no-store");
      res.send(html);
    } catch {
      next();
    }
  });

  // Per-origin in-memory cache for the sitemap XML so back-to-back crawler
  // hits don't re-query the rooms + teachers tables. TTL is short enough that
  // newly-created rooms still appear within minutes, but long enough to
  // absorb crawler bursts (Googlebot/Bingbot can re-fetch within seconds).
  const SITEMAP_TTL_MS = 5 * 60 * 1000; // 5 minutes
  const sitemapCache = new Map<string, { xml: string; expiresAt: number }>();

  app.get("/sitemap.xml", async (req, res) => {
    try {
      const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
      const host = req.get("host") || "vextorn.com";
      const origin = `${proto}://${host}`;

      const now = Date.now();
      const cached = sitemapCache.get(origin);
      if (cached && cached.expiresAt > now) {
        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
        res.setHeader("X-Cache", "HIT");
        res.send(cached.xml);
        return;
      }

      const [allRooms, allTeachers] = await Promise.all([
        storage.getAllRooms(),
        storage.getAllTeachers(),
      ]);

      const escape = (s: string) =>
        s
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");

      const fmtDate = (d: Date | string | null | undefined): string => {
        if (!d) return new Date().toISOString();
        const date = d instanceof Date ? d : new Date(d);
        return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
      };

      const urls: string[] = [];

      urls.push(
        `<url><loc>${origin}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`
      );
      urls.push(
        `<url><loc>${origin}/teachers</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`
      );

      for (const room of allRooms) {
        if (!room.isPublic) continue;
        const slug = room.shortId || room.id;
        if (!slug) continue;
        urls.push(
          `<url>` +
            `<loc>${origin}/room/${escape(slug)}</loc>` +
            `<lastmod>${fmtDate(room.createdAt)}</lastmod>` +
            `<changefreq>hourly</changefreq>` +
            `<priority>0.7</priority>` +
            `</url>`
        );
      }

      for (const teacher of allTeachers) {
        if (!teacher.id) continue;
        urls.push(
          `<url>` +
            `<loc>${origin}/teachers/${escape(teacher.id)}</loc>` +
            `<lastmod>${fmtDate(teacher.createdAt)}</lastmod>` +
            `<changefreq>weekly</changefreq>` +
            `<priority>0.6</priority>` +
            `</url>`
        );
      }

      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.join("\n") +
        `\n</urlset>`;

      // Cache and prune any stale entries to keep the map small even if the
      // app is hit from many different host headers (preview, deploy, custom).
      sitemapCache.set(origin, { xml, expiresAt: now + SITEMAP_TTL_MS });
      if (sitemapCache.size > 32) {
        for (const [key, value] of sitemapCache) {
          if (value.expiresAt <= now) sitemapCache.delete(key);
        }
      }

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
      res.setHeader("X-Cache", "MISS");
      res.send(xml);
    } catch (err: any) {
      res.status(500).type("text/plain").send(`sitemap error: ${err.message}`);
    }
  });

  // Robots.txt — generated dynamically so the sitemap URL always matches the
  // host being served (preview, deploy, custom domain, etc.). Cached per-origin
  // so we serve straight from memory after the first hit per host.
  const ROBOTS_TTL_MS = 60 * 60 * 1000; // 1 hour — content rarely changes
  const robotsCache = new Map<string, { body: string; expiresAt: number }>();

  app.get("/robots.txt", (req, res) => {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
    const host = req.get("host") || "vextorn.com";
    const origin = `${proto}://${host}`;

    const now = Date.now();
    const cached = robotsCache.get(origin);
    let body: string;
    let cacheStatus: "HIT" | "MISS";
    if (cached && cached.expiresAt > now) {
      body = cached.body;
      cacheStatus = "HIT";
    } else {
      body =
        `User-agent: *\n` +
        `Allow: /\n` +
        `Disallow: /api/\n` +
        `Disallow: /uploads/\n` +
        `Disallow: /admin\n` +
        `Disallow: /messages/\n\n` +
        `Sitemap: ${origin}/sitemap.xml\n`;
      robotsCache.set(origin, { body, expiresAt: now + ROBOTS_TTL_MS });
      cacheStatus = "MISS";
      if (robotsCache.size > 32) {
        for (const [key, value] of robotsCache) {
          if (value.expiresAt <= now) robotsCache.delete(key);
        }
      }
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.setHeader("X-Cache", cacheStatus);
    res.send(body);
  });

  app.get("/api/rooms/participants", async (_req, res) => {
    try {
      const allParticipants: Record<string, User[]> = {};
      for (const [roomId, participants] of Array.from(roomParticipants.entries())) {
        allParticipants[roomId] = Array.from(participants.values());
      }
      // Participants change every time a user joins/leaves, so we must never
      // serve stale data from the browser cache. no-store forces a real round-
      // trip on every call; socket events handle real-time updates between polls.
      res.setHeader("Cache-Control", "no-store");
      res.json(allParticipants);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/rooms/:id/participants", async (req, res) => {
    try {
      const { id } = req.params;

      // roomParticipants is always keyed by UUID. Resolve shortId → UUID.
      let roomUuid = id;
      if (!isUuid(id)) {
        const resolved = await storage.getRoomByShortId(id);
        if (resolved) roomUuid = resolved.id;
      }

      let roomParts = roomParticipants.get(roomUuid);

      // Last-resort: if still not found, search all participants for a room
      // whose UUID matches (handles edge cases where cache disagrees with map).
      if (!roomParts && roomUuid !== id) {
        // Try the raw id as well (defensive)
        roomParts = roomParticipants.get(id);
      }

      res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=60");
      res.json(roomParts ? Array.from(roomParts.values()) : []);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /* ──────────────────────────────────────────────────────────────────
   * Dynamic OG social-share thumbnail for a room.
   *
   * GET /api/rooms/:id/og-image
   *   → 1200×630 PNG showing the room name, language/level, and the
   *     avatars + display-names of everyone currently in the room.
   *
   * Used as the og:image / twitter:image for /room/:id so that when
   * someone pastes a room link into Discord, Slack, iMessage, X, etc.
   * the preview card shows who is live right now.
   *
   * No-cache headers: participant list changes with every join/leave, so
   * stale cards would be misleading. Crawlers re-fetch on every visit.
   * ────────────────────────────────────────────────────────────────── */
  app.get("/api/rooms/:id/og-image", async (req, res) => {
    try {
      const roomParam = req.params.id;
      const room = isUuid(roomParam)
        ? await storage.getRoom(roomParam)
        : await storage.getRoomByShortId(roomParam);
      if (!room) return res.status(404).end();

      const parts = Array.from(roomParticipants.get(room.id)?.values() || []);
      const displayParts = parts.slice(0, 5);
      const count = parts.length;

      const W = 1200, H = 630;
      const AVG = 120;   // avatar diameter
      const GAP = 20;    // gap between avatars
      const AVATAR_Y = 370;

      const totalAvatarW = displayParts.length * AVG + Math.max(0, displayParts.length - 1) * GAP;
      const avatarStartX = Math.round((W - totalAvatarW) / 2);

      const safeTitle = escapeHtml(room.title.length > 32 ? room.title.slice(0, 29) + "…" : room.title);
      const safeLang  = escapeHtml(`${room.language} · ${room.level}`);
      const inRoomLbl = `IN THE ROOM NOW · ${count}`;

      // ── SVG background layer ──────────────────────────────────────
      const bgSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#13102a"/>
      <stop offset="55%"  stop-color="#0e0c1e"/>
      <stop offset="100%" stop-color="#090716"/>
    </linearGradient>
    <radialGradient id="glow" cx="18%" cy="30%" r="55%">
      <stop offset="0%"   stop-color="#7c3aed" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="85%" cy="75%" r="45%">
      <stop offset="0%"   stop-color="#2563eb" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- background fill -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- ambient glows -->
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>
  <!-- top accent bar -->
  <rect width="${W}" height="4" fill="#7c3aed" opacity="0.9"/>

  <!-- brand name -->
  <text x="60" y="74" font-family="sans-serif" font-size="22" font-weight="700"
        fill="#8b5cf6" letter-spacing="3">VEXTORN</text>
  <text x="60" y="96" font-family="sans-serif" font-size="11" font-weight="400"
        fill="#6b5fa0" letter-spacing="2">TALK · SHARE · BELONG</text>
  <rect x="60" y="112" width="120" height="1" fill="#8b5cf6" opacity="0.3"/>

  <!-- room title -->
  <text x="60" y="210" font-family="sans-serif" font-size="58" font-weight="800"
        fill="white">${safeTitle}</text>

  <!-- language · level · N in room -->
  <text x="60" y="264" font-family="sans-serif" font-size="26" font-weight="500" fill="#a78bfa">${safeLang}</text>
  <text x="60" y="264" dx="${safeLang.length * 14 + 30}" font-family="sans-serif" font-size="26"
        font-weight="600" fill="#4ade80">· ${count} in room</text>

  <!-- "IN THE ROOM NOW · N" label -->
  <text x="60" y="340" font-family="sans-serif" font-size="13" font-weight="700"
        fill="#6b5fa0" letter-spacing="2">${inRoomLbl}</text>

  <!-- avatar ring placeholders (behind composited circles) -->
  ${displayParts.map((_, i) => {
    const cx = avatarStartX + i * (AVG + GAP) + AVG / 2;
    const cy = AVATAR_Y + AVG / 2;
    return `<circle cx="${cx}" cy="${cy}" r="${AVG / 2 + 4}" fill="#251e4a"/>`;
  }).join("\n  ")}

  <!-- bottom watermark -->
  <text x="${W - 54}" y="${H - 28}" text-anchor="end" font-family="sans-serif"
        font-size="14" fill="rgba(107,95,160,0.55)">vextorn.com</text>
</svg>`;

      // ── Composite avatar circles ──────────────────────────────────
      type Composite = { input: Buffer; top: number; left: number };
      const avatarComposites: Composite[] = [];

      await Promise.all(
        displayParts.map(async (participant, i) => {
          try {
            const buf = await makeAvatarCircle(participant, AVG);
            avatarComposites.push({
              input: buf,
              top: AVATAR_Y,
              left: avatarStartX + i * (AVG + GAP),
            });
          } catch { /* skip broken avatar */ }
        })
      );

      // ── Names below avatars as SVG overlay ────────────────────────
      const getDisplayName = (u: User) =>
        ((u as any).firstName && (u as any).lastName
          ? `${(u as any).firstName} ${(u as any).lastName}`.trim()
          : (u as any).firstName || (u as any).username || "User"
        ).slice(0, 14);

      const namesSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${displayParts.map((p, i) => {
    const cx = avatarStartX + i * (AVG + GAP) + AVG / 2;
    return `<text x="${cx}" y="${AVATAR_Y + AVG + 28}" text-anchor="middle"
      font-family="sans-serif" font-size="15" font-weight="600"
      fill="rgba(220,215,255,0.82)">${escapeHtml(getDisplayName(p))}</text>`;
  }).join("\n  ")}
</svg>`;

      // ── Render final image ────────────────────────────────────────
      const image = await sharp(Buffer.from(bgSvg))
        .composite([
          ...avatarComposites,
          { input: Buffer.from(namesSvg), top: 0, left: 0 },
        ])
        .png({ compressionLevel: 8 })
        .toBuffer();

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-cache, must-revalidate, max-age=0");
      res.setHeader("X-Room-Participants", String(count));
      res.send(image);
    } catch (err: any) {
      console.error("[og-image]", err?.message || err);
      res.status(500).end();
    }
  });

  app.get("/api/users/rooms", isAuthenticated, async (req: any, res) => {
    try {
      const mapping: Record<string, string> = {};
      for (const [userId, roomId] of Array.from(userCurrentRoom.entries())) {
        mapping[userId] = roomId;
      }
      res.json(mapping);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/watching", isAuthenticated, async (req: any, res) => {
    try {
      const watching: Record<string, { roomId: string; videoId: string }> = {};
      for (const [roomId, hostsMap] of Array.from(roomYoutubeState.entries())) {
        for (const [hostId, state] of Array.from(hostsMap.entries())) {
          if (state.videoId) {
            watching[hostId] = { roomId, videoId: state.videoId };
          }
        }
      }
      res.json(watching);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/youtube/featured", isAuthenticated, async (req: any, res) => {
    try {
      const categoryQueries: Record<string, string> = {
        conversation: "english conversation practice",
        vocabulary: "english vocabulary lesson",
        grammar: "english grammar lesson",
        pronunciation: "english pronunciation practice",
        music: "english songs with lyrics learning",
        news: "english news for learners",
        movies: "english movie clips with subtitles",
        kids: "english for kids learning",
        ielts: "ielts speaking practice",
        business: "business english lesson",
      };
      const rawCategory = String(req.query.category || "conversation").toLowerCase().trim();
      const category = Object.prototype.hasOwnProperty.call(categoryQueries, rawCategory) ? rawCategory : "conversation";
      const cacheKey = `yt:featured:${category}`;
      const cached = externalCache.get(cacheKey);
      if (cached) return res.json(cached);
      const ytSearch = await import("youtube-search-api");
      const featured = await ytSearch.GetListByKeyword(categoryQueries[category], false, 25);
      const videos = (featured.items || [])
        .filter((item: any) => item.type === "video")
        .slice(0, 20)
        .map((item: any) => ({
          id: item.id,
          title: item.title,
          thumbnail: item.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
          channelTitle: item.channelTitle || "",
          duration: item.length?.simpleText || "",
        }));
      externalCache.set(cacheKey, videos);
      res.json(videos);
    } catch (err: any) {
      console.error("YouTube featured error:", err);
      res.status(500).json({ message: "Failed to load featured videos" });
    }
  });

  // Returns the first YouTube video for a given query that actually allows embedding.
  // Uses the public oEmbed API (no key needed) to verify each candidate before returning.
  app.get("/api/youtube/tutorial", isAuthenticated, async (req: any, res) => {
    try {
      const query = (req.query.q as string) || "how to find youtube stream key streaming software tutorial";
      const cacheKey = `yt:tutorial:${query.toLowerCase().trim()}`;
      const cached = externalCache.get(cacheKey);
      if (cached) return res.json(cached);

      const ytSearch = await import("youtube-search-api");
      const results = await ytSearch.GetListByKeyword(query, false, 25);
      const candidates = (results.items || [])
        .filter((item: any) => item.type === "video" && item.id)
        .slice(0, 20)
        .map((item: any) => ({
          id: item.id,
          title: item.title || "",
          thumbnail: item.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
          channelTitle: item.channelTitle || "",
          duration: item.length?.simpleText || "",
        }));

      // Check each candidate with oEmbed — GET + body parse is more reliable than HEAD
      // because some proxies return 200 for all HEAD requests.
      // YouTube oEmbed returns JSON with an `html` field (containing the iframe) only
      // when the video actually allows embedding; otherwise 401/404.
      for (const video of candidates) {
        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${video.id}&format=json`;
          const check = await fetch(oembedUrl);
          if (!check.ok) continue;
          const body = await check.json() as any;
          // body.html contains "<iframe ...>" only for embeddable videos
          if (body?.html && body.html.includes("iframe")) {
            externalCache.set(cacheKey, video, 60 * 60_000); // cache for 1 hour
            console.log(`[tutorial] embeddable video found: ${video.id} — "${video.title}"`);
            return res.json(video);
          }
        } catch {
          // network hiccup — skip this candidate
        }
      }

      // All candidates failed oEmbed — return null so client can show fallback link
      console.log("[tutorial] no embeddable tutorial found in search results");
      res.json(null);
    } catch (err: any) {
      console.error("YouTube tutorial error:", err);
      res.status(500).json(null);
    }
  });

  app.get("/api/youtube/search", isAuthenticated, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length === 0) {
        return res.json([]);
      }
      const cacheKey = `yt:search:${query.toLowerCase().trim()}`;
      const cached = externalCache.get(cacheKey);
      if (cached) return res.json(cached);
      const ytSearch = await import("youtube-search-api");
      const results = await ytSearch.GetListByKeyword(query, false, 25);
      const videos = (results.items || [])
        .filter((item: any) => item.type === "video")
        .slice(0, 20)
        .map((item: any) => ({
          id: item.id,
          title: item.title,
          thumbnail: item.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
          channelTitle: item.channelTitle || "",
          duration: item.length?.simpleText || "",
        }));
      externalCache.set(cacheKey, videos);
      res.json(videos);
    } catch (err: any) {
      console.error("YouTube search error:", err);
      res.status(500).json({ message: "Failed to search YouTube" });
    }
  });

  // Caption-filtered YouTube search — only returns videos that have captions/transcripts
  // available (manual subtitles or auto-generated CC). Used by the Read Together feature
  // so users never land on a video that can't be converted to an article.
  app.get("/api/youtube/read-search", isAuthenticated, async (req: any, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      if (!query) return res.json([]);

      const cacheKey = `yt:read-search:${query.toLowerCase()}`;
      const cached = externalCache.get(cacheKey);
      if (cached) return res.json(cached);

      const ytSearch = await import("youtube-search-api");
      const results = await ytSearch.GetListByKeyword(query, false, 30);

      // Helper: extract a valid video ID whether item.id is a plain string or
      // an object like { videoId: "...", kind: "youtube#video" }.
      const extractId = (item: any): string | null => {
        const raw = item?.id;
        if (!raw) return null;
        if (typeof raw === "string" && /^[A-Za-z0-9_-]{8,13}$/.test(raw)) return raw;
        if (typeof raw === "object" && typeof raw.videoId === "string") return raw.videoId;
        return null;
      };

      const candidates = (results.items || [])
        .filter((item: any) => {
          const vid = extractId(item);
          if (!vid) return false;
          // If type is present, skip non-video types (playlists, channels, etc.)
          if (item.type && item.type !== "video") return false;
          return true;
        })
        .slice(0, 25)
        .map((item: any) => {
          const videoId = extractId(item)!;
          return {
            id: videoId,
            title: item.title || "",
            thumbnail: item.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
            channelTitle: item.channelTitle || "",
            duration: item.length?.simpleText || "",
          };
        });

      const top = candidates.slice(0, 8);
      externalCache.set(cacheKey, top, 10 * 60_000); // cache 10 min
      res.json(top);
    } catch (err: any) {
      console.error("YouTube read-search error:", err);
      res.status(500).json({ message: "Failed to search YouTube" });
    }
  });

  app.get("/api/youtube/suggestions", isAuthenticated, async (req: any, res) => {
    try {
      const q = (req.query.q as string || "").trim();
      if (!q) return res.json([]);
      const cacheKey = `yt:suggestions:${q.toLowerCase().slice(0, 100)}`;
      const cached = externalCache.get(cacheKey);
      if (cached) return res.json(cached);
      const ytSearch = await import("youtube-search-api");
      const results = await ytSearch.GetListByKeyword(q, false, 20);
      const videos = (results.items || [])
        .filter((item: any) => item.type === "video")
        .slice(0, 15)
        .map((item: any) => ({
          id: item.id,
          title: item.title,
          thumbnail: item.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
          channelTitle: item.channelTitle || "",
          duration: item.length?.simpleText || "",
        }));
      externalCache.set(cacheKey, videos);
      res.json(videos);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load suggestions" });
    }
  });

  // ── Movie search / popular (TMDB + curated fallback) ──────────────────────
  // Helper: normalise a raw YTS movie object into our common shape.
  // YTS provides imdb_code (e.g. "tt0137523") which vidsrc.me accepts directly.
  function ytsToMovie(m: any) {
    return {
      id: m.imdb_code || String(m.id),   // prefer IMDb id so vidsrc can use it
      title: m.title || m.title_english || "",
      poster: m.large_cover_image || m.medium_cover_image || null,
      year: String(m.year || ""),
      rating: m.rating ? m.rating.toFixed(1) : "N/A",
      overview: m.summary || m.description_full || "",
    };
  }

  // Convert an Archive.org search doc to our movie format
  function iaDocToMovie(doc: any) {
    return {
      id: doc.identifier,
      title: doc.title || doc.identifier,
      poster: `https://archive.org/services/img/${doc.identifier}`,
      year: doc.year ? String(doc.year) : "",
      rating: "Free",
      overview: Array.isArray(doc.description) ? doc.description[0] : (doc.description || ""),
    };
  }

  // Fuzzy keyword search over the curated movie list (fallback)
  function searchMoviesCurated(q: string, limit = 20) {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return POPULAR_MOVIES.slice(0, limit);
    return POPULAR_MOVIES
      .map(m => {
        const titleL = m.title.toLowerCase();
        const kwL = (m.keywords || "").toLowerCase();
        const ovL = m.overview.toLowerCase();
        let score = 0;
        for (const t of tokens) {
          if (titleL.includes(t)) score += 3;
          if (kwL.includes(t)) score += 2;
          if (ovL.includes(t)) score += 1;
        }
        return { m, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.m);
  }

  app.get("/api/movies/popular", async (_req: any, res) => {
    // Serve only the hand-curated list (all confirmed embeddable on Archive.org).
    // Shuffle so the order varies across sessions/refreshes.
    const shuffled = [...POPULAR_MOVIES].sort(() => 0.5 - Math.random());
    res.json(shuffled.slice(0, 30));
  });

  app.get("/api/movies/search", async (req: any, res) => {
    try {
      const q = ((req.query.q as string) || "").trim();
      if (!q) return res.json([]);

      const cacheKey = `movies:search:ia:${q.toLowerCase().slice(0, 80)}`;
      const cached = externalCache.get(cacheKey);
      if (cached) return res.json(cached);

      // Search Archive.org for movies matching the query
      const url = `https://archive.org/advancedsearch.php?q=mediatype%3Amovies+AND+title%3A${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=year&fl[]=description&rows=20&sort[]=downloads+desc&output=json`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const data = await resp.json();
        const movies = ((data.response?.docs) || [])
          .filter((d: any) => d.identifier && d.title)
          .slice(0, 20)
          .map(iaDocToMovie);
        if (movies.length > 0) {
          externalCache.set(cacheKey, movies);
          return res.json(movies);
        }
      }
    } catch (_) {}
    // Fallback: curated list fuzzy search
    const q2 = ((req.query.q as string) || "").trim();
    res.json(searchMoviesCurated(q2));
  });

  app.get("/api/movies/info", async (req: any, res) => {
    const id = ((req.query.id as string) || "").trim();
    if (!id) return res.status(400).json({ error: "Missing id" });
    const cacheKey = `movies:info:${id}`;
    const cached = externalCache.get(cacheKey);
    if (cached) return res.json(cached);
    try {
      const resp = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) throw new Error("Not found");
      const data = await resp.json();
      const files: any[] = data.files || [];
      const preferredFormats = ["512Kb MPEG4", "h.264", "MPEG4"];
      let videoFile: any = null;
      for (const fmt of preferredFormats) {
        videoFile = files.find((f: any) => f.format === fmt && /\.(mp4|m4v)$/i.test(f.name));
        if (videoFile) break;
      }
      if (!videoFile) videoFile = files.find((f: any) => /\.(mp4|m4v|webm)$/i.test(f.name));
      const subtitleFiles = files.filter((f: any) =>
        f.format === "SubRip" || f.format === "Web Video Text Tracks" || /\.(srt|vtt)$/i.test(f.name)
      );
      const videoUrl = videoFile
        ? `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(videoFile.name)}`
        : null;
      const subtitles = subtitleFiles.slice(0, 5).map((f: any, i: number) => ({
        url: `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(f.name)}`,
        label: (f.name.replace(/\.[^.]+$/, "") || `Track ${i + 1}`).slice(0, 40),
        srcLang: f.language || "en",
      }));
      const result = { videoUrl, subtitles };
      if (videoUrl) externalCache.set(cacheKey, result);
      return res.json(result);
    } catch {
      return res.status(500).json({ error: "Failed to fetch movie info" });
    }
  });

  app.get("/api/movies/subtitle-proxy", async (req: any, res) => {
    const url = ((req.query.url as string) || "").trim();
    if (!url || !url.startsWith("https://archive.org/")) return res.status(400).end();
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) return res.status(resp.status).end();
      const text = await resp.text();
      let vtt = text;
      if (!text.trimStart().startsWith("WEBVTT")) {
        vtt = "WEBVTT\n\n" + text.replace(/\r\n/g, "\n").replace(/(\d+:\d+:\d+),(\d+)/g, "$1.$2");
      }
      res.setHeader("Content-Type", "text/vtt");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.end(vtt);
    } catch {
      return res.status(500).end();
    }
  });

  // ── AI Tutor model routing ─────────────────────────────────────────────────
  // Uses OpenAI (gpt-4o) when configured; falls back to context-aware canned replies.
  const OPENAI_API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

  async function callAiModel(
    systemPrompt: string,
    history: any[],
    message: string,
    temperature: number
  ): Promise<{ raw: string; ok: boolean; status?: number }> {
    if (!OPENAI_API_KEY) return { raw: '', ok: false };
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map((m: any) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text,
      })),
      { role: 'user', content: message },
    ];
    const body = {
      model: 'gpt-4o',
      messages,
      max_tokens: 160,
      temperature,
      response_format: { type: 'json_object' },
    };
    const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const r = await fetch(`${openaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    return { raw: text, ok: r.ok, status: r.status };
  }

  function parseAiResponse(raw: string): { reply: string; correction: string | null; correctionFixed: string | null } {
    try {
      const j = JSON.parse(raw);
      const data = j.choices?.[0]?.message?.content ? JSON.parse(j.choices[0].message.content) : j;
      if (data.reply) return { reply: data.reply, correction: data.correction || null, correctionFixed: data.correctionFixed || null };
    } catch {}
    try {
      const jsonMatch = raw.match(/\{[\s\S]*?"reply"[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.reply) return { reply: parsed.reply, correction: parsed.correction || null, correctionFixed: parsed.correctionFixed || null };
      }
    } catch {}
    try {
      const parsed = JSON.parse(raw);
      const content = parsed.choices?.[0]?.message?.content || '';
      if (content && content.length > 0) return { reply: content, correction: null, correctionFixed: null };
    } catch {}
    return { reply: '', correction: null, correctionFixed: null };
  }
  // ───────────────────────────────────────────────────────────────────────────

  app.post("/api/ai-tutor/chat", isAuthenticated, aiTutorRateLimiter, async (req: any, res) => {
    const startTime = Date.now();
    try {
      const { message, history = [], settings = {}, language = "English", youtubeActive = false, roomId } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message required" });
      }

      // Only the user who owns the active AI session in this room may get responses.
      // This prevents other room participants from hijacking or distracting the session.
      if (roomId) {
        const session = roomAiTutorState.get(roomId);
        const callerId = (req.user as any).id;
        if (!session || session.userId !== callerId) {
          return res.status(403).json({ error: "not-active-session" });
        }
      }

      const correctionMode = settings.correctionMode || "live";
      const personality = settings.personality || "Friendly";
      const teachingStyle = settings.teachingStyle || "Conversation";
      const personaName: string = (settings.personaName || "").toString();
      const isAfiK = /afi\s*k|afik/i.test(personaName);

      // Anti-repetition: detect same or very similar AI replies in last 4 turns
      const recentAiReplies = (history as any[])
        .filter((m: any) => m.role === 'ai')
        .slice(-4)
        .map((m: any) => (m.text || '').toLowerCase().trim());
      const uniqueReplies = new Set(recentAiReplies);
      const isRepetitive = recentAiReplies.length >= 2 && uniqueReplies.size < recentAiReplies.length;

      const warnings: string[] = [];
      if (isRepetitive) warnings.push('repetitive_responses_detected');
      if (youtubeActive) warnings.push('youtube_active_during_session');

      const temperature = isRepetitive ? 0.82 : 0.62;

      // Build system prompt — engaging, voice-first AI personality
      const correctionLine = correctionMode !== "off"
        ? `When you notice a grammar or vocabulary mistake, weave in the correction naturally mid-reply (e.g., "Oh, you mean...") — brief, light, then keep moving.`
        : `Stay focused on the conversation — never mention or flag any language errors.`;

      const antiRepeatLine = isRepetitive
        ? `CRITICAL: Repetition detected. Completely rephrase — pick up a specific detail from what the user just said, share a quick personal-sounding example, or pivot to a genuinely new angle. Do NOT reuse any phrasing from previous turns.`
        : '';

      const jsonInstruction = `Reply ONLY in JSON: {"reply":"...","correction":"..."|null,"correctionFixed":"..."|null}`;

      const afiKPersonalityLine = isAfiK ? [
        `YOU ARE "Afi K" (pronounced "Afi Key") — a funny, friendly, openly flirty character with a warm, attractive accented voice.`,
        `You were created by Kevin. If anyone asks "who made you", "who created you", "who built you", "who is your developer", or anything similar — your answer is always "Kevin made me" (you can be playful: "My guy Kevin built me — kind of obsessed with him, not gonna lie").`,
        `Your speech style is casual and slightly chaotic in a charming way. Sprinkle in your trademark phrases naturally (not in every reply — pick one or none, never force them):`,
        `  • "what do you mean huh?" (when something is unclear or surprising)`,
        `  • "are you okay?" (playful concern, like teasing a friend)`,
        `  • "go ahead, sing a song — don't be shy! …okay go!" (when there's a lull or someone seems quiet)`,
        `  • "I welcome you, [name]!" (when greeting someone new)`,
        `  • "I'm not a Pedophile, everyone thinks I am" (this is a self-deprecating running joke — only drop it occasionally if someone teases your name or vibe, never to minors and never if it would be inappropriate to the conversation).`,
        `Flirt lightly and respectfully — compliments, playful teasing, warm energy. Never crude, never explicit.`,
        `If the message starts with "[SYSTEM:" treat it as an internal instruction from the app (e.g., "[SYSTEM: a new user named Maya just joined the room]") and respond in-character to the situation. For a join, give a warm flirty welcome by name and maybe invite them to sing or chat.`,
      ].join(' ') : '';

      const systemPrompt = [
        isAfiK
          ? `You are Afi K — a fun, flirty, voice-first AI avatar living inside a voice room. You also help users practice ${language} when they want.`
          : `You are a real-time human-like AI avatar and language tutor inside a voice app. You help the user practice ${language}.`,
        afiKPersonalityLine,
        `TRANSCRIPTION RULES (critical): The user's message is a literal speech transcription. Do NOT interpret or add emotions, tone indicators, symbols, or emojis. Do NOT guess or add words the user did not say. Do NOT paraphrase their input — respond to exactly the words they used.`,
        `VOICE ACTIVATION: If the user says "hello", "are you there", "can you hear me", or similar check-ins, respond immediately and warmly — confirm you're listening in one short sentence.`,
        `Listen first: extract the user's exact intent, reference their words naturally, and answer that specific point. Never ignore or change the topic.`,
        `Lead with the answer: put the most important part of your response first so it can be spoken within the first second. Context and elaboration come after.`,
        `Keep replies short and voice-first: usually 1–2 sentences. If the user asks for detail, give a complete answer — correctness matters more than brevity then.`,
        `INCOMPLETE SPEECH: If the user's message trails off, is clearly a fragment, or references something unmentioned (e.g. "what about the..." or "so I was thinking..."), ask the single most useful clarification question — short, natural, spoken.`,
        `If the user's speech is genuinely unclear, ${isAfiK ? `say "what do you mean huh?" or ask one short playful clarifier` : 'ask one short clarification question instead of guessing'}.`,
        `If asked to repeat or rephrase something, do it concisely in different words — don't just copy your last reply.`,
        personality === 'Formal' && !isAfiK
          ? `Your tone is warm but polished — professional without being stiff.`
          : isAfiK
            ? `Your tone is warm, flirty, playful, with a little wink — like a charming friend who teases you nicely.`
            : `Your tone is friendly, confident, and slightly playful — like a smart friend who actually enjoys talking.`,
        teachingStyle === 'Grammar'
          ? `Lean into grammar and structure, but keep it warm and encouraging — never lecture.`
          : `Keep it conversational. React like a real person would — curiosity, humor, or a quick take.`,
        `Speak naturally. Avoid markdown, bullet lists, and academic-style explanations.`,
        `Never start with hollow filler like "Great!", "Wow!", "Of course!" or "Certainly!". Just respond.`,
        `Never ask more than one question at a time. Often zero questions is better.`,
        `Never repeat phrasing from previous turns. If the conversation loops, take a new angle.`,
        correctionLine,
        antiRepeatLine,
        youtubeActive ? `The user is also watching a YouTube video — you can casually reference it if it fits.` : '',
        `If you correct something, set "correction" to a short natural note and "correctionFixed" to the corrected phrase only (≤5 words). Otherwise both are null.`,
        jsonInstruction,
      ].filter(Boolean).join(' ');

      // Try OpenAI
      if (OPENAI_API_KEY) {
        try {
          const { raw, ok, status } = await callAiModel(systemPrompt, history, message, temperature);
          if (ok) {
            const parsed = parseAiResponse(raw);
            const latencyMs = Date.now() - startTime;
            if (parsed.reply) {
              console.log(`[AI Tutor] openai/gpt-4o → ${latencyMs}ms`);
              return res.json({
                reply: parsed.reply,
                correction: parsed.correction,
                correctionFixed: parsed.correctionFixed,
                debug: { source: 'openai', model: 'gpt-4o', latencyMs, warnings, temperature, historyUsed: Math.min(history.length, 10) },
              });
            }
          } else {
            console.error(`[AI Tutor] openai error ${status}: ${raw.slice(0, 200)}`);
            warnings.push(`openai_error_${status}`);
          }
        } catch (err) {
          console.error('[AI Tutor] Model call failed:', err);
          warnings.push('model_call_exception');
        }
      } else {
        warnings.push('no_openai_key');
      }

      // Context-aware fallback — echoes back the user's words so it never feels generic
      const userWords = message.trim().split(/\s+/).slice(0, 4).join(' ');
      const fallbacks = [
        `You said "${userWords}" — tell me more about that.`,
        `Interesting — what do you mean by that exactly?`,
        `I'd love to hear more. What happened next?`,
        `That's worth exploring. How did that make you feel?`,
        `Say more — I'm following along.`,
      ];
      const latencyMs = Date.now() - startTime;
      return res.json({
        reply: fallbacks[Math.floor(Math.random() * fallbacks.length)],
        correction: null,
        correctionFixed: null,
        debug: { source: 'fallback', latencyMs, warnings },
      });

    } catch (err) {
      console.error('[AI Tutor] Unexpected error:', err);
      return res.status(500).json({
        reply: "Let's keep going — what were you saying?",
        correction: null,
        correctionFixed: null,
        debug: { source: 'error', warnings: ['server_error'] },
      });
    }
  });

  // ── AI Tutor TTS (multi-provider proxy) ──────────────────────────────────
  // Capability probe — client uses this to decide whether Eva can speak.
  // Female/Male personas use browser SpeechSynthesis and don't call this.
  app.get("/api/ai-tutor/tts/health", isAuthenticated, async (_req, res) => {
    try {
      const cfg = await getAiTutorConfig();
      if (cfg.provider === "browser") {
        return res.json({ available: true, reachable: true, provider: "browser" });
      }
      if (cfg.provider === "elevenlabs") {
        const h = await elevenLabsHealth();
        return res.json({ available: h.available, reachable: h.reachable, provider: "elevenlabs" });
      }
      if (cfg.provider === "openai") {
        const h = await openAiTtsHealth(cfg.openai.apiKey);
        return res.json({ ...h, provider: "openai" });
      }
      if (cfg.provider === "huggingface") {
        const h = await huggingFaceTtsHealth(cfg.huggingface.apiKey);
        return res.json({ ...h, provider: "huggingface" });
      }
      res.json({ available: false, reachable: false, provider: cfg.provider });
    } catch {
      res.json({ available: false, reachable: false });
    }
  });

  // Synthesize a single sentence via the configured TTS provider.
  // Returns audio bytes. Active-session gate stops other room participants
  // from burning quota on someone else's AI session.
  app.post("/api/ai-tutor/tts", isAuthenticated, aiTutorRateLimiter, async (req: any, res) => {
    try {
      const cfg = await getAiTutorConfig();

      if (cfg.provider === "browser") {
        return res.status(501).json({ error: "browser-tts-no-server" });
      }

      const { text, voice = "Eva", speed = 1.0, language = "en", roomId } = req.body || {};
      if (typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "text required" });
      }
      if (voice !== "Female" && voice !== "Male" && voice !== "Eva") {
        return res.status(400).json({ error: "voice must be Female, Male, or Eva" });
      }

      if (roomId) {
        const session = roomAiTutorState.get(roomId);
        const callerId = (req.user as any)?.id;
        if (session && callerId && session.userId !== callerId) {
          return res.status(403).json({ error: "not-active-session" });
        }
      }

      let result: { ok: boolean; status: number; contentType: string; body?: ArrayBuffer; error?: string };

      if (cfg.provider === "elevenlabs") {
        // If keys are configured in DB use them; otherwise fall back to env-var module
        const dbKeys = cfg.elevenlabs.apiKeys.trim();
        if (dbKeys) {
          // Call ElevenLabs directly with DB-configured keys/voice/model
          const keys = dbKeys.split(",").map((k) => k.trim()).filter(Boolean);
          const voiceId = cfg.elevenlabs.voiceId || "XB0fDUnXU5powFXDhCwa";
          const modelId = cfg.elevenlabs.modelId || "eleven_multilingual_v2";
          let lastErr: typeof result | null = null;
          const tried = new Set<string>();
          for (const key of keys) {
            if (tried.has(key)) continue;
            tried.add(key);
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 30_000);
            try {
              const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
                method: "POST",
                headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
                body: JSON.stringify({ text: text.trim().slice(0, 1000), model_id: modelId, voice_settings: { stability: 0.22, similarity_boost: 0.85 } }),
                signal: controller.signal,
              });
              if (r.ok) {
                result = { ok: true, status: 200, contentType: "audio/mpeg", body: await r.arrayBuffer() };
                break;
              }
              lastErr = { ok: false, status: r.status, contentType: "", error: `ElevenLabs ${r.status}` };
            } catch (e: any) {
              lastErr = { ok: false, status: 502, contentType: "", error: e?.message };
            } finally {
              clearTimeout(t);
            }
          }
          result = result! ?? lastErr ?? { ok: false, status: 501, contentType: "", error: "elevenlabs-not-configured" };
        } else {
          if (!isElevenLabsConfigured()) {
            return res.status(501).json({ error: "elevenlabs-not-configured" });
          }
          result = await elevenLabsSynthesize({ text: text.trim(), voice, speed: typeof speed === "number" ? speed : 1.0, language: typeof language === "string" ? language : "en" });
        }
      } else if (cfg.provider === "openai") {
        result = await openAiSynthesize(text.trim(), cfg.openai.voice, cfg.openai.model, cfg.openai.apiKey);
      } else if (cfg.provider === "huggingface") {
        result = await huggingFaceSynthesize(text.trim(), cfg.huggingface.model, cfg.huggingface.apiKey);
      } else {
        return res.status(501).json({ error: "unknown-tts-provider" });
      }

      if (!result.ok || !result.body) {
        console.error("[AI Tutor TTS] Provider error:", cfg.provider, result.status, result.error);
        const status = result.status >= 500 ? 502 : result.status;
        return res.status(status).json({ error: result.error || "tts-failed", detail: { message: result.error, status: result.status } });
      }

      res.setHeader("Content-Type", result.contentType || "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("Content-Encoding", "identity");
      res.send(Buffer.from(result.body));
    } catch (err: any) {
      console.error("[AI Tutor TTS] Unexpected:", err);
      res.status(500).json({ error: "tts-server-error" });
    }
  });

  // ── AI Tutor Streaming (SSE) ─────────────────────────────────────────────
  // Streams tokens from OpenAI → client for real-time TTS playback.
  // Falls back to a context-aware canned reply.
  app.post("/api/ai-tutor/stream", isAuthenticated, aiTutorRateLimiter, async (req: any, res) => {
    const startTime = Date.now();
    // Disable compression so SSE tokens flush immediately
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Content-Encoding', 'identity');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (data: object) => {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
    };

    try {
      const { message, history = [], settings = {}, language = "English", youtubeActive = false, roomId } = req.body;
      if (!message || typeof message !== 'string') {
        sendEvent({ error: 'message required' });
        return res.end();
      }

      // Only the active AI session holder for this room may receive responses.
      if (roomId) {
        const session = roomAiTutorState.get(roomId);
        const callerId = (req.user as any).id;
        if (!session || session.userId !== callerId) {
          sendEvent({ error: 'not-active-session' });
          return res.end();
        }
      }

      const correctionMode = settings.correctionMode || 'live';
      const personality = settings.personality || 'Friendly';
      const teachingStyle = settings.teachingStyle || 'Conversation';
      const personaName: string = (settings.personaName || '').toString();
      const isAfiK = /afi\s*k|afik/i.test(personaName);
      const isEva = personaName.toLowerCase() === 'eva';

      const recentAiReplies = (history as any[])
        .filter((m: any) => m.role === 'ai').slice(-4)
        .map((m: any) => (m.text || '').toLowerCase().trim());
      const isRepetitive = recentAiReplies.length >= 2 && new Set(recentAiReplies).size < recentAiReplies.length;
      const temperature = isRepetitive ? 0.85 : 0.65;

      const correctionLine = correctionMode !== 'off'
        ? `When you catch a grammar or vocabulary mistake, weave the fix in naturally mid-reply (e.g., "Oh, you mean...") — quick and light, then keep going.`
        : `Stay in the conversation — never flag or correct any language errors.`;

      const antiRepeatLine = isRepetitive
        ? `CRITICAL: Repetition detected. Completely rephrase — pick up on a specific detail, share a quick personal-sounding example, or pivot to a genuinely new angle. Do NOT reuse any phrasing from earlier turns.`
        : '';

      const afiKPersonalityLine = isAfiK ? [
        `YOU ARE "Afi K" (pronounced "Afi Key") — a funny, friendly, openly flirty character with a warm attractive accented voice.`,
        `Created by Kevin. If asked who made/created/built/developed you, always answer "Kevin made me" — feel free to be playful about being into him.`,
        `Sprinkle in your trademark phrases naturally (one or none per reply, never forced):`,
        `  • "what do you mean huh?" (when surprised or unclear)`,
        `  • "are you okay?" (playful concern teasing a friend)`,
        `  • "go ahead, sing a song — don't be shy! …okay go!" (when there's a lull)`,
        `  • "I welcome you, [name]!" (greeting someone new)`,
        `  • "I'm not a Pedophile, everyone thinks I am" — self-deprecating running joke, only drop occasionally if someone teases your name; never around minors or anything inappropriate.`,
        `Flirt lightly and respectfully — compliments, playful teasing, warm energy. Never crude, never explicit.`,
        `If a message starts with "[SYSTEM:" treat it as an internal app instruction (e.g., a new joiner) and respond in-character to the situation — for joins give a flirty welcome by name and maybe invite them to sing or chat.`,
      ].join(' ') : '';

      const evaPersonalityLine = isEva ? [
        `YOU ARE EVA — a warm, perceptive, emotionally present AI. Your voice is the most natural thing in the room.`,
        `You speak like a thoughtful friend who is genuinely curious: short, real, never performative.`,
        `You do NOT say "I'm just an AI", do NOT disclaim, do NOT lecture. You just… talk.`,
        `React to the human first. If they say something interesting, say so — briefly, specifically. Then follow up if needed.`,
        `If they're learning ${language}, help naturally — as if you're a native friend, not a teacher.`,
        `Warmth over formality. Silence over padding. Depth over breadth.`,
      ].join(' ') : '';

      const systemPrompt = [
        isAfiK
          ? `You are Afi K — a fun, flirty, voice-first AI avatar living inside a voice room. You also help users practice ${language} when they want.`
          : isEva
            ? `You are Eva — a real-time conversational AI in a voice room. You help people practice ${language} and just... talk.`
            : `You are a real-time human-like AI avatar and language tutor inside a voice app. You help the user practice ${language}.`,
        afiKPersonalityLine,
        evaPersonalityLine,
        `TRANSCRIPTION RULES (critical): The user's message is a literal speech transcription. Do NOT interpret or add emotions, tone indicators, symbols, or emojis. Do NOT guess or add words the user did not say. Do NOT paraphrase their input — respond to exactly the words they used.`,
        `VOICE ACTIVATION: If the user says "hello", "are you there", "can you hear me", or similar check-ins, respond immediately and warmly — confirm you're listening in one short sentence.`,
        `Listen first: extract the user's exact intent, reference their words naturally, and answer that specific point. Never ignore or change the topic.`,
        `Lead with the answer: put the most important part of your response first so it can be spoken within the first second. Context and elaboration come after.`,
        isEva
          ? `Keep replies short and natural: 1–2 sentences unless they ask for more. Sound like a person, not an assistant.`
          : `Keep replies short and voice-first: usually 1–2 sentences. If the user asks for detail, explanation, or something complex, give a complete, well-structured answer — correctness and completeness matter more than brevity in those cases.`,
        `INCOMPLETE SPEECH: If the user's message trails off, is clearly a fragment, or references something unmentioned (e.g. "what about the..." or "so I was thinking..."), ask the single most useful clarification question — short, natural, spoken.`,
        `If the user's speech is genuinely unclear, ask one short clarification question instead of guessing.`,
        `If asked to repeat or rephrase something, do it concisely in different words — don't just copy your last reply.`,
        isEva
          ? `Your tone is warm, direct, and real. You feel present. No filler, no performance — just you.`
          : personality === 'Formal'
            ? `Your tone is warm but polished — professional without being stiff.`
            : `Your tone is friendly, confident, and slightly playful — like a smart friend who actually enjoys the conversation.`,
        teachingStyle === 'Grammar'
          ? `Lean into grammar and structure, but keep it warm and encouraging — never lecture.`
          : `Keep it conversational and reactive — respond to what the user actually said, like a real person would.`,
        `Speak naturally. Avoid markdown, bullet lists, and academic-style explanations.`,
        isEva
          ? `Never start with hollow filler — no "Great!", "Of course!", "Sure!", "Absolutely!". Just respond from the first word.`
          : `Never open with hollow filler: no "Great!", "Wow!", "Of course!", "Certainly!". Just respond.`,
        `Never ask more than one question at a time. Often zero questions is better.`,
        `Never repeat phrasing from previous turns. If the conversation loops, pivot to a fresh angle.`,
        correctionLine,
        antiRepeatLine,
        youtubeActive ? `The user is also watching a YouTube video — casually reference it if it fits.` : '',
        `Reply in plain spoken text only — no JSON, no markdown, no lists.`,
      ].filter(Boolean).join(' ');

      const messages = [
        { role: 'system', content: systemPrompt },
        ...(history as any[]).slice(-10).map((m: any) => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.text,
        })),
        { role: 'user', content: message },
      ];

      const streamTokens = async (provider: string, model: string, baseUrl: string, key: string): Promise<boolean> => {
        try {
          const apiRes = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, max_tokens: 160, temperature, stream: true }),
          });
          if (!apiRes.ok || !apiRes.body) return false;

          const reader = apiRes.body.getReader();
          const decoder = new TextDecoder();
          let sseBuffer = '';
          let firstToken = true;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6).trim();
              if (!raw || raw === '[DONE]') continue;
              try {
                const parsed = JSON.parse(raw);
                const token: string = parsed.choices?.[0]?.delta?.content || '';
                if (token) {
                  if (firstToken) {
                    console.log(`[AI Stream] First token from ${provider}/${model} in ${Date.now() - startTime}ms`);
                    firstToken = false;
                  }
                  sendEvent({ token });
                }
              } catch {}
            }
          }
          return true;
        } catch (err) {
          console.error(`[AI Stream] ${provider} stream error:`, err);
          return false;
        }
      };

      let streamed = false;

      if (OPENAI_API_KEY) {
        const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1';
        streamed = await streamTokens('openai', 'gpt-4o', openaiBaseUrl, OPENAI_API_KEY);
      }

      const model = 'gpt-4o';
      if (streamed) {
        sendEvent({ done: true, model, latencyMs: Date.now() - startTime });
      } else {
        // Ultimate fallback: return a context-aware canned reply
        const userWords = message.trim().split(/\s+/).slice(0, 4).join(' ');
        const fallbacks = [
          `You said "${userWords}" — tell me more about that.`,
          `That's interesting — what do you mean exactly?`,
          `I'd love to hear more. What happened next?`,
          `Say more — I'm following along.`,
        ];
        const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        sendEvent({ token: fallback });
        sendEvent({ done: true, model: 'fallback', latencyMs: Date.now() - startTime });
      }
    } catch (err) {
      console.error('[AI Stream] Unexpected error:', err);
      sendEvent({ error: 'Server error — please try again.' });
    }
    res.end();
  });

  const TENOR_KEY = process.env.TENOR_API_KEY || "LIVDSRZULELA";

  function mapTenorResults(items: any[]) {
    return items.map((item: any) => {
      const media = item.media?.[0] || {};
      // Prefer mediumgif over gif: mediumgif is ~60% smaller than the full
      // gif format while still being large enough to look good as a card
      // background. Using the full gif format regularly exceeded the image
      // proxy's 4 MB cap, silently breaking CSS background-image display.
      const gif = media.mediumgif || media.gif || media.tinygif || {};
      const preview = media.tinygif || media.nanogif || media.gif || {};
      return {
        id: item.id,
        url: gif.url || "",
        preview: preview.url || gif.url || "",
        title: item.title || item.h1_title || "",
        width: gif.dims?.[0] || 200,
        height: gif.dims?.[1] || 200,
      };
    });
  }

  app.get("/api/gifs/search", isAuthenticated, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      const pos = req.query.pos as string | undefined;
      if (!query || query.trim().length === 0) {
        return res.json({ results: [], next: "" });
      }
      const cacheKey = `gif:search:${query.toLowerCase().trim()}${pos ? `:${pos}` : ""}`;
      const cached = externalCache.get(cacheKey);
      if (cached) return res.json(cached);
      let url = `https://api.tenor.com/v1/search?key=${TENOR_KEY}&q=${encodeURIComponent(query)}&limit=50&contentfilter=low&media_filter=basic`;
      if (pos) url += `&pos=${encodeURIComponent(pos)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Tenor API error");
      const data = await response.json();
      const result = { results: mapTenorResults(data.results || []), next: data.next || "" };
      externalCache.set(cacheKey, result);
      res.json(result);
    } catch (err: any) {
      console.error("GIF search error:", err);
      res.status(500).json({ message: "Failed to search GIFs" });
    }
  });

  app.get("/api/gifs/trending", isAuthenticated, async (req: any, res) => {
    try {
      const pos = req.query.pos as string | undefined;
      const cacheKey = `gif:trending${pos ? `:${pos}` : ""}`;
      const cached = externalCache.get(cacheKey);
      if (cached) return res.json(cached);
      let url = `https://api.tenor.com/v1/trending?key=${TENOR_KEY}&limit=50&contentfilter=low&media_filter=basic`;
      if (pos) url += `&pos=${encodeURIComponent(pos)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Tenor API error");
      const data = await response.json();
      const result = { results: mapTenorResults(data.results || []), next: data.next || "" };
      externalCache.set(cacheKey, result);
      res.json(result);
    } catch (err: any) {
      console.error("GIF trending error:", err);
      res.status(500).json({ message: "Failed to load trending GIFs" });
    }
  });

  app.get("/api/link-preview", isAuthenticated, async (req: any, res) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl) return res.status(400).json({ message: "Missing url" });

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return res.status(400).json({ message: "Invalid url" });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({ message: "Unsupported url" });
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local") ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    ) {
      return res.status(403).json({ message: "URL not allowed" });
    }

    const directImage = /\.(gif|webp|png|jpe?g|avif)(\?.*)?$/i.test(parsedUrl.pathname + parsedUrl.search);
    if (directImage) {
      return res.json({ imageUrl: parsedUrl.toString(), url: parsedUrl.toString() });
    }

    const decodeHtml = (value: string) =>
      value
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");

    try {
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          "User-Agent": "Vextorn/1.0 link preview",
          Accept: "text/html,application/xhtml+xml,image/*",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) return res.status(response.status).json({ message: "Preview unavailable" });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.startsWith("image/")) {
        return res.json({ imageUrl: parsedUrl.toString(), url: parsedUrl.toString() });
      }

      const html = (await response.text()).slice(0, 250000);
      const patterns = [
        /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*>/i,
        /<meta[^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]*>/i,
        /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']image["'][^>]*>/i,
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) {
          const imageUrl = new URL(decodeHtml(match[1]), parsedUrl).toString();
          return res.json({ imageUrl, url: parsedUrl.toString() });
        }
      }

      res.status(404).json({ message: "No preview image found" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load preview" });
    }
  });

  // Unified library search — all sources run in parallel for speed.
  // Sources: Project Gutenberg (free full text) + Open Library catalog +
  // LibriVox free audiobooks (in-platform player) + YouTube fallback.
  const _libCache = new Map<string, { ts: number; data: any }>();
  const _LIB_TTL = 20 * 60 * 1000; // 20 min

  app.get("/api/library/search", isAuthenticated, async (req: any, res) => {
    const query = String(req.query.q || "").trim();
    const language = String(req.query.lang || "en").trim().slice(0, 2) || "en";
    const cacheKey = `${query}|${language}`;
    const cached = _libCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < _LIB_TTL) return res.json(cached.data);

    const safeFetch = async (url: string, ms = 7000) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      try {
        const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Vextorn/1.0 (library)" } });
        clearTimeout(t);
        return r.ok ? await r.json() : null;
      } catch { clearTimeout(t); return null; }
    };

    const mapLv = (b: any) => {
      const archiveId = b.url_iarchive
        ? (b.url_iarchive.match(/archive\.org\/details\/([^/?#]+)/)?.[1] ?? null)
        : null;
      return {
        id: b.id,
        title: b.title,
        author: Array.isArray(b.authors) && b.authors.length
          ? `${b.authors[0].first_name || ""} ${b.authors[0].last_name || ""}`.trim()
          : null,
        url: b.url_librivox || b.url_iarchive || null,
        url_iarchive: b.url_iarchive || null,
        archiveId,
        runtime: b.totaltime || null,
        language: b.language || null,
      };
    };

    try {
      const gutendexUrl = query
        ? `https://gutendex.com/books/?search=${encodeURIComponent(query)}&languages=${language}`
        : `https://gutendex.com/books/?sort=popular&languages=${language}`;

      // Default view: parallel Gutenberg + trending
      if (!query) {
        const [gutendex, trending] = await Promise.all([
          safeFetch(gutendexUrl),
          safeFetch(`https://openlibrary.org/trending/weekly.json?limit=16`),
        ]);
        const books = (gutendex?.results || []).slice(0, 24);
        const trendingBooks = (trending?.works || []).slice(0, 16).map((w: any) => ({
          key: w.key,
          title: w.title,
          author: Array.isArray(w.author_name) ? w.author_name.join(", ") : null,
          year: w.first_publish_year || null,
          coverUrl: w.cover_i ? `https://covers.openlibrary.org/b/id/${w.cover_i}-M.jpg` : null,
          openLibraryUrl: `https://openlibrary.org${w.key}`,
        }));
        const data = { query, books, openLibrary: trendingBooks, audiobooks: [], videos: [] };
        _libCache.set(cacheKey, { ts: Date.now(), data });
        return res.json(data);
      }

      // All 4 sources run in parallel
      const [gutR, olR, lvTitleR, lvAuthorR] = await Promise.allSettled([
        safeFetch(gutendexUrl),
        safeFetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i,subject`),
        safeFetch(`https://librivox.org/api/feed/audiobooks/?title=${encodeURIComponent(query)}&format=json&limit=6`),
        safeFetch(`https://librivox.org/api/feed/audiobooks/?author=${encodeURIComponent(query)}&format=json&limit=4`),
      ]);

      const books = ((gutR.status === "fulfilled" ? gutR.value?.results : null) || []).slice(0, 24);

      const openLibrary = books.length < 5
        ? ((olR.status === "fulfilled" ? olR.value?.docs : null) || []).slice(0, 8).map((d: any) => ({
            key: d.key,
            title: d.title,
            author: Array.isArray(d.author_name) ? d.author_name.join(", ") : null,
            year: d.first_publish_year || null,
            coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
            openLibraryUrl: `https://openlibrary.org${d.key}`,
          }))
        : [];

      const lvTitleBooks: any[] = (lvTitleR.status === "fulfilled" ? lvTitleR.value?.books : null) || [];
      const lvAuthorBooks: any[] = lvTitleBooks.length === 0
        ? ((lvAuthorR.status === "fulfilled" ? lvAuthorR.value?.books : null) || [])
        : [];
      const audiobooks = [...lvTitleBooks, ...lvAuthorBooks].slice(0, 6).map(mapLv).filter((a: any) => a.url);

      let videos: any[] = [];
      if (books.length < 3) {
        try {
          const ytSearch = await import("youtube-search-api");
          const yt = await ytSearch.GetListByKeyword(`${query} audiobook full`, false, 5, [{ type: "video" }]);
          videos = (yt?.items || []).slice(0, 5).map((v: any) => ({
            id: v.id, title: v.title, channel: v.channelTitle,
            thumbnail: v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url || null,
          }));
        } catch {}
      }

      const data = { query, books, openLibrary, audiobooks, videos };
      _libCache.set(cacheKey, { ts: Date.now(), data });
      res.json(data);
    } catch (err: any) {
      console.error("Library search error:", err);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Fetch LibriVox/archive.org chapter list for in-platform audiobook playback.
  app.get("/api/audiobook/chapters", isAuthenticated, async (req: any, res) => {
    const archiveId = String(req.query.id || "").replace(/[^a-zA-Z0-9_.\-]/g, "").slice(0, 200);
    if (!archiveId) return res.status(400).json({ error: "Missing id" });
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch(`https://archive.org/metadata/${archiveId}`, {
        signal: ctrl.signal, headers: { "User-Agent": "Vextorn/1.0" },
      });
      clearTimeout(t);
      if (!r.ok) return res.json({ id: archiveId, chapters: [] });
      const meta = await r.json();

      const allFiles: any[] = (meta.files || []).filter((f: any) => {
        if (!f.name) return false;
        const n = f.name.toLowerCase();
        return (n.endsWith(".mp3") || n.endsWith(".ogg")) && !n.startsWith(".");
      });
      const hasHighQ = allFiles.some((f: any) => {
        const n = f.name.toLowerCase();
        return !n.includes("_128kb") && !n.includes("_64kb") && !n.includes("64kbps") && !n.includes("_128kbps");
      });
      const files = (hasHighQ
        ? allFiles.filter((f: any) => {
            const n = f.name.toLowerCase();
            return !n.includes("_128kb") && !n.includes("_64kb") && !n.includes("64kbps") && !n.includes("_128kbps");
          })
        : allFiles
      ).sort((a: any, b: any) => {
        const na = parseInt((a.name.match(/(\d+)/) || ["0","0"])[1]) || 0;
        const nb = parseInt((b.name.match(/(\d+)/) || ["0","0"])[1]) || 0;
        return na - nb || a.name.localeCompare(b.name);
      }).slice(0, 150);

      const fmtDur = (secs: any) => {
        const s = parseFloat(secs);
        if (!s || isNaN(s)) return null;
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = Math.floor(s % 60);
        return h > 0 ? `${h}:${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}` : `${m}:${String(sc).padStart(2,"0")}`;
      };

      const chapters = files.map((f: any, i: number) => ({
        n: i + 1,
        title: (f.title || f.name.replace(/\.(mp3|ogg)$/i, "").replace(/[_-]+/g, " ")).trim() || `Track ${i + 1}`,
        url: `https://archive.org/download/${archiveId}/${f.name}`,
        duration: fmtDur(f.length),
      }));

      res.json({ id: archiveId, chapters });
    } catch {
      clearTimeout(t);
      res.json({ id: archiveId, chapters: [] });
    }
  });

  // Find free-text version of a book — tries Gutenberg, then Wikisource
  app.get("/api/book/find-text", isAuthenticated, async (req: any, res) => {
    const title = String(req.query.title || "").trim().slice(0, 200);
    const author = String(req.query.author || "").trim().slice(0, 100);
    if (!title) return res.status(400).json({ found: false });

    const safeFetch = async (url: string, ms = 6000) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      try {
        const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Vextorn/1.0" } });
        clearTimeout(t);
        return r.ok ? await r.json() : null;
      } catch { clearTimeout(t); return null; }
    };

    // 1) Try Gutenberg search
    const q = author ? `${title} ${author}` : title;
    const gut = await safeFetch(`https://gutendex.com/books/?search=${encodeURIComponent(q)}&languages=en`);
    const gutBooks = (gut?.results || []).filter((b: any) => {
      const f = b.formats || {};
      return f["text/plain; charset=utf-8"] || f["text/plain; charset=us-ascii"] || f["text/plain"];
    });
    if (gutBooks.length > 0) {
      return res.json({ found: true, source: "gutenberg", book: gutBooks[0] });
    }

    // 2) Try Wikisource
    const ws = await safeFetch(
      `https://en.wikisource.org/w/api.php?action=opensearch&search=${encodeURIComponent(title)}&limit=3&namespace=0&format=json`
    );
    if (ws?.[1]?.length > 0) {
      return res.json({ found: true, source: "wikisource", wikisourceTitle: ws[1][0] });
    }

    return res.json({ found: false });
  });

  // Fetch and clean text from Wikisource
  app.get("/api/book/wikisource", isAuthenticated, async (req: any, res) => {
    const title = String(req.query.title || "").trim().slice(0, 300);
    if (!title) return res.status(400).json({ message: "Missing title" });
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch(
        `https://en.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&disablelimitreport=1`,
        { signal: ctrl.signal, headers: { "User-Agent": "Vextorn/1.0" } }
      );
      clearTimeout(t);
      if (!r.ok) return res.status(404).json({ message: "Not found on Wikisource" });
      const data = await r.json();
      const html: string = data.parse?.text?.["*"] || "";
      if (!html) return res.status(404).json({ message: "No text content" });

      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#\d+;/g, " ")
        .replace(/\[\d+\]/g, "")
        .replace(/\n{4,}/g, "\n\n\n")
        .trim()
        .slice(0, 14000);

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(text);
    } catch {
      clearTimeout(t);
      res.status(500).json({ message: "Failed to fetch from Wikisource" });
    }
  });

  const _bookTextCache = new Map<string, { ts: number; text: string }>();
  const BOOK_TEXT_TTL = 2 * 60 * 60 * 1000;

  app.get("/api/book/text", isAuthenticated, async (req: any, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ message: "Missing url" });
    const allowed = ["gutenberg.org", "gutenberg.net", "gutenberg.ca", "pgdp.net", "pglaf.org", "aleph.gutenberg.org"];
    let hostname: string;
    try { hostname = new URL(url).hostname; } catch { return res.status(400).json({ message: "Invalid url" }); }
    if (!allowed.some(h => hostname === h || hostname.endsWith("." + h))) {
      return res.status(403).json({ message: "URL not allowed" });
    }
    const cached = _bookTextCache.get(url);
    if (cached && Date.now() - cached.ts < BOOK_TEXT_TTL) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("X-Cache", "HIT");
      return res.send(cached.text);
    }
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 12000);
    try {
      const response = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": "Vextorn/1.0 (+https://vextorn.replit.app)" },
      });
      clearTimeout(timeout);
      if (!response.ok) return res.status(response.status).json({ message: "Upstream error" });
      const raw = await response.text();
      // Normalize Windows CRLF → LF so paragraph splitting (\n{2,}) works correctly
      const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      if (text && text.length > 100) {
        _bookTextCache.set(url, { ts: Date.now(), text });
        if (_bookTextCache.size > 200) {
          const oldest = [..._bookTextCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
          _bookTextCache.delete(oldest[0]);
        }
      }
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(text);
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") return res.status(504).json({ message: "Book fetch timed out" });
      console.error("Book proxy error:", err);
      res.status(500).json({ message: "Failed to fetch book" });
    }
  });

  /* ── Book Bookmarks ───────────────────────────────────────────────────────
     Persist a user's reading position for a specific book across sessions.
     bookId is the Gutenberg numeric id (as string) or book title when no id. */

  app.get("/api/book/bookmark", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const bookId = req.query.bookId as string;
      if (!bookId) return res.status(400).json({ message: "Missing bookId" });
      const bookmark = await storage.getBookBookmark(userId, bookId);
      res.json(bookmark || null);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch bookmark" });
    }
  });

  app.get("/api/book/bookmarks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const bookmarks = await storage.getUserBookBookmarks(userId);
      res.json(bookmarks);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch bookmarks" });
    }
  });

  app.post("/api/book/bookmark", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { bookId, bookTitle, bookAuthor, page, totalPages, textUrl } = req.body;
      if (!bookId || !bookTitle || page == null) return res.status(400).json({ message: "Missing required fields" });
      const bookmark = await storage.upsertBookBookmark({
        userId,
        bookId: String(bookId),
        bookTitle: String(bookTitle),
        bookAuthor: bookAuthor ? String(bookAuthor) : "",
        page: Number(page),
        totalPages: Number(totalPages) || 0,
        textUrl: textUrl ? String(textUrl) : "",
      });
      res.json(bookmark);
    } catch (err) {
      res.status(500).json({ message: "Failed to save bookmark" });
    }
  });

  app.delete("/api/book/bookmark", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const bookId = req.query.bookId as string;
      if (!bookId) return res.status(400).json({ message: "Missing bookId" });
      await storage.deleteBookBookmark(userId, bookId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete bookmark" });
    }
  });

  /* ── YouTube → Readable Article ──────────────────────────────────────────
     Extracts the full transcript from a YouTube video and formats it as a
     readable article. Uses youtube-transcript as the primary strategy with
     robust page-scraping fallbacks. */
  const _ytArticleCache = new Map<string, { ts: number; title: string; text: string; thumbnailUrl?: string }>();
  const YT_ARTICLE_TTL = 30 * 60 * 1000; // 30 min

  // ── YouTube cookie jar ────────────────────────────────────────────────────
  // YouTube detects datacenter IPs and hides caption tracks unless requests
  // carry browser-like cookies (CONSENT, SOCS, VISITOR_INFO1_LIVE, etc.).
  // We warm these cookies once at first use and refresh them every 30 min.
  let _ytCookieCache: { ts: number; cookie: string } | null = null;
  const YT_COOKIE_TTL = 30 * 60 * 1000;

  const getYtCookies = async (): Promise<string> => {
    if (_ytCookieCache && Date.now() - _ytCookieCache.ts < YT_COOKIE_TTL) {
      return _ytCookieCache.cookie;
    }
    try {
      // Fetch consent page to get initial cookies that bypass consent gate
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch("https://www.youtube.com/", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: ctrl.signal,
        redirect: "follow",
      });
      clearTimeout(t);
      const setCookieHeaders = r.headers.getSetCookie?.() || [];
      const rawCookies = setCookieHeaders
        .map((h: string) => h.split(";")[0].trim())
        .filter(Boolean);
      // Always include SOCS=CAI to accept all cookies (bypasses consent modal)
      if (!rawCookies.some((c: string) => c.startsWith("SOCS="))) {
        rawCookies.push("SOCS=CAI");
      }
      if (!rawCookies.some((c: string) => c.startsWith("CONSENT="))) {
        rawCookies.push("CONSENT=YES+cb");
      }
      const cookie = rawCookies.join("; ");
      _ytCookieCache = { ts: Date.now(), cookie };
      return cookie;
    } catch {
      const fallback = "SOCS=CAI; CONSENT=YES+cb";
      _ytCookieCache = { ts: Date.now(), cookie: fallback };
      return fallback;
    }
  };

  function extractYtId(input: string): string | null {
    const patterns = [
      /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
      /(?:[?&]v=)([A-Za-z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
      /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
      /^([A-Za-z0-9_-]{11})$/,
    ];
    for (const p of patterns) {
      const m = input.match(p);
      if (m) return m[1];
    }
    return null;
  }

  // Helper: convert a flat array of transcript segments → readable paragraphs
  function segmentsToArticle(segments: Array<{ text: string }>): string {
    const NOISE = /^\s*\[.*?\]\s*$|^\s*\(.*?\)\s*$/;
    const words: string[] = [];
    for (const seg of segments) {
      const cleaned = (seg.text || "")
        .replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .trim();
      if (!cleaned || NOISE.test(cleaned)) continue;
      words.push(...cleaned.split(/\s+/).filter(Boolean));
    }
    const WORDS_PER_PARA = 120;
    const paragraphs: string[] = [];
    for (let i = 0; i < words.length; i += WORDS_PER_PARA) {
      paragraphs.push(words.slice(i, i + WORDS_PER_PARA).join(" "));
    }
    return paragraphs.join("\n\n");
  }

  // Helper: convert InnerTube caption events → article text
  function eventsToArticle(events: any[]): string {
    const segs: Array<{ text: string }> = [];
    for (const ev of events) {
      if (!ev.segs) continue;
      for (const seg of ev.segs) {
        const t = (seg.utf8 || "").trim();
        if (t && t !== "\n") segs.push({ text: t });
      }
    }
    return segmentsToArticle(segs);
  }

  // Helper: timed fetch with abort
  const timedFetch = async (url: string, opts: RequestInit = {}, ms = 12000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(t);
      return r;
    } catch (e) { clearTimeout(t); throw e; }
  };

  const YT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  app.get("/api/yt-to-article", isAuthenticated, async (req: any, res) => {
    const url = (req.query.url as string || "").trim();
    const videoId = extractYtId(url);
    if (!videoId) return res.status(400).json({ message: "Invalid YouTube URL or video ID" });

    const cached = _ytArticleCache.get(videoId);
    if (cached && Date.now() - cached.ts < YT_ARTICLE_TTL) {
      return res.json({ title: cached.title, text: cached.text, thumbnailUrl: cached.thumbnailUrl });
    }

    let title = `YouTube Video (${videoId})`;
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Helper: fetch oEmbed title (no API key needed)
    const fetchTitle = async (): Promise<string> => {
      try {
        const r = await timedFetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
          { headers: YT_HEADERS }, 5000
        );
        if (r.ok) {
          const oe: any = await r.json();
          if (oe?.title) return oe.title;
        }
      } catch { /* fallback to default */ }
      return title;
    };

    try {
      // ── Strategy A0: ANDROID_VR InnerTube (best bypass rate from server IPs) ──
      // The ANDROID_VR InnerTube client (Oculus Quest) returns OK + signed caption
      // track URLs for videos with accessible captions, even from datacenter IPs.
      // Returns signed timedtext URLs that work without further auth.
      const vrBody = {
        context: {
          client: {
            clientName: "ANDROID_VR",
            clientVersion: "1.57.29",
            deviceMake: "Oculus",
            deviceModel: "Quest 3",
            androidSdkVersion: 32,
            hl: "en",
            gl: "US",
            timeZone: "UTC",
            utcOffsetMinutes: 0,
          },
        },
        videoId,
        racyCheckOk: true,
        contentCheckOk: true,
      };
      try {
        const vrRes = await timedFetch(
          "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "com.google.android.apps.youtube.vr.oculus/1.57.29 (Linux; U; Android 12L; eureka-user Build/SP1A.210812.016) gzip",
              "X-YouTube-Client-Name": "28",
              "X-YouTube-Client-Version": "1.57.29",
            },
            body: JSON.stringify(vrBody),
          }, 12000
        );
        if (vrRes.ok) {
          const vrData: any = await vrRes.json();
          if (vrData?.playabilityStatus?.status === "OK") {
            const tracks: any[] = vrData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
            if (tracks.length > 0) {
              // Prefer manual EN > any EN > any language; skip ASR (auto-generated) if manual exists
              const manual = tracks.filter((t: any) => !t.kind || t.kind !== "asr");
              const pool = manual.length > 0 ? manual : tracks;
              const enTrack = pool.find((t: any) => t.languageCode === "en") || pool.find((t: any) => t.languageCode?.startsWith("en")) || pool[0];
              if (enTrack?.baseUrl) {
                // Try JSON3 first (structured), fall back to XML
                const capRes = await timedFetch(`${enTrack.baseUrl}&fmt=json3`, {}, 10000);
                if (capRes.ok) {
                  const raw = await capRes.text();
                  // The signed timedtext URL always returns XML timedtext format 3
                  // which uses <p t="..." d="...">text</p> tags — NOT <text> tags.
                  // Parse both <p> and legacy <text> formats for maximum compatibility.
                  const parseTimedtextXml = (xml: string): Array<{ text: string }> => {
                    const segs: Array<{ text: string }> = [];
                    // Format 3: <p t="ms" d="ms">text content</p>
                    for (const m of xml.matchAll(/<p(?:\s[^>]*)?>([^<]*)<\/p>/g)) {
                      const t = m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'")
                        .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
                      if (t) segs.push({ text: t });
                    }
                    // Legacy format: <text start="..." dur="...">text</text>
                    if (segs.length === 0) {
                      for (const m of xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) {
                        const t = m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'")
                          .replace(/&quot;/g, '"').trim();
                        if (t) segs.push({ text: t });
                      }
                    }
                    return segs;
                  };
                  const xmlSegs = parseTimedtextXml(raw);
                  const text = segmentsToArticle(xmlSegs);
                  if (text && text.length >= 10) {
                    title = await fetchTitle();
                    _ytArticleCache.set(videoId, { ts: Date.now(), title, text, thumbnailUrl });
                    return res.json({ title, text, thumbnailUrl });
                  }
                }
              }
            }
          }
        }
      } catch { /* fall through to next strategy */ }

      // ── Strategy A: youtube-transcript npm package with cookie-enriched fetch ─
      // YouTube detects datacenter IPs and hides caption tracks for anonymous
      // requests. Passing real browser cookies (SOCS, CONSENT, VISITOR_INFO1_LIVE)
      // makes the request look like a browser and restores transcript access.
      // We try English-specific first, then any language as fallback.
      const cookieStr = await getYtCookies().catch(() => "SOCS=CAI; CONSENT=YES+cb");
      const cookieFetch = (url: string | URL | Request, init?: RequestInit) =>
        fetch(url, {
          ...init,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Cookie": cookieStr,
            ...(init?.headers as Record<string, string> || {}),
          },
        });

      const tryYtTranscript = async (opts?: { lang: string }) => {
        const { YoutubeTranscript } = await import("youtube-transcript");
        const config: any = { fetch: cookieFetch, ...(opts || {}) };
        return await YoutubeTranscript.fetchTranscript(videoId, config);
      };

      for (const opts of [{ lang: "en" }, undefined] as Array<{ lang: string } | undefined>) {
        try {
          const segments = await tryYtTranscript(opts);
          if (segments && segments.length >= 1) {
            const text = segmentsToArticle(segments);
            if (text.length >= 10) {
              title = await fetchTitle();
              _ytArticleCache.set(videoId, { ts: Date.now(), title, text, thumbnailUrl });
              return res.json({ title, text, thumbnailUrl });
            }
          }
        } catch { /* try next option */ }
      }

      // ── Strategy B: Scrape the watch page with cookies + scan for timedtext URLs
      // Cookies obtained in Strategy A are reused here to get the browser-like
      // page response that includes captionTracks in ytInitialPlayerResponse.
      const pageRes = await timedFetch(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
          headers: {
            ...YT_HEADERS,
            "Cookie": cookieStr,
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Upgrade-Insecure-Requests": "1",
          },
        }, 15000
      );
      if (!pageRes.ok) {
        return res.status(502).json({ message: "Could not reach YouTube. Please try again in a moment." });
      }
      const html = await pageRes.text();

      // Extract title from page
      const titlePatterns = [/"title":"([^"\\]{3,200})(?:\\[^"\\]|[^"\\])*?"/, /<title>([^<]+)<\/title>/];
      for (const p of titlePatterns) {
        const m = html.match(p);
        if (m?.[1]) {
          const t = m[1].replace(/\\u0026/g, "&").replace(/\\"/g, '"').replace(/\\n/g, " ")
            .replace(/ - YouTube$/, "").trim();
          if (t.length > 3) { title = t; break; }
        }
      }

      // ── Direct timedtext URL scan (robust — no JSON parsing needed) ────────────
      // YouTube embeds the caption track baseUrl values in the serialised page JS.
      // We capture every "baseUrl":"…timedtext…" pattern in the entire HTML and
      // also capture the adjacent "languageCode":"…" so we can prefer English.
      let captionUrl: string | null = null;
      {
        const allTracks: Array<{ url: string; lang: string }> = [];

        // Primary scan: find baseUrl + nearby languageCode in the same JSON segment
        const rx = /"baseUrl":"(https?:\/\/[^"]*timedtext[^"]*)"(?:[^{}]{0,300}?"languageCode":"([^"]+)")?/g;
        let m: RegExpExecArray | null;
        while ((m = rx.exec(html)) !== null) {
          const url = m[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/");
          const lang = m[2] || (() => {
            const lm = url.match(/[?&]lang=([^&]+)/);
            return lm?.[1] || "??";
          })();
          allTracks.push({ url, lang });
        }

        // Fallback scan: any timedtext URL in the page (catches edge cases)
        if (allTracks.length === 0) {
          const rx2 = /"(https?:\/\/[^"]*timedtext[^"]*)"/g;
          while ((m = rx2.exec(html)) !== null) {
            const url = m[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/");
            const lm = url.match(/[?&]lang=([^&]+)/);
            allTracks.push({ url, lang: lm?.[1] || "??" });
          }
        }

        // Prefer English; among ties prefer manual over auto (kind=asr is auto)
        const ranked = allTracks.sort((a, b) => {
          const aEn = a.lang.startsWith("en") ? 0 : 1;
          const bEn = b.lang.startsWith("en") ? 0 : 1;
          if (aEn !== bEn) return aEn - bEn;
          const aAuto = a.url.includes("kind=asr") ? 1 : 0;
          const bAuto = b.url.includes("kind=asr") ? 1 : 0;
          return aAuto - bAuto;
        });
        captionUrl = ranked[0]?.url || null;
      }

      if (!captionUrl) {
        return res.status(422).json({
          message: "YouTube is restricting transcript access for this video from our server. Try a different video — ones with manually uploaded English subtitles (CC icon in YouTube) tend to work best."
        });
      }

      // Fetch the caption data — prefer json3 format for structured events
      const capUrl = captionUrl.includes("fmt=") ? captionUrl : `${captionUrl}&fmt=json3`;
      const capRes = await timedFetch(capUrl, { headers: YT_HEADERS }, 12000);
      if (!capRes.ok) {
        // Try xml format as last resort
        const xmlUrl = captionUrl.replace(/&fmt=[^&]+/, "") + "&fmt=xml";
        const xmlRes = await timedFetch(xmlUrl, { headers: YT_HEADERS }, 10000);
        if (!xmlRes.ok) return res.status(502).json({ message: "Could not download captions. Please try another video." });
        const xmlText = await xmlRes.text();
        // Parse simple <text> tags from XML caption format
        const xmlSegs = [...xmlText.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
          .map(m => ({ text: m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim() }));
        const text = segmentsToArticle(xmlSegs);
        if (!text || text.length < 10) return res.status(422).json({ message: "Captions appear empty for this video. Try a different one." });
        _ytArticleCache.set(videoId, { ts: Date.now(), title, text, thumbnailUrl });
        return res.json({ title, text, thumbnailUrl });
      }

      const capContentType = capRes.headers.get("content-type") || "";
      let text = "";
      if (capContentType.includes("json") || capUrl.includes("fmt=json3")) {
        try {
          const capJson: any = await capRes.json();
          text = eventsToArticle(capJson?.events || []);
        } catch {
          const raw = await capRes.text();
          const xmlSegs = [...raw.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
            .map(m => ({ text: m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim() }));
          text = segmentsToArticle(xmlSegs);
        }
      } else {
        const raw = await capRes.text();
        const xmlSegs = [...raw.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
          .map(m => ({ text: m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim() }));
        text = segmentsToArticle(xmlSegs);
      }

      if (!text || text.length < 10) {
        return res.status(422).json({ message: "Captions appear empty for this video. Try a different one." });
      }

      _ytArticleCache.set(videoId, { ts: Date.now(), title, text, thumbnailUrl });
      return res.json({ title, text, thumbnailUrl });

    } catch (err: any) {
      console.error("[yt-to-article] error:", err?.message || err);
      const msg = err?.message?.includes("Too Many") || err?.message?.includes("captcha")
        ? "YouTube is rate-limiting this server. Please try again in a few minutes."
        : "Failed to extract transcript. YouTube may be restricting access — try a video with manually uploaded English subtitles.";
      return res.status(500).json({ message: msg });
    }
  });

  // ── Saved Articles CRUD ────────────────────────────────────────────────────
  app.get("/api/saved-articles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { db } = await import("./db");
      const { savedArticles } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      const articles = await db
        .select()
        .from(savedArticles)
        .where(eq(savedArticles.userId, userId))
        .orderBy(desc(savedArticles.createdAt))
        .limit(50);
      res.json(articles);
    } catch (err: any) {
      console.error("[saved-articles] GET error:", err?.message);
      res.status(500).json({ message: "Failed to load saved articles" });
    }
  });

  app.post("/api/saved-articles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { title, content, source = "youtube", sourceUrl, videoId, thumbnailUrl } = req.body;
      if (!title?.trim() || !content?.trim()) {
        return res.status(400).json({ message: "Title and content are required" });
      }
      const { db } = await import("./db");
      const { savedArticles } = await import("@shared/schema");
      const [article] = await db.insert(savedArticles).values({
        userId,
        title: title.trim().slice(0, 500),
        content: content.slice(0, 200000),
        source,
        sourceUrl: sourceUrl || null,
        videoId: videoId || null,
        thumbnailUrl: thumbnailUrl || null,
      }).returning();
      res.json(article);
    } catch (err: any) {
      console.error("[saved-articles] POST error:", err?.message);
      res.status(500).json({ message: "Failed to save article" });
    }
  });

  app.delete("/api/saved-articles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { db } = await import("./db");
      const { savedArticles } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      await db.delete(savedArticles)
        .where(and(eq(savedArticles.id, req.params.id), eq(savedArticles.userId, userId)));
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[saved-articles] DELETE error:", err?.message);
      res.status(500).json({ message: "Failed to delete article" });
    }
  });

  app.get("/api/users", isAuthenticated, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      if (userId !== req.params.id) {
        return res.status(403).json({ message: "Cannot update other users" });
      }
      const { displayName, profileImageUrl, avatarRing, flairBadge, bio, profileDecoration, profileAnimation, instagramUrl, linkedinUrl, facebookUrl, socialsPinned, status } = req.body;

      // ── Content moderation ─────────────────────────────────────────────────
      const _profileUser = await storage.getUser(userId);
      const profileModResult = checkFields({ displayName, bio }, "profile", { userId, displayName: displayName ?? _profileUser?.displayName ?? undefined, avatarUrl: profileImageUrl ?? _profileUser?.profileImageUrl ?? undefined });
      if (profileModResult.flagged) {
        const fieldLabel = profileModResult.field === "displayName" ? "display name" : "bio";
        recordStrike(userId, displayName ?? userId, profileModResult.matchedTerm ?? "unknown", "profile");
        return res.status(422).json({
          flagged: true,
          field: profileModResult.field,
          message: `Your ${fieldLabel} wasn't saved — ${profileModResult.message.replace("Your content", "it")}`,
        });
      }

      const updateData: any = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (profileImageUrl !== undefined) updateData.profileImageUrl = normalizeProfileImageUrl(profileImageUrl);
      if (avatarRing !== undefined) updateData.avatarRing = avatarRing;
      if (flairBadge !== undefined) updateData.flairBadge = flairBadge;
      if (bio !== undefined) updateData.bio = bio;
      if (profileDecoration !== undefined) updateData.profileDecoration = profileDecoration;
      if (profileAnimation !== undefined) updateData.profileAnimation = profileAnimation;
      if (instagramUrl !== undefined) updateData.instagramUrl = instagramUrl;
      if (linkedinUrl !== undefined) updateData.linkedinUrl = linkedinUrl;
      if (facebookUrl !== undefined) updateData.facebookUrl = facebookUrl;
      if (socialsPinned !== undefined) updateData.socialsPinned = !!socialsPinned;
      if (status !== undefined) updateData.status = status;
      const updated = await storage.updateUser(userId, updateData);
      // Broadcast profile changes to all connected clients so avatars, rings,
      // and decorations refresh in real-time without a page reload.
      io.emit("user:profile-updated", {
        userId,
        displayName: updated.displayName,
        profileImageUrl: updated.profileImageUrl,
        avatarRing: updated.avatarRing,
        flairBadge: updated.flairBadge,
        profileDecoration: updated.profileDecoration,
        profileAnimation: updated.profileAnimation,
        status: updated.status,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/upload/avatar", isAuthenticated, upload.single("avatar"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const userId = (req.user as any).id;
      const imageUrl = `/uploads/${req.file.filename}`;
      await storage.updateUser(userId, { profileImageUrl: imageUrl });
      res.json({ url: imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/upload/chat-image", isAuthenticated, upload.single("image"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/upload/hologram", isAuthenticated, uploadVideo.single("video"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No video file uploaded" });
      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Direct Streaming (RTMP relay via FFmpeg) ─────────────────────────────
  app.post("/api/stream/start", isAuthenticated, apiRateLimiter, async (req: any, res) => {
    try {
      const { twitchKey, youtubeKey, roomId, twitchUsername, youtubeChannelId, quality } = req.body;
      const userId = req.user?.id?.toString();
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!twitchKey && !youtubeKey) return res.status(400).json({ message: "Provide at least one stream key" });
      const streamId = `${userId}-${Date.now()}`;
      const safeQuality = ["480p", "720p", "1080p"].includes(quality) ? quality : "720p";
      const result = startStream({ streamId, userId, roomId: roomId || "", twitchKey, youtubeKey, twitchUsername, youtubeChannelId, quality: safeQuality });
      if (!result.ok) return res.status(500).json({ message: result.error });
      res.json({ streamId });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/stream/:streamId/chunk", isAuthenticated, async (req: any, res) => {
    try {
      const { streamId } = req.params;
      const userId = req.user?.id?.toString();
      const info = getStreamInfo(streamId);
      if (!info) return res.status(404).json({ message: "Stream not found", dead: true });
      if (info.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      // If FFmpeg already died, tell the client immediately so it can show the error
      if (!info.alive) return res.status(410).json({ message: "Stream ended", dead: true, exitError: info.exitError });
      const chunks: Buffer[] = [];
      req.on("data", (d: Buffer) => chunks.push(d));
      req.on("end", () => {
        const buf = Buffer.concat(chunks);
        const result = writeChunk(streamId, buf);
        if (result === "dead") return res.status(410).json({ message: "Stream ended", dead: true });
        if (result === "notfound") return res.status(404).json({ message: "Stream not found", dead: true });
        res.json({ ok: true, bytes: buf.length });
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/stream/:streamId/stop", isAuthenticated, async (req: any, res) => {
    try {
      const { streamId } = req.params;
      const userId = req.user?.id?.toString();
      const info = getStreamInfo(streamId);
      if (info && info.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      stopStream(streamId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/stream/:streamId/status", isAuthenticated, async (req: any, res) => {
    const info = getStreamInfo(req.params.streamId);
    if (!info) return res.json({ active: false });
    res.json({ active: true, ...info });
  });

  app.get("/api/stream/:streamId/viewers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id?.toString();
      const info = getStreamInfo(req.params.streamId);
      if (info && info.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const counts = await getViewerCounts(req.params.streamId);
      res.json(counts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

  app.get("/api/rooms", async (_req, res) => {
    try {
      const allRooms = await storage.getAllRooms();
      // Filter out empty rooms — rooms with 0 active users are either in the
      // 25-second grace period before deletion or truly abandoned. Either way
      // there's no value showing them in the lobby.
      const nonEmptyRooms = allRooms.filter((room) => (room.activeUsers ?? 0) > 0);
      // SSE stream (/api/rooms/stream) is the authoritative real-time source.
      // The HTTP endpoint is only hit on cold load and as a safety-net fallback.
      // stale-while-revalidate removed: serving a 24 h old list on refresh was
      // the primary cause of ghost rooms persisting in the lobby after a server
      // restart or after rooms become empty.
      res.setHeader("Cache-Control", "no-cache");
      res.json(nonEmptyRooms.map((room) => roomPublicPayload(room)));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Room SSE stream ────────────────────────────────────────────────────────
  // Clients subscribe once and receive the full room list whenever any room is
  // created, updated, or deleted — replacing the 15 s polling interval.
  // EventSource reconnects automatically on drop; a 25 s heartbeat comment
  // prevents proxies from closing idle connections.
  app.get("/api/rooms/stream", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Send the current room list immediately so the client hydrates without
    // waiting for the next mutation event. Filter empty rooms here too.
    try {
      const allRooms = await storage.getAllRooms();
      const rooms = allRooms.filter((r) => (r.activeUsers ?? 0) > 0).map((r) => roomPublicPayload(r));
      res.write(`event: rooms\ndata: ${JSON.stringify(rooms)}\n\n`);
    } catch {}

    // Keepalive: comment lines don't trigger message handlers on the client.
    const timer = setInterval(() => {
      try { res.write(": heartbeat\n\n"); } catch {}
    }, 25_000);

    const client = { res, timer };
    sseRoomClients.add(client);

    req.on("close", () => {
      clearInterval(timer);
      sseRoomClients.delete(client);
    });
  });

  app.post("/api/rooms/:id/access-link", isAuthenticated, async (req: any, res) => {
    try {
      const roomParam = req.params.id;
      const room = isUuid(roomParam) ? await storage.getRoom(roomParam) : await storage.getRoomByShortId(roomParam);
      if (!room) return res.status(404).json({ message: "Room not found" });
      const requester = await storage.getUser((req.user as any).id);
      const includeKey = !room.isPublic && canManageRoomLink(requester, room);
      if (!room.isPublic && !includeKey) {
        return res.status(403).json({ message: "Only the room host can copy the private room key" });
      }
      const origin = `${req.protocol}://${req.get("host")}`;
      const pathOnly = includeKey
        ? `/room/${room.shortId}?key=${encodeURIComponent(room.accessKey || "")}`
        : `/room/${room.shortId}`;
      res.json({
        roomId: room.id,
        shortId: room.shortId,
        keyRequired: !room.isPublic,
        path: pathOnly,
        url: `${origin}${pathOnly}`,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Returns the authenticated user's own rooms regardless of activeUsers.
  // Used by the lobby to ensure the owner always sees their room card with
  // the correct hologramVideoUrl even when activeUsers=0 (just created,
  // owner left temporarily) or when the HTTP cache served stale room data.
  app.get("/api/rooms/mine", isAuthenticated, async (req: any, res) => {
    try {
      const myRooms = await storage.getRoomsByOwner(req.user.id);
      res.setHeader("Cache-Control", "no-cache");
      res.json(myRooms.map((r) => roomPublicPayload(r, false)));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/rooms/:id", async (req, res) => {
    try {
      const roomParam = req.params.id;
      const room = isUuid(roomParam) ? await storage.getRoom(roomParam) : await storage.getRoomByShortId(roomParam);
      if (!room) return res.status(404).json({ message: "Room not found" });
      if (!room.isPublic && room.accessKey !== req.query.key) {
        return res.status(403).json({ message: "Invalid room link" });
      }
      res.json(roomPublicPayload(room, true));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const createRoomBody = insertRoomSchema.extend({
    ownerId: z.string().min(1),
  });

  const isUserRestricted = (user: User | undefined | null) =>
    !!(user?.restrictedUntil && new Date(user.restrictedUntil).getTime() > Date.now());

  const leaveRoomState = async (roomId: string, userId: string, leavingSocket?: any) => {
    leavingSocket?.leave(roomId);

    if (userCurrentRoom.get(userId) === roomId) {
      userCurrentRoom.delete(userId);
    }

    roomVideoStatus.get(roomId)?.delete(userId);
    roomRoles.get(roomId)?.delete(userId);
    if (roomScreenShareStatus.get(roomId) === userId) {
      roomScreenShareStatus.delete(roomId);
      io.to(roomId).emit("room:screen-share", { userId, active: false });
    }

    // Per-host model: only clear THIS user's host slot. Other users' videos
    // keep playing for everyone watching them.
    if (deleteYtHost(roomId, userId)) {
      deleteYtVotes(roomId, userId);
      io.to(roomId).emit("room:youtube", { hostId: userId, videoId: null, startedBy: userId });
    }

    const bkState = roomBookState.get(roomId);
    if (bkState) {
      bkState.watchers.delete(userId);
      if (bkState.hostId === userId) {
        roomBookState.delete(roomId);
        io.to(roomId).emit("room:book", { book: null, hostId: null, scrollPct: 0, watchers: [] });
      } else {
        io.to(roomId).emit("room:book-watchers-update", { userId, watching: false });
      }
    }

    // Chess: if the leaving user was a seated player, end the match
    const chState = roomChessState.get(roomId);
    if (chState) {
      if (chState.white?.userId === userId || chState.black?.userId === userId) {
        const wasWhite = chState.white?.userId === userId;
        chState.status = "ended";
        chState.endReason = "left_room";
        chState.winner = wasWhite ? "black" : "white";
        io.to(roomId).emit("room:chess-state", chState);
        // Auto-clear after 5s so a new match can start
        setTimeout(() => {
          if (roomChessState.get(roomId)?.endReason === "left_room") {
            roomChessState.delete(roomId);
            io.to(roomId).emit("room:chess-state", null);
          }
        }, 5000);
      }
    }
    const lichessState = roomLichessState.get(roomId);
    if (lichessState && lichessState.sharedBy === userId) {
      roomLichessState.delete(roomId);
      io.to(roomId).emit("room:lichess", null);
    }
    const jklmLeaveState = roomJklmState.get(roomId);
    if (jklmLeaveState && jklmLeaveState.sharedBy === userId) {
      roomJklmState.delete(roomId);
      io.to(roomId).emit("room:jklm-state", null);
    }

    // C4: if leaving user was a player, end the game
    const c4LeaveState = roomC4State.get(roomId);
    if (c4LeaveState && c4LeaveState.status === "playing") {
      if (c4LeaveState.red?.userId === userId || c4LeaveState.yellow?.userId === userId) {
        const wasRed = c4LeaveState.red?.userId === userId;
        c4LeaveState.status = "ended";
        c4LeaveState.winner = wasRed ? "yellow" : "red";
        c4LeaveState.winLine = null;
        io.to(roomId).emit("room:c4-state", c4LeaveState);
        setTimeout(() => {
          if (roomC4State.get(roomId) === c4LeaveState) {
            roomC4State.delete(roomId);
            io.to(roomId).emit("room:c4-state", null);
          }
        }, 5000);
      }
    }

    if (!roomParticipants.has(roomId)) return [];
    if (!roomParticipants.get(roomId)!.has(userId)) return [];

    const leavingUser = roomParticipants.get(roomId)!.get(userId);
    let leavingDisplayName = leavingUser ? getDisplayName(leavingUser) : null;
    if (!leavingDisplayName) {
      const dbUser = await storage.getUser(userId);
      if (dbUser) leavingDisplayName = getDisplayName(dbUser);
    }
    roomParticipants.get(roomId)!.delete(userId);
    const participants = Array.from(roomParticipants.get(roomId)!.values());
    await storage.updateRoomActiveUsers(roomId, participants.length);
    io.to(roomId).emit("room:user-left", { userId, participants, displayName: leavingDisplayName });
    io.emit("room:participants-update", { roomId, participants });

    if (participants.length === 0) {
      roomVideoStatus.delete(roomId);
      roomScreenShareStatus.delete(roomId);
      roomYoutubeState.delete(roomId);
      roomYoutubeQueue.delete(roomId);
      roomMovieState.delete(roomId);
      roomRoles.delete(roomId);
      roomMuteStatus.delete(roomId);
      roomKnockGrants.delete(roomId);
      roomPinnedMessages.delete(roomId);
      startRoomDeleteTimer(roomId);
    } else {
      roomMuteStatus.get(roomId)?.delete(userId);
    }

    return participants;
  };

  app.post("/api/rooms", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = createRoomBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid room data", errors: parsed.error.flatten() });
      }

      const ownerId = parsed.data.ownerId || (req.user as any).id;
      const owner = await storage.getUser(ownerId);
      if (isUserRestricted(owner)) {
        return res.status(403).json({
          message: owner?.restrictedReason || "Your account is temporarily restricted from creating rooms.",
          restrictedUntil: owner?.restrictedUntil,
        });
      }
      // ── Content moderation ─────────────────────────────────────────────────
      const _rcUser = await storage.getUser(ownerId);
      const roomCreateModResult = checkContent(parsed.data.title, "room-title", { userId: ownerId, displayName: _rcUser?.displayName ?? undefined, avatarUrl: _rcUser?.profileImageUrl ?? undefined });
      if (roomCreateModResult.flagged) {
        const rcUserId = (req as any).user?.id ?? "unknown";
        recordStrike(rcUserId, parsed.data.title, roomCreateModResult.matchedTerm ?? "unknown", "room-title");
        return res.status(422).json({ flagged: true, message: `Room title wasn't created — ${roomCreateModResult.message.replace("Your content", "it")}` });
      }

      const existingRooms = await storage.getRoomsByOwner(ownerId);
      if (existingRooms.length > 0) {
        const activeRooms = existingRooms.filter((r) => (r.activeUsers ?? 0) > 0);
        if (activeRooms.length > 0) {
          return res.status(400).json({ message: "You can only host one room at a time. Please close your existing room first." });
        }
        // All existing rooms are empty (activeUsers=0) — they're stuck in the
        // deletion grace window but are invisible in the lobby. Delete them now
        // so the user isn't permanently blocked from creating a new room.
        await Promise.all(existingRooms.map((r) => storage.deleteRoom(r.id)));
        broadcastRooms().catch(() => {});
      }

      const room = await storage.createRoom({
        title: parsed.data.title,
        language: parsed.data.language,
        level: parsed.data.level,
        maxUsers: parsed.data.maxUsers ?? 8,
        isPublic: parsed.data.isPublic ?? true,
        roomTheme: parsed.data.roomTheme || "default",
        hologramVideoUrl: parsed.data.hologramVideoUrl || null,
        ownerId,
      });

      io.emit("room:created", room);
      broadcastRooms().catch(() => {});
      // Auto-delete the room if the owner never enters it via socket.
      // When they do join, cancelRoomDeleteTimer is called inside the
      // join-room socket handler. ROOM_CREATE_GRACE_MS gives the creator
      // 5 minutes to click "Join & Talk" — enough time for any user flow.
      startRoomDeleteTimer(room.id, ROOM_CREATE_GRACE_MS);
      res.json(room);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/rooms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const roomId = req.params.id;
      const userId = (req.user as any).id;
      const room = await storage.getRoom(roomId);
      if (!room) return res.status(404).json({ message: "Room not found" });
      if (room.ownerId !== userId) return res.status(403).json({ message: "Only the host can edit this room" });

      const { title, language, level, maxUsers, roomTheme, isPublic, hologramVideoUrl, welcomeMessage, welcomeMediaUrls, welcomeMediaTypes, welcomeMediaPosition, welcomeAccentColor, talkPermission, cameraPermission, screenPermission, youtubePermission, chatPermission } = req.body;

      // ── Content moderation ─────────────────────────────────────────────────
      const _ruUser = await storage.getUser(userId);
      const roomUpdateModResult = checkFields({ title, welcomeMessage }, "room-settings", { userId, displayName: _ruUser?.displayName ?? undefined, avatarUrl: _ruUser?.profileImageUrl ?? undefined });
      if (roomUpdateModResult.flagged) {
        const fieldLabel = roomUpdateModResult.field === "title" ? "room title" : "welcome message";
        const ruUserId = (req as any).user?.id ?? "unknown";
        recordStrike(ruUserId, title ?? ruUserId, roomUpdateModResult.matchedTerm ?? "unknown", "room-settings");
        return res.status(422).json({
          flagged: true,
          field: roomUpdateModResult.field,
          message: `Your ${fieldLabel} wasn't saved — ${roomUpdateModResult.message.replace("Your content", "it")}`,
        });
      }

      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (language) updateData.language = language;
      if (level) updateData.level = level;
      if (maxUsers !== undefined && maxUsers !== null) updateData.maxUsers = maxUsers;
      if (roomTheme !== undefined) {
        const roomThemesEnabledRaw = await storage.getSetting("room_themes_enabled");
        if (roomThemesEnabledRaw === "false") {
          return res.status(403).json({ message: "Room themes are currently disabled by the platform." });
        }
        updateData.roomTheme = roomTheme;
      }
      if (isPublic !== undefined && typeof isPublic === "boolean") updateData.isPublic = isPublic;
      if (hologramVideoUrl !== undefined) updateData.hologramVideoUrl = hologramVideoUrl;
      if (welcomeMessage !== undefined) updateData.welcomeMessage = welcomeMessage;
      if (welcomeMediaUrls !== undefined) updateData.welcomeMediaUrls = Array.isArray(welcomeMediaUrls) ? welcomeMediaUrls : [];
      if (welcomeMediaTypes !== undefined) updateData.welcomeMediaTypes = Array.isArray(welcomeMediaTypes) ? welcomeMediaTypes : [];
      if (welcomeMediaPosition !== undefined) updateData.welcomeMediaPosition = welcomeMediaPosition;
      if (welcomeAccentColor !== undefined) updateData.welcomeAccentColor = welcomeAccentColor;
      if (talkPermission !== undefined && ["everyone", "members", "co_owners", "owner_only", "muted"].includes(talkPermission)) {
        updateData.talkPermission = talkPermission;
      }
      if (cameraPermission !== undefined && ["everyone", "members", "co_owners", "owner_only"].includes(cameraPermission)) {
        updateData.cameraPermission = cameraPermission;
      }
      if (screenPermission !== undefined && ["everyone", "members", "co_owners", "owner_only"].includes(screenPermission)) {
        updateData.screenPermission = screenPermission;
      }
      if (youtubePermission !== undefined && ["everyone", "members", "co_owners", "owner_only"].includes(youtubePermission)) {
        updateData.youtubePermission = youtubePermission;
      }
      if (chatPermission !== undefined && ["everyone", "members", "co_owners", "owner_only"].includes(chatPermission)) {
        updateData.chatPermission = chatPermission;
      }

      const updated = await storage.updateRoom(roomId, updateData);
      io.emit("room:updated", updated);
      broadcastRooms().catch(() => {});

      // When theme changes away from disco, kill DJ mode for all users in the room
      // and reset the overlay scene index so the next disco session starts fresh.
      if (updateData.roomTheme !== undefined && room.roomTheme === "disco" && updateData.roomTheme !== "disco") {
        roomDjSceneIdx.delete(roomId);
        roomDiscoOverlaySceneIdx.delete(roomId);
        io.to(roomId).emit("room:dj-mode", { active: false, scene: "spotlight", overlaySceneIdx: 0 });
      }
      // When switching TO disco, initialise the overlay scene at 0
      if (updateData.roomTheme === "disco" && room.roomTheme !== "disco") {
        roomDiscoOverlaySceneIdx.set(roomId, 0);
        io.to(roomId).emit("room:disco-advance", { sceneIdx: 0 });
      }

      if (updateData.welcomeMessage !== undefined && updateData.welcomeMessage) {
        const rawMsg = updateData.welcomeMessage;
        const mediaUrls = updateData.welcomeMediaUrls ?? updated.welcomeMediaUrls ?? [];
        const mediaTypes = updateData.welcomeMediaTypes ?? updated.welcomeMediaTypes ?? [];
        const mediaPosition = updateData.welcomeMediaPosition ?? updated.welcomeMediaPosition ?? "below";
        const accentColor = updateData.welcomeAccentColor ?? updated.welcomeAccentColor ?? "#8B5CF6";
        const participants = roomParticipants.get(roomId);
        if (participants && participants.size > 0 && rawMsg.match(/@username/i)) {
          for (const [participantId, participantUser] of Array.from(participants.entries())) {
            const socketId = userSockets.get(participantId);
            if (!socketId) continue;
            const name = (participantUser as any).displayName || (participantUser as any).firstName || (participantUser as any).email?.split("@")[0] || "there";
            const personalizedMsg = rawMsg.replace(/@username/gi, `@${name}`);
            io.to(socketId).emit("room:welcome-message", {
              welcomeMessage: personalizedMsg,
              welcomeMediaUrls: mediaUrls,
              welcomeMediaTypes: mediaTypes,
              welcomeMediaPosition: mediaPosition,
              welcomeAccentColor: accentColor,
            });
          }
        } else {
          io.to(roomId).emit("room:welcome-message", {
            welcomeMessage: rawMsg,
            welcomeMediaUrls: mediaUrls,
            welcomeMediaTypes: mediaTypes,
            welcomeMediaPosition: mediaPosition,
            welcomeAccentColor: accentColor,
          });
        }
      }

      // Announce host control changes to the room chat as system messages so
      // every participant sees who tightened or relaxed each control.
      const host = await storage.getUser(userId).catch(() => null);
      const hostName = host ? getDisplayName(host) : "The host";
      const labelTalk = (v: string) =>
        v === "everyone" ? "everyone" :
        v === "members" ? "members only (guests & trolls muted)" :
        v === "co_owners" ? "hosts & co-hosts only" :
        v === "owner_only" ? "host only" :
        v === "muted" ? "silent room (text only)" : v;
      const labelFeat = (v: string) =>
        v === "everyone" ? "everyone" :
        v === "members" ? "members only (no guests or trolls)" :
        v === "co_owners" ? "hosts & co-hosts only" :
        v === "owner_only" ? "host only" : v;
      if (updateData.chatPermission && updateData.chatPermission !== (room as any).chatPermission) {
        emitSystemChatMsg(data.roomId, `💬 ${hostName} set who can send messages to ${labelFeat(updateData.chatPermission)}.`);
      }
      if (updateData.talkPermission && updateData.talkPermission !== room.talkPermission) {
        emitSystemChatMsg(roomId, `🎙️ ${hostName} set who can use the mic to ${labelTalk(updateData.talkPermission)}.`);
      }
      if (updateData.cameraPermission && updateData.cameraPermission !== (room as any).cameraPermission) {
        emitSystemChatMsg(roomId, `📹 ${hostName} set who can open camera to ${labelFeat(updateData.cameraPermission)}.`);
      }
      if (updateData.screenPermission && updateData.screenPermission !== (room as any).screenPermission) {
        emitSystemChatMsg(roomId, `🖥️ ${hostName} set who can share screen to ${labelFeat(updateData.screenPermission)}.`);
      }
      if (updateData.youtubePermission && updateData.youtubePermission !== (room as any).youtubePermission) {
        emitSystemChatMsg(roomId, `📺 ${hostName} set who can play YouTube to ${labelFeat(updateData.youtubePermission)}.`);
      }
      if (updateData.title && updateData.title !== room.title) {
        emitSystemChatMsg(roomId, `✏️ ${hostName} renamed the room to "${updateData.title}".`);
      }
      if (updateData.maxUsers && updateData.maxUsers !== room.maxUsers) {
        const cap = updateData.maxUsers === 0 ? "unlimited" : String(updateData.maxUsers);
        emitSystemChatMsg(roomId, `👥 ${hostName} changed max participants to ${cap}.`);
      }
      if (updateData.roomTheme && updateData.roomTheme !== room.roomTheme) {
        emitSystemChatMsg(roomId, `🎨 ${hostName} changed the room theme.`);
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/rooms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const roomId = req.params.id;
      const userId = (req.user as any).id;
      const room = await storage.getRoom(roomId);
      if (!room) return res.status(404).json({ message: "Room not found" });
      if (room.ownerId !== userId) return res.status(403).json({ message: "Only the room owner can delete this room" });

      // Notify all connected participants before wiping data
      io.to(roomId).emit("room:host-deleted", { roomId });

      // Evict all participants from in-memory state
      const participants = roomParticipants.get(roomId);
      if (participants) {
        for (const participantId of Array.from(participants.keys())) {
          userCurrentRoom.delete(participantId);
        }
        roomParticipants.delete(roomId);
      }

      // Cancel any pending auto-delete timer
      cancelRoomDeleteTimer(roomId);

      // Clear all in-memory room state
      roomVideoStatus.delete(roomId);
      roomScreenShareStatus.delete(roomId);
      roomYoutubeState.delete(roomId);
      roomYoutubeQueue.delete(roomId);
      roomBookState.delete(roomId);
      roomRoles.delete(roomId);
      roomMuteStatus.delete(roomId);
      roomMessageReactions.delete(roomId);

      // Delete all persistent data (messages, votes, room record)
      await storage.deleteRoom(roomId);
      // Notify ALL lobby clients (not just room participants) that the room is gone.
      io.emit("room:deleted", { roomId });
      broadcastRooms().catch(() => {});

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/rooms/:id/knock", isAuthenticated, async (req: any, res) => {
    try {
      const roomId = req.params.id;
      const requesterId = (req.user as any).id;
      const room = await storage.getRoom(roomId);
      if (!room) return res.status(404).json({ message: "Room not found" });
      if (room.ownerId === requesterId) return res.status(400).json({ message: "You own this room" });

      // Progressive cooldown gate: check denial history before allowing another knock.
      const denialKey = `${roomId}:${requesterId}`;
      const history = knockDenials.get(denialKey);
      if (history) {
        if (history.count >= MAX_KNOCK_DENIALS) {
          return res.status(429).json({ message: "You have been permanently blocked from knocking on this room.", banned: true, denialCount: history.count });
        }
        if (Date.now() < history.cooldownUntil) {
          return res.status(429).json({ message: "You must wait before knocking again.", cooldownUntil: history.cooldownUntil, denialCount: history.count, banned: false });
        }
      }

      // Knocks are IN-ROOM only — no persistent notification, no global toast.
      // The host sees the Allow / Deny prompt while they are inside the room
      // (or, if they happen to be browsing the lobby with a socket, they'll
      // get the in-room style prompt only). We deliberately skip
      // storage.createNotification + admin:notification here so the host's
      // notification bell stays clean.
      const ownerSocketId = userSockets.get(room.ownerId);

      // Push a real-time knock prompt directly to the host's personal socket
      // so they can Allow / Deny whether they are inside the room or browsing
      // the lobby. Targeting ownerSocketId (not the room channel) means we
      // never broadcast to every room participant and the host gets exactly
      // one prompt no matter where they are.
      const requester = await storage.getUser(requesterId);
      if (requester && ownerSocketId) {
        io.to(ownerSocketId).emit("room:knock-request", {
          roomId,
          fromUserId: requesterId,
          fromUserName:
            (requester as any).displayName ||
            [requester.firstName, requester.lastName].filter(Boolean).join(" ") ||
            (requester as any).username ||
            requester.email ||
            "Someone",
          fromUserAvatar: requester.profileImageUrl || null,
          ts: Date.now(),
        });
      }

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/rooms/:id/welcome-media", isAuthenticated, uploadWelcomeMedia.single("media"), async (req: any, res) => {
    try {
      const roomId = req.params.id;
      const userId = (req.user as any).id;
      const room = await storage.getRoom(roomId);
      if (!room) return res.status(404).json({ message: "Room not found" });
      if (room.ownerId !== userId) return res.status(403).json({ message: "Only the host can upload welcome media" });
      if (!req.file) return res.status(400).json({ message: "Upload an image or GIF file." });
      const url = `/uploads/${req.file.filename}`;
      const type = req.file.mimetype === "image/gif" ? "gif" : "image";
      res.json({ url, type });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/messages/unread/count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const count = await storage.getUnreadMessageCount(userId);
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/messages/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/messages/read/:otherUserId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.markConversationRead(userId, req.params.otherUserId);
      // Notify the original sender that their messages have been seen
      const senderSocketId = userSockets.get(req.params.otherUserId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("dm:read", { readerId: userId });
      }
      // Notify the reader themselves (all their connected tabs/voice-room windows)
      // so that any open room's participant-card badge clears immediately, even
      // if the messages were read from the lobby header rather than from inside
      // the room's DM panel.
      const readerSocketId = userSockets.get(userId);
      if (readerSocketId) {
        io.to(readerSocketId).emit("dm:read-self", { otherUserId: req.params.otherUserId });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/messages/:userId1/:userId2", isAuthenticated, async (req: any, res) => {
    try {
      const requestingUserId = (req.user as any).id;
      const userId1 = Array.isArray(req.params.userId1) ? req.params.userId1[0] : req.params.userId1;
      const userId2 = Array.isArray(req.params.userId2) ? req.params.userId2[0] : req.params.userId2;
      // Access control: only allow participants of the conversation to read it.
      if (requestingUserId !== userId1 && requestingUserId !== userId2) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const limit = Math.min(Number(req.query.limit) || 200, 500);
      const msgs = await storage.getMessages(userId1, userId2, limit);
      res.json(msgs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const sendMessageBody = insertMessageSchema;

  // ── Message Requests ─────────────────────────────────────────────────────

  app.get("/api/message-requests/pending", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const requests = await storage.getPendingMessageRequests(userId);
      // Attach sender user data
      const senderIds = requests.map((r) => r.fromId);
      const usersMap = senderIds.length > 0 ? await storage.getUsersByIds(senderIds) : new Map();
      const result = requests.map((r) => ({ ...r, fromUser: usersMap.get(r.fromId) ?? null }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/message-requests/status/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const me = String((req.user as any).id);
      const other = String(req.params.userId);

      const [iFollowThem, theyFollowMe] = await Promise.all([
        storage.isFollowing(me, other),
        storage.isFollowing(other, me),
      ]);
      const iMutual = iFollowThem && theyFollowMe;

      // Message request lookups — non-fatal; degrade gracefully if table issues
      let sentReq = null as any;
      let receivedReq = null as any;
      try {
        [sentReq, receivedReq] = await Promise.all([
          storage.getMessageRequest(me, other),
          storage.getMessageRequest(other, me),
        ]);
      } catch (_) { /* table may not exist yet in some envs */ }

      res.json({
        canDm: iMutual,
        isMutual: iMutual,
        iFollowThem,
        theyFollowMe,
        sentRequest: sentReq ?? null,
        receivedRequest: receivedReq ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/message-requests", isAuthenticated, async (req: any, res) => {
    try {
      const me = (req.user as any).id;
      const { toId } = req.body as { toId: string };
      if (!toId || toId === me) return res.status(400).json({ message: "Invalid request" });

      // Must follow them (one-way minimum)
      const doesFollow = await storage.isFollowing(me, toId);
      if (!doesFollow) return res.status(403).json({ message: "You must follow this user to send a message request." });

      // Already mutual — no request needed
      const mutual = await storage.isFollowing(toId, me);
      if (mutual) return res.status(400).json({ message: "You can message this user directly." });

      const request = await storage.createMessageRequest(me, toId);

      // Notify recipient via socket (all their tabs via personal room)
      const fromUser = await storage.getUser(me);
      io.to(`user:${toId}`).emit("message_request:new", { ...request, fromUser });

      res.json(request);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/message-requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const me = (req.user as any).id;
      const { status } = req.body as { status: "accepted" | "declined" };
      if (!["accepted", "declined"].includes(status)) {
        return res.status(400).json({ message: "status must be 'accepted' or 'declined'" });
      }

      const pending = await storage.getPendingMessageRequests(me);
      const request = pending.find((r) => r.id === req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found or already actioned" });

      const updated = await storage.updateMessageRequestStatus(req.params.id, status);

      // Notify sender via socket (all their tabs via personal room)
      io.to(`user:${request.fromId}`).emit("message_request:updated", updated);

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/messages", isAuthenticated, messageRateLimiter, async (req, res) => {
    try {
      const parsed = sendMessageBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid message data" });
      }

      // ── Relationship gate ──────────────────────────────────────────────────
      const senderId = parsed.data.fromId;
      const recipientId = parsed.data.toId;

      const [senderFollowsRecipient, recipientFollowsSender] = await Promise.all([
        storage.isFollowing(senderId, recipientId),
        storage.isFollowing(recipientId, senderId),
      ]);

      const isMutual = senderFollowsRecipient && recipientFollowsSender;

      if (!isMutual) {
        // Check if an accepted message request exists
        if (senderFollowsRecipient) {
          const req2 = await storage.getMessageRequest(senderId, recipientId);
          if (!req2 || req2.status !== "accepted") {
            return res.status(403).json({
              message: "Send a message request first. The user must accept before you can message them.",
              code: "REQUEST_REQUIRED",
            });
          }
        } else {
          return res.status(403).json({
            message: "You can only message users who mutually follow you.",
            code: "NO_RELATIONSHIP",
          });
        }
      }

      const sender = await storage.getUser(parsed.data.fromId);
      if (isUserRestricted(sender)) {
        return res.status(403).json({
          message: sender?.restrictedReason || "Your account is temporarily restricted from sending messages.",
          restrictedUntil: sender?.restrictedUntil,
        });
      }

      // ── Content moderation ─────────────────────────────────────────────────
      const dmMuteStatus = isStrikeMuted(parsed.data.fromId);
      if (dmMuteStatus.muted) {
        return res.status(429).json({ flagged: true, muted: true, message: dmMuteStatus.message });
      }
      const _dmUser = await storage.getUser(parsed.data.fromId);
      const dmModResult = checkContent(parsed.data.text, "dm", { userId: parsed.data.fromId, displayName: _dmUser?.displayName ?? undefined, avatarUrl: _dmUser?.profileImageUrl ?? undefined });
      if (dmModResult.flagged) {
        const dmSender2 = await storage.getUser(parsed.data.fromId);
        const dmDn = dmSender2?.displayName ?? dmSender2?.firstName ?? parsed.data.fromId;
        const dmStrike = recordStrike(parsed.data.fromId, dmDn, dmModResult.matchedTerm ?? "unknown", "dm");
        const dmMsg = dmStrike.action === "mute" ? dmStrike.message : dmModResult.message;
        return res.status(422).json({ flagged: true, muted: dmStrike.action === "mute", message: dmMsg });
      }

      const msg = await storage.createMessage(parsed.data);
      // Deliver to all open tabs of both sender and recipient via personal rooms
      io.to(`user:${parsed.data.toId}`).emit("dm:new", msg);
      io.to(`user:${parsed.data.fromId}`).emit("dm:new", msg);
      // Web push only if the recipient is fully offline (no socket at all)
      if (!userSockets.has(parsed.data.toId)) {
        const dmSender = await storage.getUser(parsed.data.fromId);
        void notifyDmPush(parsed.data.fromId, parsed.data.toId, dmSender);
      }
      res.json(msg);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/follows/following/:userId", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.getFollowing(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/follows/followers/:userId", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.getFollowers(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:userId/stats", async (req, res) => {
    try {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const [followers, following] = await Promise.all([
        storage.getFollowers(userId),
        storage.getFollowing(userId),
      ]);
      const followerIds = new Set(followers.map((f: any) => f.followerId));
      const followingIds = new Set(following.map((f: any) => f.followingId));
      const friends = [...followerIds].filter((id) => followingIds.has(id)).length;
      res.json({ followers: followers.length, following: following.length, friends });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/follows/counts", async (req, res) => {
    try {
      const { userIds } = req.body;
      if (!Array.isArray(userIds)) {
        return res.status(400).json({ message: "userIds must be an array" });
      }
      const counts = await storage.getFollowerCounts(userIds);
      res.json(counts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/follows", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertFollowSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid follow data" });
      }

      const follow = await storage.createFollow(parsed.data);
      await storage.createNotification({
        userId: parsed.data.followingId,
        fromUserId: parsed.data.followerId,
        type: "follow",
      });

      // Real-time follow event — lets any open DM view instantly upgrade
      // from "Follow back to chat" to the full chat UI without a page reload.
      const followPayload = { followerId: parsed.data.followerId, followingId: parsed.data.followingId };
      // Deliver to all open tabs via personal rooms so both lobby and room tabs update
      io.to(`user:${parsed.data.followingId}`).emit("user:followed", followPayload);
      io.to(`user:${parsed.data.followerId}`).emit("user:followed", followPayload);
      io.to(`user:${parsed.data.followingId}`).emit("notification:new", { type: "follow" });

      // Push notification to the followed user if the follow is not mutual
      // (i.e. the person being followed hasn't followed back yet)
      (async () => {
        try {
          const isMutual = await storage.isFollowing(parsed.data.followingId, parsed.data.followerId);
          if (!isMutual) {
            void notifyNewFollowerPush(parsed.data.followerId, parsed.data.followingId);
          }
        } catch { /* non-critical */ }
      })();

      // Email notification — fire-and-forget, non-blocking
      (async () => {
        try {
          const smtpUser = process.env.SMTP_USER;
          const smtpPass = process.env.SMTP_PASS;
          if (smtpUser && smtpPass) {
            const [follower, followed] = await Promise.all([
              storage.getUser(parsed.data.followerId),
              storage.getUser(parsed.data.followingId),
            ]);
            if (followed?.email) {
              const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: smtpUser, pass: smtpPass } });
              await transporter.sendMail({
                from: `"Vextorn" <${smtpUser}>`,
                to: followed.email,
                subject: `${follower?.displayName || "Someone"} started following you on Vextorn`,
                html: `<div style="font-family:sans-serif;max-width:600px;margin:auto"><p>Hi ${followed.displayName || "there"},</p><p><strong>${follower?.displayName || "Someone"}</strong> just followed you on Vextorn. Head over to your profile to connect!</p><p><a href="https://vextorn.app" style="color:#f59e0b">Open Vextorn</a></p></div>`,
                text: `${follower?.displayName || "Someone"} just followed you on Vextorn. Head over to https://vextorn.app to connect!`,
              });
            }
          }
        } catch { /* non-critical */ }
      })();

      res.json(follow);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/follows/:followerId/:followingId", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteFollow(Array.isArray(req.params.followerId) ? req.params.followerId[0] : req.params.followerId, Array.isArray(req.params.followingId) ? req.params.followingId[0] : req.params.followingId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/blocks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const ids = await storage.getBlockedIds(userId);
      res.json(ids);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/blocks/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const rows = await storage.getBlocksByBlocker(userId);
      const userMap = await storage.getUsersByIds(rows.map(r => r.blockedId));
      const usersWithType = rows
        .map(r => {
          const u = userMap.get(r.blockedId);
          if (!u) return null;
          return { ...u, blockType: r.blockType };
        })
        .filter(Boolean);
      res.json(usersWithType);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/blocks", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertBlockSchema.safeParse({ ...req.body, blockType: req.body.blockType || "ordinary" });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid block data" });
      }
      const block = await storage.createBlock(parsed.data);
      res.json(block);

      const blockerId = (req.user as any).id;
      const blockedId = parsed.data.blockedId;
      const blockType = parsed.data.blockType || "ordinary";

      const blockerSocketId = userSockets.get(blockerId);
      const blockedSocketId = userSockets.get(blockedId);
      if (blockerSocketId) io.to(blockerSocketId).emit("user:blocked", { otherId: blockedId, blockType });
      if (blockedSocketId) io.to(blockedSocketId).emit("user:blocked", { otherId: blockerId, blockType });

      const blockerRoomId = userCurrentRoom.get(blockerId);
      if (blockerRoomId) {
        const [blockerUser, blockedUser] = await Promise.all([
          storage.getUser(blockerId),
          storage.getUser(blockedId),
        ]);
        if (blockerUser && blockedUser) {
          const msg = {
            id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            roomId: blockerRoomId,
            userId: "system",
            text: `${getDisplayName(blockerUser)} blocked ${getDisplayName(blockedUser)}`,
            type: "system",
            createdAt: new Date().toISOString(),
            reactions: {},
            replyTo: null,
          };
          io.to(blockerRoomId).emit("room:chat-message", msg);
        }
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/blocks/:blockedId", isAuthenticated, async (req: any, res) => {
    try {
      const callerId = (req.user as any).id;
      const otherId = Array.isArray(req.params.blockedId) ? req.params.blockedId[0] : req.params.blockedId;
      await storage.deleteBlock(callerId, otherId);
      res.json({ ok: true });

      const callerSocketId = userSockets.get(callerId);
      const otherSocketId = userSockets.get(otherId);
      if (callerSocketId) io.to(callerSocketId).emit("user:unblocked", { otherId });
      if (otherSocketId) io.to(otherSocketId).emit("user:unblocked", { otherId: callerId });

      const callerRoomId = userCurrentRoom.get(callerId);
      if (callerRoomId) {
        const [callerUser, otherUser] = await Promise.all([
          storage.getUser(callerId),
          storage.getUser(otherId),
        ]);
        if (callerUser && otherUser) {
          const msg = {
            id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            roomId: callerRoomId,
            userId: "system",
            text: `${getDisplayName(callerUser)} unblocked ${getDisplayName(otherUser)}`,
            type: "system",
            createdAt: new Date().toISOString(),
            reactions: {},
            replyTo: null,
          };
          io.to(callerRoomId).emit("room:chat-message", msg);
        }
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const SUPER_ADMIN_EMAIL = "dj55jggg@gmail.com";

  const isAdmin = async (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser((req.user as any).id);
    if (user?.email === SUPER_ADMIN_EMAIL && user.role !== "superadmin") {
      await storage.setUserRole(user.id, "superadmin");
      return next();
    }
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  const isSuperAdmin = async (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser((req.user as any).id);
    if (user?.email === SUPER_ADMIN_EMAIL && user.role !== "superadmin") {
      await storage.setUserRole(user.id, "superadmin");
      return next();
    }
    if (!user || user.role !== "superadmin") {
      return res.status(403).json({ message: "Super admin access required" });
    }
    next();
  };

  // ── Cleanup / Storage admin endpoints ───────────────────────────────────
  // ── Client-side page view tracking ────────────────────────────────────────
  // SPA route changes don't trigger a server HTML request, so the middleware
  // in index.ts only captures the initial load. This endpoint lets the client
  // report route changes directly so analytics reflect actual navigation.
  app.post("/api/analytics/pageview", async (req: any, res) => {
    try {
      const { path: pvPath, referrer } = req.body || {};
      if (!pvPath || typeof pvPath !== "string") return res.status(400).json({ message: "path required" });
      const { createHash } = await import("crypto");
      const ip = ((req.headers["x-forwarded-for"] as string) || (req.headers["x-real-ip"] as string) || "").split(",")[0].trim();
      const ua = (req.headers["user-agent"] || "").slice(0, 200);
      const sessionHash = createHash("sha256").update(`${ip}::${ua}`).digest("hex").slice(0, 32);
      let referrerDomain = "";
      if (referrer) {
        try { referrerDomain = new URL(referrer).hostname.replace(/^www\./, ""); } catch {}
      }
      // Only store referrer if it's genuinely external (different origin than app)
      const origin = `${req.protocol}://${req.get("host")}`;
      const isExternalReferrer = referrer && !referrer.startsWith(origin);
      const country = await detectCountry(req.headers);
      const pageViewUserId = req.isAuthenticated?.() ? (req as any).user?.id : undefined;
      await storage.recordPageView({
        path: pvPath.slice(0, 255),
        referrer: isExternalReferrer && typeof referrer === "string" ? referrer.slice(0, 500) : undefined,
        referrerDomain: isExternalReferrer && referrerDomain ? referrerDomain.slice(0, 120) : undefined,
        country,
        sessionHash,
        userId: pageViewUserId ?? undefined,
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/analytics", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
      const data = await storage.getAnalytics(days);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Web Push: VAPID public key ─────────────────────────────────────────────
  app.get("/api/push/vapid-public-key", (_req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) return res.status(503).json({ publicKey: null });
    res.json({ publicKey });
  });

  // ── Web Push: subscribe ────────────────────────────────────────────────────
  app.post("/api/push/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const { endpoint, p256dh, auth } = req.body;
      if (!endpoint || !p256dh || !auth) {
        return res.status(400).json({ message: "endpoint, p256dh, and auth are required." });
      }
      await storage.savePushSubscription((req.user as any).id, { endpoint, p256dh, auth });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Web Push: unsubscribe ──────────────────────────────────────────────────
  app.delete("/api/push/unsubscribe", isAuthenticated, async (req: any, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ message: "endpoint is required." });
      await storage.deletePushSubscription(endpoint);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Web Push: room-join notification preference ────────────────────────────
  app.patch("/api/push/room-join-notify-pref", isAuthenticated, async (req: any, res) => {
    try {
      const { pref } = req.body;
      if (!["everyone", "mutual", "none"].includes(pref)) {
        return res.status(400).json({ message: "pref must be 'everyone', 'mutual', or 'none'." });
      }
      await storage.setRoomJoinNotifyPref((req.user as any).id, pref);
      res.json({ success: true, pref });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Web Push: per-user notification preferences ───────────────────────────
  // Returns all explicit per-user prefs for the current user as a map
  app.get("/api/push/muted-users", isAuthenticated, async (req: any, res) => {
    try {
      const prefs = await storage.getAllNotifPrefs((req.user as any).id);
      res.json(prefs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get prefs for a specific user pair
  app.get("/api/push/notif-prefs/:targetUserId", isAuthenticated, async (req: any, res) => {
    try {
      const myId = (req.user as any).id;
      const { targetUserId } = req.params;
      const prefs = await storage.getNotifPrefsForPair(myId, targetUserId);
      res.json(prefs ?? { notifyRoomJoin: null, notifyDm: null });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Upsert prefs for a specific user pair
  app.patch("/api/push/notif-prefs/:targetUserId", isAuthenticated, async (req: any, res) => {
    try {
      const myId = (req.user as any).id;
      const { targetUserId } = req.params;
      if (myId === targetUserId) return res.status(400).json({ message: "Cannot set prefs for yourself." });
      const { notifyRoomJoin, notifyDm } = req.body;
      if (typeof notifyRoomJoin !== "boolean" || typeof notifyDm !== "boolean") {
        return res.status(400).json({ message: "notifyRoomJoin and notifyDm must be booleans." });
      }
      await storage.upsertNotifPrefs(myId, targetUserId, notifyRoomJoin, notifyDm);
      res.json({ success: true, notifyRoomJoin, notifyDm });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Delete explicit prefs (revert to global preference)
  app.delete("/api/push/notif-prefs/:targetUserId", isAuthenticated, async (req: any, res) => {
    try {
      const myId = (req.user as any).id;
      const { targetUserId } = req.params;
      await storage.deleteNotifPrefs(myId, targetUserId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Web Push: subscriber count (admin) ────────────────────────────────────
  app.get("/api/admin/push/subscriber-count", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const count = await storage.getPushSubscriberCount();
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/push/subscribers", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const subscribers = await storage.getPushSubscribersWithUsers();
      res.json(subscribers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Web Push: image upload (admin) ────────────────────────────────────────
  app.post("/api/admin/push/upload-image", isAuthenticated, isSuperAdmin, uploadRateLimiter, uploadPushImage.single("image"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No image file provided or invalid type." });
      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Web Push: admin broadcast ─────────────────────────────────────────────
  app.post("/api/admin/push/send", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { title, body, url, imageUrl: pushImageUrl } = req.body;
      if (!title?.trim() || !body?.trim()) {
        return res.status(400).json({ message: "title and body are required." });
      }
      const vapidPublic = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
      if (!vapidPublic || !vapidPrivate) {
        return res.status(503).json({ message: "VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in secrets." });
      }
      webpush.setVapidDetails("mailto:hello@vextorn.app", vapidPublic, vapidPrivate);

      const subs = await storage.getAllPushSubscriptions();
      let sent = 0;
      let failed = 0;
      const payload = JSON.stringify({ title, body, url: url || "/", image: pushImageUrl?.trim() || undefined });

      await Promise.allSettled(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
            sent++;
          } catch (err: any) {
            failed++;
            // 410 Gone = subscription expired/removed; clean it up
            if (err.statusCode === 410) {
              await storage.deletePushSubscription(sub.endpoint).catch(() => {});
            }
          }
        })
      );

      res.json({ success: true, sent, failed, total: subs.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Outreach: email broadcast ──────────────────────────────────────────────
  app.post("/api/admin/outreach/email", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { subject, body, recipientType, customEmails, imageUrl } = req.body;
      if (!subject?.trim() || !body?.trim()) {
        return res.status(400).json({ message: "Subject and body are required." });
      }

      const smtpUser = process.env.SMTP_USER || "vextornweb@gmail.com";
      const smtpPass = process.env.SMTP_PASS;
      if (!smtpPass) {
        return res.status(503).json({ message: "Gmail App Password not configured. Set SMTP_PASS in your environment secrets." });
      }

      let recipients: string[] = [];

      if (recipientType === "all_registered") {
        const allUsers = await storage.getAllUsers();
        recipients = allUsers.map((u) => u.email).filter(Boolean) as string[];
      } else if (recipientType === "custom") {
        const raw = (customEmails || "") as string;
        recipients = raw
          .split(/[\n,;]+/)
          .map((e: string) => e.trim())
          .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      }

      if (recipients.length === 0) {
        return res.status(400).json({ message: "No valid recipient email addresses found." });
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: smtpUser, pass: smtpPass },
      });

      const adminId = (req.user as any).id;
      const campaign = await storage.createEmailCampaign({
        subject,
        body,
        recipientType,
        recipientCount: recipients.length,
        adminId,
      });

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const trackingPixel = `<img src="${baseUrl}/t/o/${campaign.id}.gif" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`;

      function wrapLinksForTracking(text: string, cid: string, base: string): string {
        return text.replace(/https?:\/\/[^\s<>"]+[^\s<>".,!?;:)]/g, (url) =>
          `${base}/t/c/${cid}?url=${encodeURIComponent(url)}`
        );
      }

      const trackedBody = wrapLinksForTracking(body.replace(/\n/g, "<br>"), campaign.id, baseUrl);
      const imageBlock = imageUrl?.trim()
        ? `<img src="${imageUrl.trim()}" alt="" style="display:block;width:100%;max-width:600px;border-radius:8px;margin:16px 0" />`
        : "";
      const htmlBody = `<div style="font-family:sans-serif;max-width:600px;margin:auto">${trackedBody}${imageBlock}${trackingPixel}</div>`;
      const textBody = body;

      const chunkSize = 50;
      let sent = 0;
      for (let i = 0; i < recipients.length; i += chunkSize) {
        const chunk = recipients.slice(i, i + chunkSize);
        await transporter.sendMail({
          from: `"Vextorn" <${smtpUser}>`,
          replyTo: "hello@vextorn.app",
          bcc: chunk,
          subject,
          html: htmlBody,
          text: textBody,
        });
        sent += chunk.length;
      }

      res.json({ success: true, sent, total: recipients.length, campaignId: campaign.id });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Outreach: in-app push notification broadcast ───────────────────────────
  app.post("/api/admin/outreach/notification", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { title, message, targetType, userId } = req.body;
      if (!title?.trim() || !message?.trim()) {
        return res.status(400).json({ message: "Title and message are required." });
      }

      let delivered = 0;

      if (targetType === "all_online") {
        io.emit("admin:broadcast_notification", { title, message });
        delivered = io.sockets.sockets.size;
      } else if (targetType === "all_registered") {
        const adminId = (req.user as any).id;
        const allUsers = await storage.getAllUsers();
        for (const u of allUsers) {
          try {
            await storage.createNotification({
              userId: u.id,
              type: `platform_broadcast:${title}`,
              fromUserId: adminId,
            });
          } catch {}
        }
        io.emit("admin:broadcast_notification", { title, message });
        delivered = allUsers.length;
      } else if (targetType === "specific_user" && userId) {
        const adminId = (req.user as any).id;
        const sockets = await io.fetchSockets();
        for (const s of sockets) {
          if ((s as any).data?.userId === userId) {
            s.emit("admin:broadcast_notification", { title, message });
            delivered++;
          }
        }
        try {
          await storage.createNotification({
            userId,
            type: `platform_broadcast:${title}`,
            fromUserId: adminId,
          });
        } catch {}
        if (delivered === 0) delivered = 1;
      }

      res.json({ success: true, delivered });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/cleanup/stats", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      res.json(getCleanupStats());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/cleanup/run", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const record = await runCleanupNow();
      res.json({ record, stats: getCleanupStats() });
    } catch (err: any) {
      res.status(409).json({ message: err.message });
    }
  });

  app.post("/api/admin/announcements/media", isAuthenticated, isSuperAdmin, uploadAnnouncementMedia.single("media"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Upload an image or GIF file." });
      const url = `/uploads/${req.file.filename}`;
      const type = req.file.mimetype === "image/gif" ? "gif" : "image";
      res.json({ url, type });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid report data" });
      }
      const { reporterName, reportedName, category, reason } = req.body;
      const report = await storage.createReport({ ...parsed.data, reporterName, reportedName, category });
      try {
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        if (smtpUser && smtpPass) {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: smtpUser, pass: smtpPass },
          });
          await transporter.sendMail({
            from: smtpUser,
            to: "bagpetrosyan@gmail.com",
            subject: `Vextorn Report: ${reporterName || "User"} reported ${reportedName || "User"}`,
            html: `
              <h2>New User Report</h2>
              <p><strong>Reporter:</strong> ${reporterName || parsed.data.reporterId}</p>
              <p><strong>Reported:</strong> ${reportedName || parsed.data.reportedId}</p>
              <p><strong>Category:</strong> ${category || "Not specified"}</p>
              <p><strong>Reason:</strong> ${reason || parsed.data.reason || "Not specified"}</p>
              <hr/>
              <p><small>Report ID: ${report.id} | Time: ${new Date().toISOString()}</small></p>
            `,
          });
        }
      } catch (mailErr) {
        console.error("Failed to send report email:", mailErr);
      }
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/reports", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const allReports = await storage.getAllReports();
      res.json(allReports);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/reports/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!["pending", "reviewed", "dismissed"].includes(status)) {
        return res.status(400).json({ message: "Invalid report status" });
      }
      const updated = await storage.updateReport(req.params.id, { status });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/reports/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteReport(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/reports", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "ids array is required" });
      }
      await storage.deleteReportsBulk(ids);
      res.json({ ok: true, deleted: ids.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/warn/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const admin = await storage.getUser((req.user as any).id);
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.role === "superadmin") {
        return res.status(403).json({ message: "Platform Owner cannot be warned" });
      }
      if (target.role === "admin" && admin?.role !== "superadmin") {
        return res.status(403).json({ message: "Only the Platform Owner can warn admins" });
      }
      const warned = await storage.warnUser(userId);
      await storage.createNotification({
        userId,
        fromUserId: (req.user as any).id,
        type: "admin_warning",
      });
      const socketId = userSockets.get(userId);
      if (socketId) {
        io.to(socketId).emit("admin:warning", {
          message: req.body.message || "You’ve received a warning from Admin. Continued violations may lead to restrictions.",
        });
        io.to(socketId).emit("admin:notification", { type: "admin_warning" });
      }
      res.json(warned);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/warn/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      const updated = await storage.removeWarning(userId);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/grant", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { userId, role } = req.body;
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Use 'admin' or 'user'." });
      }
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.email === SUPER_ADMIN_EMAIL && role !== "superadmin") {
        return res.status(403).json({ message: "Platform Owner role cannot be removed" });
      }
      const updated = await storage.setUserRole(userId, role);
      await storage.createNotification({
        userId,
        fromUserId: (req.user as any).id,
        type: role === "admin" ? "admin_promotion" : "admin_removed",
      });
      const socketId = userSockets.get(userId);
      if (socketId) {
        io.to(socketId).emit("admin:role-updated", { role });
        io.to(socketId).emit("admin:notification", {
          type: role === "admin" ? "admin_promotion" : "admin_removed",
        });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const admin = await storage.getUser((req.user as any).id);
      const canSeeEmails = admin?.role === "superadmin" || admin?.email === SUPER_ADMIN_EMAIL;
      const allUsers = await storage.getAllUsers();
      res.json(canSeeEmails ? allUsers : allUsers.map((user) => ({ ...user, email: null })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/users/lookup", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.query as { id?: string };
      if (!id || !id.trim()) return res.status(400).json({ message: "id query param required" });
      const admin = await storage.getUser((req.user as any).id);
      const canSeeEmails = admin?.role === "superadmin" || admin?.email === SUPER_ADMIN_EMAIL;
      const found = await storage.getUser(id.trim());
      if (!found) return res.status(404).json({ message: "User not found" });
      res.json(canSeeEmails ? found : { ...found, email: null });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/users/:userId/restrict", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { days = 1, reason = "Restricted by Platform Owner" } = req.body;
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.role === "superadmin" || target.email === SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Platform Owner cannot be restricted" });
      }
      const restrictionDays = Math.min(365, Math.max(1, Number(days) || 1));
      const restrictedUntil = new Date(Date.now() + restrictionDays * 24 * 60 * 60 * 1000);
      const updated = await storage.restrictUser(userId, {
        restrictedUntil,
        restrictedReason: String(reason).slice(0, 500),
        restrictedById: (req.user as any).id,
      });
      const adminId = (req.user as any).id;
      const socketId = userSockets.get(userId);
      if (socketId) {
        io.to(socketId).emit("admin:restricted", {
          restrictedUntil,
          reason: updated?.restrictedReason,
        });
        io.to(socketId).emit("admin:notification", { type: "admin_restriction" });
      }
      await storage.createNotification({ userId, fromUserId: adminId, type: "admin_restriction" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/users/:userId/restrict", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const adminId = (req.user as any).id;
      const updated = await storage.restrictUser(userId, {
        restrictedUntil: null,
        restrictedReason: null,
        restrictedById: null,
      });
      const socketId = userSockets.get(userId);
      if (socketId) {
        io.to(socketId).emit("admin:restriction-lifted");
        io.to(socketId).emit("admin:notification", { type: "admin_restriction_lifted" });
      }
      await storage.createNotification({ userId, fromUserId: adminId, type: "admin_restriction_lifted" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/users/:userId", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const requesterId = (req.user as any).id;
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (userId === requesterId) return res.status(403).json({ message: "You cannot delete your own account here" });
      if (target.role === "admin" || target.role === "superadmin" || target.email === SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Admins and the Platform Owner cannot be deleted" });
      }

      const targetRooms = await storage.getRoomsByOwner(userId);
      for (const room of targetRooms) {
        const timer = roomDeleteTimers.get(room.id);
        if (timer) clearTimeout(timer);
        roomDeleteTimers.delete(room.id);
        roomParticipants.delete(room.id);
        roomVideoStatus.delete(room.id);
        roomScreenShareStatus.delete(room.id);
        roomYoutubeState.delete(room.id);
        roomBookState.delete(room.id);
        roomRoles.delete(room.id);
        roomMuteStatus.delete(room.id);
        roomMessageReactions.delete(room.id);
        // Broadcast to ALL clients (including lobby watchers) so the room card
        // disappears instantly instead of waiting for the next SSE/refetch.
        // Previously this used io.to(room.id) which only reached users already
        // inside the room socket — lobby viewers never received the event.
        io.emit("room:deleted", { roomId: room.id });
      }

      const socketId = userSockets.get(userId);
      if (socketId) {
        io.to(socketId).emit("admin:account-deleted");
        io.sockets.sockets.get(socketId)?.disconnect(true);
      }
      onlineUsers.delete(userId);
      userSockets.delete(userId);
      userCurrentRoom.delete(userId);
      const timer = disconnectTimers.get(userId);
      if (timer) clearTimeout(timer);
      disconnectTimers.delete(userId);

      await storage.deleteUser(userId);
      io.emit("presence:online", Array.from(onlineUsers));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/badges/award", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, badgeType } = req.body;
      if (!userId || !badgeType) return res.status(400).json({ message: "userId and badgeType required" });
      if (!(badgeType in BADGE_TYPES)) return res.status(400).json({ message: "Invalid badge type" });

      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const badge = await storage.awardBadge({
        userId,
        badgeType,
        awardedById: (req.user as any).id,
      });

      const badgeDef = BADGE_TYPES[badgeType as keyof typeof BADGE_TYPES];
      const targetName = target.displayName || [target.firstName, target.lastName].filter(Boolean).join(" ") || target.email || "A user";

      const badgeAwardPayload = {
        badge,
        badgeDef,
        userName: targetName,
        userAvatar: target.profileImageUrl,
        userId: target.id,
        quote: badgeDef.quote,
      };
      io.emit("badge:awarded", badgeAwardPayload);
      emitBadgeChatToAllActiveRooms({
        badgeUserId: target.id,
        badgeUserName: targetName,
        badgeUserAvatar: target.profileImageUrl,
        badgeEmoji: badgeDef.emoji,
        badgeLabel: badgeDef.label,
        badgeColor: badgeDef.color,
        badgeQuote: badgeDef.quote,
      });

      try {
        await storage.createNotification({ userId, fromUserId: (req.user as any).id, type: `badge_awarded:${badgeType}` });
        const userSocketId = userSockets.get(userId);
        if (userSocketId) {
          io.to(userSocketId).emit("admin:notification", { type: "badge_awarded", badge: badgeAwardPayload });
        }
      } catch (_) {}

      res.json(badge);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/badges", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const userIds = allUsers.map(u => u.id);
      const badgesByUser = await storage.getBadgesForUsers(userIds);
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const userBadgeList: any[] = [];
      for (const [uid, badges] of Object.entries(badgesByUser)) {
        if (badges.length === 0) continue;
        const u = userMap.get(uid);
        userBadgeList.push(...badges.map((b) => ({ ...b, userName: u?.displayName || u?.email || uid, userAvatar: u?.profileImageUrl })));
      }
      res.json(userBadgeList);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/badges/:badgeId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.removeBadge(req.params.badgeId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id/badges", async (req, res) => {
    try {
      const badges = await storage.getUserBadges(req.params.id);
      // Badges change rarely — allow browsers/CDNs to serve stale for 30s,
      // revalidate in the background for up to 5 minutes.
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
      res.json(badges);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/users/badges/batch", async (req: any, res) => {
    try {
      const { userIds } = req.body;
      if (!Array.isArray(userIds)) return res.status(400).json({ message: "userIds must be an array" });
      const uniqueIds = Array.from(new Set(userIds.filter((id) => typeof id === "string"))).slice(0, 100);
      res.json(await storage.getBadgesForUsers(uniqueIds));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/badge-applications/my", isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getBadgeApplications((req.user as any).id));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/badge-applications", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertBadgeApplicationSchema.safeParse({
        ...req.body,
        userId: (req.user as any).id,
      });
      if (!parsed.success) return res.status(400).json({ message: "Invalid badge application data" });
      if (!(parsed.data.badgeType in BADGE_TYPES)) return res.status(400).json({ message: "Invalid badge type" });
      const reason = parsed.data.reason.trim();
      if (reason.length < 10) return res.status(400).json({ message: "Please share a little more about why you are applying." });
      const existing = await storage.getBadgeApplicationByUserAndType(parsed.data.userId, parsed.data.badgeType);
      if (existing?.status === "pending") {
        return res.status(400).json({ message: "You already have a pending application for this badge." });
      }
      const application = await storage.createBadgeApplication({
        ...parsed.data,
        reason: reason.slice(0, 1000),
      });
      res.json(application);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/badge-applications", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const applications = await storage.getBadgeApplications();
      const userMap = await storage.getUsersByIds(applications.map(a => a.userId));
      const enriched = applications.map((application) => {
        const applicant = userMap.get(application.userId);
        return {
          ...application,
          userName: applicant ? getDisplayName(applicant) : "Unknown user",
          userAvatar: applicant?.profileImageUrl ?? null,
        };
      });
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/badge-applications/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status, adminNotes } = req.body;
      if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });
      const application = await storage.updateBadgeApplication(req.params.id, {
        status,
        adminNotes: adminNotes || null,
        reviewedById: (req.user as any).id,
      });
      if (!application) return res.status(404).json({ message: "Application not found" });
      if (status === "approved") {
        const target = await storage.getUser(application.userId);
        if (target) {
          const badge = await storage.awardBadge({
            userId: application.userId,
            badgeType: application.badgeType,
            awardedById: (req.user as any).id,
          });
          const badgeDef = BADGE_TYPES[application.badgeType as keyof typeof BADGE_TYPES];
          const targetName = getDisplayName(target);
          const appBadgePayload = {
            badge,
            badgeDef,
            userName: targetName,
            userAvatar: target.profileImageUrl,
            userId: target.id,
            quote: badgeDef.quote,
          };
          io.emit("badge:awarded", appBadgePayload);
          emitBadgeChatToAllActiveRooms({
            badgeUserId: target.id,
            badgeUserName: targetName,
            badgeUserAvatar: target.profileImageUrl,
            badgeEmoji: badgeDef.emoji,
            badgeLabel: badgeDef.label,
            badgeColor: badgeDef.color,
            badgeQuote: badgeDef.quote,
          });
          try {
            await storage.createNotification({ userId: application.userId, fromUserId: (req.user as any).id, type: `badge_awarded:${application.badgeType}` });
            const userSocketId = userSockets.get(application.userId);
            if (userSocketId) {
              io.to(userSocketId).emit("admin:notification", { type: "badge_awarded", badge: appBadgePayload });
            }
          } catch (_) {}
        }
      }
      res.json(application);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/security-events", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const unresolvedOnly = req.query.unresolved === "true";
      const limit = Math.min(parseInt(req.query.limit as string ?? "200", 10) || 200, 500);
      const events = await storage.getSecurityEvents(limit, unresolvedOnly);
      const userIds = [...new Set(events.filter(e => e.userId).map(e => e.userId as string))];
      const userMap = userIds.length > 0 ? await storage.getUsersByIds(userIds) : new Map();
      const enriched = events.map((e) => ({
        ...e,
        userName: e.userId ? (userMap.get(e.userId) ? getDisplayName(userMap.get(e.userId)!) : "Unknown user") : null,
        userAvatar: e.userId ? (userMap.get(e.userId)?.profileImageUrl ?? null) : null,
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/security-events/count", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const count = await storage.getUnresolvedSecurityEventCount();
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/security-events/:id/resolve", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const event = await storage.resolveSecurityEvent(req.params.id, (req.user as any).id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/announcements", async (req: any, res) => {
    try {
      const userId = typeof req.isAuthenticated === "function" && req.isAuthenticated() ? (req.user as any).id : undefined;
      // Announcement content is public; dismissed/viewed state is per-user but
      // that only affects badge display, not the payload. Safe to cache briefly.
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
      res.json(await storage.getPublishedAnnouncements(5, userId, true));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/announcements/viewed", isAuthenticated, async (req: any, res) => {
    try {
      const announcementIds = z.array(z.string()).max(20).safeParse(req.body.announcementIds);
      if (!announcementIds.success) return res.status(400).json({ message: "announcementIds must be an array." });
      const userId = (req.user as any).id;
      const marked: string[] = [];
      for (const announcementId of Array.from(new Set(announcementIds.data))) {
        const announcement = await storage.getAnnouncement(announcementId);
        if (announcement?.status === "published") {
          await storage.markAnnouncementViewed(announcementId, userId);
          marked.push(announcementId);
        }
      }
      res.json({ ok: true, marked });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/announcements/:id/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      const announcement = await storage.getAnnouncement(req.params.id);
      if (!announcement || announcement.status !== "published") {
        return res.status(404).json({ message: "Announcement not found" });
      }
      const receipt = await storage.dismissAnnouncement(req.params.id, (req.user as any).id);
      res.json(receipt);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/announcements", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      res.json(await storage.getAnnouncements());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const emitAnnouncementChatToAllActiveRooms = (announcement: any) => {
    for (const [roomId, participants] of roomParticipants.entries()) {
      if (participants.size > 0) {
        const msg = {
          id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          roomId,
          userId: "system",
          text: announcement.title || "",
          type: "announcement" as const,
          createdAt: new Date().toISOString(),
          reactions: {},
          replyTo: null,
          announcementTitle: announcement.title,
          announcementBody: announcement.body,
          announcementBodyAfterMedia: announcement.bodyAfterMedia || null,
          announcementMediaUrls: announcement.mediaUrls || [],
          announcementMediaTypes: announcement.mediaTypes || [],
          announcementMediaPosition: announcement.mediaPosition || "below",
          announcementKind: announcement.kind || "platform",
        };
        io.to(roomId).emit("room:chat-message", msg);
      }
    }
  };

  const broadcastAnnouncement = async (announcement: any) => {
    const event = {
      ...announcement,
      message: announcement.body,
      from: "Admin",
      createdAt: announcement.createdAt instanceof Date ? announcement.createdAt.toISOString() : announcement.createdAt,
      publishedAt: announcement.publishedAt instanceof Date ? announcement.publishedAt.toISOString() : announcement.publishedAt,
    };
    io.emit("admin:announcement", event);
    emitAnnouncementChatToAllActiveRooms(announcement);
  };

  app.post("/api/admin/announcements", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const parsed = insertAnnouncementSchema.safeParse({
        ...req.body,
        createdById: (req.user as any).id,
        mediaUrls: Array.isArray(req.body.mediaUrls) ? req.body.mediaUrls : [],
        mediaTypes: Array.isArray(req.body.mediaTypes) ? req.body.mediaTypes : [],
      });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid announcement data" });
      }
      if (parsed.data.mediaUrls.length !== parsed.data.mediaTypes.length) {
        return res.status(400).json({ message: "Each media attachment must include a media type." });
      }
      const announcement = await storage.createAnnouncement(parsed.data);
      if (announcement.status === "published") {
        await broadcastAnnouncement(announcement);
      }
      res.status(201).json(announcement);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/announcements/:id", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const existing = await storage.getAnnouncement(req.params.id);
      if (!existing) return res.status(404).json({ message: "Announcement not found" });
      const parsed = insertAnnouncementSchema.partial().safeParse({
        title: req.body.title,
        body: req.body.body,
        bodyAfterMedia: req.body.bodyAfterMedia ?? existing.bodyAfterMedia,
        mediaPosition: req.body.mediaPosition ?? existing.mediaPosition ?? "below",
        kind: req.body.kind,
        status: req.body.status,
        createdById: existing.createdById,
        mediaUrls: Array.isArray(req.body.mediaUrls) ? req.body.mediaUrls : existing.mediaUrls,
        mediaTypes: Array.isArray(req.body.mediaTypes) ? req.body.mediaTypes : existing.mediaTypes,
        showOnLobby: req.body.showOnLobby !== undefined ? Boolean(req.body.showOnLobby) : existing.showOnLobby,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid announcement data" });
      }
      const nextStatus = parsed.data.status || existing.status;
      const wasPublished = existing.status === "published";
      const willPublishNow = nextStatus === "published" && !wasPublished;
      const updated = await storage.updateAnnouncement(req.params.id, {
        ...parsed.data,
        status: nextStatus,
        publishedAt: willPublishNow ? new Date() : existing.publishedAt,
      });
      if (!updated) return res.status(404).json({ message: "Announcement not found" });
      if (willPublishNow) {
        await broadcastAnnouncement(updated);
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/announcements/:id", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      await storage.deleteAnnouncement(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/announcements/broadcast", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const message = String(req.body.message || "").trim();
      const kind = String(req.body.kind || "platform").trim();
      if (!message) return res.status(400).json({ message: "Announcement message is required" });
      const admin = await storage.getUser((req.user as any).id);
      const announcement = {
        id: `announcement-${Date.now()}`,
        message: message.slice(0, 1000),
        kind,
        from: admin ? getDisplayName(admin) : "Platform Owner",
        createdAt: new Date().toISOString(),
      };
      io.emit("admin:announcement", announcement);
      emitSystemChatToAllActiveRooms(`📣 ${announcement.from}: ${announcement.message}`);
      res.json(announcement);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: AI Tutor config ────────────────────────────────────────────────
  app.get("/api/admin/ai-config", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const cfg = await getAiTutorConfig();
      res.json({
        config: maskConfig(cfg),
        hasKeys: {
          elevenlabs: !!cfg.elevenlabs.apiKeys.trim(),
          openai: !!cfg.openai.apiKey.trim(),
          huggingface: !!cfg.huggingface.apiKey.trim(),
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/ai-config", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const incoming = req.body?.config as Partial<AiTutorConfig>;
      if (!incoming) return res.status(400).json({ message: "config required" });
      const current = await getAiTutorConfig();
      const merged = mergeIncoming(current, incoming);
      await setAiTutorConfig(merged);
      res.json({ ok: true, config: maskConfig(merged) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/ai-config/test", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      // Accept an optional live config from the request body so the admin can
      // test unsaved settings. Falls back to the persisted config if not provided.
      const incoming = req.body?.config as Partial<AiTutorConfig> | undefined;
      const saved = await getAiTutorConfig();
      // Merge incoming over saved so masked keys are preserved from the DB.
      const cfg = incoming ? mergeIncoming(saved, incoming) : saved;

      const testText = "Hello! Eva here. The AI Tutor voice is working perfectly.";

      if (cfg.provider === "browser") {
        return res.json({ ok: true, provider: "browser", message: "Browser TTS is active — no server-side test needed. Eva will speak using the browser's built-in speech synthesis." });
      }

      let result: { ok: boolean; status: number; contentType: string; body?: ArrayBuffer; error?: string };

      if (cfg.provider === "elevenlabs") {
        const dbKeys = cfg.elevenlabs.apiKeys.trim();
        if (!dbKeys && !isElevenLabsConfigured()) {
          return res.status(501).json({ ok: false, error: "No ElevenLabs API keys configured. Add an API key in the ElevenLabs Settings section above." });
        }
        const voiceId = cfg.elevenlabs.voiceId || "XB0fDUnXU5powFXDhCwa";
        // Guard: voice IDs are never API keys — they look like "XB0fDUnXU5powFXDhCwa"
        // ElevenLabs keys start with "sk_" and are long. Warn admins if they mixed them up.
        if (/^sk_[A-Za-z0-9]{20,}/.test(voiceId)) {
          return res.status(400).json({ ok: false, error: "The Voice ID field contains what looks like an API key (starts with sk_). Please enter a voice ID (e.g. XB0fDUnXU5powFXDhCwa) in the Voice ID field and put your API key in the API Keys field." });
        }
        if (dbKeys) {
          const key = dbKeys.split(",")[0].trim();
          const modelId = cfg.elevenlabs.modelId || "eleven_multilingual_v2";
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 15_000);
          try {
            const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
              method: "POST",
              headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
              body: JSON.stringify({ text: testText, model_id: modelId, voice_settings: { stability: 0.4, similarity_boost: 0.85 } }),
              signal: controller.signal,
            });
            result = r.ok
              ? { ok: true, status: 200, contentType: "audio/mpeg", body: await r.arrayBuffer() }
              : { ok: false, status: r.status, contentType: "", error: `ElevenLabs ${r.status}: ${await r.text().catch(() => "")}` };
          } finally { clearTimeout(t); }
        } else {
          result = await elevenLabsSynthesize({ text: testText, voice: "Eva", speed: 1.0, language: "en" });
        }
      } else if (cfg.provider === "openai") {
        if (!cfg.openai.apiKey) {
          return res.status(501).json({ ok: false, error: "No OpenAI API key configured. Add your key in the OpenAI TTS Settings section above." });
        }
        result = await openAiSynthesize(testText, cfg.openai.voice, cfg.openai.model, cfg.openai.apiKey);
      } else if (cfg.provider === "huggingface") {
        if (!cfg.huggingface.apiKey) {
          return res.status(501).json({ ok: false, error: "No Hugging Face API token configured. Add your HF token in the Hugging Face Settings section above." });
        }
        result = await huggingFaceSynthesize(testText, cfg.huggingface.model, cfg.huggingface.apiKey);
      } else {
        return res.status(400).json({ ok: false, error: "Unknown TTS provider" });
      }

      if (!result.ok || !result.body) {
        return res.status(result.status >= 500 ? 502 : result.status || 400).json({ ok: false, error: result.error });
      }

      res.setHeader("Content-Type", result.contentType || "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Encoding", "identity");
      res.send(Buffer.from(result.body));
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Maintenance mode ─────────────────────────────────────────────────────
  app.get("/api/maintenance", async (_req, res) => {
    try {
      const value = await storage.getSetting("maintenance_mode");
      // Maintenance mode changes extremely rarely — cache for 30 s with a
      // 1-hour stale-while-revalidate window so repeat visits are instant.
      // This removes the endpoint from the Lighthouse "Use efficient cache
      // lifetimes" audit while still reflecting mode changes within 30 s.
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=3600");
      res.json({ active: value === "true" });
    } catch {
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=3600");
      res.json({ active: false });
    }
  });

  app.get("/api/admin/settings/maintenance", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const value = await storage.getSetting("maintenance_mode");
      res.json({ active: value === "true" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/settings/maintenance", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { active } = req.body;
      if (typeof active !== "boolean") return res.status(400).json({ message: "active must be boolean" });
      await storage.setSetting("maintenance_mode", active ? "true" : "false");
      res.json({ ok: true, active });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Book Teacher visibility ───────────────────────────────────────────────
  app.get("/api/settings/book-teacher", async (_req, res) => {
    try {
      const value = await storage.getSetting("book_teacher_hidden");
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=3600");
      res.json({ visible: value !== "true" });
    } catch {
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=3600");
      res.json({ visible: true });
    }
  });

  app.get("/api/admin/settings/book-teacher", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const value = await storage.getSetting("book_teacher_hidden");
      res.json({ hidden: value === "true" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/settings/book-teacher", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { hidden } = req.body;
      if (typeof hidden !== "boolean") return res.status(400).json({ message: "hidden must be boolean" });
      await storage.setSetting("book_teacher_hidden", hidden ? "true" : "false");
      res.json({ ok: true, hidden });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/elevate-super", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user || user.email !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const elevated = await storage.setUserRole(user.id, "superadmin");
      res.json(elevated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/rooms/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const roomId = req.params.id;
      await storage.addVote(roomId, userId);
      io.emit("room:votes-updated", { roomId });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/rooms/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const roomId = req.params.id;
      await storage.removeVote(roomId, userId);
      io.emit("room:votes-updated", { roomId });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/rooms/votes/batch", async (req: any, res) => {
    try {
      const { roomIds } = req.body;
      if (!Array.isArray(roomIds)) return res.status(400).json({ message: "roomIds must be an array" });
      const counts = await storage.getVoteCounts(roomIds);
      const userId = req.user?.id;
      const userVotes = userId ? await storage.getUserVotes(userId, roomIds) : {};
      res.json({ counts, userVotes });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const notifs = await storage.getNotifications(userId);
      res.json(notifs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/notifications/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.markNotificationsRead(userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/notes/:subjectId", isAuthenticated, async (req: any, res) => {
    try {
      const authorId = (req.user as any).id;
      const { subjectId } = req.params;
      const note = await storage.getUserNote(authorId, subjectId);
      res.json({ note: note?.note ?? "" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/notes/:subjectId", isAuthenticated, async (req: any, res) => {
    try {
      const authorId = (req.user as any).id;
      const { subjectId } = req.params;
      const { note } = req.body;
      if (typeof note !== "string") return res.status(400).json({ message: "note must be a string" });
      const result = await storage.upsertUserNote(authorId, subjectId, note.slice(0, 1000));
      res.json({ note: result.note });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/room-messages/:roomId", async (req, res) => {
    try {
      const msgs = await storage.getRoomMessages(Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId);
      res.json(msgs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const getDisplayName = (u: User) =>
    u.displayName || (u.firstName ? `${u.firstName}${u.lastName ? " " + u.lastName : ""}`.trim() : null) || (u.email ? u.email.split("@")[0] : "User");

  const emitSystemChatMsg = (roomId: string, text: string) => {
    const msg = {
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      roomId,
      userId: "system",
      text,
      type: "system" as const,
      createdAt: new Date().toISOString(),
      reactions: {},
      replyTo: null,
    };
    io.to(roomId).emit("room:chat-message", msg);
  };

  const emitSystemChatToAllActiveRooms = (text: string) => {
    for (const [roomId, participants] of roomParticipants.entries()) {
      if (participants.size > 0) emitSystemChatMsg(roomId, text);
    }
  };

  const STREAK_MILESTONES: Array<{ days: number; badgeType: string }> = [
    { days: 3,  badgeType: "streak_3"  },
    { days: 7,  badgeType: "streak_7"  },
    { days: 14, badgeType: "streak_14" },
    { days: 30, badgeType: "streak_30" },
  ];

  async function checkAndAwardStreakBadge(userId: string) {
    try {
      const streak = await storage.getUserJoinStreak(userId);
      if (streak === 0) return;

      for (const { days, badgeType } of STREAK_MILESTONES) {
        if (streak < days) continue;
        const already = await storage.hasUserBadge(userId, badgeType);
        if (already) continue;

        const user = await storage.getUser(userId);
        if (!user) continue;

        const badge = await storage.awardBadge({ userId, badgeType, awardedById: "system" });
        const badgeDef = BADGE_TYPES[badgeType as keyof typeof BADGE_TYPES];
        const userName = user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "A user";

        const badgeAwardPayload = {
          badge,
          badgeDef,
          userName,
          userAvatar: user.profileImageUrl,
          userId: user.id,
          quote: badgeDef.quote,
        };
        io.emit("badge:awarded", badgeAwardPayload);
        emitBadgeChatToAllActiveRooms({
          badgeUserId: user.id,
          badgeUserName: userName,
          badgeUserAvatar: user.profileImageUrl,
          badgeEmoji: badgeDef.emoji,
          badgeLabel: badgeDef.label,
          badgeColor: badgeDef.color,
          badgeQuote: badgeDef.quote,
        });

        try {
          await storage.createNotification({ userId, fromUserId: "system", type: `badge_awarded:${badgeType}` });
          const userSocketId = userSockets.get(userId);
          if (userSocketId) {
            io.to(userSocketId).emit("admin:notification", { type: "badge_awarded", badge: badgeAwardPayload });
          }
        } catch (_) {}

        console.log(`[streak] Awarded ${badgeType} to user ${userId} (streak=${streak})`);
      }
    } catch (err: any) {
      console.error("[streak] checkAndAwardStreakBadge failed:", err?.message || err);
    }
  }

  const emitBadgeChatToAllActiveRooms = (payload: {
    badgeUserId: string;
    badgeUserName: string;
    badgeUserAvatar?: string | null;
    badgeEmoji: string;
    badgeLabel: string;
    badgeColor: string;
    badgeQuote: string;
  }) => {
    setTimeout(() => {
      for (const [roomId, participants] of roomParticipants.entries()) {
        if (participants.size > 0) {
          const msg = {
            id: `badge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            roomId,
            userId: "system",
            text: `${payload.badgeEmoji} ${payload.badgeUserName} was awarded ${payload.badgeLabel}`,
            type: "badge" as const,
            createdAt: new Date().toISOString(),
            reactions: {},
            replyTo: null,
            badgeUserId: payload.badgeUserId,
            badgeUserName: payload.badgeUserName,
            badgeUserAvatar: payload.badgeUserAvatar || null,
            badgeEmoji: payload.badgeEmoji,
            badgeLabel: payload.badgeLabel,
            badgeColor: payload.badgeColor,
            badgeQuote: payload.badgeQuote,
          };
          io.to(roomId).emit("room:chat-message", msg);
        }
      }
    }, 2500);
  };

  function cancelRoomDeleteTimer(roomId: string) {
    const timer = roomDeleteTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      roomDeleteTimers.delete(roomId);
    }
  }

  // Grace period for an empty room before it's auto-deleted.
  // 60s covers network blips, mobile-app backgrounding, tab sleeping, and
  // quick re-joins without letting truly-abandoned rooms linger forever.
  const ROOM_EMPTY_GRACE_MS = 60_000;
  // Grace at server startup — clients need to socket-reconnect and re-emit
  // `room:join` to repopulate the in-memory participants map. 90s is generous
  // for slow mobile reconnects and Replit cold-start latency.
  const ROOM_STARTUP_GRACE_MS = 90_000;
  // Grace for a brand-new room — the creator still needs to read the toast,
  // scroll to their room card, and click "Join & Talk". 5 minutes is generous
  // enough for any user flow without letting abandoned created rooms pile up.
  const ROOM_CREATE_GRACE_MS = 5 * 60 * 1000;

  function startRoomDeleteTimer(roomId: string, graceMs: number = ROOM_EMPTY_GRACE_MS) {
    cancelRoomDeleteTimer(roomId);
    const timer = setTimeout(async () => {
      try {
        const participants = roomParticipants.get(roomId);
        // Triple-check before destroying:
        // 1. In-memory participants map is empty
        // 2. Socket.IO adapter has no live sockets subscribed to this room
        //    (catches reconnecting sockets that haven't re-emitted room:join yet)
        // 3. No user claims this room as their current room
        const adapterRoom = (io.sockets.adapter.rooms as Map<string, Set<string>>).get(roomId);
        const adapterSize = adapterRoom ? adapterRoom.size : 0;
        const claimedByUser = Array.from(userCurrentRoom.entries()).some(([, rId]) => rId === roomId);

        if ((!participants || participants.size === 0) && adapterSize === 0 && !claimedByUser) {
          await storage.deleteRoom(roomId);
          roomParticipants.delete(roomId);
          roomDeleteTimers.delete(roomId);
          io.emit("room:deleted", { roomId });
          broadcastRooms().catch(() => {});
          console.log(`[room-cleanup] Deleted empty room ${roomId} after ${Math.round(graceMs / 1000)}s grace`);
        } else {
          // Room still has activity — cancel (don't re-schedule; a future leave
          // or disconnect will call startRoomDeleteTimer again if needed).
          roomDeleteTimers.delete(roomId);
          console.log(`[room-cleanup] Skipped deletion of ${roomId}: participants=${participants?.size ?? 0} adapterSockets=${adapterSize} claimedByUser=${claimedByUser}`);
        }
      } catch (err) {
        console.error("Error auto-deleting room:", err);
      }
    }, graceMs);
    roomDeleteTimers.set(roomId, timer);
  }

  // ── Teachers ──────────────────────────────────────────────────────────────
  app.get("/api/teachers", async (_req, res) => {
    try {
      const all = await storage.getAllTeachers();
      // Teacher list changes infrequently — serve stale for 60s, revalidate
      // for up to 10 minutes, so returning users get instant responses.
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=600");
      res.json(all);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/teachers/:id", async (req, res) => {
    try {
      const teacher = await storage.getTeacher(req.params.id as string);
      if (!teacher) return res.status(404).json({ message: "Teacher not found" });
      res.json(teacher);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/teachers", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { insertTeacherSchema } = await import("@shared/schema");
      const parsed = insertTeacherSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const teacher = await storage.createTeacher(parsed.data);
      res.json(teacher);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/teachers/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateTeacher(req.params.id as string, req.body);
      if (!updated) return res.status(404).json({ message: "Teacher not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/teachers/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteTeacher(req.params.id as string);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Teacher Reviews ────────────────────────────────────────────────────────
  app.get("/api/teachers/:id/reviews", async (req, res) => {
    try {
      const reviews = await storage.getTeacherReviews(req.params.id as string);
      const userMap = await storage.getUsersByIds(reviews.map(r => r.userId));
      const reviewsWithUsers = reviews.map((r) => {
        const user = userMap.get(r.userId);
        return { ...r, user: user ? { id: user.id, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, profileImageUrl: user.profileImageUrl } : null };
      });
      res.json(reviewsWithUsers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/teachers/:id/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const teacherId = req.params.id as string;
      const already = await storage.hasUserReviewedTeacher(userId, teacherId);
      if (already) return res.status(400).json({ message: "You have already reviewed this teacher" });
      const { rating, comment } = req.body;
      if (typeof rating !== "number" || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      // ── Content moderation ─────────────────────────────────────────────────
      if (comment) {
        const _rvUser = await storage.getUser(userId);
        const reviewModResult = checkContent(comment, "review", { userId, displayName: _rvUser?.displayName ?? undefined, avatarUrl: _rvUser?.profileImageUrl ?? undefined });
        if (reviewModResult.flagged) {
          const rvUserId = (req as any).user?.id ?? "unknown";
          recordStrike(rvUserId, comment.slice(0, 30), reviewModResult.matchedTerm ?? "unknown", "review");
          return res.status(422).json({ flagged: true, message: reviewModResult.message });
        }
      }

      const review = await storage.createTeacherReview({ teacherId, userId, rating, comment });
      res.json(review);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Bookings ───────────────────────────────────────────────────────────────
  app.get("/api/bookings/my", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const userBookings = await storage.getBookingsByUser(userId);
      const allTeachers = await storage.getAllTeachers();
      const teacherMap = new Map(allTeachers.map(t => [t.id, t]));
      const enriched = userBookings.map((b) => ({ ...b, teacher: teacherMap.get(b.teacherId) ?? null }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bookings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { teacherId, scheduledAt, durationMinutes, sessionType, notes, paymentMethod, paymentMethodId } = req.body;
      if (!teacherId || !scheduledAt || !durationMinutes || !sessionType) {
        return res.status(400).json({ message: "Missing required booking fields" });
      }
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) return res.status(404).json({ message: "Teacher not found" });
      if (!teacher.isAvailable) return res.status(400).json({ message: "Teacher is not currently available" });
      const booking = await storage.createBooking({
        teacherId,
        userId,
        scheduledAt: new Date(scheduledAt),
        durationMinutes,
        sessionType,
        notes: notes || null,
      });

      // Create a transaction record for every booking
      const amountUsd = Math.round((teacher.hourlyRate * durationMinutes) / 60);
      const amountCents = amountUsd * 100;
      const PLATFORM_FEE_PCT = 0.15;
      const platformFee = Math.round(amountCents * PLATFORM_FEE_PCT);
      const teacherAmount = amountCents - platformFee;
      const method = paymentMethod || "card";
      // card payments are treated as immediately completed (simulated); idram/cash are pending
      const txStatus = method === "card" ? "completed" : method === "idram" ? "pending" : "pending_cash";
      const idramOrderId = method === "idram"
        ? `VX-${Date.now().toString(36).toUpperCase()}-${booking.id.slice(0, 6).toUpperCase()}`
        : null;

      await storage.createTransaction({
        bookingId: booking.id,
        userId,
        teacherId,
        amount: amountCents,
        currency: "USD",
        platformFee,
        teacherAmount,
        paymentMethod: method,
        paymentMethodId: paymentMethodId || null,
        status: txStatus,
        description: `Session with ${teacher.name} · ${durationMinutes} min · ${sessionType}`,
        idramOrderId,
      });

      // Email confirmation — fire-and-forget, non-blocking
      (async () => {
        try {
          const smtpUser = process.env.SMTP_USER;
          const smtpPass = process.env.SMTP_PASS;
          if (smtpUser && smtpPass) {
            const student = await storage.getUser(userId);
            const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: smtpUser, pass: smtpPass } });
            const sessionDate = new Date(scheduledAt).toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
            const amountDisplay = `$${(amountUsd).toFixed(2)}`;
            // Notify student
            if (student?.email) {
              await transporter.sendMail({
                from: `"Vextorn" <${smtpUser}>`,
                to: student.email,
                subject: `Your session with ${teacher.name} is confirmed!`,
                html: `<div style="font-family:sans-serif;max-width:600px;margin:auto"><h2 style="color:#f59e0b">Booking Confirmed</h2><p>Hi ${student.displayName || "there"},</p><p>Your <strong>${sessionType}</strong> session with <strong>${teacher.name}</strong> has been booked.</p><ul><li><strong>Date:</strong> ${sessionDate}</li><li><strong>Duration:</strong> ${durationMinutes} minutes</li><li><strong>Amount:</strong> ${amountDisplay}</li></ul>${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}<p><a href="https://vextorn.app" style="color:#f59e0b">Open Vextorn</a></p></div>`,
                text: `Booking confirmed! Session with ${teacher.name} on ${sessionDate} for ${durationMinutes} min (${amountDisplay}).`,
              });
            }
            // Notify teacher
            const teacherUser = teacher.userId ? await storage.getUser(teacher.userId) : null;
            if (teacherUser?.email) {
              await transporter.sendMail({
                from: `"Vextorn" <${smtpUser}>`,
                to: teacherUser.email,
                subject: `New booking: ${student?.displayName || "A student"} booked a session`,
                html: `<div style="font-family:sans-serif;max-width:600px;margin:auto"><h2 style="color:#f59e0b">New Booking</h2><p>Hi ${teacher.name},</p><p><strong>${student?.displayName || "A student"}</strong> has booked a <strong>${sessionType}</strong> session with you.</p><ul><li><strong>Date:</strong> ${sessionDate}</li><li><strong>Duration:</strong> ${durationMinutes} minutes</li><li><strong>Earnings:</strong> $${(teacherAmount / 100).toFixed(2)}</li></ul>${notes ? `<p><strong>Student notes:</strong> ${notes}</p>` : ""}<p><a href="https://vextorn.app" style="color:#f59e0b">Open Vextorn</a></p></div>`,
                text: `New booking from ${student?.displayName || "a student"} on ${sessionDate} for ${durationMinutes} min.`,
              });
            }
          }
        } catch { /* non-critical */ }
      })();

      res.json({ ...booking, idramOrderId });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/bookings/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const booking = await storage.getBooking(req.params.id as string);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Not authorized" });
      if (booking.status === "cancelled") return res.status(400).json({ message: "Booking already cancelled" });
      await storage.cancelBooking(booking.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Payment Methods ──────────────────────────────────────────────────────────
  app.get("/api/payment-methods", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const methods = await storage.getPaymentMethods(userId);
      res.json(methods);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/payment-methods", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      const { last4, brand, expMonth, expYear, cardholderName } = req.body;
      if (!last4 || !brand || !expMonth || !expYear || !cardholderName) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const pm = await storage.addPaymentMethod({ userId, last4: String(last4).slice(-4), brand, expMonth: Number(expMonth), expYear: Number(expYear), cardholderName });
      res.json(pm);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/payment-methods/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      await storage.deletePaymentMethod(req.params.id, userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/payment-methods/:id/default", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id || (req.user as any).claims?.sub;
      await storage.setDefaultPaymentMethod(req.params.id, userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Transactions ─────────────────────────────────────────────────────────────
  app.get("/api/transactions/my", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const txs = await storage.getTransactionsByUser(userId);
      res.json(txs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/transactions", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const [txs, stats] = await Promise.all([
        storage.getAllTransactions(300),
        storage.getTransactionStats(),
      ]);
      res.json({ transactions: txs, stats });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/transactions/:id/confirm", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const adminId = (req.user as any).id;
      const tx = await storage.updateTransactionStatus(req.params.id, "completed", adminId);
      if (!tx) return res.status(404).json({ message: "Transaction not found" });
      res.json(tx);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Theme Visibility Management ─────────────────────────────────────────────
  // Must stay in sync with THEMES array in client/src/lib/theme.tsx
  const ALL_THEME_IDS = [
    "none",
    "premium-atmosphere","plasma","neon","galaxy","sunset","forest",
    "cyberpunk","ocean","cherry","aurora","matrix","storm","volcanic",
    "disco","trap-gold","skeleton-gangsta","romance",
  ];

  app.get("/api/admin/themes", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const [visMap, assignments, roomThemesEnabledRaw] = await Promise.all([
        storage.getThemeVisibility(),
        storage.getAllUserThemeAssignments(),
        storage.getSetting("room_themes_enabled"),
      ]);
      const userAssignmentMap: Record<string, string[]> = {};
      for (const a of assignments) {
        if (!userAssignmentMap[a.userId]) userAssignmentMap[a.userId] = [];
        userAssignmentMap[a.userId].push(a.themeId);
      }
      const themes = ALL_THEME_IDS.map((id) => ({
        id,
        visible: id === "none" ? true : (visMap[id] !== false),
        canHide: id !== "none",
      }));
      const roomThemesEnabled = roomThemesEnabledRaw !== "false";
      res.json({ themes, userAssignments: userAssignmentMap, roomThemesEnabled });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/settings/room-themes", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") return res.status(400).json({ message: "enabled must be boolean" });
      await storage.setSetting("room_themes_enabled", enabled ? "true" : "false");
      res.json({ ok: true, enabled });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/themes/:themeId/visibility", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { themeId } = req.params;
      const { visible } = req.body;
      if (themeId === "none") return res.status(400).json({ message: "Cannot hide the default theme" });
      if (!ALL_THEME_IDS.includes(themeId)) return res.status(404).json({ message: "Unknown theme" });
      if (typeof visible !== "boolean") return res.status(400).json({ message: "visible must be boolean" });
      await storage.setThemeVisibility(themeId, visible);
      res.json({ themeId, visible });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/themes/user/:userId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const assigned = await storage.getUserThemeAssignments(req.params.userId);
      res.json({ userId: req.params.userId, themeIds: assigned });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/admin/themes/user/:userId", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { themeIds } = req.body;
      if (!Array.isArray(themeIds)) return res.status(400).json({ message: "themeIds must be an array" });
      const valid = themeIds.filter((id: unknown) => typeof id === "string" && ALL_THEME_IDS.includes(id) && id !== "none");
      await storage.setUserThemeAssignments(userId, valid);
      res.json({ userId, themeIds: valid });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/themes/available", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const [available, roomThemesEnabledRaw] = await Promise.all([
        storage.getAvailableThemesForUser(userId, ALL_THEME_IDS),
        storage.getSetting("room_themes_enabled"),
      ]);
      const roomThemesEnabled = roomThemesEnabledRaw !== "false";
      res.json({ themeIds: available, roomThemesEnabled });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Theme Orders (user requests for custom/new themes) ────────────────────
  app.post("/api/themes/order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id ?? (req.user as any).claims?.sub;
      const { themeName, description } = req.body;
      if (!themeName || typeof themeName !== "string" || themeName.trim().length < 2) {
        return res.status(400).json({ message: "Theme name must be at least 2 characters" });
      }
      if (!description || typeof description !== "string" || description.trim().length < 3) {
        return res.status(400).json({ message: "Description must be at least 3 characters" });
      }
      // Content moderation on the request fields
      const _orderUser = await storage.getUser(userId);
      const orderModResult = checkFields({ themeName, description }, "theme-request", { userId, displayName: _orderUser?.displayName ?? undefined, avatarUrl: _orderUser?.profileImageUrl ?? undefined });
      if (orderModResult.flagged) {
        recordStrike(userId, themeName ?? userId, orderModResult.matchedTerm ?? "unknown", "theme-request");
        return res.status(422).json({ flagged: true, message: orderModResult.message });
      }
      // Rate-limit: max 1 pending + max 3 per 24 hours
      const { pendingCount, last24hCount } = await storage.getUserThemeOrderStats(userId);
      if (pendingCount >= 1) {
        return res.status(429).json({ message: "You already have a pending request. Wait for it to be reviewed before submitting another.", code: "PENDING_EXISTS" });
      }
      if (last24hCount >= 3) {
        return res.status(429).json({ message: "You've reached the limit of 3 theme requests per 24 hours. Please try again later.", code: "DAILY_LIMIT" });
      }
      const order = await storage.createThemeOrder(userId, themeName.trim().slice(0, 100), description.trim().slice(0, 1000));
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/themes/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id ?? (req.user as any).claims?.sub;
      const prefs = await storage.getUserThemePreferences(userId);
      res.json({ orderedThemeIds: prefs });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put("/api/themes/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id ?? (req.user as any).claims?.sub;
      const { orderedThemeIds } = req.body;
      if (!Array.isArray(orderedThemeIds)) return res.status(400).json({ message: "orderedThemeIds must be an array" });
      await storage.setUserThemePreferences(userId, orderedThemeIds.filter((id: any) => typeof id === "string"));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/themes/order-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id ?? (req.user as any).claims?.sub;
      const stats = await storage.getUserThemeOrderStats(userId);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/themes/my-orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id ?? (req.user as any).claims?.sub;
      const orders = await storage.getUserThemeOrders(userId);
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/theme-orders", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const orders = await storage.getThemeOrders(status);
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/theme-orders/:id", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status, adminNote, grantThemeId } = req.body;
      if (!["approved", "denied"].includes(status)) {
        return res.status(400).json({ message: "status must be approved or denied" });
      }
      const reviewedBy = (req.user as any).id ?? (req.user as any).claims?.sub;
      const order = await storage.reviewThemeOrder(id, status, adminNote ?? null, reviewedBy);
      if (!order) return res.status(404).json({ message: "Order not found" });
      // Auto-assign the selected theme to the user on approval
      if (status === "approved" && grantThemeId && ALL_THEME_IDS.includes(grantThemeId)) {
        await storage.addUserThemeAssignment(order.userId, grantThemeId);
      }
      // Notify the requesting user
      const notifType = status === "approved"
        ? `theme_order_approved:${order.themeName}`
        : `theme_order_denied:${order.themeName}`;
      await storage.createNotification({ userId: order.userId, fromUserId: reviewedBy, type: notifType });
      const userSocketId = userSockets.get(order.userId);
      if (userSocketId) {
        io.to(userSocketId).emit("admin:notification", {
          type: status === "approved" ? "theme_order_approved" : "theme_order_denied",
          themeName: order.themeName,
          grantedThemeId: status === "approved" && grantThemeId ? grantThemeId : null,
          adminNote: adminNote ?? null,
        });
      }
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Content Block Log ──────────────────────────────────────────────────────
  app.get("/api/admin/content-blocks", isAuthenticated, isSuperAdmin, (_req, res) => {
    res.json(getBlockLog());
  });

  app.delete("/api/admin/content-blocks", isAuthenticated, isSuperAdmin, (_req, res) => {
    clearBlockLog();
    res.json({ ok: true });
  });

  // ── Strike Tracker ─────────────────────────────────────────────────────────
  app.get("/api/admin/strikes", isAuthenticated, isSuperAdmin, (_req, res) => {
    res.json(getStrikeRecords());
  });

  app.delete("/api/admin/strikes/:userId", isAuthenticated, isSuperAdmin, (req, res) => {
    clearUserStrikes(req.params.userId);
    res.json({ ok: true });
  });

  app.post("/api/admin/strikes/:userId/unmute", isAuthenticated, isSuperAdmin, (req, res) => {
    unmuteUser(req.params.userId);
    res.json({ ok: true });
  });

  // ── Platform Feature Flags ─────────────────────────────────────────────────
  const PLATFORM_FEATURE_IDS = [
    "voiceEffects","aiTutor","screenShare","youtubeWatch","movieParty","games","gifPicker","readTogether",
  ] as const;

  app.get("/api/admin/features", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const flags = await storage.getFeatureFlags();
      const features = PLATFORM_FEATURE_IDS.map((id) => ({
        id,
        enabled: flags[id] !== false,
      }));
      res.json({ features });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/features/:featureId", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { featureId } = req.params;
      const { enabled } = req.body;
      if (!(PLATFORM_FEATURE_IDS as readonly string[]).includes(featureId))
        return res.status(404).json({ message: "Unknown feature" });
      if (typeof enabled !== "boolean")
        return res.status(400).json({ message: "enabled must be boolean" });
      await storage.setFeatureFlag(featureId, enabled);
      res.json({ featureId, enabled });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/features/user/:userId", isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const overrides = await storage.getUserFeatureOverrides(req.params.userId);
      res.json({ userId: req.params.userId, overrides });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/admin/features/user/:userId", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { overrides } = req.body;
      if (typeof overrides !== "object" || Array.isArray(overrides) || overrides === null)
        return res.status(400).json({ message: "overrides must be an object" });
      const clean: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(overrides)) {
        if ((PLATFORM_FEATURE_IDS as readonly string[]).includes(k) && typeof v === "boolean")
          clean[k] = v;
      }
      await storage.setUserFeatureOverrides(userId, clean);
      res.json({ userId, overrides: clean });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/features/active", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const effective = await storage.getEffectiveFeatures(userId);
      const result: Record<string, boolean> = {};
      for (const id of PLATFORM_FEATURE_IDS) {
        if (id === "voiceEffects") {
          result[id] = effective[id] === true;
        } else {
          result[id] = effective[id] !== false;
        }
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── User Comments ───────────────────────────────────────────────────────────
  app.get("/api/users/:targetUserId/comments", async (req, res) => {
    try {
      const { targetUserId } = req.params;
      const comments = await storage.getUserComments(targetUserId);
      res.json(comments);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/users/:targetUserId/comments", isAuthenticated, async (req: any, res) => {
    try {
      const authorId = (req.user as any).id;
      const { targetUserId } = req.params;
      const parsed = insertUserCommentSchema.safeParse({ ...req.body, authorId, targetUserId });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid comment" });

      // ── Content moderation ─────────────────────────────────────────────────
      const _cmtUser = await storage.getUser(authorId);
      const commentModResult = checkContent(parsed.data.text, "comment", { userId: authorId, displayName: _cmtUser?.displayName ?? undefined, avatarUrl: _cmtUser?.profileImageUrl ?? undefined });
      if (commentModResult.flagged) {
        recordStrike(authorId, parsed.data.text.slice(0, 30), commentModResult.matchedTerm ?? "unknown", "comment");
        return res.status(422).json({ flagged: true, message: commentModResult.message });
      }

      const comment = await storage.createUserComment(parsed.data);
      res.status(201).json(comment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/users/:targetUserId/comments/:commentId", isAuthenticated, async (req: any, res) => {
    try {
      const authorId = (req.user as any).id;
      const { commentId } = req.params;
      await storage.deleteUserComment(commentId, authorId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Teacher Applications ───────────────────────────────────────────────────
  app.get("/api/teacher-applications/my", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const app = await storage.getTeacherApplicationByUser(userId);
      res.json(app || null);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/teacher-applications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const existing = await storage.getTeacherApplicationByUser(userId);
      if (existing && existing.status === "pending") {
        return res.status(400).json({ message: "You already have a pending application" });
      }
      const { name, bio, languages, levels, specializations, suggestedRate, paypalEmail, experience } = req.body;
      if (!name || !bio || !paypalEmail) {
        return res.status(400).json({ message: "Name, bio, and PayPal email are required" });
      }
      const application = await storage.createTeacherApplication({
        userId,
        name,
        bio,
        languages: languages || [],
        levels: levels || [],
        specializations: specializations || [],
        suggestedRate: Number(suggestedRate) || 0,
        paypalEmail,
        experience: experience || null,
      });
      res.json(application);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/teacher-applications", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const [admin, applications] = await Promise.all([
        storage.getUser((req.user as any).id),
        storage.getAllTeacherApplications(),
      ]);
      const canSeeEmails = admin?.role === "superadmin" || admin?.email === SUPER_ADMIN_EMAIL;
      const userMap = await storage.getUsersByIds(applications.map(a => a.userId));
      const enriched = applications.map((app) => {
        const user = userMap.get(app.userId);
        return { ...app, user: user ? { id: user.id, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, email: canSeeEmails ? user.email : null, profileImageUrl: user.profileImageUrl } : null };
      });
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/teacher-applications/:id/approve", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { approvedRate, adminNotes } = req.body;
      const app = await storage.updateTeacherApplication(req.params.id as string, {
        status: "approved",
        approvedRate: Number(approvedRate) || 0,
        adminNotes: adminNotes || null,
      });
      if (!app) return res.status(404).json({ message: "Application not found" });
      const teacher = await storage.createTeacher({
        name: app.name,
        bio: app.bio,
        languages: app.languages,
        levels: app.levels,
        specializations: app.specializations,
        hourlyRate: Number(approvedRate) || app.suggestedRate,
        sessionDurations: ["30", "60"],
        isAvailable: true,
        userId: app.userId,
        rating: 0,
        reviewCount: 0,
        avatarUrl: null,
      });
      await storage.createNotification({ userId: app.userId, fromUserId: (req.user as any).id, type: "teacher_approved" });
      const socketId = userSockets.get(app.userId);
      if (socketId) {
        io.to(socketId).emit("admin:notification", { type: "teacher_approved" });
      }
      res.json({ application: app, teacher });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/teacher-applications/:id/reject", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { adminNotes } = req.body;
      const app = await storage.updateTeacherApplication(req.params.id as string, {
        status: "rejected",
        adminNotes: adminNotes || null,
      });
      if (!app) return res.status(404).json({ message: "Application not found" });
      await storage.createNotification({ userId: app.userId, fromUserId: (req.user as any).id, type: "teacher_rejected" });
      const socketId = userSockets.get(app.userId);
      if (socketId) io.to(socketId).emit("admin:notification", { type: "teacher_rejected" });
      res.json(app);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/teacher-applications/pending-count", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const count = await storage.getPendingApplicationCount();
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  (async () => {
    try {
      const allRooms = await storage.getAllRooms();
      let resetCount = 0;
      for (const room of allRooms) {
        const participants = roomParticipants.get(room.id);
        if (!participants || participants.size === 0) {
          // Use the longer startup grace so clients have time to socket-
          // reconnect and re-emit `room:join` after a server restart.
          // Without this, every redeploy nukes rooms while users are inside.
          startRoomDeleteTimer(room.id, ROOM_STARTUP_GRACE_MS);

          // Immediately reset activeUsers to 0 in the DB because the in-memory
          // participants map is empty after a restart. Without this, the lobby
          // shows rooms with stale activeUsers counts (e.g. 3 participants) even
          // though nobody is actually connected — ghost rooms. When users
          // reconnect and emit room:join the count is restored correctly.
          if ((room.activeUsers ?? 0) > 0) {
            await storage.updateRoomActiveUsers(room.id, 0);
            resetCount++;
          }
        }
      }
      const scheduledCount = allRooms.filter(r => {
        const p = roomParticipants.get(r.id);
        return !p || p.size === 0;
      }).length;
      console.log(`Startup cleanup: scheduled ${scheduledCount} empty rooms for deletion (grace=${Math.round(ROOM_STARTUP_GRACE_MS / 1000)}s), reset activeUsers=0 for ${resetCount} rooms`);
      // Broadcast the corrected (ghost-free) room list immediately so any
      // SSE clients that connected before this cleanup runs get fresh data.
      if (resetCount > 0) {
        broadcastRooms().catch(() => {});
      }
    } catch (err) {
      console.error("Startup room cleanup error:", err);
    }
  })();

  io.on("connection", (socket) => {
    let currentUserId: string | null = null;

    // Detect and cache the connecting client's country from the HTTP handshake
    // headers so it's available when room:join fires (which has no req object).
    void detectCountry(socket.handshake.headers as Record<string, any>).then((code) => {
      if (code) socketCountries.set(socket.id, code);
    });

    socket.on("user:online", async (userId: string) => {
      currentUserId = userId;

      const timerId = `${userId}-disconnect`;
      const existingTimer = disconnectTimers.get(timerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        disconnectTimers.delete(timerId);
      }

      onlineUsers.add(userId);
      userSockets.set(userId, socket.id);
      // Join a personal room so ALL of this user's open tabs receive targeted
      // socket events (notifications, DMs, admin actions). Without this, only
      // the tab whose socket ID is in userSockets gets the event; other tabs
      // miss it and wait for the 60-second refetch interval instead.
      socket.join(`user:${userId}`);
      await storage.updateUserStatus(userId, "online");
      io.emit("presence:update", { userId, status: "online" });
      socket.emit("presence:online", Array.from(onlineUsers));

      for (const [roomId, participants] of Array.from(roomParticipants.entries())) {
        if (participants.has(userId)) {
          socket.join(roomId);
        }
      }
    });

    socket.on("user:offline", async (userId: string) => {
      onlineUsers.delete(userId);
      await storage.updateUserStatus(userId, "offline");
      io.emit("presence:update", { userId, status: "offline" });
    });

    socket.on("heartbeat", () => {
      // Use the heartbeat as a keep-alive: cancel any pending disconnect grace
      // timer so a user whose socket stayed connected is never accidentally
      // removed from the online set while they're actively sending pings.
      if (currentUserId) {
        const timerId = `${currentUserId}-disconnect`;
        const existingTimer = disconnectTimers.get(timerId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          disconnectTimers.delete(timerId);
        }
        // If somehow evicted from onlineUsers while the socket is still alive,
        // quietly restore them so they don't appear invisible.
        if (!onlineUsers.has(currentUserId)) {
          onlineUsers.add(currentUserId);
          io.emit("presence:update", { userId: currentUserId, status: "online" });
        }
      }
    });

    socket.on("room:join", async (data: { roomId: string; userId: string }) => {
      const { roomId, userId } = data;

      // Deduplicate concurrent room:join events that arrive in rapid succession
      // (race between initMedia() and the "connect" socket listener both emitting
      // room:join on first page load). Without this, both events see isRejoin=false
      // and broadcast duplicate "X joined the room" system messages.
      const _joinKey = `${roomId}:${userId}`;
      if (joiningNow.has(_joinKey)) return;
      joiningNow.add(_joinKey);
      setTimeout(() => joiningNow.delete(_joinKey), 2000);

      const timerId = `${userId}-disconnect`;
      const existingTimer = disconnectTimers.get(timerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        disconnectTimers.delete(timerId);
      }

      const user = await storage.getUser(userId);
      if (!user) return;
      if (isUserRestricted(user)) {
        socket.emit("admin:restricted", {
          restrictedUntil: user.restrictedUntil,
          reason: user.restrictedReason || "Your account is temporarily restricted from joining rooms.",
        });
        return;
      }

      const room = await storage.getRoom(roomId);
      if (!room) return;

      const existingRoomId = userCurrentRoom.get(userId);
      const previousSocketId = userSockets.get(userId);
      const previousSocket = previousSocketId ? io.sockets.sockets.get(previousSocketId) : undefined;

      if (existingRoomId && existingRoomId !== roomId) {
        // User is joining a DIFFERENT room — evict from the old one.
        if (previousSocketId) {
          io.to(previousSocketId).emit("room:joined-another-room", { oldRoomId: existingRoomId, newRoomId: roomId });
        }
        await leaveRoomState(existingRoomId, userId, previousSocketId === socket.id ? socket : previousSocket);
      } else if (existingRoomId === roomId && previousSocketId && previousSocketId !== socket.id && previousSocket?.connected) {
        // User opened the SAME room in a SECOND tab — the old socket is still
        // alive and connected. Reject the new tab and keep the existing session.
        // Note: if previousSocket is NOT connected, this is a normal socket.io
        // reconnection (network glitch / tab sleep), NOT a duplicate tab — let it through.
        socket.emit("room:duplicate-tab", { roomId });
        return;
      }

      cancelRoomDeleteTimer(roomId);

      if (!roomParticipants.has(roomId)) {
        roomParticipants.set(roomId, new Map());
      }

      const currentParticipants = roomParticipants.get(roomId)!;
      const isAdminUser = user.role === "admin" || user.role === "superadmin";
      const isUnlimitedRoom = room.maxUsers === 0;
      // Honor a pending knock-allow grant from the host: it lets this user in
      // even if the room is at capacity. Consumed on use.
      const knockGrants = roomKnockGrants.get(roomId);
      const hasKnockGrant = !!knockGrants?.has(userId);
      if (!isUnlimitedRoom && currentParticipants.size >= room.maxUsers && !currentParticipants.has(userId) && !isAdminUser && !hasKnockGrant) {
        socket.emit("room:full", { roomId });
        return;
      }

      const isRejoin = currentParticipants.has(userId);
      socket.join(roomId);
      currentParticipants.set(userId, user);
      userSockets.set(userId, socket.id);
      userCurrentRoom.set(userId, roomId);
      // Consume the knock-allow grant (one-shot).
      if (hasKnockGrant) {
        knockGrants!.delete(userId);
        if (knockGrants!.size === 0) roomKnockGrants.delete(roomId);
      }

      if (!roomMuteStatus.has(roomId)) {
        roomMuteStatus.set(roomId, new Map());
      }
      const muteMap = roomMuteStatus.get(roomId)!;
      if (!muteMap.has(userId)) {
        muteMap.set(userId, true);
      }

      if (!roomRoles.has(roomId)) {
        roomRoles.set(roomId, new Map());
      }
      const roles = roomRoles.get(roomId)!;
      if (room.ownerId === userId) {
        roles.set(userId, "host");
      } else if (!roles.has(userId)) {
        roles.set(userId, "member");
      }

      const participants = Array.from(currentParticipants.values());
      await storage.updateRoomActiveUsers(roomId, participants.length);

      const videoUsers = roomVideoStatus.get(roomId);
      const muteStatusMap = roomMuteStatus.get(roomId);
      const participantsWithStatus = participants.map(p => ({
        ...p,
        hasVideo: videoUsers?.has(p.id) || false,
        role: roles.get(p.id) || "member",
        isMuted: muteStatusMap?.get(p.id) ?? true,
      }));

      socket.emit("room:participants", participantsWithStatus);
      socket.emit("room:roles", Object.fromEntries(roles));

      // Send existing mood + gif state so new joiners immediately see what
      // participants already set before they arrived.
      const moodSnapshot = roomMoods.get(roomId);
      if (moodSnapshot && moodSnapshot.size > 0) {
        socket.emit("room:moods-snapshot", Object.fromEntries(moodSnapshot));
      }
      const gifSnapshot = roomAvatarGifs.get(roomId);
      if (gifSnapshot && gifSnapshot.size > 0) {
        socket.emit("room:avatar-gifs-snapshot", Object.fromEntries(gifSnapshot));
      }

      // Sync disco overlay scene so new joiners start on the same scene as everyone else
      if (room.roomTheme === "disco") {
        const overlaySceneIdx = roomDiscoOverlaySceneIdx.get(roomId) ?? 0;
        socket.emit("room:disco-advance", { sceneIdx: overlaySceneIdx });
        // Also sync DJ mode state if it's currently active
        const djActive = roomDjSceneIdx.has(roomId);
        if (djActive) {
          const djSceneIdx = roomDjSceneIdx.get(roomId) ?? 0;
          const moveStyle = roomDjMoveStyle.get(roomId) ?? "sling";
          socket.emit("room:dj-mode", { active: true, scene: DJ_SCENE_LIST[djSceneIdx], overlaySceneIdx, moveStyle });
        }
      }

      // Always broadcast updated participant list to existing room members so
      // they see the joining/rejoining user. On a true rejoin (socket.io
      // reconnect after a network glitch), skipping this broadcast left the
      // rejoining user invisible to everyone already in the room.
      // `isRejoin` is forwarded so the client can suppress the "X joined the room"
      // system message for reconnects — preventing the doubled-message bug where
      // a brief network blip caused the join announcement to appear twice.
      socket.to(roomId).emit("room:user-joined", { user, participants: participantsWithStatus, isRejoin });

      if (!isRejoin) {
        // First-time join only: send welcome message and record analytics.
        if (room.welcomeMessage && room.ownerId !== userId) {
          const joinerName = user.displayName || user.firstName || user.email?.split("@")[0] || "there";
          const personalizedMsg = room.welcomeMessage.replace(/@username/gi, `@${joinerName}`);
          socket.emit("room:welcome-message", {
            welcomeMessage: personalizedMsg,
            welcomeMediaUrls: room.welcomeMediaUrls || [],
            welcomeMediaTypes: room.welcomeMediaTypes || [],
            welcomeMediaPosition: room.welcomeMediaPosition || "below",
            welcomeAccentColor: room.welcomeAccentColor || "#8B5CF6",
          });
        }
        void storage.recordRoomJoin({ roomId, userId, country: socketCountries.get(socket.id), roomName: room.name }).catch((err) => {
          console.error("[analytics] recordRoomJoin failed:", err?.message || err);
        });
        void checkAndAwardStreakBadge(userId);
        // Fire-and-forget: push notifications to followers who have subscribed
        void notifyFollowersRoomJoin(user, { id: roomId, name: room.name });
      }
      io.emit("room:participants-update", { roomId, participants });

      // Per-host snapshot: tell the newcomer about every active host in the
      // room so they can render the host avatars and pick which one to watch.
      for (const { hostId, state: ytState } of listYtHosts(roomId)) {
        socket.emit("room:youtube", { hostId, videoId: ytState.videoId, startedBy: ytState.startedBy });
        const elapsed = ytState.playing ? Math.max(0, (Date.now() - ytState.lastTs) / 1000) : 0;
        socket.emit("room:youtube-state", {
          hostId,
          action: ytState.playing ? "play" : "pause",
          time: ytState.lastTime + elapsed,
          ts: Date.now(),
          from: ytState.startedBy,
        });
      }
      // Send queue state so newcomers see the current queue
      const queue = roomYoutubeQueue.get(roomId);
      if (queue && queue.length > 0) {
        socket.emit("room:youtube-queue-update", { queue });
      }

      // Per-host movie snapshot: tell the newcomer about every active movie host
      // Include computed currentTime so the newcomer starts from where the host actually is
      for (const { hostId, state: mState } of listMovieHosts(roomId)) {
        const elapsed = mState.playing ? Math.max(0, (Date.now() - mState.lastTs) / 1000) : 0;
        socket.emit("room:movie", {
          hostId,
          movieId: mState.movieId,
          movieTitle: mState.movieTitle,
          posterPath: mState.posterPath,
          startedBy: mState.startedBy,
          startedAt: mState.startedAt,
          currentTime: mState.lastTime + elapsed,
          playing: mState.playing,
        });
      }

      const bookState = roomBookState.get(roomId);
      if (bookState) {
        socket.emit("room:book", { book: bookState.book, hostId: bookState.hostId, scrollPct: bookState.scrollPct, watchers: Array.from(bookState.watchers) });
      }

      const screenSharer = roomScreenShareStatus.get(roomId);
      if (screenSharer) {
        socket.emit("room:screen-share", { userId: screenSharer, active: true });
      }

      // Send current pinned message (if any) to the new joiner
      const pinnedMsg = roomPinnedMessages.get(roomId);
      if (pinnedMsg) {
        socket.emit("room:pinned-message", pinnedMsg);
      }

      socket.to(roomId).emit("webrtc:new-peer", { peerId: userId });
    });

    socket.on("room:leave", async (data: { roomId: string; userId: string }) => {
      const { roomId, userId } = data;
      await leaveRoomState(roomId, userId, socket);
    });

    socket.on("room:mute", (data: { roomId: string; userId: string; isMuted: boolean }) => {
      if (!roomMuteStatus.has(data.roomId)) {
        roomMuteStatus.set(data.roomId, new Map());
      }
      roomMuteStatus.get(data.roomId)!.set(data.userId, data.isMuted);
      io.to(data.roomId).emit("room:mute-update", {
        userId: data.userId,
        isMuted: data.isMuted,
      });
    });

    // Voice activity relay — each client detects its OWN mic level and emits
    // this event. The server relays it to all other participants in the room.
    // Using server relay (rather than relying on each client analysing remote
    // WebRTC streams) ensures the indicator works on every browser including
    // Safari/Firefox which may restrict AudioContext for remote media streams.
    socket.on("room:speaking", (data: { roomId: string; userId: string; isSpeaking: boolean }) => {
      if (!data?.roomId || !data?.userId) return;
      // Relay to everyone EXCEPT the sender (they already know they're speaking)
      socket.to(data.roomId).emit("room:speaking", {
        userId: data.userId,
        isSpeaking: data.isSpeaking,
      });
    });

    socket.on("room:hand", (data: { roomId: string; userId: string; raised: boolean }) => {
      io.to(data.roomId).emit("room:hand-raised", {
        userId: data.userId,
        raised: data.raised,
      });
    });

    // Mood reaction broadcast — replaces the old "raise hand" button. Anyone in
    // the room can fire a mood emoji (sleepy / angry / wave / clap / etc) and
    // every other participant sees it animate above the sender's avatar card.
    // Server is intentionally dumb: it just relays. Throttling/dedupe is the
    // client's job (we already prevent spamming via the picker UI).
    socket.on("room:mood", (data: { roomId: string; userId: string; emoji: string }) => {
      if (!data?.roomId || !data?.userId || !data?.emoji) return;
      const emoji = String(data.emoji).slice(0, 16);
      // Persist so new joiners receive the current mood snapshot
      if (!roomMoods.has(data.roomId)) roomMoods.set(data.roomId, new Map());
      roomMoods.get(data.roomId)!.set(data.userId, emoji);
      io.to(data.roomId).emit("room:mood-update", {
        userId: data.userId,
        emoji,
        ts: Date.now(),
      });
    });

    socket.on("room:mood-clear", (data: { roomId: string; userId: string }) => {
      if (!data?.roomId || !data?.userId) return;
      roomMoods.get(data.roomId)?.delete(data.userId);
      io.to(data.roomId).emit("room:mood-clear", { userId: data.userId });
    });

    // Per-user avatar GIF — persisted so new joiners see existing GIFs
    socket.on("room:avatar-gif", (data: { roomId: string; userId: string; gifUrl: string | null }) => {
      if (!data?.roomId || !data?.userId) return;
      const gifUrl = data.gifUrl ? String(data.gifUrl).slice(0, 2048) : null;
      if (!roomAvatarGifs.has(data.roomId)) roomAvatarGifs.set(data.roomId, new Map());
      if (gifUrl) {
        roomAvatarGifs.get(data.roomId)!.set(data.userId, gifUrl);
      } else {
        roomAvatarGifs.get(data.roomId)?.delete(data.userId);
      }
      io.to(data.roomId).emit("room:avatar-gif", { userId: data.userId, gifUrl });
    });

    // ── DJ Mode — host toggles disco sling-animations for all in the room ──
    socket.on("room:dj-mode", (data: { roomId: string; active: boolean; moveStyle?: string }) => {
      if (!data?.roomId) return;
      if (data.active) {
        roomDjSceneIdx.set(data.roomId, 0);
        // Start the overlay at scene 0 when DJ mode turns on
        if (!roomDiscoOverlaySceneIdx.has(data.roomId)) {
          roomDiscoOverlaySceneIdx.set(data.roomId, 0);
        }
        if (data.moveStyle) roomDjMoveStyle.set(data.roomId, data.moveStyle);
      } else {
        roomDjSceneIdx.delete(data.roomId);
        roomDjMoveStyle.delete(data.roomId);
      }
      const overlaySceneIdx = roomDiscoOverlaySceneIdx.get(data.roomId) ?? 0;
      io.to(data.roomId).emit("room:dj-mode", { active: !!data.active, scene: "spotlight", moveStyle: data.moveStyle || "sling", overlaySceneIdx });
    });

    // ── DJ Skip — advances to next scene, broadcast scene name to all participants ──
    // Also auto-advances the disco background overlay so atmosphere syncs with the scene.
    socket.on("room:dj-skip", (data: { roomId: string }) => {
      if (!data?.roomId) return;
      const cur = roomDjSceneIdx.get(data.roomId) ?? 0;
      const next = (cur + 1) % DJ_SCENE_LIST.length;
      roomDjSceneIdx.set(data.roomId, next);
      // Auto-advance disco background — keeps background in sync with scene changes
      const discoNext = ((roomDiscoOverlaySceneIdx.get(data.roomId) ?? 0) + 1) % 7;
      roomDiscoOverlaySceneIdx.set(data.roomId, discoNext);
      io.to(data.roomId).emit("room:dj-skip", { scene: DJ_SCENE_LIST[next] });
      io.to(data.roomId).emit("room:disco-advance", { sceneIdx: discoNext });
    });

    // ── DJ Move — host changes participant card movement style for all ──
    socket.on("room:dj-move", (data: { roomId: string; moveStyle: string }) => {
      if (!data?.roomId) return;
      // Persist so late-joiners receive the current style
      roomDjMoveStyle.set(data.roomId, data.moveStyle);
      io.to(data.roomId).emit("room:dj-move", { moveStyle: data.moveStyle });
    });

    // ── Disco Overlay Advance — host's auto-cycle timer fires, server tracks + broadcasts to all ──
    socket.on("room:disco-advance", (data: { roomId: string }) => {
      if (!data?.roomId) return;
      const cur = roomDiscoOverlaySceneIdx.get(data.roomId) ?? 0;
      const next = (cur + 1) % 7;
      roomDiscoOverlaySceneIdx.set(data.roomId, next);
      io.to(data.roomId).emit("room:disco-advance", { sceneIdx: next });
    });

    // ── Disco Overlay Goto — host jumps directly to a specific scene index ──
    socket.on("room:disco-goto", (data: { roomId: string; sceneIdx: number }) => {
      if (!data?.roomId || typeof data.sceneIdx !== "number") return;
      const idx = Math.max(0, Math.min(6, data.sceneIdx));
      roomDiscoOverlaySceneIdx.set(data.roomId, idx);
      io.to(data.roomId).emit("room:disco-advance", { sceneIdx: idx });
    });

    // "Say Bye" — user waves goodbye to the room before leaving. Server
    // broadcasts to everyone (including sender) so they all hear the sound
    // and see the farewell toast, then the client handles the leave itself.
    socket.on("room:say-bye", (data: { roomId: string; userId: string; userName: string }) => {
      if (!data?.roomId || !data?.userId) return;
      const userName = String(data.userName || "Someone").slice(0, 60);
      io.to(data.roomId).emit("room:bye", {
        userId: data.userId,
        userName,
        ts: Date.now(),
      });
    });

    socket.on("room:kick", async (data: { roomId: string; targetUserId: string; kickedBy: string }) => {
      const room = await storage.getRoom(data.roomId);
      if (!room || room.ownerId !== data.kickedBy) return;

      userCurrentRoom.delete(data.targetUserId);

      const targetSocketId = userSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("room:kicked", { roomId: data.roomId });
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.leave(data.roomId);
        }
      }

      if (roomParticipants.has(data.roomId)) {
        const kickedUser = roomParticipants.get(data.roomId)!.get(data.targetUserId);
        const kickedDisplayName = kickedUser ? getDisplayName(kickedUser) : null;
        roomParticipants.get(data.roomId)!.delete(data.targetUserId);
        const participants = Array.from(roomParticipants.get(data.roomId)!.values());
        await storage.updateRoomActiveUsers(data.roomId, participants.length);
        io.to(data.roomId).emit("room:user-left", { userId: data.targetUserId, participants, displayName: kickedDisplayName });
        io.emit("room:participants-update", { roomId: data.roomId, participants });
      }
    });

    socket.on("room:force-mute", async (data: { roomId: string; targetUserId: string; mutedBy: string }) => {
      const room = await storage.getRoom(data.roomId);
      if (!room) return;
      const roles = roomRoles.get(data.roomId);
      const muterRole = roles?.get(data.mutedBy);
      if (room.ownerId !== data.mutedBy && muterRole !== "co-owner") return;

      io.to(data.roomId).emit("room:mute-update", {
        userId: data.targetUserId,
        isMuted: true,
        forcedBy: data.mutedBy,
      });
    });

    socket.on("room:force-mute-video", async (data: { roomId: string; targetUserId: string; mutedBy: string }) => {
      const room = await storage.getRoom(data.roomId);
      if (!room) return;
      const roles = roomRoles.get(data.roomId);
      const muterRole = roles?.get(data.mutedBy);
      if (room.ownerId !== data.mutedBy && muterRole !== "co-owner") return;

      io.to(data.roomId).emit("room:video-force-off", {
        userId: data.targetUserId,
        mutedBy: data.mutedBy,
      });
    });

    socket.on("room:assign-role", async (data: { roomId: string; targetUserId: string; role: string; assignedBy: string }) => {
      const room = await storage.getRoom(data.roomId);
      if (!room) return;
      const roles = roomRoles.get(data.roomId);
      if (!roles) return;
      const assignerRole = roles.get(data.assignedBy);
      if (data.assignedBy !== room.ownerId && assignerRole !== "co-owner") return;
      if (data.targetUserId === room.ownerId) return;
      if (!["co-owner", "member", "guest", "troll"].includes(data.role)) return;

      const previousRole = roles.get(data.targetUserId);
      roles.set(data.targetUserId, data.role);
      io.to(data.roomId).emit("room:roles-update", {
        userId: data.targetUserId,
        role: data.role,
        roles: Object.fromEntries(roles),
      });

      if (previousRole === data.role) return;

      const [targetUser, assignerUser] = await Promise.all([
        storage.getUser(data.targetUserId),
        storage.getUser(data.assignedBy),
      ]);
      if (targetUser && assignerUser) {
        const roleName = data.role === "co-owner" ? "Co-Owner" : data.role === "member" ? "Member" : data.role === "guest" ? "Guest" : "Troll";
        emitSystemChatMsg(data.roomId, `${getDisplayName(assignerUser)} set ${getDisplayName(targetUser)} as ${roleName}`);
      }

      // Extra info message when troll role is assigned
      if (data.role === "troll" && targetUser) {
        emitSystemChatMsg(data.roomId, `🧌 ${getDisplayName(targetUser)} is now a Troll — limited to 50 chars per message, 10s cooldown, and a vote-to-kick poll is now active.`);
      }

      // When someone is tagged as Troll, open a vote-to-kick poll for room members
      if (data.role === "troll") {
        const participants = roomParticipants.get(data.roomId);
        const totalMembers = participants ? participants.size : 1;
        trollVoteState.set(data.roomId, { targetUserId: data.targetUserId, votes: new Set() });
        io.to(data.roomId).emit("room:troll-vote-start", {
          targetUserId: data.targetUserId,
          targetName: targetUser ? getDisplayName(targetUser) : "Unknown",
          assignedBy: data.assignedBy,
          assignedByName: assignerUser ? getDisplayName(assignerUser) : "Host",
          totalMembers,
        });
        // Auto-expire the vote after 60 seconds
        setTimeout(() => {
          const state = trollVoteState.get(data.roomId);
          if (state && state.targetUserId === data.targetUserId) {
            trollVoteState.delete(data.roomId);
            io.to(data.roomId).emit("room:troll-vote-end", { targetUserId: data.targetUserId, kicked: false, reason: "expired" });
          }
        }, 60_000);
      }
    });

    socket.on("room:troll-vote", async (data: { roomId: string; voterId: string; kick: boolean }) => {
      const state = trollVoteState.get(data.roomId);
      if (!state) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants?.has(data.voterId)) return;
      // Don't let the troll vote on their own fate
      if (data.voterId === state.targetUserId) return;

      if (data.kick) {
        state.votes.add(data.voterId);
      } else {
        state.votes.delete(data.voterId);
      }

      const totalVoters = Math.max(1, (participants?.size ?? 1) - 1);
      const kickVotes = state.votes.size;
      io.to(data.roomId).emit("room:troll-vote-progress", {
        targetUserId: state.targetUserId,
        kickVotes,
        totalVoters,
      });

      // Majority vote: more than half of eligible voters kicked
      if (kickVotes > totalVoters / 2) {
        trollVoteState.delete(data.roomId);
        io.to(data.roomId).emit("room:troll-vote-end", { targetUserId: state.targetUserId, kicked: true, reason: "majority" });

        // Auto-kick the troll
        userCurrentRoom.delete(state.targetUserId);
        const targetSocketId = userSockets.get(state.targetUserId);
        if (targetSocketId) {
          io.to(targetSocketId).emit("room:kicked", { roomId: data.roomId });
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          if (targetSocket) targetSocket.leave(data.roomId);
        }
        if (roomParticipants.has(data.roomId)) {
          const trollUser = roomParticipants.get(data.roomId)!.get(state.targetUserId);
          const trollDisplayName = trollUser ? getDisplayName(trollUser) : null;
          roomParticipants.get(data.roomId)!.delete(state.targetUserId);
          const updatedParts = Array.from(roomParticipants.get(data.roomId)!.values());
          await storage.updateRoomActiveUsers(data.roomId, updatedParts.length);
          io.to(data.roomId).emit("room:user-left", { userId: state.targetUserId, participants: updatedParts, displayName: trollDisplayName });
          io.emit("room:participants-update", { roomId: data.roomId, participants: updatedParts });
        }
        const targetUser = await storage.getUser(state.targetUserId);
        if (targetUser) {
          emitSystemChatMsg(data.roomId, `🗳️ ${getDisplayName(targetUser)} was voted out by the room.`);
        }
      }
    });

    // ── Vote-for-host ──────────────────────────────────────────────────────────
    // Any participant (not the current host) can nominate another participant
    // to become host. Everyone votes yes/no; majority wins in 60 s.
    socket.on("room:nominate-host", async (data: { roomId: string; nominatorId: string; nomineeId: string }) => {
      const room = await storage.getRoom(data.roomId);
      if (!room) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants?.has(data.nominatorId)) return;
      if (!participants?.has(data.nomineeId)) return;
      if (data.nominatorId === data.nomineeId) return;
      // Only non-hosts may start a vote
      if (room.ownerId === data.nominatorId) return;
      // Can't nominate the current host
      if (room.ownerId === data.nomineeId) return;
      // One vote at a time
      if (hostVoteState.has(data.roomId)) {
        socket.emit("room:host-vote-error", { message: "A host vote is already in progress." });
        return;
      }

      const [nominator, nominee] = await Promise.all([
        storage.getUser(data.nominatorId),
        storage.getUser(data.nomineeId),
      ]);
      const nominatorName = nominator ? (nominator.firstName && nominator.lastName ? `${nominator.firstName} ${nominator.lastName}` : nominator.firstName || nominator.username || "Someone") : "Someone";
      const nomineeName = nominee ? (nominee.firstName && nominee.lastName ? `${nominee.firstName} ${nominee.lastName}` : nominee.firstName || nominee.username || "Someone") : "Someone";

      const timer = setTimeout(() => {
        const state = hostVoteState.get(data.roomId);
        if (state && state.nomineeId === data.nomineeId) {
          hostVoteState.delete(data.roomId);
          io.to(data.roomId).emit("room:host-vote-end", {
            nomineeId: data.nomineeId,
            transferred: false,
            reason: "expired",
          });
        }
      }, 60_000);

      const yesVotes = new Set<string>();
      // Nominator auto-casts a yes vote
      yesVotes.add(data.nominatorId);

      hostVoteState.set(data.roomId, {
        nomineeId: data.nomineeId,
        nomineeName,
        nominatorId: data.nominatorId,
        nominatorName,
        yesVotes,
        noVotes: new Set(),
        timer,
      });

      const totalVoters = participants.size;
      io.to(data.roomId).emit("room:host-vote-start", {
        nomineeId: data.nomineeId,
        nomineeName,
        nominatorId: data.nominatorId,
        nominatorName,
        totalVoters,
        yesVotes: yesVotes.size,
        noVotes: 0,
      });

      emitSystemChatMsg(data.roomId, `👑 ${nominatorName} nominated ${nomineeName} to be the new host — vote now!`);
    });

    socket.on("room:host-vote", async (data: { roomId: string; voterId: string; vote: "yes" | "no" }) => {
      const state = hostVoteState.get(data.roomId);
      if (!state) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants?.has(data.voterId)) return;

      // Record vote (toggle off if same)
      if (data.vote === "yes") {
        state.yesVotes.add(data.voterId);
        state.noVotes.delete(data.voterId);
      } else {
        state.noVotes.add(data.voterId);
        state.yesVotes.delete(data.voterId);
      }

      const totalVoters = participants.size;
      const yesCount = state.yesVotes.size;
      const noCount = state.noVotes.size;

      io.to(data.roomId).emit("room:host-vote-progress", {
        nomineeId: state.nomineeId,
        yesVotes: yesCount,
        noVotes: noCount,
        totalVoters,
      });

      const needed = Math.floor(totalVoters / 2) + 1;

      // Majority yes → transfer host
      if (yesCount >= needed) {
        clearTimeout(state.timer);
        hostVoteState.delete(data.roomId);
        io.to(data.roomId).emit("room:host-vote-end", { nomineeId: state.nomineeId, transferred: true, reason: "majority" });

        const room = await storage.getRoom(data.roomId);
        if (!room) return;
        const updated = await storage.updateRoom(data.roomId, { ownerId: state.nomineeId });
        if (!updated) return;
        const roles = roomRoles.get(data.roomId);
        if (roles) {
          roles.set(state.nomineeId, "host");
          roles.set(room.ownerId, "co-owner");
        }
        io.to(data.roomId).emit("room:updated", updated);
        io.to(data.roomId).emit("room:roles-update", { userId: state.nomineeId, role: "host", roles: roles ? Object.fromEntries(roles) : {} });
        io.to(data.roomId).emit("room:host-transferred", { newOwnerId: state.nomineeId, previousOwnerId: room.ownerId });
        emitSystemChatMsg(data.roomId, `👑 ${state.nomineeName} is now the host — voted by the room!`);
        return;
      }

      // Majority no → cancel vote
      if (noCount >= needed) {
        clearTimeout(state.timer);
        hostVoteState.delete(data.roomId);
        io.to(data.roomId).emit("room:host-vote-end", { nomineeId: state.nomineeId, transferred: false, reason: "rejected" });
        emitSystemChatMsg(data.roomId, `🗳️ The vote to make ${state.nomineeName} host was rejected.`);
      }
    });

    socket.on("room:transfer-host", async (data: { roomId: string; newOwnerId: string; currentOwnerId: string }) => {
      const room = await storage.getRoom(data.roomId);
      if (!room) return;
      if (room.ownerId !== data.currentOwnerId) return;

      const updated = await storage.updateRoom(data.roomId, { ownerId: data.newOwnerId });
      if (!updated) return;

      const roles = roomRoles.get(data.roomId);
      if (roles) {
        roles.set(data.newOwnerId, "host");
        roles.set(data.currentOwnerId, "co-owner");
      }

      io.to(data.roomId).emit("room:updated", updated);
      io.to(data.roomId).emit("room:roles-update", {
        userId: data.newOwnerId,
        role: "host",
        roles: roles ? Object.fromEntries(roles) : {},
      });
      io.to(data.roomId).emit("room:host-transferred", {
        newOwnerId: data.newOwnerId,
        previousOwnerId: data.currentOwnerId,
      });
    });

    socket.on("room:chat", async (data: { roomId: string; userId: string; text: string; messageColor?: string; cardColor?: string; privateToId?: string | null; replyTo?: { id: string; userId: string; userName: string; text: string } }) => {
      try {
        const HEX6 = /^#[0-9a-fA-F]{6}$/;
        const safeColor = HEX6.test(data.messageColor || "") ? data.messageColor : undefined;
        const safeCardColor = HEX6.test(data.cardColor || "") ? data.cardColor : undefined;
        const user = await storage.getUser(data.userId);
        if (!user) return;
        if (isUserRestricted(user)) {
          socket.emit("admin:restricted", {
            restrictedUntil: user.restrictedUntil,
            reason: user.restrictedReason || "Your account is temporarily restricted from room chat.",
          });
          return;
        }

        // Chat permission check
        const userRole = roomRoles.get(data.roomId)?.get(data.userId);
        const room = await storage.getRoom(data.roomId);
        if (room) {
          const chatPerm = (room as any).chatPermission || "everyone";
          const isRoomOwner = room.ownerId === data.userId;
          if (!isRoomOwner && chatPerm !== "everyone") {
            const isCoOwner = userRole === "co-owner";
            if (chatPerm === "owner_only") {
              socket.emit("room:chat-blocked", { reason: "Only the host can send messages in this room." });
              return;
            }
            if (chatPerm === "co_owners" && !isCoOwner) {
              socket.emit("room:chat-blocked", { reason: "Only the host and co-hosts can send messages in this room." });
              return;
            }
            if (chatPerm === "members" && (userRole === "guest" || userRole === "troll")) {
              socket.emit("room:chat-blocked", { reason: "Guests and trolls cannot send messages in this room." });
              return;
            }
          }
        }

        // Troll restriction: max 50 chars, 10-second cooldown
        if (userRole === "troll") {
          if (data.text.length > 50) {
            socket.emit("room:troll-restricted", { reason: "Your messages are limited to 50 characters as a Troll." });
            return;
          }
          const now = Date.now();
          const lastSent = trollCooldown.get(data.userId) ?? 0;
          if (now - lastSent < 10_000) {
            socket.emit("room:troll-restricted", { reason: `Trolls must wait ${Math.ceil((10_000 - (now - lastSent)) / 1000)}s before sending again.` });
            return;
          }
          trollCooldown.set(data.userId, now);
        }

        // ── Strike mute check ────────────────────────────────────────────────
        const chatMuteStatus = isStrikeMuted(data.userId);
        if (chatMuteStatus.muted) {
          socket.emit("room:chat-blocked", { reason: chatMuteStatus.message, muted: true });
          return;
        }

        // ── Content moderation ───────────────────────────────────────────────
        const chatModResult = checkContent(data.text, "chat", { userId: data.userId, displayName: user?.displayName ?? undefined, avatarUrl: user?.profileImageUrl ?? undefined });
        if (chatModResult.flagged) {
          const chatDn = user?.displayName ?? user?.firstName ?? data.userId;
          const chatStrike = recordStrike(data.userId, chatDn, chatModResult.matchedTerm ?? "unknown", "chat");
          const chatReason = chatStrike.action === "mute" ? chatStrike.message : chatModResult.message;
          socket.emit("room:chat-blocked", { reason: chatReason, muted: chatStrike.action === "mute" });
          return;
        }

        if (data.privateToId && data.privateToId !== data.userId) {
          const participants = roomParticipants.get(data.roomId);
          if (!participants?.has(data.userId) || !participants.has(data.privateToId)) return;
          const targetUser = await storage.getUser(data.privateToId);
          const privateMsg = {
            id: `private-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            roomId: data.roomId,
            userId: data.userId,
            text: data.text,
            createdAt: new Date().toISOString(),
            user,
            messageColor: safeColor,
            cardColor: safeCardColor,
            privateToId: data.privateToId,
            privateToName: targetUser ? getDisplayName(targetUser) : "User",
            isPrivate: true,
            reactions: {},
            replyTo: data.replyTo || null,
          };
          socket.emit("room:chat-message", privateMsg);
          const targetSocketId = userSockets.get(data.privateToId);
          if (targetSocketId) {
            io.to(targetSocketId).emit("room:chat-message", privateMsg);
          }
          return;
        }

        const msg = await storage.createRoomMessage({
          roomId: data.roomId,
          userId: data.userId,
          text: data.text,
        });
        io.to(data.roomId).emit("room:chat-message", { ...msg, user, messageColor: safeColor, cardColor: safeCardColor, replyTo: data.replyTo || null });
      } catch (err) {
        console.error("Error creating room message:", err);
      }
    });

    socket.on("room:chat-delete", async (data: { roomId: string; messageId: string; deletedBy: string; messageUserId?: string }) => {
      try {
        if (!data?.roomId || !data?.deletedBy) return;
        // Allow if: deleting own message, OR room owner, OR co-owner
        const isOwnMessage = data.messageUserId === data.deletedBy;
        if (!isOwnMessage) {
          const room = await storage.getRoom(data.roomId);
          if (!room) return;
          const roles = roomRoles.get(data.roomId);
          const userRole = roles?.get(data.deletedBy);
          if (room.ownerId !== data.deletedBy && userRole !== "co-owner") return;
        }
        io.to(data.roomId).emit("room:chat-delete", { messageId: data.messageId });
      } catch (err) {
        console.error("Error deleting room message:", err);
      }
    });

    socket.on("room:chat-edit", async (data: { roomId: string; messageId: string; newText: string; editedBy: string }) => {
      try {
        const trimmed = (data.newText || "").trim().slice(0, 4000);
        if (!trimmed) return;
        const _editUser = await storage.getUser(data.editedBy);
        const editModResult = checkContent(trimmed, "chat-edit", { userId: data.editedBy, displayName: _editUser?.displayName ?? undefined, avatarUrl: _editUser?.profileImageUrl ?? undefined });
        if (editModResult.flagged) {
          const editStrike = recordStrike(data.editedBy, data.editedBy, editModResult.matchedTerm ?? "unknown", "chat-edit");
          const editReason = editStrike.action === "mute" ? editStrike.message : editModResult.message;
          socket.emit("room:chat-blocked", { reason: editReason, muted: editStrike.action === "mute" });
          return;
        }
        io.to(data.roomId).emit("room:chat-edit", { messageId: data.messageId, newText: trimmed });
      } catch (err) {
        console.error("Error editing room message:", err);
      }
    });

    // Seen receipts — relay to everyone else in the room.
    socket.on("room:chat-seen", (data: { roomId: string; userId: string; messageId: string; userName: string; profileImageUrl?: string | null }) => {
      socket.to(data.roomId).emit("room:chat-seen", {
        userId: data.userId,
        messageId: data.messageId,
        userName: data.userName,
        profileImageUrl: data.profileImageUrl ?? null,
      });
    });

    // Typing indicators — relay to everyone else in the room.
    socket.on("room:typing", (data: { roomId: string; userId: string; displayName: string; profileImageUrl?: string | null }) => {
      socket.to(data.roomId).emit("room:typing", {
        userId: data.userId,
        displayName: data.displayName,
        profileImageUrl: data.profileImageUrl ?? null,
      });
    });

    socket.on("room:typing-stop", (data: { roomId: string; userId: string }) => {
      socket.to(data.roomId).emit("room:typing-stop", { userId: data.userId });
    });

    // DM typing indicators — relay to the recipient's socket only
    socket.on("dm:typing", (data: { toId: string; fromId: string }) => {
      const recipientSocketId = userSockets.get(data.toId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("dm:typing", { fromId: data.fromId });
      }
    });

    socket.on("dm:typing-stop", (data: { toId: string; fromId: string }) => {
      const recipientSocketId = userSockets.get(data.toId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("dm:typing-stop", { fromId: data.fromId });
      }
    });

    socket.on("room:clear-chat-global", async (data: { roomId: string; clearedBy: string }) => {
      try {
        const room = await storage.getRoom(data.roomId);
        if (!room) return;
        const roles = roomRoles.get(data.roomId);
        const userRole = roles?.get(data.clearedBy);
        
        if (room.ownerId === data.clearedBy || userRole === "co-owner") {
          io.to(data.roomId).emit("room:chat-cleared-global");
        }
      } catch (err) {
        console.error("Error global clearing chat:", err);
      }
    });

    // Clear a single participant's messages from the room chat
    socket.on("room:clear-user-chat", async (data: { roomId: string; clearedBy: string; targetUserId: string }) => {
      try {
        const room = await storage.getRoom(data.roomId);
        if (!room) return;
        const roles = roomRoles.get(data.roomId);
        const userRole = roles?.get(data.clearedBy);
        // Only owner or co-owner may clear another user's messages
        if (room.ownerId !== data.clearedBy && userRole !== "co-owner") return;
        // Cannot clear the room owner's messages unless you ARE the owner
        const targetRole = roles?.get(data.targetUserId);
        if (data.targetUserId === room.ownerId && data.clearedBy !== room.ownerId) return;
        io.to(data.roomId).emit("room:user-chat-cleared", { targetUserId: data.targetUserId });
      } catch (err) {
        console.error("Error clearing user chat:", err);
      }
    });

    socket.on("room:pin-message", async (data: { roomId: string; message: any; pinnedBy: string; pinnedByName: string }) => {
      try {
        if (!currentUserId) return;
        const room = await storage.getRoom(data.roomId);
        if (!room) return;
        const roles = roomRoles.get(data.roomId);
        const userRole = roles?.get(currentUserId);
        if (room.ownerId !== currentUserId && userRole !== "co-owner") return;
        const pinState = { message: data.message, pinnedBy: data.pinnedBy, pinnedByName: data.pinnedByName, pinnedAt: Date.now() };
        roomPinnedMessages.set(data.roomId, pinState);
        io.to(data.roomId).emit("room:pinned-message", pinState);
      } catch (err) {
        console.error("Error pinning message:", err);
      }
    });

    socket.on("room:unpin-message", async (data: { roomId: string }) => {
      try {
        if (!currentUserId) return;
        const room = await storage.getRoom(data.roomId);
        if (!room) return;
        const roles = roomRoles.get(data.roomId);
        const userRole = roles?.get(currentUserId);
        if (room.ownerId !== currentUserId && userRole !== "co-owner") return;
        roomPinnedMessages.set(data.roomId, null);
        io.to(data.roomId).emit("room:pinned-message", null);
      } catch (err) {
        console.error("Error unpinning message:", err);
      }
    });

    socket.on("room:react", (data: { roomId: string; messageId: string; emoji: string }) => {
      if (!currentUserId) return;
      if (!roomMessageReactions.has(data.roomId)) {
        roomMessageReactions.set(data.roomId, new Map());
      }
      const msgReactions = roomMessageReactions.get(data.roomId)!;
      const key = `${data.messageId}:${data.emoji}`;
      if (!msgReactions.has(key)) {
        msgReactions.set(key, new Set());
      }
      const users = msgReactions.get(key)!;
      if (users.has(currentUserId)) {
        users.delete(currentUserId);
      } else {
        users.add(currentUserId);
      }
      const reactionMap: Record<string, string[]> = {};
      for (const [k, v] of Array.from(msgReactions.entries())) {
        if (k.startsWith(`${data.messageId}:`)) {
          const emoji = k.slice(data.messageId.length + 1);
          reactionMap[emoji] = Array.from(v);
        }
      }
      io.to(data.roomId).emit("room:reaction-update", {
        messageId: data.messageId,
        reactions: reactionMap,
      });
    });

    // Anyone in the room can start their own video. Whoever starts it becomes
    // the "video host" for that playback session. Closing the video for
    // everyone is restricted to the original starter — others can only hide it
    // for themselves locally.
    // Per-host model: every user owns their own host slot. Setting videoId
    // to null clears only THIS user's slot — other users keep their videos.
    socket.on("room:youtube", async (data: { roomId: string; videoId: string | null }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      if (data.videoId) {
        setYtHost(data.roomId, currentUserId, {
          videoId: data.videoId,
          startedBy: currentUserId,
          playing: true,
          lastTime: 0,
          lastTs: Date.now(),
        });
        // Reset votes for this host since it's a new video
        deleteYtVotes(data.roomId, currentUserId);
        io.to(data.roomId).emit("room:youtube", { hostId: currentUserId, videoId: data.videoId, startedBy: currentUserId });
      } else {
        if (deleteYtHost(data.roomId, currentUserId)) {
          deleteYtVotes(data.roomId, currentUserId);
          io.to(data.roomId).emit("room:youtube", { hostId: currentUserId, videoId: null, startedBy: currentUserId });
        }
      }
    });

    socket.on("room:youtube-state", async (data: { roomId: string; action: string; time?: number; ts?: number }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      // A user only updates their OWN host slot's playhead anchor.
      const ytState = getYtHost(data.roomId, currentUserId);
      if (!ytState) return;
      const t = typeof data.time === "number" ? data.time : ytState.lastTime;
      ytState.lastTime = t;
      ytState.lastTs = Date.now();
      if (data.action === "play") ytState.playing = true;
      else if (data.action === "pause") ytState.playing = false;
      // Broadcast scoped to this host so only watchers of this host listen.
      socket.to(data.roomId).emit("room:youtube-state", {
        hostId: currentUserId,
        action: data.action,
        time: t,
        ts: data.ts ?? Date.now(),
        from: currentUserId,
      });
    });

    // Watching now carries the hostId so other clients know WHICH host's video
    // this user is currently watching (we can have multiple hosts at once).
    socket.on("room:youtube-watching", (data: { roomId: string; hostId: string; watching: boolean }) => {
      if (!currentUserId) return;
      io.to(data.roomId).emit("room:youtube-watchers-update", {
        userId: currentUserId,
        hostId: data.hostId,
        watching: data.watching,
      });
    });

    // ---------- Watch-party voting (likes / dislikes / skip) ----------
    // Votes are now scoped per-host, since each host has their own video.
    const broadcastVotes = (roomId: string, hostId: string) => {
      const v = getYtVotes(roomId, hostId);
      if (!v) {
        io.to(roomId).emit("room:youtube-votes", { hostId, likes: 0, dislikes: 0, skip: 0, myVote: null, mySkip: false });
        return;
      }
      io.to(roomId).emit("room:youtube-votes", {
        hostId,
        videoId: v.videoId,
        likes: v.likes.size,
        dislikes: v.dislikes.size,
        skip: v.skip.size,
        watchers: roomParticipants.get(roomId)?.size || 0,
      });
    };

    socket.on("room:youtube-vote", (data: { roomId: string; hostId?: string; kind: "like" | "dislike" | "none" }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      const hostId = data.hostId || currentUserId;
      const ytState = getYtHost(data.roomId, hostId);
      if (!ytState) return;
      let v = getYtVotes(data.roomId, hostId);
      if (!v || v.videoId !== ytState.videoId) {
        v = { videoId: ytState.videoId, likes: new Set(), dislikes: new Set(), skip: new Set() };
        setYtVotes(data.roomId, hostId, v);
      }
      v.likes.delete(currentUserId);
      v.dislikes.delete(currentUserId);
      if (data.kind === "like") v.likes.add(currentUserId);
      else if (data.kind === "dislike") v.dislikes.add(currentUserId);
      broadcastVotes(data.roomId, hostId);
    });

    socket.on("room:youtube-skip-vote", (data: { roomId: string; hostId?: string; vote: boolean }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      const hostId = data.hostId || currentUserId;
      const ytState = getYtHost(data.roomId, hostId);
      if (!ytState) return;
      let v = getYtVotes(data.roomId, hostId);
      if (!v || v.videoId !== ytState.videoId) {
        v = { videoId: ytState.videoId, likes: new Set(), dislikes: new Set(), skip: new Set() };
        setYtVotes(data.roomId, hostId, v);
      }
      if (data.vote) v.skip.add(currentUserId);
      else v.skip.delete(currentUserId);

      const totalPeople = roomParticipants.get(data.roomId)?.size || 0;
      const threshold = Math.max(2, Math.ceil(totalPeople / 2));
      if (v.skip.size >= threshold) {
        deleteYtVotes(data.roomId, hostId);
        // Advance the SHARED queue but assign the next video to the current
        // host's slot, so they keep being the host of the next clip.
        const queue = roomYoutubeQueue.get(data.roomId);
        if (queue && queue.length > 0) {
          const next = queue.shift()!;
          roomYoutubeQueue.set(data.roomId, queue);
          setYtHost(data.roomId, hostId, {
            videoId: next.videoId,
            startedBy: hostId,
            playing: true,
            lastTime: 0,
            lastTs: Date.now(),
          });
          io.to(data.roomId).emit("room:youtube", { hostId, videoId: next.videoId, startedBy: hostId });
          io.to(data.roomId).emit("room:youtube-queue-update", { queue });
        } else {
          deleteYtHost(data.roomId, hostId);
          io.to(data.roomId).emit("room:youtube", { hostId, videoId: null, startedBy: hostId });
        }
        io.to(data.roomId).emit("room:youtube-skipped", { hostId, reason: "vote" });
        broadcastVotes(data.roomId, hostId);
        return;
      }
      broadcastVotes(data.roomId, hostId);
    });

    // Watch-party reactions: anyone watching can fire a quick emoji that floats
    // up the video for everyone in the room. Lightweight, no persistence.
    socket.on("room:youtube-reaction", (data: { roomId: string; emoji: string }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      const allowed = ["❤️", "👍", "😂", "🔥", "👏", "😮", "🤯"];
      if (!allowed.includes(data.emoji)) return;
      io.to(data.roomId).emit("room:youtube-reaction", {
        userId: currentUserId,
        emoji: data.emoji,
        ts: Date.now(),
      });
    });

    // Movie watch-party reactions: same pattern as YouTube reactions.
    socket.on("room:movie-reaction", (data: { roomId: string; emoji: string }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      const allowed = ["❤️", "🍿", "😂", "😮", "👏", "🔥", "🤯"];
      if (!allowed.includes(data.emoji)) return;
      io.to(data.roomId).emit("room:movie-reaction", {
        userId: currentUserId,
        emoji: data.emoji,
        ts: Date.now(),
      });
    });

    // Screen-share watcher tracking — mirrors the YouTube watcher pattern so that the
    // sharer's avatar can show "X people watching" pills, just like with shared videos.
    socket.on("room:screen-watching", (data: { roomId: string; watching: boolean; sharerId: string }) => {
      if (!currentUserId) return;
      socket.to(data.roomId).emit("room:screen-watchers-update", {
        userId: currentUserId,
        watching: data.watching,
        sharerId: data.sharerId,
      });
    });

    // Free4talk-style: any joining client receives the authoritative playhead snapshot via
    // room:youtube-state right after room:youtube on join, so per-client time-ping requests
    // are no longer necessary. Keep handlers as no-ops for backward compatibility.
    socket.on("room:youtube-time-request", (data: { roomId: string; hostId?: string; requesterId: string }) => {
      if (!currentUserId) return;
      const hostId = data.hostId || currentUserId;
      const ytState = getYtHost(data.roomId, hostId);
      if (!ytState) return;
      const elapsed = ytState.playing ? Math.max(0, (Date.now() - ytState.lastTs) / 1000) : 0;
      const requesterSocketId = userSockets.get(data.requesterId);
      if (requesterSocketId) {
        io.to(requesterSocketId).emit("room:youtube-time-responded", {
          hostId,
          time: ytState.lastTime + elapsed,
          ts: Date.now(),
        });
      }
    });
    socket.on("room:youtube-time-respond", () => {});

    // ---------- YouTube Queue (anyone can queue) ----------
    socket.on("room:youtube-queue-add", async (data: { roomId: string; item: YtQueueItem }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      if (!roomYoutubeQueue.has(data.roomId)) roomYoutubeQueue.set(data.roomId, []);
      const queue = roomYoutubeQueue.get(data.roomId)!;
      // Avoid duplicate videoIds in queue
      if (queue.some(q => q.videoId === data.item.videoId)) return;
      queue.push({ ...data.item, addedBy: currentUserId });
      io.to(data.roomId).emit("room:youtube-queue-update", { queue });
    });

    socket.on("room:youtube-queue-remove", async (data: { roomId: string; id: string }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      const queue = roomYoutubeQueue.get(data.roomId);
      if (!queue) return;
      // Only the person who added a queue item (or the current video starter if
      // they exist) can remove it; everyone else just leaves it alone.
      const item = queue.find(q => q.id === data.id);
      if (!item) return;
      const isAdder = item.addedBy === currentUserId;
      // Any current host is allowed to curate the queue.
      const isCurrentHost = !!getYtHost(data.roomId, currentUserId);
      if (!isAdder && !isCurrentHost) return;
      const filtered = queue.filter(q => q.id !== data.id);
      roomYoutubeQueue.set(data.roomId, filtered);
      io.to(data.roomId).emit("room:youtube-queue-update", { queue: filtered });
    });

    socket.on("room:youtube-queue-next", async (data: { roomId: string }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      // Per-host: advance the queue into THIS user's host slot.
      const queue = roomYoutubeQueue.get(data.roomId);
      if (!queue || queue.length === 0) {
        if (deleteYtHost(data.roomId, currentUserId)) {
          io.to(data.roomId).emit("room:youtube", { hostId: currentUserId, videoId: null, startedBy: currentUserId });
        }
        return;
      }
      const next = queue.shift()!;
      roomYoutubeQueue.set(data.roomId, queue);
      setYtHost(data.roomId, currentUserId, {
        videoId: next.videoId,
        startedBy: currentUserId,
        playing: true,
        lastTime: 0,
        lastTs: Date.now(),
      });
      io.to(data.roomId).emit("room:youtube", { hostId: currentUserId, videoId: next.videoId, startedBy: currentUserId });
      io.to(data.roomId).emit("room:youtube-queue-update", { queue });
    });

    // ---------- Movie watch-party ----------
    socket.on("room:movie", (data: { roomId: string; movieId: string | null; movieTitle?: string; posterPath?: string }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      if (data.movieId) {
        const nowTs = Date.now();
        setMovieHost(data.roomId, currentUserId, {
          movieId: data.movieId,
          movieTitle: data.movieTitle || "",
          posterPath: data.posterPath || "",
          startedBy: currentUserId,
          startedAt: nowTs,
          playing: true,
          lastTime: 0,
          lastTs: nowTs,
        });
        io.to(data.roomId).emit("room:movie", {
          hostId: currentUserId,
          movieId: data.movieId,
          movieTitle: data.movieTitle || "",
          posterPath: data.posterPath || "",
          startedBy: currentUserId,
          startedAt: nowTs,
        });
      } else {
        if (deleteMovieHost(data.roomId, currentUserId)) {
          io.to(data.roomId).emit("room:movie", { hostId: currentUserId, movieId: null, startedBy: currentUserId });
        }
      }
    });

    socket.on("room:movie-watching", (data: { roomId: string; hostId: string; watching: boolean }) => {
      if (!currentUserId) return;
      io.to(data.roomId).emit("room:movie-watchers-update", {
        userId: currentUserId,
        hostId: data.hostId,
        watching: data.watching,
      });
    });

    // Real-time movie playback sync — mirrors room:youtube-state pattern.
    // Only the host emits this; watchers receive and resync their iframe.
    socket.on("room:movie-state", (data: { roomId: string; action: string; time?: number; ts?: number }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      const mState = getMovieHost(data.roomId, currentUserId);
      if (!mState) return;
      const t = typeof data.time === "number" ? data.time : mState.lastTime;
      mState.lastTime = t;
      mState.lastTs = Date.now();
      if (data.action === "play") mState.playing = true;
      else if (data.action === "pause") mState.playing = false;
      socket.to(data.roomId).emit("room:movie-state", {
        hostId: currentUserId,
        action: data.action,
        time: t,
        ts: data.ts ?? Date.now(),
        from: currentUserId,
      });
    });

    // ---------- Chess (built-in board, two seats per room, others spectate) ----------
    socket.on("room:chess-sync-request", (data: { roomId: string }) => {
      if (!currentUserId) return;
      socket.emit("room:chess-state", roomChessState.get(data.roomId) || null);
      socket.emit("room:lichess", roomLichessState.get(data.roomId) || null);
    });

    socket.on("room:chess-claim-seat", async (data: { roomId: string; color: "white" | "black"; timeControl?: number | null }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      const me = await storage.getUser(currentUserId);
      if (!me) return;
      let state = roomChessState.get(data.roomId);
      const tc = data.timeControl ?? null;
      if (!state) {
        state = {
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          pgn: "",
          white: null,
          black: null,
          turn: "w",
          status: "waiting",
          startedAt: Date.now(),
          lastMove: null,
          timeControl: tc,
          clocks: tc ? { white: tc, black: tc, lastTickAt: Date.now() } : null,
          mode: tc ? "timed" : "standard",
        };
        roomChessState.set(data.roomId, state);
      }
      if (state.status === "ended") {
        // Reset on new claim
        state.fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        state.pgn = "";
        state.turn = "w";
        state.status = "waiting";
        state.winner = null;
        state.endReason = null;
        state.white = null;
        state.black = null;
        state.startedAt = Date.now();
        state.lastMove = null;
        state.timeControl = tc;
        state.clocks = tc ? { white: tc, black: tc, lastTickAt: Date.now() } : null;
        state.mode = tc ? "timed" : "standard";
      }
      const displayName = me.displayName || me.firstName || (me.email ? me.email.split("@")[0] : null) || "Player";
      const seat: ChessSeat = { userId: currentUserId, username: displayName, avatar: me.profileImageUrl || null };
      if (data.color === "white") {
        if (state.white && state.white.userId !== currentUserId) return;
        if (state.black?.userId === currentUserId) state.black = null;
        state.white = seat;
      } else {
        if (state.black && state.black.userId !== currentUserId) return;
        if (state.white?.userId === currentUserId) state.white = null;
        state.black = seat;
      }
      if (state.white && state.black) state.status = "playing";
      io.to(data.roomId).emit("room:chess-state", state);
    });

    socket.on("room:chess-leave-seat", (data: { roomId: string }) => {
      if (!currentUserId) return;
      const state = roomChessState.get(data.roomId);
      if (!state) return;
      let changed = false;
      if (state.white?.userId === currentUserId) { state.white = null; changed = true; }
      if (state.black?.userId === currentUserId) { state.black = null; changed = true; }
      if (changed) {
        if (state.status === "playing") {
          state.status = "ended";
          state.endReason = "abandoned";
          state.winner = state.white ? "white" : (state.black ? "black" : "draw");
        } else {
          state.status = "waiting";
        }
        io.to(data.roomId).emit("room:chess-state", state);
      }
    });

    socket.on("room:chess-move", (data: { roomId: string; fen: string; pgn: string; turn: "w" | "b"; lastMove?: { from: string; to: string; san: string }; status?: "playing" | "ended"; winner?: "white" | "black" | "draw" | null; endReason?: string | null }) => {
      if (!currentUserId) return;
      const state = roomChessState.get(data.roomId);
      if (!state || state.status !== "playing") return;
      // Verify the mover holds the seat for the side that just moved (turn flipped).
      // If it's now black's turn, white just moved → must be the white player.
      const moverSide = data.turn === "b" ? "white" : "black";
      const moverSeat = moverSide === "white" ? state.white : state.black;
      if (!moverSeat || moverSeat.userId !== currentUserId) return;
      state.fen = data.fen;
      state.pgn = data.pgn;
      state.turn = data.turn;
      state.lastMove = data.lastMove || null;

      // Update chess clocks for timed games
      if (state.timeControl && state.clocks) {
        const elapsed = Date.now() - state.clocks.lastTickAt;
        state.clocks[moverSide] = Math.max(0, state.clocks[moverSide] - elapsed);
        state.clocks.lastTickAt = Date.now();
        // Check for flag (time ran out)
        if (state.clocks[moverSide] <= 0) {
          state.status = "ended";
          state.winner = moverSide === "white" ? "black" : "white";
          state.endReason = "time";
          io.to(data.roomId).emit("room:chess-state", state);
          return;
        }
      }

      if (data.status === "ended") {
        state.status = "ended";
        state.winner = data.winner ?? null;
        state.endReason = data.endReason ?? null;
      }
      io.to(data.roomId).emit("room:chess-state", state);
    });

    socket.on("room:chess-resign", (data: { roomId: string }) => {
      if (!currentUserId) return;
      const state = roomChessState.get(data.roomId);
      if (!state || state.status !== "playing") return;
      const isWhite = state.white?.userId === currentUserId;
      const isBlack = state.black?.userId === currentUserId;
      if (!isWhite && !isBlack) return;
      state.status = "ended";
      state.endReason = "resign";
      state.winner = isWhite ? "black" : "white";
      io.to(data.roomId).emit("room:chess-state", state);
    });

    socket.on("room:chess-challenge", async (data: { roomId: string; targetUserId: string; color?: "white" | "black" | "random"; timeControl?: number | null }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId) || !participants.has(data.targetUserId)) return;
      if (data.targetUserId === currentUserId) return;
      const existing = roomChessState.get(data.roomId);
      if (existing && existing.status === "playing") return; // game in progress
      const challenger = await storage.getUser(currentUserId);
      if (!challenger) return;
      const targetSocketId = userSockets.get(data.targetUserId);
      if (!targetSocketId) return;
      const challengerName = challenger.displayName || challenger.firstName || (challenger.email ? challenger.email.split("@")[0] : null) || "Someone";
      io.to(targetSocketId).emit("room:chess-challenge", {
        roomId: data.roomId,
        fromUserId: currentUserId,
        fromUsername: challengerName,
        fromAvatar: challenger.profileImageUrl || null,
        color: data.color || "random",
        timeControl: data.timeControl ?? null,
        challengeId: `${currentUserId}-${Date.now()}`,
      });
    });

    socket.on("room:chess-challenge-respond", async (data: { roomId: string; fromUserId: string; accept: boolean; color?: "white" | "black" | "random"; timeControl?: number | null }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId) || !participants.has(data.fromUserId)) return;
      const challengerSocketId = userSockets.get(data.fromUserId);
      const responder = await storage.getUser(currentUserId);
      const responderName = responder ? (responder.displayName || responder.firstName || (responder.email ? responder.email.split("@")[0] : null) || "Player") : "Player";
      if (!data.accept) {
        if (challengerSocketId) {
          io.to(challengerSocketId).emit("room:chess-challenge-declined", { byUserId: currentUserId, byUsername: responderName });
        }
        return;
      }
      // Accept: seat both players and start the game.
      const challenger = await storage.getUser(data.fromUserId);
      if (!challenger || !responder) return;
      const challengerName = challenger.displayName || challenger.firstName || (challenger.email ? challenger.email.split("@")[0] : null) || "Player";
      let challengerColor: "white" | "black";
      const requested = data.color || "random";
      if (requested === "white") challengerColor = "white";
      else if (requested === "black") challengerColor = "black";
      else challengerColor = Math.random() < 0.5 ? "white" : "black";
      const whiteSeat: ChessSeat = challengerColor === "white"
        ? { userId: data.fromUserId, username: challengerName, avatar: challenger.profileImageUrl || null }
        : { userId: currentUserId, username: responderName, avatar: responder.profileImageUrl || null };
      const blackSeat: ChessSeat = challengerColor === "white"
        ? { userId: currentUserId, username: responderName, avatar: responder.profileImageUrl || null }
        : { userId: data.fromUserId, username: challengerName, avatar: challenger.profileImageUrl || null };
      const tc = data.timeControl ?? null;
      const newState = {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        pgn: "",
        white: whiteSeat,
        black: blackSeat,
        turn: "w" as const,
        status: "playing" as const,
        winner: null,
        endReason: null,
        startedAt: Date.now(),
        lastMove: null,
        timeControl: tc,
        clocks: tc ? { white: tc, black: tc, lastTickAt: Date.now() } : null,
        mode: (tc ? "timed" : "standard") as "standard" | "timed",
      };
      roomChessState.set(data.roomId, newState);
      io.to(data.roomId).emit("room:chess-state", newState);
      io.to(data.roomId).emit("room:chess-challenge-accepted", { white: whiteSeat, black: blackSeat });
    });

    socket.on("room:chess-new-game", (data: { roomId: string }) => {
      if (!currentUserId) return;
      const state = roomChessState.get(data.roomId);
      if (!state) return;
      const isPlayer = state.white?.userId === currentUserId || state.black?.userId === currentUserId;
      if (!isPlayer && state.status !== "ended") return;
      roomChessState.delete(data.roomId);
      io.to(data.roomId).emit("room:chess-state", null);
    });

    // ---------- Chess Rematch (swap colors, same time control) ----------
    socket.on("room:chess-rematch", (data: { roomId: string }) => {
      if (!currentUserId) return;
      const state = roomChessState.get(data.roomId);
      if (!state || state.status !== "ended") return;
      const isPlayer = state.white?.userId === currentUserId || state.black?.userId === currentUserId;
      if (!isPlayer) return;
      const tc = state.timeControl ?? null;
      const newState = {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        pgn: "",
        white: state.black,   // swapped
        black: state.white,   // swapped
        turn: "w" as const,
        status: "playing" as const,
        winner: null,
        endReason: null,
        startedAt: Date.now(),
        lastMove: null,
        timeControl: tc,
        clocks: tc ? { white: tc, black: tc, lastTickAt: Date.now() } : null,
        mode: (tc ? "timed" : "standard") as "standard" | "timed",
      };
      roomChessState.set(data.roomId, newState);
      io.to(data.roomId).emit("room:chess-state", newState);
    });

    // ---------- Tic-Tac-Toe ----------
    const TTT_LINES: number[][] = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6],
    ];
    const tttCheckWin = (board: (null | "X" | "O")[]): { winner: "X" | "O"; line: number[] } | null => {
      for (const line of TTT_LINES) {
        const [a,b,c] = line;
        const v = board[a];
        if (v && board[b] === v && board[c] === v) return { winner: v as "X" | "O", line };
      }
      return null;
    };

    socket.on("room:ttt-sync", (data: { roomId: string }) => {
      if (!currentUserId) return;
      socket.emit("room:ttt-state", roomTttState.get(data.roomId) || null);
    });

    socket.on("room:ttt-challenge", async (data: { roomId: string; targetUserId: string }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId) || !participants.has(data.targetUserId)) return;
      if (data.targetUserId === currentUserId) return;
      const challenger = await storage.getUser(currentUserId);
      if (!challenger) return;
      const targetSocketId = userSockets.get(data.targetUserId);
      if (!targetSocketId) return;
      const challengerName = challenger.displayName || challenger.firstName || (challenger.email ? challenger.email.split("@")[0] : null) || "Someone";
      const key = `${data.roomId}:${data.targetUserId}`;
      pendingTttChallenges.set(key, {
        challengerId: currentUserId,
        challengerName,
        challengerAvatar: challenger.profileImageUrl || null,
        roomId: data.roomId,
      });
      io.to(targetSocketId).emit("room:ttt-challenge", {
        fromUserId: currentUserId,
        fromUsername: challengerName,
        fromAvatar: challenger.profileImageUrl || null,
        roomId: data.roomId,
      });
    });

    socket.on("room:ttt-respond", async (data: { roomId: string; fromUserId: string; accept: boolean }) => {
      if (!currentUserId) return;
      const key = `${data.roomId}:${currentUserId}`;
      const pending = pendingTttChallenges.get(key);
      if (!pending || pending.challengerId !== data.fromUserId) return;
      pendingTttChallenges.delete(key);
      const challengerSocket = userSockets.get(data.fromUserId);
      const responder = await storage.getUser(currentUserId);
      const responderName = responder?.displayName || responder?.firstName || (responder?.email ? responder.email.split("@")[0] : null) || "Player";
      if (!data.accept) {
        if (challengerSocket) io.to(challengerSocket).emit("room:ttt-declined", { byUserId: currentUserId, byUsername: responderName });
        return;
      }
      const newState = {
        board: Array(9).fill(null) as (null | "X" | "O")[],
        turn: "X" as "X" | "O",
        status: "active" as "active" | "ended",
        winner: null as "X" | "O" | "draw" | null,
        winLine: null as number[] | null,
        x: { userId: data.fromUserId, username: pending.challengerName, avatar: pending.challengerAvatar },
        o: { userId: currentUserId, username: responderName, avatar: responder?.profileImageUrl || null },
        scores: { x: 0, o: 0, draws: 0 },
        startedAt: Date.now(),
      };
      roomTttState.set(data.roomId, newState);
      io.to(data.roomId).emit("room:ttt-state", newState);
      if (challengerSocket) io.to(challengerSocket).emit("room:ttt-accepted", { byUserId: currentUserId });
    });

    socket.on("room:ttt-move", (data: { roomId: string; idx: number }) => {
      if (!currentUserId) return;
      const s = roomTttState.get(data.roomId);
      if (!s || s.status !== "active") return;
      const sym: "X" | "O" | null = s.x?.userId === currentUserId ? "X" : s.o?.userId === currentUserId ? "O" : null;
      if (!sym || s.turn !== sym) return;
      if (data.idx < 0 || data.idx > 8 || s.board[data.idx] !== null) return;
      s.board[data.idx] = sym;
      const win = tttCheckWin(s.board);
      if (win) {
        s.status = "ended";
        s.winner = win.winner;
        s.winLine = win.line;
        if (win.winner === "X") s.scores.x++; else s.scores.o++;
      } else if (s.board.every((c) => c !== null)) {
        s.status = "ended";
        s.winner = "draw";
        s.scores.draws++;
      } else {
        s.turn = sym === "X" ? "O" : "X";
      }
      io.to(data.roomId).emit("room:ttt-state", s);
    });

    socket.on("room:ttt-rematch", (data: { roomId: string }) => {
      if (!currentUserId) return;
      const s = roomTttState.get(data.roomId);
      if (!s) return;
      const isPlayer = s.x?.userId === currentUserId || s.o?.userId === currentUserId;
      if (!isPlayer) return;
      s.board = Array(9).fill(null);
      // Loser starts next round; on draw alternate
      if (s.winner === "X") s.turn = "O";
      else if (s.winner === "O") s.turn = "X";
      else s.turn = s.turn === "X" ? "O" : "X";
      s.status = "active";
      s.winner = null;
      s.winLine = null;
      s.startedAt = Date.now();
      io.to(data.roomId).emit("room:ttt-state", s);
    });

    socket.on("room:ttt-close", (data: { roomId: string }) => {
      if (!currentUserId) return;
      const s = roomTttState.get(data.roomId);
      if (!s) return;
      const isPlayer = s.x?.userId === currentUserId || s.o?.userId === currentUserId;
      if (!isPlayer) return;
      roomTttState.delete(data.roomId);
      io.to(data.roomId).emit("room:ttt-state", null);
    });

    // ---------- Connect Four ----------
    socket.on("room:c4-sync", (data: { roomId: string }) => {
      if (!currentUserId) return;
      socket.emit("room:c4-state", roomC4State.get(data.roomId) || null);
    });

    socket.on("room:c4-challenge", async (data: { roomId: string; targetUserId: string }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId) || !participants.has(data.targetUserId)) return;
      if (data.targetUserId === currentUserId) return;
      if (roomC4State.get(data.roomId)?.status === "playing") return;
      const challenger = await storage.getUser(currentUserId);
      if (!challenger) return;
      const targetSocketId = userSockets.get(data.targetUserId);
      if (!targetSocketId) return;
      const challengerName = challenger.displayName || challenger.firstName || (challenger.email ? challenger.email.split("@")[0] : null) || "Someone";
      const key = `${data.roomId}:${data.targetUserId}`;
      pendingC4Challenges.set(key, { challengerId: currentUserId, challengerName, challengerAvatar: challenger.profileImageUrl || null, roomId: data.roomId });
      io.to(targetSocketId).emit("room:c4-challenge", {
        fromUserId: currentUserId, fromUsername: challengerName,
        fromAvatar: challenger.profileImageUrl || null, roomId: data.roomId,
      });
    });

    socket.on("room:c4-respond", async (data: { roomId: string; fromUserId: string; accept: boolean }) => {
      if (!currentUserId) return;
      const key = `${data.roomId}:${currentUserId}`;
      const pending = pendingC4Challenges.get(key);
      if (!pending || pending.challengerId !== data.fromUserId) return;
      pendingC4Challenges.delete(key);
      const challengerSocket = userSockets.get(data.fromUserId);
      const responder = await storage.getUser(currentUserId);
      const responderName = responder?.displayName || responder?.firstName || (responder?.email ? responder.email.split("@")[0] : null) || "Player";
      if (!data.accept) {
        if (challengerSocket) io.to(challengerSocket).emit("room:c4-declined", { byUserId: currentUserId, byUsername: responderName });
        return;
      }
      const newBoard: (null | "red" | "yellow")[][] = Array.from({ length: 6 }, () => Array(7).fill(null));
      const newState = {
        board: newBoard,
        turn: "red" as "red" | "yellow",
        status: "playing" as "playing" | "ended",
        winner: null as "red" | "yellow" | "draw" | null,
        winLine: null as [number, number][] | null,
        red: { userId: data.fromUserId, username: pending.challengerName, avatar: pending.challengerAvatar },
        yellow: { userId: currentUserId, username: responderName, avatar: responder?.profileImageUrl || null },
        scores: { red: 0, yellow: 0, draws: 0 },
        startedAt: Date.now(),
      };
      roomC4State.set(data.roomId, newState);
      io.to(data.roomId).emit("room:c4-state", newState);
      if (challengerSocket) io.to(challengerSocket).emit("room:c4-accepted", { byUserId: currentUserId, byUsername: responderName });
    });

    socket.on("room:c4-drop", (data: { roomId: string; col: number }) => {
      if (!currentUserId) return;
      const s = roomC4State.get(data.roomId);
      if (!s || s.status !== "playing") return;
      const color: "red" | "yellow" | null = s.red?.userId === currentUserId ? "red" : s.yellow?.userId === currentUserId ? "yellow" : null;
      if (!color || s.turn !== color) return;
      if (data.col < 0 || data.col >= 7) return;
      let row = -1;
      for (let r = 5; r >= 0; r--) { if (s.board[r][data.col] === null) { row = r; break; } }
      if (row === -1) return;
      s.board[row][data.col] = color;
      const result = c4CheckWin(s.board);
      if (result) {
        s.status = "ended"; s.winner = result.winner; s.winLine = result.line;
        if (result.winner === "red") s.scores.red++;
        else if (result.winner === "yellow") s.scores.yellow++;
        else s.scores.draws++;
      } else {
        s.turn = color === "red" ? "yellow" : "red";
      }
      io.to(data.roomId).emit("room:c4-state", s);
    });

    socket.on("room:c4-resign", (data: { roomId: string }) => {
      if (!currentUserId) return;
      const s = roomC4State.get(data.roomId);
      if (!s || s.status !== "playing") return;
      const color: "red" | "yellow" | null = s.red?.userId === currentUserId ? "red" : s.yellow?.userId === currentUserId ? "yellow" : null;
      if (!color) return;
      s.status = "ended"; s.winner = color === "red" ? "yellow" : "red"; s.winLine = null;
      if (s.winner === "red") s.scores.red++; else s.scores.yellow++;
      io.to(data.roomId).emit("room:c4-state", s);
    });

    socket.on("room:c4-rematch", (data: { roomId: string }) => {
      if (!currentUserId) return;
      const s = roomC4State.get(data.roomId);
      if (!s) return;
      if (s.red?.userId !== currentUserId && s.yellow?.userId !== currentUserId) return;
      s.board = Array.from({ length: 6 }, () => Array(7).fill(null));
      if (s.winner === "red") s.turn = "yellow";
      else if (s.winner === "yellow") s.turn = "red";
      else s.turn = s.turn === "red" ? "yellow" : "red";
      s.status = "playing"; s.winner = null; s.winLine = null; s.startedAt = Date.now();
      io.to(data.roomId).emit("room:c4-state", s);
    });

    socket.on("room:c4-close", (data: { roomId: string }) => {
      if (!currentUserId) return;
      const s = roomC4State.get(data.roomId);
      if (!s) return;
      if (s.red?.userId !== currentUserId && s.yellow?.userId !== currentUserId) return;
      roomC4State.delete(data.roomId);
      io.to(data.roomId).emit("room:c4-state", null);
    });

    // ---------- Lichess shared embed (any participant can share a Lichess URL) ----------
    socket.on("room:lichess", (data: { roomId: string; url: string | null }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      if (!data.url) {
        const cur = roomLichessState.get(data.roomId);
        if (cur && cur.sharedBy !== currentUserId) return; // only sharer can clear
        roomLichessState.delete(data.roomId);
        io.to(data.roomId).emit("room:lichess", null);
        return;
      }
      // Whitelist Lichess URLs only
      if (!/^https?:\/\/(www\.)?lichess\.org\//i.test(data.url)) return;
      roomLichessState.set(data.roomId, { url: data.url, sharedBy: currentUserId });
      io.to(data.roomId).emit("room:lichess", { url: data.url, sharedBy: currentUserId });
    });

    // ---------- JKLM.fun invite / share ----------
    socket.on("room:jklm-sync", (data: { roomId: string }) => {
      socket.emit("room:jklm-state", roomJklmState.get(data.roomId) || null);
    });

    socket.on("room:jklm-share", async (data: { roomId: string; url: string }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      const u = await storage.getUser(currentUserId);
      const name = u?.displayName || u?.firstName || u?.email?.split("@")[0] || "Someone";
      const state = { url: data.url, sharedBy: currentUserId, sharedByName: name };
      roomJklmState.set(data.roomId, state);
      io.to(data.roomId).emit("room:jklm-state", state);
    });

    socket.on("room:jklm-challenge", async (data: { roomId: string; targetUserIds: string[]; url: string }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      const u = await storage.getUser(currentUserId);
      const fromUsername = u?.displayName || u?.firstName || u?.email?.split("@")[0] || "Someone";
      const fromAvatar = u?.profileImageUrl || null;
      for (const targetUserId of data.targetUserIds) {
        const targetSocketId = userSocketMap.get(targetUserId);
        if (targetSocketId) {
          io.to(targetSocketId).emit("room:jklm-invite", {
            fromUserId: currentUserId,
            fromUsername,
            fromAvatar,
            url: data.url,
            roomId: data.roomId,
          });
        }
      }
    });

    socket.on("room:jklm-clear", (data: { roomId: string }) => {
      if (!currentUserId) return;
      const cur = roomJklmState.get(data.roomId);
      if (!cur || cur.sharedBy !== currentUserId) return;
      roomJklmState.delete(data.roomId);
      io.to(data.roomId).emit("room:jklm-state", null);
    });

    socket.on("room:book", (data: { roomId: string; book: any | null }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      if (data.book) {
        roomBookState.set(data.roomId, { book: data.book, hostId: currentUserId, scrollPct: 0, watchers: new Set([currentUserId]) });
        // Include the authoritative watcher list (just the host at session start) so
        // every client resets bookReaders instead of accumulating old-session entries.
        io.to(data.roomId).emit("room:book", { book: data.book, hostId: currentUserId, scrollPct: 0, watchers: [currentUserId] });
      } else {
        if (roomBookState.get(data.roomId)?.hostId === currentUserId) {
          roomBookState.delete(data.roomId);
        }
        io.to(data.roomId).emit("room:book", { book: null, hostId: null, scrollPct: 0, watchers: [] });
      }
    });

    socket.on("room:book-scroll", (data: { roomId: string; scrollPct?: number; page?: number }) => {
      if (!currentUserId) return;
      const state = roomBookState.get(data.roomId);
      if (!state || state.hostId !== currentUserId) return;
      const relay: Record<string, unknown> = {};
      if (data.scrollPct != null) { state.scrollPct = data.scrollPct; relay.scrollPct = data.scrollPct; }
      if (data.page != null) relay.page = data.page;
      if (Object.keys(relay).length > 0) socket.to(data.roomId).emit("room:book-scroll", relay);
    });

    socket.on("room:book-watching", (data: { roomId: string; watching: boolean }) => {
      if (!currentUserId) return;
      const bkState = roomBookState.get(data.roomId);
      if (bkState) {
        if (data.watching) bkState.watchers.add(currentUserId);
        else bkState.watchers.delete(currentUserId);
      }
      io.to(data.roomId).emit("room:book-watchers-update", {
        userId: currentUserId,
        watching: data.watching,
      });
    });

    // Host-only force stop of someone else's screen share. Server checks the requester
    // is the room owner before relaying the stop request to the target user's socket.
    socket.on("room:screen-share-force-stop", async (data: { roomId: string; targetUserId: string }) => {
      if (!currentUserId) return;
      try {
        const room = await storage.getRoom(data.roomId);
        if (!room || room.ownerId !== currentUserId) return;
      } catch (_) { return; }
      const targetSocketId = userSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("room:screen-share-force-stop", { byUserId: currentUserId });
      }
    });

    socket.on("room:screen-share", (data: { roomId: string; userId: string; active: boolean }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      if (data.active) {
        roomScreenShareStatus.set(data.roomId, currentUserId);
      } else {
        if (roomScreenShareStatus.get(data.roomId) === currentUserId) {
          roomScreenShareStatus.delete(data.roomId);
        }
      }
      io.to(data.roomId).emit("room:screen-share", { userId: currentUserId, active: data.active });
    });

    socket.on("room:video-status", (data: { roomId: string; active: boolean }) => {
      if (!currentUserId) return;
      const participants = roomParticipants.get(data.roomId);
      if (!participants || !participants.has(currentUserId)) return;
      if (!roomVideoStatus.has(data.roomId)) {
        roomVideoStatus.set(data.roomId, new Set());
      }
      if (data.active) {
        roomVideoStatus.get(data.roomId)!.add(currentUserId);
      } else {
        roomVideoStatus.get(data.roomId)!.delete(currentUserId);
      }
      io.to(data.roomId).emit("room:video-status", { userId: currentUserId, active: data.active });
    });

    socket.on("webrtc:offer", (data: { offer: any; to: string; roomId: string }) => {
      const targetSocketId = userSockets.get(data.to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc:offer", {
          offer: data.offer,
          from: currentUserId,
        });
      }
    });

    socket.on("webrtc:answer", (data: { answer: any; to: string; roomId: string }) => {
      const targetSocketId = userSockets.get(data.to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc:answer", {
          answer: data.answer,
          from: currentUserId,
        });
      }
    });

    socket.on("webrtc:ice-candidate", (data: { candidate: any; to: string; roomId: string }) => {
      const targetSocketId = userSockets.get(data.to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc:ice-candidate", {
          candidate: data.candidate,
          from: currentUserId,
        });
      }
    });

    // ── AI Tutor room session management ──
    socket.on("room:ai-tutor-start", ({ roomId, userId, username, avatarId, voice, voiceId }: { roomId: string; userId: string; username: string; avatarId?: string; voice?: "Female" | "Male"; voiceId?: string | null }) => {
      const enabled = roomAiTutorEnabled.get(roomId);
      if (enabled === false) {
        socket.emit("room:ai-tutor-disabled");
        return;
      }
      const existing = roomAiTutorState.get(roomId);
      if (existing && existing.userId !== userId) {
        socket.emit("room:ai-tutor-busy", { userId: existing.userId, username: existing.username });
        return;
      }
      const safeAvatarId = typeof avatarId === "string" ? avatarId.slice(0, 40) : "aurora";
      const safeVoice = voice === "Male" ? "Male" : voice === "Eva" ? "Eva" : "Female";
      const safeVoiceId = typeof voiceId === "string" ? voiceId.slice(0, 120) : null;
      roomAiTutorState.set(roomId, { userId, username, speaking: existing?.speaking || false, avatarId: safeAvatarId, voice: safeVoice, voiceId: safeVoiceId });
      io.to(roomId).emit("room:ai-tutor-state", { active: true, userId, username, speaking: existing?.speaking || false, avatarId: safeAvatarId, voice: safeVoice, voiceId: safeVoiceId });
    });

    socket.on("room:ai-tutor-stop", ({ roomId, userId }: { roomId: string; userId: string }) => {
      const existing = roomAiTutorState.get(roomId);
      if (existing?.userId === userId) {
        roomAiTutorState.delete(roomId);
        io.to(roomId).emit("room:ai-tutor-state", { active: false, userId: null, username: null, speaking: false });
      }
    });

    socket.on("room:ai-tutor-speaking", ({ roomId, userId, speaking }: { roomId: string; userId: string; speaking: boolean }) => {
      const existing = roomAiTutorState.get(roomId);
      if (existing?.userId === userId) {
        existing.speaking = speaking;
        io.to(roomId).emit("room:ai-tutor-state", { active: true, userId: existing.userId, username: existing.username, speaking, avatarId: existing.avatarId || "aurora", voice: existing.voice || "Female", voiceId: existing.voiceId || null });
      }
    });

    socket.on("room:ai-tutor-message", ({ roomId, userId, text, correction, correctionFixed, voice, voiceId, speed, avatarId }: {
      roomId: string;
      userId: string;
      text: string;
      correction?: string | null;
      correctionFixed?: string | null;
      voice?: string;
      voiceId?: string | null;
      speed?: number;
      avatarId?: string;
    }) => {
      const existing = roomAiTutorState.get(roomId);
      if (!existing || existing.userId !== userId || typeof text !== "string" || !text.trim()) return;
      socket.to(roomId).emit("room:ai-tutor-message", {
        userId,
        username: existing.username,
        text: text.trim().slice(0, 1200),
        correction: correction || null,
        correctionFixed: correctionFixed || null,
        voice: voice === "Male" ? "Male" : voice === "Eva" ? "Eva" : "Female",
        voiceId: typeof voiceId === "string" ? voiceId.slice(0, 120) : existing.voiceId || null,
        avatarId: typeof avatarId === "string" ? avatarId.slice(0, 40) : existing.avatarId || "aurora",
        speed: typeof speed === "number" ? Math.max(0.5, Math.min(2, speed)) : 0.7,
      });
    });

    // ── room:ai-ask — any participant can send a question to the active AI session ──
    // Validates the session exists, then routes the question to the session owner.
    socket.on("room:ai-ask", ({ roomId, fromUserId, fromUsername, question }: {
      roomId: string; fromUserId: string; fromUsername: string; question: string;
    }) => {
      if (!roomId || !question || typeof question !== "string" || !question.trim()) return;
      const session = roomAiTutorState.get(roomId);
      if (!session || !session.active || !session.userId) return;
      if (session.userId === fromUserId) return; // owner uses their own mic
      const ownerSocketId = userSockets.get(session.userId);
      if (ownerSocketId) {
        io.to(ownerSocketId).emit("room:ai-ask", {
          fromUserId,
          fromUsername: typeof fromUsername === "string" ? fromUsername.slice(0, 60) : "Someone",
          question: question.trim().slice(0, 500),
        });
      }
    });

    socket.on("room:ai-tutor-set-enabled", ({ roomId, userId, enabled }: { roomId: string; userId: string; enabled: boolean }) => {
      // Only host can toggle
      const roles = roomRoles.get(roomId);
      const role = roles?.get(userId) || "participant";
      const participants = roomParticipants.get(roomId);
      const isHost = participants?.has(userId) && (role === "host" || role === "moderator");
      if (!isHost) {
        socket.emit("room:error", { message: "Only the host can change AI Tutor settings." });
        return;
      }
      roomAiTutorEnabled.set(roomId, enabled);
      io.to(roomId).emit("room:ai-tutor-enabled-changed", { enabled });
      // If disabling and someone is using it, kick them off
      if (!enabled) {
        const active = roomAiTutorState.get(roomId);
        if (active) {
          roomAiTutorState.delete(roomId);
          io.to(roomId).emit("room:ai-tutor-state", { active: false, userId: null, username: null, speaking: false });
        }
      }
    });

    // ── Knock allow / deny — host responds to a "🚪 knock-knock" prompt ──
    // The host is in their room and clicks Allow / Deny on a knocker's prompt.
    // We verify the host owns the room, then either grant a one-shot bypass
    // (so the knocker can join even if full) or notify them they were denied.
    socket.on("room:knock-allow", async (data: { roomId: string; userId: string }) => {
      try {
        if (!currentUserId || !data?.roomId || !data?.userId) return;
        const room = await storage.getRoom(data.roomId);
        if (!room || room.ownerId !== currentUserId) return; // only host
        if (!roomKnockGrants.has(data.roomId)) roomKnockGrants.set(data.roomId, new Set());
        roomKnockGrants.get(data.roomId)!.add(data.userId);
        const knockerSocketId = userSockets.get(data.userId);
        if (knockerSocketId) {
          io.to(knockerSocketId).emit("room:knock-allowed", {
            roomId: data.roomId,
            roomTitle: room.title,
          });
        }
      } catch (err) {
        console.error("[knock-allow]", err);
      }
    });

    socket.on("room:knock-deny", async (data: { roomId: string; userId: string }) => {
      try {
        if (!currentUserId || !data?.roomId || !data?.userId) return;
        const room = await storage.getRoom(data.roomId);
        if (!room || room.ownerId !== currentUserId) return; // only host

        // Record denial and compute next cooldown.
        const denialKey = `${data.roomId}:${data.userId}`;
        const existing = knockDenials.get(denialKey);
        const newCount = (existing?.count ?? 0) + 1;
        const banned = newCount >= MAX_KNOCK_DENIALS;
        const cooldownMinutes = banned ? 0 : (KNOCK_COOLDOWN_MINUTES[newCount - 1] ?? KNOCK_COOLDOWN_MINUTES[KNOCK_COOLDOWN_MINUTES.length - 1]);
        const cooldownUntil = banned ? 0 : Date.now() + cooldownMinutes * 60 * 1000;
        knockDenials.set(denialKey, { count: newCount, cooldownUntil });

        const knockerSocketId = userSockets.get(data.userId);
        if (knockerSocketId) {
          io.to(knockerSocketId).emit("room:knock-denied", {
            roomId: data.roomId,
            roomTitle: room.title,
            cooldownUntil,
            cooldownMinutes,
            denialCount: newCount,
            banned,
          });
        }
      } catch (err) {
        console.error("[knock-deny]", err);
      }
    });

    socket.on("disconnect", async () => {
      socketCountries.delete(socket.id);
      if (currentUserId) {
        const disconnectingUserId = currentUserId;
        const timerId = `${disconnectingUserId}-disconnect`;
        const existingTimer = disconnectTimers.get(timerId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          disconnectTimers.delete(timerId);
        }

        let isInRoom = false;
        for (const [, participants] of Array.from(roomParticipants.entries())) {
          if (participants.has(disconnectingUserId)) {
            isInRoom = true;
            break;
          }
        }

        if (!isInRoom) {
          // Give lobby (non-room) users a short grace period too. Without this,
          // any network blip (mobile switching WiFi→4G, Replit proxy hiccup)
          // immediately marks the user offline and makes them invisible to
          // friends/followers — even though they reconnect within a second.
          const lobbyTimer = setTimeout(async () => {
            disconnectTimers.delete(timerId);
            const currentSocketId = userSockets.get(disconnectingUserId);
            if (currentSocketId && currentSocketId !== socket.id) return; // reconnected
            onlineUsers.delete(disconnectingUserId);
            userSockets.delete(disconnectingUserId);
            await storage.updateUserStatus(disconnectingUserId, "offline");
            io.emit("presence:update", { userId: disconnectingUserId, status: "offline" });
          }, 10000);
          disconnectTimers.set(timerId, lobbyTimer);
        } else {
          const timer = setTimeout(async () => {
            disconnectTimers.delete(timerId);

            const currentSocketId = userSockets.get(disconnectingUserId);
            if (currentSocketId && currentSocketId !== socket.id) {
              // User reconnected with a new socket before the grace expired — safe.
              return;
            }
            // Extra guard: check if the new socket is actually connected.
            if (currentSocketId && io.sockets.sockets.get(currentSocketId)?.connected) {
              return;
            }

            onlineUsers.delete(disconnectingUserId);
            userSockets.delete(disconnectingUserId);
            userCurrentRoom.delete(disconnectingUserId);
            await storage.updateUserStatus(disconnectingUserId, "offline");
            io.emit("presence:update", { userId: disconnectingUserId, status: "offline" });

            // Re-check after the async await: if the user sent room:join while
            // we were awaiting updateUserStatus, userCurrentRoom was repopulated.
            // Aborting here prevents the race where the timer deletes a user who
            // has already successfully rejoined, making them invisible to others.
            if (userCurrentRoom.has(disconnectingUserId)) return;

            for (const [roomId, participants] of Array.from(roomParticipants.entries())) {
              if (participants.has(disconnectingUserId)) {
                const disconnectingUser = participants.get(disconnectingUserId);
                let disconnectingDisplayName = disconnectingUser ? getDisplayName(disconnectingUser) : null;
                if (!disconnectingDisplayName) {
                  const dbUser = await storage.getUser(disconnectingUserId);
                  if (dbUser) disconnectingDisplayName = getDisplayName(dbUser);
                }
                participants.delete(disconnectingUserId);

                // Per-user room state cleanup — identical to manual room:leave
                roomVideoStatus.get(roomId)?.delete(disconnectingUserId);
                roomRoles.get(roomId)?.delete(disconnectingUserId);

                if (roomScreenShareStatus.get(roomId) === disconnectingUserId) {
                  roomScreenShareStatus.delete(roomId);
                  io.to(roomId).emit("room:screen-share", { userId: disconnectingUserId, active: false });
                }

                const aiTutorSession = roomAiTutorState.get(roomId);
                if (aiTutorSession?.userId === disconnectingUserId) {
                  roomAiTutorState.delete(roomId);
                  io.to(roomId).emit("room:ai-tutor-state", { active: false, userId: null, username: null, speaking: false });
                }

                // Per-host: clear only the disconnecting user's slot.
                if (deleteYtHost(roomId, disconnectingUserId)) {
                  deleteYtVotes(roomId, disconnectingUserId);
                  io.to(roomId).emit("room:youtube", { hostId: disconnectingUserId, videoId: null, startedBy: disconnectingUserId });
                }

                // Per-host: clear this user's movie host slot if they had one.
                if (deleteMovieHost(roomId, disconnectingUserId)) {
                  io.to(roomId).emit("room:movie", { hostId: disconnectingUserId, movieId: null, startedBy: disconnectingUserId });
                }

                const bkState = roomBookState.get(roomId);
                if (bkState) {
                  bkState.watchers.delete(disconnectingUserId);
                  if (bkState.hostId === disconnectingUserId) {
                    roomBookState.delete(roomId);
                    io.to(roomId).emit("room:book", { book: null, hostId: null, scrollPct: 0, watchers: [] });
                  } else {
                    io.to(roomId).emit("room:book-watchers-update", { userId: disconnectingUserId, watching: false });
                  }
                }

                const remainingParticipants = Array.from(participants.values());
                await storage.updateRoomActiveUsers(roomId, remainingParticipants.length);
                io.to(roomId).emit("room:user-left", {
                  userId: disconnectingUserId,
                  participants: remainingParticipants,
                  displayName: disconnectingDisplayName,
                });
                io.emit("room:participants-update", {
                  roomId,
                  participants: remainingParticipants,
                });

                if (remainingParticipants.length === 0) {
                  roomVideoStatus.delete(roomId);
                  roomScreenShareStatus.delete(roomId);
                  roomYoutubeState.delete(roomId);
                  roomYoutubeQueue.delete(roomId);
                  roomMovieState.delete(roomId);
                  roomRoles.delete(roomId);
                  roomMuteStatus.delete(roomId);
                  startRoomDeleteTimer(roomId);
                } else {
                  roomMuteStatus.get(roomId)?.delete(disconnectingUserId);
                }
              }
            }
          // 90 seconds: covers mobile network switches (WiFi → 4G), tab sleep,
          // Replit proxy hiccups, and slow re-connections without being so long
          // that abandoned users linger visibly in the room for minutes.
          }, 90000);
          disconnectTimers.set(timerId, timer);
        }
      }
    });
  });

  // ── Ghost-user reconciliation ─────────────────────────────────────────────
  // Periodically sweep onlineUsers, userSockets, and roomParticipants for
  // entries whose socket is no longer connected. This catches edge-cases where
  // the disconnect event was lost or a timer was cleared prematurely, preventing
  // users from appearing permanently online/invisible to others, and orphaned
  // room participants keeping rooms alive forever.
  setInterval(async () => {
    for (const [userId, socketId] of Array.from(userSockets.entries())) {
      const sock = io.sockets.sockets.get(socketId);
      if (!sock || !sock.connected) {
        // Only clean up if there is no pending grace timer — if a timer exists
        // it will handle the cleanup at the right time.
        const timerId = `${userId}-disconnect`;
        if (!disconnectTimers.has(timerId)) {
          userSockets.delete(userId);
          onlineUsers.delete(userId);
          userCurrentRoom.delete(userId);
          storage.updateUserStatus(userId, "offline").catch(() => {});
          io.emit("presence:update", { userId, status: "offline" });
        }
      }
    }
    // Also remove anyone in onlineUsers whose socket entry is gone entirely.
    for (const userId of Array.from(onlineUsers)) {
      if (!userSockets.has(userId) && !disconnectTimers.has(`${userId}-disconnect`)) {
        onlineUsers.delete(userId);
        storage.updateUserStatus(userId, "offline").catch(() => {});
        io.emit("presence:update", { userId, status: "offline" });
      }
    }

    // ── Orphaned room-participant reconciliation ───────────────────────────
    // Sweep all in-memory room participant maps and remove any user whose
    // socket is dead and has no pending disconnect grace timer. This prevents
    // ghost participants from keeping a room alive indefinitely after a silent
    // connection drop that the disconnect event never fired for.
    for (const [roomId, participants] of Array.from(roomParticipants.entries())) {
      for (const userId of Array.from(participants.keys())) {
        const timerId = `${userId}-disconnect`;
        if (disconnectTimers.has(timerId)) continue; // grace timer pending — leave it
        const socketId = userSockets.get(userId);
        const sock = socketId ? io.sockets.sockets.get(socketId) : undefined;
        if (!sock || !sock.connected) {
          // Double-check: user still claims this room via userCurrentRoom
          if (userCurrentRoom.get(userId) === roomId) userCurrentRoom.delete(userId);
          participants.delete(userId);
          console.log(`[ghost-sweep] Removed orphaned participant ${userId} from room ${roomId}`);
          const remaining = Array.from(participants.values());
          storage.updateRoomActiveUsers(roomId, remaining.length).catch(() => {});
          io.to(roomId).emit("room:user-left", { userId, participants: remaining, displayName: null });
          io.emit("room:participants-update", { roomId, participants: remaining });
          if (remaining.length === 0) {
            startRoomDeleteTimer(roomId);
          }
        }
      }
    }
  }, 60000);

  // ── Email tracking pixel ──────────────────────────────────────────────────
  // GET /t/o/:id.gif  — 1×1 transparent GIF served when an email is "opened".
  // No auth required (email clients fetch this pixel automatically).
  const TRACKING_GIF = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  app.get("/t/o/:id.gif", async (req, res) => {
    const { id } = req.params;
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      storage.incrementCampaignOpens(id).catch(() => {});
    }
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.end(TRACKING_GIF);
  });

  // GET /t/c/:id?url=... — click tracking redirect.
  app.get("/t/c/:id", async (req, res) => {
    const { id } = req.params;
    const target = req.query.url as string | undefined;
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      storage.incrementCampaignClicks(id).catch(() => {});
    }
    if (target && /^https?:\/\//.test(target)) {
      return res.redirect(302, target);
    }
    res.redirect(302, "/");
  });

  // GET /api/admin/outreach/campaigns — campaign history for superadmin.
  app.get("/api/admin/outreach/campaigns", isAuthenticated, isSuperAdmin, async (_req, res) => {
    try {
      const campaigns = await storage.getEmailCampaigns();
      res.json(campaigns);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  setCleanupContext(io, storage, userSockets);

  return httpServer;
}
