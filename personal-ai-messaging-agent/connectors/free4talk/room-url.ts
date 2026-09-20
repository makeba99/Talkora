export const FREE4TALK_ORIGIN = "https://www.free4talk.com";
export const FREE4TALK_LOGIN = "https://www.free4talk.com/login";
export const HILDA_ROOM_URL = "https://www.free4talk.com/room/z2ee2";

const ALLOWED_HOSTS = new Set(["www.free4talk.com", "free4talk.com"]);

export type ParsedRoomUrl =
  | { ok: true; url: string; roomId: string }
  | { ok: false; reason: string };

/**
 * Only the public Free4Talk room page. Rejects heroku hosts, identity hosts,
 * decrypted tokens, and anything that is not https://www.free4talk.com/room/:id.
 */
export function parseFree4TalkRoomUrl(raw: string): ParsedRoomUrl {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "Paste a Free4Talk room URL (https://www.free4talk.com/room/…)." };
  }
  if (/herokuapp\.com/i.test(trimmed) || /identity\.free4talk\.com/i.test(trimmed)) {
    return {
      ok: false,
      reason: "That host is not the public room page. Paste https://www.free4talk.com/room/… from the address bar after you join.",
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "That is not a URL. Paste https://www.free4talk.com/room/… from your browser." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Room URLs must be https on free4talk.com." };
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return { ok: false, reason: "Only https://www.free4talk.com/room/… is accepted. Other hosts are not used." };
  }
  const match = parsed.pathname.match(/^\/room\/([^/]+)\/?$/);
  if (!match?.[1]) {
    return { ok: false, reason: "URL must look like https://www.free4talk.com/room/<roomId>." };
  }
  const roomId = decodeURIComponent(match[1]);
  if (!roomId || roomId.includes("..") || /[\s]/.test(roomId)) {
    return { ok: false, reason: "Room id is missing or invalid." };
  }
  return {
    ok: true,
    url: `${FREE4TALK_ORIGIN}/room/${encodeURIComponent(roomId)}`,
    roomId,
  };
}
