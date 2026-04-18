import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Crown, FileWarning, Shield, ShieldCheck, Users, GraduationCap, CheckCircle2, XCircle, Clock, DollarSign, Award, Trash2, Megaphone, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUserDisplayName } from "@/lib/utils";
import type { Report, User, TeacherApplication, UserBadge } from "@shared/schema";
import { BADGE_TYPES } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OWNER_EMAIL = "dj55jggg@gmail.com";

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
  const [announcementMessage, setAnnouncementMessage] = useState("");

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
      const res = await apiRequest("POST", `/api/admin/users/${userId}/restrict`, {
        days,
        reason: `Restricted by Platform Owner for ${days} day${days === 1 ? "" : "s"}.`,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User restricted", description: "The user was notified immediately." });
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

  const announcementMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/announcements", {
        kind: announcementKind,
        message: announcementMessage,
      });
      return res.json();
    },
    onSuccess: () => {
      setAnnouncementMessage("");
      toast({ title: "Announcement sent", description: "It was posted globally and into all active room chats." });
    },
    onError: (error: any) => toast({ title: "Failed to send announcement", description: error.message, variant: "destructive" }),
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
          <TabsList className={`grid w-full ${isSuperAdmin ? "max-w-5xl grid-cols-6" : "max-w-3xl grid-cols-5"} bg-card/80 backdrop-blur`}>
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
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[620px] overflow-auto admin-scrollbar pr-2 space-y-3">
                  {usersLoading ? (
                    [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24 w-full" />)
                  ) : (
                    users.map((item) => {
                      const isOwner = item.email === OWNER_EMAIL || item.role === "superadmin";
                      const canEditRole = isSuperAdmin && !isOwner;
                      const canWarn = !isOwner && (isSuperAdmin || item.role !== "admin");
                      const restrictedUntil = item.restrictedUntil ? new Date(item.restrictedUntil) : null;
                      const isRestricted = !!restrictedUntil && restrictedUntil.getTime() > Date.now();
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
                            {isSuperAdmin && !isOwner && !isRestricted && (
                              <Button size="sm" variant="destructive" onClick={() => restrictMutation.mutate({ userId: item.id, days: 1 })} disabled={restrictMutation.isPending} data-testid={`button-restrict-user-${item.id}`}>
                                Restrict 1 day
                              </Button>
                            )}
                            {isSuperAdmin && !isOwner && isRestricted && (
                              <Button size="sm" variant="outline" onClick={() => liftRestrictionMutation.mutate(item.id)} disabled={liftRestrictionMutation.isPending} data-testid={`button-lift-restriction-${item.id}`}>
                                Lift restriction
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

          {isSuperAdmin && (
            <TabsContent value="announcements">
              <Card className="bg-card/75 backdrop-blur-xl border-primary/15">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-cyan-300" />
                    Platform Owner Announcements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-w-2xl">
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
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea
                      value={announcementMessage}
                      onChange={(e) => setAnnouncementMessage(e.target.value)}
                      rows={4}
                      placeholder="Write an announcement for everyone..."
                      data-testid="textarea-announcement-message"
                    />
                  </div>
                  <Button
                    onClick={() => announcementMutation.mutate()}
                    disabled={announcementMessage.trim().length === 0 || announcementMutation.isPending}
                    data-testid="button-send-announcement"
                  >
                    <Megaphone className="w-4 h-4 mr-2" />
                    {announcementMutation.isPending ? "Sending..." : "Send to all users and rooms"}
                  </Button>
                </CardContent>
              </Card>
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