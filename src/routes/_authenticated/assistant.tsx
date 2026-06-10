// src/routes/_authenticated/assistant.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { chatAI, parseMarkdown } from "@/lib/ai.functions";
import { usePlants } from "@/hooks/useUserPlants";
import { useWeather, getWeatherSummary } from "@/hooks/useWeather";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Bot, Send, Trash2, Plus, Loader2, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "AI Assistant — TaniAI Nexus" }] }),
  component: Assistant,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
});

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

type Msg = { role: "user" | "assistant"; content: string; id: string };

const SUGGESTIONS = [
  "Bagaimana cara mengatasi daun cabai menguning?",
  "Pupuk terbaik untuk padi fase generatif?",
  "Tanda-tanda tanaman kekurangan nitrogen?",
  "Cara mencegah serangan wereng coklat?",
  "Kapan waktu terbaik panen cabai?",
  "Dosis fungisida mancozeb yang tepat?",
];

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div
      className="prose prose-sm max-w-none text-sm leading-relaxed [&_strong]:font-bold [&_em]:italic [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_ul]:my-1 [&_li]:my-0.5"
      dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
    />
  );
}

function Assistant() {
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { q: prefilledQuery } = Route.useSearch();

  const { data: plants = [] } = usePlants();
  const { weather, location } = useWeather();

  const latestActivePlant =
    [...plants]
      .filter((p) => p.status === "Aktif")
      .sort((a, b) => new Date(b.plant_date).getTime() - new Date(a.plant_date).getTime())[0] ??
    null;

  const { data: latestDiagnosis = null } = useQuery({
    queryKey: ["assistant-latest-diagnosis"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("plant_diagnoses")
        .select("diagnosis, plant_type, severity")
        .eq("user_id", user.id)
        .in("severity", ["Ringan", "Sedang", "Berat"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data ?? null;
    },
    staleTime: 2 * 60 * 1000,
  });

  const [input, setInput] = useState(prefilledQuery ?? "");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [showConvList, setShowConvList] = useState(false);

  // Fetch status linking WhatsApp
  const messagesRef = useRef<Msg[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const skipNextSyncRef = useRef(false);
  useEffect(() => {
    if (prefilledQuery && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [prefilledQuery]);

  const { data: conversations = [] } = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) {
        console.error("[ai_conversations select]", error);
        return [];
      }
      return data ?? [];
    },
    staleTime: 10_000,
  });

  const { data: savedMessages } = useQuery({
    queryKey: ["ai-messages", activeChatId],
    queryFn: async () => {
      if (!activeChatId) return [];
      const { data, error } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", activeChatId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("[ai_messages select]", error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!activeChatId,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!savedMessages) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    setMessages(
      savedMessages.map((m) => ({
        id: m.id ?? generateId(),
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    );
  }, [savedMessages]);

  // Auto scroll to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const buildContext = useCallback(() => {
    const activePlants = plants
      .filter((p) => p.status === "Aktif")
      .map((p) => `${p.name} (${p.age_days} HST, tanah: ${p.soil_condition})`);
    return {
      userLocation: location?.displayName,
      weatherSummary: weather ? getWeatherSummary(weather) : undefined,
      userPlants: activePlants.length > 0 ? activePlants : undefined,
    };
  }, [plants, weather, location]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi. Silakan login ulang.");

      // Create conversation if none exists
      let chatId = activeChatId;
      if (!chatId) {
        const { data: conv, error: convErr } = await supabase
          .from("ai_conversations")
          .insert({ user_id: user.id, title: text.slice(0, 60) })
          .select()
          .single();
        if (convErr) {
          console.error("[ai_conversations insert]", convErr);
          throw new Error(`Gagal membuat percakapan: ${convErr.message}`);
        }
        chatId = conv?.id ?? null;
        setActiveChatId(chatId);
        qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      }

      if (!chatId) throw new Error("ID percakapan tidak valid");

      const userMsg: Msg = { id: generateId(), role: "user", content: text };
      skipNextSyncRef.current = true;
      setMessages((prev) => [...prev, userMsg]);

      const { error: userMsgErr } = await supabase
        .from("ai_messages")
        .insert({ conversation_id: chatId, role: "user", content: text });
      if (userMsgErr) console.error("[ai_messages insert user]", userMsgErr);

      const historyForAI = [...messagesRef.current, userMsg]
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const { content } = await chatAI({
        messages: historyForAI,
        context: buildContext(),
      });

      const assistantMsg: Msg = {
        id: generateId(),
        role: "assistant",
        content,
      };

      skipNextSyncRef.current = true;

      setMessages((prev) => [...prev, assistantMsg]);

      // Persist assistant message
      const { error: asstMsgErr } = await supabase
        .from("ai_messages")
        .insert({ conversation_id: chatId, role: "assistant", content });
      if (asstMsgErr) console.error("[ai_messages insert assistant]", asstMsgErr);

      return content;
    },
    onError: (e: Error) => {
      toast.error(e.message || "Gagal mengirim pesan");
      setMessages((prev) => {
        const idx = [...prev].reverse().findIndex((m) => m.role === "user");
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        return [...prev.slice(0, realIdx), ...prev.slice(realIdx + 1)];
      });
    },
  });

  const hasAutoSentRef = useRef(false);
  useEffect(() => {
    if (!prefilledQuery || hasAutoSentRef.current) return;
    hasAutoSentRef.current = true;
    const timer = setTimeout(() => {
      sendMutation.mutate(prefilledQuery);
      setInput("");
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Handle input change and auto-resize
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "24px";
    sendMutation.mutate(text);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input, sendMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
    setMessages([]);
    setInput("");
    setShowConvList(false);
    skipNextSyncRef.current = false;
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const openConversation = useCallback(
    (id: string) => {
      if (id === activeChatId) return;
      skipNextSyncRef.current = false;
      setActiveChatId(id);
      setMessages([]);
      setShowConvList(false);
    },
    [activeChatId],
  );

  const deleteConversation = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
      if (error) {
        console.error("[ai_conversations delete]", error);
        toast.error("Gagal menghapus percakapan");
        return;
      }
      if (activeChatId === id) startNewChat();
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      toast.success("Percakapan dihapus", { position: "top-right" });
    },
    [activeChatId, startNewChat, qc],
  );

  const isFirstMessage = messages.length === 0 && !sendMutation.isPending;

  // Auto scroll to bottom on new messages
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
      <div className="grid flex-1 min-h-0 overflow-hidden lg:grid-cols-[280px_1fr]">
        {/* ── Sidebar (desktop) ── */}
        <div className="hidden flex-col border-r border-border bg-card lg:flex min-h-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold text-sm">Riwayat Chat</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={startNewChat}
              className="h-7 gap-1 px-2 text-xs"
            >
              <Plus className="h-3 w-3" /> Baru
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Belum ada percakapan
              </div>
            ) : (
              conversations.map((conv) => (
                <div key={conv.id} className="group relative">
                  <button
                    onClick={() => openConversation(conv.id)}
                    className={cn(
                      "w-full rounded-xl px-3 py-2.5 text-left text-xs transition-colors",
                      activeChatId === conv.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <p className="truncate font-medium pr-6">{conv.title || "Percakapan baru"}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {format(new Date(conv.created_at), "d MMM yyyy", {
                        locale: idLocale,
                      })}
                    </p>
                  </button>
                  {/* Desktop: hover-reveal delete */}
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Chat area ── */}
        <div className="flex flex-col overflow-hidden min-h-0">
          {/* Mobile header */}
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">AI Assistant</p>
                <p className="text-[10px] text-muted-foreground">Asisten pertanian Indonesia</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 px-2 text-xs"
                onClick={startNewChat}
              >
                <Plus className="h-3.5 w-3.5" /> Baru
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 px-2 text-xs relative"
                onClick={() => setShowConvList((v) => !v)}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {conversations.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-white">
                    {conversations.length > 9 ? "9+" : conversations.length}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Mobile conversation list — always-visible delete button */}
          {showConvList && (
            <div className="border-b border-border bg-card max-h-52 overflow-y-auto lg:hidden">
              {conversations.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">Belum ada percakapan</p>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 transition-colors",
                      activeChatId === conv.id ? "bg-primary/10" : "hover:bg-muted/50",
                    )}
                  >
                    {/* Tap to open */}
                    <button
                      onClick={() => openConversation(conv.id)}
                      className="flex flex-1 items-center gap-2 text-left text-xs min-w-0"
                    >
                      <MessageCircle
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          activeChatId === conv.id ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span
                        className={cn(
                          "truncate",
                          activeChatId === conv.id && "text-primary font-medium",
                        )}
                      >
                        {conv.title || "Percakapan baru"}
                      </span>
                    </button>

                    {/* Always-visible delete on mobile */}
                    <button
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:bg-destructive/10 active:text-destructive transition-colors"
                      aria-label="Hapus percakapan"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* Context bar */}
            {(location || weather) && (
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {location && (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">
                    📍 {location.displayName}
                  </span>
                )}
                {weather && (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700">
                    🌤️ {weather.current.temp}°C · {weather.current.condition}
                  </span>
                )}
              </div>
            )}

            {/* Welcome screen */}
            {isFirstMessage && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Halo! Saya TaniAI 🌱</p>
                  <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                    Asisten pertanian cerdas khusus Indonesia. Tanyakan apapun seputar tanaman,
                    hama, pupuk, cuaca, dan strategi panen.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full max-w-md sm:grid-cols-2">
                  {latestActivePlant && (
                    <button
                      onClick={() => {
                        const q = `Apa yang perlu diperhatikan untuk tanaman ${latestActivePlant.name} pada umur ${latestActivePlant.age_days} HST?`;
                        setInput(q);
                        inputRef.current?.focus();
                      }}
                      className="rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-left text-xs font-medium hover:border-green-300 hover:bg-green-100 transition-colors text-green-800"
                    >
                      🌱 Tips {latestActivePlant.name} di umur {latestActivePlant.age_days} HST?
                    </button>
                  )}
                  {latestDiagnosis && (
                    <button
                      onClick={() => {
                        const q = `Bagaimana cara mengatasi ${latestDiagnosis.diagnosis} pada tanaman ${latestDiagnosis.plant_type}?`;
                        setInput(q);
                        inputRef.current?.focus();
                      }}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-left text-xs font-medium hover:border-amber-300 hover:bg-amber-100 transition-colors text-amber-800"
                    >
                      🔍 Cara atasi {latestDiagnosis.diagnosis} pada {latestDiagnosis.plant_type}?
                    </button>
                  )}
                  {SUGGESTIONS.slice(
                    0,
                    Math.max(0, 6 - (latestActivePlant ? 1 : 0) - (latestDiagnosis ? 1 : 0)),
                  ).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setInput(s);
                        inputRef.current?.focus();
                      }}
                      className="rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs font-medium hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 self-end">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border rounded-bl-sm shadow-sm",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <MarkdownMessage content={msg.content} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {sendMutation.isPending && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 self-end">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 shadow-sm">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-2 w-2 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-border bg-card/50 backdrop-blur-sm p-3 pb-4">
            <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all min-h-[44px]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder="Tanyakan seputar pertanian Indonesia..."
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground max-h-28 self-center leading-5 py-0"
                style={{ height: "20px" }}
                disabled={sendMutation.isPending}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || sendMutation.isPending}
                className="h-8 w-8 shrink-0 rounded-xl bg-primary hover:bg-primary/90"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              AI khusus pertanian Indonesia
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
