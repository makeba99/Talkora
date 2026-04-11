import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Flag, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { getUserDisplayName, getUserInitials } from "@/lib/utils";

export const REPORT_CATEGORIES = [
  { value: "inappropriate_topic", label: "Inappropriate room topic" },
  { value: "hate_speech", label: "Hate speech or harassment" },
  { value: "spam", label: "Spam or scam" },
  { value: "explicit_content", label: "Explicit or adult content" },
  { value: "impersonation", label: "Impersonation" },
  { value: "threats_violence", label: "Threats or violence" },
  { value: "other", label: "Other reason" },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportedUser: {
    id: string;
    displayName?: string;
    profileImageUrl?: string | null;
    initials?: string;
  };
  context?: "room" | "user";
  contextLabel?: string;
  testIdSuffix?: string;
}

export function ReportDialog({
  open,
  onOpenChange,
  reportedUser,
  context = "user",
  contextLabel,
  testIdSuffix = "",
}: ReportDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [category, setCategory] = useState("inappropriate_topic");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleClose = (val: boolean) => {
    if (!val) {
      setCategory("inappropriate_topic");
      setReason("");
    }
    onOpenChange(val);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/reports", {
        reporterId: user.id,
        reportedId: reportedUser.id,
        reason: reason || category,
        reporterName: getUserDisplayName(user as any),
        reportedName: reportedUser.displayName || reportedUser.id,
        category: REPORT_CATEGORIES.find((c) => c.value === category)?.label || category,
      });
      toast({ description: "Report submitted. Thank you for helping keep the community safe." });
      handleClose(false);
    } catch {
      toast({ description: "Failed to submit report. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = reportedUser.displayName || reportedUser.id.slice(0, 8).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="p-0 border-0 flex flex-col w-full mx-4"
        aria-describedby={undefined}
        style={{
          background: "#0d1117",
          maxWidth: 420,
          maxHeight: "min(580px, 90vh)",
          overflow: "hidden",
        }}
      >
        {/* ── Fixed header ── */}
        <div
          className="flex-shrink-0 px-5 py-3 flex items-center gap-3"
          style={{
            background: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.08) 100%)",
            borderBottom: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(239,68,68,0.2)" }}
          >
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white leading-tight">Report User</h2>
            {user && (
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                Reporting as {getUserDisplayName(user as any)}
              </p>
            )}
          </div>
          {/* Reported user inline */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Avatar className="w-8 h-8 border flex-shrink-0" style={{ borderColor: "rgba(239,68,68,0.35)" }}>
              <AvatarImage src={reportedUser.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs font-bold text-white" style={{ background: "#1e2533" }}>
                {reportedUser.initials || displayName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 hidden sm:block">
              <p className="text-xs font-semibold truncate max-w-[90px]" style={{ color: "#f59e0b" }}>
                {displayName}
              </p>
              {contextLabel && (
                <p className="text-[10px] truncate max-w-[90px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {contextLabel}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>

          {/* Category selector */}
          <div className="px-5 pt-3 pb-2">
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
              Reason
            </p>
            <div className="flex flex-col gap-1.5">
              {REPORT_CATEGORIES.map((cat) => {
                const selected = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    className="flex items-center gap-2.5 w-full text-left rounded-lg px-3 py-2 transition-all"
                    style={{
                      background: selected ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.03)",
                      border: selected ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.07)",
                    }}
                    onClick={() => setCategory(cat.value)}
                    data-testid={`radio-report-${cat.value}-${testIdSuffix}`}
                  >
                    <div
                      className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        borderColor: selected ? "#ef4444" : "rgba(255,255,255,0.2)",
                        background: selected ? "#ef4444" : "transparent",
                      }}
                    >
                      {selected && <div className="w-1 h-1 rounded-full bg-white" />}
                    </div>
                    <span
                      className="text-xs font-medium transition-colors"
                      style={{ color: selected ? "#fff" : "rgba(255,255,255,0.5)" }}
                    >
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason textarea */}
          <div className="px-5 pb-2">
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              Additional details <span style={{ color: "rgba(255,255,255,0.18)" }}>(optional)</span>
            </p>
            <textarea
              className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                height: 56,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              placeholder="Describe what happened..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              data-testid={`textarea-report-reason-${testIdSuffix}`}
            />
            <p className="text-[10px] mt-0.5 text-right" style={{ color: "rgba(255,255,255,0.2)" }}>
              {reason.length}/500
            </p>
          </div>

          {/* Warning */}
          <div
            className="mx-5 mb-3 rounded-lg px-3 py-2 flex items-center gap-2"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)" }}
          >
            <Flag className="w-3 h-3 flex-shrink-0" style={{ color: "#f59e0b" }} />
            <p className="text-[10px] font-medium" style={{ color: "#f59e0b" }}>
              False reports may result in your account being restricted.
            </p>
          </div>
        </div>

        {/* ── Fixed footer ── */}
        <div
          className="flex-shrink-0 grid grid-cols-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <button
            className="py-3 text-sm font-medium transition-colors"
            style={{ color: "rgba(255,255,255,0.5)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(255,255,255,0.5)";
            }}
            onClick={() => handleClose(false)}
            data-testid={`button-report-cancel-${testIdSuffix}`}
          >
            Cancel
          </button>
          <button
            className="py-3 text-sm font-bold flex items-center justify-center gap-1.5 transition-opacity"
            style={{
              background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
              color: "#fff",
              opacity: submitting ? 0.6 : 1,
            }}
            onClick={handleSubmit}
            disabled={submitting}
            data-testid={`button-report-send-${testIdSuffix}`}
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
            {submitting ? "Sending..." : "Submit Report"}
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
