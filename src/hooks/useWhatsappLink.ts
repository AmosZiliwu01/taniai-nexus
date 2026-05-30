// src/hooks/useWhatsappLink.ts
// Hook untuk manage status WhatsApp linking dari web

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// ── Helper: get JWT token dari Supabase session ───────────────
async function getToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ── API calls ─────────────────────────────────────────────────
async function fetchLinkStatus() {
  const token = await getToken();
  if (!token) throw new Error("Tidak terautentikasi");

  const res = await fetch(`${API_URL}/api/pairing/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("Gagal cek status");
  return res.json() as Promise<{
    success: boolean;
    linked: boolean;
    phoneNumber?: string;
    linkedAt?: string;
  }>;
}

async function generateCode() {
  const token = await getToken();
  if (!token) throw new Error("Tidak terautentikasi");

  const res = await fetch(`${API_URL}/api/pairing/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) throw new Error("Gagal generate kode");
  return res.json() as Promise<{
    success: boolean;
    code: string;
    expiresInMinutes: number;
    instruction: string;
  }>;
}

async function unlinkWA() {
  const token = await getToken();
  if (!token) throw new Error("Tidak terautentikasi");

  const res = await fetch(`${API_URL}/api/pairing/unlink`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("Gagal unlink");
  return res.json();
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

export function useWhatsappLink() {
  const qc = useQueryClient();
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry]   = useState<Date | null>(null);

  // Fetch status linking
  const {
    data: linkStatus,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["wa-link-status"],
    queryFn: fetchLinkStatus,
    refetchInterval: pairingCode ? 5000 : false, // poll tiap 5 detik saat kode aktif
    staleTime: 0,
  });

  // Generate pairing code
  const generateMutation = useMutation({
    mutationFn: generateCode,
    onSuccess: (data) => {
      setPairingCode(data.code);
      setCodeExpiry(new Date(Date.now() + data.expiresInMinutes * 60 * 1000));
      toast.success("Kode berhasil dibuat! Kirim ke WhatsApp bot.");
    },
    onError: () => {
      toast.error("Gagal membuat kode pairing.");
    },
  });

  // Unlink WhatsApp
  const unlinkMutation = useMutation({
    mutationFn: unlinkWA,
    onSuccess: () => {
      setPairingCode(null);
      setCodeExpiry(null);
      qc.invalidateQueries({ queryKey: ["wa-link-status"] });
      toast.success("WhatsApp berhasil diputuskan dari akun.");
    },
    onError: () => {
      toast.error("Gagal memutuskan WhatsApp.");
    },
  });

  // Cek apakah kode sudah expired
  const isCodeExpired = codeExpiry ? new Date() > codeExpiry : false;
  if (isCodeExpired && pairingCode) {
    setPairingCode(null);
    setCodeExpiry(null);
  }

  return {
    // Status
    isLinked:     linkStatus?.linked ?? false,
    phoneNumber:  linkStatus?.phoneNumber ?? null,
    linkedAt:     linkStatus?.linkedAt ?? null,
    statusLoading,
    refetchStatus,

    // Pairing code
    pairingCode:    isCodeExpired ? null : pairingCode,
    codeExpiry,
    isCodeExpired,
    generateCode:   () => generateMutation.mutate(),
    isGenerating:   generateMutation.isPending,

    // Unlink
    unlink:     () => unlinkMutation.mutate(),
    isUnlinking: unlinkMutation.isPending,
  };
}
