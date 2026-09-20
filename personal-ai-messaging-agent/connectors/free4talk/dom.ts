/** Runs inside the Free4Talk page. Reads only visible DOM. No network, cookies, or tokens. */
export type VisibleChatMessage = {
  id: string;
  senderName: string;
  body: string;
  isPrivate: boolean;
  isMyself: boolean;
  viewed: boolean;
};

export type RoomDomProbe = {
  href: string;
  title: string;
  signInModal: boolean;
  googleSignIn: boolean;
  cloudflareChallenge: boolean;
  chatRootPresent: boolean;
  inputPresent: boolean;
  inputDisabled: boolean;
  sendPresent: boolean;
  sendDisabled: boolean;
  inputPlaceholder: string | null;
  signedInAccountReady: boolean;
  visibleMessageCount: number;
  virtualizedPlaceholders: number;
  messages: VisibleChatMessage[];
};

export function probeRoomDom(): RoomDomProbe {
  const text = document.body?.innerText || "";
  const input = document.querySelector<HTMLTextAreaElement>(
    '.input-send-box textarea, textarea[placeholder*="Type a message"]',
  );
  const send = document.querySelector<HTMLButtonElement>(".input-send-box .send-box");
  const chatRoot = document.querySelector(".react-container.translate-container");
  const items = Array.from(document.querySelectorAll<HTMLElement>(".message[data-message-id]"));
  const messages: VisibleChatMessage[] = items.map((el) => {
    const isPrivate = el.classList.contains("pm-mode") || !!el.querySelector(".pm-name");
    const texts = Array.from(el.querySelectorAll(".text.main-content"))
      .map((n) => (n as HTMLElement).innerText.trim())
      .filter(Boolean);
    const username = (el.querySelector(".name .username") as HTMLElement | null)?.innerText?.trim() || "";
    const isSystem = !!el.querySelector(".system") || el.classList.contains("server-notification");
    // Logged-in own bubbles skip the username row (ChatBoxMessage: name is omitted when isMyself).
    const isMyself = !isPrivate && !isSystem && texts.length > 0 && !username;
    return {
      id: el.getAttribute("data-message-id") || el.id || "",
      senderName: isMyself ? "Me (signed-in room account)" : username,
      body: texts.join("\n"),
      isPrivate,
      isMyself,
      viewed: texts.length > 0 || isSystem,
    };
  });
  const publicViewed = messages.filter((m) => m.viewed && !m.isPrivate && m.body);
  const placeholders = items.filter((el) => !el.querySelector(".text.main-content, .system, .sticker")).length;
  const signedInAccountReady = !!input && !input.disabled;
  return {
    href: location.href,
    title: document.title,
    signInModal: /please sign in to use all features/i.test(text),
    googleSignIn: /accounts\.google\.com/i.test(location.href) || /sign in with google/i.test(text),
    cloudflareChallenge: /just a moment|checking your browser|cf-challenge/i.test(text),
    chatRootPresent: !!chatRoot,
    inputPresent: !!input,
    inputDisabled: !input || input.disabled,
    sendPresent: !!send,
    sendDisabled: !send || send.disabled,
    inputPlaceholder: input?.getAttribute("placeholder") || null,
    signedInAccountReady,
    visibleMessageCount: publicViewed.filter((m) => !m.isMyself).length,
    virtualizedPlaceholders: placeholders,
    messages: publicViewed,
  };
}
