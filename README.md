# TaniAI Nexus — Platform AI Pertanian Indonesia

Platform AI lengkap untuk petani Indonesia: diagnosis tanaman, asisten AI, cuaca, marketplace, dan analytics.

## Tech Stack

- **Frontend**: React 19 + Vite 7 + TypeScript
- **Routing**: TanStack Router v1
- **State**: TanStack Query v5
- **UI**: shadcn/ui + Radix UI + Tailwind CSS v4
- **Auth + DB**: Supabase
- **AI**: Gemini (primary) + Grok (fallback)

## Setup Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.local.example` → `.env.local` dan isi dengan key Anda:

```bash
cp .env.local.example .env.local
```

```env
# Supabase (wajib)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key

# AI - minimal salah satu (Gemini direkomendasikan)
VITE_GEMINI_API_KEY=your-gemini-api-key
VITE_GROK_API_KEY=your-grok-api-key
```

**Mendapatkan API keys:**
- **Gemini**: https://aistudio.google.com/apikey
- **Grok**: https://console.x.ai/
- **Supabase**: https://supabase.com/dashboard

### 3. Jalankan development server

```bash
npm run dev
```

Buka http://localhost:8080

### 4. Build production

```bash
npm run build
npm run preview
```

## Struktur Project

```
src/
├── assets/              # Static assets (gambar, dll)
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── AppShell.tsx     # Layout utama (sidebar + header)
│   └── Logo.tsx
├── hooks/               # Custom React hooks
├── integrations/
│   └── supabase/        # Supabase client & types
├── lib/
│   ├── ai.functions.ts  # High-level AI functions (diagnose, chat, soil)
│   └── utils.ts
├── routes/              # TanStack Router file-based routes
│   ├── __root.tsx       # Root layout
│   ├── index.tsx        # Landing page (/)
│   ├── login.tsx        # /login
│   ├── register.tsx     # /register
│   └── _authenticated/  # Protected routes (require login)
│       ├── dashboard.tsx
│       ├── plant-doctor.tsx
│       ├── assistant.tsx
│       ├── weather.tsx
│       ├── soil.tsx
│       ├── marketplace.tsx
│       ├── analytics.tsx
│       ├── calendar.tsx
│       ├── articles.tsx
│       ├── profile.tsx
│       └── admin.tsx
├── services/
│   └── ai/
│       ├── aiService.ts         # Abstraction layer (Gemini → Grok fallback)
│       └── providers/
│           ├── gemini.ts        # Google Gemini API
│           └── grok.ts          # xAI Grok API
├── styles.css           # Tailwind v4 + tema warna
└── main.tsx             # Entry point
```

## Arsitektur AI

```
lib/ai.functions.ts
       ↓
services/ai/aiService.ts  ← abstraction layer dengan retry
       ↓              ↓
providers/gemini.ts  providers/grok.ts
  (primary)          (fallback otomatis)
```

- Jika `VITE_GEMINI_API_KEY` ada → pakai Gemini dulu
- Jika Gemini gagal/rate limit → fallback ke Grok
- Jika `VITE_GEMINI_API_KEY` tidak ada → langsung pakai Grok
- Auto-retry 2x dengan exponential backoff

## Fitur Utama

| Halaman | Fitur |
|---------|-------|
| `/` | Landing page publik |
| `/dashboard` | Ringkasan kondisi pertanian |
| `/plant-doctor` | Diagnosis penyakit via foto (AI Vision) |
| `/assistant` | Chat AI pertanian 24/7 |
| `/weather` | Prediksi cuaca & peringatan |
| `/soil` | Analisis tanah + rekomendasi pupuk |
| `/marketplace` | Jual hasil panen |
| `/analytics` | Analytics kesehatan tanaman |
| `/calendar` | Kalender tanam |
| `/articles` | Artikel edukasi pertanian |

## Migrasi dari Lovable

Yang dihapus/diganti:
- ❌ `ai.gateway.lovable.dev` → ✅ Gemini API langsung
- ❌ `VITE_LOVABLE_API_KEY` → ✅ `VITE_GEMINI_API_KEY` + `VITE_GROK_API_KEY`
- ❌ Cloudflare Workers SSR → ✅ Pure Vite SPA
- ❌ Lovable OG image CDN → ✅ Tidak ada external branding
- ❌ `@cloudflare/vite-plugin` → ✅ Dihapus dari dependencies
"# TaniAiNexus" 
"# TaniAiNexus" 
"# TaniAiNexus" 
