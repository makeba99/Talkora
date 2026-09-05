import {
  DEFAULT_LOBBY_PROFILE_STYLE,
  type LobbyProfileStyle,
} from "@shared/constants";

export type { LobbyProfileStyle };

export const LOBBY_PROFILE_RADIUS: Record<string, string> = {
  circle: "50%",
  /* Legacy rounded-square option maps back to the original 16px tile. */
  squircle: "16px",
  tile: "16px",
};

export function resolveLobbyProfileStyle(value: unknown): LobbyProfileStyle {
  return value === "circle" ? "circle" : DEFAULT_LOBBY_PROFILE_STYLE;
}

export function lobbyShapeFromStyle(style: LobbyProfileStyle): "circle" | "tile" {
  return style === "circle" ? "circle" : "tile";
}
