import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Halaman tidak ditemukan</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Halaman yang Anda cari tidak tersedia.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Ke beranda
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Halaman gagal dimuat</h1>
        <p className="mt-2 text-sm text-muted-foreground">Coba muat ulang halaman.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Coba lagi
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      
      // Title & Description
      { title: "TaniAI Nexus — Platform AI Pertanian Indonesia" },
      { name: "description", content: "Platform AI pertanian terlengkap: diagnosis tanaman dari foto, asisten AI 24/7, cuaca real-time, komunitas petani, dan edukasi. Gratis untuk petani Indonesia!" },
      { name: "keywords", content: "pertanian, AI, diagnosa tanaman, penyakit tanaman, petani Indonesia, asisten pertanian, cuaca pertanian, komunitas petani" },
      { name: "author", content: "TaniAI Nexus" },
      
      // Open Graph (WhatsApp, Facebook, Telegram)
      { property: "og:title", content: "TaniAI Nexus — Platform AI Pertanian Indonesia" },
      { property: "og:description", content: "Diagnosis penyakit tanaman dari foto dengan AI. Gratis untuk petani Indonesia!" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://tani-ai-nexus.vercel.app" },
      { property: "og:image", content: "https://tani-ai-nexus.vercel.app/og-image.jpg" },
      { property: "og:image:alt", content: "TaniAI Nexus — AI untuk Petani Indonesia" },
      
      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "TaniAI Nexus — Platform AI Pertanian Indonesia" },
      { name: "twitter:description", content: "Diagnosis penyakit tanaman dari foto dengan AI. Gratis!" },
      { name: "twitter:image", content: "https://tani-ai-nexus.vercel.app/og-image.jpg" },
      
      // Robots & Canonical
      { name: "robots", content: "index, follow" },
      { name: "googlebot", content: "index, follow" },
    ],
    links: [
      { rel: "canonical", href: "https://tani-ai-nexus.vercel.app" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function AuthSync() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, qc]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>
        <AuthSync />
        <Outlet />
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
