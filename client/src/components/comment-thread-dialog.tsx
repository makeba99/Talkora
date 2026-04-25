import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Trash2, X, Loader2 } from "lucide-react";
import type { User } from "@shared/schema";

type CommentRow = {
  id: string;
  targetUserId: string;
  authorId: string;
  text: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
};

type SampleComment = {
  id: string;
  authorName: string;
  authorAvatar: string | null;
  text: string;
  createdAt: string;
};

const SAMPLE_COMMENTS: Record<string, SampleComment[]> = {
  "sample-user-1": [
    { id: "sc-1-1", authorName: "Marcus Williams", authorAvatar: null, text: "Sofia is such an encouraging speaker! Really helped me with my pronunciation.", createdAt: "2026-04-13T10:22:00Z" },
    { id: "sc-1-2", authorName: "Liam Chen", authorAvatar: null, text: "One of the best English conversation partners I've had 🙌", createdAt: "2026-04-12T08:45:00Z" },
    { id: "sc-1-3", authorName: "Emma Davis", authorAvatar: null, text: "Always patient, always helpful. Highly recommend her rooms!", createdAt: "2026-04-11T19:10:00Z" },
  ],
  "sample-user-2": [
    { id: "sc-2-1", authorName: "Nadia Hassan", authorAvatar: null, text: "Liam explains things really clearly. Great for English practice.", createdAt: "2026-04-13T14:05:00Z" },
    { id: "sc-2-2", authorName: "Kevin Park", authorAvatar: null, text: "Had a great conversation session with Liam. Very knowledgeable!", createdAt: "2026-04-12T11:30:00Z" },
  ],
  "sample-user-3": [
    { id: "sc-3-1", authorName: "Pierre Dupont", authorAvatar: null, text: "Emma's French tips are gold! She really knows the nuances.", createdAt: "2026-04-14T09:20:00Z" },
    { id: "sc-3-2", authorName: "Aigerim Bekova", authorAvatar: null, text: "Love Emma's energy in conversation rooms. So much fun!", createdAt: "2026-04-13T16:45:00Z" },
    { id: "sc-3-3", authorName: "James O'Brien", authorAvatar: null, text: "She made me feel comfortable speaking French for the first time!", createdAt: "2026-04-11T12:00:00Z" },
  ],
  "sample-user-4": [
    { id: "sc-4-1", authorName: "Sofia Martinez", authorAvatar: null, text: "Carlos is a native Spanish speaker and he's super patient 🔥", createdAt: "2026-04-12T20:15:00Z" },
  ],
  "sample-user-5": [
    { id: "sc-5-1", authorName: "Marcus Williams", authorAvatar: null, text: "Aigerim is trilingual! Her Korean is incredible.", createdAt: "2026-04-14T07:30:00Z" },
    { id: "sc-5-2", authorName: "Min Ji-hoon", authorAvatar: null, text: "She helped me understand Korean honorifics much better 🙏", createdAt: "2026-04-13T13:20:00Z" },
    { id: "sc-5-3", authorName: "Yuki Tanaka", authorAvatar: null, text: "Best language buddy on the platform. Period.", createdAt: "2026-04-12T17:55:00Z" },
  ],
  "sample-user-6": [
    { id: "sc-6-1", authorName: "Emma Davis", authorAvatar: null, text: "Marcus is on another level. His vocabulary is insane!", createdAt: "2026-04-14T11:10:00Z" },
    { id: "sc-6-2", authorName: "Anya Petrova", authorAvatar: null, text: "He runs the best Advanced English rooms. Always packed!", createdAt: "2026-04-13T08:40:00Z" },
  ],
  "sample-user-7": [
    { id: "sc-7-1", authorName: "Nadia Hassan", authorAvatar: null, text: "Anya gave me great tips on British vs American English differences.", createdAt: "2026-04-11T15:00:00Z" },
  ],
  "sample-user-8": [
    { id: "sc-8-1", authorName: "Lucas Santos", authorAvatar: null, text: "James is so funny in his rooms, makes learning a pleasure!", createdAt: "2026-04-13T21:00:00Z" },
    { id: "sc-8-2", authorName: "Claire Bernard", authorAvatar: null, text: "Really helpful with Irish slang and expressions 😄", createdAt: "2026-04-12T10:15:00Z" },
  ],
  "sample-user-9": [
    { id: "sc-9-1", authorName: "Hassan Al-Amin", authorAvatar: null, text: "Nadia is brilliant at English-Arabic code switching. Rare skill!", createdAt: "2026-04-14T06:50:00Z" },
  ],
  "sample-user-10": [
    { id: "sc-10-1", authorName: "Seo Yeon", authorAvatar: null, text: "Kevin gets the K-pop references right away. Fun room!", createdAt: "2026-04-13T18:25:00Z" },
    { id: "sc-10-2", authorName: "Hana Suzuki", authorAvatar: null, text: "His Korean enthusiasm is contagious 😊", createdAt: "2026-04-12T14:00:00Z" },
  ],
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface CommentThreadDialogProps {
  targetUser: User & { firstName?: string | null; lastName?: string | null; displayName?: string | null };
  targetUserName: string;
  onClose: () => void;
}

export function CommentThreadDialog({ targetUser, targetUserName, onClose }: CommentThreadDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isSample = targetUser.id.startsWith("sample-user-");

  const { data: realComments = [], isLoading } = useQuery<CommentRow[]>({
    queryKey: ["/api/users", targetUser.id, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${targetUser.id}/comments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !isSample,
    refetchInterval: 10000,
  });

  const sampleComments = isSample ? (SAMPLE_COMMENTS[targetUser.id] || []) : [];

  const allComments: (CommentRow | SampleComment)[] = isSample
    ? sampleComments
    : realComments;

  const postMutation = useMutation({
    mutationFn: async (txt: string) => {
      const res = await apiRequest("POST", `/api/users/${targetUser.id}/comments`, { text: txt });
      return res.json();
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["/api/users", targetUser.id, "comments"] });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (err: any) => {
      toast({ title: "Failed to post comment", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiRequest("DELETE", `/api/users/${targetUser.id}/comments/${commentId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", targetUser.id, "comments"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (!user) {
      toast({ title: "Sign in to comment", description: "Create an account to leave comments." });
      return;
    }
    if (isSample) {
      toast({ title: "This is a demo user", description: "Sign in and connect with real language learners to comment!" });
      return;
    }
    postMutation.mutate(text.trim());
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allComments.length]);

  const getName = (c: CommentRow | SampleComment) => (c as CommentRow).authorName || "User";
  const getAvatar = (c: CommentRow | SampleComment) => (c as any).authorAvatar || null;
  const getInitials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const isOwn = (c: CommentRow | SampleComment) => !isSample && user && (c as CommentRow).authorId === user.id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(160deg, rgba(8,15,42,0.98) 0%, rgba(5,10,32,0.96) 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 0 60px rgba(0,210,255,0.14), 0 20px 60px rgba(0,0,0,0.6)",
          maxHeight: "85vh",
        }}
        data-testid="dialog-comment-thread"
      >
        {/* Top accent */}
        <div className="h-1 w-full flex-shrink-0" style={{ background: "linear-gradient(90deg, #22d3ee, #818cf8, #e879f9)" }} />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <div>
              <p className="text-xs text-white/50 leading-none">Comments on</p>
              <h3 className="text-sm font-extrabold text-white leading-tight">{targetUserName}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            data-testid="button-close-comment-thread"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
            </div>
          ) : allComments.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/40">No comments yet</p>
              <p className="text-xs text-white/25 mt-1">Be the first to leave one!</p>
            </div>
          ) : (
            allComments.map((c) => {
              const name = getName(c);
              const avatar = getAvatar(c);
              const own = isOwn(c);
              return (
                <div key={c.id} className="flex gap-2.5 group" data-testid={`comment-${c.id}`}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-cyan-400/30 to-violet-400/30 flex items-center justify-center text-xs font-bold text-white border border-white/10">
                    {avatar ? (
                      <img src={avatar} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(name)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-white/85">{name}</span>
                      <span className="text-[10px] text-white/30">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-white/75 leading-relaxed break-words">{c.text}</p>
                  </div>
                  {own && (
                    <button
                      onClick={() => deleteMutation.mutate(c.id)}
                      disabled={deleteMutation.isPending}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      data-testid={`button-delete-comment-${c.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-4 py-3 border-t border-white/10 flex-shrink-0"
        >
          {user?.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-white/15" />
          ) : (
            <div className="w-7 h-7 rounded-full flex-shrink-0 border border-white/15 bg-gradient-to-br from-cyan-400/20 to-violet-400/20 flex items-center justify-center text-[10px] font-bold text-white/70">
              {user ? getInitials(`${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "U") : "?"}
            </div>
          )}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={user ? (isSample ? "This is a demo user…" : "Write a comment…") : "Sign in to comment…"}
            disabled={postMutation.isPending || isSample}
            maxLength={500}
            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/40 focus:bg-white/8 transition-colors disabled:opacity-50"
            data-testid="input-comment-text"
          />
          <button
            type="submit"
            disabled={!text.trim() || postMutation.isPending || isSample}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-cyan-400/15 border border-cyan-400/25 text-cyan-300 hover:bg-cyan-400/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            data-testid="button-submit-comment"
          >
            {postMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
