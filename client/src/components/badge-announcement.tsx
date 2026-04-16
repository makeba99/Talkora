import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X } from "lucide-react";

interface BadgeDef {
  id: string;
  label: string;
  emoji: string;
  color: string;
  quote: string;
}

interface BadgeAwardedEvent {
  badge: { id: string; userId: string; badgeType: string; createdAt: string };
  badgeDef: BadgeDef;
  userName: string;
  userAvatar?: string | null;
  userId: string;
  quote: string;
}

interface BadgeAnnouncementProps {
  event: BadgeAwardedEvent | null;
  onDismiss: () => void;
}

export function BadgeAnnouncement({ event, onDismiss }: BadgeAnnouncementProps) {
  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [event, onDismiss]);

  const initials = event?.userName
    ? event.userName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.badge.id}
          initial={{ opacity: 0, y: -80, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -60, scale: 0.94 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[min(480px,90vw)]"
          data-testid="badge-announcement"
        >
          <div
            className="relative rounded-2xl overflow-hidden shadow-2xl border"
            style={{
              background: `linear-gradient(135deg, rgba(0,0,0,0.92) 0%, rgba(15,10,30,0.97) 100%)`,
              borderColor: `${event.badgeDef.color}40`,
              boxShadow: `0 0 40px ${event.badgeDef.color}30, 0 8px 32px rgba(0,0,0,0.5)`,
            }}
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                background: `radial-gradient(ellipse at 50% 0%, ${event.badgeDef.color} 0%, transparent 70%)`,
              }}
            />

            <div className="relative p-5">
              <button
                onClick={onDismiss}
                className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                data-testid="button-dismiss-badge"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="flex flex-col items-center text-center gap-3">
                <div
                  className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full"
                  style={{
                    color: event.badgeDef.color,
                    background: `${event.badgeDef.color}18`,
                    border: `1px solid ${event.badgeDef.color}35`,
                  }}
                >
                  🎉 Badge Awarded
                </div>

                <div className="relative">
                  <Avatar className="w-16 h-16 ring-4" style={{ ringColor: event.badgeDef.color }}>
                    <AvatarImage src={event.userAvatar ?? undefined} />
                    <AvatarFallback
                      className="text-lg font-bold"
                      style={{ background: `${event.badgeDef.color}25`, color: event.badgeDef.color }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], rotate: [0, 8, -8, 0] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-xl shadow-lg"
                    style={{ background: `${event.badgeDef.color}22`, border: `2px solid ${event.badgeDef.color}60` }}
                  >
                    {event.badgeDef.emoji}
                  </motion.div>
                </div>

                <div>
                  <p className="text-white font-bold text-lg leading-tight">{event.userName}</p>
                  <p className="text-sm mt-0.5" style={{ color: event.badgeDef.color }}>
                    has been awarded
                  </p>
                  <div
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold"
                    style={{
                      background: `${event.badgeDef.color}20`,
                      border: `1px solid ${event.badgeDef.color}50`,
                      color: event.badgeDef.color,
                    }}
                  >
                    <span>{event.badgeDef.emoji}</span>
                    <span>{event.badgeDef.label}</span>
                  </div>
                </div>

                <p className="text-white/60 text-sm leading-relaxed italic max-w-xs">
                  "{event.quote}"
                </p>
              </div>

              <motion.div
                className="absolute bottom-0 left-0 h-0.5 rounded-full"
                style={{ background: event.badgeDef.color }}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 8, ease: "linear" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
