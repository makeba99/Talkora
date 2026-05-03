import { useState, useEffect, useCallback, useRef, lazy, Suspense, useDeferredValue, useMemo } from "react";
import { useLocation } from "wouter";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Search, Mic, ChevronUp, ChevronDown, LogIn, Crown, ShieldCheck, GraduationCap, Users, Heart, MessageCircle, Radio, Flame, MessageSquare, Globe, X, Bell, Palette, Users as UsersIcon, PinOff, Anchor, ArrowRight, LayoutGrid } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RoomCard } from "@/components/room-card";
import { showHintOnce } from "@/lib/hints";
const SiteFooter = lazy(() =>
  import("@/components/site-footer").then((m) => ({ default: m.SiteFooter }))
);
const ScrollJumpButton = lazy(() =>
  import("@/components/scroll-jump-button").then((m) => ({ default: m.ScrollJumpButton }))
);
const CreateRoomDialog = lazy(() =>
  import("@/components/create-room-dialog").then((m) => ({ default: m.CreateRoomDialog }))
);
const MessagesDropdown = lazy(() =>
  import("@/components/messages-dropdown").then((m) => ({ default: m.MessagesDropdown }))
);
const NotificationsDropdown = lazy(() =>
  import("@/components/notifications-dropdown").then((m) => ({ default: m.NotificationsDropdown }))
);
const ProfileDropdown = lazy(() =>
  import("@/components/profile-dropdown").then((m) => ({ default: m.ProfileDropdown }))
);
const PinnedSocialsButton = lazy(() =>
  import("@/components/pinned-socials-button").then((m) => ({ default: m.PinnedSocialsButton }))
);
const CommentThreadDialog = lazy(() =>
  import("@/components/comment-thread-dialog").then((m) => ({ default: m.CommentThreadDialog }))
);
const OnboardingTour = lazy(() =>
  import("@/components/onboarding-tour").then((m) => ({ default: m.OnboardingTour }))
);
const ContextualHints = lazy(() =>
  import("@/components/contextual-hints").then((m) => ({ default: m.ContextualHints }))
);
const DmDialog = lazy(() =>
  import("@/components/dm-dialog").then((m) => ({ default: m.DmDialog }))
);
const SocialPanel = lazy(() =>
  import("@/components/social-panel").then((m) => ({ default: m.SocialPanel }))
);
const ThemePicker = lazy(() =>
  import("@/components/theme-picker").then((m) => ({ default: m.ThemePicker }))
);
import { useLowBandwidthHint } from "@/hooks/use-low-bandwidth-hint";
import { VextornMark } from "@/components/vextorn-logo";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/lib/socket";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LANGUAGES } from "@shared/constants";
import type { Announcement, Follow, Room, User } from "@shared/schema";
import { Button } from "@/components/ui/button";

interface LobbyAnnouncement extends Announcement { viewedAt?: string | null; dismissedAt?: string | null }

type SampleUser = User & {
  profileImageUrl: string | null;
  online: boolean;
  featured?: boolean;
  profileDecoration?: string | null;
  avatarRing?: string | null;
  flairBadge?: string | null;
  bio: string | null;
};

function makeSampleUser(id: string, firstName: string, lastName: string, portrait: string, opts?: Partial<Pick<SampleUser, "bio" | "online" | "featured" | "profileDecoration" | "avatarRing" | "flairBadge">>): SampleUser {
  return {
    id,
    email: null,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    profileImageUrl: `https://randomuser.me/api/portraits/thumb/${portrait}.jpg`,
    bio: opts?.bio || null,
    avatarRing: opts?.ring || null,
    flairBadge: opts?.flair || null,
    profileDecoration: opts?.decoration || null,
    online: opts?.online ?? true,
    featured: opts?.featured ?? false,
    role: "user",
  } as SampleUser;
}

const ALL_SAMPLE_USERS: SampleUser[] = [] as SampleUser[];
const SAMPLE_ROOMS: Room[] = [] as Room[];
const SAMPLE_PEOPLE: SampleUser[] = [] as SampleUser[];

export function Lobby() {
  return null;
}
