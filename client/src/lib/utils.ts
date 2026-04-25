import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUserDisplayName(user: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
} | null | undefined): string {
  if (!user) return "Unknown";
  if (user.displayName) return user.displayName;
  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(" ");
  }
  if (user.email) return user.email.split("@")[0];
  return "User";
}

export function getUserInitials(user: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} | null | undefined): string {
  if (!user) return "?";
  if (user.displayName) return user.displayName.charAt(0).toUpperCase();
  if (user.firstName) return user.firstName.charAt(0).toUpperCase();
  return "?";
}
