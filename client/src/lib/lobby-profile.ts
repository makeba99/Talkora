import {
  LOBBY_PROFILE_STYLES,
  LOBBY_PROFILE_SIZES,
  DEFAULT_LOBBY_PROFILE_STYLE,
  DEFAULT_LOBBY_PROFILE_SIZE,
  type LobbyProfileStyle,
  type LobbyProfileSize,
} from "@shared/constants";

export type { LobbyProfileStyle, LobbyProfileSize };

export const LOBBY_PROFILE_RADIUS: Record<LobbyProfileStyle, string> = {
  circle: "50%",
  squircle: "22%",
  tile: "12px",
};

export const LOBBY_PROFILE_BASE_PX: Record<LobbyProfileSize, number> = {
  sm: 52,
  md: 70,
  lg: 88,
};

export function resolveLobbyProfileStyle(value: unknown): LobbyProfileStyle {
  return (LOBBY_PROFILE_STYLES as readonly string[]).includes(value as string)
    ? (value as LobbyProfileStyle)
    : DEFAULT_LOBBY_PROFILE_STYLE;
}

export function resolveLobbyProfileSize(value: unknown): LobbyProfileSize {
  return (LOBBY_PROFILE_SIZES as readonly string[]).includes(value as string)
    ? (value as LobbyProfileSize)
    : DEFAULT_LOBBY_PROFILE_SIZE;
}

export function lobbyShapeFromStyle(style: LobbyProfileStyle): "circle" | "rounded" | "tile" {
  if (style === "circle") return "circle";
  if (style === "tile") return "tile";
  return "rounded";
}
