import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlants } from "@/hooks/useUserPlants";
import { getWeatherSummary, useWeather } from "@/hooks/useWeather";
import { supabase } from "@/integrations/supabase/client";
import { diagnosePlant, type DiagnosisResult, generateDiagnosisShareText } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  History,
  Info,
  Leaf,
  Loader2,
  MessageCircle,
  Search,
  Share2,
  Shield,
  Sprout,
  SwitchCamera,
  Trash2,
  Upload,
  X,
  ZoomIn,
  Check,
  Plus,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/plant-doctor")({
  head: () => ({ meta: [{ title: "Diagnosa Tanaman — TaniAI Nexus" }] }),
  component: DiagnosaTanaman,
});

const SOIL_CONDITIONS = [
  { value: "Kering", label: "Kering", desc: "Tanah retak/berdebu", icon: "☀️" },
  { value: "Normal", label: "Normal", desc: "Lembap ideal", icon: "✅" },
  { value: "Basah/Becek", label: "Basah/Becek", desc: "Jenuh air", icon: "💧" },
];

const WEATHER_CONDITIONS = ["Cerah", "Cerah Berawan", "Berawan", "Hujan Ringan", "Hujan Lebat"];

const PLANT_TYPES = [
  "Padi", "Jagung", "Cabai", "Tomat", "Terung", "Kedelai",
  "Bawang Merah", "Bawang Putih", "Kentang", "Singkong", "Pisang", "Mangga", "Jeruk", "Lainnya",
];

const PLANT_PARTS = [
  { value: "Daun", icon: "🍃" },
  { value: "Buah", icon: "🍅" },
  { value: "Batang", icon: "🌿" },
  { value: "Akar", icon: "🌱" },
  { value: "Bunga", icon: "🌸" },
  { value: "Keseluruhan", icon: "🪴" },
];

function getPlantEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("padi") || n.includes("beras")) return "🌾";
  if (n.includes("jagung")) return "🌽";
  if (n.includes("cabai") || n.includes("cabe")) return "🌶️";
  if (n.includes("tomat")) return "🍅";
  if (n.includes("bawang")) return "🧅";
  if (n.includes("kentang")) return "🥔";
  if (n.includes("singkong")) return "🥕";
  if (n.includes("pisang")) return "🍌";
  if (n.includes("mangga")) return "🥭";
  if (n.includes("jeruk")) return "🍊";
  if (n.includes("kopi")) return "☕";
  if (n.includes("kakao")) return "🍫";
  if (n.includes("kedelai")) return "🫘";
  return "🌱";
}

interface PlantTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  customPlant: string;
  onCustomPlantChange: (value: string) => void;
  userPlants: string[];
}

function PlantTypeSelector({ value, onChange, customPlant, onCustomPlantChange, userPlants }: PlantTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const allPlantOptions = Array.from(new Set([...PLANT_TYPES, ...userPlants])).sort((a, b) => a.localeCompare(b));
  const filteredOptions = allPlantOptions.filter(plant => plant.toLowerCase().includes(search.toLowerCase()));
  const displayValue = value === "Lainnya" ? customPlant : value;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (plant: string) => {
    onChange(plant);
    onCustomPlantChange("");
    setIsOpen(false);
    setSearch("");
  };

  const handleCustomSubmit = () => {
    if (search.trim()) {
      onChange("Lainnya");
      onCustomPlantChange(search.trim());
      setIsOpen(false);
      setSearch("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && search.trim()) handleCustomSubmit();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="flex w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all">
        <span className="flex items-center gap-2">
          {displayValue ? (
            <><span>{getPlantEmoji(displayValue)}</span><span className="truncate">{displayValue}</span></>
          ) : <span className="text-muted-foreground">— Pilih atau ketik jenis tanaman —</span>}
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {isOpen && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-card shadow-elevated">
          <div className="sticky top-0 bg-card p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ketik nama tanaman..." className="w-full rounded-lg border border-input bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20" autoFocus />
            </div>
          </div>
          <div className="py-1">
            {filteredOptions.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Saran</div>
                {filteredOptions.map(plant => (
                  <button key={plant} type="button" onClick={() => handleSelect(plant)} className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left hover:bg-muted/50", displayValue === plant && "bg-primary/8 text-primary font-medium")}>
                    <span className="text-base w-6 text-center">{getPlantEmoji(plant)}</span>
                    <span>{plant}</span>
                    {displayValue === plant && <Check className="ml-auto h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                ))}
              </>
            )}
            {search.trim() && (
              <>
                {filteredOptions.length > 0 && <div className="border-t border-border my-1" />}
                <button type="button" onClick={handleCustomSubmit} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left hover:bg-primary/10">
                  <span className="text-base w-6 text-center">✨</span>
                  <div className="flex flex-col">
                    <span>Gunakan "<span className="font-medium text-primary">{search}</span>"</span>
                    <span className="text-[10px] text-muted-foreground">(tanaman tidak terdaftar)</span>
                  </div>
                  <Plus className="ml-auto h-3.5 w-3.5 text-primary shrink-0" />
                </button>
              </>
            )}
            {!search.trim() && filteredOptions.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">Mulai ketik nama tanaman...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface PlantPartSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

function PlantPartSelector({ value, onChange }: PlantPartSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const selectedPart = PLANT_PARTS.find(p => p.value === value);
  const selectedIcon = selectedPart?.icon || "🌱";
  const selectedLabel = selectedPart?.value || "";
  const handleSelect = (partValue: string) => {
    onChange(partValue);
    setIsOpen(false);
  };
  return (
    <div className="relative" ref={dropdownRef}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="flex w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all">
        <span className="flex items-center gap-2">
          {value ? (<><span>{selectedIcon}</span><span>{selectedLabel}</span></>) : <span className="text-muted-foreground">— Pilih bagian tanaman —</span>}
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {isOpen && (
        <div className="absolute left-0 right-0 z-20 mt-1 rounded-xl border border-border bg-card shadow-elevated">
          <div className="py-1">
            {PLANT_PARTS.map(part => (
              <button key={part.value} type="button" onClick={() => handleSelect(part.value)} className={cn("flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left hover:bg-muted/50", value === part.value && "bg-primary/8 text-primary font-medium")}>
                <span className="text-base w-6 text-center">{part.icon}</span>
                <span>{part.value}</span>
                {value === part.value && <Check className="ml-auto h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Camera Modal (sama seperti kode Anda, tidak perlu diubah)
function CameraModal({ onCapture, onClose }: { onCapture: (dataUrl: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const attemptIdRef = useRef(0);
  const isMountedRef = useRef(false);
  const hasMultipleCamerasRef = useRef<boolean | null>(null);
  const [status, setStatus] = useState<"initializing" | "ready" | "error">("initializing");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isFlipping, setIsFlipping] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => { try { track.stop(); } catch {} });
      streamRef.current = null;
    }
  }, []);

  const attachAndPlay = useCallback((video: HTMLVideoElement, stream: MediaStream, attemptId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (attemptIdRef.current !== attemptId) { reject(new DOMException("Stale attempt", "AbortError")); return; }
      if (video.srcObject && video.srcObject !== stream) video.srcObject = null;
      const cleanup = () => {
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("loadedmetadata", onMeta);
        video.removeEventListener("error", onError);
        clearTimeout(fallbackTimer);
      };
      const settle = () => {
        if (attemptIdRef.current !== attemptId) return;
        cleanup();
        const tracks = stream.getVideoTracks();
        if (tracks.length === 0 || tracks[0].readyState !== "live") { reject(new DOMException("Track not live", "NotReadableError")); return; }
        resolve();
      };
      const onCanPlay = () => settle();
      const onMeta = () => { video.play().catch(() => {}); settle(); };
      const onError = (e: Event) => { cleanup(); reject(new Error("Video element error: " + (e as ErrorEvent).message)); };
      const fallbackTimer = window.setTimeout(() => {
        const tracks = stream.getVideoTracks();
        if (tracks.length > 0 && tracks[0].readyState === "live") settle();
        else { cleanup(); reject(new DOMException("Timeout", "TimeoutError")); }
      }, 4000);
      video.addEventListener("canplay", onCanPlay, { once: true });
      video.addEventListener("loadedmetadata", onMeta, { once: true });
      video.addEventListener("error", onError, { once: true });
      video.srcObject = stream;
    });
  }, []);

  const detectCameraCount = useCallback(async (): Promise<number> => {
    if (!navigator.mediaDevices?.enumerateDevices) return 1;
    try { const devices = await navigator.mediaDevices.enumerateDevices(); return devices.filter(d => d.kind === "videoinput").length; } catch { return 1; }
  }, []);

  const buildConstraintCandidates = useCallback((mode: "environment" | "user", isDesktop: boolean): MediaStreamConstraints[] => {
    if (isDesktop) return [{ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }, { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }, { video: true, audio: false }];
    return [{ video: { facingMode: { exact: mode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }, { video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }, { video: { facingMode: { ideal: mode } }, audio: false }, { video: true, audio: false }];
  }, []);

  const startCamera = useCallback(async (mode: "environment" | "user") => {
    stopStream();
    const myAttemptId = ++attemptIdRef.current;
    setStatus("initializing");
    setErrorMsg(null);
    if (!window.isSecureContext) { setErrorMsg("❌ Kamera membutuhkan koneksi aman (HTTPS).\n\nJika di localhost, pastikan menggunakan http://localhost (bukan IP address)."); setStatus("error"); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setErrorMsg("❌ Browser Anda tidak mendukung akses kamera.\n\nCoba Chrome, Firefox, atau Safari versi terbaru. Atau gunakan tombol Galeri."); setStatus("error"); return; }
    if (hasMultipleCamerasRef.current === null) { const count = await detectCameraCount(); hasMultipleCamerasRef.current = count > 1; }
    const isDesktop = !hasMultipleCamerasRef.current;
    const candidates = buildConstraintCandidates(mode, isDesktop);
    let stream: MediaStream | null = null;
    let lastError: any = null;
    for (const constraints of candidates) {
      if (attemptIdRef.current !== myAttemptId) return;
      try { stream = await navigator.mediaDevices.getUserMedia(constraints); break; } catch (err: any) { lastError = err; if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") break; }
    }
    if (attemptIdRef.current !== myAttemptId) return;
    if (!stream) {
      const errName = lastError?.name ?? "";
      let msg = "Tidak dapat membuka kamera. Coba gunakan tombol Galeri.";
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") msg = "❌ Izin kamera ditolak.";
      else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") msg = "❌ Kamera tidak ditemukan.";
      else if (errName === "NotReadableError" || errName === "TrackStartError") msg = "❌ Kamera sedang digunakan aplikasi lain.";
      else if (errName === "OverconstrainedError") msg = "❌ Kamera tidak kompatibel.";
      else if (errName === "AbortError") msg = "❌ Akses kamera dibatalkan.";
      setErrorMsg(msg); setStatus("error"); return;
    }
    if (attemptIdRef.current !== myAttemptId) { stream.getTracks().forEach(t => t.stop()); return; }
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) { stopStream(); return; }
    try { await attachAndPlay(video, stream, myAttemptId); if (attemptIdRef.current !== myAttemptId) return; setStatus("ready"); } catch (err: any) { if (err?.name === "AbortError") return; console.error("[Camera] attachAndPlay failed:", err); stopStream(); if (attemptIdRef.current === myAttemptId) { setErrorMsg("❌ Video tidak dapat ditampilkan.\n\nRefresh halaman dan coba lagi, atau gunakan tombol Galeri."); setStatus("error"); } }
  }, [stopStream, detectCameraCount, buildConstraintCandidates, attachAndPlay]);

  useEffect(() => { if (isMountedRef.current) return; isMountedRef.current = true; startCamera(facingMode); return () => { attemptIdRef.current++; stopStream(); isMountedRef.current = false; }; }, []);

  const flipCamera = useCallback(async () => { if (isFlipping || status === "initializing") return; setIsFlipping(true); const next = facingMode === "environment" ? "user" : "environment"; setFacingMode(next); await startCamera(next); setIsFlipping(false); }, [isFlipping, status, facingMode, startCamera]);

  const capture = useCallback(() => { const video = videoRef.current; const canvas = canvasRef.current; if (!video || !canvas) return; const w = video.videoWidth; const h = video.videoHeight; if (!w || !h) { toast.error("Video belum siap. Tunggu sebentar dan coba lagi."); return; } try { canvas.width = w; canvas.height = h; canvas.getContext("2d")?.drawImage(video, 0, 0, w, h); const dataUrl = canvas.toDataURL("image/jpeg", 0.9); stopStream(); onCapture(dataUrl); } catch (err) { toast.error("Gagal mengambil foto. Coba lagi."); } }, [stopStream, onCapture]);

  const handleClose = useCallback(() => { attemptIdRef.current++; stopStream(); onClose(); }, [stopStream, onClose]);

  const isReady = status === "ready";
  const isInitializing = status === "initializing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-md rounded-2xl overflow-hidden bg-black">
        <button onClick={handleClose} className="absolute top-3 right-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"><X className="h-5 w-5" /></button>
        {status === "error" ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center min-h-[300px]">
            <Camera className="h-12 w-12 text-destructive/40" />
            <p className="text-sm text-white/70 whitespace-pre-line">{errorMsg}</p>
            <Button variant="outline" size="sm" onClick={handleClose} className="mt-3">Gunakan Galeri</Button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-[4/3] object-cover bg-black" />
            <canvas ref={canvasRef} className="hidden" />
            {isInitializing && (<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70"><Loader2 className="h-8 w-8 text-white animate-spin mb-3" /><p className="text-sm text-white/70">Membuka kamera...</p></div>)}
            <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-6 p-5 bg-gradient-to-t from-black/70 to-transparent">
              <button onClick={flipCamera} disabled={!isReady || isFlipping} className="rounded-full bg-white/20 p-3 text-white hover:bg-white/30 disabled:opacity-50"><SwitchCamera className={cn("h-5 w-5", isFlipping && "animate-spin")} /></button>
              <button onClick={capture} disabled={!isReady} className="h-16 w-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 disabled:opacity-50 active:scale-95 flex items-center justify-center"><div className="h-11 w-11 rounded-full bg-white" /></button>
              <div className="w-11" aria-hidden />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Severity Badge, ActionRow, DiagnosisCard (sama seperti kode Anda, tidak perlu diubah)
function SeverityBadge({ severity, score }: { severity: string; score: number }) {
  const severityInfo = {
    Ringan: { bg: "bg-success/10", text: "text-success", border: "border-success/20", bar: "bg-success", label: "Resiko Rendah" },
    Sedang: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20", bar: "bg-warning", label: "Perlu Perhatian" },
    Berat: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20", bar: "bg-destructive", label: "Resiko Tinggi" },
    "Tidak Diketahui": { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", bar: "bg-muted-foreground", label: "Belum Dapat Dipastikan" },
  }[severity] ?? { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", bar: "bg-muted-foreground", label: "Analisis Tidak Pasti" };
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5", severityInfo.bg, severityInfo.border)}>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className={cn("text-xs font-semibold", severityInfo.text)}>{severityInfo.label}</span>
          <span className={cn("text-xs font-bold tabular-nums", severityInfo.text)}>{score}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-black/10 overflow-hidden"><div className={cn("h-full rounded-full transition-all duration-500", severityInfo.bar)} style={{ width: `${score}%` }} /></div>
      </div>
    </div>
  );
}

function ActionRow({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left">
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 min-w-0"><p className="text-sm font-medium">{label}</p>{open && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{detail}</p>}</div>
      <ChevronRight className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-90")} />
    </button>
  );
}

function DiagnosisCard({ result, imageUrl, plantType, plantPart, onShare, onClose }: { result: DiagnosisResult; imageUrl?: string; plantType?: string; plantPart?: string; onShare?: () => void; onClose?: () => void }) {
  const severityColor = result.severity === "Berat" ? "bg-destructive/5" : result.severity === "Sedang" ? "bg-warning/5" : "bg-success/5";
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className={cn("p-4 flex items-center gap-4", severityColor)}>
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", result.severity === "Berat" ? "bg-destructive/15" : result.severity === "Sedang" ? "bg-warning/15" : "bg-success/15")}>
          {result.severity === "Berat" ? <AlertTriangle className="h-6 w-6 text-destructive" /> : result.severity === "Sedang" ? <Info className="h-6 w-6 text-warning" /> : <CheckCircle className="h-6 w-6 text-success" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Kemungkinan besar disebabkan oleh</p>
          <h2 className="text-lg font-bold leading-tight truncate">{result.diagnosis}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn("text-[11px] font-semibold rounded-full px-2 py-0.5", result.confidence >= 75 ? "text-success" : "text-warning")}>✅ {result.confidence}% yakin</span>
            {result.recovery_days && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> ~{result.recovery_days} hari pemulihan</span>}
          </div>
        </div>
        <div className="shrink-0 text-center">
          <div className={cn("text-2xl font-bold tabular-nums", result.confidence >= 75 ? "text-success" : "text-warning")}>{result.confidence}%</div>
          <p className="text-[10px] text-muted-foreground">Tingkat<br />Keyakinan</p>
        </div>
        {onClose && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 -mr-1 -mt-8" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>}
      </div>
      <div className="p-4 space-y-4">
        {imageUrl && <div className="overflow-hidden rounded-xl"><img src={imageUrl} alt="Tanaman" className="w-full max-h-48 object-cover" /></div>}
        {result.mismatch_warning && <div className="flex gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3"><AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" /><p className="text-xs text-amber-800">{result.mismatch_warning}</p></div>}
        {result.confidence_note && <div className="flex gap-2 rounded-xl bg-warning/5 border border-warning/20 p-3"><Info className="h-4 w-4 text-warning shrink-0 mt-0.5" /><p className="text-xs text-warning">{result.confidence_note}</p></div>}
        <div><h3 className="text-sm font-semibold mb-1.5">Ringkasan</h3><p className="text-sm text-muted-foreground leading-relaxed">{result.description}</p>{result.cause && <p className="text-sm mt-1.5"><span className="font-medium">Penyebab utama: </span><span className="text-muted-foreground">{result.cause}</span></p>}</div>
        {(result.symptoms?.length || result.cause_detail) && (
          <div className="grid grid-cols-2 gap-3">
            {result.symptoms && result.symptoms.length > 0 && (<div className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-[11px] font-semibold text-muted-foreground mb-2">Gejala yang Terlihat</p><ul className="space-y-1">{result.symptoms.map((s, i) => <li key={i} className="flex items-start gap-1.5 text-xs"><CheckCircle className="h-3 w-3 text-success shrink-0 mt-0.5" /> {s}</li>)}</ul></div>)}
            {result.cause_detail && (<div className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-[11px] font-semibold text-muted-foreground mb-2">Penyebab</p><p className="text-xs text-muted-foreground leading-relaxed">{result.cause_detail}</p></div>)}
          </div>
        )}
        <SeverityBadge severity={result.severity} score={result.severity_score} />
        <div><h3 className="text-sm font-semibold mb-2">Rekomendasi Tindakan</h3><div className="rounded-xl border border-border overflow-hidden divide-y divide-border"><ActionRow icon={<span className="text-base">⚡</span>} label="Tindakan Awal (24-48 jam)" detail={result.initial_action} /><ActionRow icon={<span className="text-base">🛡️</span>} label="Penanganan Lengkap" detail={result.solution} />{result.fertilizer && <ActionRow icon={<span className="text-base">🌱</span>} label="Pupuk Dianjurkan" detail={result.fertilizer} />}<ActionRow icon={<span className="text-base">🔍</span>} label="Tindak Lanjut" detail={result.follow_up} />{result.pesticide && <ActionRow icon={<span className="text-base">💊</span>} label="Pestisida/Fungisida" detail={result.pesticide} />}{result.weather_note && <ActionRow icon={<span className="text-base">🌤️</span>} label="Tips Cuaca" detail={result.weather_note} />}</div></div>
        <div className="flex gap-2">{onShare && <Button onClick={onShare} variant="outline" size="sm" className="flex-1 gap-1.5 text-xs"><Share2 className="h-3.5 w-3.5" /> Bagikan ke Komunitas</Button>}<Button asChild variant="outline" size="sm" className="flex-1 gap-1.5 text-xs"><Link to="/assistant"><MessageCircle className="h-3.5 w-3.5" /> Tanya AI Lebih Lanjut</Link></Button></div>
      </div>
    </div>
  );
}

function DiagnosisSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-4"><Skeleton className="h-12 w-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-5 w-48" /><Skeleton className="h-3 w-24" /></div></div>
      <Skeleton className="h-32 w-full rounded-xl" /><Skeleton className="h-10 w-full rounded-xl" />
      <div className="space-y-1">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1"><Loader2 className="h-4 w-4 animate-spin" /><span>AI sedang menganalisa gambar tanaman Anda...</span></div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
function DiagnosaTanaman() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: plants = [] } = usePlants();
  const { weather } = useWeather();

  const userPlantNames = Array.from(new Set(plants.filter(p => p.status === "Aktif").map(p => p.name)));

  const [preview, setPreview] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [plantType, setPlantType] = useState("");
  const [customPlant, setCustomPlant] = useState("");
  const [plantPart, setPlantPart] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [soilCondition, setSoilCondition] = useState("Normal");
  const [weatherCondition, setWeatherCondition] = useState("Cerah");
  const [location, setLocation] = useState("");
  const [activeResult, setActiveResult] = useState<DiagnosisResult | null>(null);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ["diagnoses"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("plant_diagnoses").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("File harus berupa gambar"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran gambar maksimal 5MB"); return; }
    const reader = new FileReader();
    reader.onload = (e) => { const result = e.target?.result as string; setPreview(result); setFileBase64(result); };
    reader.readAsDataURL(file);
  }, []);

  const handleCameraCapture = (dataUrl: string) => { setPreview(dataUrl); setFileBase64(dataUrl); setShowCamera(false); };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!fileBase64) throw new Error("Pilih foto tanaman terlebih dahulu");
      const finalPlant = plantType === "Lainnya" ? customPlant : plantType;
      if (!finalPlant) throw new Error("Pilih jenis tanaman");
      const weatherSummary = weather ? `${weather.current.condition}, kelembapan ${weather.current.humidity}%` : weatherCondition;
      const { diagnosis } = await diagnosePlant({
        imageBase64: fileBase64,
        plantType: finalPlant,
        partType: plantPart || undefined,
        soilCondition,
        weatherCondition: weatherSummary,
        location: location || undefined,
        problemDescription: problemDescription || undefined,
      });
      if (!diagnosis.is_plant_image) throw new Error("Gambar yang diupload bukan foto tanaman. Harap upload foto daun, batang, atau buah tanaman yang ingin didiagnosa.");
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let imageUrl: string | null = null;
        if (fileBase64) {
          const blob = await fetch(fileBase64).then(r => r.blob());
          const filename = `diagnoses/${user.id}/${Date.now()}.jpg`;
          const { data: uploaded, error: upErr } = await supabase.storage.from("diagnoses").upload(filename, blob, { upsert: true, cacheControl: "3600" });
          if (uploaded && !upErr) imageUrl = supabase.storage.from("diagnoses").getPublicUrl(filename).data.publicUrl;
          else if (upErr) console.warn("Diagnoses storage warning:", upErr.message);
        }
        await supabase.from("plant_diagnoses").insert({
          user_id: user.id, plant_type: finalPlant, part_type: plantPart || null, diagnosis: diagnosis.diagnosis, severity: diagnosis.severity,
          severity_score: diagnosis.severity_score, confidence_score: diagnosis.confidence, cause: diagnosis.cause || null, cause_detail: diagnosis.cause_detail || null,
          description: diagnosis.description, symptoms: diagnosis.symptoms ? JSON.stringify(diagnosis.symptoms) : null, solution: diagnosis.solution,
          initial_action: diagnosis.initial_action, follow_up: diagnosis.follow_up, fertilizer: diagnosis.fertilizer || null, pesticide: diagnosis.pesticide || null,
          recovery_days: diagnosis.recovery_days || null, image_url: imageUrl, soil_condition: soilCondition, weather_condition: weatherSummary, location: location || null,
          is_plant_image: diagnosis.is_plant_image, detected_plant: diagnosis.detected_plant || null, plant_match: diagnosis.plant_match || null,
          plant_match_confidence: diagnosis.plant_match_confidence || null, mismatch_warning: diagnosis.mismatch_warning || null, confidence_note: diagnosis.confidence_note || null,
          weather_note: diagnosis.weather_note || null,
        });
        setActiveImageUrl(imageUrl);
        qc.invalidateQueries({ queryKey: ["diagnoses"] });
        qc.invalidateQueries({ queryKey: ["recent-diagnoses-dashboard"] });
      }
      return diagnosis;
    },
    onSuccess: (data) => { setActiveResult(data); toast.success("Diagnosa selesai!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleShare = async () => {
    if (!activeResult) return;
    const severity = activeResult.severity;
    if (severity !== "Ringan" && severity !== "Sedang" && severity !== "Berat") {
      toast.info("Diagnosa ini tidak dapat dibagikan karena tingkat keparahan tidak diketahui.");
      return;
    }
    const finalPlant = plantType === "Lainnya" ? customPlant : plantType;
    const partText = plantPart || "";
    const diagnosisText = activeResult.diagnosis || "tidak teridentifikasi";
    const symptomsList = activeResult.symptoms?.slice(0, 3) ?? [];

    toast.loading("AI sedang menyiapkan teks postingan...", { id: "share-ai" });
    try {
      const content = await generateDiagnosisShareText({
        plantName: finalPlant,
        diseaseName: diagnosisText,
        severity: severity,
        symptoms: symptomsList,
        plantPart: partText,
      });
      toast.dismiss("share-ai");
      navigate({ to: "/community", state: { presetContent: content, presetImageUrl: activeImageUrl ?? undefined } });
    } catch (error) {
      toast.dismiss("share-ai");
      toast.error("Gagal menghasilkan teks, coba lagi nanti.");
    }
  };

  const deleteHistory = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("plant_diagnoses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["diagnoses"] }); toast.success("Riwayat dihapus"); },
  });

  const finalPlantLabel = plantType === "Lainnya" ? customPlant : plantType;
  const canDiagnose = !!preview && !!finalPlantLabel && !!plantPart;

  return (
    <>
      {showCamera && <CameraModal onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}
      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Diagnosa Tanaman</h1><p className="text-sm text-muted-foreground">Upload foto tanaman untuk analisa penyakit berbasis AI</p></div>
          <Button variant="outline" size="sm" onClick={() => setShowHistory(v => !v)} className="gap-1.5 self-start sm:self-auto"><History className="h-3.5 w-3.5" /> Riwayat Diagnosa ({history.length})</Button>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {/* LEFT FORM */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              <div className="border-b border-border px-5 py-3.5 flex items-center gap-2.5"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10"><Camera className="h-4 w-4 text-primary" /></div><div><h2 className="font-semibold text-sm leading-none">1. Foto & Data Tanaman</h2><p className="text-[11px] text-muted-foreground mt-0.5">Upload foto yang jelas pada bagian tanaman yang bermasalah</p></div></div>
              <div className="p-4 space-y-3">
                {preview ? (
                  <div className="relative"><img src={preview} alt="Preview" className="w-full max-h-56 rounded-xl object-cover" /><button onClick={() => { setPreview(null); setFileBase64(null); }} className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"><X className="h-3.5 w-3.5" /></button><div className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white flex items-center gap-1"><ZoomIn className="h-3 w-3" /> Gambar dipilih</div></div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 transition-colors hover:border-primary/50 hover:bg-primary/5 cursor-pointer" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }} onClick={() => fileRef.current?.click()}><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"><Upload className="h-7 w-7 text-primary" /></div><div className="text-center"><p className="font-semibold text-sm">Klik untuk upload atau seret foto</p><p className="text-xs text-muted-foreground mt-0.5">JPG, PNG · Maks 5MB · Harus foto tanaman</p></div></div>
                )}
                <div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Galeri</Button><Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowCamera(true)}><Camera className="h-3.5 w-3.5" /> Kamera</Button></div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card shadow-card">
              <div className="border-b border-border px-5 py-3.5 flex items-center gap-2.5"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10"><Leaf className="h-4 w-4 text-primary" /></div><h2 className="font-semibold text-sm">Data Tanaman</h2></div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-semibold text-foreground">Jenis Tanaman <span className="text-destructive">*</span></label><div className="mt-2"><PlantTypeSelector value={plantType} onChange={setPlantType} customPlant={customPlant} onCustomPlantChange={setCustomPlant} userPlants={userPlantNames} /></div></div>
                  <div><label className="text-xs font-semibold text-foreground">Bagian Tanaman <span className="text-destructive">*</span></label><div className="mt-2"><PlantPartSelector value={plantPart} onChange={setPlantPart} /></div></div>
                </div>
                <div><label className="text-xs font-semibold text-foreground">Deskripsi Singkat Masalah</label><textarea value={problemDescription} onChange={e => setProblemDescription(e.target.value)} placeholder="Contoh: Buah cabai busuk hitam di ujung, daun menguning sejak 3 hari lalu..." rows={2} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none resize-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50" /><p className="text-[11px] text-muted-foreground mt-1">💡 Membantu AI lebih akurat, terutama jika foto kurang jelas</p></div>
                <div><label className="text-xs font-semibold text-foreground">Kondisi Tanah</label><div className="mt-2 grid grid-cols-3 gap-2">{SOIL_CONDITIONS.map(s => (<button key={s.value} onClick={() => setSoilCondition(s.value)} className={cn("flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center text-xs font-medium transition-all", soilCondition === s.value ? "border-primary bg-primary/5 text-primary" : "border-border bg-muted/20 hover:border-primary/30 text-foreground")}><span className="text-lg">{s.icon}</span><span>{s.label}</span><span className="text-[9px] text-muted-foreground font-normal">{s.desc}</span></button>))}</div></div>
                {!weather ? (<div><label className="text-xs font-semibold text-foreground">Kondisi Cuaca</label><select value={weatherCondition} onChange={e => setWeatherCondition(e.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary">{WEATHER_CONDITIONS.map(w => <option key={w}>{w}</option>)}</select></div>) : (<div className="flex items-center gap-2 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-700"><span>🌤️</span><span>Cuaca real-time: {getWeatherSummary(weather)}</span></div>)}
                <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canDiagnose} className="w-full gap-2 py-5 bg-gradient-to-r from-primary to-primary/80" size="lg">{mutation.isPending ? (<><Loader2 className="h-4 w-4 animate-spin" /> AI sedang menganalisa...</>) : (<><Leaf className="h-4 w-4" /> Mulai Diagnosa</>)}</Button>
                {!preview && <p className="text-center text-xs text-muted-foreground -mt-2">Upload foto tanaman terlebih dahulu</p>}
                {preview && !finalPlantLabel && <p className="text-center text-xs text-muted-foreground -mt-2">Pilih jenis tanaman terlebih dahulu</p>}
                {preview && finalPlantLabel && !plantPart && <p className="text-center text-xs text-muted-foreground -mt-2">Pilih bagian tanaman yang difoto terlebih dahulu</p>}
                <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1 -mt-2"><Shield className="h-3 w-3" /> Data foto aman dan hanya digunakan untuk analisa</p>
              </div>
            </div>
          </div>
          {/* RIGHT RESULT + HISTORY */}
          <div className="space-y-4">
            {mutation.isPending && <DiagnosisSkeleton />}
            {!mutation.isPending && activeResult && (<DiagnosisCard result={activeResult} imageUrl={activeImageUrl ?? undefined} plantType={finalPlantLabel} plantPart={plantPart} onShare={handleShare} onClose={() => setActiveResult(null)} />)}
            {!mutation.isPending && !activeResult && (<div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/50 p-12 text-center min-h-[320px]"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"><Sprout className="h-8 w-8 text-primary" /></div><div><p className="font-semibold">Hasil diagnosa akan muncul di sini</p><p className="mt-1 text-sm text-muted-foreground">Upload foto dan isi data tanaman, lalu klik "Mulai Diagnosa"</p></div><div className="mt-1 grid grid-cols-1 gap-2 text-left max-w-xs w-full">{[{ icon: "📷", text: "Foto jelas dengan pencahayaan cukup" }, { icon: "🔍", text: "Fokus pada bagian yang bergejala" }, { icon: "📝", text: "Isi deskripsi masalah agar AI lebih akurat" }, { icon: "🌿", text: "Pilih bagian tanaman yang difoto" }].map(tip => (<div key={tip.text} className="flex items-center gap-2 text-xs text-muted-foreground"><span>{tip.icon}</span> {tip.text}</div>))}</div></div>)}
            {showHistory && (
              <div className="rounded-2xl border border-border bg-card shadow-card">
                <div className="border-b border-border px-5 py-3.5"><h2 className="font-semibold text-sm flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Riwayat Diagnosa <span className="text-xs text-muted-foreground font-normal">(auto-hapus setelah 2 bulan)</span></h2></div>
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                  {histLoading ? (<div className="p-5 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>) : history.length === 0 ? (<div className="py-10 text-center text-sm text-muted-foreground">Belum ada riwayat diagnosa</div>) : (history.map(d => (<div key={d.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/30 cursor-pointer" onClick={() => { const sev = d.severity as "Ringan" | "Sedang" | "Berat"; const symptoms = d.symptoms ? JSON.parse(d.symptoms) : undefined; setActiveResult({ is_plant_image: d.is_plant_image ?? true, diagnosis: d.diagnosis, confidence: d.confidence_score ?? 0, severity: sev ?? "Tidak Diketahui", severity_score: d.severity_score ?? (sev === "Berat" ? 80 : sev === "Sedang" ? 50 : 25), cause: d.cause ?? "", cause_detail: d.cause_detail ?? undefined, description: d.description ?? "", symptoms: symptoms, initial_action: d.initial_action ?? "", solution: d.solution ?? "", follow_up: d.follow_up ?? "", fertilizer: d.fertilizer ?? undefined, pesticide: d.pesticide ?? undefined, recovery_days: d.recovery_days ?? undefined, detected_plant: d.detected_plant ?? undefined, plant_match: d.plant_match ?? undefined, plant_match_confidence: d.plant_match_confidence ?? undefined, mismatch_warning: d.mismatch_warning ?? undefined, confidence_note: d.confidence_note ?? undefined, weather_note: d.weather_note ?? undefined }); setActiveImageUrl(d.image_url ?? null); setShowHistory(false); }}>{d.image_url ? (<img src={d.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />) : (<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Leaf className="h-4 w-4 text-primary" /></div>)}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{d.diagnosis}</p><p className="text-xs text-muted-foreground">{d.plant_type} · {format(parseISO(d.created_at), "d MMM yyyy", { locale: idLocale })}</p></div><div className="flex items-center gap-1 shrink-0"><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", d.severity === "Berat" ? "bg-destructive/10 text-destructive" : d.severity === "Sedang" ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>{d.severity ?? "—"}</span><button onClick={e => { e.stopPropagation(); deleteHistory.mutate(d.id); }} className="ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="h-3.5 w-3.5" /></button></div></div>)))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}