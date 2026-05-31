import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/404")({
  head: () => ({
    meta: [
      { title: "Halaman Tidak Ditemukan — TaniAI Nexus" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NotFound,
});

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold mt-4">Halaman Tidak Ditemukan</h2>
        <p className="text-muted-foreground mt-2">Maaf, halaman yang Anda cari tidak ada.</p>
        <a href="/" className="mt-6 inline-block text-primary hover:underline">← Kembali ke Beranda</a>
      </div>
    </div>
  );
}