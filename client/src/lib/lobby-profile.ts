import {
  DEFAULT_LOBBY_PROFILE_STYLE,
  type LobbyProfileStyle,
} from "@shared/constants";

export type { LobbyProfileStyle };

export const LOBBY_PROFILE_RADIUS: Record<string, string> = {
  circle: "50%",
  squircle: "12px",
  tile: "12px",
};

export function resolveLobbyProfileStyle(value: unknown): LobbyProfileStyle {
  return value === "circle" ? "circle" : DEFAULT_LOBBY_PROFILE_STYLE;
}

export function lobbyShapeFromStyle(style: LobbyProfileStyle): "circle" | "tile" {
  return style === "circle" ? "circle" : "tile";
}
