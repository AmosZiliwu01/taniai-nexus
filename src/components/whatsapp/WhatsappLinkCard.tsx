// src/components/whatsapp/WhatsappLinkCard.tsx
// Komponen card untuk menghubungkan / memutus WhatsApp dari akun web

import { useState, useEffect } from "react";
import { Smartphone, Link2, Link2Off, Copy, Check, RefreshCw, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useWhatsappLink } from "@/hooks/useWhatsappLink";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

export function WhatsappLinkCard() {
  const {
    isLinked, phoneNumber, linkedAt, statusLoading,
    pairingCode, codeExpiry, isCodeExpired,
    generateCode, isGenerating,
    unlink, isUnlinking,
    refetchStatus,
  } = useWhatsappLink();

  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer saat kode aktif
  useEffect(() => {
    if (!codeExpiry || isCodeExpired) return;

    const update = () => {
      const sisa = Math.max(0, Math.round((codeExpiry.getTime() - Date.now()) / 1000));
      setCountdown(sisa);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [codeExpiry, isCodeExpired]);

  const handleCopy = async () => {
    if (!pairingCode) return;
    await navigator.clipboard.writeText(`LINK ${pairingCode}`);
    setCopied(true);
    toast.success("Pesan LINK disalin!");
    setTimeout(() => setCopied(false), 2000);
  };

  const countdownLabel =
    countdown > 0
      ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}`
      : "0:00";

  // ── LOADING STATE ──
  if (statusLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Mengecek status WhatsApp...</span>
      </div>
    );
  }

  // ── SUDAH TERHUBUNG ──
  if (isLinked) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-500 p-2.5 shrink-0">
            <CheckCircle2 className="size-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-900 dark:text-emerald-100">
              WhatsApp Terhubung
            </p>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {phoneNumber || "Nomor tersembunyi"}
              {linkedAt && (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                  · Sejak {formatDistanceToNow(new Date(linkedAt), { addSuffix: true, locale: id })}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          🌾 TaniAI di WhatsApp sudah aktif! Kamu bisa chat langsung dari WhatsApp
          dan AI akan mengenali akunmu secara personal.
        </div>

        {/* Unlink button */}
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200"
          onClick={unlink}
          disabled={isUnlinking}
        >
          {isUnlinking ? (
            <Loader2 className="size-4 animate-spin mr-2" />
          ) : (
            <Link2Off className="size-4 mr-2" />
          )}
          Putuskan WhatsApp
        </Button>
      </div>
    );
  }

  // ── BELUM TERHUBUNG — tampilkan flow pairing ──
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
          <Smartphone className="size-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold">Hubungkan WhatsApp</p>
          <p className="text-sm text-muted-foreground">
            Gunakan TaniAI langsung dari WhatsApp dengan akun ini
          </p>
        </div>
      </div>

      {/* Kode aktif */}
      {pairingCode && !isCodeExpired ? (
        <div className="space-y-3">
          {/* Step guide */}
          <ol className="text-sm text-muted-foreground space-y-1.5 list-none">
            {[
              "Buka WhatsApp di HP kamu",
              `Chat ke nomor bot TaniAI`,
              "Kirim pesan di bawah ini:",
            ].map((step, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          {/* Kode box */}
          <div className="rounded-xl bg-muted border border-dashed border-border p-4">
            <p className="text-xs text-muted-foreground mb-2">Kirim pesan ini ke bot:</p>
            <div className="flex items-center gap-3">
              <code className="text-lg font-mono font-bold tracking-widest text-primary flex-1">
                LINK {pairingCode}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Countdown + refresh */}
          <div className="flex items-center justify-between text-sm">
            <span
              className={cn(
                "text-muted-foreground",
                countdown < 60 && "text-orange-500 font-medium"
              )}
            >
              ⏱ Kode berakhir dalam {countdownLabel}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={refetchStatus}
              className="text-xs"
            >
              <RefreshCw className="size-3 mr-1" />
              Cek status
            </Button>
          </div>
        </div>
      ) : (
        // Belum ada kode / kode expired
        <div className="space-y-3">
          {isCodeExpired && (
            <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-950/20 rounded-lg px-3 py-2">
              <AlertCircle className="size-4 shrink-0" />
              Kode sebelumnya sudah kedaluwarsa. Generate kode baru.
            </div>
          )}

          <div className="text-sm text-muted-foreground space-y-1">
            <p>Cara menghubungkan:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground/80">
              <li>Klik tombol di bawah untuk buat kode pairing</li>
              <li>Kirim kode tersebut ke WhatsApp bot TaniAI</li>
              <li>WhatsApp kamu akan langsung terhubung ke akun ini</li>
            </ol>
          </div>

          <Button
            onClick={generateCode}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Link2 className="size-4 mr-2" />
            )}
            {isGenerating ? "Membuat kode..." : "Buat Kode Pairing"}
          </Button>
        </div>
      )}
    </div>
  );
}
