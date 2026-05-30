// ============================================================
// PATCH: Tambahkan section ini ke profile.tsx
//
// 1. Import komponen di bagian atas file:
//    import { WhatsappLinkCard } from "@/components/whatsapp/WhatsappLinkCard";
//
// 2. Tambahkan tab baru di array tab:
//    type TabType = "profile" | "akun" | "notifikasi" | "whatsapp"
//
// 3. Tambahkan tab button di tab switcher (setelah tab "Notifikasi"):
// ============================================================

/*
── TAB BUTTON (tambahkan di antara tab buttons yang sudah ada) ──

<button
  onClick={() => setActiveTab("whatsapp")}
  className={cn(
    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
    activeTab === "whatsapp"
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted"
  )}
>
  <Smartphone className="inline size-4 mr-1.5" />
  WhatsApp
</button>


── TAB CONTENT (tambahkan di dalam conditional render tabs) ──

{activeTab === "whatsapp" && (
  <div className="space-y-4">
    <div>
      <h3 className="text-base font-semibold">Integrasi WhatsApp</h3>
      <p className="text-sm text-muted-foreground mt-0.5">
        Hubungkan WhatsApp-mu agar bisa chat dengan TaniAI langsung dari WhatsApp
        dan AI akan mengenali datamu secara personal.
      </p>
    </div>

    <WhatsappLinkCard />

    <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground space-y-1.5">
      <p className="font-medium text-foreground">Fitur setelah terhubung:</p>
      <ul className="space-y-1">
        <li>🌾 Tanya masalah tanaman langsung dari WhatsApp</li>
        <li>📸 Kirim foto tanaman untuk diagnosa AI</li>
        <li>🧠 AI mengenal nama, lokasi, dan tanaman aktifmu</li>
        <li>💬 Riwayat chat tersimpan di akun web</li>
      </ul>
    </div>
  </div>
)}
*/

// ── FULL REPLACEMENT untuk profile.tsx yang sudah ada ────────
// Jika mau langsung copy-paste penuh, copy file di bawah ini
// dan replace profile.tsx yang lama.

// NOTE: Import tambahan yang dibutuhkan:
// import { Smartphone } from "lucide-react";
// import { WhatsappLinkCard } from "@/components/whatsapp/WhatsappLinkCard";
