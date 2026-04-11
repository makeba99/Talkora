import { useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Crown, FileWarning, Shield, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUserDisplayName } from "@/lib/utils";
import type { Report, User } from "@shared/schema";

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

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!canAccess,
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery<Report[]>({
    queryKey: ["/api/admin/reports"],
    enabled: !!canAccess,
  });

  const reportsByUser = useMemo(() => {
    const counts = new Map<string, number>();
    reports.forEach((report) => {
      counts.set(report.reportedId, (counts.get(report.reportedId) || 0) + 1);
    });
    return counts;
  }, [reports]);

  const stats = useMemo(() => {
    const pending = reports.filter((report) => report.status === "pending").length;
    const warned = users.filter((item) => item.warningCount > 0).length;
    const admins = users.filter((item) => item.role === "admin" || item.role === "superadmin" || item.email === OWNER_EMAIL).length;
    return { pending, warned, admins };
  }, [reports, users]);

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
          <div className="grid grid-cols-3 gap-3 min-w-full sm:min-w-[420px]">
            <Card className="bg-background/50 border-primary/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Pending reports</p>
                <p className="text-2xl font-bold text-primary" data-testid="text-pending-reports">{stats.pending}</p>
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
          <TabsList className="grid w-full max-w-lg grid-cols-3 bg-card/80 backdrop-blur">
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
                            </div>
                            <p className="text-sm text-muted-foreground truncate" data-testid={`text-user-email-${item.id}`}>
                              {item.email || item.id}
                            </p>
                            <p className="text-xs text-muted-foreground" data-testid={`text-user-meta-${item.id}`}>
                              {roleLabel(item)} · {reportsByUser.get(item.id) || 0} report{(reportsByUser.get(item.id) || 0) === 1 ? "" : "s"}
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
        </Tabs>
      </div>
    </div>
  );
}