import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { LANGUAGES, LEVELS, SPECIALIZATIONS } from "@shared/schema";
import type { Teacher, Booking, TeacherApplication } from "@shared/schema";
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
  SendHorizonal,
  DollarSign,
  XCircle,
  ArrowUpDown,
  TrendingUp,
  Flame,
  BadgeDollarSign,
  CircleCheckBig,
  Trophy,
  Filter,
  SlidersHorizontal,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Zap,
  Award,
  Wallet,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import { PaymentMethodForm, SavedCardItem, type CardFormData } from "@/components/payment-method-form";
import { SiteFooter } from "@/components/site-footer";
import type { PaymentMethod } from "@shared/schema";

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
  const normalizedRating = rating > max ? rating / 10 : rating;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`${sz} ${i < Math.round(normalizedRating) ? "text-amber-400 fill-amber-400" : "text-white/20"}`}
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

const SAMPLE_TEACHERS: Teacher[] = [
  {
    id: "sample-teacher-maya",
    name: "Maya Chen",
    bio: "Conversation coach focused on confidence, natural pacing, and practical vocabulary for everyday English.",
    avatarUrl: "https://randomuser.me/api/portraits/women/46.jpg",
    languages: ["English", "Chinese"],
    levels: ["Beginner", "Intermediate", "Advanced"],
    specializations: ["General Conversation", "Pronunciation", "Business English"],
    hourlyRate: 24,
    sessionDurations: ["30", "60"],
    rating: 49,
    reviewCount: 38,
    isAvailable: true,
    userId: null,
    createdAt: new Date(),
  },
  {
    id: "sample-teacher-sofia",
    name: "Sofia Ramirez",
    bio: "Spanish tutor for travel, casual speaking, and grammar patterns that help learners sound more natural.",
    avatarUrl: "https://randomuser.me/api/portraits/women/22.jpg",
    languages: ["Spanish", "English"],
    levels: ["Beginner", "Intermediate"],
    specializations: ["Travel", "Grammar", "Slang & Casual"],
    hourlyRate: 18,
    sessionDurations: ["30", "45", "60"],
    rating: 48,
    reviewCount: 52,
    isAvailable: true,
    userId: null,
    createdAt: new Date(),
  },
  {
    id: "sample-teacher-aram",
    name: "Aram Petrosyan",
    bio: "Native Armenian speaker helping learners practice heritage conversations, reading basics, and pronunciation.",
    avatarUrl: "https://randomuser.me/api/portraits/men/44.jpg",
    languages: ["Armenian", "English"],
    levels: ["Beginner", "Intermediate", "Native"],
    specializations: ["Reading", "Pronunciation", "General Conversation"],
    hourlyRate: 22,
    sessionDurations: ["30", "60"],
    rating: 47,
    reviewCount: 24,
    isAvailable: true,
    userId: null,
    createdAt: new Date(),
  },
  {
    id: "sample-teacher-yuki",
    name: "Yuki Tanaka",
    bio: "Japanese teacher for anime fans, travelers, and learners building sentence structure from zero.",
    avatarUrl: "https://randomuser.me/api/portraits/women/5.jpg",
    languages: ["Japanese", "English"],
    levels: ["Beginner", "Intermediate"],
    specializations: ["Travel", "Listening", "Slang & Casual"],
    hourlyRate: 30,
    sessionDurations: ["45", "60"],
    rating: 50,
    reviewCount: 41,
    isAvailable: true,
    userId: null,
    createdAt: new Date(),
  },
  {
    id: "sample-teacher-nour",
    name: "Nour Haddad",
    bio: "Arabic pronunciation and conversation sessions with patient correction and practical daily-life topics.",
    avatarUrl: "https://randomuser.me/api/portraits/women/61.jpg",
    languages: ["Arabic", "English"],
    levels: ["Beginner", "Intermediate", "Advanced"],
    specializations: ["Pronunciation", "Listening", "Academic"],
    hourlyRate: 28,
    sessionDurations: ["30", "60"],
    rating: 48,
    reviewCount: 33,
    isAvailable: false,
    userId: null,
    createdAt: new Date(),
  },
  {
    id: "sample-teacher-elena",
    name: "Elena Fischer",
    bio: "German exam and interview coach for learners who need structured speaking practice and clear feedback.",
    avatarUrl: "https://randomuser.me/api/portraits/women/17.jpg",
    languages: ["German", "English"],
    levels: ["Intermediate", "Advanced"],
    specializations: ["Exam Preparation", "Business English", "Writing"],
    hourlyRate: 36,
    sessionDurations: ["60"],
    rating: 49,
    reviewCount: 45,
    isAvailable: true,
    userId: null,
    createdAt: new Date(),
  },
];

/* ── MiniCalendar — sculpted neumorphic month grid picker ────────── */
function MiniCalendar({
  value,
  onChange,
  minDate,
}: {
  value: string;          // "YYYY-MM-DD" or ""
  onChange: (v: string) => void;
  minDate?: Date;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initial = value ? new Date(value + "T00:00") : today;
  const [viewMonth, setViewMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const monthName = viewMonth.toLocaleString("en", { month: "long", year: "numeric" });
  const firstDow = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 0).getDate();

  const cells: { day: number; isOtherMonth: boolean; date: Date }[] = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    cells.push({ day: d, isOtherMonth: true, date: new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, d) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isOtherMonth: false, date: new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d) });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const dayIndex = cells.length - (firstDow + daysInMonth) + 1;
    cells.push({ day: dayIndex, isOtherMonth: true, date: new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, dayIndex) });
    if (cells.length >= 42) break;
  }

  function fmt(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const min = minDate || today;
  min.setHours(0, 0, 0, 0);

  return (
    <div className="neu-mini-cal" data-testid="mini-calendar">
      <div className="neu-cal-header">
        <button
          type="button"
          className="neu-cal-nav"
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
          data-testid="button-cal-prev"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="neu-cal-title" data-testid="text-cal-month">{monthName}</div>
        <button
          type="button"
          className="neu-cal-nav"
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
          data-testid="button-cal-next"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="neu-cal-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={`dow-${i}`} className="neu-cal-dow">{d}</div>
        ))}
        {cells.map((c, idx) => {
          const isPast = c.date < min;
          const dateStr = fmt(c.date);
          const isSelected = value === dateStr;
          const isToday =
            c.date.getFullYear() === today.getFullYear() &&
            c.date.getMonth() === today.getMonth() &&
            c.date.getDate() === today.getDate();
          return (
            <button
              key={idx}
              type="button"
              disabled={isPast || c.isOtherMonth}
              className={`neu-cal-day ${c.isOtherMonth ? "is-other-month" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}
              onClick={() => !c.isOtherMonth && !isPast && onChange(dateStr)}
              data-testid={`button-cal-day-${dateStr}`}
            >
              {c.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── TimeChips — generates morning/afternoon/evening time slots ──── */
function TimeChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const sections: { label: string; icon: React.ReactNode; slots: string[] }[] = [
    { label: "Morning",   icon: <Sparkles className="w-3 h-3" />, slots: ["08:00", "09:00", "10:00", "11:00"] },
    { label: "Afternoon", icon: <Zap className="w-3 h-3" />,      slots: ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00"] },
    { label: "Evening",   icon: <Star className="w-3 h-3" />,     slots: ["18:00", "19:00", "20:00", "21:00", "22:00"] },
  ];
  function toLabel(t: string) {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hh}:${String(m).padStart(2, "0")} ${period}`;
  }
  return (
    <div className="space-y-3" data-testid="time-chips">
      {sections.map((sec) => (
        <div key={sec.label} className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
            <span className="text-violet-400/70">{sec.icon}</span>
            {sec.label}
          </div>
          <div className="neu-time-strip">
            {sec.slots.map((t) => (
              <button
                key={t}
                type="button"
                className={`neu-time-chip ${value === t ? "is-active" : ""}`}
                onClick={() => onChange(t)}
                data-testid={`button-time-${t.replace(":", "")}`}
              >
                {toLabel(t)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TeacherCard({ teacher, onView, onBook, isLoggedIn }: { teacher: Teacher; onView: () => void; onBook: () => void; isLoggedIn: boolean }) {
  const isFeatured = teacher.rating >= 49;
  const sessionMins = teacher.sessionDurations.map(Number).sort((a, b) => a - b);

  return (
    <div
      className="neu-teacher-card cursor-pointer"
      onClick={onView}
      data-testid={`card-teacher-${teacher.id}`}
    >
      {/* Top status row */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap gap-1.5">
          {teacher.id.startsWith("sample-") && (
            <span className="neu-status-pill is-trial">
              <Sparkles className="w-2.5 h-2.5" />
              Trial
            </span>
          )}
          {isFeatured && (
            <span className="neu-status-pill is-trial">
              <Trophy className="w-2.5 h-2.5" />
              Featured
            </span>
          )}
        </div>
        {teacher.isAvailable ? (
          <span className="neu-status-pill is-available">
            <span className="dot" />
            Live
          </span>
        ) : (
          <span className="neu-status-pill is-unavailable">Offline</span>
        )}
      </div>

      <div className="p-5 pt-12 space-y-3.5">
        {/* Header row: avatar + name + rate */}
        <div className="flex items-start gap-3.5">
          <div className="neu-avatar-plate">
            <Avatar className="w-full h-full">
              <AvatarImage src={teacher.avatarUrl || undefined} />
              <AvatarFallback
                className="text-base font-extrabold tracking-wide"
                style={{
                  background: "linear-gradient(140deg, hsl(var(--neu-orange-hi)) 0%, hsl(var(--neu-orange-lo)) 100%)",
                  color: "#fff",
                }}
              >
                {teacher.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="font-extrabold text-[15px] leading-tight text-white truncate tracking-tight"
              data-testid={`text-teacher-name-${teacher.id}`}
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
            >
              {teacher.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <StarRating rating={teacher.rating} />
              <span className="text-[11px] text-white/55 font-semibold">
                {teacher.rating > 0
                  ? (teacher.rating > 5 ? (teacher.rating / 10).toFixed(1) : teacher.rating.toFixed(1))
                  : "New"}
                {teacher.reviewCount > 0 ? <span className="text-white/35"> · {teacher.reviewCount}</span> : null}
              </span>
            </div>
            <div className="mt-2">
              <span className="neu-rate-badge" data-testid={`text-teacher-rate-${teacher.id}`}>
                <span className="currency">$</span>{teacher.hourlyRate}<span className="per">/hr</span>
              </span>
            </div>
          </div>
        </div>

        {teacher.bio && (
          <p className="text-[12px] text-white/55 leading-relaxed line-clamp-2 italic">
            "{teacher.bio}"
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {teacher.languages.slice(0, 3).map((lang) => (
            <div key={lang} className="neu-tag is-cyan">
              <LanguageFlag language={lang} />
              {lang}
            </div>
          ))}
          {teacher.languages.length > 3 && (
            <div className="neu-tag">+{teacher.languages.length - 3}</div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {teacher.levels.slice(0, 3).map((level) => {
            const cls =
              level === "Beginner"     ? "is-emerald" :
              level === "Intermediate" ? "is-amber"   :
              level === "Advanced"     ? "is-rose"    :
              level === "Native"       ? "is-violet"  : "is-cyan";
            return <span key={level} className={`neu-tag ${cls}`}>{level}</span>;
          })}
        </div>

        {teacher.specializations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {teacher.specializations.slice(0, 3).map((s) => (
              <span key={s} className="neu-tag is-violet">{s}</span>
            ))}
          </div>
        )}

        <div
          className="flex items-center gap-2 pt-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.045)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.025)" }}
        >
          <div className="flex items-center gap-1 text-[11px] text-white/45 font-semibold">
            <Clock className="w-3 h-3 text-violet-400/70" />
            {sessionMins.join(" / ")}<span className="opacity-60 ml-0.5">min</span>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            className={`neu-book-button ${!teacher.isAvailable ? "is-disabled" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!isLoggedIn) { window.location.href = "/api/login"; return; }
              if (teacher.isAvailable) onBook();
            }}
            disabled={!teacher.isAvailable}
            data-testid={`button-book-teacher-${teacher.id}`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            Book Now
          </button>
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
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(teacher.sessionDurations[0] || "60");
  const [sessionType, setSessionType] = useState("private");
  const [notes, setNotes] = useState("");
  const [selectedPmId, setSelectedPmId] = useState<string | null>(null);
  const [showNewCard, setShowNewCard] = useState(false);

  const totalPrice = Math.round((teacher.hourlyRate * Number(duration)) / 60);

  const { data: paymentMethods = [], refetch: refetchPms } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
    enabled: !!user,
  });

  const addPmMutation = useMutation({
    mutationFn: async (data: CardFormData) => {
      const res = await apiRequest("POST", "/api/payment-methods", data);
      return res.json();
    },
    onSuccess: (pm: PaymentMethod) => {
      refetchPms();
      setSelectedPmId(pm.id);
      setShowNewCard(false);
      toast({ title: "Card saved!", description: `${pm.cardholderName}'s card ending in ${pm.last4} added.` });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save card", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

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
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: "Booking failed", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  function handleClose() {
    onClose();
    setStep(1);
    setDate(""); setTime(""); setNotes("");
    setSelectedPmId(null);
    setShowNewCard(false);
  }

  function handleNextStep() {
    if (!date || !time) return;
    const defaultPm = paymentMethods.find((p) => p.isDefault);
    if (!selectedPmId && defaultPm) setSelectedPmId(defaultPm.id);
    setStep(2);
  }

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split("T")[0];

  const formattedDateTime = date && time
    ? `${new Date(date + "T" + time).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })} · ${(() => {
        const [h, m] = time.split(":").map(Number);
        const period = h >= 12 ? "PM" : "AM";
        const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${hh}:${String(m).padStart(2, "0")} ${period}`;
      })()}`
    : "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="max-w-md border-0 p-0 overflow-hidden"
        style={{
          background: "linear-gradient(160deg, hsl(228 16% 12%) 0%, hsl(228 18% 9%) 100%)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.05), -8px -8px 24px rgba(255,255,255,0.025), 16px 20px 60px rgba(0,0,0,0.85)",
        }}
      >
        {/* Top accent rail */}
        <div
          className="h-[3px] w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, hsl(var(--neu-orange-hi) / 0.85) 25%, hsl(var(--neu-orange) / 0.85) 50%, hsl(var(--neu-orange-hi) / 0.85) 75%, transparent 100%)",
            boxShadow: "0 0 16px hsl(var(--neu-orange) / 0.6)",
          }}
        />
        <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                {step === 2 && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="neu-cal-nav"
                    aria-label="Back"
                    data-testid="button-booking-back"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <div className="neu-avatar-plate" style={{ width: 44, height: 44 }}>
                  <Avatar className="w-full h-full">
                    <AvatarImage src={teacher.avatarUrl || undefined} />
                    <AvatarFallback
                      style={{
                        background: "linear-gradient(140deg, hsl(var(--neu-orange-hi)) 0%, hsl(var(--neu-orange-lo)) 100%)",
                        color: "#fff",
                      }}
                    >
                      {teacher.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <DialogTitle className="text-[15px] font-extrabold tracking-tight" style={{ color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                    {step === 1 ? "Schedule Session" : "Secure Payment"}
                  </DialogTitle>
                  <p className="text-[11px] text-white/50 font-medium tracking-wide">with {teacher.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2].map((s) => (
                  <div
                    key={s}
                    className={`neu-step-dot ${step >= s ? "is-active" : ""}`}
                    style={{ width: step === s ? 28 : 10 }}
                  />
                ))}
              </div>
            </div>
          </DialogHeader>

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold tracking-widest uppercase text-white/45 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-violet-400" />
                  Pick a date
                </Label>
                <MiniCalendar
                  value={date}
                  onChange={setDate}
                  minDate={minDate}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold tracking-widest uppercase text-white/45 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-violet-400" />
                  Pick a time
                </Label>
                <TimeChips value={time} onChange={setTime} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold tracking-widest uppercase text-white/45">Duration</Label>
                  <div
                    className="neu-segmented"
                    style={{ gridTemplateColumns: `repeat(${teacher.sessionDurations.length}, 1fr)` }}
                  >
                    {teacher.sessionDurations.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`neu-segmented-item ${String(duration) === String(d) ? "is-active" : ""}`}
                        onClick={() => setDuration(String(d))}
                        data-testid={`button-duration-${d}`}
                      >
                        {d}<span className="opacity-60 ml-0.5">m</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold tracking-widest uppercase text-white/45">Session Type</Label>
                  <div className="neu-segmented" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <button
                      type="button"
                      className={`neu-segmented-item ${sessionType === "private" ? "is-active" : ""}`}
                      onClick={() => setSessionType("private")}
                      data-testid="button-type-private"
                    >
                      Private
                    </button>
                    <button
                      type="button"
                      className={`neu-segmented-item ${sessionType === "group" ? "is-active" : ""}`}
                      onClick={() => setSessionType("group")}
                      data-testid="button-type-group"
                    >
                      Group
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold tracking-widest uppercase text-white/45">Notes <span className="opacity-60 normal-case font-medium">(optional)</span></Label>
                <div className="neu-input-well" style={{ height: "auto", padding: "10px 12px", alignItems: "flex-start" }}>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Topics to cover, your level, specific goals…"
                    rows={3}
                    className="resize-none"
                    style={{ minHeight: 60 }}
                    data-testid="textarea-booking-notes"
                  />
                </div>
              </div>

              <div className="neu-total-bar">
                <div className="flex items-center gap-2.5">
                  <Wallet className="w-4 h-4 text-violet-300" />
                  <div>
                    <div className="text-[10px] font-bold tracking-widest uppercase text-white/45">Total · {duration} min</div>
                    <div className="text-[11px] text-white/55 font-medium mt-0.5">{sessionType === "private" ? "Private session" : "Group session"}</div>
                  </div>
                </div>
                <div className="total-amount" data-testid="text-booking-total">
                  ${totalPrice}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="ghost"
                  className="flex-1 h-10"
                  onClick={handleClose}
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  data-testid="button-booking-cancel"
                >
                  Cancel
                </Button>
                <button
                  type="button"
                  className={`flex-1 neu-book-button h-10 justify-center ${(!date || !time) ? "is-disabled" : ""}`}
                  onClick={handleNextStep}
                  disabled={!date || !time}
                  data-testid="button-booking-next"
                >
                  Continue to Payment
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="neu-total-bar" style={{ padding: "10px 14px" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarCheck className="w-4 h-4 text-violet-300 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold tracking-widest uppercase text-white/45">Confirmed for</div>
                    <div className="text-[12px] text-white/85 font-semibold truncate">{formattedDateTime}</div>
                  </div>
                </div>
                <div className="total-amount" style={{ fontSize: 18 }}>${totalPrice}</div>
              </div>

              {paymentMethods.length > 0 && !showNewCard && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold tracking-widest uppercase text-white/45 flex items-center gap-1.5">
                    <CreditCard className="w-3 h-3 text-violet-400" />
                    Choose a card
                  </Label>
                  <div className="space-y-2">
                    {paymentMethods.map((pm) => (
                      <SavedCardItem
                        key={pm.id}
                        {...pm}
                        selected={selectedPmId === pm.id}
                        onSelect={() => setSelectedPmId(pm.id)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewCard(true)}
                    className="w-full text-[12px] font-semibold py-2.5 rounded-xl transition-colors"
                    style={{
                      color: "hsl(var(--neu-orange-hi))",
                      background: "linear-gradient(155deg, hsl(228 18% 10%) 0%, hsl(228 16% 13%) 100%)",
                      border: "1px dashed hsl(var(--neu-orange-hi) / 0.35)",
                      boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.45), inset -1px -1px 3px rgba(255,255,255,0.025)",
                    }}
                    data-testid="button-add-new-card"
                  >
                    + Add a new card
                  </button>
                </div>
              )}

              {(paymentMethods.length === 0 || showNewCard) && (
                <div className="space-y-3">
                  {showNewCard && (
                    <button
                      type="button"
                      onClick={() => setShowNewCard(false)}
                      className="text-[12px] text-white/45 hover:text-violet-300 transition-colors flex items-center gap-1"
                      data-testid="button-back-to-cards"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Back to saved cards
                    </button>
                  )}
                  {paymentMethods.length === 0 && (
                    <p className="text-[12px] text-white/45 text-center py-1 italic">
                      No saved cards yet — add one to continue
                    </p>
                  )}
                  <PaymentMethodForm
                    onSubmit={(data) => addPmMutation.mutate(data)}
                    isPending={addPmMutation.isPending}
                    submitLabel="Save Card & Continue"
                  />
                </div>
              )}

              {paymentMethods.length > 0 && !showNewCard && (
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="ghost"
                    className="flex-1 h-10"
                    onClick={handleClose}
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    data-testid="button-booking-cancel-2"
                  >
                    Cancel
                  </Button>
                  <button
                    type="button"
                    className={`flex-1 neu-book-button h-10 justify-center ${(!selectedPmId || bookMutation.isPending) ? "is-disabled" : ""}`}
                    onClick={() => bookMutation.mutate()}
                    disabled={!selectedPmId || bookMutation.isPending}
                    data-testid="button-booking-confirm"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {bookMutation.isPending ? "Booking…" : `Confirm & Pay $${totalPrice}`}
                  </button>
                </div>
              )}
            </>
          )}
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
                      {teacher.rating > 0 ? (teacher.rating > 5 ? (teacher.rating / 10).toFixed(1) : teacher.rating.toFixed(1)) : "No ratings yet"} {teacher.reviewCount > 0 ? `· ${teacher.reviewCount} reviews` : ""}
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
  const statusMeta: Record<string, { cls: string; label: string }> = {
    pending:   { cls: "is-amber",   label: "Pending" },
    confirmed: { cls: "is-emerald", label: "Confirmed" },
    cancelled: { cls: "is-rose",    label: "Cancelled" },
    completed: { cls: "is-cyan",    label: "Completed" },
  };
  const status = statusMeta[booking.status] || statusMeta.pending;

  return (
    <div
      className="neu-saved-card"
      style={{ cursor: "default" }}
      data-testid={`card-my-booking-${booking.id}`}
    >
      <div className="neu-icon-plate" style={{ width: 40, height: 40 }}>
        <GraduationCap className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-extrabold text-[13px] text-white truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
            {booking.teacher?.name || "Teacher"}
          </span>
          <span className={`neu-tag ${status.cls}`}>{status.label}</span>
          <span className="neu-tag is-violet">{booking.sessionType === "private" ? "Private" : "Group"}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-white/55 font-semibold">
          <Calendar className="w-3 h-3 text-violet-400/70" />
          {format(new Date(booking.scheduledAt), "MMM d, yyyy · h:mm a")}
          <span className="text-white/25">·</span>
          <Clock className="w-3 h-3 text-violet-400/70" />
          {booking.durationMinutes} min
        </div>
        {booking.notes && (
          <p className="mt-1 text-[11px] text-white/40 italic truncate">"{booking.notes}"</p>
        )}
      </div>
      {booking.status !== "cancelled" && booking.status !== "completed" && (
        <button
          type="button"
          className="text-red-400/70 hover:text-red-400 p-2 rounded-md transition-colors flex-shrink-0"
          style={{
            background: "linear-gradient(150deg, hsl(228 14% 17%) 0%, hsl(228 14% 13%) 100%)",
            border: "1px solid rgba(239,68,68,0.18)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 1px 2px 4px rgba(0,0,0,0.4)",
          }}
          onClick={() => onCancel(booking.id)}
          data-testid={`button-cancel-booking-${booking.id}`}
          title="Cancel booking"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
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
  const [applyOpen, setApplyOpen] = useState(false);
  const [sortBy, setSortBy] = useState("top-rated");
  const [priceRange, setPriceRange] = useState("all");
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [selectedSpec, setSelectedSpec] = useState("All");
  const [applyForm, setApplyForm] = useState({
    name: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : (user?.displayName ?? ""),
    bio: "",
    languages: [] as string[],
    levels: [] as string[],
    specializations: [] as string[],
    suggestedRate: "",
    paypalEmail: "",
    experience: "",
  });

  const { data: fetchedTeachers = [], isLoading } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers"],
  });

  const { data: myBookings = [] } = useQuery<BookingWithTeacher[]>({
    queryKey: ["/api/bookings/my"],
    enabled: !!user,
  });

  const { data: myApplication } = useQuery<TeacherApplication | null>({
    queryKey: ["/api/teacher-applications/my"],
    enabled: !!user,
  });

  const applyMutation = useMutation({
    mutationFn: async (data: typeof applyForm) => {
      const res = await apiRequest("POST", "/api/teacher-applications", {
        ...data,
        suggestedRate: Number(data.suggestedRate) || 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-applications/my"] });
      setApplyOpen(false);
      toast({ title: "Application submitted!", description: "We'll review your application and get back to you." });
    },
    onError: (err: any) => toast({ title: "Submission failed", description: err.message, variant: "destructive" }),
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

  const realTeacherIds = new Set(fetchedTeachers.map((t) => t.id));
  const sampleTeachersToShow = SAMPLE_TEACHERS.filter((s) => !realTeacherIds.has(s.id));
  const allTeachers = [...fetchedTeachers, ...sampleTeachersToShow];
  const showingSampleTeachers = fetchedTeachers.length === 0;

  const filteredTeachers = allTeachers
    .filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.specializations.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.languages.some((l) => l.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesLang = selectedLanguage === "All" || t.languages.includes(selectedLanguage);
      const matchesLevel = selectedLevel === "All" || t.levels.includes(selectedLevel);
      const matchesSpec = selectedSpec === "All" || t.specializations.includes(selectedSpec);
      const matchesPrice =
        priceRange === "all" ? true :
        priceRange === "budget" ? t.hourlyRate <= 20 :
        priceRange === "mid" ? t.hourlyRate > 20 && t.hourlyRate <= 35 :
        priceRange === "premium" ? t.hourlyRate > 35 : true;
      const matchesQuick =
        !quickFilter ? true :
        quickFilter === "top-rated" ? t.rating >= 47 :
        quickFilter === "most-reviewed" ? t.reviewCount >= 30 :
        quickFilter === "available" ? t.isAvailable :
        quickFilter === "budget" ? t.hourlyRate <= 25 :
        quickFilter === "featured" ? t.rating >= 49 : true;
      return matchesSearch && matchesLang && matchesLevel && matchesSpec && matchesPrice && matchesQuick;
    })
    .sort((a, b) => {
      if (sortBy === "top-rated") return b.rating - a.rating;
      if (sortBy === "most-reviewed") return b.reviewCount - a.reviewCount;
      if (sortBy === "price-asc") return a.hourlyRate - b.hourlyRate;
      if (sortBy === "price-desc") return b.hourlyRate - a.hourlyRate;
      return 0;
    });

  const languages = ["All", ...LANGUAGES.filter((l) => l !== "All")];
  const levels = ["All", ...LEVELS];
  const specs = ["All", ...SPECIALIZATIONS];

  const activeFilterCount = [
    selectedLanguage !== "All",
    selectedLevel !== "All",
    selectedSpec !== "All",
    priceRange !== "all",
    !!quickFilter,
    !!searchQuery,
  ].filter(Boolean).length;

  const activeBookings = myBookings.filter((b) => b.status !== "cancelled" && b.status !== "completed");
  const pastBookings = myBookings.filter((b) => b.status === "cancelled" || b.status === "completed");

  return (
    <div className="flex flex-col h-full neu-canvas">
      <header
        className="sticky top-0 z-50 backdrop-blur-md flex-shrink-0"
        style={{
          background: "linear-gradient(180deg, hsl(228 18% 11% / 0.95) 0%, hsl(228 18% 9% / 0.85) 100%)",
          borderBottom: "1px solid hsl(var(--neu-orange-hi) / 0.18)",
          boxShadow: "0 1px 0 hsl(var(--neu-orange-hi) / 0.12), 0 8px 28px rgba(0,0,0,0.55)",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-white/55 hover:text-white transition-colors"
            data-testid="button-back-to-lobby"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Lobby</span>
          </button>

          <div className="w-px h-5" style={{ background: "rgba(255,255,255,0.08)" }} />

          <div className="flex items-center gap-2.5">
            <div className="neu-icon-plate" style={{ width: 36, height: 36, borderRadius: 10 }}>
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-[15px] font-extrabold leading-tight tracking-tight" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.55)" }}>
                Book a <span style={{
                  background: "linear-gradient(135deg, hsl(var(--neu-orange-hi)) 0%, #c4b5fd 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>Teacher</span>
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight tracking-widest uppercase opacity-70 font-semibold">
                Expert Instructors & Speakers
              </p>
            </div>
          </div>

          <div className="flex-1" />

          {!user && (
            <a
              href="/api/login"
              className="neu-book-button"
              data-testid="button-sign-in-teachers"
            >
              <LogIn className="w-4 h-4" />
              Sign In to Book
            </a>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 space-y-5 relative z-[1]">

          {user && (
            <button
              onClick={() => navigate("/payment-methods")}
              className="neu-saved-card w-full"
              style={{ padding: "10px 14px" }}
              data-testid="button-manage-payment-methods"
            >
              <div className="neu-icon-plate" style={{ width: 36, height: 36, borderRadius: 10 }}>
                <CreditCard className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-[13px] font-bold text-white/85">Payment Methods</div>
                <div className="text-[11px] text-white/45 font-medium">Manage your saved cards</div>
              </div>
              <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: "hsl(var(--neu-orange-hi))" }}>
                Manage →
              </span>
            </button>
          )}

          {user && myBookings.length > 0 && (
            <div className="neu-section-panel overflow-hidden">
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

          <div className="neu-section-panel p-5">
            <div className="flex items-start gap-4">
              <div className="neu-icon-plate">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-extrabold text-[16px] text-white tracking-tight" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.55)" }}>
                  Expert-Led Sessions
                </h2>
                <p className="text-[12px] text-white/55 mt-0.5 max-w-md leading-relaxed">
                  Connect with verified teachers and native speakers for personalized language lessons, pronunciation coaching, and exam preparation.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                { icon: <Users className="w-3.5 h-3.5" />, label: `${allTeachers.length} Teachers` },
                { icon: <Globe className="w-3.5 h-3.5" />, label: `${[...new Set(allTeachers.flatMap((t) => t.languages))].length} Languages` },
                { icon: <Award className="w-3.5 h-3.5" />, label: "Verified Experts" },
                { icon: <Mic className="w-3.5 h-3.5" />, label: "Live Sessions" },
              ].map(({ icon, label }) => (
                <div key={label} className="neu-stat-pill">
                  {icon}
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Advanced Search & Filter Bar ─────────────────────────── */}
          <div className="neu-section-panel p-4 space-y-3">
            {/* Search row */}
            <div className="flex gap-2.5">
              <div className="neu-input-well flex-1">
                <Search className="w-4 h-4 text-white/35 flex-shrink-0" />
                <input
                  placeholder="Search by name, language, specialization or keywords…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-teachers"
                />
                {searchQuery && (
                  <button
                    className="text-white/40 hover:text-white/80 transition-colors flex-shrink-0"
                    onClick={() => setSearchQuery("")}
                    data-testid="button-clear-search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger
                  className="w-44 h-[42px] text-sm shrink-0 border-0"
                  style={{
                    background: "linear-gradient(155deg, hsl(228 18% 10%) 0%, hsl(228 16% 13%) 100%)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    boxShadow: "inset 3px 3px 7px rgba(0,0,0,0.55), inset -2px -2px 5px rgba(255,255,255,0.025)",
                    borderRadius: 12,
                    color: "rgba(255,255,255,0.85)",
                  }}
                  data-testid="select-sort-teachers"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-violet-400/70 flex-shrink-0" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top-rated">⭐ Top Rated</SelectItem>
                  <SelectItem value="most-reviewed">💬 Most Reviews</SelectItem>
                  <SelectItem value="price-asc">💰 Price: Low → High</SelectItem>
                  <SelectItem value="price-desc">💎 Price: High → Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quick filter chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: "top-rated", label: "Top Rated", icon: <Trophy className="w-3.5 h-3.5" /> },
                { id: "featured", label: "Featured", icon: <Sparkles className="w-3.5 h-3.5" /> },
                { id: "most-reviewed", label: "Popular", icon: <Flame className="w-3.5 h-3.5" /> },
                { id: "available", label: "Available Now", icon: <CircleCheckBig className="w-3.5 h-3.5" /> },
                { id: "budget", label: "Budget ≤$25", icon: <BadgeDollarSign className="w-3.5 h-3.5" /> },
              ].map(({ id, label, icon }) => {
                const active = quickFilter === id;
                return (
                  <button
                    key={id}
                    onClick={() => setQuickFilter(active ? null : id)}
                    className={`neu-time-chip flex items-center gap-1.5 ${active ? "is-active" : ""}`}
                    style={{ borderRadius: 999, padding: "6px 12px" }}
                    data-testid={`chip-quick-${id}`}
                  >
                    {icon}{label}
                    {active && <X className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>

            {/* Dropdown filters row */}
            <div className="flex flex-wrap gap-2">
              {[
                { value: selectedLanguage, onChange: setSelectedLanguage, options: languages, placeholder: "Language", icon: <Globe className="w-3.5 h-3.5 mr-1.5 text-violet-400/70 flex-shrink-0" />, defaultVal: "All", testId: "select-filter-language", w: "w-36" },
                { value: selectedLevel, onChange: setSelectedLevel, options: levels, placeholder: "Level", icon: <GraduationCap className="w-3.5 h-3.5 mr-1.5 text-violet-400/70 flex-shrink-0" />, defaultVal: "All", testId: "select-filter-level", w: "w-36" },
                { value: selectedSpec, onChange: setSelectedSpec, options: specs, placeholder: "Specialization", icon: <BookOpen className="w-3.5 h-3.5 mr-1.5 text-violet-400/70 flex-shrink-0" />, defaultVal: "All", testId: "select-filter-spec", w: "w-44" },
              ].map((s) => {
                const active = s.value !== s.defaultVal;
                return (
                  <Select key={s.testId} value={s.value} onValueChange={s.onChange}>
                    <SelectTrigger
                      className={`${s.w} h-9 text-xs border-0`}
                      style={{
                        background: "linear-gradient(155deg, hsl(228 18% 10%) 0%, hsl(228 16% 13%) 100%)",
                        border: active ? "1px solid hsl(var(--neu-orange-hi) / 0.5)" : "1px solid rgba(255,255,255,0.04)",
                        boxShadow: active
                          ? "inset 3px 3px 7px rgba(0,0,0,0.55), inset -2px -2px 5px rgba(255,255,255,0.025), 0 0 12px hsl(var(--neu-orange) / 0.25)"
                          : "inset 3px 3px 7px rgba(0,0,0,0.55), inset -2px -2px 5px rgba(255,255,255,0.025)",
                        borderRadius: 10,
                        color: active ? "hsl(var(--neu-orange-hi))" : "rgba(255,255,255,0.65)",
                        fontWeight: 600,
                      }}
                      data-testid={s.testId}
                    >
                      {s.icon}
                      <SelectValue placeholder={s.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {s.options.map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                );
              })}

              <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger
                  className="w-36 h-9 text-xs border-0"
                  style={{
                    background: "linear-gradient(155deg, hsl(228 18% 10%) 0%, hsl(228 16% 13%) 100%)",
                    border: priceRange !== "all" ? "1px solid hsl(var(--neu-orange-hi) / 0.5)" : "1px solid rgba(255,255,255,0.04)",
                    boxShadow: priceRange !== "all"
                      ? "inset 3px 3px 7px rgba(0,0,0,0.55), inset -2px -2px 5px rgba(255,255,255,0.025), 0 0 12px hsl(var(--neu-orange) / 0.25)"
                      : "inset 3px 3px 7px rgba(0,0,0,0.55), inset -2px -2px 5px rgba(255,255,255,0.025)",
                    borderRadius: 10,
                    color: priceRange !== "all" ? "hsl(var(--neu-orange-hi))" : "rgba(255,255,255,0.65)",
                    fontWeight: 600,
                  }}
                  data-testid="select-filter-price"
                >
                  <DollarSign className="w-3.5 h-3.5 mr-1.5 text-violet-400/70 flex-shrink-0" />
                  <SelectValue placeholder="Price range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any price</SelectItem>
                  <SelectItem value="budget">Budget (≤$20/hr)</SelectItem>
                  <SelectItem value="mid">Mid ($21–$35/hr)</SelectItem>
                  <SelectItem value="premium">Premium ($35+/hr)</SelectItem>
                </SelectContent>
              </Select>

              {/* Clear all filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedLanguage("All");
                    setSelectedLevel("All");
                    setSelectedSpec("All");
                    setPriceRange("all");
                    setQuickFilter(null);
                  }}
                  className="flex items-center gap-1.5 px-3 h-9 text-xs text-red-400/85 hover:text-red-400 transition-all font-bold"
                  style={{
                    background: "linear-gradient(150deg, hsl(228 14% 17%) 0%, hsl(228 14% 13%) 100%)",
                    border: "1px solid rgba(239,68,68,0.28)",
                    borderRadius: 10,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 1px 2px 4px rgba(0,0,0,0.4)",
                  }}
                  data-testid="button-clear-filters"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear ({activeFilterCount})
                </button>
              )}
            </div>

            {/* Results summary */}
            <div className="flex items-center justify-between pt-0.5">
              <p className="text-[11px] text-white/35" data-testid="text-results-count">
                {filteredTeachers.length === allTeachers.length
                  ? `${allTeachers.length} teacher${allTeachers.length !== 1 ? "s" : ""} available`
                  : `${filteredTeachers.length} of ${allTeachers.length} teachers match`}
                {showingSampleTeachers ? " in preview" : ""}
              </p>
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-white/35">
                  <SlidersHorizontal className="w-3 h-3" />
                  {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
                </div>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 min-[760px]:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 min-[760px]:grid-cols-3 gap-4">
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

      {/* ── Apply to Become a Teacher CTA ─────────────────────────── */}
      {user && (
        <div className="px-4 pb-8 mt-6">
          <div
            className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{
              background: "linear-gradient(135deg, rgba(110,60,255,0.10) 0%, rgba(0,200,255,0.07) 100%)",
              border: "1px solid rgba(110,60,255,0.2)",
              boxShadow: "0 0 32px rgba(110,60,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(110,60,255,0.3) 0%, rgba(0,200,255,0.2) 100%)",
                  border: "1px solid rgba(110,60,255,0.35)",
                  boxShadow: "0 0 14px rgba(110,60,255,0.2)",
                }}
              >
                <GraduationCap className="w-5 h-5 text-violet-300" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-[15px]">Become a Teacher</h3>
                <p className="text-[13px] text-white/50 mt-0.5 max-w-xs">
                  Share your language skills and earn. Apply to join our teaching team.
                </p>
                {myApplication && (
                  <div className="mt-2 flex items-center gap-2">
                    {myApplication.status === "pending" && (
                      <span className="text-[12px] text-amber-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />Application under review
                      </span>
                    )}
                    {myApplication.status === "approved" && (
                      <span className="text-[12px] text-green-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />Application approved — you're a teacher!
                      </span>
                    )}
                    {myApplication.status === "rejected" && (
                      <span className="text-[12px] text-red-400 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" />Application not approved
                        {myApplication.adminNotes && <span className="text-white/40">· {myApplication.adminNotes}</span>}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {(!myApplication || myApplication.status === "rejected") && (
              <Button
                className="shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(110,60,255,0.5) 0%, rgba(0,200,255,0.35) 100%)",
                  border: "1px solid rgba(110,60,255,0.4)",
                  color: "white",
                  boxShadow: "0 0 16px rgba(110,60,255,0.25)",
                }}
                onClick={() => setApplyOpen(true)}
                data-testid="button-apply-to-teach"
              >
                <SendHorizonal className="w-4 h-4 mr-2" />
                Apply Now
              </Button>
            )}
          </div>
        </div>
      )}

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

      {/* ── Apply to Teach Dialog ─────────────────────────────────── */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: "rgba(14,14,28,0.98)", border: "1px solid rgba(110,60,255,0.25)" }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <GraduationCap className="w-5 h-5 text-violet-400" />
              Apply to Become a Teacher
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="apply-name">Full Name</Label>
              <Input
                id="apply-name"
                value={applyForm.name}
                onChange={(e) => setApplyForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your name as it'll appear to students"
                data-testid="input-apply-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apply-bio">Bio / Teaching Profile</Label>
              <Textarea
                id="apply-bio"
                value={applyForm.bio}
                onChange={(e) => setApplyForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Tell us about yourself and your teaching approach..."
                rows={3}
                data-testid="input-apply-bio"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Languages You Teach</Label>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.filter((l) => l !== "All").map((lang) => {
                  const sel = applyForm.languages.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setApplyForm((f) => ({
                        ...f,
                        languages: sel ? f.languages.filter((x) => x !== lang) : [...f.languages, lang],
                      }))}
                      className={`text-[12px] px-2.5 py-1 rounded-full border transition-all ${sel ? "bg-primary/20 text-primary border-primary/40" : "bg-white/5 text-white/50 border-white/10 hover:border-white/20"}`}
                      data-testid={`chip-lang-${lang}`}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Student Levels</Label>
              <div className="flex flex-wrap gap-1.5">
                {LEVELS.map((level) => {
                  const sel = applyForm.levels.includes(level);
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setApplyForm((f) => ({
                        ...f,
                        levels: sel ? f.levels.filter((x) => x !== level) : [...f.levels, level],
                      }))}
                      className={`text-[12px] px-2.5 py-1 rounded-full border transition-all ${sel ? "bg-violet-500/20 text-violet-300 border-violet-500/40" : "bg-white/5 text-white/50 border-white/10 hover:border-white/20"}`}
                      data-testid={`chip-level-${level}`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Specializations</Label>
              <div className="flex flex-wrap gap-1.5">
                {SPECIALIZATIONS.map((spec) => {
                  const sel = applyForm.specializations.includes(spec);
                  return (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => setApplyForm((f) => ({
                        ...f,
                        specializations: sel ? f.specializations.filter((x) => x !== spec) : [...f.specializations, spec],
                      }))}
                      className={`text-[12px] px-2.5 py-1 rounded-full border transition-all ${sel ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : "bg-white/5 text-white/50 border-white/10 hover:border-white/20"}`}
                      data-testid={`chip-spec-${spec}`}
                    >
                      {spec}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="apply-rate">Suggested Hourly Rate (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="apply-rate"
                    type="number"
                    min={1}
                    className="pl-9"
                    value={applyForm.suggestedRate}
                    onChange={(e) => setApplyForm((f) => ({ ...f, suggestedRate: e.target.value }))}
                    placeholder="e.g. 25"
                    data-testid="input-apply-rate"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-paypal">PayPal Email</Label>
                <Input
                  id="apply-paypal"
                  type="email"
                  value={applyForm.paypalEmail}
                  onChange={(e) => setApplyForm((f) => ({ ...f, paypalEmail: e.target.value }))}
                  placeholder="your@paypal.com"
                  data-testid="input-apply-paypal"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apply-experience">Teaching Experience (optional)</Label>
              <Textarea
                id="apply-experience"
                value={applyForm.experience}
                onChange={(e) => setApplyForm((f) => ({ ...f, experience: e.target.value }))}
                placeholder="Certifications, past teaching roles, years of experience..."
                rows={2}
                data-testid="input-apply-experience"
              />
            </div>

            <div className="pt-1 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
              <Button
                style={{
                  background: "linear-gradient(135deg, rgba(110,60,255,0.5) 0%, rgba(0,200,255,0.35) 100%)",
                  border: "1px solid rgba(110,60,255,0.4)",
                  color: "white",
                }}
                onClick={() => applyMutation.mutate(applyForm)}
                disabled={applyMutation.isPending || !applyForm.name || !applyForm.bio || !applyForm.paypalEmail}
                data-testid="button-submit-application"
              >
                {applyMutation.isPending ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
}
