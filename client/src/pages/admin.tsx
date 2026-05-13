import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Crown, FileWarning, Shield, ShieldAlert, ShieldCheck, Users, GraduationCap, CheckCircle2, XCircle, Clock, DollarSign, Award, Trash2, Megaphone, Ban, Image as ImageIcon, Save, Send, Edit3, ChevronDown, Search, UserPlus, CalendarDays, X, HardDrive, Loader2, Bot, Eye, EyeOff, Zap, Globe2, Cpu, Play, Key, RefreshCw, CheckCircle, Wrench, BarChart2, TrendingUp, MousePointerClick, Globe, DoorOpen, UserCheck, Mail, Bell, BellRing, CreditCard, Smartphone, Building2, BadgeCheck, TrendingDown, Receipt } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUserDisplayName } from "@/lib/utils";
import type { Announcement, Report, User, TeacherApplication, UserBadge } from "@shared/schema";
import { BADGE_TYPES } from "@shared/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GifPickerButton } from "@/components/chat-picker";

const OWNER_EMAIL = "dj55jggg@gmail.com";
type OwnerAnnouncement = Announcement & { viewCount?: number; dismissCount?: number };

// ── AI Tutor configuration types ──────────────────────────────────────────
type TtsProvider = "elevenlabs" | "openai" | "huggingface" | "browser";
type AiTutorConfig = {
  provider: TtsProvider;
  elevenlabs: { apiKeys: string; voiceId: string; modelId: string };
  openai: { apiKey: string; model: string; voice: string };
  huggingface: { apiKey: string; model: string };
};
type AiConfigResponse = {
  config: AiTutorConfig;
  hasKeys: { elevenlabs: boolean; openai: boolean; huggingface: boolean };
};

const ELEVENLABS_MODELS = [
  { value: "eleven_multilingual_v2", label: "Multilingual v2 (recommended)" },
  { value: "eleven_turbo_v2_5", label: "Turbo v2.5 (fast)" },
  { value: "eleven_monolingual_v1", label: "Monolingual v1 (English)" },
];
const OPENAI_MODELS = [
  { value: "tts-1", label: "tts-1 (fast, lower quality)" },
  { value: "tts-1-hd", label: "tts-1-hd (slower, higher quality)" },
];
const OPENAI_VOICES = [
  { value: "alloy", label: "Alloy (neutral)" },
  { value: "echo", label: "Echo (male)" },
  { value: "fable", label: "Fable (British)" },
  { value: "nova", label: "Nova (female, recommended)" },
  { value: "onyx", label: "Onyx (deep)" },
  { value: "shimmer", label: "Shimmer (gentle)" },
];

// Popular ElevenLabs voices for quick picking
const ELEVENLABS_POPULAR_VOICES = [
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", desc: "Female, warm (default Eva)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", desc: "Female, soft" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", desc: "Female, young" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", desc: "Female, calm" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", desc: "Female, strong" },
  { id: "2EiwWnXFnvU5JabPnv8n", name: "Clyde", desc: "Male, war veteran" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", desc: "Male, deep" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", desc: "Male, British" },
];

function ProviderCard({
  provider,
  current,
  icon,
  title,
  description,
  badge,
  onClick,
}: {
  provider: TtsProvider;
  current: TtsProvider;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  onClick: () => void;
}) {
  const active = current === provider;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`card-provider-${provider}`}
      className={`relative flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-all hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active
          ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
          : "border-border/50 bg-card/60"
      }`}
    >
      {active && (
        <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-primary" />
      )}
      <div className="text-xl">{icon}</div>
      <p className="font-semibold text-sm leading-none">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      {badge && (
        <span className="mt-1 inline-block rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
          {badge}
        </span>
      )}
    </button>
  );
}

function MaskedKeyInput({
  value,
  onChange,
  placeholder,
  testId,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  testId: string;
  multiline?: boolean;
}) {
  const [show, setShow] = useState(false);
  if (multiline) {
    return (
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={`font-mono text-xs pr-10 ${!show && value ? "blur-sm select-none" : ""}`}
          data-testid={testId}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
          data-testid={`${testId}-toggle`}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-xs pr-10"
        data-testid={testId}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        data-testid={`${testId}-toggle`}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

type AnalyticsData = {
  dailyViews: { date: string; views: number }[];
  topReferrers: { domain: string; count: number }[];
  topCountries: { country: string; count: number }[];
  topJoinCountries: { country: string; count: number }[];
  totalViews: number;
  uniqueSessions: number;
  redirectViews: number;
  totalRoomJoins: number;
  uniqueRoomJoiners: number;
  dailyJoins: { date: string; joins: number }[];
  todayViews: number;
  todayUniqueVisitors: number;
  todayRoomJoins: number;
  todayUniqueJoiners: number;
  recentJoiners: { userId: string; displayName: string; avatarUrl: string | null; roomId: string; roomName: string; country: string | null; joinedAt: string }[];
  topRooms: { roomId: string; roomName: string; joins: number }[];
  topActiveUsers: { userId: string; displayName: string; avatarUrl: string | null; joins: number; country: string | null }[];
  hourlyActivity: { hour: number; joins: number; views: number }[];
  topPages: { path: string; count: number }[];
  newUsersPerDay: { date: string; count: number }[];
  viewerOnlyCountries: { country: string; count: number }[];
  recentViewers: { country: string | null; path: string; isLoggedIn: boolean; displayName: string | null; viewedAt: string }[];
};

function AnalyticsTab() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError, error, refetch } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/analytics", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics?days=${days}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Analytics API error ${res.status}`);
      }
      return res.json();
    },
    refetchInterval: 60_000,
    retry: 1,
  });

  const chartColor = "hsl(var(--primary))";
  const gridColor = "rgba(255,255,255,0.06)";

  const CustomTooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(var(--foreground))",
  };

  if (isError) {
    return (
      <div className="space-y-6" data-testid="tab-content-analytics">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <ShieldAlert className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-red-300">Analytics unavailable</p>
          <p className="text-xs text-muted-foreground mt-1">{(error as Error)?.message || "Could not load analytics data."}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()} data-testid="button-analytics-retry">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tab-content-analytics">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" />
            Traffic Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Page views, referrers, and visitor locations</p>
        </div>
        <div className="flex items-center gap-2">
          {([7, 30, 90] as const).map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              onClick={() => setDays(d)}
              data-testid={`button-analytics-days-${d}`}
              className="text-xs"
            >
              {d}d
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => refetch()} data-testid="button-analytics-refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* TODAY summary row */}
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300 mb-3 flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" /> Today
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Page Views</p>
            {isLoading ? <Skeleton className="h-6 w-14 mt-1" /> : (
              <p className="text-xl font-bold text-amber-300 mt-0.5" data-testid="text-today-views">{(data?.todayViews ?? 0).toLocaleString()}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Unique Visitors</p>
            {isLoading ? <Skeleton className="h-6 w-14 mt-1" /> : (
              <p className="text-xl font-bold text-amber-300 mt-0.5" data-testid="text-today-unique">{(data?.todayUniqueVisitors ?? 0).toLocaleString()}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><DoorOpen className="w-3 h-3" /> Room Joins</p>
            {isLoading ? <Skeleton className="h-6 w-14 mt-1" /> : (
              <p className="text-xl font-bold text-amber-300 mt-0.5" data-testid="text-today-joins">{(data?.todayRoomJoins ?? 0).toLocaleString()}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><UserCheck className="w-3 h-3" /> Unique Joiners</p>
            {isLoading ? <Skeleton className="h-6 w-14 mt-1" /> : (
              <p className="text-xl font-bold text-amber-300 mt-0.5" data-testid="text-today-joiners">{(data?.todayUniqueJoiners ?? 0).toLocaleString()}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stat cards — page views row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="bg-card/75 border-primary/15">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="w-3.5 h-3.5" /> Page Views
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-2xl font-bold text-primary" data-testid="text-analytics-total-views">
                {(data?.totalViews ?? 0).toLocaleString()}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">last {days} days</p>
          </CardContent>
        </Card>
        <Card className="bg-card/75 border-violet-400/15">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="w-3.5 h-3.5" /> Unique Visitors
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-2xl font-bold text-violet-300" data-testid="text-analytics-unique">
                {(data?.uniqueSessions ?? 0).toLocaleString()}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">last {days} days</p>
          </CardContent>
        </Card>
        <Card className="bg-card/75 border-amber-400/15 col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <MousePointerClick className="w-3.5 h-3.5" /> Redirect Traffic
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-2xl font-bold text-amber-300" data-testid="text-analytics-redirect">
                {(data?.redirectViews ?? 0).toLocaleString()}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">from afikgang.online</p>
          </CardContent>
        </Card>
      </div>

      {/* Room Join stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
        <Card className="bg-card/75 border-emerald-400/15">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DoorOpen className="w-3.5 h-3.5" /> Room Joins
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-2xl font-bold text-emerald-300" data-testid="text-analytics-total-joins">
                {(data?.totalRoomJoins ?? 0).toLocaleString()}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">last {days} days</p>
          </CardContent>
        </Card>
        <Card className="bg-card/75 border-cyan-400/15">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <UserCheck className="w-3.5 h-3.5" /> Unique Joiners
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-2xl font-bold text-cyan-300" data-testid="text-analytics-unique-joiners">
                {(data?.uniqueRoomJoiners ?? 0).toLocaleString()}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">distinct users who joined rooms</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily views line chart */}
      <Card className="bg-card/75 border-primary/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Daily Page Views</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !data?.dailyViews.length ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data yet — views will appear here as visitors arrive.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.dailyViews} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => v.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={CustomTooltipStyle} labelFormatter={(v) => `Date: ${v}`} />
                <Line type="monotone" dataKey="views" stroke={chartColor} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Daily room joins chart */}
      <Card className="bg-card/75 border-emerald-400/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <DoorOpen className="w-3.5 h-3.5 text-emerald-400" /> Daily Room Joins
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !data?.dailyJoins.length ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No joins yet — will populate as users enter rooms.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.dailyJoins} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => v.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={CustomTooltipStyle} labelFormatter={(v) => `Date: ${v}`} />
                <Line type="monotone" dataKey="joins" stroke="hsl(160 60% 55%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Top referrers */}
        <Card className="bg-card/75 border-primary/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <MousePointerClick className="w-3.5 h-3.5" /> Top Referrers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !data?.topReferrers.length ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No referrer data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.topReferrers} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="domain" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={100} />
                  <Tooltip contentStyle={CustomTooltipStyle} />
                  <Bar dataKey="count" fill={chartColor} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top countries (page views) */}
        <Card className="bg-card/75 border-primary/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Top Countries (Visitors)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !data?.topCountries.length ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No location data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.topCountries} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="country" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={32} />
                  <Tooltip contentStyle={CustomTooltipStyle} />
                  <Bar dataKey="count" fill="hsl(270 70% 65%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top countries by room joins */}
      {(data?.topJoinCountries?.length ?? 0) > 0 && (
        <Card className="bg-card/75 border-emerald-400/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-emerald-400" /> Top Countries by Room Joins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data!.topJoinCountries} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <YAxis type="category" dataKey="country" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={32} />
                <Tooltip contentStyle={CustomTooltipStyle} />
                <Bar dataKey="count" fill="hsl(160 60% 55%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Raw referrer list */}
      {data?.topReferrers && data.topReferrers.length > 0 && (
        <Card className="bg-card/75 border-primary/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Referrer Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topReferrers.map((r, i) => {
                const pct = data.totalViews > 0 ? Math.round((r.count / data.totalViews) * 100) : 0;
                const isRedirect = r.domain === "afikgang.online";
                return (
                  <div key={r.domain} className="flex items-center gap-3" data-testid={`row-referrer-${i}`}>
                    <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium truncate flex items-center gap-1">
                          {r.domain}
                          {isRedirect && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded px-1">redirect</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{r.count.toLocaleString()} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isRedirect ? "bg-amber-400" : "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── NEW: Activity by hour heatmap ───────────────────────────────── */}
      <Card className="bg-card/75 border-primary/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Activity by Hour (UTC)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-36 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data?.hourlyActivity ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(h) => `${h}h`} interval={2} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={CustomTooltipStyle} labelFormatter={(h) => `Hour ${h}:00 UTC`} />
                <Bar dataKey="views" name="Page Views" fill={chartColor} radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="joins" name="Room Joins" fill="hsl(160 60% 55%)" radius={[2, 2, 0, 0]} stackId="b" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── NEW: Top pages + new users side-by-side ──────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Top pages */}
        <Card className="bg-card/75 border-primary/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Top Pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !data?.topPages.length ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No page data yet.</div>
            ) : (
              <div className="space-y-1.5">
                {data.topPages.map((p, i) => {
                  const max = data.topPages[0]?.count ?? 1;
                  const pct = Math.round((p.count / max) * 100);
                  return (
                    <div key={p.path} className="flex items-center gap-2" data-testid={`row-page-${i}`}>
                      <span className="text-[10px] text-muted-foreground w-3 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-mono text-foreground truncate">{p.path || "/"}</span>
                          <span className="text-xs text-muted-foreground ml-2 shrink-0">{p.count.toLocaleString()}</span>
                        </div>
                        <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* New users per day */}
        <Card className="bg-card/75 border-violet-400/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-violet-400" /> New Registrations / Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !data?.newUsersPerDay.length ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No registration data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.newUsersPerDay} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip contentStyle={CustomTooltipStyle} labelFormatter={(v) => `Date: ${v}`} />
                  <Bar dataKey="count" name="New Users" fill="hsl(270 70% 65%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── NEW: Top rooms + most active users side-by-side ─────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Top rooms */}
        <Card className="bg-card/75 border-emerald-400/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-emerald-400" /> Most Joined Rooms
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !data?.topRooms.length ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No room data yet.</div>
            ) : (
              <div className="space-y-1.5">
                {data.topRooms.map((r, i) => {
                  const max = data.topRooms[0]?.joins ?? 1;
                  const pct = Math.round((r.joins / max) * 100);
                  return (
                    <div key={r.roomId} className="flex items-center gap-2" data-testid={`row-room-${i}`}>
                      <span className="text-[10px] text-muted-foreground w-3 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium truncate">{r.roomName}</span>
                          <span className="text-xs text-emerald-400 ml-2 shrink-0">{r.joins.toLocaleString()} joins</span>
                        </div>
                        <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500/60" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Most active users */}
        <Card className="bg-card/75 border-cyan-400/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" /> Most Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !data?.topActiveUsers.length ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No activity data yet.</div>
            ) : (
              <div className="space-y-1.5">
                {data.topActiveUsers.map((u, i) => (
                  <div key={u.userId} className="flex items-center gap-2" data-testid={`row-active-user-${i}`}>
                    <span className="text-[10px] text-muted-foreground w-3 text-right shrink-0">{i + 1}</span>
                    <Avatar className="w-5 h-5 shrink-0">
                      <AvatarImage src={u.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[8px]">{u.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{u.displayName}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {u.country && (
                          <img
                            src={`https://flagcdn.com/16x12/${u.country.toLowerCase()}.png`}
                            alt={u.country}
                            className="w-4 h-3 rounded-[2px] object-cover"
                            loading="lazy"
                          />
                        )}
                        <span className="text-xs text-cyan-400">{u.joins} joins</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── NEW: Recent room joiners table ───────────────────────────────── */}
      <Card className="bg-card/75 border-primary/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Recent Room Joiners
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">last 40 events in window</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><Skeleton className="h-48 w-full" /></div>
          ) : !data?.recentJoiners.length ? (
            <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">No join events yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">User</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Room</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Country</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Time (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentJoiners.map((j, i) => (
                    <tr key={`${j.userId}-${j.joinedAt}-${i}`} className="border-b border-border/20 hover:bg-muted/10 transition-colors" data-testid={`row-joiner-${i}`}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-5 h-5 shrink-0">
                            <AvatarImage src={j.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-[8px]">{j.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium truncate max-w-[120px]">{j.displayName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="truncate max-w-[100px] block text-emerald-300">{j.roomName}</span>
                      </td>
                      <td className="px-4 py-2">
                        {j.country ? (
                          <div className="flex items-center gap-1.5">
                            <img
                              src={`https://flagcdn.com/16x12/${j.country.toLowerCase()}.png`}
                              alt={j.country}
                              className="w-4 h-3 rounded-[2px] object-cover"
                              loading="lazy"
                            />
                            <span className="text-muted-foreground">{j.country}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                        {j.joinedAt.replace("T", " ").replace("Z", "")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Viewer-only countries + Recent browse-only viewers ─────────── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Countries of viewers who did NOT join a room */}
        <Card className="bg-card/75 border-amber-400/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-amber-400" /> Browse-Only Countries
              <span className="ml-1 text-[10px] text-muted-foreground/60 font-normal">(viewed but didn't join)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : !data?.viewerOnlyCountries.length ? (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">No browse-only data yet.</div>
            ) : (
              <div className="space-y-1.5">
                {data.viewerOnlyCountries.map((c, i) => {
                  const max = data.viewerOnlyCountries[0]?.count ?? 1;
                  const pct = Math.round((c.count / max) * 100);
                  return (
                    <div key={c.country} className="flex items-center gap-2" data-testid={`row-viewer-country-${i}`}>
                      <span className="text-[10px] text-muted-foreground w-3 text-right shrink-0">{i + 1}</span>
                      <img
                        src={`https://flagcdn.com/16x12/${c.country.toLowerCase()}.png`}
                        alt={c.country}
                        className="w-4 h-3 rounded-[2px] object-cover shrink-0"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium">{c.country.toUpperCase()}</span>
                          <span className="text-xs text-amber-400 ml-2 shrink-0">{c.count.toLocaleString()}</span>
                        </div>
                        <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500/60" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent browse-only viewers */}
        <Card className="bg-card/75 border-amber-400/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-amber-400" /> Recent Browse-Only Visitors
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4"><Skeleton className="h-48 w-full" /></div>
            ) : !data?.recentViewers.length ? (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">No viewer data yet.</div>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                    <tr className="border-b border-border/40">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Visitor</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Page</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Country</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Time (UTC)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentViewers.map((v, i) => (
                      <tr key={i} className="border-b border-border/20 hover:bg-muted/10 transition-colors" data-testid={`row-viewer-${i}`}>
                        <td className="px-4 py-2">
                          {v.isLoggedIn && v.displayName ? (
                            <span className="font-medium text-cyan-300 truncate max-w-[100px] block">{v.displayName}</span>
                          ) : (
                            <span className="text-muted-foreground/60 italic">Anonymous</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span className="truncate max-w-[100px] block text-amber-300/80 font-mono">{v.path}</span>
                        </td>
                        <td className="px-4 py-2">
                          {v.country ? (
                            <div className="flex items-center gap-1.5">
                              <img
                                src={`https://flagcdn.com/16x12/${v.country.toLowerCase()}.png`}
                                alt={v.country}
                                className="w-4 h-3 rounded-[2px] object-cover"
                                loading="lazy"
                              />
                              <span className="text-muted-foreground">{v.country.toUpperCase()}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                          {v.viewedAt.replace("T", " ").slice(0, 16)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type TxData = {
  transactions: Array<{
    id: string; bookingId?: string | null; userId: string; teacherId?: string | null;
    amount: number; currency: string; platformFee: number; teacherAmount: number;
    paymentMethod: string; status: string; description?: string | null;
    idramOrderId?: string | null; confirmedById?: string | null; confirmedAt?: string | null;
    createdAt: string;
  }>;
  stats: { totalRevenue: number; pendingCash: number; completedCount: number; pendingCount: number };
};

function TransactionsTab() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<TxData>({ queryKey: ["/api/admin/transactions"] });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/admin/transactions/${id}/confirm`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      toast({ title: "Payment confirmed", description: "Transaction marked as completed." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const METHOD_ICONS: Record<string, React.ReactNode> = {
    card: <CreditCard className="w-3.5 h-3.5 text-violet-400" />,
    idram: <Smartphone className="w-3.5 h-3.5 text-amber-400" />,
    cash: <Building2 className="w-3.5 h-3.5 text-indigo-400" />,
  };

  const STATUS_COLORS: Record<string, string> = {
    completed: "bg-green-500/20 text-green-300 border-green-500/30",
    pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    pending_cash: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    failed: "bg-red-500/20 text-red-300 border-red-500/30",
    refunded: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  };

  const stats = data?.stats;
  const txs = data?.transactions ?? [];

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: stats ? `$${(stats.totalRevenue / 100).toFixed(2)}` : "—", icon: <DollarSign className="w-4 h-4 text-green-400" />, color: "text-green-300" },
          { label: "Completed", value: stats?.completedCount ?? "—", icon: <BadgeCheck className="w-4 h-4 text-emerald-400" />, color: "text-emerald-300" },
          { label: "Pending", value: stats?.pendingCount ?? "—", icon: <Clock className="w-4 h-4 text-amber-400" />, color: "text-amber-300" },
          { label: "Cash Awaiting", value: stats?.pendingCash ?? "—", icon: <Building2 className="w-4 h-4 text-indigo-400" />, color: "text-indigo-300" },
        ].map(({ label, value, icon, color }) => (
          <Card key={label} className="bg-card/75 backdrop-blur-xl border-primary/15">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-violet-300" />
            All Transactions
            <span className="ml-auto text-xs text-muted-foreground font-normal">{txs.length} records</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : txs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No transactions yet.</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-auto admin-scrollbar pr-1">
              {txs.map((tx) => (
                <div key={tx.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-4 py-3"
                  data-testid={`row-transaction-${tx.id}`}>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {METHOD_ICONS[tx.paymentMethod] ?? <CreditCard className="w-3.5 h-3.5 text-white/30" />}
                    <span className="text-[11px] font-semibold capitalize text-white/70">{tx.paymentMethod}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white/90 truncate">{tx.description ?? "—"}</p>
                    <p className="text-[10px] text-white/40 font-mono">{tx.id.slice(0, 8)}… · {new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[14px] font-bold text-white">${(tx.amount / 100).toFixed(2)}</p>
                    <p className="text-[10px] text-white/35">Fee ${(tx.platformFee / 100).toFixed(2)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[tx.status] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}>
                    {tx.status.replace("_", " ")}
                  </span>
                  {tx.status === "pending_cash" && (
                    <Button
                      size="sm"
                      onClick={() => confirmMutation.mutate(tx.id)}
                      disabled={confirmMutation.isPending}
                      className="h-7 text-[11px] bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30"
                      data-testid={`button-confirm-tx-${tx.id}`}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Confirm
                    </Button>
                  )}
                  {tx.idramOrderId && (
                    <span className="text-[9px] font-mono text-white/30 break-all">{tx.idramOrderId}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MaintenanceTab() {
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<{ active: boolean }>({
    queryKey: ["/api/admin/settings/maintenance"],
  });

  const toggleMutation = useMutation({
    mutationFn: async (active: boolean) => {
      const res = await apiRequest("POST", "/api/admin/settings/maintenance", { active });
      return res.json();
    },
    onSuccess: (result) => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      toast({
        title: result.active ? "Maintenance mode ON" : "Maintenance mode OFF",
        description: result.active
          ? "All non-admin visitors now see the maintenance page."
          : "The platform is now publicly accessible again.",
      });
    },
    onError: () => {
      toast({ title: "Failed to update maintenance mode", variant: "destructive" });
    },
  });

  const isActive = data?.active ?? false;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-400" />
            Maintenance Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <Skeleton className="h-12 w-full rounded-xl" />
          ) : (
            <>
              <div className="flex items-center justify-between rounded-xl border px-5 py-4"
                style={{
                  borderColor: isActive ? "rgba(251,191,36,0.4)" : "rgba(99,102,241,0.2)",
                  background: isActive ? "rgba(251,191,36,0.07)" : "rgba(99,102,241,0.05)",
                }}>
                <div className="space-y-0.5">
                  <p className="font-semibold text-sm">
                    {isActive ? (
                      <span className="text-amber-400">Maintenance is active</span>
                    ) : (
                      <span className="text-emerald-400">Platform is live</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isActive
                      ? "Visitors see the animated maintenance page. Admins are unaffected."
                      : "Everyone can access the platform normally."}
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={(v) => toggleMutation.mutate(v)}
                  disabled={toggleMutation.isPending}
                  data-testid="switch-maintenance"
                />
              </div>

              {isActive && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-300 flex gap-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    All non-admin visitors are currently seeing the maintenance page.
                    Turn off maintenance mode when your changes are ready.
                  </span>
                </div>
              )}

              <div className="rounded-xl border border-border/40 bg-background/30 px-5 py-4 space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground/80">What happens when active:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>All visitors see a full-screen animated maintenance page</li>
                  <li>Superadmins bypass the maintenance page automatically</li>
                  <li>The platform checks status every 30 seconds and recovers instantly when you turn it off</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AiTutorTab() {
  const { toast } = useToast();

  const [provider, setProvider] = useState<TtsProvider>("browser");
  const [elKeys, setElKeys] = useState("");
  const [elVoiceId, setElVoiceId] = useState("XB0fDUnXU5powFXDhCwa");
  const [elModelId, setElModelId] = useState("eleven_multilingual_v2");
  const [oaiKey, setOaiKey] = useState("");
  const [oaiModel, setOaiModel] = useState("tts-1");
  const [oaiVoice, setOaiVoice] = useState("nova");
  const [hfKey, setHfKey] = useState("");
  const [hfModel, setHfModel] = useState("facebook/mms-tts-eng");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [testPlaying, setTestPlaying] = useState(false);

  const { data, isLoading, refetch } = useQuery<AiConfigResponse>({
    queryKey: ["/api/admin/ai-config"],
  });

  useEffect(() => {
    if (!data?.config) return;
    const c = data.config;
    setProvider(c.provider);
    setElKeys(c.elevenlabs.apiKeys);
    setElVoiceId(c.elevenlabs.voiceId);
    setElModelId(c.elevenlabs.modelId);
    setOaiKey(c.openai.apiKey);
    setOaiModel(c.openai.model);
    setOaiVoice(c.openai.voice);
    setHfKey(c.huggingface.apiKey);
    setHfModel(c.huggingface.model);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", "/api/admin/ai-config", {
        config: {
          provider,
          elevenlabs: { apiKeys: elKeys, voiceId: elVoiceId, modelId: elModelId },
          openai: { apiKey: oaiKey, model: oaiModel, voice: oaiVoice },
          huggingface: { apiKey: hfKey, model: hfModel },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-config"] });
      toast({ title: "AI Tutor config saved", description: "Settings will take effect within 30 seconds." });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    },
  });

  // Client-side browser TTS test (no server round-trip needed)
  const testBrowserTts = () => {
    if (!("speechSynthesis" in window)) {
      toast({ title: "Not supported", description: "Your browser does not support the Web Speech API.", variant: "destructive" });
      return;
    }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance("Hello! Eva here. The AI Tutor voice is working perfectly.");
    utt.rate = 1.0;
    utt.pitch = 1.1;
    setTestPlaying(true);
    utt.onend = () => setTestPlaying(false);
    utt.onerror = () => setTestPlaying(false);
    window.speechSynthesis.speak(utt);
  };

  const testMutation = useMutation({
    mutationFn: async () => {
      // Send current (possibly unsaved) form state so the admin can test before saving
      const res = await fetch("/api/admin/ai-config/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            provider,
            elevenlabs: { apiKeys: elKeys, voiceId: elVoiceId, modelId: elModelId },
            openai: { apiKey: oaiKey, model: oaiModel, voice: oaiVoice },
            huggingface: { apiKey: hfKey, model: hfModel },
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return { kind: "info" as const, message: (await res.json()).message };
      }
      const blob = await res.blob();
      return { kind: "audio" as const, url: URL.createObjectURL(blob) };
    },
    onSuccess: (data) => {
      if (data.kind === "info") {
        toast({ title: "Test result", description: data.message });
        return;
      }
      setTestPlaying(true);
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(data.url);
      audioRef.current = audio;
      audio.onended = () => {
        setTestPlaying(false);
        URL.revokeObjectURL(data.url);
      };
      audio.onerror = () => { setTestPlaying(false); };
      audio.play().catch(() => setTestPlaying(false));
    },
    onError: (err: any) => {
      toast({ title: "Test failed", description: err?.message, variant: "destructive" });
    },
  });

  // Warn when the ElevenLabs voice ID looks like an API key
  const elVoiceIdLooksLikeKey = /^sk_[A-Za-z0-9]{10,}/.test(elVoiceId);

  const hasKey = data?.hasKeys;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="w-5 h-5 text-cyan-400" />
            AI Tutor Voice Configuration
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose the TTS provider for Eva (the AI Tutor avatar). Changes take
            effect within 30 seconds without restarting the server.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ProviderCard
                provider="elevenlabs"
                current={provider}
                icon={<Zap className="h-5 w-5 text-yellow-400" />}
                title="ElevenLabs"
                description="Ultra-realistic AI voices with emotion and multilingual support."
                badge="Highest quality"
                onClick={() => setProvider("elevenlabs")}
              />
              <ProviderCard
                provider="openai"
                current={provider}
                icon={<Cpu className="h-5 w-5 text-green-400" />}
                title="OpenAI TTS"
                description="GPT-powered voices. Fast and reliable with multiple styles."
                badge="Best value"
                onClick={() => setProvider("openai")}
              />
              <ProviderCard
                provider="huggingface"
                current={provider}
                icon={<Key className="h-5 w-5 text-orange-400" />}
                title="Hugging Face"
                description="Open-source TTS models via HF Inference API."
                onClick={() => setProvider("huggingface")}
              />
              <ProviderCard
                provider="browser"
                current={provider}
                icon={<Globe2 className="h-5 w-5 text-blue-400" />}
                title="Browser (Free)"
                description="Web Speech API built into the browser. No API key needed."
                badge="No cost"
                onClick={() => setProvider("browser")}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider settings */}
      {!isLoading && provider !== "browser" && (
        <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {provider === "elevenlabs" && <Zap className="h-4 w-4 text-yellow-400" />}
              {provider === "openai" && <Cpu className="h-4 w-4 text-green-400" />}
              {provider === "huggingface" && <Key className="h-4 w-4 text-orange-400" />}
              {provider === "elevenlabs" && "ElevenLabs Settings"}
              {provider === "openai" && "OpenAI TTS Settings"}
              {provider === "huggingface" && "Hugging Face Settings"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {provider === "elevenlabs" && (
              <>
                <div className="space-y-1.5">
                  <Label>
                    API Keys
                    <span className="ml-1.5 text-xs text-muted-foreground">(comma-separated for rotation)</span>
                    {hasKey?.elevenlabs && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle className="h-3 w-3" /> configured
                      </span>
                    )}
                  </Label>
                  <MaskedKeyInput
                    value={elKeys}
                    onChange={setElKeys}
                    placeholder="sk_xxxx, sk_yyyy"
                    testId="input-elevenlabs-keys"
                    multiline
                  />
                  <p className="text-xs text-muted-foreground">
                    Get keys at{" "}
                    <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                      elevenlabs.io
                    </a>. Multiple keys rotate automatically to spread quota.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="el-voice-id">Voice ID</Label>
                    <Input
                      id="el-voice-id"
                      value={elVoiceId}
                      onChange={(e) => setElVoiceId(e.target.value)}
                      placeholder="XB0fDUnXU5powFXDhCwa"
                      className={`font-mono text-xs ${elVoiceIdLooksLikeKey ? "border-red-500/60 focus-visible:ring-red-500/40" : ""}`}
                      data-testid="input-elevenlabs-voice-id"
                    />
                    {elVoiceIdLooksLikeKey && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        This looks like an API key, not a voice ID. Put the API key above and enter a voice ID here (e.g. XB0fDUnXU5powFXDhCwa).
                      </p>
                    )}
                    {!elVoiceIdLooksLikeKey && (
                      <p className="text-xs text-muted-foreground">
                        Default is Charlotte (Eva). Pick a popular voice below or find IDs in your ElevenLabs dashboard.
                      </p>
                    )}
                    {/* Popular voices quick-picker */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {ELEVENLABS_POPULAR_VOICES.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setElVoiceId(v.id)}
                          title={`${v.desc}\n${v.id}`}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            elVoiceId === v.id
                              ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-300"
                              : "border-border/50 bg-background/40 text-muted-foreground hover:border-cyan-500/40 hover:text-foreground"
                          }`}
                          data-testid={`button-el-voice-${v.id}`}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="el-model">Model</Label>
                    <Select value={elModelId} onValueChange={setElModelId}>
                      <SelectTrigger id="el-model" data-testid="select-elevenlabs-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ELEVENLABS_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {provider === "openai" && (
              <>
                <div className="space-y-1.5">
                  <Label>
                    API Key
                    {hasKey?.openai && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle className="h-3 w-3" /> configured
                      </span>
                    )}
                  </Label>
                  <MaskedKeyInput
                    value={oaiKey}
                    onChange={setOaiKey}
                    placeholder="sk-..."
                    testId="input-openai-key"
                  />
                  <p className="text-xs text-muted-foreground">
                    Get a key at{" "}
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                      platform.openai.com
                    </a>.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="oai-model">Model</Label>
                    <Select value={oaiModel} onValueChange={setOaiModel}>
                      <SelectTrigger id="oai-model" data-testid="select-openai-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPENAI_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="oai-voice">Voice</Label>
                    <Select value={oaiVoice} onValueChange={setOaiVoice}>
                      <SelectTrigger id="oai-voice" data-testid="select-openai-voice">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPENAI_VOICES.map((v) => (
                          <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {provider === "huggingface" && (
              <>
                <div className="space-y-1.5">
                  <Label>
                    API Key (HF Token)
                    {hasKey?.huggingface && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle className="h-3 w-3" /> configured
                      </span>
                    )}
                  </Label>
                  <MaskedKeyInput
                    value={hfKey}
                    onChange={setHfKey}
                    placeholder="hf_..."
                    testId="input-hf-key"
                  />
                  <p className="text-xs text-muted-foreground">
                    Get a token at{" "}
                    <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                      huggingface.co/settings/tokens
                    </a>.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hf-model">Model (HF model ID)</Label>
                  <Input
                    id="hf-model"
                    value={hfModel}
                    onChange={(e) => setHfModel(e.target.value)}
                    placeholder="facebook/mms-tts-eng"
                    className="font-mono text-xs"
                    data-testid="input-hf-model"
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommended free models: <code className="bg-muted rounded px-1">facebook/mms-tts-eng</code>,{" "}
                    <code className="bg-muted rounded px-1">microsoft/speecht5_tts</code>
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Browser TTS note */}
      {!isLoading && provider === "browser" && (
        <Card className="bg-card/75 backdrop-blur-xl border-blue-500/20">
          <CardContent className="pt-5 pb-4 flex items-start gap-3">
            <Globe2 className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Browser Web Speech API selected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Eva will speak using the browser's built-in speech synthesis. No server-side
                API key is required. Voice quality depends on the user's OS and browser. This
                works on Chrome, Edge, and Safari. Firefox support is limited.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!isLoading && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2"
            data-testid="button-save-ai-config"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Configuration
          </Button>
          <Button
            variant="outline"
            onClick={() => provider === "browser" ? testBrowserTts() : testMutation.mutate()}
            disabled={testMutation.isPending || testPlaying}
            className="gap-2"
            data-testid="button-test-ai-config"
          >
            {testMutation.isPending || testPlaying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {testPlaying ? "Playing…" : "Test Voice"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="text-muted-foreground hover:text-foreground"
            title="Refresh"
            data-testid="button-refresh-ai-config"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground">
            {provider === "browser"
              ? "Browser TTS plays directly in your browser — no API key needed."
              : "Tests your current settings (no need to save first)."}
          </p>
        </div>
      )}
    </div>
  );
}

function roleLabel(user: User) {
  if (user.email === OWNER_EMAIL || user.role === "superadmin") return "Platform Owner";
  if (user.role === "admin") return "Admin";
  return "User";
}

function RoleBadge({ user }: { user: User }) {
  if (user.email === OWNER_EMAIL || user.role === "superadmin") {
    return (
      <Badge className="owner-badge border-amber-300/60 text-amber-950" data-testid={`badge-owner-${user.id}`}>
        <Crown className="w-3 h-3 mr-1" />
        Platform Owner
      </Badge>
    );
  }

  if (user.role === "admin") {
    return (
      <Badge className="bg-blue-500/15 text-blue-300 border border-blue-400/30" data-testid={`badge-admin-${user.id}`}>
        <ShieldCheck className="w-3 h-3 mr-1" />
        Admin
      </Badge>
    );
  }

  return (
    <Badge variant="outline" data-testid={`badge-user-${user.id}`}>
      User
    </Badge>
  );
}

type CleanupRunRecord = {
  ts: number;
  trigger: "scheduled" | "manual";
  filesDeleted: number;
  bytesFreed: number;
  messagesDeleted: number;
  roomMessagesDeleted: number;
  notificationsDeleted: number;
  reportsDeleted: number;
  durationMs: number;
};

type CleanupStats = {
  enabled: boolean;
  intervalMinutes: number;
  retention: {
    messagesDays: number;
    roomMessagesDays: number;
    notificationsDays: number;
    reportsDays: number;
    orphanFilesDays: number;
  };
  totals: {
    runs: number;
    filesDeleted: number;
    bytesFreed: number;
    messagesDeleted: number;
    roomMessagesDeleted: number;
    notificationsDeleted: number;
    reportsDeleted: number;
  };
  lastRun: CleanupRunRecord | null;
  history: CleanupRunRecord[];
  uploads: { totalFiles: number; totalBytes: number };
  isRunning: boolean;
};

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 2 : 1)} ${units[i]}`;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

type EmailCampaign = {
  id: string;
  subject: string;
  recipientType: string;
  recipientCount: number;
  openCount: number;
  clickCount: number;
  createdAt: string;
};

function OutreachTab({ users }: { users: { id: string; email: string | null; displayName: string | null; firstName: string | null }[] }) {
  const { toast } = useToast();
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailRecipientType, setEmailRecipientType] = useState<"all_registered" | "custom">("all_registered");
  const [customEmails, setCustomEmails] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifTarget, setNotifTarget] = useState<"all_online" | "all_registered" | "specific_user">("all_online");
  const [notifUserId, setNotifUserId] = useState("");
  const [userSearch, setUserSearchLocal] = useState("");

  const registeredWithEmail = users.filter((u) => u.email);
  const filteredForPicker = userSearch
    ? users.filter((u) => {
        const name = (u.displayName || u.firstName || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        return name.includes(userSearch.toLowerCase()) || email.includes(userSearch.toLowerCase());
      })
    : users;

  const { data: campaigns = [], refetch: refetchCampaigns } = useQuery<EmailCampaign[]>({
    queryKey: ["/api/admin/outreach/campaigns"],
    refetchInterval: 30000,
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/outreach/email", {
        subject: emailSubject,
        body: emailBody,
        recipientType: emailRecipientType,
        customEmails,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Emails sent!", description: `Delivered to ${data.sent} recipient${data.sent !== 1 ? "s" : ""}.` });
      setEmailSubject("");
      setEmailBody("");
      setCustomEmails("");
      refetchCampaigns();
    },
    onError: (err: any) => toast({ title: "Failed to send email", description: err.message, variant: "destructive" }),
  });

  const notifMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/outreach/notification", {
        title: notifTitle,
        message: notifMessage,
        targetType: notifTarget,
        userId: notifTarget === "specific_user" ? notifUserId : undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Notification sent!", description: `Delivered to ${data.delivered} user${data.delivered !== 1 ? "s" : ""}.` });
      setNotifTitle("");
      setNotifMessage("");
      setNotifUserId("");
    },
    onError: (err: any) => toast({ title: "Failed to send notification", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6" data-testid="tab-content-outreach">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BellRing className="w-5 h-5 text-primary" />
          Outreach Center
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">Send emails or in-app notifications to your users</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Email Panel */}
        <Card className="bg-card/75 border-blue-400/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-300">
              <Mail className="w-4 h-4" /> Email Broadcast
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Recipients</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={emailRecipientType === "all_registered" ? "default" : "outline"}
                  onClick={() => setEmailRecipientType("all_registered")}
                  className="text-xs"
                  data-testid="button-email-all-registered"
                >
                  All Registered ({registeredWithEmail.length})
                </Button>
                <Button
                  size="sm"
                  variant={emailRecipientType === "custom" ? "default" : "outline"}
                  onClick={() => setEmailRecipientType("custom")}
                  className="text-xs"
                  data-testid="button-email-custom"
                >
                  Custom List
                </Button>
              </div>
            </div>

            {emailRecipientType === "custom" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email addresses (comma, semicolon, or line separated)</Label>
                <Textarea
                  value={customEmails}
                  onChange={(e) => setCustomEmails(e.target.value)}
                  placeholder={"user1@example.com\nuser2@example.com"}
                  rows={4}
                  className="text-xs font-mono resize-none"
                  data-testid="input-custom-emails"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Important update from Vextorn..."
                data-testid="input-email-subject"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Message body</Label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Write your message here..."
                rows={6}
                className="resize-none"
                data-testid="input-email-body"
              />
            </div>

            <div className="rounded-lg bg-blue-500/10 border border-blue-400/20 p-3 text-xs text-blue-300">
              Emails are sent via your configured SMTP account. Requires <code className="font-mono">SMTP_USER</code> and <code className="font-mono">SMTP_PASS</code> secrets.
            </div>

            <Button
              className="w-full"
              onClick={() => emailMutation.mutate()}
              disabled={emailMutation.isPending || !emailSubject.trim() || !emailBody.trim()}
              data-testid="button-send-email"
            >
              {emailMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              {emailMutation.isPending ? "Sending..." : "Send Email"}
            </Button>
          </CardContent>
        </Card>

        {/* Push Notification Panel */}
        <Card className="bg-card/75 border-violet-400/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-violet-300">
              <Bell className="w-4 h-4" /> Push Notification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Target audience</Label>
              <div className="flex flex-wrap gap-2">
                {(["all_online", "all_registered", "specific_user"] as const).map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={notifTarget === t ? "default" : "outline"}
                    onClick={() => { setNotifTarget(t); setNotifUserId(""); }}
                    className="text-xs"
                    data-testid={`button-notif-target-${t}`}
                  >
                    {t === "all_online" ? "All Online" : t === "all_registered" ? "All Users" : "Specific User"}
                  </Button>
                ))}
              </div>
            </div>

            {notifTarget === "specific_user" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Find user</Label>
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearchLocal(e.target.value)}
                  placeholder="Search by name or email..."
                  data-testid="input-notif-user-search"
                />
                {userSearch && filteredForPicker.length > 0 && (
                  <div className="rounded-lg border border-border/50 bg-card max-h-40 overflow-y-auto">
                    {filteredForPicker.slice(0, 8).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setNotifUserId(u.id); setUserSearchLocal(u.displayName || u.firstName || u.email || u.id); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors ${notifUserId === u.id ? "bg-primary/10 text-primary" : ""}`}
                        data-testid={`button-notif-user-${u.id}`}
                      >
                        <span className="font-medium">{u.displayName || u.firstName || "User"}</span>
                        {u.email && <span className="ml-2 text-muted-foreground">{u.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {notifUserId && (
                  <p className="text-xs text-primary flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> User selected
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notification title</Label>
              <Input
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Platform Update"
                data-testid="input-notif-title"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Message</Label>
              <Textarea
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                placeholder="Your message to users..."
                rows={4}
                className="resize-none"
                data-testid="input-notif-message"
              />
            </div>

            <div className="rounded-lg bg-violet-500/10 border border-violet-400/20 p-3 text-xs text-violet-300">
              "All Online" delivers instantly via live connection. "All Users" also stores a persistent in-app notification for offline users.
            </div>

            <Button
              className="w-full bg-violet-600 hover:bg-violet-500"
              onClick={() => notifMutation.mutate()}
              disabled={notifMutation.isPending || !notifTitle.trim() || !notifMessage.trim() || (notifTarget === "specific_user" && !notifUserId)}
              data-testid="button-send-notification"
            >
              {notifMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bell className="w-4 h-4 mr-2" />}
              {notifMutation.isPending ? "Sending..." : "Send Notification"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Campaign History */}
      <Card className="bg-card/75 border-primary/15">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            Email Campaign History
            <Badge variant="outline" className="ml-auto text-xs">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {campaigns.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No campaigns sent yet. Send your first email above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Subject</th>
                    <th className="text-left px-4 py-2 font-medium">Audience</th>
                    <th className="text-right px-4 py-2 font-medium">Sent</th>
                    <th className="text-right px-4 py-2 font-medium">
                      <span className="flex items-center justify-end gap-1"><Eye className="w-3 h-3" /> Opens</span>
                    </th>
                    <th className="text-right px-4 py-2 font-medium">
                      <span className="flex items-center justify-end gap-1"><MousePointerClick className="w-3 h-3" /> Clicks</span>
                    </th>
                    <th className="text-right px-4 py-2 font-medium">Sent at</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const openRate = c.recipientCount > 0 ? Math.round((c.openCount / c.recipientCount) * 100) : 0;
                    const clickRate = c.recipientCount > 0 ? Math.round((c.clickCount / c.recipientCount) * 100) : 0;
                    return (
                      <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors" data-testid={`row-campaign-${c.id}`}>
                        <td className="px-4 py-2.5 max-w-[200px]">
                          <span className="truncate block font-medium text-foreground/90" title={c.subject}>{c.subject}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="text-[10px]">
                            {c.recipientType === "all_registered" ? "All users" : "Custom list"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{c.recipientCount.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="tabular-nums">{c.openCount}</span>
                          <span className={`ml-1.5 tabular-nums ${openRate >= 20 ? "text-green-400" : openRate >= 10 ? "text-amber-400" : "text-muted-foreground"}`}>
                            ({openRate}%)
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="tabular-nums">{c.clickCount}</span>
                          <span className={`ml-1.5 tabular-nums ${clickRate >= 5 ? "text-green-400" : clickRate >= 2 ? "text-amber-400" : "text-muted-foreground"}`}>
                            ({clickRate}%)
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{formatRelative(new Date(c.createdAt).getTime())}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StorageTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { toast } = useToast();
  const { data: stats, isLoading } = useQuery<CleanupStats>({
    queryKey: ["/api/admin/cleanup/stats"],
    refetchInterval: 15_000,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/cleanup/run");
      return res.json() as Promise<{ record: CleanupRunRecord; stats: CleanupStats }>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/admin/cleanup/stats"], data.stats);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cleanup/stats"] });
      const r = data.record;
      toast({
        title: "Cleanup complete",
        description: `Removed ${r.filesDeleted} file${r.filesDeleted !== 1 ? "s" : ""} (${formatBytes(r.bytesFreed)}) in ${r.durationMs}ms.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Cleanup failed", description: err?.message || "Unknown error", variant: "destructive" });
    },
  });

  if (isLoading || !stats) {
    return (
      <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
        <CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  const pendingOrphans = Math.max(0, stats.uploads.totalFiles - (stats.lastRun?.filesDeleted ?? 0));

  return (
    <div className="space-y-4">
      <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-cyan-300" />
            Auto-Cleanup
            <Badge variant={stats.enabled ? "default" : "outline"} className="ml-2" data-testid="badge-cleanup-status">
              {stats.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-background/55 p-4">
              <p className="text-xs text-muted-foreground">Total files cleaned</p>
              <p className="text-2xl font-bold" data-testid="text-cleanup-total-files">{stats.totals.filesDeleted}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatBytes(stats.totals.bytesFreed)} freed</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/55 p-4">
              <p className="text-xs text-muted-foreground">Cleanup runs</p>
              <p className="text-2xl font-bold" data-testid="text-cleanup-runs">{stats.totals.runs}</p>
              <p className="text-xs text-muted-foreground mt-1">every {stats.intervalMinutes} min</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/55 p-4">
              <p className="text-xs text-muted-foreground">Last run</p>
              <p className="text-2xl font-bold" data-testid="text-cleanup-last-run">
                {stats.lastRun ? formatRelative(stats.lastRun.ts) : "never"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.lastRun ? `${stats.lastRun.filesDeleted} files · ${formatBytes(stats.lastRun.bytesFreed)}` : "no runs yet"}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/55 p-4">
              <p className="text-xs text-muted-foreground">Uploads on disk</p>
              <p className="text-2xl font-bold" data-testid="text-uploads-total">{stats.uploads.totalFiles}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatBytes(stats.uploads.totalBytes)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/40 p-4 text-sm space-y-2">
            <p className="font-medium flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-cyan-300" />
              Retention policy
            </p>
            <ul className="text-xs text-muted-foreground grid gap-1 sm:grid-cols-2">
              <li>Direct messages older than <span className="text-foreground font-medium">{stats.retention.messagesDays}d</span> are deleted</li>
              <li>Room messages older than <span className="text-foreground font-medium">{stats.retention.roomMessagesDays}d</span> are deleted</li>
              <li>Read notifications older than <span className="text-foreground font-medium">{stats.retention.notificationsDays}d</span> are deleted</li>
              <li>Resolved reports older than <span className="text-foreground font-medium">{stats.retention.reportsDays}d</span> are deleted</li>
              <li>Unreferenced upload files older than <span className="text-foreground font-medium">{stats.retention.orphanFilesDays}d</span> are removed</li>
            </ul>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground">
              {stats.uploads.totalFiles} file{stats.uploads.totalFiles !== 1 ? "s" : ""} currently in <code className="font-mono">/uploads</code>.
              {pendingOrphans > 0 && <> Up to {pendingOrphans} may be eligible for cleanup at the next run.</>}
            </div>
            {isSuperAdmin ? (
              <Button
                onClick={() => runMutation.mutate()}
                disabled={runMutation.isPending || stats.isRunning}
                data-testid="button-run-cleanup-now"
              >
                {(runMutation.isPending || stats.isRunning) ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running…</>
                ) : (
                  <><Trash2 className="w-4 h-4 mr-2" /> Run cleanup now</>
                )}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground italic">Only the platform owner can trigger a manual run.</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
        <CardHeader>
          <CardTitle className="text-base">Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-cleanup-history">
              No cleanup runs recorded yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-auto admin-scrollbar pr-2">
              {stats.history.map((r) => (
                <div
                  key={r.ts}
                  className="rounded-lg border border-border/60 bg-background/55 p-3 flex flex-wrap items-center gap-3 text-sm"
                  data-testid={`row-cleanup-history-${r.ts}`}
                >
                  <Badge variant={r.trigger === "manual" ? "default" : "secondary"} className="capitalize">
                    {r.trigger}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{new Date(r.ts).toLocaleString()}</span>
                  <span className="text-xs">·</span>
                  <span><span className="font-semibold">{r.filesDeleted}</span> file{r.filesDeleted !== 1 ? "s" : ""}</span>
                  <span className="text-muted-foreground">({formatBytes(r.bytesFreed)})</span>
                  {r.messagesDeleted > 0 && <span className="text-xs text-muted-foreground">{r.messagesDeleted} DM</span>}
                  {r.roomMessagesDeleted > 0 && <span className="text-xs text-muted-foreground">{r.roomMessagesDeleted} room msg</span>}
                  {r.notificationsDeleted > 0 && <span className="text-xs text-muted-foreground">{r.notificationsDeleted} notif</span>}
                  {r.reportsDeleted > 0 && <span className="text-xs text-muted-foreground">{r.reportsDeleted} report</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{r.durationMs}ms</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  useDocumentMeta({
    title: "Admin",
    description: "Vextorn admin tools.",
    noIndex: true,
  });
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const canAccess = user?.role === "admin" || user?.role === "superadmin" || user?.email === OWNER_EMAIL;
  const isSuperAdmin = user?.role === "superadmin" || user?.email === OWNER_EMAIL;

  const [approveOpen, setApproveOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<(TeacherApplication & { user: any }) | null>(null);
  const [approvedRate, setApprovedRate] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [badgeUserId, setBadgeUserId] = useState("");
  const [badgeType, setBadgeType] = useState("");
  const [announcementKind, setAnnouncementKind] = useState("platform");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementBodyAfterMedia, setAnnouncementBodyAfterMedia] = useState("");
  const [announcementMediaPosition, setAnnouncementMediaPosition] = useState<"above" | "below" | "between">("below");
  const [announcementMediaUrls, setAnnouncementMediaUrls] = useState<string[]>([]);
  const [announcementMediaTypes, setAnnouncementMediaTypes] = useState<("image" | "gif")[]>([]);
  const [announcementShowOnLobby, setAnnouncementShowOnLobby] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [restrictDaysMap, setRestrictDaysMap] = useState<Record<string, number>>({});
  const [userSearch, setUserSearch] = useState("");
  const [newRegPeriod, setNewRegPeriod] = useState<"today" | "yesterday" | "week" | "month" | null>(null);
  const [userIdLookup, setUserIdLookup] = useState("");
  const [lookupResult, setLookupResult] = useState<User | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!canAccess,
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery<Report[]>({
    queryKey: ["/api/admin/reports"],
    enabled: !!canAccess,
  });

  const { data: teacherApps = [], isLoading: appsLoading } = useQuery<(TeacherApplication & { user: any })[]>({
    queryKey: ["/api/admin/teacher-applications"],
    enabled: !!canAccess,
  });

  const { data: allBadges = [], isLoading: badgesLoading } = useQuery<(UserBadge & { userName: string; userAvatar: string | null })[]>({
    queryKey: ["/api/admin/badges"],
    enabled: !!canAccess,
  });

  const { data: badgeApplications = [], isLoading: badgeApplicationsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/badge-applications"],
    enabled: !!canAccess,
  });

  const { data: announcements = [], isLoading: announcementsLoading } = useQuery<OwnerAnnouncement[]>({
    queryKey: ["/api/admin/announcements"],
    enabled: !!isSuperAdmin,
  });

  const { data: securityEvents = [], isLoading: securityEventsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/security-events"],
    enabled: !!canAccess,
    refetchInterval: 30000,
  });

  const { data: securityCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/security-events/count"],
    enabled: !!canAccess,
    refetchInterval: 30000,
  });
  const securityEventCount = securityCountData?.count ?? 0;

  const resolveSecurityEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/admin/security-events/${id}/resolve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-events/count"] });
      toast({ title: "Event resolved" });
    },
    onError: (err: any) => toast({ title: "Failed to resolve", description: err.message, variant: "destructive" }),
  });

  const awardBadgeMutation = useMutation({
    mutationFn: async ({ userId, badgeType }: { userId: string; badgeType: string }) => {
      const res = await apiRequest("POST", "/api/admin/badges/award", { userId, badgeType });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/badges"] });
      toast({ title: "Badge awarded!", description: "The badge announcement has been sent to all users." });
      setBadgeUserId("");
      setBadgeType("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to award badge", description: err?.message, variant: "destructive" });
    },
  });

  const removeBadgeMutation = useMutation({
    mutationFn: async (badgeId: string) => {
      await apiRequest("DELETE", `/api/admin/badges/${badgeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/badges"] });
      toast({ title: "Badge removed" });
    },
  });

  const reviewBadgeApplicationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/admin/badge-applications/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/badge-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/badges"] });
      toast({ title: "Badge application updated" });
    },
    onError: (err: any) => toast({ title: "Failed to review application", description: err.message, variant: "destructive" }),
  });

  const reportsByUser = useMemo(() => {
    const counts = new Map<string, number>();
    reports.forEach((report) => {
      counts.set(report.reportedId, (counts.get(report.reportedId) || 0) + 1);
    });
    return counts;
  }, [reports]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => {
      const name = getUserDisplayName(u).toLowerCase();
      const email = (u.email || "").toLowerCase();
      const role = roleLabel(u).toLowerCase();
      const id = u.id.toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q) || id.includes(q);
    });
  }, [users, userSearch]);

  const newRegCounts = useMemo(() => {
    const now = new Date();
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayStart = startOf(now);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(todayStart.getDate() - 1);
    const weekStart = new Date(todayStart); weekStart.setDate(todayStart.getDate() - 7);
    const monthStart = new Date(todayStart); monthStart.setDate(todayStart.getDate() - 30);
    const counts = { today: 0, yesterday: 0, week: 0, month: 0 };
    for (const u of users) {
      const t = new Date(u.createdAt).getTime();
      if (t >= todayStart.getTime()) counts.today++;
      else if (t >= yesterdayStart.getTime()) counts.yesterday++;
      if (t >= weekStart.getTime()) counts.week++;
      if (t >= monthStart.getTime()) counts.month++;
    }
    return counts;
  }, [users]);

  const newRegUsers = useMemo(() => {
    if (!newRegPeriod) return [];
    const now = new Date();
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayStart = startOf(now);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(todayStart.getDate() - 1);
    const weekStart = new Date(todayStart); weekStart.setDate(todayStart.getDate() - 7);
    const monthStart = new Date(todayStart); monthStart.setDate(todayStart.getDate() - 30);
    return users.filter((u) => {
      const t = new Date(u.createdAt).getTime();
      if (newRegPeriod === "today") return t >= todayStart.getTime();
      if (newRegPeriod === "yesterday") return t >= yesterdayStart.getTime() && t < todayStart.getTime();
      if (newRegPeriod === "week") return t >= weekStart.getTime();
      if (newRegPeriod === "month") return t >= monthStart.getTime();
      return false;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [users, newRegPeriod]);

  const approveMutation = useMutation({
    mutationFn: async ({ id, rate, notes }: { id: string; rate: number; notes: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/teacher-applications/${id}/approve`, { approvedRate: rate, adminNotes: notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teacher-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      toast({ title: "Application approved", description: "Teacher profile has been created." });
      setApproveOpen(false);
      setSelectedApp(null);
      setApprovedRate("");
      setAdminNotes("");
    },
    onError: (err: any) => toast({ title: "Failed to approve", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/teacher-applications/${id}/reject`, { adminNotes: notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teacher-applications"] });
      toast({ title: "Application rejected" });
      setRejectOpen(false);
      setSelectedApp(null);
      setRejectNotes("");
    },
    onError: (err: any) => toast({ title: "Failed to reject", description: err.message, variant: "destructive" }),
  });

  const stats = useMemo(() => {
    const pending = reports.filter((report) => report.status === "pending").length;
    const warned = users.filter((item) => item.warningCount > 0).length;
    const admins = users.filter((item) => item.role === "admin" || item.role === "superadmin" || item.email === OWNER_EMAIL).length;
    const pendingApps = teacherApps.filter((a) => a.status === "pending").length;
    return { pending, warned, admins, pendingApps };
  }, [reports, users, teacherApps]);

  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, status }: { reportId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/reports/${reportId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      toast({ title: "Report updated" });
    },
    onError: (error: any) => toast({ title: "Failed to update report", description: error.message, variant: "destructive" }),
  });

  const warnMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/admin/warn/${userId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Warning sent", description: "The user was notified immediately." });
    },
    onError: (error: any) => toast({ title: "Failed to warn user", description: error.message, variant: "destructive" }),
  });

  const restrictMutation = useMutation({
    mutationFn: async ({ userId, days }: { userId: string; days: number }) => {
      const restrictionDays = Math.min(365, Math.max(1, Number(days) || 1));
      const res = await apiRequest("POST", `/api/admin/users/${userId}/restrict`, {
        days: restrictionDays,
        reason: `Restricted by Platform Owner for ${restrictionDays} day${restrictionDays === 1 ? "" : "s"}.`,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Restriction updated", description: "The user was notified immediately." });
    },
    onError: (error: any) => toast({ title: "Failed to restrict user", description: error.message, variant: "destructive" }),
  });

  const liftRestrictionMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}/restrict`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Restriction lifted" });
    },
    onError: (error: any) => toast({ title: "Failed to lift restriction", description: error.message, variant: "destructive" }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms/participants"] });
      toast({ title: "User account deleted", description: "The account and related platform data were removed." });
    },
    onError: (error: any) => toast({ title: "Failed to delete user", description: error.message, variant: "destructive" }),
  });

  const resetAnnouncementForm = () => {
    setAnnouncementTitle("");
    setAnnouncementBody("");
    setAnnouncementBodyAfterMedia("");
    setAnnouncementMediaPosition("below");
    setAnnouncementKind("platform");
    setAnnouncementMediaUrls([]);
    setAnnouncementMediaTypes([]);
    setAnnouncementShowOnLobby(false);
    setEditingAnnouncementId(null);
  };

  const startEditingAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncementId(announcement.id);
    setAnnouncementTitle(announcement.title);
    setAnnouncementBody(announcement.body);
    setAnnouncementBodyAfterMedia((announcement as any).bodyAfterMedia || "");
    setAnnouncementMediaPosition(((announcement as any).mediaPosition as "above" | "below" | "between") || "below");
    setAnnouncementKind(announcement.kind);
    setAnnouncementMediaUrls(announcement.mediaUrls || []);
    setAnnouncementMediaTypes((announcement.mediaTypes || []) as ("image" | "gif")[]);
    setAnnouncementShowOnLobby((announcement as any).showOnLobby || false);
  };

  const uploadAnnouncementMediaMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("media", file);
      const response = await fetch("/api/admin/announcements/media", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Upload failed");
      }
      return response.json() as Promise<{ url: string; type: "image" | "gif" }>;
    },
    onSuccess: (media) => {
      setAnnouncementMediaUrls((current) => [...current, media.url].slice(0, 4));
      setAnnouncementMediaTypes((current) => [...current, media.type].slice(0, 4));
      toast({ title: "Media attached", description: "The image or GIF is ready for this announcement." });
    },
    onError: (error: any) => toast({ title: "Media upload failed", description: error.message, variant: "destructive" }),
  });

  const saveAnnouncementMutation = useMutation({
    mutationFn: async (status: "draft" | "published") => {
      const payload = {
        title: announcementTitle,
        body: announcementBody,
        bodyAfterMedia: announcementBodyAfterMedia || null,
        mediaPosition: announcementMediaPosition,
        kind: announcementKind,
        status,
        mediaUrls: announcementMediaUrls,
        mediaTypes: announcementMediaTypes,
        showOnLobby: announcementShowOnLobby,
      };
      let res: Response;
      if (editingAnnouncementId) {
        try {
          res = await apiRequest("PATCH", `/api/admin/announcements/${editingAnnouncementId}`, payload);
        } catch (err: any) {
          if (typeof err?.message === "string" && err.message.startsWith("404")) {
            res = await apiRequest("POST", "/api/admin/announcements", payload);
          } else {
            throw err;
          }
        }
      } else {
        res = await apiRequest("POST", "/api/admin/announcements", payload);
      }
      return res.json();
    },
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      resetAnnouncementForm();
      toast({
        title: status === "published" ? "Announcement published" : "Draft saved",
        description: status === "published" ? "It is now visible in the lobby and sent to active users." : "The announcement is saved for later.",
      });
    },
    onError: (error: any) => toast({ title: "Failed to save announcement", description: error.message, variant: "destructive" }),
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      await apiRequest("DELETE", `/api/admin/announcements/${announcementId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Announcement deleted" });
    },
    onError: (error: any) => toast({ title: "Failed to delete announcement", description: error.message, variant: "destructive" }),
  });

  const publishExistingAnnouncementMutation = useMutation({
    mutationFn: async (announcement: Announcement) => {
      const res = await apiRequest("PATCH", `/api/admin/announcements/${announcement.id}`, {
        title: announcement.title,
        body: announcement.body,
        kind: announcement.kind,
        status: "published",
        mediaUrls: announcement.mediaUrls || [],
        mediaTypes: announcement.mediaTypes || [],
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Announcement published", description: "It is now visible in the lobby and sent to active users." });
    },
    onError: (error: any) => toast({ title: "Failed to publish announcement", description: error.message, variant: "destructive" }),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "user" | "admin" }) => {
      const res = await apiRequest("POST", "/api/admin/grant", { userId, role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role updated", description: "The user was notified about the role change." });
    },
    onError: (error: any) => toast({ title: "Failed to update role", description: error.message, variant: "destructive" }),
  });

  if (authLoading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-primary/20 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Admin access requires sign in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Sign in with an authorized account to access moderation tools.</p>
            <Button asChild className="w-full" data-testid="button-admin-sign-in">
              <a href="/api/login">Sign In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-destructive/30 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Admin access required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">This panel is only visible to Platform Admins and the Platform Owner.</p>
            <Button onClick={() => navigate("/")} className="w-full" data-testid="button-return-lobby">
              Return to lobby
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-auto admin-scrollbar">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-2xl border border-primary/20 bg-card/70 backdrop-blur-xl p-5 shadow-2xl shadow-primary/5">
          <div className="space-y-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="w-fit" data-testid="button-back-lobby">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Lobby
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight" data-testid="text-admin-title">Admin Command Center</h1>
                {isSuperAdmin ? (
                  <Badge className="owner-badge border-amber-300/60 text-amber-950" data-testid="badge-current-owner">
                    <Crown className="w-3 h-3 mr-1" />
                    Platform Owner
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500/15 text-blue-300 border border-blue-400/30" data-testid="badge-current-admin">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    Platform Admin
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2" data-testid="text-admin-description">
                Review reports, warn users, and manage platform authority from one secure dashboard.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-full sm:min-w-[500px]">
            <Card className="bg-background/50 border-primary/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Pending reports</p>
                <p className="text-2xl font-bold text-primary" data-testid="text-pending-reports">{stats.pending}</p>
              </CardContent>
            </Card>
            <Card className="bg-background/50 border-violet-400/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Teacher apps</p>
                <p className="text-2xl font-bold text-violet-300" data-testid="text-pending-apps">{stats.pendingApps}</p>
              </CardContent>
            </Card>
            <Card className="bg-background/50 border-amber-400/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold text-amber-300" data-testid="text-admin-count">{stats.admins}</p>
              </CardContent>
            </Card>
            <Card className="bg-background/50 border-destructive/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Warned users</p>
                <p className="text-2xl font-bold text-destructive" data-testid="text-warned-count">{stats.warned}</p>
              </CardContent>
            </Card>
          </div>
        </header>

        <Tabs defaultValue="reports" className="space-y-4">
          <TabsList className="flex flex-wrap w-full h-auto gap-1 p-1 bg-card/80 backdrop-blur justify-start">

            <TabsTrigger value="reports" data-testid="tab-admin-reports">
              <FileWarning className="w-4 h-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-admin-users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="warnings" data-testid="tab-admin-warnings">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Warnings
            </TabsTrigger>
            <TabsTrigger value="applications" data-testid="tab-admin-applications" className="relative">
              <GraduationCap className="w-4 h-4 mr-2" />
              Teachers
              {stats.pendingApps > 0 && (
                <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">
                  {stats.pendingApps}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="badges" data-testid="tab-admin-badges">
              <Award className="w-4 h-4 mr-2" />
              Badges
            </TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-admin-security" className="relative">
              <ShieldAlert className="w-4 h-4 mr-2" />
              Security
              {securityEventCount > 0 && (
                <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {securityEventCount > 9 ? "9+" : securityEventCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="storage" data-testid="tab-admin-storage">
              <HardDrive className="w-4 h-4 mr-2" />
              Storage
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="announcements" data-testid="tab-admin-announcements">
                <Megaphone className="w-4 h-4 mr-2" />
                Announce
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="ai-tutor" data-testid="tab-admin-ai-tutor">
                <Bot className="w-4 h-4 mr-2" />
                AI Tutor
              </TabsTrigger>
            )}
            <TabsTrigger value="analytics" data-testid="tab-admin-analytics">
              <BarChart2 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="outreach" data-testid="tab-admin-outreach">
                <BellRing className="w-4 h-4 mr-2" />
                Outreach
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="transactions" data-testid="tab-admin-transactions">
                <Receipt className="w-4 h-4 mr-2" />
                Payments
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="maintenance" data-testid="tab-admin-maintenance">
                <Wrench className="w-4 h-4 mr-2" />
                Maintenance
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="reports">
            <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
              <CardHeader>
                <CardTitle>Reports Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[620px] overflow-auto admin-scrollbar pr-2 space-y-3">
                  {reportsLoading ? (
                    [1, 2, 3].map((item) => <Skeleton key={item} className="h-28 w-full" />)
                  ) : reports.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-reports">No reports yet.</p>
                  ) : (
                    reports.map((report) => (
                      <div key={report.id} className="rounded-xl border border-border/70 bg-background/55 p-4 space-y-3" data-testid={`card-report-${report.id}`}>
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={report.status === "pending" ? "default" : "outline"} data-testid={`status-report-${report.id}`}>
                                {report.status}
                              </Badge>
                              <Badge variant="secondary" data-testid={`text-report-category-${report.id}`}>
                                {report.category || "uncategorized"}
                              </Badge>
                              {reportsByUser.get(report.reportedId)! >= 3 && (
                                <Badge className="bg-destructive/15 text-destructive border border-destructive/30" data-testid={`badge-report-flagged-${report.id}`}>
                                  Flagged: repeated reports
                                </Badge>
                              )}
                            </div>
                            <p className="mt-3 font-medium" data-testid={`text-report-title-${report.id}`}>
                              {report.reporterName || report.reporterId} reported {report.reportedName || report.reportedId}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-report-reason-${report.id}`}>
                              {report.reason || "No description provided."}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => updateReportMutation.mutate({ reportId: report.id, status: "reviewed" })} disabled={updateReportMutation.isPending} data-testid={`button-review-report-${report.id}`}>
                              Mark reviewed
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => updateReportMutation.mutate({ reportId: report.id, status: "dismissed" })} disabled={updateReportMutation.isPending} data-testid={`button-dismiss-report-${report.id}`}>
                              Dismiss
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => warnMutation.mutate(report.reportedId)} disabled={warnMutation.isPending} data-testid={`button-warn-reported-${report.id}`}>
                              Warn user
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle>User Management</CardTitle>
                  <span className="text-xs text-muted-foreground">{filteredUsers.length} of {users.length} user{users.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    data-testid="input-user-search"
                    placeholder="Search by name, email, role, or ID…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9 pr-9 h-9 text-sm bg-background/60"
                  />
                  {userSearch && (
                    <button onClick={() => setUserSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" data-testid="button-clear-user-search">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ── Find user by exact ID ── */}
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-3">
                  <div className="flex items-center gap-1.5 text-violet-400">
                    <Search className="w-4 h-4" />
                    <span className="text-sm font-semibold">Find User by Exact ID</span>
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!userIdLookup.trim()) return;
                      setLookupLoading(true);
                      setLookupResult(null);
                      setLookupError(null);
                      try {
                        const res = await fetch(`/api/admin/users/lookup?id=${encodeURIComponent(userIdLookup.trim())}`, { credentials: "include" });
                        if (!res.ok) {
                          const err = await res.json().catch(() => ({}));
                          setLookupError((err as any).message || "User not found");
                        } else {
                          setLookupResult(await res.json());
                        }
                      } catch {
                        setLookupError("Request failed. Please try again.");
                      } finally {
                        setLookupLoading(false);
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      data-testid="input-user-id-lookup"
                      placeholder="Paste exact user ID…"
                      value={userIdLookup}
                      onChange={(e) => { setUserIdLookup(e.target.value); setLookupResult(null); setLookupError(null); }}
                      className="h-8 text-sm bg-background/60 font-mono"
                    />
                    <Button size="sm" type="submit" disabled={lookupLoading || !userIdLookup.trim()} data-testid="button-user-id-lookup">
                      {lookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    </Button>
                  </form>
                  {lookupError && (
                    <p className="text-xs text-destructive" data-testid="text-lookup-error">{lookupError}</p>
                  )}
                  {lookupResult && (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50 border border-violet-400/20" data-testid={`card-lookup-user-${lookupResult.id}`}>
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarImage src={lookupResult.profileImageUrl || ""} alt="" />
                        <AvatarFallback className="text-xs bg-violet-800 text-violet-200">{getUserDisplayName(lookupResult).slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" data-testid="text-lookup-name">{getUserDisplayName(lookupResult)}</p>
                        <p className="text-[10px] text-muted-foreground truncate font-mono" data-testid="text-lookup-id">{lookupResult.id}</p>
                        <p className="text-[10px] text-muted-foreground" data-testid="text-lookup-role">{lookupResult.role || "user"}{lookupResult.email ? ` · ${lookupResult.email}` : ""}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setUserSearch(lookupResult.id)}
                        data-testid="button-lookup-find-in-list"
                        className="text-xs flex-shrink-0"
                      >
                        View
                      </Button>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-emerald-400 flex-shrink-0">
                      <UserPlus className="w-4 h-4" />
                      <span className="text-sm font-semibold">New Registrations</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 ml-auto">
                      {(["today", "yesterday", "week", "month"] as const).map((p) => {
                        const labels = { today: "Today", yesterday: "Yesterday", week: "Last 7 days", month: "Last 30 days" };
                        const count = newRegCounts[p];
                        const active = newRegPeriod === p;
                        return (
                          <button
                            key={p}
                            data-testid={`button-newreg-${p}`}
                            onClick={() => setNewRegPeriod(active ? null : p)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150"
                            style={active
                              ? { background: "rgba(52,211,153,0.22)", color: "#34d399", border: "1px solid rgba(52,211,153,0.45)" }
                              : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.10)" }
                            }
                          >
                            {labels[p]}
                            <span
                              className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                              style={active
                                ? { background: "rgba(52,211,153,0.35)", color: "#6ee7b7" }
                                : { background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.50)" }
                              }
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {newRegPeriod && (
                    <div className="space-y-2 pt-1 border-t border-emerald-500/15">
                      {newRegUsers.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No users registered in this period.</p>
                      ) : (
                        newRegUsers.map((u) => (
                          <div key={u.id} data-testid={`card-newreg-${u.id}`} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                            <Avatar className="w-7 h-7 flex-shrink-0">
                              <AvatarImage src={u.profileImageUrl ?? undefined} alt="" />
                              <AvatarFallback className="text-[10px] font-semibold bg-emerald-900/50 text-emerald-200">{getUserDisplayName(u).slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate text-foreground">{getUserDisplayName(u)}</p>
                              <p className="text-[10px] text-muted-foreground/70 truncate">{u.email || u.id}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <RoleBadge user={u} />
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                {new Date(u.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div className="max-h-[520px] overflow-auto admin-scrollbar pr-2 space-y-3">
                  {usersLoading ? (
                    [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24 w-full" />)
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm" data-testid="text-no-users-found">
                      No users match <span className="font-semibold text-foreground">"{userSearch}"</span>
                    </div>
                  ) : (
                    filteredUsers.map((item) => {
                      const isOwner = item.email === OWNER_EMAIL || item.role === "superadmin";
                      const canEditRole = isSuperAdmin && !isOwner;
                      const canWarn = !isOwner && (isSuperAdmin || item.role !== "admin");
                      const canDeleteUser = isSuperAdmin && !isOwner && item.role !== "admin";
                      const restrictedUntil = item.restrictedUntil ? new Date(item.restrictedUntil) : null;
                      const isRestricted = !!restrictedUntil && restrictedUntil.getTime() > Date.now();
                      const remainingRestrictionDays = restrictedUntil ? Math.max(1, Math.ceil((restrictedUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : 1;
                      const restrictionDaysValue = restrictDaysMap[item.id] ?? remainingRestrictionDays;
                      return (
                        <div key={item.id} className="rounded-xl border border-border/70 bg-background/55 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4" data-testid={`card-user-${item.id}`}>
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold truncate" data-testid={`text-user-name-${item.id}`}>{getUserDisplayName(item)}</h3>
                              <RoleBadge user={item} />
                              {item.warningCount > 0 && (
                                <Badge className="bg-destructive/15 text-destructive border border-destructive/30" data-testid={`badge-warning-${item.id}`}>
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {item.warningCount} warning{item.warningCount === 1 ? "" : "s"}
                                </Badge>
                              )}
                              {isRestricted && (
                                <Badge className="bg-orange-500/15 text-orange-300 border border-orange-400/30" data-testid={`badge-restricted-${item.id}`}>
                                  <Ban className="w-3 h-3 mr-1" />
                                  Restricted
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate" data-testid={`text-user-email-${item.id}`}>
                              {item.email || (isSuperAdmin ? item.id : "Email hidden")}
                            </p>
                            <p className="text-xs text-muted-foreground" data-testid={`text-user-meta-${item.id}`}>
                              {roleLabel(item)} · {reportsByUser.get(item.id) || 0} report{(reportsByUser.get(item.id) || 0) === 1 ? "" : "s"}
                              {isRestricted && restrictedUntil ? ` · restricted until ${restrictedUntil.toLocaleDateString()}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {canEditRole && item.role !== "admin" && (
                              <Button size="sm" onClick={() => roleMutation.mutate({ userId: item.id, role: "admin" })} disabled={roleMutation.isPending} data-testid={`button-promote-${item.id}`}>
                                Promote Admin
                              </Button>
                            )}
                            {canEditRole && item.role === "admin" && (
                              <Button size="sm" variant="outline" onClick={() => roleMutation.mutate({ userId: item.id, role: "user" })} disabled={roleMutation.isPending} data-testid={`button-demote-${item.id}`}>
                                Remove Admin
                              </Button>
                            )}
                            {canWarn && (
                              <Button size="sm" variant="destructive" onClick={() => warnMutation.mutate(item.id)} disabled={warnMutation.isPending} data-testid={`button-warn-user-${item.id}`}>
                                Warn
                              </Button>
                            )}
                            {isSuperAdmin && !isOwner && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button size="sm" variant="destructive" disabled={restrictMutation.isPending} data-testid={`button-restrict-user-${item.id}`}>
                                    <Ban className="w-3 h-3 mr-1" />
                                    {isRestricted ? "Adjust restriction" : "Restrict"}
                                    <ChevronDown className="w-3 h-3 ml-1" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-60 p-3" align="end">
                                  <p className="text-xs font-medium mb-2">{isRestricted ? "Set a new restriction length" : "Restrict for how many days?"}</p>
                                  {isRestricted && restrictedUntil && (
                                    <p className="text-[11px] text-muted-foreground mb-2" data-testid={`text-current-restriction-${item.id}`}>
                                      Current: until {restrictedUntil.toLocaleString()}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min={1}
                                      max={365}
                                      value={restrictionDaysValue}
                                      onChange={(e) => setRestrictDaysMap((prev) => ({ ...prev, [item.id]: Math.min(365, Math.max(1, parseInt(e.target.value) || 1)) }))}
                                      className="h-8 w-20 text-sm"
                                      data-testid={`input-restrict-days-${item.id}`}
                                    />
                                    <span className="text-xs text-muted-foreground">day{restrictionDaysValue !== 1 ? "s" : ""}</span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="w-full mt-2"
                                    disabled={restrictMutation.isPending}
                                    onClick={() => restrictMutation.mutate({ userId: item.id, days: restrictionDaysValue })}
                                    data-testid={`button-confirm-restrict-${item.id}`}
                                  >
                                    {isRestricted ? "Update Restriction" : "Confirm Restrict"}
                                  </Button>
                                </PopoverContent>
                              </Popover>
                            )}
                            {isSuperAdmin && !isOwner && isRestricted && (
                              <Button size="sm" variant="outline" onClick={() => liftRestrictionMutation.mutate(item.id)} disabled={liftRestrictionMutation.isPending} data-testid={`button-lift-restriction-${item.id}`}>
                                Lift restriction
                              </Button>
                            )}
                            {canDeleteUser && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (window.confirm(`Delete ${getUserDisplayName(item)} permanently? This cannot be undone.`)) {
                                    deleteUserMutation.mutate(item.id);
                                  }
                                }}
                                disabled={deleteUserMutation.isPending}
                                data-testid={`button-delete-user-${item.id}`}
                              >
                                Delete account
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="warnings">
            <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
              <CardHeader>
                <CardTitle>Warning Watchlist</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[620px] overflow-auto admin-scrollbar pr-2 space-y-3">
                  {users.filter((item) => item.warningCount > 0).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-warnings">No users have warnings.</p>
                  ) : (
                    users
                      .filter((item) => item.warningCount > 0)
                      .sort((a, b) => b.warningCount - a.warningCount)
                      .map((item) => (
                        <div key={item.id} className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3" data-testid={`card-warning-${item.id}`}>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold" data-testid={`text-warning-user-${item.id}`}>{getUserDisplayName(item)}</h3>
                              <Badge className="bg-destructive/15 text-destructive border border-destructive/30" data-testid={`badge-warning-count-${item.id}`}>
                                {item.warningCount} warning{item.warningCount === 1 ? "" : "s"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-warning-guidance-${item.id}`}>
                              {item.warningCount >= 3 ? "Suggested action: review reports and consider restrictions." : "Monitor future reports before escalating."}
                            </p>
                          </div>
                          {item.warningCount < 3 && (
                            <Button size="sm" variant="destructive" onClick={() => warnMutation.mutate(item.id)} disabled={warnMutation.isPending} data-testid={`button-extra-warning-${item.id}`}>
                              Send another warning
                            </Button>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications">
            <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
              <CardHeader>
                <CardTitle>Teacher Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[620px] overflow-auto admin-scrollbar pr-2 space-y-3">
                  {appsLoading ? (
                    [1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full" />)
                  ) : teacherApps.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-applications">No applications yet.</p>
                  ) : (
                    teacherApps.map((app) => (
                      <div key={app.id} className="rounded-xl border border-border/70 bg-background/55 p-4 space-y-3" data-testid={`card-application-${app.id}`}>
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10 border border-primary/20">
                              <AvatarImage src={app.user?.profileImageUrl ?? undefined} alt="" />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {(app.user?.firstName?.[0] ?? app.name?.[0] ?? "?").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold" data-testid={`text-app-name-${app.id}`}>{app.name}</h3>
                                <Badge
                                  className={
                                    app.status === "pending"
                                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                      : app.status === "approved"
                                      ? "bg-green-500/15 text-green-400 border border-green-500/30"
                                      : "bg-red-500/15 text-red-400 border border-red-500/30"
                                  }
                                  data-testid={`badge-app-status-${app.id}`}
                                >
                                  {app.status === "pending" ? (
                                    <><Clock className="w-3 h-3 mr-1" />Pending</>
                                  ) : app.status === "approved" ? (
                                    <><CheckCircle2 className="w-3 h-3 mr-1" />Approved</>
                                  ) : (
                                    <><XCircle className="w-3 h-3 mr-1" />Rejected</>
                                  )}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{app.user?.email ?? "—"}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Suggested rate: <span className="text-foreground font-medium">${app.suggestedRate}/hr</span>
                                {app.approvedRate ? <> · Approved: <span className="text-green-400 font-medium">${app.approvedRate}/hr</span></> : null}
                              </p>
                            </div>
                          </div>
                          {app.status === "pending" && (
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                className="bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30"
                                onClick={() => {
                                  setSelectedApp(app);
                                  setApprovedRate(String(app.suggestedRate));
                                  setAdminNotes("");
                                  setApproveOpen(true);
                                }}
                                data-testid={`button-approve-${app.id}`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                onClick={() => {
                                  setSelectedApp(app);
                                  setRejectNotes("");
                                  setRejectOpen(true);
                                }}
                                data-testid={`button-reject-${app.id}`}
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-app-bio-${app.id}`}>{app.bio}</p>
                          {app.languages?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {app.languages.map((lang) => (
                                <span key={lang} className="text-[11px] rounded-full px-2 py-0.5 bg-primary/10 text-primary border border-primary/20">{lang}</span>
                              ))}
                            </div>
                          )}
                          {app.adminNotes && (
                            <p className="text-xs text-amber-300/80 italic mt-1">Admin note: {app.adminNotes}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="badges">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    Award a Badge
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select User</label>
                    <Select value={badgeUserId} onValueChange={setBadgeUserId}>
                      <SelectTrigger data-testid="select-badge-user">
                        <SelectValue placeholder="Choose a user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users.filter(u => u.email !== OWNER_EMAIL && u.role !== "superadmin").map((u) => (
                          <SelectItem key={u.id} value={u.id} data-testid={`option-badge-user-${u.id}`}>
                            {getUserDisplayName(u)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Badge</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(BADGE_TYPES).map((b) => (
                        <button
                          key={b.id}
                          data-testid={`button-badge-type-${b.id}`}
                          onClick={() => setBadgeType(b.id)}
                          className="flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all"
                          style={{
                            borderColor: badgeType === b.id ? b.color : "rgba(255,255,255,0.1)",
                            background: badgeType === b.id ? `${b.color}18` : "transparent",
                          }}
                        >
                          <span className="text-xl">{b.emoji}</span>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: badgeType === b.id ? b.color : undefined }}>{b.label}</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-1">{b.quote}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => awardBadgeMutation.mutate({ userId: badgeUserId, badgeType })}
                    disabled={!badgeUserId || !badgeType || awardBadgeMutation.isPending}
                    data-testid="button-award-badge"
                    style={{ background: badgeType ? `${BADGE_TYPES[badgeType as keyof typeof BADGE_TYPES]?.color}30` : undefined, color: badgeType ? BADGE_TYPES[badgeType as keyof typeof BADGE_TYPES]?.color : undefined }}
                  >
                    <Award className="w-4 h-4 mr-2" />
                    {awardBadgeMutation.isPending ? "Awarding..." : "Award Badge & Announce"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
                <CardHeader>
                  <CardTitle>Awarded Badges</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[520px] overflow-auto admin-scrollbar pr-1 space-y-2">
                    {badgesLoading ? (
                      [1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)
                    ) : allBadges.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-10">No badges awarded yet.</p>
                    ) : (
                      allBadges.map((b) => {
                        const def = BADGE_TYPES[b.badgeType as keyof typeof BADGE_TYPES];
                        if (!def) return null;
                        return (
                          <div key={b.id} data-testid={`card-badge-${b.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-background/40">
                            <span className="text-2xl">{def.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{b.userName}</p>
                              <p className="text-xs font-medium" style={{ color: def.color }}>{def.label}</p>
                            </div>
                            <button
                              data-testid={`button-remove-badge-${b.id}`}
                              onClick={() => removeBadgeMutation.mutate(b.id)}
                              disabled={removeBadgeMutation.isPending}
                              className="text-muted-foreground/50 hover:text-destructive transition-colors p-1 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
                <CardHeader>
                  <CardTitle>Badge Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[520px] overflow-auto admin-scrollbar pr-1 space-y-2">
                    {badgeApplicationsLoading ? (
                      [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)
                    ) : badgeApplications.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-10">No badge applications yet.</p>
                    ) : (
                      badgeApplications.map((application) => {
                        const def = BADGE_TYPES[application.badgeType as keyof typeof BADGE_TYPES];
                        return (
                          <div key={application.id} data-testid={`card-badge-application-${application.id}`} className="p-3 rounded-xl border border-border/50 bg-background/40 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{application.userName}</p>
                                <p className="text-xs font-medium" style={{ color: def?.color }}>{def?.emoji} {def?.label || application.badgeType}</p>
                              </div>
                              <Badge variant={application.status === "pending" ? "secondary" : application.status === "approved" ? "default" : "outline"} data-testid={`status-badge-application-${application.id}`}>
                                {application.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-3">{application.reason}</p>
                            {application.status === "pending" && (
                              <div className="flex gap-2">
                                <Button size="sm" className="flex-1" onClick={() => reviewBadgeApplicationMutation.mutate({ id: application.id, status: "approved" })} disabled={reviewBadgeApplicationMutation.isPending} data-testid={`button-approve-badge-application-${application.id}`}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => reviewBadgeApplicationMutation.mutate({ id: application.id, status: "rejected" })} disabled={reviewBadgeApplicationMutation.isPending} data-testid={`button-reject-badge-application-${application.id}`}>
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="security">
            <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  Security Events
                  {securityEventCount > 0 && (
                    <Badge className="bg-red-500/20 text-red-300 border border-red-500/30 text-xs">
                      {securityEventCount} unresolved
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {securityEventsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : securityEvents.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="w-12 h-12 text-green-400 mx-auto mb-3 opacity-60" />
                    <p className="text-muted-foreground text-sm">No security events detected</p>
                    <p className="text-muted-foreground text-xs mt-1">Your platform is clean</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {securityEvents.map((event: any) => {
                      const severityColors: Record<string, string> = {
                        critical: "bg-red-500/15 text-red-300 border-red-500/30",
                        high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
                        medium: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
                        low: "bg-blue-500/15 text-blue-300 border-blue-500/30",
                      };
                      const severityClass = severityColors[event.severity] ?? severityColors.medium;
                      const typeLabel = (event.eventType as string).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                      return (
                        <div
                          key={event.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border ${event.resolved ? "opacity-50 border-border/30 bg-muted/10" : "border-red-500/15 bg-red-500/5"}`}
                          data-testid={`security-event-${event.id}`}
                        >
                          <div className="mt-0.5 flex-shrink-0">
                            <ShieldAlert className={`w-4 h-4 ${event.resolved ? "text-muted-foreground" : "text-red-400"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={`text-[10px] px-1.5 py-0 border ${severityClass}`}>
                                {event.severity.toUpperCase()}
                              </Badge>
                              <span className="text-sm font-medium">{typeLabel}</span>
                              {event.resolved && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-400 border-green-500/30">
                                  Resolved
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-snug">{event.description}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground/70">
                              {event.requestPath && <span>Path: <code className="font-mono">{event.requestPath}</code></span>}
                              {event.userName && <span>User: {event.userName}</span>}
                              <span>{new Date(event.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                          {!event.resolved && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs shrink-0 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              onClick={() => resolveSecurityEventMutation.mutate(event.id)}
                              disabled={resolveSecurityEventMutation.isPending}
                              data-testid={`button-resolve-security-${event.id}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Resolve
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="storage">
            <StorageTab isSuperAdmin={isSuperAdmin} />
          </TabsContent>

          <TabsContent value="analytics">
            <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
              <CardContent className="p-5">
                <AnalyticsTab />
              </CardContent>
            </Card>
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="outreach">
              <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
                <CardContent className="p-5">
                  <OutreachTab users={users} />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="ai-tutor">
              <AiTutorTab />
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="announcements">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]">
                <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Megaphone className="w-5 h-5 text-cyan-300" />
                      Platform Owner Announcements
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="announcement-title">Title</Label>
                        <Input
                          id="announcement-title"
                          value={announcementTitle}
                          onChange={(e) => setAnnouncementTitle(e.target.value)}
                          maxLength={140}
                          placeholder="What changed?"
                          data-testid="input-announcement-title"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Announcement type</Label>
                        <Select value={announcementKind} onValueChange={setAnnouncementKind}>
                          <SelectTrigger data-testid="select-announcement-kind">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="platform">Platform update</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="safety">Safety notice</SelectItem>
                            <SelectItem value="celebration">Celebration</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-4 py-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="announcement-show-on-lobby" className="text-sm font-medium">Show on home page</Label>
                        <p className="text-xs text-muted-foreground">By default, announcements only appear in room chats. Enable this to also show a banner on the lobby.</p>
                      </div>
                      <Switch
                        id="announcement-show-on-lobby"
                        checked={announcementShowOnLobby}
                        onCheckedChange={setAnnouncementShowOnLobby}
                        data-testid="switch-announcement-show-on-lobby"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="announcement-body">Message</Label>
                      <Textarea
                        id="announcement-body"
                        value={announcementBody}
                        onChange={(e) => setAnnouncementBody(e.target.value)}
                        rows={7}
                        maxLength={5000}
                        placeholder="Write an update for everyone..."
                        data-testid="textarea-announcement-message"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Image / GIF placement in room chat</Label>
                      <Select value={announcementMediaPosition} onValueChange={(v) => setAnnouncementMediaPosition(v as "above" | "below" | "between")}>
                        <SelectTrigger data-testid="select-announcement-media-position">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="below">Below text</SelectItem>
                          <SelectItem value="above">Above text</SelectItem>
                          <SelectItem value="between">Between two text blocks</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label htmlFor="announcement-media">Images and GIFs</Label>
                        <span className="text-xs text-muted-foreground" data-testid="text-announcement-media-count">{announcementMediaUrls.length}/4 attached</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          id="announcement-media"
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          disabled={announcementMediaUrls.length >= 4 || uploadAnnouncementMediaMutation.isPending}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadAnnouncementMediaMutation.mutate(file);
                            e.currentTarget.value = "";
                          }}
                          className="flex-1 min-w-0"
                          data-testid="input-announcement-media"
                        />
                        <div className="flex items-center text-sm border border-border/60 bg-muted/20 rounded-md px-1 py-0.5 flex-shrink-0" title="Pick a GIF">
                          <GifPickerButton
                            onGifSelect={(gifUrl) => {
                              if (announcementMediaUrls.length >= 4) return;
                              if (!gifUrl.startsWith("/uploads/") && !gifUrl.startsWith("https://") && !gifUrl.startsWith("http://")) {
                                toast({ title: "Invalid GIF", description: "GIF source is not a valid URL.", variant: "destructive" });
                                return;
                              }
                              setAnnouncementMediaUrls(prev => [...prev, gifUrl].slice(0, 4));
                              setAnnouncementMediaTypes(prev => [...prev, "gif"].slice(0, 4));
                            }}
                          />
                        </div>
                      </div>
                      {announcementMediaUrls.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {announcementMediaUrls.map((url, index) => (
                            <div key={url} className="overflow-hidden rounded-xl border border-border/70 bg-background/50" data-testid={`card-announcement-media-${index}`}>
                              <img loading="lazy" decoding="async" src={url} alt={`Announcement media ${index + 1}`} className="h-32 w-full object-cover" data-testid={`img-announcement-media-${index}`} />
                              <div className="flex items-center justify-between p-2">
                                <Badge variant="secondary" data-testid={`status-announcement-media-type-${index}`}>
                                  {announcementMediaTypes[index] || "image"}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setAnnouncementMediaUrls((current) => current.filter((_, i) => i !== index));
                                    setAnnouncementMediaTypes((current) => current.filter((_, i) => i !== index));
                                  }}
                                  data-testid={`button-remove-announcement-media-${index}`}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {announcementMediaPosition === "between" && (
                      <div className="space-y-2">
                        <Label htmlFor="announcement-body-after">Text after image / GIF</Label>
                        <Textarea
                          id="announcement-body-after"
                          value={announcementBodyAfterMedia}
                          onChange={(e) => setAnnouncementBodyAfterMedia(e.target.value)}
                          rows={4}
                          maxLength={5000}
                          placeholder="Continues after the image..."
                          data-testid="textarea-announcement-body-after"
                        />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => saveAnnouncementMutation.mutate("draft")}
                        disabled={announcementTitle.trim().length < 3 || announcementBody.trim().length === 0 || saveAnnouncementMutation.isPending || uploadAnnouncementMediaMutation.isPending}
                        data-testid="button-save-announcement-draft"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {saveAnnouncementMutation.isPending ? "Saving..." : "Save draft"}
                      </Button>
                      <Button
                        onClick={() => saveAnnouncementMutation.mutate("published")}
                        disabled={announcementTitle.trim().length < 3 || announcementBody.trim().length === 0 || saveAnnouncementMutation.isPending || uploadAnnouncementMediaMutation.isPending}
                        data-testid="button-publish-announcement"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {saveAnnouncementMutation.isPending ? "Publishing..." : "Publish"}
                      </Button>
                      {editingAnnouncementId && (
                        <Button variant="ghost" onClick={resetAnnouncementForm} data-testid="button-cancel-announcement-edit">
                          Cancel edit
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-violet-300" />
                      Saved announcements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[620px] overflow-auto admin-scrollbar pr-2 space-y-3">
                      {announcementsLoading ? (
                        [1, 2, 3].map((item) => <Skeleton key={item} className="h-28 w-full" />)
                      ) : announcements.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-announcements">No announcements yet.</p>
                      ) : (
                        announcements.map((announcement) => (
                          <div key={announcement.id} className="rounded-xl border border-border/70 bg-background/55 p-4 space-y-3" data-testid={`card-owner-announcement-${announcement.id}`}>
                            {announcement.mediaUrls?.[0] && (
                              <img loading="lazy" decoding="async" src={announcement.mediaUrls[0]} alt={announcement.title} className="h-36 w-full rounded-lg object-cover" data-testid={`img-owner-announcement-${announcement.id}`} />
                            )}
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={announcement.status === "published" ? "default" : "outline"} data-testid={`status-owner-announcement-${announcement.id}`}>
                                  {announcement.status}
                                </Badge>
                                <Badge variant="secondary" data-testid={`text-owner-announcement-kind-${announcement.id}`}>
                                  {announcement.kind}
                                </Badge>
                                {announcement.status === "published" && (
                                  <Badge variant="outline" data-testid={`text-owner-announcement-views-${announcement.id}`}>
                                    {announcement.viewCount || 0} viewed · {announcement.dismissCount || 0} dismissed
                                  </Badge>
                                )}
                              </div>
                              <h3 className="font-semibold" data-testid={`text-owner-announcement-title-${announcement.id}`}>{announcement.title}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-3" data-testid={`text-owner-announcement-body-${announcement.id}`}>{announcement.body}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => startEditingAnnouncement(announcement)} data-testid={`button-edit-announcement-${announcement.id}`}>
                                <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                                Edit
                              </Button>
                              {announcement.status !== "published" && (
                                <Button
                                  size="sm"
                                  onClick={() => publishExistingAnnouncementMutation.mutate(announcement)}
                                  disabled={publishExistingAnnouncementMutation.isPending}
                                  data-testid={`button-publish-existing-announcement-${announcement.id}`}
                                >
                                  Publish
                                </Button>
                              )}
                              <Button size="sm" variant="destructive" onClick={() => deleteAnnouncementMutation.mutate(announcement.id)} disabled={deleteAnnouncementMutation.isPending} data-testid={`button-delete-announcement-${announcement.id}`}>
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="transactions">
              <TransactionsTab />
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="maintenance">
              <MaintenanceTab />
            </TabsContent>
          )}
        </Tabs>

        {/* Approve Dialog */}
        <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
          <DialogContent className="sm:max-w-md bg-card border-primary/20">
            <DialogHeader>
              <DialogTitle>Approve Application</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Approving: <span className="text-foreground font-medium">{selectedApp?.name}</span></p>
                <p className="text-xs text-muted-foreground">Suggested rate: ${selectedApp?.suggestedRate}/hr</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="approved-rate">Approved Hourly Rate (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="approved-rate"
                    type="number"
                    min={1}
                    className="pl-9"
                    value={approvedRate}
                    onChange={(e) => setApprovedRate(e.target.value)}
                    data-testid="input-approved-rate"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-notes">Admin Notes (optional)</Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Any notes for the applicant..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                  data-testid="textarea-admin-notes"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
                <Button
                  className="bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30"
                  onClick={() => selectedApp && approveMutation.mutate({ id: selectedApp.id, rate: Number(approvedRate), notes: adminNotes })}
                  disabled={approveMutation.isPending || !approvedRate}
                  data-testid="button-confirm-approve"
                >
                  {approveMutation.isPending ? "Approving..." : "Approve & Create Profile"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent className="sm:max-w-md bg-card border-primary/20">
            <DialogHeader>
              <DialogTitle>Reject Application</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Rejecting application from: <span className="text-foreground font-medium">{selectedApp?.name}</span></p>
              <div className="space-y-1.5">
                <Label htmlFor="reject-notes">Reason / Notes (optional)</Label>
                <Textarea
                  id="reject-notes"
                  placeholder="Reason for rejection..."
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={3}
                  data-testid="textarea-reject-notes"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => selectedApp && rejectMutation.mutate({ id: selectedApp.id, notes: rejectNotes })}
                  disabled={rejectMutation.isPending}
                  data-testid="button-confirm-reject"
                >
                  {rejectMutation.isPending ? "Rejecting..." : "Reject Application"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}