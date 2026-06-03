// src/lib/ai.functions.ts
import { callAIWithRetry, type AIMessage } from "@/services/ai/aiService";
import { z } from "zod";

const FARMING_SYSTEM_PROMPT = `Anda TaniAI, asisten pertanian Indonesia.

ATURAN:
- WAJIB bahasa Indonesia
- Jawab SINGKAT maksimal 3 kalimat
- Gunakan - untuk poin
- ** untuk nama produk
- Jika ditanya di luar pertanian, tolak sopan
- Jangan Inggris
- Jangan sampai jawaban terpotong, pastikan selesai

Jika tidak tahu: "Maaf, saya tidak tahu."`;

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
  const parsed = z
    .object({
      messages: z.array(
        z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) }),
      ),
      context: z
        .object({
          userLocation: z.string().optional(),
          weatherSummary: z.string().optional(),
          userPlants: z.array(z.string()).optional(),
          recentDiagnoses: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .parse(input);

  let contextBlock = "";
  if (parsed.context) {
    const parts = [];
    if (parsed.context.userLocation) parts.push(`Lokasi: ${parsed.context.userLocation}`);
    if (parsed.context.weatherSummary) parts.push(`Cuaca: ${parsed.context.weatherSummary}`);
    if (parsed.context.userPlants?.length)
      parts.push(`Tanaman: ${parsed.context.userPlants.join(", ")}`);
    if (parts.length) contextBlock = `\nDATA REAL-TIME:\n${parts.join("\n")}`;
  }

  const messages: AIMessage[] = parsed.messages.map((m) => ({ role: m.role, content: m.content }));
  const content = await callAIWithRetry({
    messages,
    systemPrompt: FARMING_SYSTEM_PROMPT + contextBlock,
    maxTokens: 500,
  });
  return { content };
}

// Diagnosis tanaman dari gambar + konteks user
const DIAGNOSIS_SYSTEM_PROMPT = `Anda ahli patologi tanaman senior untuk pertanian Indonesia. WAJIB memberikan output dalam BAHASA INDONESIA. Analisis gambar dan konteks dengan teliti.

ATURAN:
- Gambar bukan tanaman → is_plant_image: false
- Jangan bilang "sehat" jika user melaporkan masalah
- Gambar blur tapi ada deskripsi → gunakan deskripsi sebagai dasar, turunkan confidence
- Prioritaskan deskripsi dan gejala user di atas visual jika kualitas gambar rendah
- Jangan mengarang diagnosis — lebih baik "tidak pasti"
- Jawab HANYA JSON valid tanpa teks lain
- Jawab dengan bahasa Indonesia, gunakan istilah lokal untuk penyakit dan tanaman`;

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

export async function diagnosePlant(
  input: DiagnosisInput,
): Promise<{ diagnosis: DiagnosisResult }> {
  const data = z
    .object({
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
    })
    .parse(input);

  const contextLines = [
    data.plantType ? `Jenis tanaman: ${data.plantType}` : null,
    data.partType ? `Bagian difoto: ${data.partType}` : null,
    data.plantAge ? `Umur: ${data.plantAge} hari` : null,
    data.soilCondition ? `Tanah: ${data.soilCondition}` : null,
    data.weatherCondition ? `Cuaca: ${data.weatherCondition}` : null,
    data.location ? `Lokasi: ${data.location}` : null,
    data.problemDescription ? `⚠️ Masalah user: ${data.problemDescription}` : null,
    data.symptoms?.length ? `⚠️ Gejala: ${data.symptoms.join(", ")}` : null,
    data.duration ? `Durasi: ${data.duration}` : null,
    data.userSeverity ? `Keparahan menurut user: ${data.userSeverity}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Analisis foto tanaman ini. WAJIB memberikan semua nilai dalam BAHASA INDONESIA.

KONTEKS:
${contextLines || "Tidak ada data tambahan"}

Balas HANYA dengan JSON valid sesuai struktur ini:
{
  "is_plant_image": true,
  "detected_plant": "nama tanaman dalam Bahasa Indonesia",
  "plant_match": true,
  "plant_match_confidence": 90,
  "mismatch_warning": null,
  "diagnosis": "nama penyakit dalam Bahasa Indonesia",
  "confidence": 78,
  "severity": "Sedang",
  "severity_score": 60,
  "cause": "penyebab dalam Bahasa Indonesia",
  "cause_detail": "detail penyebab dalam Bahasa Indonesia",
  "description": "deskripsi dalam Bahasa Indonesia",
  "symptoms": ["gejala 1 dalam Bahasa Indonesia", "gejala 2 dalam Bahasa Indonesia"],
  "initial_action": "tindakan awal dalam Bahasa Indonesia",
  "solution": "solusi dalam Bahasa Indonesia",
  "follow_up": "tindak lanjut dalam Bahasa Indonesia",
  "fertilizer": "pupuk dalam Bahasa Indonesia",
  "pesticide": "pestisida dalam Bahasa Indonesia",
  "recovery_days": 14,
  "weather_note": null,
  "confidence_note": null
}`;

  let content = "";
  try {
    content = await callAIWithRetry({
      vision: true,
      systemPrompt: DIAGNOSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: data.imageBase64 } },
          ],
        },
      ],
      maxTokens: 1200,
    });
  } catch (err) {
    console.error("AI call error:", err);
    return fallbackDiagnosis(data.plantType, data.partType, "Gagal memanggil AI. Periksa koneksi.");
  }

  try {
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (
      parsed.detected_plant &&
      data.plantType &&
      parsed.detected_plant.toLowerCase().trim() !== data.plantType.toLowerCase().trim()
    ) {
      parsed.plant_match = false;
      parsed.mismatch_warning = `Tanaman pada gambar terdeteksi sebagai "${parsed.detected_plant}", tetapi user memilih "${data.plantType}". Diagnosis dilakukan berdasarkan gambar asli.`;
      parsed.confidence = Math.min(Number(parsed.confidence || 70), 65);
      if (!parsed.confidence_note)
        parsed.confidence_note = "Jenis tanaman pada gambar tidak sesuai dengan pilihan user.";
    } else {
      parsed.plant_match = true;
    }

    if (parsed.is_plant_image === false) {
      parsed.diagnosis = "Gambar bukan tanaman";
      parsed.description =
        "AI mendeteksi bahwa gambar yang diupload bukan daun, batang, buah, atau bagian tanaman.";
      parsed.confidence = 100;
      parsed.severity = "Tidak Diketahui";
      parsed.severity_score = 0;
    }

    const severityScores = { Ringan: 30, Sedang: 60, Berat: 90, "Tidak Diketahui": 0 };
    parsed.severity_score = severityScores[parsed.severity as keyof typeof severityScores] || 0;

    return { diagnosis: parsed as DiagnosisResult };
  } catch (error) {
    console.error("Diagnosis parse error:", error, "Raw content:", content);
    return fallbackDiagnosis(
      data.plantType,
      data.partType,
      "AI gagal memproses foto. Pastikan gambar fokus, tidak buram, dan cukup terang.",
    );
  }
}

function fallbackDiagnosis(
  plantType?: string,
  partType?: string,
  customMessage?: string,
): Promise<{ diagnosis: DiagnosisResult }> {
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
      description:
        customMessage ||
        `Foto ${plant}${part} tidak dapat dianalisis. Pastikan gambar jelas, fokus, dan cukup terang.`,
      initial_action: "Ambil ulang foto dengan pencahayaan baik dan kamera stabil.",
      solution: "Dekatkan kamera ke area yang sakit, hindari bayangan, pastikan fokus tajam.",
      follow_up: "Jika tetap gagal, konsultasikan ke PPL setempat.",
      confidence_note: "Analisis gagal karena kualitas gambar tidak memadai.",
    },
  });
}

// Rekomendasi berbasis konteks tanaman dan cuaca
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

  const plantList = input.plants
    .map((p) => `${p.name} (${p.ageDays} HST, tanah: ${p.soilCondition})`)
    .join(", ");

  const prompt = `Berikan 3 rekomendasi pertanian SPESIFIK dan ACTIONABLE dalam BAHASA INDONESIA.
Tanaman: ${plantList}
Cuaca: ${input.weatherSummary ?? "tidak diketahui"}
Lokasi: ${input.userLocation ?? "tidak diketahui"}
Diagnosa: ${input.recentDiagnoses?.join("; ") ?? "tidak ada"}

JSON saja: {"recommendations": ["...", "...", "..."]}`;

  const content = await callAIWithRetry({
    systemPrompt: FARMING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 400,
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
}): Promise<{
  warnings: { plant: string; risk: string; message: string; severity: "low" | "medium" | "high" }[];
}> {
  if (input.plants.length === 0) return { warnings: [] };

  const plantList = input.plants
    .map((p) => `${p.name} (${p.ageDays} HST, tanah: ${p.soilCondition})`)
    .join(", ");

  const prompt = `Analisis risiko penyakit tanaman dalam BAHASA INDONESIA. Hanya beri peringatan jika risiko nyata.
Tanaman: ${plantList}
Cuaca: ${input.weatherCondition}, kelembapan ${input.humidity}%, hujan ${input.rainfall}mm

JSON saja: {"warnings": [{"plant": "...", "risk": "...", "message": "...", "severity": "low|medium|high"}]}`;

  const content = await callAIWithRetry({
    systemPrompt: FARMING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 450,
  });

  try {
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return { warnings: parsed.warnings ?? [] };
  } catch {
    return { warnings: [] };
  }
}

// Markdown parser untuk konten artikel
export function parseMarkdown(text: string): string {
  if (!text) return "";
  const lines = text.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const headingMatch = raw.match(/^#{1,}\s+(.+)$/);
    if (headingMatch) {
      const content = headingMatch[1]
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>");
      out.push(`<p class="font-semibold text-sm mt-3 mb-0.5">${content}</p>`);
      i++;
      continue;
    }

    if (raw.match(/^[-•]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-•]\s+/)) {
        const content = lines[i]
          .replace(/^[-•]\s+/, "")
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>");
        items.push(`<li class="ml-4">${content}</li>`);
        i++;
      }
      out.push(`<ul class="list-disc space-y-0.5 my-1">${items.join("")}</ul>`);
      continue;
    }

    if (raw.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const content = lines[i]
          .replace(/^\d+\.\s+/, "")
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>");
        items.push(`<li class="ml-4">${content}</li>`);
        i++;
      }
      out.push(`<ol class="list-decimal space-y-0.5 my-1">${items.join("")}</ol>`);
      continue;
    }

    if (raw.trim() === "") {
      out.push("<br/>");
    } else {
      const content = raw
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>");
      out.push(`<p class="mb-0">${content}</p>`);
    }
    i++;
  }

  return out
    .join("")
    .replace(/(<\/(?:ul|ol|p)>)(<br\/>)+/g, "$1")
    .replace(/(<br\/>)+(<(?:ul|ol|p)[^>]*>)/g, "$2")
    .replace(/(<br\/>){3,}/g, "<br/>")
    .replace(/^(<br\/>)+/, "")
    .replace(/(<br\/>)+$/, "");
}

// Generate konten artikel dengan AI
const ARTICLE_GEN_SYSTEM_PROMPT = `Anda penulis artikel pertanian Indonesia. WAJIB menulis dalam BAHASA INDONESIA. Buat artikel HTML yang natural dan mudah dipahami petani.

FORMAT WAJIB:
- Gunakan <h2>, <h3>, <p>, <ul><li> — JANGAN markdown (#, **, -)
- JANGAN sertakan \`\`\`html atau pembungkus apapun
- Gunakan <strong> maksimal 4x per artikel
- Emoji secukupnya (🌱 🚜 ⚠️)
- Output HANYA HTML siap pakai`;

export async function generateArticleContent(input: {
  title: string;
  excerpt?: string;
  category?: string;
}): Promise<string> {
  const { title, excerpt, category } = input;

  const prompt = `Buat artikel pertanian dalam BAHASA INDONESIA:
Judul: ${title}
${excerpt ? `Ringkasan: ${excerpt}` : ""}
${category ? `Kategori: ${category}` : ""}

Output HTML langsung, tanpa \`\`\` atau pembungkus. Contoh:
<h2>Pendahuluan</h2><p>...</p><ul><li>...</li></ul>`;

  const content = await callAIWithRetry({
    systemPrompt: ARTICLE_GEN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 1200,
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

// Generate teks share diagnosa (sync, tanpa AI)
export function generateDiagnosisShareText(input: {
  plantName: string;
  diseaseName: string;
  severity: string;
  symptoms: string[];
  plantPart?: string;
}): string {
  const plant = input.plantName?.trim() || "Tanaman";
  const part = input.plantPart?.trim();

  const judul = part
    ? `Hasil Diagnosa: ${input.diseaseName} pada ${part.toLowerCase()} ${plant}`
    : `Hasil Diagnosa: ${input.diseaseName} pada ${plant}`;

  let ajakan = "";
  if (input.severity === "Ringan")
    ajakan =
      "Tanaman saya baru menunjukkan tanda-tanda awal. Ada yang pernah mengalami dan berhasil mengatasi? Share tipsnya dong! 🙏";
  else if (input.severity === "Sedang")
    ajakan =
      "Sudah cukup parah nih. Mohon sarannya dari teman-teman yang pernah berhasil menyembuhkan. Terima kasih! 🌱";
  else if (input.severity === "Berat")
    ajakan =
      "Kondisinya sudah berat. Saya butuh saran segera. Ada yang punya pengalaman dengan kasus serupa? 🙏";
  else
    ajakan = "Tanaman saya bermasalah. Ada yang tahu cara mengatasinya? Share pengalamannya ya! 🙏";

  return `<strong>${judul}</strong><br>${ajakan}`;
}