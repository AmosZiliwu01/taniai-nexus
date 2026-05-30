// src/routes/_authenticated/community.tsx
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getWeatherSummary, useWeather } from "@/hooks/useWeather";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useLocation, useSearch } from "@tanstack/react-router";
import { formatDistanceToNow, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Bold,
  ChevronDown, ChevronUp,
  Edit,
  Flag,
  Heart,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Reply,
  Search,
  Send,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/community")({
  head: () => ({ meta: [{ title: "Komunitas Petani — TaniAI Nexus" }] }),
  component: Community,
});

const CATEGORIES = ["Semua", "Diskusi", "Pertanyaan", "Tips", "Berita"];

interface Post {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  is_flagged: boolean;
  created_at: string;
  author?: { full_name: string | null; avatar_url: string | null };
  liked_by_me?: boolean;
}

interface RawComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  author?: { full_name: string | null; avatar_url: string | null };
}

interface Comment extends RawComment {
  replies: Comment[];
  root_parent_id: string | null;
}

function stripHtml(html: string): string {
  if (!html) return "";
  let text = html.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]*>/g, "");
  return text.trim();
}

function RichContent({ html, className, lineClamp }: { html: string; className?: string; lineClamp?: number }) {
  const isHtml = /<[a-z][\s\S]*>/i.test(html);
  if (!isHtml) return <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", className)}>{html}</p>;
  return (
    <div
      className={cn("text-sm leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_a]:text-primary [&_a]:underline", className)}
      style={lineClamp ? {
        display: "-webkit-box",
        WebkitLineClamp: lineClamp,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      } : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function Avatar({ name, url, size = "sm" }: { name: string; url?: string | null; size?: "sm" | "md" }) {
  const sz = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  const initials = (name || "?").slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} className={cn("rounded-full object-cover shrink-0", sz)} />;
  return (
    <div className={cn("rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center font-bold text-white shrink-0", sz)}>
      {initials}
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    Diskusi: "bg-blue-100 text-blue-700 border-blue-200",
    Pertanyaan: "bg-amber-100 text-amber-700 border-amber-200",
    Tips: "bg-green-100 text-green-700 border-green-200",
    Berita: "bg-purple-100 text-purple-700 border-purple-200",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold border", colors[category] ?? "bg-muted text-muted-foreground border-border")}>
      {category}
    </span>
  );
}

// RichEditor with id for focusing
function RichEditor({ value, onChange, placeholder, rows = 4, editorId = "post-editor" }: {
  value: string; onChange: (html: string) => void; placeholder: string; rows?: number; editorId?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value === "" && el.innerHTML !== "") el.innerHTML = "";
    else if (value !== el.innerHTML) el.innerHTML = value;
  }, [value]);
  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };
  return (
    <div className="rounded-xl border border-input overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
      <div className="flex items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1.5">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Italic className="h-3.5 w-3.5" /></button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><List className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); const u = prompt("URL:"); if (u) exec("createLink", u); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Link2 className="h-3.5 w-3.5" /></button>
      </div>
      <div className="relative">
        <div
          id={editorId}
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
          className="px-3 py-2.5 text-sm outline-none bg-background prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_a]:text-primary [&_a]:underline"
          style={{ minHeight: `${rows * 1.6}rem` }}
        />
        {(!value || value === "<br>" || value === "") && (
          <div className="pointer-events-none absolute left-3 top-2.5 text-sm text-muted-foreground/50 select-none">{placeholder}</div>
        )}
      </div>
    </div>
  );
}

function CommentText({ content }: { content: string }) {
  const parts = content.split(/(@\S+)/g);
  return (
    <span className="text-sm leading-relaxed break-words">
      {parts.map((part, i) =>
        part.startsWith("@") ? <span key={i} className="text-primary font-semibold">{part}</span> : <span key={i}>{part}</span>
      )}
    </span>
  );
}

interface CommentInputProps {
  postId: string;
  replyTarget: { commentId: string; name: string; rootParentId: string | null } | null;
  onClearReply: () => void;
  onSubmitted: () => void;
  currentUser: { id: string; name: string; avatar_url: string | null } | null;
}

function CommentInput({ postId, replyTarget, onClearReply, onSubmitted, currentUser }: CommentInputProps) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (replyTarget) setTimeout(() => inputRef.current?.focus(), 60); }, [replyTarget]);
  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed || loading) return;
    const finalContent = replyTarget ? `@${replyTarget.name} ${trimmed}` : trimmed;
    const parentId = replyTarget ? (replyTarget.rootParentId ?? replyTarget.commentId) : null;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login dahulu");
      const { error } = await supabase.from("community_comments").insert({
        post_id: postId, user_id: user.id, content: finalContent, parent_id: parentId,
      });
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["post-comments", postId] }),
        qc.invalidateQueries({ queryKey: ["community-posts"] }),
      ]);
      setBody(""); onClearReply(); onSubmitted();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <div className="space-y-1.5 pt-2">
      {replyTarget && (
        <div className="flex items-center gap-1.5 px-1">
          <Reply className="h-3 w-3 text-primary shrink-0" />
          <span className="text-xs text-primary">Membalas <strong>@{replyTarget.name}</strong></span>
          <button onClick={() => { onClearReply(); setBody(""); }} className="ml-auto rounded-md p-0.5 hover:bg-muted"><X className="h-3 w-3 text-muted-foreground" /></button>
        </div>
      )}
      <div className="flex items-center gap-2">
        {currentUser && <Avatar name={currentUser.name} url={currentUser.avatar_url} size="sm" />}
        <div className="flex-1 flex items-center gap-2 rounded-full border border-input bg-background px-3 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          {replyTarget && <span className="text-sm text-primary font-medium">@{replyTarget.name}</span>}
          <input ref={inputRef} value={body} onChange={(e) => setBody(e.target.value)} placeholder={replyTarget ? "tulis balasan..." : "Tulis komentar..."} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 min-w-0" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !body.trim()}
          className="h-8 w-8 rounded-full bg-primary text-white disabled:opacity-40 hover:bg-primary/90 flex items-center justify-center shrink-0"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  postId: string;
  currentUserId: string;
  onReply: (target: { commentId: string; name: string; rootParentId: string | null }) => void;
  depth?: number;
  isExpanded: boolean;
  onToggleExpand: (commentId: string) => void;
}

function CommentItem({ comment, postId, currentUserId, onReply, depth = 0, isExpanded, onToggleExpand }: CommentItemProps) {
  const qc = useQueryClient();
  const isOwn = comment.user_id === currentUserId;
  const name = comment.author?.full_name?.trim() || "Petani";
  const hasReplies = comment.replies.length > 0;
  const deleteComment = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("community_comments").delete().eq("id", comment.id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-comments", postId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const handleReplyClick = () => {
    const rootParentId = depth === 0 ? comment.id : comment.root_parent_id ?? comment.id;
    onReply({ commentId: comment.id, name, rootParentId });
  };
  return (
    <div className={cn("flex gap-2", depth > 0 && "ml-8")}>
      <div className="flex flex-col items-center gap-0 shrink-0">
        <Avatar name={name} url={comment.author?.avatar_url} size="sm" />
        {hasReplies && isExpanded && depth === 0 && <div className="w-px flex-1 bg-border/60 mt-1 mb-0.5" />}
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <div className="rounded-2xl bg-muted/50 px-3 py-2 inline-block max-w-full">
          <p className="text-xs font-semibold leading-none mb-1">{name}</p>
          <CommentText content={comment.content} />
        </div>
        <div className="flex items-center gap-3 mt-1 px-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(parseISO(comment.created_at), { addSuffix: true, locale: idLocale })}</span>
          <button onClick={handleReplyClick} className="text-[10px] font-semibold text-muted-foreground hover:text-primary flex items-center gap-0.5"><Reply className="h-3 w-3" /> Balas</button>
          {isOwn && <button onClick={() => { if (confirm("Hapus komentar ini?")) deleteComment.mutate(); }} className="text-[10px] font-semibold text-muted-foreground hover:text-destructive">Hapus</button>}
          {hasReplies && depth === 0 && (
            <button onClick={() => onToggleExpand(comment.id)} className="ml-auto text-[10px] font-semibold text-primary flex items-center gap-0.5">
              {isExpanded ? <><ChevronUp className="h-3 w-3" /> Sembunyikan</> : <><ChevronDown className="h-3 w-3" /> {comment.replies.length} balasan</>}
            </button>
          )}
        </div>
        {hasReplies && isExpanded && (
          <div className="mt-2 space-y-2">
            {comment.replies.map(reply => (
              <CommentItem key={reply.id} comment={reply} postId={postId} currentUserId={currentUserId} onReply={onReply} depth={depth + 1} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// === CREATE POST FORM (with auto-expand & focus) ===
function CreatePostForm({
  defaultContent = "",
  defaultImageUrl = null,
  currentUser,
  onSuccess,
}: {
  defaultContent?: string;
  defaultImageUrl?: string | null;
  currentUser: { name: string; avatar_url: string | null } | null;
  onSuccess?: () => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [richContent, setRichContent] = useState("");
  const [category, setCategory] = useState("Diskusi");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(defaultImageUrl);
  const [expanded, setExpanded] = useState(!!defaultContent || !!defaultImageUrl);
  const [initialized, setInitialized] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Auto-expand when defaultContent or defaultImageUrl provided
  useEffect(() => {
    if (defaultContent || defaultImageUrl) {
      setExpanded(true);
    }
  }, [defaultContent, defaultImageUrl]);

  // Set initial content once
  useEffect(() => {
    if (defaultContent && !initialized) {
      setRichContent(defaultContent);
      setInitialized(true);
    }
  }, [defaultContent, initialized]);

  // Set image preview from default
  useEffect(() => {
    if (defaultImageUrl && !imagePreview) {
      setImagePreview(defaultImageUrl);
      setExpanded(true);
    }
  }, [defaultImageUrl]);

  // Focus on editor after expanded and content loaded
  useEffect(() => {
    if (expanded && defaultContent) {
      const editor = document.getElementById("post-editor");
      if (editor) {
        editor.focus();
        // Place cursor at the end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [expanded, defaultContent]);

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran gambar maksimal 5MB");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login dahulu");
      const finalContent = richContent.trim();
      const plain = stripHtml(richContent).trim();
      if (!plain) throw new Error("Konten tidak boleh kosong");
      
      let imageUrl: string | null = null;
      if (defaultImageUrl && !imageFile) {
        imageUrl = defaultImageUrl;
      } else if (imageFile) {
        setUploading(true);
        const ext = imageFile.name.split(".").pop();
        const path = `community/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("community").upload(path, imageFile, { upsert: true, cacheControl: "3600" });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from("community").getPublicUrl(path);
          imageUrl = publicUrl;
        } else {
          toast.error("Gagal mengupload gambar, coba lagi.");
          throw upErr;
        }
        setUploading(false);
      }

      const firstLine = plain.split("\n")[0].slice(0, 80) || "Postingan";
      const { error } = await supabase.from("community_posts").insert({
        user_id: user.id,
        title: firstLine,
        content: finalContent,
        category,
        image_url: imageUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-posts"] });
      setRichContent(""); setCategory("Diskusi");
      setImageFile(null); setImagePreview(null); setExpanded(false);
      toast.success("Postingan berhasil dipublikasikan!");
      onSuccess?.();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setUploading(false);
    },
  });

  const canPost = !!stripHtml(richContent).trim() && !uploading;

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left hover:border-primary/30 shadow-card transition-all">
        {currentUser ? <Avatar name={currentUser.name} url={currentUser.avatar_url} size="sm" /> : <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center"><Plus className="h-3.5 w-3.5 text-primary" /></div>}
        <span className="text-sm text-muted-foreground">Bagikan pengalaman atau tanyakan sesuatu...</span>
        <ImageIcon className="h-4 w-4 text-muted-foreground/50 ml-auto" />
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      {/* Header dengan user info dan category */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        {currentUser && <Avatar name={currentUser.name} url={currentUser.avatar_url} size="sm" />}
        <div className="flex-1">
          <p className="text-sm font-semibold">{currentUser?.name || "Anda"}</p>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {CATEGORIES.slice(1).map(c => (
              <button key={c} onClick={() => setCategory(c)} className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors", category === c ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>{c}</button>
            ))}
          </div>
        </div>
        <button onClick={() => setExpanded(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>

      {/* Layout 2 kolom: Kiri untuk gambar, Kanan untuk teks */}
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        {/* Kolom Kiri - Upload Gambar */}
        <div className="sm:w-44 md:w-52 lg:w-60 shrink-0">
          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full aspect-square object-cover rounded-xl"
              />
              <button
                onClick={removeImage}
                className="absolute -top-2 -right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full aspect-square rounded-xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ImageIcon className="h-8 w-8" />
              <span className="text-xs font-medium">Upload Foto</span>
              <span className="text-[10px] text-muted-foreground/60">Max 5MB</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
          />
        </div>

        {/* Kolom Kanan - Input Teks */}
        <div className="flex-1 min-w-0">
          <RichEditor
            value={richContent}
            onChange={setRichContent}
            placeholder="Apa yang ingin Anda bagikan kepada sesama petani?"
            rows={5}
            editorId="post-editor"
          />
          
          {/* Tombol Posting */}
          <div className="flex justify-end mt-3">
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !canPost}
              size="sm"
              className="gap-1.5 rounded-full px-5"
            >
              {mutation.isPending || uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Posting
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeatherWidget() {
  const { weather, location } = useWeather();
  if (!weather) return <Skeleton className="h-32 rounded-2xl" />;
  const summary = getWeatherSummary(weather);
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card p-4">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <span className="text-lg">🌤️</span> Cuaca Hari Ini
      </h3>
      <div className="space-y-2">
        <p className="font-medium text-sm">{location?.displayName || "Lokasi Anda"}</p>
        <p className="text-2xl font-bold">{weather.current.temp}°C</p>
        <p className="text-sm text-muted-foreground">{summary}</p>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>💧 {weather.current.humidity}%</span>
          <span>💨 {weather.current.wind_speed} km/j</span>
        </div>
      </div>
    </div>
  );
}

function TopDiscussionsWidget({ posts }: { posts: Post[] }) {
  const topPosts = useMemo(() => {
    return [...posts]
      .sort((a, b) => b.comments_count - a.comments_count)
      .slice(0, 5);
  }, [posts]);
  if (topPosts.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card p-4">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <span className="text-lg">📈</span> Top Diskusi Hari Ini
      </h3>
      <div className="space-y-3">
        {topPosts.map((post, idx) => (
          <div key={post.id} className="flex items-center gap-3 text-sm">
            <span className="text-xs font-bold text-primary w-5">{idx + 1}</span>
            <span className="flex-1 truncate">{post.title}</span>
            <span className="text-xs text-muted-foreground">{post.comments_count} komentar</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActiveUsersWidget() {
  const { data: activeUsers = [] } = useQuery({
    queryKey: ["community-active-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card p-4">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" /> Petani Aktif
      </h3>
      <div className="space-y-3">
        {activeUsers.map((u) => (
          <div key={u.id} className="flex items-center gap-3">
            <Avatar name={u.full_name ?? "?"} url={u.avatar_url} size="sm" />
            <span className="text-sm font-medium truncate">{u.full_name || "Petani"}</span>
          </div>
        ))}
        {activeUsers.length === 0 && <p className="text-xs text-muted-foreground">Belum ada data</p>}
      </div>
    </div>
  );
}

function PostCard({
  post,
  currentUserId,
  currentUser,
}: {
  post: Post;
  currentUserId: string;
  currentUser: { id: string; name: string; avatar_url: string | null } | null;
}) {
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ commentId: string; name: string; rootParentId: string | null } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const isOwn = post.user_id === currentUserId;
  const authorName = post.author?.full_name?.trim() || "Petani";
  const [reportReason, setReportReason] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const getLineCount = useCallback((html: string): number => {
    const plainText = stripHtml(html);
    const charsPerLine = isMobile ? 35 : 50;
    const estimatedLines = Math.ceil(plainText.length / charsPerLine);
    return estimatedLines;
  }, [isMobile]);

  const needsExpandButton = getLineCount(post.content) > 7;

  useEffect(() => {
    setIsTextExpanded(false);
  }, [post.id]);

  const { data: rawComments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["post-comments", post.id],
    queryFn: async () => { const { data } = await supabase.from("community_comments").select("*").eq("post_id", post.id).order("created_at", { ascending: true }); return data ?? []; },
    enabled: showComments,
  });
  const { data: commentAuthors = {} } = useQuery({
    queryKey: ["comment-authors", post.id, rawComments.map(c => c.user_id).join(",")],
    queryFn: async () => {
      const ids = [...new Set(rawComments.map(c => c.user_id))];
      if (!ids.length) return {};
      const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids);
      const map: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      (data ?? []).forEach(p => { map[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
      return map;
    },
    enabled: rawComments.length > 0,
  });
  const comments = useMemo((): Comment[] => {
    const withAuthors: RawComment[] = rawComments.map(c => ({ ...c, author: commentAuthors[c.user_id] ?? { full_name: null, avatar_url: null } }));
    const byId = new Map(withAuthors.map(c => [c.id, c]));
    const getRootParent = (c: RawComment): string | null => {
      if (!c.parent_id) return null;
      let cur = byId.get(c.parent_id);
      while (cur?.parent_id) cur = byId.get(cur.parent_id);
      return cur?.id ?? c.parent_id;
    };
    const topLevel = withAuthors.filter(c => !c.parent_id);
    const children = withAuthors.filter(c => c.parent_id);
    return topLevel.map(top => ({
      ...top,
      root_parent_id: null,
      replies: children.filter(c => c.parent_id === top.id || getRootParent(c) === top.id).sort((a,b) => a.created_at.localeCompare(b.created_at)).map(r => ({ ...r, root_parent_id: top.id, replies: [] })),
    }));
  }, [rawComments, commentAuthors]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login dahulu");
      if (post.liked_by_me) await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      else await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-posts"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const deletePost = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("community_posts").delete().eq("id", post.id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["community-posts"] }); toast.success("Postingan dihapus"); },
  });
  const reportPost = useMutation({
    mutationFn: async (reason: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !reason) throw new Error("Alasan diperlukan");
      await supabase.from("content_reports").insert({ reporter_id: user.id, post_id: post.id, reason });
    },
    onSuccess: () => { setShowReportModal(false); toast.success("Laporan terkirim"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/community?post=${post.id}`);
      toast.success("Link postingan disalin!");
    } catch (err) {
      toast.error("Gagal menyalin link");
    }
  };

  const handleReply = useCallback((target: { commentId: string; name: string; rootParentId: string | null }) => {
    setShowComments(true);
    setReplyTarget(target);
    setTimeout(() => document.getElementById(`comment-input-${post.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
  }, [post.id]);
  const toggleExpand = useCallback((commentId: string) => {
    setExpandedReplies(prev => { const newSet = new Set(prev); if (newSet.has(commentId)) newSet.delete(commentId); else newSet.add(commentId); return newSet; });
  }, []);
  const handleReplySuccess = useCallback((parentCommentId: string) => {
    setExpandedReplies(prev => { const newSet = new Set(prev); newSet.add(parentCommentId); return newSet; });
    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
  }, [post.id, qc]);

  return (
    <>
      <div className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all overflow-hidden">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={authorName} url={post.author?.avatar_url} size="md" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{authorName}</span>
                  <CategoryBadge category={post.category} />
                  {post.is_flagged && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-semibold text-destructive border border-destructive/10">Ditinjau</span>}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(parseISO(post.created_at), { addSuffix: true, locale: idLocale })}
                </p>
              </div>
            </div>
            
            {/* Three dots menu */}
            {isOwn && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="rounded-full p-1.5 hover:bg-muted transition-colors"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-8 z-20 min-w-[160px] rounded-xl border border-border bg-card shadow-elevated py-1 overflow-hidden">
                      <button
                        onClick={() => { setMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Edit className="h-3.5 w-3.5" /> Update postingan
                      </button>
                      <button
                        onClick={() => { if (confirm("Hapus postingan ini?")) deletePost.mutate(); setMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Hapus postingan
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {!isOwn && (
              <button
                onClick={() => setShowReportModal(true)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                title="Laporkan"
              >
                <Flag className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Area konten + gambar secara horizontal */}
          <div className="mt-3 flex gap-4">
            {/* Gambar - di samping kiri */}
            {post.image_url && (
              <div 
                className="shrink-0 w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 xl:w-72 xl:h-72 cursor-pointer"
                onClick={() => isMobile && setModalOpen(true)}
              >
                <img
                  src={post.image_url}
                  alt=""
                  className="w-full h-full object-cover hover:opacity-90 transition-opacity rounded-xl border border-border/100"
                />
              </div>
            )}

            {/* Konten teks */}
            <div className="flex-1 min-w-0">
              {!isMobile ? (
                <>
                  <RichContent 
                    html={post.content} 
                    className="text-foreground/85" 
                    lineClamp={isTextExpanded ? undefined : (needsExpandButton ? 12 : undefined)}
                  />
                  {needsExpandButton && (
                    <button
                      onClick={() => setIsTextExpanded(!isTextExpanded)}
                      className="mt-1 text-xs text-primary/70 hover:text-primary transition-colors font-medium"
                    >
                      {isTextExpanded ? "Sembunyikan" : "Lihat selengkapnya"}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <RichContent 
                    html={post.content} 
                    className="text-foreground/85" 
                    lineClamp={3}
                  />
                  <button
                    onClick={() => setModalOpen(true)}
                    className="mt-1 text-xs text-primary/70 hover:text-primary transition-colors font-medium"
                  >
                    Lihat selengkapnya
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center border-t border-border/60 px-3 py-1.5">
          <button onClick={() => likeMutation.mutate()} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors", post.liked_by_me ? "text-red-500 bg-red-50" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>
            <Heart className={cn("h-4 w-4", post.liked_by_me && "fill-red-500")} />
            {post.likes_count > 0 && <span className="tabular-nums">{post.likes_count}</span>}
            <span>Suka</span>
          </button>
          <div className="w-px h-5 bg-border/40" />
          <button onClick={() => { setShowComments(v => !v); if (showComments) setReplyTarget(null); }} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors", showComments ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>
            <MessageCircle className="h-4 w-4" />
            {post.comments_count > 0 && <span className="tabular-nums">{post.comments_count}</span>}
            <span>Komentar</span>
          </button>
          <div className="w-px h-5 bg-border/40" />
          <button onClick={handleShare} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <Share2 className="h-4 w-4" /> <span>Bagikan</span>
          </button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="border-t border-border/60 px-4 pt-3 pb-4 space-y-3 bg-muted/10">
            {commentsLoading ? (
              <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-2xl" />)}</div>
            ) : comments.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-2">Belum ada komentar. Jadilah yang pertama!</p>
            ) : (
              <div className="space-y-2">
                {comments.map(c => <CommentItem key={c.id} comment={c} postId={post.id} currentUserId={currentUserId} onReply={handleReply} depth={0} isExpanded={expandedReplies.has(c.id)} onToggleExpand={toggleExpand} />)}
              </div>
            )}
            <div id={`comment-input-${post.id}`}>
              <CommentInput
                postId={post.id}
                replyTarget={replyTarget}
                onClearReply={() => setReplyTarget(null)}
                onSubmitted={() => {
                  if (replyTarget) handleReplySuccess(replyTarget.commentId);
                  else qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
                  setReplyTarget(null);
                }}
                currentUser={currentUser}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modal detail - ONLY FOR MOBILE */}
      {isMobile && modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-auto rounded-2xl border border-border bg-card shadow-elevated thin-scroll">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
              <div className="flex items-center gap-3">
                <Avatar name={authorName} url={post.author?.avatar_url} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{authorName}</span>
                    <CategoryBadge category={post.category} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(parseISO(post.created_at), { addSuffix: true, locale: idLocale })}
                  </p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-full p-1.5 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <RichContent html={post.content} className="text-foreground" />
              {post.image_url && (
                <div className="overflow-hidden">
                  <img src={post.image_url} alt="" className="w-full object-cover max-h-[480px]" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowReportModal(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5">
            <h3 className="text-lg font-semibold mb-2">Laporkan Postingan</h3>
            <p className="text-sm text-muted-foreground mb-4">Alasan pelaporan akan kami tinjau.</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Alasan</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Pilih alasan...</option>
                  <option value="Spam">Spam / Iklan</option>
                  <option value="Informasi palsu">Informasi palsu / Hoaks</option>
                  <option value="Konten tidak pantas">Konten tidak pantas</option>
                  <option value="Pelecehan">Pelecehan</option>
                  <option value="Penipuan">Penipuan</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowReportModal(false)}>Batal</Button>
                <Button className="flex-1 bg-destructive hover:bg-destructive/90" onClick={() => reportPost.mutate(reportReason)} disabled={!reportReason}>Kirim Laporan</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .thin-scroll::-webkit-scrollbar { width: 4px; }
        .thin-scroll::-webkit-scrollbar-track { background: transparent; }
        .thin-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 20px; }
      `}</style>
    </>
  );
}

function Community() {
  const [category, setCategory] = useState("Semua");
  const [search, setSearch] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatar_url: string | null } | null>(null);
  const searchParams = useSearch({ from: "/_authenticated/community" as any });
  const location = useLocation();
  const state = location.state as any;
  const presetContent = state?.presetContent || "";
  const presetImageUrl = state?.presetImageUrl || null;
  const defaultContent = (searchParams as any)?.content ?? presetContent;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      const { data } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle();
      setCurrentUser({
        id: user.id,
        name: data?.full_name?.trim() || user.email?.split("@")[0] || "Anda",
        avatar_url: data?.avatar_url ?? null,
      });
    });
  }, []);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["community-posts", category, search],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let q = supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(30);
      if (category !== "Semua") q = q.eq("category", category);
      if (search) q = q.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
      const { data } = await q;
      const rawPosts = data ?? [];
      if (!rawPosts.length) return [];
      const userIds = [...new Set(rawPosts.map(p => p.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds);
      const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      (profiles ?? []).forEach(p => { profileMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
      let likedIds = new Set<string>();
      if (user) {
        const { data: likes } = await supabase.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", rawPosts.map(p => p.id));
        likedIds = new Set((likes ?? []).map(l => l.post_id));
      }
      return rawPosts.map(p => ({ ...p, author: profileMap[p.user_id] ?? { full_name: null, avatar_url: null }, liked_by_me: likedIds.has(p.id) }));
    },
    staleTime: 30 * 1000,
  });

  return (
    <div className="space-y-5 max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Komunitas Petani
          </h1>
          <p className="text-sm text-muted-foreground">Berbagi pengalaman & solusi bersama petani Indonesia</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari diskusi..."
            className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all sm:w-64"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn("shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all", category === c ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground")}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <CreatePostForm defaultContent={defaultContent} defaultImageUrl={presetImageUrl} currentUser={currentUser} />
          {isLoading ? (
            <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
              <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 font-semibold">Belum ada postingan</p>
              <p className="text-sm text-muted-foreground">{search ? "Coba kata kunci lain" : "Jadilah yang pertama berbagi!"}</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground px-1">{posts.length} diskusi ditemukan</p>
              <div className="space-y-5">
                {posts.map(post => <PostCard key={post.id} post={post as Post} currentUserId={currentUserId} currentUser={currentUser} />)}
              </div>
            </>
          )}
        </div>

        <div className="hidden lg:block space-y-5">
          <WeatherWidget />
          <TopDiscussionsWidget posts={posts as Post[]} />
          <ActiveUsersWidget />
        </div>
      </div>
    </div>
  );
}