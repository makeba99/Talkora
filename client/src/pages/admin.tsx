import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Crown, FileWarning, Shield, ShieldAlert, ShieldCheck, Users, GraduationCap, CheckCircle2, XCircle, Clock, DollarSign, Award, Trash2, Megaphone, Ban, Image as ImageIcon, Save, Send, Edit3, ChevronDown, Search, UserPlus, CalendarDays, X } from "lucide-react";
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
import { BADGE_TYPES } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GifPickerButton } from "@/components/chat-picker";

const OWNER_EMAIL = "dj55jggg@gmail.com";
type OwnerAnnouncement = Announcement & { viewCount?: number; dismissCount?: number };

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

export default function AdminPage() {
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
      const res = editingAnnouncementId
        ? await apiRequest("PATCH", `/api/admin/announcements/${editingAnnouncementId}`, payload)
        : await apiRequest("POST", "/api/admin/announcements", payload);
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
          <TabsList className={`grid w-full ${isSuperAdmin ? "max-w-6xl grid-cols-7" : "max-w-4xl grid-cols-6"} bg-card/80 backdrop-blur`}>
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
            {isSuperAdmin && (
              <TabsTrigger value="announcements" data-testid="tab-admin-announcements">
                <Megaphone className="w-4 h-4 mr-2" />
                Announce
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
                              <AvatarImage src={u.profileImageUrl ?? undefined} />
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
                              <AvatarImage src={app.user?.profileImageUrl ?? undefined} />
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
                        <div className="flex items-center gap-1.5 text-sm border border-border/60 bg-muted/20 rounded-md px-2 py-1 flex-shrink-0">
                          <span className="text-muted-foreground text-xs">🎁 Gift / GIF</span>
                          <GifPickerButton
                            onGifSelect={(gifUrl) => {
                              if (announcementMediaUrls.length >= 4) return;
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
                              <img src={url} alt={`Announcement media ${index + 1}`} className="h-32 w-full object-cover" data-testid={`img-announcement-media-${index}`} />
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
                        disabled={announcementTitle.trim().length < 3 || announcementBody.trim().length === 0 || saveAnnouncementMutation.isPending}
                        data-testid="button-save-announcement-draft"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {saveAnnouncementMutation.isPending ? "Saving..." : "Save draft"}
                      </Button>
                      <Button
                        onClick={() => saveAnnouncementMutation.mutate("published")}
                        disabled={announcementTitle.trim().length < 3 || announcementBody.trim().length === 0 || saveAnnouncementMutation.isPending}
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
                              <img src={announcement.mediaUrls[0]} alt={announcement.title} className="h-36 w-full rounded-lg object-cover" data-testid={`img-owner-announcement-${announcement.id}`} />
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