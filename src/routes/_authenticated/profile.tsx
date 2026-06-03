// src/routes/_authenticated/profile.tsx
import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePlants } from "@/hooks/useUserPlants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User,
  MapPin,
  Leaf,
  Shield,
  Camera,
  Save,
  Eye,
  EyeOff,
  Bell,
  Loader2,
  Smartphone,
  Link2,
  Link2Off,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Maximize2,
  Construction,
} from "lucide-react";
import { saveLocation, geocodeCity } from "@/services/location/locationService";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Pengaturan — TaniAI Nexus" }] }),
  component: Profile,
});

const FARMER_TYPES = [
  "Petani Padi",
  "Petani Sayuran",
  "Petani Buah-buahan",
  "Petani Perkebunan",
  "Peternak",
  "Petani Campuran",
  "Penyuluh Pertanian",
  "Lainnya",
];

// WhatsApp Section
const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3000";

async function getToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function apiFetch(path: string, method = "GET") {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

const LS_PAIRING_CODE_KEY = "taniai_pairing_code";
const LS_PAIRING_EXPIRY_KEY = "taniai_pairing_expiry";

function savePairingToStorage(code: string, expiry: Date) {
  try {
    localStorage.setItem(LS_PAIRING_CODE_KEY, code);
    localStorage.setItem(LS_PAIRING_EXPIRY_KEY, expiry.toISOString());
  } catch (_) {}
}
function clearPairingFromStorage() {
  try {
    localStorage.removeItem(LS_PAIRING_CODE_KEY);
    localStorage.removeItem(LS_PAIRING_EXPIRY_KEY);
  } catch (_) {}
}
function loadPairingFromStorage(): { code: string; expiry: Date } | null {
  try {
    const code = localStorage.getItem(LS_PAIRING_CODE_KEY);
    const expiryStr = localStorage.getItem(LS_PAIRING_EXPIRY_KEY);
    if (!code || !expiryStr) return null;
    const expiry = new Date(expiryStr);
    if (isNaN(expiry.getTime()) || new Date() > expiry) {
      clearPairingFromStorage();
      return null;
    }
    return { code, expiry };
  } catch (_) {
    return null;
  }
}

function useWhatsappLink() {
  const qc = useQueryClient();
  const [pairingCode, setPairingCode] = useState<string | null>(
    () => loadPairingFromStorage()?.code ?? null,
  );
  const [codeExpiry, setCodeExpiry] = useState<Date | null>(
    () => loadPairingFromStorage()?.expiry ?? null,
  );

  const {
    data: status,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["wa-link-status"],
    queryFn: () => apiFetch("/api/pairing/status"),
    refetchInterval: pairingCode ? 5000 : false,
    staleTime: 0,
  });

  // 🔁 Auto-clear pairing code ketika status sudah linked
  useEffect(() => {
    if (status?.linked && pairingCode) {
      setPairingCode(null);
      setCodeExpiry(null);
      clearPairingFromStorage();
      qc.invalidateQueries({ queryKey: ["wa-link-status"] });
    }
  }, [status?.linked, pairingCode, qc]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const generate = async () => {
    setIsGenerating(true);
    try {
      const data = await apiFetch("/api/pairing/generate", "POST");
      const expiry = new Date(Date.now() + data.expiresInMinutes * 60 * 1000);
      setPairingCode(data.code);
      setCodeExpiry(expiry);
      savePairingToStorage(data.code, expiry);
      toast.success("Kode berhasil dibuat!");
    } catch {
      toast.error("Gagal membuat kode pairing. Pastikan API server berjalan.");
    } finally {
      setIsGenerating(false);
    }
  };

  const unlink = async () => {
    setIsUnlinking(true);
    try {
      await apiFetch("/api/pairing/unlink", "POST");
      setPairingCode(null);
      setCodeExpiry(null);
      clearPairingFromStorage();
      qc.invalidateQueries({ queryKey: ["wa-link-status"] });
      toast.success("WhatsApp berhasil diputuskan.");
    } catch {
      toast.error("Gagal memutuskan WhatsApp.");
    } finally {
      setIsUnlinking(false);
    }
  };

  const isExpired = codeExpiry ? new Date() > codeExpiry : false;
  useEffect(() => {
    if (isExpired && pairingCode) {
      setPairingCode(null);
      setCodeExpiry(null);
      clearPairingFromStorage();
    }
  }, [isExpired, pairingCode]);

  return {
    isLinked: status?.linked ?? false,
    phoneNumber: status?.phoneNumber ?? null,
    statusLoading: isLoading,
    refetch,
    pairingCode: isExpired ? null : pairingCode,
    codeExpiry,
    isExpired,
    generate,
    isGenerating,
    unlink,
    isUnlinking,
  };
}

const WA_BOT_NUMBER = "6288709718383";
const WA_BOT_DISPLAY = "0887-0971-8383";
const WA_QR_URL =
  "https://zgiomlixpneyvujipplh.supabase.co/storage/v1/object/public/qr-codes/qr-codes-wa-tani-ai-nexus.png";

function WhatsappTab() {
  const wa = useWhatsappLink();
  const [copied, setCopied] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    if (!wa.codeExpiry || wa.isExpired) return;
    const tick = () =>
      setCountdown(Math.max(0, Math.round((wa.codeExpiry!.getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [wa.codeExpiry, wa.isExpired]);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {}
    }
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch (_) {
      return false;
    }
  };

  const handleCopy = async () => {
    if (!wa.pairingCode) return;
    const ok = await copyToClipboard(`LINK ${wa.pairingCode}`);
    if (ok) {
      setCopied(true);
      toast.success("Kode disalin! Kirim ke bot WhatsApp.");
      setTimeout(() => setCopied(false), 2000);
    } else toast.error("Gagal menyalin. Salin manual dari kotak kode di atas.");
  };

  const handleCopyNumber = async () => {
    const ok = await copyToClipboard(WA_BOT_NUMBER);
    if (ok) {
      setCopiedNum(true);
      toast.success("Nomor WA bot AI disalin!");
      setTimeout(() => setCopiedNum(false), 2000);
    } else toast.error("Gagal menyalin nomor.");
  };

  const mm = Math.floor(countdown / 60);
  const ss = String(countdown % 60).padStart(2, "0");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" /> Integrasi WhatsApp
        </h2>
        <p className="text-sm text-muted-foreground">
          Hubungkan WhatsApp-mu agar bisa chat langsung dengan TaniAI dari WhatsApp.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: "🌾", label: "Tanya masalah tanaman" },
            { icon: "📸", label: "Kirim foto untuk diagnosa" },
            { icon: "🧠", label: "AI mengenal datamu" },
            { icon: "💬", label: "Riwayat tersimpan" },
          ].map((f) => (
            <div key={f.label} className="rounded-xl bg-muted/50 p-3 text-center">
              <div className="text-xl mb-1">{f.icon}</div>
              <p className="text-xs text-muted-foreground">{f.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center sm:items-start gap-3 sm:w-48 shrink-0">
            <div
              className="rounded-xl overflow-hidden border border-border bg-white p-1.5 shadow-sm cursor-pointer hover:shadow-md transition-all group relative"
              onClick={() => setShowQrModal(true)}
            >
              <img
                src={WA_QR_URL}
                alt="QR Code WA Bot TaniAI"
                className="w-32 h-32 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                <Maximize2 className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs text-muted-foreground">Nomor bot TaniAI:</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-bold font-mono text-primary">{WA_BOT_DISPLAY}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCopyNumber}>
                  {copiedNum ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <a
                href={`https://wa.me/${WA_BOT_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-semibold px-3 py-1.5 transition-colors"
              >
                <Smartphone className="h-3 w-3" /> Buka WA
              </a>
            </div>
          </div>
          <div className="hidden sm:block w-px bg-border shrink-0" />
          <div className="flex-1 min-w-0">
            {wa.statusLoading ? (
              <div className="flex items-center gap-3 text-muted-foreground h-full">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Mengecek status...</span>
              </div>
            ) : wa.isLinked ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-500 p-2 shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                      WhatsApp Terhubung ✓
                    </p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Nomor:{" "}
                      <span className="font-mono font-semibold">
                        {wa.phoneNumber ?? "tersembunyi"}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/40 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
                  TaniAI di WhatsApp sudah aktif! Chat ke{" "}
                  <span className="font-semibold">{WA_BOT_DISPLAY}</span> kapan saja.
                </div>
                {wa.pairingCode && !wa.isExpired && (
                  <div className="rounded-xl border-2 border-primary/30 bg-muted p-4 space-y-3">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary" /> Kode baru untuk mengganti nomor
                      WhatsApp:
                    </p>
                    <div className="flex items-center gap-3">
                      <code className="text-lg font-mono font-bold tracking-widest text-primary flex-1">
                        LINK {wa.pairingCode}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopy}
                        className="shrink-0 gap-1"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-500" /> Disalin
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" /> Salin
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Kirim kode ini ke bot WA untuk mengganti nomor yang terhubung. Berlaku{" "}
                      {Math.floor((wa.codeExpiry!.getTime() - Date.now()) / 60000)} menit.
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 gap-2"
                    onClick={wa.unlink}
                    disabled={wa.isUnlinking}
                  >
                    {wa.isUnlinking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2Off className="h-4 w-4" />
                    )}{" "}
                    Putuskan WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={wa.generate}
                    disabled={wa.isGenerating}
                  >
                    {wa.isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}{" "}
                    Buat Kode Baru
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  *Kode baru dapat digunakan untuk mengganti nomor WhatsApp yang terhubung.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 shrink-0">
                    <Link2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Belum terhubung</p>
                    <p className="text-sm text-muted-foreground">
                      Ikuti langkah di bawah untuk menghubungkan
                    </p>
                  </div>
                </div>
                {wa.isExpired && (
                  <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-950/20 rounded-xl px-3 py-2">
                    <AlertCircle className="h-4 w-4 shrink-0" /> Kode kedaluwarsa. Buat kode baru.
                  </div>
                )}
                {wa.pairingCode && !wa.isExpired ? (
                  <div className="space-y-3">
                    <ol className="space-y-1.5">
                      {["Buka WhatsApp", `Chat ke ${WA_BOT_DISPLAY}`, "Kirim pesan ini:"].map(
                        (step, i) => (
                          <li key={i} className="flex gap-2 items-center text-sm">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                              {i + 1}
                            </span>
                            <span className="text-muted-foreground">{step}</span>
                          </li>
                        ),
                      )}
                    </ol>
                    <div className="rounded-xl bg-muted border-2 border-dashed border-primary/30 p-3">
                      <div className="flex items-center gap-3">
                        <code className="text-lg font-mono font-bold tracking-widest text-primary flex-1">
                          LINK {wa.pairingCode}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCopy}
                          className="shrink-0 gap-1"
                        >
                          {copied ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-500" /> Disalin
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" /> Salin
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p
                        className={cn(
                          "text-sm",
                          countdown < 60
                            ? "text-orange-500 font-semibold"
                            : "text-muted-foreground",
                        )}
                      >
                        ⏱ {mm}:{ss}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => wa.refetch()}
                        className="gap-1 text-xs"
                      >
                        <RefreshCw className="h-3 w-3" /> Cek status
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={wa.generate} disabled={wa.isGenerating} className="w-full gap-2">
                    {wa.isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Membuat kode...
                      </>
                    ) : (
                      <>
                        <Smartphone className="h-4 w-4" /> Buat Kode Pairing
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-3">
        <p className="text-sm font-semibold">Cara kerja sistem ini</p>
        <div className="space-y-2 text-sm text-muted-foreground">
          {[
            "Kamu buat kode pairing di sini (berlaku 15 menit)",
            `Kirim kode itu ke nomor WhatsApp bot TaniAI (${WA_BOT_DISPLAY})`,
            "Bot verifikasi → nomor WA-mu terhubung ke akun ini",
            "Setelah itu, chat ke bot kapan saja — AI sudah kenal kamu",
          ].map((s, i) => (
            <div key={i} className="flex gap-2">
              <span>{i + 1}️⃣</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="flex flex-col items-center gap-4">
              <h3 className="text-lg font-semibold">Scan QR Code</h3>
              <div className="rounded-xl overflow-hidden border-2 border-border bg-white p-3 shadow-inner">
                <img src={WA_QR_URL} alt="QR Code" className="w-64 h-64 object-contain" />
              </div>
              <div className="text-center space-y-2 w-full">
                <p className="text-sm font-semibold">Atau chat langsung ke:</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl font-bold font-mono tracking-wide text-primary">
                    {WA_BOT_DISPLAY}
                  </span>
                  <Button size="sm" variant="outline" onClick={handleCopyNumber}>
                    {copiedNum ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <a
                  href={`https://wa.me/${WA_BOT_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-semibold px-6 py-2.5 transition-colors w-full justify-center mt-2"
                >
                  <Smartphone className="h-4 w-4" /> Buka di WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Notification prefs key list
const NOTIF_KEYS = ["community", "diagnosis", "weather", "ai"] as const;
type NotifKey = (typeof NOTIF_KEYS)[number];
const NOTIF_LABELS: Record<NotifKey, { label: string; desc: string }> = {
  community: {
    label: "Aktivitas Komunitas",
    desc: "Like, komentar, dan mention pada postingan Anda",
  },
  diagnosis: { label: "Hasil Diagnosa", desc: "Notifikasi saat diagnosa tanaman selesai" },
  weather: { label: "Peringatan Cuaca", desc: "Alert cuaca ekstrem dan peringatan pertanian" },
  ai: { label: "Rekomendasi AI", desc: "Saran pertanian personal dari TaniAI" },
};

// Coming Soon Modal
function NotifComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-card rounded-2xl shadow-2xl max-w-sm w-full p-7 flex flex-col items-center gap-4 border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Icon */}
        <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-4">
          <Construction className="h-8 w-8 text-amber-500" />
        </div>

        {/* Text */}
        <div className="text-center space-y-1.5">
          <h3 className="text-lg font-bold">Fitur Segera Hadir! 🚧</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pengaturan notifikasi masih dalam tahap pengembangan dan belum siap digunakan. Kami
            sedang mempersiapkannya agar berfungsi dengan sempurna untuk kamu.
          </p>
        </div>

        {/* Badge */}
        <div className="flex items-center gap-2 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            Coming Soon
          </span>
        </div>

        <Button variant="outline" className="w-full mt-1" onClick={onClose}>
          Kembali ke Profil
        </Button>
      </div>
    </div>
  );
}

// MAIN PROFILE
function Profile() {
  const qc = useQueryClient();
  const { data: plants = [] } = usePlants();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "akun" | "notifikasi" | "whatsapp">(
    "profile",
  );
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<{ name: string; province: string }[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    location: "",
    phone: "",
    farmer_type: "",
    bio: "",
  });
  const [pwForm, setPwForm] = useState({ new: "", confirm: "" });
  const [email, setEmail] = useState("");

  // Notif prefs — loaded from DB jsonb field
  const [notifPrefs, setNotifPrefs] = useState<Record<NotifKey, boolean>>({
    community: true,
    diagnosis: true,
    weather: true,
    ai: true,
  });
  const [notifSaving, setNotifSaving] = useState(false);

  const { data: diagCount = 0 } = useQuery({
    queryKey: ["profile-diag-count"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count } = await supabase
        .from("plant_diagnoses")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      return count ?? 0;
    },
  });

  const { data: postCount = 0 } = useQuery({
    queryKey: ["profile-post-count"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count } = await supabase
        .from("community_posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      return count ?? 0;
    },
  });

  useEffect(() => {
    let retries = 0;
    const maxRetries = 3;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("profiles")
        .select("full_name, location, bio, avatar_url, phone, farmer_type, notification_prefs")
        .eq("id", user.id)
        .maybeSingle();

      if (!data && retries < maxRetries) {
        retries++;
        setTimeout(load, 800);
        return;
      }

      if (data) {
        setForm({
          full_name: data.full_name ?? "",
          location: data.location ?? "",
          phone: (data as any).phone ?? "",
          farmer_type: (data as any).farmer_type ?? "",
          bio: data.bio ?? "",
        });
        setCitySearch(data.location ?? "");
        if (data.avatar_url) {
          setAvatarUrl(`${data.avatar_url}?t=${Date.now()}`);
        }
        const prefs = (data as any).notification_prefs;
        if (prefs && typeof prefs === "object") {
          setNotifPrefs((prev) => ({ ...prev, ...prefs }));
        }
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          location: form.location,
          bio: form.bio,
          phone: form.phone,
          farmer_type: form.farmer_type,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      if (form.location) {
        const loc = await geocodeCity(form.location);
        if (loc) saveLocation(loc);
      }
      window.dispatchEvent(new Event("profile-updated"));
      toast.success("Profil berhasil disimpan!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (pwForm.new !== pwForm.confirm) {
      toast.error("Password baru tidak cocok");
      return;
    }
    if (pwForm.new.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.new });
      if (error) throw error;
      setPwForm({ new: "", confirm: "" });
      toast.success("Password berhasil diubah!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Foto maks 2MB");
      return;
    }
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");
      const ext = file.name.split(".").pop();
      const path = `avatars/${user.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "no-cache" });
      if (upErr) throw new Error("Gagal upload foto: " + upErr.message);
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() } as any)
        .eq("id", user.id);
      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
      window.dispatchEvent(new Event("profile-updated"));
      toast.success("Foto profil diperbarui!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveNotifPrefs = async () => {
    setNotifSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");
      const { error } = await supabase
        .from("profiles")
        .update({
          notification_prefs: notifPrefs,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Preferensi notifikasi disimpan!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setNotifSaving(false);
    }
  };

  // Handler for tab click — intercept notifikasi
  const handleTabClick = (tabId: typeof activeTab) => {
    if (tabId === "notifikasi") {
      setShowNotifModal(true);
      // Don't switch tab
      return;
    }
    setActiveTab(tabId);
  };

  // When modal closes, ensure we're on profile tab
  const handleNotifModalClose = () => {
    setShowNotifModal(false);
    setActiveTab("profile");
  };

  const initials = (form.full_name || email || "U").slice(0, 2).toUpperCase();
  const activePlants = plants.filter((p) => p.status === "Aktif");

  const TABS = [
    { id: "profile" as const, label: "Profil", icon: User },
    { id: "akun" as const, label: "Akun & Keamanan", icon: Shield },
    { id: "notifikasi" as const, label: "Notifikasi", icon: Bell },
    { id: "whatsapp" as const, label: "WhatsApp Bot AI", icon: Smartphone },
  ];

  return (
    <div className="space-y-6">
      {/* Coming Soon Modal */}
      {showNotifModal && <NotifComingSoonModal onClose={handleNotifModalClose} />}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Akun</h1>
        <p className="text-sm text-muted-foreground">Kelola profil dan preferensi Anda</p>
      </div>

      {/* Profile Header Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <Avatar className="h-20 w-20 ring-4 ring-primary/10">
              {avatarUrl && (
                <AvatarImage
                  src={avatarUrl}
                  key={avatarUrl}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-2xl font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <label
              className={cn(
                "absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-primary text-white shadow-sm transition-opacity",
                uploading && "opacity-50 cursor-not-allowed",
              )}
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Camera className="h-3 w-3" />
              )}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </label>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-bold">{form.full_name || "Nama Belum Diisi"}</h2>
            <p className="text-sm text-muted-foreground">{email}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              {form.farmer_type && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {form.farmer_type}
                </span>
              )}
              {form.location && (
                <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {form.location}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-4 text-center sm:gap-6">
            {[
              { label: "Tanaman", value: plants.length },
              { label: "Aktif", value: activePlants.length },
              { label: "Diagnosa", value: diagCount },
              { label: "Postingan", value: postCount },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabClick(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors relative",
              activeTab === t.id && t.id !== "notifikasi"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
              t.id === "notifikasi" && "opacity-60",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(" ")[0]}</span>
            {t.id === "notifikasi" && (
              <span className="hidden sm:inline-flex items-center rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-white leading-none ml-1">
                Soon
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Profil */}
      {activeTab === "profile" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Informasi Pribadi
            </h2>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Nama Lengkap
              </label>
              <input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Nama lengkap Anda"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="relative">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Lokasi
              </label>
              <div className="relative mt-1.5">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={citySearch}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setCitySearch(val);
                    setForm((f) => ({ ...f, location: val }));
                    if (val.length >= 2) {
                      const result = await geocodeCity(val);
                      setCitySuggestions(
                        result ? [{ name: result.city, province: result.province }] : [],
                      );
                    } else {
                      setCitySuggestions([]);
                    }
                  }}
                  onBlur={() => setTimeout(() => setCitySuggestions([]), 200)}
                  placeholder="Ketik nama kota/kabupaten..."
                  className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {citySuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-elevated">
                  {citySuggestions.map((city) => (
                    <button
                      key={city.name}
                      type="button"
                      onClick={() => {
                        setCitySearch(city.name);
                        setForm((f) => ({ ...f, location: city.name }));
                        setCitySuggestions([]);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{city.name}</span>
                      <span className="text-muted-foreground text-xs">{city.province}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  No. Telepon
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="08xxxxxxxxxx"
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Jenis Petani
                </label>
                <select
                  value={form.farmer_type}
                  onChange={(e) => setForm((f) => ({ ...f, farmer_type: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="">Pilih...</option>
                  {FARMER_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Bio
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Ceritakan sedikit tentang Anda..."
                rows={3}
                className="mt-1.5 w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={loading}
              className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Simpan Perubahan
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <Leaf className="h-4 w-4 text-primary" /> Tanaman Aktif
            </h2>
            {activePlants.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <Leaf className="h-8 w-8 opacity-30" />
                <p className="text-sm">Belum ada tanaman aktif</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activePlants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5"
                  >
                    <span className="text-lg">🌱</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.age_days} HST · {p.soil_condition}
                      </p>
                    </div>
                    {p.location && (
                      <span className="text-xs text-muted-foreground">📍 {p.location}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Akun & Keamanan */}
      {activeTab === "akun" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Ubah Password
            </h2>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Password Baru
              </label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? "text" : "password"}
                  value={pwForm.new}
                  onChange={(e) => setPwForm((f) => ({ ...f, new: e.target.value }))}
                  placeholder="Min. 6 karakter"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Konfirmasi Password
              </label>
              <input
                type="password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                placeholder="Ulangi password baru"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {pwForm.new && pwForm.confirm && pwForm.new !== pwForm.confirm && (
              <p className="text-xs text-destructive">Password tidak cocok</p>
            )}
            <Button
              onClick={handlePasswordUpdate}
              disabled={loading || !pwForm.new || !pwForm.confirm || pwForm.new !== pwForm.confirm}
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Info Akun
            </h2>
            <div className="space-y-3 text-sm divide-y divide-border">
              {[
                { label: "Email", value: email },
                { label: "Total Diagnosa", value: String(diagCount) },
                { label: "Total Postingan", value: String(postCount) },
                { label: "Tanaman", value: String(plants.length) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Notifikasi — rendered blurred behind modal */}
      {activeTab === "notifikasi" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card pointer-events-none select-none blur-sm opacity-60">
          <h2 className="font-semibold flex items-center gap-2 mb-1">
            <Bell className="h-4 w-4 text-primary" /> Preferensi Notifikasi
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Pengaturan ini menentukan jenis notifikasi yang akan masuk ke ikon notifikasi di header.
          </p>
          <div className="space-y-4">
            {NOTIF_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-border p-4"
              >
                <div>
                  <p className="text-sm font-semibold">{NOTIF_LABELS[key].label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{NOTIF_LABELS[key].desc}</p>
                </div>
                <div className="h-5 w-9 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: WhatsApp */}
      {activeTab === "whatsapp" && <WhatsappTab />}
    </div>
  );
}
