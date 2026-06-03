# 🌾 TaniAI Nexus — Platform AI Pertanian Indonesia

> Platform AI pertanian full-stack: diagnosa penyakit tanaman, asisten AI, cuaca real-time, komunitas petani, dan integrasi WhatsApp Bot.

---

## 📁 Struktur Folder Project

```
TaniAI-Project/
├── TaniAiNexus/        # Frontend Web (React + Vite)
├── TaniAIAPI/          # Backend API (Express.js + Groq AI)
└── TaniAIWhatsApp/     # WhatsApp Bot (Baileys)
```

---

## 🚀 Fitur Utama

- **Diagnosa Tanaman AI** — Upload foto, AI menganalisa penyakit via Groq (LLaMA Vision)
- **AI Assistant** — Chat pertanian 24/7 dengan konteks data user
- **WhatsApp Bot AI** — Terhubung langsung dari WA, termasuk kirim foto diagnosa
- **Cuaca Real-time** — Prakiraan + peringatan dini berbasis OpenWeatherMap
- **Harga Pasar** — Data komoditas dari Panel Harga Pangan BPN (via Supabase Edge Function)
- **Komunitas Petani** — Post, komentar, like, laporan konten, moderasi admin
- **Manajemen Tanaman** — Catatan, status, umur HST, saran AI personal
- **Artikel Edukasi** — CMS artikel dengan rich text editor (admin)
- **Notifikasi Real-time** — In-app + via WhatsApp

---

## 🛠️ Tech Stack

| Layer         | Teknologi                                                  |
| ------------- | ---------------------------------------------------------- |
| Frontend      | React 19, TanStack Router, TanStack Query, Tailwind CSS v4 |
| Backend API   | Node.js, Express.js                                        |
| WhatsApp Bot  | Baileys (@whiskeysockets/baileys)                          |
| Database      | Supabase (PostgreSQL + Auth + Storage + Realtime)          |
| AI Model      | Groq API (LLaMA 3.3 70B, LLaMA 4 Scout Vision, Qwen3-32B)  |
| Edge Function | Supabase Edge Function (Deno) — harga pasar                |
| Cuaca         | OpenWeatherMap API                                         |
| Build Tool    | Vite 7                                                     |

---

## ⚙️ Persiapan: Setup Supabase

> **Ini langkah pertama sebelum menjalankan apapun.**

### 1. Buat Project di Supabase

1. Buka [https://supabase.com](https://supabase.com) → buat project baru
2. Catat: **Project URL**, **anon key**, dan **service_role key**

### 2. Import Database Schema

1. Di dashboard Supabase → klik **SQL Editor**
2. Buka file `backup.sql` (ada di root repo atau diberikan terpisah)
3. Paste seluruh isi file → klik **Run**
4. Tunggu hingga selesai — semua tabel, fungsi, trigger, dan RLS akan terbuat otomatis

### 3. Setup Storage Bucket

Di **Storage** → buat bucket berikut (semua **public**):

- `avatars`
- `diagnoses`
- `community`
- `articles`
- `assets`

### 4. Deploy Edge Function (Harga Pasar)

```bash
# Install Supabase CLI
npm install -g supabase

# Login & link project
supabase login
supabase link --project-ref <PROJECT_REF>

# Deploy edge function
supabase functions deploy market-prices
```

> File edge function ada di `TaniAiNexus/supabase/functions/market-prices/index.ts`

---

## 🖥️ 1. TaniAiNexus — Frontend Web

### Prasyarat

- Node.js >= 18
- NPM atau Yarn

### Instalasi

```bash
cd TaniAiNexus
npm install
```

### Konfigurasi `.env`

Buat file `.env` di folder `TaniAiNexus/`:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key

# Groq AI (untuk diagnosa & chat di frontend)
VITE_GROK_API_KEY=your-groq-api-key
VITE_GROQ_API_KEY_FB=your-groq-fallback-key   # opsional, fallback jika rate limit

# URL Backend API
VITE_API_URL=http://localhost:3000

# OpenWeather
VITE_OPENWEATHER_API_URL=https://api.openweathermap.org/data/2.5
VITE_OPENWEATHER_API_KEY=your-openweather-api-key
```

### Jalankan

```bash
npm run dev
# Buka http://localhost:8080
```

### Build Production

```bash
npm run build
```

---

## 🔧 2. TaniAIAPI — Backend API

Backend Express.js yang melayani: autentikasi WA, pairing code, AI chat WA, dan polling notifikasi.

### Instalasi

```bash
cd TaniAIAPI
npm install
```

### Konfigurasi `.env`

Buat file `.env` di folder `TaniAIAPI/`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Groq AI
GROQ_API_KEY=your-groq-api-key

# Server
PORT=3000

# CORS — origins yang diizinkan (pisah koma)
ALLOWED_ORIGINS=http://localhost:8080

# Internal API Key (untuk komunikasi bot WA ke server)
INTERNAL_API_KEY=your-random-secret-key
```

### Jalankan

```bash
# Development (auto-restart)
npm run dev

# Production
npm start
# API berjalan di http://localhost:3000
```

---

## 📱 3. TaniAIWhatsApp — WhatsApp Bot

Bot WhatsApp berbasis Baileys yang meneruskan pesan ke TaniAIAPI.

### Instalasi

```bash
cd TaniAIWhatsApp
npm install
```

### Konfigurasi `.env`

Buat file `.env` di folder `TaniAIWhatsApp/`:

```env
# URL Backend API (harus sama dengan yang dijalankan di TaniAIAPI)
API_URL=http://localhost:3000

# Internal API Key (harus sama dengan di TaniAIAPI)
INTERNAL_API_KEY=your-random-secret-key
```

### Jalankan & Scan QR

```bash
npm start
```

> Akan muncul QR code di terminal. Scan dengan WhatsApp di HP (WhatsApp → Perangkat Tertaut → Tautkan Perangkat).

Setelah scan, bot aktif dan siap menerima pesan.

---

## 🔄 Cara Kerja Sistem (Flow)

```
[User Web]                    [User WhatsApp]
    │                               │
    ▼                               ▼
[TaniAiNexus]           [TaniAIWhatsApp Bot]
 (React SPA)              (Baileys + Node)
    │                               │
    │ Auth via Supabase             │ POST /api/chat
    │ AI langsung ke Groq           ▼
    │                         [TaniAIAPI]
    │                      (Express.js Server)
    │                               │
    ▼                               ▼
[Supabase]  ◄─────────────  [Groq AI API]
 DB + Auth                  (LLaMA Vision/Text)
 Storage
 Realtime
```

**Flow Pairing WhatsApp:**

1. User login di web → Profil → Buat Kode Pairing
2. Frontend `POST /api/pairing/generate` → backend simpan kode ke tabel `pairing_codes`
3. User kirim `LINK TANI-XXXXXX` ke bot WA
4. Bot WA teruskan ke `POST /api/chat` → backend validasi kode → link nomor ke akun
5. Setelah terhubung, semua chat WA bisa mengakses data personal user

---

## 🗄️ Database (Tabel Utama)

| Tabel                | Fungsi                                               |
| -------------------- | ---------------------------------------------------- |
| `profiles`           | Data profil user (nama, lokasi, tipe petani, avatar) |
| `user_roles`         | Role user: `admin`, `user`, `blocked`                |
| `user_plants`        | Tanaman yang didaftarkan user                        |
| `plant_diagnoses`    | Riwayat diagnosa AI per user                         |
| `ai_conversations`   | Sesi chat AI                                         |
| `ai_messages`        | Pesan dalam sesi chat                                |
| `community_posts`    | Postingan komunitas                                  |
| `community_comments` | Komentar + balasan (nested)                          |
| `post_likes`         | Like postingan                                       |
| `comment_likes`      | Like komentar                                        |
| `content_reports`    | Laporan konten oleh user                             |
| `articles`           | Artikel edukasi                                      |
| `article_categories` | Kategori artikel                                     |
| `notifications`      | Notifikasi in-app + WA                               |
| `whatsapp_links`     | Mapping user_id ↔ nomor WA                           |
| `whatsapp_chats`     | Riwayat chat via WA                                  |
| `pairing_codes`      | Kode sementara untuk pairing WA                      |

> Semua tabel menggunakan Row Level Security (RLS). Schema lengkap ada di `backup.sql`.

---

## 📋 Urutan Menjalankan Lokal

```
1. Setup Supabase (import backup.sql)
2. Jalankan TaniAIAPI   → npm run dev  (port 3000)
3. Jalankan TaniAiNexus → npm run dev  (port 8080)
4. Jalankan TaniAIWhatsApp → npm start  (scan QR)
```

> TaniAiNexus dan TaniAIWhatsApp **tidak saling bergantung**, keduanya bergantung ke **TaniAIAPI** dan **Supabase**.

---

## 🌐 Deployment

### Frontend (Vercel)

```bash
# Di folder TaniAiNexus
vercel deploy
```

Konfigurasi `vercel.json` sudah tersedia (SPA redirect).

### Backend API (Railway / Render)

- Deploy folder `TaniAIAPI` sebagai Node.js service
- Set semua environment variable di dashboard

### WhatsApp Bot

- Deploy `TaniAIWhatsApp` di VPS/server yang berjalan terus
- Update `API_URL` ke URL production TaniAIAPI

---

## 🔑 Mendapatkan API Keys

| Key                 | Sumber                                                                    |
| ------------------- | ------------------------------------------------------------------------- |
| Groq API Key        | [https://console.groq.com](https://console.groq.com) — gratis             |
| OpenWeather API Key | [https://openweathermap.org/api](https://openweathermap.org/api) — gratis |
| Supabase Keys       | Dashboard project Supabase → Settings → API                               |

---

## 📌 Catatan Penting

- **Admin pertama** harus diset manual di tabel `user_roles` dengan `role = 'admin'`
- **Kode pairing WA** berlaku 5 menit, batas chat WA 15 pesan/hari per user
- Edge function `market-prices` hanya berjalan jika sudah di-deploy ke Supabase
- Jika Groq rate limit, sistem otomatis fallback ke model/key cadangan

---

<p align="center">Dibuat untuk petani Indonesia 🌾 | TaniAI Nexus © 2026</p>
