const PREFIX = "vx_knock_cd_";

export interface KnockCooldownData {
  cooldownUntil: number;
  denialCount: number;
  banned: boolean;
}

export function saveKnockCooldown(roomId: string, data: KnockCooldownData): void {
  try { localStorage.setItem(PREFIX + roomId, JSON.stringify(data)); } catch {}
}

export function loadKnockCooldown(roomId: string): KnockCooldownData | null {
  try {
    const raw = localStorage.getItem(PREFIX + roomId);
    return raw ? (JSON.parse(raw) as KnockCooldownData) : null;
  } catch { return null; }
}

export function clearKnockCooldown(roomId: string): void {
  try { localStorage.removeItem(PREFIX + roomId); } catch {}
}
