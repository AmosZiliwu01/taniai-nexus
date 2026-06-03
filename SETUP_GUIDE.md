# 🌾 TaniAI Nexus — Panduan Setup Database untuk Juri

Dokumen ini menjelaskan cara setup database Supabase dari nol untuk menjalankan project TaniAI Nexus.

---

## 📋 Prasyarat

- Akun Supabase (gratis) di https://supabase.com
- Node.js v18+
- Akun Groq (gratis) di https://console.groq.com

---

## 🚀 LANGKAH 1 — Buat Project Supabase

1. Login ke https://supabase.com
2. Klik **"New Project"**
3. Isi nama project (contoh: `tainai-nexus`)
4. Pilih region terdekat (Singapore direkomendasikan)
5. Set database password yang kuat — **simpan password ini!**
6. Klik **"Create new project"** dan tunggu ~2 menit

---

## 🗄️ LANGKAH 2 — Jalankan Schema SQL

1. Di dashboard Supabase, klik menu **SQL Editor** (ikon database di sidebar kiri)
2. Klik **"New query"**
3. Buka file `schema.sql` yang ada di folder ini
4. **Copy semua isinya** dan paste ke SQL Editor
5. Klik tombol **"Run"** (atau Ctrl+Enter)
6. Tunggu hingga muncul pesan **"Success. No rows returned"**

### ⚠️ Jika ada error:

**Error: "permission denied for table users"**
→ Ini terjadi pada trigger `auth.users`. Scroll ke bawah file schema.sql,
cari bagian `-- TRIGGER AUTH (jalankan terpisah jika error)` dan jalankan
hanya bagian itu di query baru.

**Error: "already exists"**
→ Berarti sebagian sudah terbuat. Klik "New query", jalankan ulang
hanya bagian yang belum ada.

---

## 🔐 LANGKAH 3 — Konfigurasi Authentication

### A. Aktifkan Email Provider

1. Di sidebar kiri, klik **Authentication** → **Providers**
2. Pastikan **Email** sudah enabled (biasanya sudah aktif by default)
3. Aktifkan **"Confirm email"** sesuai kebutuhan

### B. Set URL Konfigurasi

1. Klik **Authentication** → **URL Configuration**
2. Isi **Site URL** dengan URL frontend kamu (contoh: `http://localhost:5173`)
   atau gunakan defauld (`http://localhost:3000`)

### C. Auth Hooks

Tidak diperlukan — fitur OAuth (Facebook/Google login) tidak digunakan
di project ini. Bagian Auth Hooks di dashboard bisa dibiarkan kosong.

---

## 🔑 LANGKAH 4 — Ambil API Keys

1. Di sidebar kiri, klik **Settings** (ikon gear) → **API**
2. Catat nilai berikut:

| Key                         | Lokasi di Dashboard                              |
| --------------------------- | ------------------------------------------------ |
| `SUPABASE_URL`              | Project URL (contoh: `https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY`         | `anon` / `public` key                            |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key ⚠️ Jangan expose ke frontend! |

---

## 🤖 LANGKAH 5 — Dapatkan Groq API Key

1. Buka https://console.groq.com
2. Login / Register (gratis)
3. Klik **"API Keys"** → **"Create API Key"**
4. Copy key yang dihasilkan (format: `gsk_...`)

---

## ⚙️ LANGKAH 6 — Setup File .env

### Untuk Frontend (Vite/React): Project taniai-nexus

Buat file `.env`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key

# AI Configuration - Fallback (Grok / xAI)
VITE_GROK_API_KEY=your-grok-api-key
VITE_GROQ_API_KEY_FB=your-groq-api-key-for-fb

# API URL
VITE_API_URL_LOCAL=http://localhost:8000

# OpenWeather API Configuration
VITE_OPENWEATHER_API_URL=https://api.openweathermap.org/data/2.5
VITE_OPENWEATHER_API_KEY=your-openweather-api-key
```

### Untuk Backend API (`/backend` atau root folder server): taniai-api

Buat file `.env` (copy dari `.env_example`):

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Groq AI
GROQ_API_KEY=your-groq-api-key

# Server
PORT=3000

# Origin
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080,http://192.168.50.96:8080,

# Internal API key untuk komunikasi bot WA ke server
INTERNAL_API_KEY=your-internal-api-key (example: taniai_lomba_01)
```

### Untuk WhatsApp Bot (`/whatsapp-bot` atau folder bot): taniai-whatsapp

Buat file `.env`:

```env
API_URL=http://localhost:3000
INTERNAL_API_KEY=sama-dengan-yang-di-backend (example: taniai_lomba_01)
```

---

## 👑 LANGKAH 7 — Set Akun Admin

Setelah berhasil register akun pertama kali lewat aplikasi:

1. Konfirmasi Email
2. Buka **SQL Editor** di Supabase
3. Jalankan query berikut (ganti email dengan email yang kamu daftarkan):

```sql
UPDATE public.user_roles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM public.profiles
  WHERE email = 'email-kamu@example.com'
);
```

Atau ubah lewat tabel user_roles

4. Logout dan login ulang di aplikasi agar role terupdate

---

## 📦 LANGKAH 8 — Install & Jalankan Aplikasi

### Backend API: Project taniai-api

```bash
cd backend   # atau folder server
npm install
npm start
# Server berjalan di http://localhost:3000
```

### Frontend: Project taniai-nexus

```bash
cd frontend  # atau folder client
npm install
npm run dev
# Frontend berjalan di http://localhost:5173
```

### WhatsApp Bot (opsional): Project taniai-whatsapp

```bash
cd whatsapp-bot
npm install
npm start
# Scan QR code yang muncul di terminal dengan WhatsApp
```

---

## 🗂️ Struktur Database

Project ini menggunakan **17 tabel** di Supabase:

| Tabel                | Fungsi                                  |
| -------------------- | --------------------------------------- |
| `profiles`           | Data profil user                        |
| `user_roles`         | Role user (admin/user/blocked)          |
| `user_plants`        | Data tanaman milik user                 |
| `plant_diagnoses`    | Riwayat diagnosa penyakit tanaman       |
| `articles`           | Artikel pertanian                       |
| `article_categories` | Kategori artikel                        |
| `community_posts`    | Postingan komunitas                     |
| `community_comments` | Komentar pada postingan                 |
| `post_likes`         | Like pada postingan                     |
| `comment_likes`      | Like pada komentar                      |
| `content_reports`    | Laporan konten melanggar                |
| `notifications`      | Notifikasi in-app & WhatsApp            |
| `whatsapp_links`     | Link akun ke nomor WhatsApp             |
| `whatsapp_chats`     | Riwayat chat via WhatsApp               |
| `pairing_codes`      | Kode pairing WhatsApp (berlaku 5 menit) |
| `ai_conversations`   | Sesi percakapan AI                      |
| `ai_messages`        | Pesan dalam percakapan AI               |

---

## 🪣 Storage Buckets

| Bucket      | Kegunaan                    | Maks. Ukuran   |
| ----------- | --------------------------- | -------------- |
| `avatars`   | Foto profil user            | 2 MB           |
| `diagnoses` | Foto tanaman untuk diagnosa | 5 MB           |
| `community` | Gambar postingan komunitas  | 5 MB           |
| `articles`  | Gambar artikel              | 50 MB          |
| `whatsapp`  | File dari WhatsApp          | Tidak terbatas |
| `qr-codes`  | QR code pairing             | Tidak terbatas |
| `assets`    | Aset umum                   | Tidak terbatas |

---

## ❓ FAQ

**Q: Apakah perlu kartu kredit untuk Supabase?**
A: Tidak. Tier gratis Supabase sudah cukup untuk demo/review.

**Q: Apakah perlu setup Auth Hooks?**
A: Tidak. Fitur OAuth (Facebook/Google) tidak digunakan di project ini,
jadi bagian Auth Hooks di dashboard bisa dibiarkan kosong.

**Q: Apakah WhatsApp bot wajib dijalankan?**
A: Tidak wajib. Aplikasi web tetap bisa berjalan penuh tanpa bot WhatsApp.
Bot hanya diperlukan untuk fitur chat via WhatsApp dan notifikasi WA.

**Q: Model AI apa yang dipakai?**
A: Groq API dengan model `llama-3.3-70b-versatile` untuk teks dan
`meta-llama/llama-4-scout-17b-16e-instruct` untuk analisis gambar tanaman.

**Q: Apakah data demo tersedia?**
A: Tidak disertakan. Silakan register akun baru dan coba fitur-fiturnya
langsung dari aplikasi.

---

## 🆘 Butuh Bantuan?

Jika ada kendala setup, silakan hubungi pengembang:
**Amos Aleksiato Ziliwu** — Mahasiswa Informatika, Universitas Kristen Immanuel Yogyakarta

⚠️ Catatan Penting (WA Pairing Lokal vs Deploy)
Untuk fitur WhatsApp Pairing (LINK code), pastikan:
🧪 Saat Testing / Development (Localhost)
Gunakan aplikasi lokal:
http://localhost:8080

Pastikan:
Login dan register dilakukan dari localhost
API backend juga berjalan di local environment yang sama
Supabase project yang digunakan sesuai konfigurasi local

🚀 Saat Production (Deploy / Online)dengan local yang baru kamu buatkan
Gunakan:
https://tani-ai-nexus.vercel.app/

❗ Penting
Jangan melakukan registrasi di production (Vercel link) saat pertama kali setup jika:
Database / Auth masih menggunakan konfigurasi lokal
Supabase project berbeda antara local dan production
Token/session tidak sinkron

👉 Hal ini bisa menyebabkan:
pairing WhatsApp gagal
session tidak terbaca
error 401 Unauthorized

👋 Halo! Saya TaniAINexus.
Untuk menggunakan layanan ini, kamu perlu menghubungkan WhatsApp ke akun TaniAINexus:
1️⃣ Buka https://tani-ai-nexus.vercel.app/ kemudian register atau login
2️⃣ Masuk ke menu Profil → Hubungkan WhatsApp
3️⃣ Salin kode yang muncul (contoh: TANI-483921)
4️⃣ Kirim pesan: LINK TANI-483921 ke sini

Setelah terhubung, kamu bisa tanya apa saja seputar pertanian! 🌾
