import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { LANGUAGES, LEVELS } from "@shared/schema";
import type { Teacher, Booking } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Search,
  Star,
  Globe,
  Clock,
  Users,
  CalendarCheck,
  BookOpen,
  Mic,
  LogIn,
  X,
  CheckCircle2,
  Calendar,
  Sparkles,
  GraduationCap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

type ReviewWithUser = {
  id: string;
  teacherId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { id: string; displayName: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null } | null;
};

type BookingWithTeacher = Booking & { teacher: Teacher | null };

const LANGUAGE_CODES: Record<string, string> = {
  English: "gb", Spanish: "es", French: "fr", German: "de",
  Japanese: "jp", Chinese: "cn", Korean: "kr", Portuguese: "br",
  Arabic: "sa", Hindi: "in", Armenian: "am", Indonesian: "id",
};

function LanguageFlag({ language }: { language: string }) {
  const code = LANGUAGE_CODES[language];
  if (!code) return <Globe className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />;
  return (
    <img
      src={`https://flagcdn.com/20x15/${code}.png`}
      srcSet={`https://flagcdn.com/40x30/${code}.png 2x`}
      width={18}
      height={13}
      alt={language}
      className="rounded-[2px] flex-shrink-0"
      style={{ objectFit: "cover" }}
    />
  );
}

function StarRating({ rating, max = 5, size = "sm" }: { rating: number; max?: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`${sz} ${i < rating ? "text-amber-400 fill-amber-400" : "text-white/20"}`}
        />
      ))}
    </div>
  );
}

function getLevelColor(level: string) {
  switch (level) {
    case "Beginner": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "Intermediate": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "Advanced": return "text-orange-400 bg-orange-400/10 border-orange-400/20";
    case "Native": return "text-purple-400 bg-purple-400/10 border-purple-400/20";
    default: return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
  }
}

function getDisplayName(user: ReviewWithUser["user"]) {
  if (!user) return "Anonymous";
  if (user.displayName) return user.displayName;
  if (user.firstName || user.lastName) return [user.firstName, user.lastName].filter(Boolean).join(" ");
  return "User";
}

function getInitials(user: ReviewWithUser["user"]) {
  if (!user) return "?";
  const name = getDisplayName(user);
  return name.slice(0, 2).toUpperCase();
}

function TeacherCard({ teacher, onView, onBook, isLoggedIn }: { teacher: Teacher; onView: () => void; onBook: () => void; isLoggedIn: boolean }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer group transition-all duration-300"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.border = "1px solid rgba(0,210,255,0.25)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 32px rgba(0,0,0,0.4), 0 0 20px rgba(0,210,255,0.07)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.08)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.3)";
      }}
      onClick={onView}
      data-testid={`card-teacher-${teacher.id}`}
    >
      {!teacher.isAvailable && (
        <div
          className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
        >
          Unavailable
        </div>
      )}
      {teacher.isAvailable && (
        <div
          className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Available
        </div>
      )}

      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="relative flex-shrink-0">
            <div
              className="rounded-full p-[2px]"
              style={{ background: "linear-gradient(135deg, rgba(0,200,255,0.7) 0%, rgba(110,60,255,0.7) 100%)" }}
            >
              <Avatar className="w-14 h-14 border-2 border-background">
                <AvatarImage src={teacher.avatarUrl || undefined} />
                <AvatarFallback className="text-lg font-bold" style={{ background: "rgba(0,200,255,0.1)" }}>
                  {teacher.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[15px] leading-tight text-white truncate" data-testid={`text-teacher-name-${teacher.id}`}>{teacher.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <StarRating rating={teacher.rating} />
              <span className="text-[11px] text-white/50">
                {teacher.rating > 0 ? `${teacher.rating}.0` : "New"} {teacher.reviewCount > 0 ? `(${teacher.reviewCount})` : ""}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className="text-[13px] font-bold"
                style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                data-testid={`text-teacher-rate-${teacher.id}`}
              >
                ${teacher.hourlyRate}/hr
              </span>
            </div>
          </div>
        </div>

        {teacher.bio && (
          <p className="text-[12px] text-white/55 leading-relaxed line-clamp-2">{teacher.bio}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {teacher.languages.slice(0, 3).map((lang) => (
            <div
              key={lang}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ background: "rgba(0,200,255,0.08)", border: "1px solid rgba(0,200,255,0.15)", color: "rgba(34,211,238,0.9)" }}
            >
              <LanguageFlag language={lang} />
              {lang}
            </div>
          ))}
          {teacher.languages.length > 3 && (
            <div
              className="px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
            >
              +{teacher.languages.length - 3}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {teacher.levels.slice(0, 3).map((level) => (
            <span key={level} className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getLevelColor(level)}`}>
              {level}
            </span>
          ))}
        </div>

        {teacher.specializations.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {teacher.specializations.slice(0, 3).map((s) => (
              <span
                key={s}
                className="px-2 py-0.5 rounded-full text-[10px]"
                style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)", color: "rgba(167,139,250,0.8)" }}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-1 text-[11px] text-white/40">
            <Clock className="w-3 h-3" />
            {teacher.sessionDurations.map(Number).sort((a, b) => a - b).join(" / ")} min
          </div>
          <div className="flex-1" />
          <Button
            size="sm"
            className="h-7 text-xs font-semibold px-3"
            style={{
              background: teacher.isAvailable
                ? "linear-gradient(135deg, rgba(0,200,255,0.85) 0%, rgba(100,50,240,0.85) 100%)"
                : "rgba(255,255,255,0.08)",
              border: teacher.isAvailable ? "1px solid rgba(0,210,255,0.3)" : "1px solid rgba(255,255,255,0.1)",
              color: teacher.isAvailable ? "#fff" : "rgba(255,255,255,0.3)",
              boxShadow: teacher.isAvailable ? "0 0 14px rgba(0,200,255,0.18)" : "none",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!isLoggedIn) { window.location.href = "/api/login"; return; }
              if (teacher.isAvailable) onBook();
            }}
            disabled={!teacher.isAvailable}
            data-testid={`button-book-teacher-${teacher.id}`}
          >
            <CalendarCheck className="w-3 h-3 mr-1.5" />
            Book
          </Button>
        </div>
      </div>
    </div>
  );
}

function BookingDialog({
  teacher,
  open,
  onClose,
}: {
  teacher: Teacher;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(teacher.sessionDurations[0] || "60");
  const [sessionType, setSessionType] = useState("private");
  const [notes, setNotes] = useState("");

  const bookMutation = useMutation({
    mutationFn: async () => {
      const scheduledAt = new Date(`${date}T${time}`);
      if (isNaN(scheduledAt.getTime())) throw new Error("Invalid date/time");
      const res = await apiRequest("POST", "/api/bookings", {
        teacherId: teacher.id,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: Number(duration),
        sessionType,
        notes: notes.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/my"] });
      toast({ title: "Session booked!", description: `Your session with ${teacher.name} is confirmed.` });
      onClose();
      setDate(""); setTime(""); setNotes("");
    },
    onError: (err: any) => {
      toast({ title: "Booking failed", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-md border-0 p-0 overflow-hidden"
        style={{ background: "#0d1117" }}
      >
        <div
          className="h-1 w-full"
          style={{ background: "linear-gradient(90deg, #22d3ee, #a78bfa, #22d3ee)", backgroundSize: "200% 100%", animation: "shimmer 3s linear infinite" }}
        />
        <div className="p-6 space-y-5">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <Avatar className="w-10 h-10">
                <AvatarImage src={teacher.avatarUrl || undefined} />
                <AvatarFallback>{teacher.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-[15px]">Book a Session</DialogTitle>
                <p className="text-[12px] text-white/50">with {teacher.name}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] text-white/60">Date</Label>
              <Input
                type="date"
                value={date}
                min={minDateStr}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 text-sm"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                data-testid="input-booking-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] text-white/60">Time</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-9 text-sm"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                data-testid="input-booking-time"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] text-white/60">Duration</Label>
              <Select value={String(duration)} onValueChange={setDuration}>
                <SelectTrigger
                  className="h-9 text-sm"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                  data-testid="select-booking-duration"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teacher.sessionDurations.map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] text-white/60">Session Type</Label>
              <Select value={sessionType} onValueChange={setSessionType}>
                <SelectTrigger
                  className="h-9 text-sm"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                  data-testid="select-booking-type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] text-white/60">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Topics to cover, your level, specific goals..."
              rows={3}
              className="text-sm resize-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
              data-testid="textarea-booking-notes"
            />
          </div>

          <div
            className="flex items-center justify-between p-3 rounded-lg"
            style={{ background: "rgba(0,200,255,0.06)", border: "1px solid rgba(0,200,255,0.12)" }}
          >
            <div className="text-[12px] text-white/60">Total ({duration} min)</div>
            <div
              className="text-[16px] font-bold"
              style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              ${Math.round((teacher.hourlyRate * Number(duration)) / 60)}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              className="flex-1 h-9"
              onClick={onClose}
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              data-testid="button-booking-cancel"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-9 font-semibold"
              style={{
                background: "linear-gradient(135deg, rgba(0,200,255,0.9) 0%, rgba(100,50,240,0.9) 100%)",
                border: "1px solid rgba(0,210,255,0.3)",
                boxShadow: "0 0 18px rgba(0,200,255,0.2)",
              }}
              onClick={() => bookMutation.mutate()}
              disabled={!date || !time || bookMutation.isPending}
              data-testid="button-booking-confirm"
            >
              {bookMutation.isPending ? "Booking..." : "Confirm Booking"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({
  teacherId,
  teacherName,
  open,
  onClose,
}: {
  teacherId: string;
  teacherName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [hovered, setHovered] = useState(0);

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/teachers/${teacherId}/reviews`, { rating, comment: comment.trim() || null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teachers", teacherId, "reviews"] });
      toast({ title: "Review submitted!", description: "Thank you for your feedback." });
      onClose();
      setRating(5); setComment("");
    },
    onError: (err: any) => {
      toast({ title: "Review failed", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm border-0" style={{ background: "#0d1117" }}>
        <DialogHeader>
          <DialogTitle className="text-[15px]">Leave a Review</DialogTitle>
          <p className="text-[12px] text-white/50">for {teacherName}</p>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(s)}
                data-testid={`button-review-star-${s}`}
              >
                <Star className={`w-8 h-8 transition-colors ${s <= (hovered || rating) ? "text-amber-400 fill-amber-400" : "text-white/20"}`} />
              </button>
            ))}
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this teacher..."
            rows={3}
            className="text-sm resize-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
            data-testid="textarea-review-comment"
          />
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onClose} style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              Cancel
            </Button>
            <Button
              className="flex-1 font-semibold"
              style={{ background: "linear-gradient(135deg, rgba(0,200,255,0.9) 0%, rgba(100,50,240,0.9) 100%)", border: "1px solid rgba(0,210,255,0.3)" }}
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending}
              data-testid="button-review-submit"
            >
              Submit Review
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TeacherProfileDialog({
  teacher,
  open,
  onClose,
  onBook,
  isLoggedIn,
  currentUserId,
}: {
  teacher: Teacher | null;
  open: boolean;
  onClose: () => void;
  onBook: () => void;
  isLoggedIn: boolean;
  currentUserId?: string;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<ReviewWithUser[]>({
    queryKey: ["/api/teachers", teacher?.id, "reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/teachers/${teacher!.id}/reviews`, { credentials: "include" });
      return res.json();
    },
    enabled: !!teacher && open,
  });

  if (!teacher) return null;

  const hasReviewed = currentUserId ? reviews.some((r) => r.userId === currentUserId) : false;
  const hasBooked = false;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="max-w-xl border-0 p-0 overflow-hidden max-h-[90vh] flex flex-col"
          style={{ background: "#0d1117" }}
        >
          <div
            className="h-1 flex-shrink-0"
            style={{ background: "linear-gradient(90deg, #22d3ee, #a78bfa, #22d3ee)" }}
          />
          <div className="overflow-y-auto flex-1">
            <div
              className="relative p-6 pb-4"
              style={{ background: "linear-gradient(to bottom, rgba(0,200,255,0.05) 0%, transparent 100%)" }}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                data-testid="button-teacher-profile-close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-start gap-4">
                <div
                  className="rounded-full p-[2px] flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, rgba(0,200,255,0.7) 0%, rgba(110,60,255,0.7) 100%)" }}
                >
                  <Avatar className="w-20 h-20 border-2 border-background">
                    <AvatarImage src={teacher.avatarUrl || undefined} />
                    <AvatarFallback className="text-2xl font-bold" style={{ background: "rgba(0,200,255,0.1)" }}>
                      {teacher.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-white" data-testid="text-teacher-profile-name">{teacher.name}</h2>
                    {teacher.isAvailable ? (
                      <div
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Available
                      </div>
                    ) : (
                      <div
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
                      >
                        Unavailable
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <StarRating rating={teacher.rating} size="lg" />
                    <span className="text-sm text-white/50">
                      {teacher.rating > 0 ? `${teacher.rating}.0` : "No ratings yet"} {teacher.reviewCount > 0 ? `· ${teacher.reviewCount} reviews` : ""}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span
                      className="text-lg font-bold"
                      style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                    >
                      ${teacher.hourlyRate}/hr
                    </span>
                    <div className="flex items-center gap-1 text-[12px] text-white/40">
                      <Clock className="w-3.5 h-3.5" />
                      {teacher.sessionDurations.map(Number).sort((a, b) => a - b).join(" / ")} min sessions
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 space-y-5 pb-6">
              {teacher.bio && (
                <div>
                  <p className="text-[13px] text-white/65 leading-relaxed">{teacher.bio}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-white/40 uppercase tracking-wider font-semibold">
                    <Globe className="w-3.5 h-3.5" />
                    Languages
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {teacher.languages.map((lang) => (
                      <div
                        key={lang}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium"
                        style={{ background: "rgba(0,200,255,0.08)", border: "1px solid rgba(0,200,255,0.18)", color: "rgba(34,211,238,0.9)" }}
                      >
                        <LanguageFlag language={lang} />
                        {lang}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-white/40 uppercase tracking-wider font-semibold">
                    <GraduationCap className="w-3.5 h-3.5" />
                    Levels
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {teacher.levels.map((level) => (
                      <span key={level} className={`px-2.5 py-1 rounded-full text-[12px] font-medium border ${getLevelColor(level)}`}>
                        {level}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {teacher.specializations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-white/40 uppercase tracking-wider font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    Specializations
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {teacher.specializations.map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-full text-[12px]"
                        style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.18)", color: "rgba(167,139,250,0.85)" }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-1">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-white/40 uppercase tracking-wider font-semibold">
                    <Star className="w-3.5 h-3.5" />
                    Reviews ({reviews.length})
                  </div>
                  {isLoggedIn && !hasReviewed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                      onClick={() => setReviewOpen(true)}
                      data-testid="button-leave-review"
                    >
                      Leave a Review
                    </Button>
                  )}
                </div>
                {reviewsLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
                  </div>
                ) : reviews.length === 0 ? (
                  <div
                    className="text-center py-6 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}
                  >
                    <Star className="w-8 h-8 text-white/15 mx-auto mb-2" />
                    <p className="text-sm text-white/30">No reviews yet. Be the first!</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {reviews.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={r.user?.profileImageUrl || undefined} />
                            <AvatarFallback className="text-[10px]">{getInitials(r.user)}</AvatarFallback>
                          </Avatar>
                          <span className="text-[12px] font-medium text-white/80">{getDisplayName(r.user)}</span>
                          <StarRating rating={r.rating} />
                          <span className="text-[11px] text-white/30 ml-auto">
                            {format(new Date(r.createdAt), "MMM d, yyyy")}
                          </span>
                        </div>
                        {r.comment && <p className="text-[12px] text-white/55 leading-relaxed">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button
                  className="w-full h-10 font-semibold"
                  style={{
                    background: teacher.isAvailable
                      ? "linear-gradient(135deg, rgba(0,200,255,0.9) 0%, rgba(100,50,240,0.9) 100%)"
                      : "rgba(255,255,255,0.08)",
                    border: teacher.isAvailable ? "1px solid rgba(0,210,255,0.3)" : "1px solid rgba(255,255,255,0.1)",
                    boxShadow: teacher.isAvailable ? "0 0 20px rgba(0,200,255,0.2)" : "none",
                  }}
                  onClick={() => { onClose(); onBook(); }}
                  disabled={!teacher.isAvailable || !isLoggedIn}
                  data-testid="button-teacher-profile-book"
                >
                  <CalendarCheck className="w-4 h-4 mr-2" />
                  {!isLoggedIn ? "Sign in to Book" : !teacher.isAvailable ? "Currently Unavailable" : "Book This Teacher"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {teacher && (
        <ReviewDialog
          teacherId={teacher.id}
          teacherName={teacher.name}
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </>
  );
}

function MyBookingCard({ booking, onCancel }: { booking: BookingWithTeacher; onCancel: (id: string) => void }) {
  const statusColor: Record<string, string> = {
    pending: "text-amber-400 border-amber-400/20 bg-amber-400/10",
    confirmed: "text-emerald-400 border-emerald-400/20 bg-emerald-400/10",
    cancelled: "text-red-400 border-red-400/20 bg-red-400/10",
    completed: "text-blue-400 border-blue-400/20 bg-blue-400/10",
  };

  return (
    <div
      className="p-4 rounded-xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      data-testid={`card-my-booking-${booking.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, rgba(0,200,255,0.15) 0%, rgba(100,50,240,0.15) 100%)", border: "1px solid rgba(0,200,255,0.2)" }}>
          <GraduationCap className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[13px] text-white">{booking.teacher?.name || "Teacher"}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor[booking.status] || statusColor.pending}`}>
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)", color: "rgba(167,139,250,0.8)" }}
            >
              {booking.sessionType === "private" ? "Private" : "Group"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[12px] text-white/45">
            <Calendar className="w-3 h-3" />
            {format(new Date(booking.scheduledAt), "MMM d, yyyy · h:mm a")}
            <span className="text-white/25">·</span>
            <Clock className="w-3 h-3" />
            {booking.durationMinutes} min
          </div>
          {booking.notes && (
            <p className="mt-1 text-[11px] text-white/35 italic truncate">{booking.notes}</p>
          )}
        </div>
        {booking.status !== "cancelled" && booking.status !== "completed" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] text-red-400/70 hover:text-red-400 hover:bg-red-400/10 flex-shrink-0"
            onClick={() => onCancel(booking.id)}
            data-testid={`button-cancel-booking-${booking.id}`}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

export default function TeachersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("All");
  const [selectedLevel, setSelectedLevel] = useState("All");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [myBookingsExpanded, setMyBookingsExpanded] = useState(false);

  const { data: allTeachers = [], isLoading } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers"],
  });

  const { data: myBookings = [] } = useQuery<BookingWithTeacher[]>({
    queryKey: ["/api/bookings/my"],
    enabled: !!user,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/bookings/${id}/cancel`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/my"] });
      toast({ title: "Booking cancelled" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to cancel", description: err.message, variant: "destructive" });
    },
  });

  const filteredTeachers = allTeachers.filter((t) => {
    const matchesSearch =
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.specializations.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.languages.some((l) => l.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesLang = selectedLanguage === "All" || t.languages.includes(selectedLanguage);
    const matchesLevel = selectedLevel === "All" || t.levels.includes(selectedLevel);
    return matchesSearch && matchesLang && matchesLevel;
  });

  const languages = ["All", ...LANGUAGES.filter((l) => l !== "All")];
  const levels = ["All", ...LEVELS];

  const activeBookings = myBookings.filter((b) => b.status !== "cancelled" && b.status !== "completed");
  const pastBookings = myBookings.filter((b) => b.status === "cancelled" || b.status === "completed");

  return (
    <div className="flex flex-col h-full">
      <header
        className="sticky top-0 z-50 bg-background/90 backdrop-blur-md flex-shrink-0"
        style={{
          borderBottom: "1px solid rgba(0,220,255,0.12)",
          boxShadow: "0 1px 0 rgba(0,220,255,0.08), 0 4px 24px rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
            data-testid="button-back-to-lobby"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Lobby</span>
          </button>

          <div className="w-px h-5" style={{ background: "rgba(255,255,255,0.08)" }} />

          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(110,60,255,0.25) 0%, rgba(0,200,255,0.18) 100%)",
                border: "1px solid rgba(110,60,255,0.3)",
                boxShadow: "0 0 14px rgba(110,60,255,0.15)",
              }}
            >
              <GraduationCap className="w-4 h-4 text-violet-400" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-[15px] font-extrabold leading-tight tracking-tight">
                Book a <span style={{ color: "#a78bfa" }}>Teacher</span>
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight tracking-widest uppercase opacity-70">
                Expert Instructors & Speakers
              </p>
            </div>
          </div>

          <div className="flex-1" />

          {!user && (
            <Button
              asChild
              size="sm"
              className="font-semibold"
              style={{
                background: "linear-gradient(135deg, rgba(110,60,255,0.9) 0%, rgba(0,200,255,0.9) 100%)",
                border: "1px solid rgba(110,60,255,0.35)",
              }}
              data-testid="button-sign-in-teachers"
            >
              <a href="/api/login">
                <LogIn className="w-4 h-4 mr-1.5" />
                Sign In to Book
              </a>
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 space-y-5">

          {user && myBookings.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "rgba(110,60,255,0.06)", border: "1px solid rgba(110,60,255,0.2)" }}
            >
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                onClick={() => setMyBookingsExpanded(!myBookingsExpanded)}
                data-testid="button-toggle-my-bookings"
              >
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-violet-400" />
                  <span className="font-semibold text-[13px] text-white">My Bookings</span>
                  {activeBookings.length > 0 && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: "rgba(110,60,255,0.5)", color: "#c4b5fd" }}
                    >
                      {activeBookings.length}
                    </div>
                  )}
                </div>
                {myBookingsExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
              </button>

              {myBookingsExpanded && (
                <div className="px-4 pb-4 space-y-2.5">
                  {activeBookings.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Upcoming</p>
                      {activeBookings.map((b) => (
                        <MyBookingCard key={b.id} booking={b} onCancel={(id) => cancelMutation.mutate(id)} />
                      ))}
                    </div>
                  )}
                  {pastBookings.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mt-3">Past</p>
                      {pastBookings.map((b) => (
                        <MyBookingCard key={b.id} booking={b} onCancel={(id) => cancelMutation.mutate(id)} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div
            className="relative rounded-xl p-5 overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(110,60,255,0.08) 0%, rgba(0,200,255,0.06) 100%)",
              border: "1px solid rgba(110,60,255,0.2)",
            }}
          >
            <div
              className="absolute -top-12 -right-12 w-36 h-36 rounded-full pointer-events-none opacity-20"
              style={{ background: "radial-gradient(circle, rgba(110,60,255,0.5), transparent 70%)" }}
            />
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, rgba(110,60,255,0.3), rgba(0,200,255,0.2))", border: "1px solid rgba(110,60,255,0.3)" }}
              >
                <BookOpen className="w-6 h-6 text-violet-300" />
              </div>
              <div>
                <h2 className="font-bold text-[15px] text-white">Expert-Led Sessions</h2>
                <p className="text-[12px] text-white/50 mt-0.5 max-w-sm">
                  Connect with verified teachers and native speakers for personalized language lessons, pronunciation coaching, and exam preparation.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              {[
                { icon: <Users className="w-3.5 h-3.5" />, label: `${allTeachers.length} Teachers` },
                { icon: <Globe className="w-3.5 h-3.5" />, label: `${[...new Set(allTeachers.flatMap((t) => t.languages))].length} Languages` },
                { icon: <Star className="w-3.5 h-3.5" />, label: "Verified Experts" },
                { icon: <Mic className="w-3.5 h-3.5" />, label: "Live Sessions" },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
                >
                  {icon}
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
              <Input
                placeholder="Search teachers, languages, specializations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 text-sm"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                data-testid="input-search-teachers"
              />
            </div>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger
                className="w-full sm:w-40 h-10 text-sm"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                data-testid="select-filter-language"
              >
                <Globe className="w-4 h-4 mr-2 opacity-50 flex-shrink-0" />
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger
                className="w-full sm:w-40 h-10 text-sm"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                data-testid="select-filter-level"
              >
                <GraduationCap className="w-4 h-4 mr-2 opacity-50 flex-shrink-0" />
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                {levels.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-3 p-5 rounded-xl border" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="flex gap-3">
                    <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: "rgba(110,60,255,0.1)", border: "1px solid rgba(110,60,255,0.2)" }}
              >
                <GraduationCap className="w-9 h-9 text-violet-400/50" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-semibold text-white/70" data-testid="text-no-teachers">
                  {searchQuery || selectedLanguage !== "All" || selectedLevel !== "All"
                    ? "No teachers match your filters"
                    : "No teachers available yet"}
                </h3>
                <p className="text-sm text-white/35">
                  {searchQuery || selectedLanguage !== "All" || selectedLevel !== "All"
                    ? "Try adjusting your search or filters"
                    : "Check back soon — we're adding expert teachers regularly."}
                </p>
              </div>
              {(searchQuery || selectedLanguage !== "All" || selectedLevel !== "All") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSearchQuery(""); setSelectedLanguage("All"); setSelectedLevel("All"); }}
                  style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTeachers.map((teacher) => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  isLoggedIn={!!user}
                  onView={() => {
                    setSelectedTeacher(teacher);
                    setProfileOpen(true);
                  }}
                  onBook={() => {
                    setSelectedTeacher(teacher);
                    setBookingOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <TeacherProfileDialog
        teacher={selectedTeacher}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onBook={() => {
          setProfileOpen(false);
          setBookingOpen(true);
        }}
        isLoggedIn={!!user}
        currentUserId={user?.id}
      />

      {selectedTeacher && (
        <BookingDialog
          teacher={selectedTeacher}
          open={bookingOpen}
          onClose={() => setBookingOpen(false)}
        />
      )}
    </div>
  );
}
