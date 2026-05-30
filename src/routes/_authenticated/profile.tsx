import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePlants } from "@/hooks/useUserPlants";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User, MapPin, Leaf, Settings, Camera, Shield,
  Save, Eye, EyeOff, Bell, LogOut, Loader2,
  Smartphone, Link2, Link2Off, Copy, Check,
  RefreshCw, CheckCircle2, AlertCircle, X, Maximize2,
} from "lucide-react";
import { INDONESIAN_CITIES } from "@/services/location/locationService";
import { saveLocation, geocodeCity } from "@/services/location/locationService";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Pengaturan — TaniAI Nexus" }] }),
  component: Profile,
});

const FARMER_TYPES = [
  "Petani Padi", "Petani Sayuran", "Petani Buah-buahan",
  "Petani Perkebunan", "Peternak", "Petani Campuran", "Penyuluh Pertanian", "Lainnya",
];

// ─────────────────────────────────────────────────────────────
// WHATSAPP LINKING LOGIC (inline — tidak butuh file terpisah)
// ─────────────────────────────────────────────────────────────

const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3000";

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function apiFetch(path: string, method = "GET") {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ─── Kunci localStorage untuk persisten pairing code ─────────
const LS_PAIRING_CODE_KEY = "taniai_pairing_code";
const LS_PAIRING_EXPIRY_KEY = "taniai_pairing_expiry";

/** Simpan pairing code ke localStorage */
function savePairingToStorage(code: string, expiry: Date) {
  try {
    localStorage.setItem(LS_PAIRING_CODE_KEY, code);
    localStorage.setItem(LS_PAIRING_EXPIRY_KEY, expiry.toISOString());
  } catch (_) { /* ignore — private/incognito mode */ }
}

/** Hapus pairing code dari localStorage */
function clearPairingFromStorage() {
  try {
    localStorage.removeItem(LS_PAIRING_CODE_KEY);
    localStorage.removeItem(LS_PAIRING_EXPIRY_KEY);
  } catch (_) { /* ignore */ }
}

/** Baca pairing code dari localStorage, null jika expired/tidak ada */
function loadPairingFromStorage(): { code: string; expiry: Date } | null {
  try {
    const code = localStorage.getItem(LS_PAIRING_CODE_KEY);
    const expiryStr = localStorage.getItem(LS_PAIRING_EXPIRY_KEY);
    if (!code || !expiryStr) return null;
    const expiry = new Date(expiryStr);
    if (isNaN(expiry.getTime()) || new Date() > expiry) {
      // Expired — bersihkan storage
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

  // Inisialisasi state dari localStorage agar kode tetap ada setelah refresh
  const [pairingCode, setPairingCode] = useState<string | null>(() => {
    const saved = loadPairingFromStorage();
    return saved?.code ?? null;
  });
  const [codeExpiry, setCodeExpiry] = useState<Date | null>(() => {
    const saved = loadPairingFromStorage();
    return saved?.expiry ?? null;
  });

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["wa-link-status"],
    queryFn: () => apiFetch("/api/pairing/status"),
    refetchInterval: pairingCode ? 5000 : false,
    staleTime: 0,
  });

  const generateMutation = useMutation({
    mutationFn: () => apiFetch("/api/pairing/generate", "POST"),
    onSuccess: (data: any) => {
      const expiry = new Date(Date.now() + data.expiresInMinutes * 60 * 1000);
      setPairingCode(data.code);
      setCodeExpiry(expiry);
      // Simpan ke localStorage agar tetap ada setelah refresh
      savePairingToStorage(data.code, expiry);
      toast.success("Kode berhasil dibuat!");
    },
    onError: () => toast.error("Gagal membuat kode pairing. Pastikan API server berjalan."),
  });

  const unlinkMutation = useMutation({
    mutationFn: () => apiFetch("/api/pairing/unlink", "POST"),
    onSuccess: () => {
      setPairingCode(null);
      setCodeExpiry(null);
      // Hapus dari localStorage saat unlink
      clearPairingFromStorage();
      qc.invalidateQueries({ queryKey: ["wa-link-status"] });
      toast.success("WhatsApp berhasil diputuskan.");
    },
    onError: () => toast.error("Gagal memutuskan WhatsApp."),
  });

  const isExpired = codeExpiry ? new Date() > codeExpiry : false;

  // Jika kode expired, bersihkan storage dan state
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
    linkedAt: status?.linkedAt ?? null,
    statusLoading: isLoading,
    refetch,
    pairingCode: isExpired ? null : pairingCode,
    codeExpiry,
    isExpired,
    generate: () => generateMutation.mutate(),
    isGenerating: generateMutation.isPending,
    unlink: () => unlinkMutation.mutate(),
    isUnlinking: unlinkMutation.isPending,
  };
}

// ─── Konstanta nomor & QR WA Bot ─────────────────────────────
// Ganti URL QR Code dengan gambar QR dari Canva Anda.
// Langkah: Export desain QR dari Canva sebagai PNG, upload ke Supabase Storage (bucket publik),
// lalu salin URL public-nya ke sini.
const WA_BOT_NUMBER = "088709718383";
const WA_BOT_DISPLAY = "0887-0971-8383";
const WA_QR_URL = "https://zgiomlixpneyvujipplh.supabase.co/storage/v1/object/public/qr-codes/qr-codes-wa-tani-ai-nexus.png";

// ─── WhatsApp Card ────────────────────────────────────────────
function WhatsappTab() {
  const wa = useWhatsappLink();
  const [copied, setCopied] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    if (!wa.codeExpiry || wa.isExpired) return;
    const tick = () => setCountdown(Math.max(0, Math.round((wa.codeExpiry!.getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [wa.codeExpiry, wa.isExpired]);

  /**
   * Salin teks ke clipboard dengan fallback untuk browser lama / HTTP (non-HTTPS).
   * Clipboard API modern hanya tersedia di secure context (HTTPS).
   */
  const copyToClipboard = async (text: string): Promise<boolean> => {
    // Metode 1: Clipboard API modern (butuh HTTPS)
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        // Fallback jika gagal (mis. permission ditolak atau HTTP)
      }
    }
    // Metode 2: Fallback execCommand (browser lama / HTTP)
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
    } else {
      toast.error("Gagal menyalin. Salin manual dari kotak kode di atas.");
    }
  };

  const handleCopyNumber = async () => {
    const ok = await copyToClipboard(WA_BOT_NUMBER);
    if (ok) {
      setCopiedNum(true);
      toast.success("Nomor WA bot disalin!");
      setTimeout(() => setCopiedNum(false), 2000);
    } else {
      toast.error("Gagal menyalin nomor. Salin manual.");
    }
  };

  const mm = Math.floor(countdown / 60);
  const ss = String(countdown % 60).padStart(2, "0");

  return (
    <div className="space-y-5">
      {/* Header info */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" /> Integrasi WhatsApp
        </h2>
        <p className="text-sm text-muted-foreground">
          Hubungkan WhatsApp-mu agar bisa chat langsung dengan TaniAI dari WhatsApp.
          AI akan mengenali akunmu, tanaman aktif, dan riwayat diagnosamu secara personal.
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

      {/* QR + Status — 1 card, 2 kolom */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Kiri: QR + Nomor */}
          <div className="flex flex-col items-center sm:items-start gap-3 sm:w-48 shrink-0">
            <div 
              className="rounded-xl overflow-hidden border border-border bg-white p-1.5 shadow-sm cursor-pointer hover:shadow-md transition-all group relative"
              onClick={() => setShowQrModal(true)}
            >
              <img
                src={WA_QR_URL}
                alt="QR Code WA Bot TaniAI"
                className="w-32 h-32 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                <Maximize2 className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </div>

            <div className="text-center sm:text-left">
              <p className="text-xs text-muted-foreground">Nomor bot:</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-bold font-mono text-primary">{WA_BOT_DISPLAY}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCopyNumber}>
                  {copiedNum ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
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

          {/* Divider */}
          <div className="hidden sm:block w-px bg-border shrink-0" />

          {/* Kanan: Status / Pairing */}
          <div className="flex-1 min-w-0">
            {wa.statusLoading ? (
              <div className="flex items-center gap-3 text-muted-foreground h-full">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Mengecek status...</span>
              </div>

            ) : wa.isLinked ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-500 p-2 shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">WhatsApp Terhubung ✓</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Nomor: <span className="font-mono font-semibold">{wa.phoneNumber ?? "tersembunyi"}</span>
                    </p>
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/40 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
                  TaniAI di WhatsApp sudah aktif! Chat ke <span className="font-semibold">{WA_BOT_DISPLAY}</span> kapan saja.
                </div>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 gap-2" onClick={wa.unlink} disabled={wa.isUnlinking}>
                  {wa.isUnlinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                  Putuskan WhatsApp
                </Button>
              </div>

            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 shrink-0">
                    <Link2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Belum terhubung</p>
                    <p className="text-sm text-muted-foreground">Ikuti langkah di bawah untuk menghubungkan</p>
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
                      {["Buka WhatsApp", `Chat ke ${WA_BOT_DISPLAY}`, "Kirim pesan ini:"].map((step, i) => (
                        <li key={i} className="flex gap-2 items-center text-sm">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{i + 1}</span>
                          <span className="text-muted-foreground">{step}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="rounded-xl bg-muted border-2 border-dashed border-primary/30 p-3">
                      <div className="flex items-center gap-3">
                        <code className="text-lg font-mono font-bold tracking-widest text-primary flex-1">LINK {wa.pairingCode}</code>
                        <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 gap-1">
                          {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Disalin</> : <><Copy className="h-3.5 w-3.5" /> Salin</>}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={cn("text-sm", countdown < 60 ? "text-orange-500 font-semibold" : "text-muted-foreground")}>
                        ⏱ {mm}:{ss}
                      </p>
                      <Button variant="ghost" size="sm" onClick={() => wa.refetch()} className="gap-1 text-xs">
                        <RefreshCw className="h-3 w-3" /> Cek status
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={wa.generate} disabled={wa.isGenerating} className="w-full gap-2">
                    {wa.isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> Membuat kode...</> : <><Smartphone className="h-4 w-4" /> Buat Kode Pairing</>}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cara kerja info */}
      <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-3">
        <p className="text-sm font-semibold">Cara kerja sistem ini</p>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex gap-2"><span>1️⃣</span><span>Kamu buat kode pairing di sini (berlaku 15 menit)</span></div>
          <div className="flex gap-2"><span>2️⃣</span><span>Kirim kode itu ke nomor WhatsApp bot TaniAI ({WA_BOT_DISPLAY})</span></div>
          <div className="flex gap-2"><span>3️⃣</span><span>Bot verifikasi → nomor WA-mu terhubung ke akun ini</span></div>
          <div className="flex gap-2"><span>4️⃣</span><span>Setelah itu, chat ke bot kapan saja — AI sudah kenal kamu</span></div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowQrModal(false)}
        >
          <div 
            className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200"
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
              <p className="text-sm text-muted-foreground text-center">
                Scan QR code ini untuk langsung chat dengan TaniAI di WhatsApp
              </p>
              <div className="rounded-xl overflow-hidden border-2 border-border bg-white p-3 shadow-inner">
                <img
                  src={WA_QR_URL}
                  alt="QR Code WA Bot TaniAI"
                  className="w-64 h-64 object-contain"
                />
              </div>
              <div className="text-center space-y-2 w-full">
                <p className="text-sm font-semibold">Atau chat langsung ke:</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl font-bold font-mono tracking-wide text-primary">
                    {WA_BOT_DISPLAY}
                  </span>
                  <Button size="sm" variant="outline" onClick={handleCopyNumber}>
                    {copiedNum ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <a
                  href={`https://wa.me/${WA_BOT_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-semibold px-6 py-2.5 transition-colors w-full justify-center mt-2"
                >
                  <Smartphone className="h-4 w-4" />
                  Buka di WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PROFILE COMPONENT
// ─────────────────────────────────────────────────────────────

function Profile() {
  const { data: plants = [] } = usePlants();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "akun" | "notifikasi" | "whatsapp">("profile");
  const [citySearch, setCitySearch] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<typeof INDONESIAN_CITIES>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [form, setForm] = useState({ full_name: "", location: "", phone: "", farmer_type: "", bio: "" });
  const [pwForm, setPwForm] = useState({ current: "", new: "", confirm: "" });
  const [email, setEmail] = useState("");

  const { data: diagCount = 0 } = useQuery({
    queryKey: ["profile-diag-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count } = await supabase.from("plant_diagnoses").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      return count ?? 0;
    },
  });

  const { data: postCount = 0 } = useQuery({
    queryKey: ["profile-post-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count } = await supabase.from("community_posts").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      return count ?? 0;
    },
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data } = await supabase
        .from("profiles")
        .select("full_name, location, bio, avatar_url, phone, farmer_type")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setForm({
          full_name: data.full_name ?? "",
          location: data.location ?? "",
          phone: (data as any).phone ?? "",
          farmer_type: (data as any).farmer_type ?? "",
          bio: data.bio ?? "",
        });
        setCitySearch(data.location ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      }
    })();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");
      const { error } = await supabase.from("profiles").update({
        full_name: form.full_name, location: form.location,
        bio: form.bio, phone: form.phone, farmer_type: form.farmer_type,
      } as any).eq("id", user.id);
      if (error) throw error;
      if (form.location) {
        const loc = await geocodeCity(form.location);
        if (loc) saveLocation(loc);
      }
      toast.success("Profil berhasil disimpan!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (pwForm.new !== pwForm.confirm) { toast.error("Password baru tidak cocok"); return; }
    if (pwForm.new.length < 6) { toast.error("Password minimal 6 karakter"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.new });
      if (error) throw error;
      setPwForm({ current: "", new: "", confirm: "" });
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
    if (file.size > 2 * 1024 * 1024) { toast.error("Foto maks 2MB"); return; }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");
      const ext = file.name.split(".").pop();
      const path = `avatars/${user.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw new Error("Gagal upload foto: " + upErr.message);
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: publicUrl } as any).eq("id", user.id);
      setAvatarUrl(publicUrl);
      toast.success("Foto profil diperbarui!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const initials = (form.full_name || email || "U").slice(0, 2).toUpperCase();
  const activePlants = plants.filter((p) => p.status === "Aktif");

  const TABS = [
    { id: "profile" as const,    label: "Profil",          icon: User },
    { id: "akun" as const,       label: "Akun & Keamanan", icon: Shield },
    { id: "notifikasi" as const, label: "Notifikasi",      icon: Bell },
    { id: "whatsapp" as const,   label: "WhatsApp",        icon: Smartphone },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Akun</h1>
        <p className="text-sm text-muted-foreground">Kelola profil dan preferensi Anda</p>
      </div>

      {/* Profile Header Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <Avatar className="h-20 w-20 ring-4 ring-primary/10">
              {avatarUrl && <AvatarImage src={avatarUrl} />}
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-2xl font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <label className={cn(
              "absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-primary text-white shadow-sm transition-opacity",
              uploading && "opacity-50 cursor-not-allowed"
            )}>
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} />
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
                  <MapPin className="h-3 w-3" />{form.location}
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
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors",
              activeTab === t.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(" ")[0]}</span>
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nama Lengkap</label>
              <input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Nama lengkap Anda"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="relative">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lokasi</label>
              <div className="relative mt-1.5">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={citySearch}
                  onChange={(e) => {
                    setCitySearch(e.target.value);
                    setForm((f) => ({ ...f, location: e.target.value }));
                    const q = e.target.value.toLowerCase();
                    setCitySuggestions(
                      q.length >= 2
                        ? INDONESIAN_CITIES.filter((c) =>
                            c.name.toLowerCase().includes(q) || c.province.toLowerCase().includes(q)
                          ).slice(0, 6)
                        : []
                    );
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
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">No. Telepon</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="08xxxxxxxxxx"
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jenis Petani</label>
                <select
                  value={form.farmer_type}
                  onChange={(e) => setForm((f) => ({ ...f, farmer_type: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="">Pilih...</option>
                  {FARMER_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Ceritakan sedikit tentang Anda dan lahan pertanian Anda..."
                rows={3}
                className="mt-1.5 w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <Button onClick={handleSave} disabled={loading} className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    <span className="text-lg">🌱</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.age_days} HST · {p.soil_condition}</p>
                    </div>
                    {p.location && <span className="text-xs text-muted-foreground">📍 {p.location}</span>}
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password Baru</label>
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Konfirmasi Password</label>
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

      {/* Tab: Notifikasi */}
      {activeTab === "notifikasi" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Bell className="h-4 w-4 text-primary" /> Preferensi Notifikasi
          </h2>
          <div className="space-y-4">
            {[
              { label: "Aktivitas Komunitas", desc: "Like, komentar, dan mention pada postingan Anda", key: "community" },
              { label: "Hasil Diagnosa", desc: "Notifikasi saat diagnosa tanaman selesai", key: "diagnosis" },
              { label: "Peringatan Cuaca", desc: "Alert cuaca ekstrem dan peringatan pertanian", key: "weather" },
              { label: "Rekomendasi AI", desc: "Saran pertanian personal dari TaniAI", key: "ai" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" defaultChecked className="peer sr-only" />
                  <div className="h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-primary after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
                </label>
              </div>
            ))}
          </div>
          <Button className="mt-4 w-full" onClick={() => toast.success("Preferensi notifikasi disimpan!")}>
            <Save className="mr-2 h-4 w-4" /> Simpan Preferensi
          </Button>
        </div>
      )}

      {/* Tab: WhatsApp */}
      {activeTab === "whatsapp" && <WhatsappTab />}
    </div>
  );
}