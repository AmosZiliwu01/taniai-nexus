// src/hooks/useWhatsappLink.ts
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Ambil JWT token dari Supabase session
async function getToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Cek status linking WhatsApp
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

// Generate pairing code baru
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

// Putuskan WhatsApp dari akun
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

// Hook untuk manage status WhatsApp linking
export function useWhatsappLink() {
  const qc = useQueryClient();
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry] = useState<Date | null>(null);

  const {
    data: linkStatus,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["wa-link-status"],
    queryFn: fetchLinkStatus,
    refetchInterval: pairingCode ? 5000 : false,
    staleTime: 0,
  });

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

  const isCodeExpired = codeExpiry ? new Date() > codeExpiry : false;
  if (isCodeExpired && pairingCode) {
    setPairingCode(null);
    setCodeExpiry(null);
  }

  return {
    isLinked: linkStatus?.linked ?? false,
    phoneNumber: linkStatus?.phoneNumber ?? null,
    linkedAt: linkStatus?.linkedAt ?? null,
    statusLoading,
    refetchStatus,

    pairingCode: isCodeExpired ? null : pairingCode,
    codeExpiry,
    isCodeExpired,
    generateCode: () => generateMutation.mutate(),
    isGenerating: generateMutation.isPending,

    unlink: () => unlinkMutation.mutate(),
    isUnlinking: unlinkMutation.isPending,
  };
}
