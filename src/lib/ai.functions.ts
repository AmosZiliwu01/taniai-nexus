import { callAIWithRetry, type AIMessage } from "@/services/ai/aiService";
import { z } from "zod";

// ==================== CHAT AI (HEMAT TOKEN) ====================
const FARMING_SYSTEM_PROMPT = `Anda TaniAI, asisten pertanian Indonesia. Jawab singkat maks 3 kalimat. Gunakan - untuk poin, ** untuk produk. Jika ditanya di luar pertanian, tolak sopan.`;

export interface ChatContext {
  userLocation?: string;
  weatherSummary?: string;
  userPlants?: string[];
  recentDiagnoses?: string[];
}

export async function chatAI(input: {
  messages: { role: "user" | "assistant"; content: string }[];
  context?: ChatContext;
}) {
  const parsed = z.object({
    messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) })),
    context: z.object({
      userLocation: z.string().optional(),
      weatherSummary: z.string().optional(),
      userPlants: z.array(z.string()).optional(),
      recentDiagnoses: z.array(z.string()).optional(),
    }).optional(),
  }).parse(input);

  let contextBlock = "";
  if (parsed.context) {
    const parts = [];
    if (parsed.context.userLocation) parts.push(`Lokasi: ${parsed.context.userLocation}`);
    if (parsed.context.weatherSummary) parts.push(`Cuaca: ${parsed.context.weatherSummary}`);
    if (parsed.context.userPlants?.length) parts.push(`Tanaman: ${parsed.context.userPlants.join(", ")}`);
    if (parts.length) contextBlock = `\nDATA REAL-TIME:\n${parts.join("\n")}`;
  }
  const systemPrompt = FARMING_SYSTEM_PROMPT + contextBlock;
  const messages: AIMessage[] = parsed.messages.map(m => ({ role: m.role, content: m.content }));
  const content = await callAIWithRetry({ messages, systemPrompt, maxTokens: 300 });
  return { content };
}

// ==================== DIAGNOSIS (VERSI LENGKAP DARI CODE LAMA) ====================
const DIAGNOSIS_SYSTEM_PROMPT = `Anda adalah ahli patologi tanaman senior untuk pertanian Indonesia.
Analisis gambar dan data konteks dengan SANGAT TELITI dan KRITIS.

ATURAN KERAS — WAJIB DIIKUTI:
- Jika gambar BUKAN tanaman → is_plant_image: false
- JANGAN pernah langsung bilang "tanaman sehat" jika ada deskripsi masalah dari user
- Jika gambar blur/tidak jelas TAPI user memberikan deskripsi masalah → GUNAKAN deskripsi user sebagai dasar diagnosis
- Prioritaskan deskripsi masalah dan gejala dari user LEBIH dari visual jika gambar kualitasnya rendah
- Jika ada tanda kerusakan sekecil apapun → diagnosa dengan SERIUS, jangan dismiss
- Confidence rendah (< 60%) → jujur, jangan ngarang diagnosis positif palsu
- JANGAN mengarang diagnosis — lebih baik "tidak pasti" daripada salah yakin
- Jawab HANYA dalam format JSON valid tanpa teks tambahan apapun
- Selalu cek semua data konteks: jenis tanaman, bagian tanaman, deskripsi masalah, gejala, durasi, tingkat keparahan

PENDEKATAN DIAGNOSIS:
1. Apakah ini gambar tanaman? → cek is_plant_image
2. Identifikasi tanaman di gambar secara visual
3. Bandingkan dengan input user (jenis tanaman, bagian tanaman)
4. Analisis semua indikator kerusakan di gambar
5. Gabungkan dengan deskripsi masalah dan gejala dari user
6. Berikan diagnosis berdasarkan SEMUA konteks, bukan hanya visual
7. Jika gambar blur → gunakan deskripsi user, turunkan confidence, minta foto ulang jika perlu`;

export interface DiagnosisInput {
  imageBase64: string;
  plantType?: string;
  partType?: string;
  plantAge?: number;
  soilCondition?: string;
  weatherCondition?: string;
  location?: string;
  problemDescription?: string;
  symptoms?: string[];
  duration?: string;
  userSeverity?: string;
}

export interface DiagnosisResult {
  is_plant_image: boolean;
  detected_plant?: string;
  plant_match?: boolean;
  plant_match_confidence?: number;
  mismatch_warning?: string;
  diagnosis: string;
  confidence: number;
  severity: "Ringan" | "Sedang" | "Berat" | "Tidak Diketahui";
  severity_score: number;
  cause: string;
  cause_detail?: string;
  description: string;
  symptoms?: string[];
  initial_action: string;
  solution: string;
  follow_up: string;
  fertilizer?: string;
  pesticide?: string;
  recovery_days?: number;
  weather_note?: string;
  confidence_note?: string;
}

export async function diagnosePlant(input: DiagnosisInput): Promise<{ diagnosis: DiagnosisResult }> {
  const data = z.object({
    imageBase64: z.string().min(50),
    plantType: z.string().optional(),
    partType: z.string().optional(),
    plantAge: z.number().optional(),
    soilCondition: z.string().optional(),
    weatherCondition: z.string().optional(),
    location: z.string().optional(),
    problemDescription: z.string().optional(),
    symptoms: z.array(z.string()).optional(),
    duration: z.string().optional(),
    userSeverity: z.string().optional(),
  }).parse(input);

  const contextLines = [
    data.plantType ? `Jenis tanaman yang dipilih user: ${data.plantType}` : null,
    data.partType ? `Bagian tanaman yang difoto: ${data.partType}` : null,
    data.plantAge ? `Umur tanaman: ${data.plantAge} hari` : null,
    data.soilCondition ? `Kondisi tanah: ${data.soilCondition}` : null,
    data.weatherCondition ? `Kondisi cuaca: ${data.weatherCondition}` : null,
    data.location ? `Lokasi: ${data.location}` : null,
    data.problemDescription ? `⚠️ DESKRIPSI MASALAH DARI USER (PRIORITAS TINGGI): ${data.problemDescription}` : null,
    data.symptoms?.length ? `⚠️ GEJALA YANG DILAPORKAN USER (PRIORITAS TINGGI): ${data.symptoms.join(", ")}` : null,
    data.duration ? `Sudah berlangsung: ${data.duration}` : null,
    data.userSeverity ? `Tingkat keparahan menurut user: ${data.userSeverity}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `
Analisis foto tanaman ini secara profesional dan KRITIS.

DATA KONTEKS:
${contextLines || "Tidak ada data tambahan"}

TUGAS UTAMA:
1. Identifikasi apakah gambar benar-benar tanaman.
2. Identifikasi jenis tanaman berdasarkan visual (daun, batang, buah, dll).
3. Bandingkan hasil identifikasi visual dengan input user.
4. FOKUS ANALISIS pada bagian tanaman yang disebutkan user (partType).
5. Cari SEMUA tanda kerusakan, penyakit, hama, atau anomali.
6. Gunakan deskripsi masalah dan gejala dari user sebagai konteks PENTING.
7. Jika gambar blur/kualitas rendah tapi ada deskripsi masalah → tetap beri diagnosis berdasarkan deskripsi, dengan confidence lebih rendah.
8. JANGAN dismiss masalah dengan bilang "tanaman sehat" jika user melaporkan ada masalah.

ATURAN KHUSUS GAMBAR BLUR / KUALITAS RENDAH:
- Sebutkan kualitas gambar di confidence_note
- Gunakan deskripsi masalah user sebagai landasan utama
- Beri kemungkinan penyakit berdasarkan gejala yang dilaporkan
- Minta upload ulang foto yang lebih jelas di follow_up

RESPONS WAJIB JSON VALID SAJA — tidak ada teks di luar JSON:

{
  "is_plant_image": true,
  "detected_plant": "Cabai",
  "plant_match": true,
  "plant_match_confidence": 90,
  "mismatch_warning": null,
  "diagnosis": "Busuk Buah Antraknosa",
  "confidence": 78,
  "severity": "Sedang",
  "severity_score": 60,
  "cause": "Infeksi jamur Colletotrichum capsici",
  "cause_detail": "Colletotrichum capsici berkembang di kondisi lembap dengan suhu 25-30°C. Spora menyebar melalui percikan air hujan dan serangga.",
  "description": "Buah cabai menunjukkan busuk hitam di ujung buah yang merupakan ciri khas antraknosa. Infeksi biasanya dimulai saat buah masak dan menyebar cepat.",
  "symptoms": ["Busuk hitam di ujung buah", "Lesi cekung berwarna coklat gelap", "Buah rontok sebelum masak"],
  "initial_action": "Segera petik dan buang semua buah yang terinfeksi. Jangan biarkan buah busuk tetap di tanaman atau tanah.",
  "solution": "Semprot fungisida berbahan aktif mankozeb atau propineb setiap 5-7 hari. Pastikan semua bagian buah terkena semprotan. Kurangi kelembapan dengan mengatur jarak tanam dan pemangkasan.",
  "follow_up": "Pantau buah baru yang muncul setiap 2-3 hari. Lakukan rotasi fungisida setiap 2 minggu untuk mencegah resistensi.",
  "fertilizer": "Kalium tinggi untuk menguatkan dinding sel buah: KCl 2g/liter",
  "pesticide": "Mankozeb 80WP 2g/liter atau Propineb 70WP 2g/liter",
  "recovery_days": 14,
  "weather_note": "Kelembapan tinggi dan hujan mempercepat penyebaran antraknosa. Semprotkan fungisida segera setelah hujan berhenti.",
  "confidence_note": null
}`;

  let content = "";
  try {
    content = await callAIWithRetry({
      vision: true,
      systemPrompt: DIAGNOSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: data.imageBase64 } }] }],
      maxTokens: 2000,
    });
  } catch (err) {
    console.error("AI call error:", err);
    return fallbackDiagnosis(data.plantType, data.partType, "Gagal memanggil AI. Periksa koneksi.");
  }

  try {
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.detected_plant && data.plantType && parsed.detected_plant.toLowerCase().trim() !== data.plantType.toLowerCase().trim()) {
      parsed.plant_match = false;
      parsed.mismatch_warning = `Tanaman pada gambar terdeteksi sebagai "${parsed.detected_plant}", tetapi user memilih "${data.plantType}". Diagnosis dilakukan berdasarkan gambar asli.`;
      parsed.confidence = Math.min(Number(parsed.confidence || 70), 65);
      if (!parsed.confidence_note) parsed.confidence_note = "Jenis tanaman pada gambar tidak sesuai dengan pilihan user.";
    } else {
      parsed.plant_match = true;
    }

    if (parsed.is_plant_image === false) {
      parsed.diagnosis = "Gambar bukan tanaman";
      parsed.description = "AI mendeteksi bahwa gambar yang diupload bukan daun, batang, buah, atau bagian tanaman.";
      parsed.confidence = 100;
      parsed.severity = "Tidak Diketahui";
      parsed.severity_score = 0;
    }

    const severityScores = { "Ringan": 30, "Sedang": 60, "Berat": 90, "Tidak Diketahui": 0 };
    parsed.severity_score = severityScores[parsed.severity as keyof typeof severityScores] || 0;

    return { diagnosis: parsed as DiagnosisResult };
  } catch (error) {
    console.error("Diagnosis parse error:", error, "Raw content:", content);
    return fallbackDiagnosis(data.plantType, data.partType, "AI gagal memproses foto. Pastikan gambar fokus, tidak buram, dan cukup terang.");
  }
}

function fallbackDiagnosis(plantType?: string, partType?: string, customMessage?: string): Promise<{ diagnosis: DiagnosisResult }> {
  const plant = plantType || "Tanaman";
  const part = partType ? ` bagian ${partType}` : "";
  return Promise.resolve({
    diagnosis: {
      is_plant_image: true,
      detected_plant: plantType,
      plant_match: true,
      diagnosis: "Analisis Gagal",
      confidence: 0,
      severity: "Tidak Diketahui",
      severity_score: 0,
      cause: "Foto tidak memadai",
      description: customMessage || `Foto ${plant}${part} tidak dapat dianalisis. Pastikan gambar jelas, fokus, dan cukup terang. Foto dari jarak dekat area yang bermasalah.`,
      initial_action: "Ambil ulang foto dengan pencahayaan baik dan kamera stabil.",
      solution: "Dekatkan kamera ke area yang sakit, hindari bayangan, pastikan fokus tajam.",
      follow_up: "Jika tetap gagal, konsultasikan ke PPL setempat.",
      confidence_note: "Analisis gagal karena kualitas gambar tidak memadai.",
    },
  });
}

// ==================== REKOMENDASI & PERINGATAN (DARI CODE LAMA) ====================
export interface PlantContext {
  name: string;
  type: string;
  ageDays: number;
  soilCondition: string;
  location?: string;
}

export async function getContextualRecommendations(input: {
  plants: PlantContext[];
  weatherSummary?: string;
  recentDiagnoses?: string[];
  userLocation?: string;
}): Promise<{ recommendations: string[] }> {
  if (input.plants.length === 0) return { recommendations: [] };

  const plantList = input.plants.map(p => `${p.name} (${p.ageDays} HST, tanah: ${p.soilCondition})`).join(", ");
  const prompt = `Berikan 3-4 rekomendasi pertanian yang SPESIFIK dan ACTIONABLE untuk petani ini.

DATA:
Tanaman: ${plantList}
Cuaca: ${input.weatherSummary ?? "tidak diketahui"}
Lokasi: ${input.userLocation ?? "tidak diketahui"}
Diagnosa terbaru: ${input.recentDiagnoses?.join("; ") ?? "tidak ada"}

Berikan JSON SAJA:
{
  "recommendations": [
    "rekomendasi 1 yang spesifik dan bisa langsung dilakukan",
    "rekomendasi 2",
    "rekomendasi 3"
  ]
}`;

  const content = await callAIWithRetry({
    systemPrompt: FARMING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 300,
  });

  try {
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return { recommendations: parsed.recommendations ?? [] };
  } catch {
    return { recommendations: [] };
  }
}

export async function getDiseaseWarnings(input: {
  plants: PlantContext[];
  humidity: number;
  rainfall: number;
  weatherCondition: string;
}): Promise<{ warnings: { plant: string; risk: string; message: string; severity: "low" | "medium" | "high" }[] }> {
  if (input.plants.length === 0) return { warnings: [] };

  const plantList = input.plants.map(p => `${p.name} (${p.ageDays} HST, tanah: ${p.soilCondition})`).join(", ");
  const prompt = `Analisis risiko penyakit tanaman berdasarkan kondisi ini.

TANAMAN: ${plantList}
CUACA: ${input.weatherCondition}, kelembapan ${input.humidity}%, curah hujan ${input.rainfall}mm

Berikan peringatan risiko penyakit yang REALISTIS. Jangan buat peringatan palsu jika risikonya rendah.
JSON SAJA:
{
  "warnings": [
    {
      "plant": "nama tanaman",
      "risk": "nama penyakit yang berisiko",
      "message": "penjelasan singkat mengapa berisiko dan apa yang harus dilakukan",
      "severity": "low|medium|high"
    }
  ]
}`;

  const content = await callAIWithRetry({
    systemPrompt: FARMING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 400,
  });

  try {
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return { warnings: parsed.warnings ?? [] };
  } catch {
    return { warnings: [] };
  }
}

// ==================== MARKDOWN PARSER (DARI CODE LAMA) ====================
export function parseMarkdown(text: string): string {
  if (!text) return "";
  const lines = text.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const headingMatch = raw.match(/^#{1,}\s+(.+)$/);
    if (headingMatch) {
      const content = headingMatch[1].replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
      out.push(`<p class="font-semibold text-sm mt-3 mb-0.5">${content}</p>`);
      i++;
      continue;
    }

    if (raw.match(/^[-•]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-•]\s+/)) {
        const content = lines[i].replace(/^[-•]\s+/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
        items.push(`<li class="ml-4">${content}</li>`);
        i++;
      }
      out.push(`<ul class="list-disc space-y-0.5 my-1">${items.join("")}</ul>`);
      continue;
    }

    if (raw.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const content = lines[i].replace(/^\d+\.\s+/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
        items.push(`<li class="ml-4">${content}</li>`);
        i++;
      }
      out.push(`<ol class="list-decimal space-y-0.5 my-1">${items.join("")}</ol>`);
      continue;
    }

    if (raw.trim() === "") {
      out.push("<br/>");
    } else {
      const content = raw.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
      out.push(`<p class="mb-0">${content}</p>`);
    }
    i++;
  }

  return out.join("")
    .replace(/(<\/(?:ul|ol|p)>)(<br\/>)+/g, "$1")
    .replace(/(<br\/>)+(<(?:ul|ol|p)[^>]*>)/g, "$2")
    .replace(/(<br\/>){3,}/g, "<br/>")
    .replace(/^(<br\/>)+/, "")
    .replace(/(<br\/>)+$/, "");
}

// ==================== GENERATE ARTICLE (DARI CODE LAMA) ====================
const ARTICLE_GEN_SYSTEM_PROMPT = `Anda adalah penulis artikel pertanian dan teknologi modern untuk petani Indonesia.

Tugas Anda adalah membuat artikel HTML yang:
- Menarik, natural, dan enak dibaca
- Terasa seperti artikel blog profesional, bukan teks AI
- Sesuai dengan judul dan konteks yang diberikan

GAYA PENULISAN:
- Gunakan bahasa Indonesia yang sederhana, jelas, dan mengalir
- Tulis seperti sedang menjelaskan langsung ke petani
- Hindari gaya kaku seperti buku pelajaran

STRUKTUR HTML WAJIB:
- Gunakan <h2> untuk bagian utama
- Gunakan <h3> jika diperlukan
- Gunakan <p> untuk paragraf
- Gunakan <ul><li> untuk tips atau poin penting
- Jangan gunakan <h1>
- JANGAN gunakan sintaks Markdown seperti #, **, *, -, \`\`\`
- JANGAN sertakan \`\`\`html atau \`\`\` apapun
- Output HANYA HTML plain, tanpa pembungkus

STYLE FORMAT:
- Gunakan <strong> HANYA untuk hal yang benar-benar penting
- Maksimal 2–4 kali <strong> dalam satu artikel
- Jangan membold semua angka atau semua poin

GAYA VISUAL:
- Gunakan emoji secukupnya (🌱 🚜 ⚠️ 📊)
- Jangan berlebihan

LARANGAN:
- Jangan gunakan markdown \`\`\`
- Jangan gunakan <br>
- Jangan membuat paragraf kosong
- Jangan spam <strong>
- Jangan membuat teks terlalu kaku

OUTPUT: HANYA HTML siap pakai
Contoh: <h2>Pendahuluan</h2><p>...</p><h2>Penyebab</h2><ul><li>...</li></ul>`;

export async function generateArticleContent(input: { title: string; excerpt?: string; category?: string }): Promise<string> {
  const { title, excerpt, category } = input;
  const prompt = `
Buat artikel pertanian berdasarkan informasi berikut:

Judul: ${title}
${excerpt ? `Ringkasan: ${excerpt}` : ""}
${category ? `Kategori: ${category}` : ""}

Tulis artikel yang natural, menarik, dan mudah dipahami petani Indonesia.
Panjang artikel sesuai topik, tidak perlu terlalu panjang.

PENTING — FORMAT OUTPUT:
- Output HARUS berupa HTML VALID, BUKAN MARKDOWN.
- Gunakan tag: <h2> untuk sub-judul, <p> untuk paragraf, <ul><li> untuk poin-poin.
- Jangan gunakan sintaks Markdown seperti #, **, *, -.
- Jangan sertakan \`\`\`html atau \`\`\` apapun.
- Langsung kirim HTML tanpa pembungkus apapun.

Contoh format yang benar:
<h2>Pendahuluan</h2>
<p>Teks pembuka yang natural...</p>
<h2>Penyebab Utama</h2>
<ul>
  <li>Penyebab pertama</li>
  <li>Penyebab kedua</li>
</ul>
<p>Penjelasan lebih lanjut...</p>

Pastikan tidak ada <br> kosong, dan struktur rapi.
`;

  const content = await callAIWithRetry({
    systemPrompt: ARTICLE_GEN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 800,
  });

  let cleaned = content
    .replace(/```html|```/g, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/\n\s*\n/g, "")
    .replace(/>\s+</g, "><")
    .trim();

  if (cleaned.startsWith("#")) {
    cleaned = `<h2>${title}</h2><p>${cleaned.replace(/^#+\s+/, "")}</p>`;
  }

  return cleaned;
}

// ==================== SHARE TEXT (VERSI SYNC, TANPA AI) ====================
export function generateDiagnosisShareText(input: {
  plantName: string;
  diseaseName: string;
  severity: string;
  symptoms: string[];
  plantPart?: string;
}): string {
  const plant = input.plantName?.trim() || "Tanaman";
  const part = input.plantPart?.trim();
  
  let judul: string;
  if (part && part !== "") {
    judul = `Hasil Diagnosa: ${input.diseaseName} pada ${part.toLowerCase()} ${plant}`;
  } else {
    judul = `Hasil Diagnosa: ${input.diseaseName} pada ${plant}`;
  }
  
  let ajakan = "";
  if (input.severity === "Ringan") ajakan = "Tanaman saya baru menunjukkan tanda-tanda awal. Ada yang pernah mengalami dan berhasil mengatasi? Share tipsnya dong! 🙏";
  else if (input.severity === "Sedang") ajakan = "Sudah cukup parah nih. Mohon sarannya dari teman-teman yang pernah berhasil menyembuhkan. Terima kasih! 🌱";
  else if (input.severity === "Berat") ajakan = "Kondisinya sudah berat. Saya butuh saran segera. Ada yang punya pengalaman dengan kasus serupa? 🙏";
  else ajakan = "Tanaman saya bermasalah. Ada yang tahu cara mengatasinya? Share pengalamannya ya! 🙏";
  
  return `<strong>${judul}</strong><br>${ajakan}`;
}