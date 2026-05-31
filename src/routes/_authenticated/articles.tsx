import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { generateArticleContent } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/articles")({
  head: () => ({ meta: [{ title: "Pusat Edukasi — TaniAI Nexus" }] }),
  component: ArticlesPage,
});

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  author_name: string;
  created_at: string;
  published: boolean;
  read_minutes: number | null;
  category_id: string | null;
  article_categories: { id: string; name: string; slug: string } | null;
};

type Category = { id: string; name: string; slug: string };

const inputCls =
  "w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-base outline-none placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED CSS — WYSIWYG FLOAT FIX
// ─────────────────────────────────────────────────────────────────────────────

const SHARED_ARTICLE_CSS = `
.ql-editor,
.article-content {
  word-break: break-word;
  overflow-wrap: break-word;
  font-family: inherit;
}

/* ─── Perbaikan spacing editor agar lebih rapi ─── */
.ql-editor {
  font-size: 1rem;
  line-height: 1.65;
  color: #1f2937;
}

/* Margin antar elemen */
.ql-editor h1,
.ql-editor h2,
.ql-editor h3,
.ql-editor h4,
.ql-editor h5,
.ql-editor h6 {
  margin-top: 1.25em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.3;
}
.ql-editor h1 { font-size: 1.875rem; margin-top: 1.5em; }
.ql-editor h2 { font-size: 1.5rem; margin-top: 1.25em; }
.ql-editor h3 { font-size: 1.25rem; margin-top: 1em; }

/* Paragraf tidak berlebihan spasi */
.ql-editor p {
  margin: 0.65rem 0;
  line-height: 1.7;
}

/* List rapi */
.ql-editor ul, 
.ql-editor ol {
  margin: 0.75rem 0;
  padding-left: 1.75rem;
}
.ql-editor li {
  margin: 0.25rem 0;
  line-height: 1.65;
}
.ql-editor li > p {
  display: inline;
  margin: 0;
}

/* Blockquote */
.ql-editor blockquote {
  border-left: 4px solid #16a34a;
  background: #f0fdf4;
  border-radius: 0 10px 10px 0;
  margin: 1rem 0;
  padding: 0.75rem 1.25rem;
  color: #166534;
  font-style: italic;
}

/* Gambar responsif & rapi */
.ql-editor img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 0.75rem auto;
  display: block;
}
.ql-editor img[style*="float: left"] {
  margin: 0 1rem 0.5rem 0;
  display: inline;
}
.ql-editor img[style*="float: right"] {
  margin: 0 0 0.5rem 1rem;
  display: inline;
}

/* Tabel */
.ql-editor table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}
.ql-editor th,
.ql-editor td {
  border: 1px solid #e2e8f0;
  padding: 0.5rem;
  text-align: left;
}
.ql-editor th {
  background: #f1f5f9;
}

/* Code block */
.ql-editor pre {
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 10px;
  padding: 1rem;
  overflow-x: auto;
  margin: 1rem 0;
}

.ql-editor h1,
.ql-editor h2,
.ql-editor h3 {
  margin-top: 1.25em !important;
  margin-bottom: 0.5em !important;
}
.ql-editor p {
  margin: 0.65rem 0 !important;
}
.ql-editor ul, .ql-editor ol {
  margin: 0.75rem 0 !important;
  padding-left: 1.75rem !important;
}
.ql-editor li {
  margin: 0.25rem 0 !important;
}

.article-content {
  max-width: 100%;
}
.article-content::after {
  content: "";
  display: table;
  clear: both;
}
.article-content .float-clearfix,
.ql-editor .float-clearfix {
  clear: both;
  display: block;
  height: 0;
  overflow: hidden;
  visibility: hidden;
}
.article-content p,
.ql-editor p {
  margin: 0.65rem 0;
  line-height: 1.7;
}
.article-content img,
.ql-editor img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  cursor: pointer;
  vertical-align: middle;
  display: inline-block;
}
.article-content img[style*="float: left"],
.ql-editor img[style*="float: left"],
.article-content img[style*="float:left"],
.ql-editor img[style*="float:left"] {
  float: left;
  margin: 0 1rem 0.5rem 0;
}
.article-content img[style*="float: right"],
.ql-editor img[style*="float: right"],
.article-content img[style*="float:right"],
.ql-editor img[style*="float:right"] {
  float: right;
  margin: 0 0 0.5rem 1rem;
}
.article-content img:not([style*="float"]),
.ql-editor img:not([style*="float"]) {
  display: block;
  margin: 0.75rem auto;
}
.article-content img[style*="margin-left: auto"][style*="margin-right: auto"],
.ql-editor img[style*="margin-left: auto"][style*="margin-right: auto"] {
  display: block;
  margin-left: auto !important;
  margin-right: auto !important;
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
}
.article-content img.ql-img-selected,
.ql-editor img.ql-img-selected {
  outline: 2px solid #16a34a;
  outline-offset: 2px;
}
.article-content h1 {
  font-size: 1.875rem;
  font-weight: 700;
  line-height: 1.2;
  margin: 1.5rem 0 0.75rem;
  clear: both;
}
.article-content h2 {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.25;
  margin: 1.25rem 0 0.6rem;
  clear: both;
}
.article-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.3;
  margin: 1rem 0 0.5rem;
  clear: both;
}
.article-content h4,
.article-content h5,
.article-content h6 {
  clear: both;
}
.article-content ul {
  list-style: disc outside;
  padding-left: 1.625rem;
  margin: 0.75rem 0;
}
.article-content ol {
  list-style: decimal outside;
  padding-left: 1.625rem;
  margin: 0.75rem 0;
}
.article-content li {
  margin: 0.3rem 0;
  line-height: 1.65;
}
.article-content li > p {
  margin: 0;
  display: inline;
}
.article-content blockquote {
  border-left: 4px solid #16a34a;
  background: #f0fdf4;
  border-radius: 0 10px 10px 0;
  padding: 0.875rem 1.25rem;
  margin: 1rem 0;
  margin-left: 0;
  color: #166534;
  clear: both;
  font-style: italic;
}
.article-content blockquote p {
  margin: 0.5rem 0;
}
.article-content pre {
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  overflow-x: auto;
  margin: 1rem 0;
  font-size: 0.875rem;
  line-height: 1.65;
  clear: both;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.article-content pre code {
  background: none;
  padding: 0;
  color: inherit;
  font-family: inherit;
}
.article-content code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: #f1f5f9;
  border-radius: 4px;
  padding: 0.125rem 0.375rem;
  font-size: 0.875em;
  color: #16a34a;
}
.article-content a {
  color: #16a34a;
  text-decoration: none;
  transition: color 0.2s;
}
.article-content a:hover {
  text-decoration: underline;
  color: #15803d;
}
.article-content strong {
  font-weight: 600;
}
.article-content em {
  font-style: italic;
}
.article-content u {
  text-decoration: underline;
}
.article-content hr {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 1.5rem 0;
  clear: both;
}
.article-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  clear: both;
}
.article-content th,
.article-content td {
  border: 1px solid #e2e8f0;
  padding: 0.75rem;
  text-align: left;
}
.article-content th {
  background: #f1f5f9;
  font-weight: 600;
}
.img-ctrl {
  box-sizing: border-box;
}
`;

function injectSharedCSS() {
  const id = "tani-article-shared-css";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = SHARED_ARTICLE_CSS;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE & NORMALIZATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function extractStoragePaths(
  content: string | null,
  coverImage: string | null
): string[] {
  const paths: string[] = [];
  if (content) {
    const regex =
      /<img[^>]+src="[^"]*\/storage\/v1\/object\/public\/articles\/([^">]+)"/g;
    let match;
    while ((match = regex.exec(content)) !== null) paths.push(match[1]);
  }
  if (coverImage) {
    const m = coverImage.match(/\/storage\/v1\/object\/public\/articles\/(.+)/);
    if (m) paths.push(m[1]);
  }
  return paths;
}

async function deleteStorageFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await supabase.storage.from("articles").remove(paths);
  if (error) console.warn("Storage cleanup:", error.message);
}

function convertImageWidthsToPercent(
  html: string,
  editorWidth: number
): string {
  if (!html || editorWidth <= 0) return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("img").forEach((img) => {
    const w = img.style.width;
    if (!w) return;
    if (w.endsWith("%")) return;
    const px = parseFloat(w);
    if (isNaN(px) || px <= 0) return;
    const pct = Math.round((px / editorWidth) * 100);
    const clamped = Math.max(10, Math.min(100, pct));
    img.style.width = `${clamped}%`;
    img.style.height = "auto";
  });
  return div.innerHTML;
}

function normalizeImageFloats(html: string): string {
  if (!html) return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  const paragraphs = Array.from(div.querySelectorAll("p"));
  paragraphs.forEach((p) => {
    const img = p.querySelector("img");
    if (!img) return;
    const floatDir = img.style.float;
    if (floatDir !== "left" && floatDir !== "right") return;
    if (img.parentElement !== p) return;
    const extractedImg = img.cloneNode(true) as HTMLImageElement;
    p.parentNode?.insertBefore(extractedImg, p);
    img.remove();
    const remainingText = p.textContent?.trim() ?? "";
    const remainingHTML = p.innerHTML.replace(/<br\s*\/?>/gi, "").trim();
    if (remainingText === "" && remainingHTML === "") {
      p.remove();
    }
  });
  insertFloatClearfixes(div);
  return div.innerHTML;
}

function insertFloatClearfixes(container: HTMLElement): void {
  const children = Array.from(container.childNodes);
  let inFloatContext = false;
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    if (el.tagName === "IMG") {
      const f = (el as HTMLImageElement).style.float;
      if (f === "left" || f === "right") {
        inFloatContext = true;
        continue;
      } else {
        if (inFloatContext) {
          const clearDiv = document.createElement("div");
          clearDiv.className = "float-clearfix";
          container.insertBefore(clearDiv, el);
          inFloatContext = false;
        }
        continue;
      }
    }
    const blockTags = [
      "H1","H2","H3","H4","H5","H6","UL","OL","BLOCKQUOTE","PRE","HR","TABLE",
    ];
    if (blockTags.includes(el.tagName)) {
      if (inFloatContext) {
        const clearDiv = document.createElement("div");
        clearDiv.className = "float-clearfix";
        container.insertBefore(clearDiv, el);
        inFloatContext = false;
      }
      continue;
    }
  }
  if (inFloatContext) {
    const clearDiv = document.createElement("div");
    clearDiv.className = "float-clearfix";
    container.appendChild(clearDiv);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE RESIZE MODULE
// ─────────────────────────────────────────────────────────────────────────────

const SVG = {
  wrapLeft: `<svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="9" height="9" rx="1.5" fill="currentColor" opacity="0.85"/>
    <line x1="11" y1="2" x2="21" y2="2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="11" y1="5.5" x2="21" y2="5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="11" y1="9" x2="18" y2="9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="0" y1="13" x2="21" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="0" y1="16.5" x2="16" y2="16.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
  wrapRight: `<svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="13" y="0" width="9" height="9" rx="1.5" fill="currentColor" opacity="0.85"/>
    <line x1="0" y1="2" x2="11" y2="2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="0" y1="5.5" x2="11" y2="5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="3" y1="9" x2="11" y2="9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="0" y1="13" x2="21" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="5" y1="16.5" x2="21" y2="16.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
  blockLeft: `<svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="11" height="9" rx="1.5" fill="currentColor" opacity="0.85"/>
    <line x1="0" y1="13" x2="21" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="0" y1="16.5" x2="16" y2="16.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
  blockCenter: `<svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="0" width="12" height="9" rx="1.5" fill="currentColor" opacity="0.85"/>
    <line x1="0" y1="13" x2="21" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="3" y1="16.5" x2="18" y2="16.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
  blockRight: `<svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="11" y="0" width="11" height="9" rx="1.5" fill="currentColor" opacity="0.85"/>
    <line x1="0" y1="13" x2="21" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="5" y1="16.5" x2="21" y2="16.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
  fullWidth: `<svg width="22" height="14" viewBox="0 0 22 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="22" height="9" rx="1.5" fill="currentColor" opacity="0.85"/>
    <line x1="0" y1="12.5" x2="22" y2="12.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
};

type LayoutMode =
  | "wrap-left"
  | "wrap-right"
  | "block-left"
  | "block-center"
  | "block-right"
  | "full-width";

function applyImageLayout(img: HTMLImageElement, mode: LayoutMode) {
  img.style.float = "none";
  img.style.display = "block";
  img.style.margin = "8px 0";
  switch (mode) {
    case "wrap-left":
      img.style.float = "left";
      img.style.display = "inline";
      img.style.margin = "4px 16px 8px 0";
      break;
    case "wrap-right":
      img.style.float = "right";
      img.style.display = "inline";
      img.style.margin = "4px 0 8px 16px";
      break;
    case "block-left":
      img.style.marginLeft = "0";
      img.style.marginRight = "auto";
      break;
    case "block-center":
      img.style.marginLeft = "auto";
      img.style.marginRight = "auto";
      break;
    case "block-right":
      img.style.marginLeft = "auto";
      img.style.marginRight = "0";
      break;
    case "full-width":
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.marginLeft = "0";
      img.style.marginRight = "0";
      break;
  }
}

function detectLayout(img: HTMLImageElement): LayoutMode {
  const f = img.style.float;
  if (f === "left") return "wrap-left";
  if (f === "right") return "wrap-right";
  const ml = img.style.marginLeft;
  const mr = img.style.marginRight;
  const w = img.style.width;
  if (w === "100%") return "full-width";
  if (ml === "auto" && mr === "auto") return "block-center";
  if (ml === "auto") return "block-right";
  return "block-left";
}

class ImageResizeModule {
  quill: any;
  img: HTMLImageElement | null = null;
  overlay: HTMLDivElement | null = null;
  handle: HTMLDivElement | null = null;
  toolbarEl: HTMLDivElement | null = null;
  startX = 0;
  startWidth = 0;
  boundScroll: (() => void) | null = null;
  private _contentRef: { current: string } | null = null;

  constructor(quill: any) {
    this.quill = quill;
    quill.root.addEventListener("click", this.onEditorClick);
    document.addEventListener("click", this.onDocClick);
  }

  setContentRef(ref: { current: string }) {
    this._contentRef = ref;
  }

  private syncContent() {
    const html = this.quill.root.innerHTML ?? "";
    if (this._contentRef) {
      this._contentRef.current = html;
    }
    this.quill.update();
  }

  onEditorClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName !== "IMG") return;
    e.stopPropagation();
    const img = t as HTMLImageElement;
    if (img.complete && img.naturalWidth > 0) this.show(img);
    else img.onload = () => this.show(img);
  };

  onDocClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest(".ql-editor img") || t.closest(".img-ctrl")) return;
    this.hide();
  };

  positionOverlay() {
    if (!this.overlay || !this.img) return;
    const ir = this.img.getBoundingClientRect();
    const er = this.quill.root.getBoundingClientRect();
    const st = this.quill.root.scrollTop ?? 0;
    const sl = this.quill.root.scrollLeft ?? 0;
    Object.assign(this.overlay.style, {
      left: `${ir.left - er.left + sl}px`,
      top: `${ir.top - er.top + st}px`,
      width: `${ir.width}px`,
      height: `${ir.height}px`,
    });
    if (this.toolbarEl) {
      const spaceAbove = ir.top - er.top;
      this.toolbarEl.style.top =
        spaceAbove < 54 ? `${ir.height + 6}px` : "-50px";
      this.toolbarEl.style.bottom = "auto";
    }
  }

  show(img: HTMLImageElement) {
    this.hide();
    this.img = img;
    img.classList.add("ql-img-selected");

    this.overlay = document.createElement("div");
    this.overlay.className = "img-ctrl";
    Object.assign(this.overlay.style, {
      position: "absolute",
      pointerEvents: "none",
      zIndex: "100",
      border: "2px solid #16a34a",
      borderRadius: "7px",
      boxSizing: "border-box",
    });

    this.handle = document.createElement("div");
    this.handle.className = "img-ctrl";
    this.handle.title = "Drag untuk resize";
    Object.assign(this.handle.style, {
      position: "absolute",
      bottom: "-7px",
      right: "-7px",
      width: "16px",
      height: "16px",
      background: "#16a34a",
      border: "2.5px solid white",
      borderRadius: "50%",
      cursor: "se-resize",
      pointerEvents: "auto",
      zIndex: "102",
      boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
    });
    this.handle.addEventListener("mousedown", this.startResize);
    this.overlay.appendChild(this.handle);

    this.toolbarEl = document.createElement("div");
    this.toolbarEl.className = "img-ctrl";
    Object.assign(this.toolbarEl.style, {
      position: "absolute",
      left: "50%",
      transform: "translateX(-50%)",
      top: "-50px",
      display: "flex",
      alignItems: "center",
      gap: "1px",
      background: "white",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      padding: "4px",
      boxShadow:
        "0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
      pointerEvents: "auto",
      zIndex: "103",
      whiteSpace: "nowrap",
    });

    const currentLayout = detectLayout(img);
    const LAYOUTS: { mode: LayoutMode; icon: string; label: string }[] = [
      { mode: "wrap-left", icon: SVG.wrapLeft, label: "Teks melingkar kanan" },
      { mode: "wrap-right", icon: SVG.wrapRight, label: "Teks melingkar kiri" },
      { mode: "block-left", icon: SVG.blockLeft, label: "Blok rata kiri" },
      { mode: "block-center", icon: SVG.blockCenter, label: "Blok tengah" },
      { mode: "block-right", icon: SVG.blockRight, label: "Blok rata kanan" },
      { mode: "full-width", icon: SVG.fullWidth, label: "Lebar penuh" },
    ];

    LAYOUTS.forEach(({ mode, icon, label }) => {
      const btn = this.makeBtn(icon, label, mode === currentLayout, () => {
        applyImageLayout(this.img!, mode);
        this.positionOverlay();
        this.refreshToolbarActive(mode);
        this.syncContent();
      });
      btn.dataset.mode = mode;
      btn.classList.add("tlbr-btn");
      this.toolbarEl!.appendChild(btn);
    });

    const sep = document.createElement("div");
    sep.style.cssText =
      "width:1px;height:20px;background:#e2e8f0;margin:0 3px;flex-shrink:0;";
    this.toolbarEl.appendChild(sep);

    const widths = ["25%", "50%", "75%", "100%"];
    widths.forEach((w) => {
      const active = img.style.width === w;
      const btn = this.makeBtn(`${w}`, `Lebar ${w}`, active, () => {
        if (this.img) {
          this.img.style.width = w;
          this.img.style.height = "auto";
          this.positionOverlay();
          this.syncContent();
        }
      });
      btn.style.fontSize = "10px";
      btn.style.fontWeight = "700";
      btn.style.padding = "5px 6px";
      this.toolbarEl!.appendChild(btn);
    });

    this.overlay.appendChild(this.toolbarEl);
    this.quill.root.parentNode?.appendChild(this.overlay);
    this.positionOverlay();

    this.boundScroll = () => this.positionOverlay();
    this.quill.root.addEventListener("scroll", this.boundScroll);
    window.addEventListener("resize", this.boundScroll);
  }

  makeBtn(
    inner: string,
    title: string,
    active: boolean,
    onClick: () => void
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.innerHTML = inner;
    btn.title = title;
    btn.type = "button";
    this.styleBtn(btn, active);
    btn.addEventListener("mouseenter", () => {
      if (btn.dataset.active !== "true") {
        btn.style.background = "#f1f5f9";
        btn.style.color = "#0f172a";
      }
    });
    btn.addEventListener("mouseleave", () =>
      this.styleBtn(btn, btn.dataset.active === "true")
    );
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  styleBtn(btn: HTMLElement, active: boolean) {
    Object.assign(btn.style, {
      padding: "5px 7px",
      border: "none",
      background: active ? "#f0fdf4" : "transparent",
      color: active ? "#16a34a" : "#64748b",
      cursor: "pointer",
      borderRadius: "7px",
      lineHeight: "1",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      outline: active ? "1.5px solid #bbf7d0" : "none",
      transition: "background 0.1s, color 0.1s",
    });
    btn.dataset.active = String(active);
  }

  refreshToolbarActive(currentMode: LayoutMode) {
    if (!this.toolbarEl) return;
    this.toolbarEl.querySelectorAll(".tlbr-btn").forEach((btn: any) => {
      const active = btn.dataset.mode === currentMode;
      this.styleBtn(btn, active);
    });
  }

  hide() {
    if (this.img) this.img.classList.remove("ql-img-selected");
    if (this.boundScroll) {
      this.quill.root.removeEventListener("scroll", this.boundScroll);
      window.removeEventListener("resize", this.boundScroll);
    }
    this.overlay?.remove();
    this.overlay = null;
    this.toolbarEl = null;
    this.handle = null;
    this.img = null;
  }

  startResize = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.startX = e.clientX;
    this.startWidth = this.img?.offsetWidth ?? 0;
    document.addEventListener("mousemove", this.doResize);
    document.addEventListener("mouseup", this.stopResize);
  };

  doResize = (e: MouseEvent) => {
    if (!this.img) return;
    const newW = Math.max(40, this.startWidth + (e.clientX - this.startX));
    this.img.style.width = `${newW}px`;
    this.img.style.height = "auto";
    this.positionOverlay();
  };

  stopResize = () => {
    document.removeEventListener("mousemove", this.doResize);
    document.removeEventListener("mouseup", this.stopResize);
    this.syncContent();
  };

  destroy() {
    this.hide();
    this.quill.root.removeEventListener("click", this.onEditorClick);
    document.removeEventListener("click", this.onDocClick);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTICLE CONTENT RENDERER
// ─────────────────────────────────────────────────────────────────────────────

function ArticleContentRenderer({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = content;

    const paragraphs = Array.from(ref.current.querySelectorAll("p"));
    paragraphs.forEach((p) => {
      const img = p.querySelector("img") as HTMLImageElement | null;
      if (!img) return;
      const floatDir = img.style.float;
      if (floatDir !== "left" && floatDir !== "right") return;
      if (img.parentElement !== p) return;
      const extractedImg = img.cloneNode(true) as HTMLImageElement;
      p.parentNode?.insertBefore(extractedImg, p);
      img.remove();
      const remainingText = p.textContent?.trim() ?? "";
      const remainingHTML = p.innerHTML.replace(/<br\s*\/?>/gi, "").trim();
      if (remainingText === "" && remainingHTML === "") {
        p.remove();
      }
    });

    const children = Array.from(ref.current.childNodes);
    let inFloat = false;
    const blockTags = [
      "H1","H2","H3","H4","H5","H6","UL","OL","BLOCKQUOTE","PRE","HR","TABLE",
    ];

    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as HTMLElement;
      if (el.tagName === "IMG") {
        const f = (el as HTMLImageElement).style.float;
        if (f === "left" || f === "right") {
          inFloat = true;
          continue;
        }
        if (inFloat) {
          const cf = document.createElement("div");
          cf.className = "float-clearfix";
          ref.current.insertBefore(cf, el);
          inFloat = false;
        }
        continue;
      }
      if (blockTags.includes(el.tagName) && inFloat) {
        const cf = document.createElement("div");
        cf.className = "float-clearfix";
        ref.current.insertBefore(cf, el);
        inFloat = false;
      }
    }

    if (inFloat) {
      const cf = document.createElement("div");
      cf.className = "float-clearfix";
      ref.current.appendChild(cf);
    }

    ref.current.querySelectorAll("img").forEach((img) => {
      const htmlImg = img as HTMLImageElement;
      if (htmlImg.style.width && !htmlImg.style.width.endsWith("%")) {
        htmlImg.style.maxWidth = "100%";
      }
      if (!htmlImg.style.height || htmlImg.style.height !== "auto") {
        htmlImg.style.height = "auto";
      }
    });
  }, [content]);

  return <div ref={ref} className="article-content" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// ★ SHARED ARTICLE DISPLAY CARD
//   Used identically in both ArticleDetail and the form modal live preview.
//   This is the single source of truth for article rendering.
// ─────────────────────────────────────────────────────────────────────────────

type ArticleDisplayProps = {
  title: string;
  excerpt?: string | null;
  coverImage?: string | null;
  authorName?: string | null;
  categoryName?: string | null;
  /** ISO date string or Date object. Pass null to use today's date (preview mode). */
  createdAt?: string | Date | null;
  readMinutes?: number | string | null;
  content?: string | null;
  /** When true, shows placeholder text instead of empty states */
  isPreview?: boolean;
};

function ArticleDisplayCard({
  title,
  excerpt,
  coverImage,
  authorName,
  categoryName,
  createdAt,
  readMinutes,
  content,
  isPreview = false,
}: ArticleDisplayProps) {
  const [imgError, setImgError] = useState(false);

  // Reset image error state when cover changes
  useEffect(() => {
    setImgError(false);
  }, [coverImage]);

  const safeContent = content?.trim() ?? "";
  const hasContent =
    safeContent &&
    safeContent !== "<p><br></p>" &&
    safeContent !== "<p></p>";

  const dateDisplay = (() => {
    if (!createdAt) return format(new Date(), "d MMMM yyyy", { locale: idLocale });
    try {
      const d = typeof createdAt === "string" ? parseISO(createdAt) : createdAt;
      return format(d, "d MMMM yyyy", { locale: idLocale });
    } catch {
      return format(new Date(), "d MMMM yyyy", { locale: idLocale });
    }
  })();

  const readMin =
    readMinutes !== null && readMinutes !== undefined && readMinutes !== ""
      ? Number(readMinutes)
      : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {/* ── Cover Image — identical 16:7 ratio ── */}
      {coverImage && !imgError ? (
        <div className="aspect-[16/7] overflow-hidden">
          <img
            src={coverImage}
            alt={title}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className="aspect-[16/7] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
          <BookOpen className="h-16 w-16 text-primary/20" />
        </div>
      )}

      {/* ── Article body — identical padding p-6 sm:p-8 ── */}
      <div className="p-6 sm:p-8">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {categoryName && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Tag className="h-3 w-3" />
              {categoryName}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {dateDisplay}
          </span>
          {readMin !== null && readMin > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {readMin} menit baca
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
          {title || (
            isPreview ? (
              <span className="text-muted-foreground/40 italic font-normal text-xl">
                Judul artikel...
              </span>
            ) : null
          )}
        </h1>

        {/* Excerpt */}
        {excerpt && (
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            {excerpt}
          </p>
        )}

        {/* Author */}
        <div className="flex items-center gap-2.5 pb-6 mb-6 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary shrink-0">
            {((authorName || "T").slice(0, 1)).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {authorName || "Tim TaniAI"}
            </p>
            <p className="text-xs text-muted-foreground">Penulis</p>
          </div>
        </div>

        {/* Content */}
        {hasContent ? (
          <ArticleContentRenderer content={safeContent} />
        ) : (
          <div className="py-16 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium text-muted-foreground">
              {isPreview
                ? "Konten akan muncul di sini saat Anda mengetik..."
                : "Konten tidak tersedia"}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────────────────

function DeleteConfirmModal({
  title,
  onConfirm,
  onCancel,
  isPending,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-elevated p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 mb-4">
          <Trash2 className="h-5 w-5 text-destructive" />
        </div>
        <h3 className="font-bold text-base">Hapus Artikel?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{title}</span> akan dihapus permanen beserta semua gambarnya.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isPending}>
            Batal
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Menghapus..." : "Hapus"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

function ArticlesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewArticle, setViewArticle] = useState<Article | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Article | null>(null);
  const [adminTab, setAdminTab] = useState<"list" | "table">("list");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    injectSharedCSS();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setAdminChecked(true);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
      setAdminChecked(true);
    });
  }, []);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["article-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_categories")
        .select("id, name, slug")
        .order("name");
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: allArticles = [], isLoading } = useQuery<Article[]>({
    queryKey: ["articles", debouncedSearch, selectedCategory],
    queryFn: async () => {
      let q = supabase
        .from("articles")
        .select(
          "id, title, slug, excerpt, content, cover_image, author_name, created_at, published, read_minutes, category_id, article_categories(id, name, slug)"
        )
        .order("created_at", { ascending: false });
      if (debouncedSearch)
        q = (q as any).or(
          `title.ilike.%${debouncedSearch}%,excerpt.ilike.%${debouncedSearch}%`
        );
      if (selectedCategory !== "all")
        q = (q as any).eq("category_id", selectedCategory);
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []) as Article[];
    },
  });

  const displayArticles = isAdmin
    ? allArticles
    : allArticles.filter((a) => a.published);

  const togglePublish = useMutation({
    mutationFn: async ({
      id,
      published,
    }: {
      id: string;
      published: boolean;
    }) => {
      const { error } = await supabase
        .from("articles")
        .update({ published })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Status diperbarui");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteArticle = useMutation({
    mutationFn: async (id: string) => {
      const { data: a, error: fe } = await supabase
        .from("articles")
        .select("content, cover_image")
        .eq("id", id)
        .single();
      if (fe) throw fe;
      if (a)
        await deleteStorageFiles(
          extractStoragePaths(a.content, a.cover_image)
        );
      const { error } = await supabase
        .from("articles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Artikel dihapus");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Handler untuk memilih artikel terkait
  const handleSelectRelatedArticle = (article: Article) => {
    setViewArticle(article);
    // Scroll ke atas ketika membuka artikel baru
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handler untuk memilih kategori (filter)
  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setViewArticle(null); // kembali ke tampilan list/grid
    // Opsional: scroll ke atas daftar artikel
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (viewArticle) {
    return (
      <ArticleDetail
        article={viewArticle}
        onBack={() => setViewArticle(null)}
        relatedArticles={displayArticles
          .filter(
            (a) =>
              a.id !== viewArticle.id &&
              a.category_id === viewArticle.category_id
          )
          .slice(0, 3)}
        categories={categories}
        onSelectRelatedArticle={handleSelectRelatedArticle}
        onSelectCategory={handleSelectCategory}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Pusat Edukasi
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Artikel pertanian, tips AI, dan panduan praktis untuk petani
            Indonesia.
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditItem(null);
              setShowForm(true);
            }}
            className="gap-2 self-start sm:self-auto shrink-0"
          >
            <Plus className="h-4 w-4" /> Tulis Artikel
          </Button>
        )}
      </div>

      {isAdmin && (
        <div className="flex gap-2 rounded-xl border border-border bg-muted/50 p-1 w-fit">
          {(["list", "table"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setAdminTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                adminTab === tab
                  ? "bg-card shadow-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "list" ? "Tampilan Grid" : "Kelola Artikel"}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari artikel..."
            className="h-9 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 shrink-0">
          <button
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap",
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/70 text-muted-foreground"
            )}
          >
            Semua
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap",
                selectedCategory === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/70 text-muted-foreground"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {isAdmin && adminTab === "table" ? (
        <AdminArticleTable
          articles={allArticles}
          isLoading={isLoading}
          onEdit={(a) => {
            setEditItem(a);
            setShowForm(true);
          }}
          onDelete={(id) => deleteArticle.mutate(id)}
          onTogglePublish={(id, pub) =>
            togglePublish.mutate({ id, published: pub })
          }
          onView={(a) => setViewArticle(a)}
        />
      ) : isLoading ? (
        <ArticlesGridSkeleton />
      ) : displayArticles.length === 0 ? (
        <EmptyState
          search={debouncedSearch}
          isAdmin={isAdmin}
          onWrite={() => {
            setEditItem(null);
            setShowForm(true);
          }}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {displayArticles.map((a) => (
            <ArticleCard
              key={a.id}
              article={a}
              isAdmin={isAdmin}
              onView={() => setViewArticle(a)}
              onEdit={() => {
                setEditItem(a);
                setShowForm(true);
              }}
              onDelete={() => deleteArticle.mutate(a.id)}
              onTogglePublish={() =>
                togglePublish.mutate({
                  id: a.id,
                  published: !a.published,
                })
              }
            />
          ))}
        </div>
      )}

      {showForm && (
        <ArticleFormModal
          onClose={() => {
            setShowForm(false);
            setEditItem(null);
          }}
          editItem={editItem}
          categories={categories}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTICLE CARD (grid thumbnail) with Delete Modal
// ─────────────────────────────────────────────────────────────────────────────

function ArticleCard({
  article,
  isAdmin,
  onView,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  article: Article;
  isAdmin: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete();
    setIsDeleting(false);
    setShowDeleteModal(false);
  };

  return (
    <>
      <div
        className={cn(
          "group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated",
          !article.published && isAdmin && "opacity-70 border-dashed"
        )}
      >
        <div
          className="aspect-video overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 cursor-pointer"
          onClick={onView}
        >
          {article.cover_image && !imgError ? (
            <img
              src={article.cover_image}
              alt={article.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="h-10 w-10 text-primary/20" />
            </div>
          )}
        </div>
        <div className="p-5">
          <div className="mb-2.5 flex items-center gap-2 flex-wrap">
            {(article.article_categories as any)?.name && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <Tag className="h-2.5 w-2.5" />
                {(article.article_categories as any).name}
              </span>
            )}
            {isAdmin && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  article.published
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning"
                )}
              >
                {article.published ? "Publik" : "Draft"}
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
              <Calendar className="h-3 w-3" />
              {format(parseISO(article.created_at), "d MMM yyyy", {
                locale: idLocale,
              })}
            </span>
          </div>
          <h3
            className="font-bold leading-snug line-clamp-2 cursor-pointer group-hover:text-primary transition-colors text-[15px]"
            onClick={onView}
          >
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {article.excerpt}
            </p>
          )}
          <div className="mt-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                {(article.author_name || "T").slice(0, 1).toUpperCase()}
              </div>
              <span className="text-xs text-muted-foreground truncate">
                {article.author_name ?? "Tim TaniAI"}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {article.read_minutes && (
                <span className="text-[10px] text-muted-foreground mr-1">
                  {article.read_minutes} mnt
                </span>
              )}
              {isAdmin && (
                <>
                  <button
                    onClick={onTogglePublish}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                    title={
                      article.published ? "Jadikan draft" : "Publikasikan"
                    }
                  >
                    {article.published ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={onEdit}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                onClick={onView}
                className="ml-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-primary bg-primary/5 hover:bg-primary/15 transition-colors flex items-center gap-1"
              >
                Baca <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteConfirmModal
          title={article.title}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          isPending={isDeleting}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN TABLE with Delete Modal
// ─────────────────────────────────────────────────────────────────────────────

function AdminArticleTable({
  articles,
  isLoading,
  onEdit,
  onDelete,
  onTogglePublish,
  onView,
}: {
  articles: Article[];
  isLoading: boolean;
  onEdit: (a: Article) => void;
  onDelete: (id: string) => void;
  onTogglePublish: (id: string, published: boolean) => void;
  onView: (a: Article) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft"
  >("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const filtered = articles.filter((a) =>
    statusFilter === "all"
      ? true
      : statusFilter === "published"
      ? a.published
      : !a.published
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await onDelete(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  if (isLoading)
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );

  return (
    <>
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">
              Kelola Artikel{" "}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {filtered.length}
              </span>
            </p>
          </div>
          <div className="flex gap-1.5">
            {(["all", "published", "draft"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {s === "all" ? "Semua" : s === "published" ? "Publik" : "Draft"}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Tidak ada artikel.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {a.cover_image ? (
                    <img
                      src={a.cover_image}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{a.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {(a.article_categories as any)?.name && (
                      <span className="text-[10px] text-primary bg-primary/10 rounded-full px-1.5 py-0.5 font-semibold">
                        {(a.article_categories as any).name}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {format(parseISO(a.created_at), "d MMM yyyy", {
                        locale: idLocale,
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      a.published
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    )}
                  >
                    {a.published ? "Publik" : "Draft"}
                  </span>
                  <button
                    onClick={() => onView(a)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                    title="Lihat artikel"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onTogglePublish(a.id, !a.published)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                    title={a.published ? "Jadikan draft" : "Publikasikan"}
                  >
                    {a.published ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => onEdit(a)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: a.id, title: a.title })}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          title={deleteTarget.title}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isPending={isDeleting}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTICLE DETAIL PAGE — now with interactive related articles & categories
// ─────────────────────────────────────────────────────────────────────────────

function ArticleDetail({
  article,
  onBack,
  relatedArticles,
  categories,
  onSelectRelatedArticle,
  onSelectCategory,
}: {
  article: Article;
  onBack: () => void;
  relatedArticles: Article[];
  categories: Category[];
  onSelectRelatedArticle: (article: Article) => void;
  onSelectCategory: (categoryId: string) => void;
}) {
  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke Artikel
      </button>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div id="article-main-column">
          <ArticleDisplayCard
            title={article.title}
            excerpt={article.excerpt}
            coverImage={article.cover_image}
            authorName={article.author_name}
            categoryName={(article.article_categories as any)?.name ?? null}
            createdAt={article.created_at}
            readMinutes={article.read_minutes}
            content={article.content}
          />
        </div>
        <aside className="space-y-5">
          {relatedArticles.length > 0 && (
            <div className="rounded-2xl border border-border bg-card shadow-card p-5">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Artikel Terkait
              </h3>
              <div className="space-y-3">
                {relatedArticles.map((a) => (
                  <div
                    key={a.id}
                    className="flex gap-3 group cursor-pointer"
                    onClick={() => onSelectRelatedArticle(a)}
                  >
                    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {a.cover_image ? (
                        <img
                          src={a.cover_image}
                          alt=""
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <BookOpen className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                        {a.title}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {format(parseISO(a.created_at), "d MMM yyyy", {
                          locale: idLocale,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {categories.length > 0 && (
            <div className="rounded-2xl border border-border bg-card shadow-card p-5">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" /> Kategori
              </h3>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <span
                    key={c.id}
                    className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                    onClick={() => onSelectCategory(c.id)}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTICLE FORM MODAL — single column, lebar sama dengan detail artikel
// ─────────────────────────────────────────────────────────────────────────────

function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-1.5">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}

function ArticleFormModal({
  onClose,
  editItem,
  categories,
}: {
  onClose: () => void;
  editItem: Article | null;
  categories: Category[];
}) {
  const qc = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const contentRef = useRef<string>(editItem?.content ?? "");
  const [modalWidth, setModalWidth] = useState<number | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiMinimized, setAiMinimized] = useState(true);
  const [form, setForm] = useState({
    title: editItem?.title ?? "",
    excerpt: editItem?.excerpt ?? "",
    cover_image: editItem?.cover_image ?? "",
    author_name: editItem?.author_name ?? "Tim TaniAI",
    published: editItem?.published ?? false,
    category_id: editItem?.category_id ?? "",
    read_minutes: editItem?.read_minutes?.toString() ?? "",
  });

  // ─── Ukur lebar kolom artikel (jika ada) ─────────────────────────────
  useEffect(() => {
    const articleColumn = document.getElementById('article-main-column');
    if (!articleColumn) {
      setModalWidth(912); // fallback
      return;
    }
    const updateWidth = () => {
      setModalWidth(articleColumn.getBoundingClientRect().width);
    };
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(articleColumn);
    return () => resizeObserver.disconnect();
  }, []);

  // ─── Inisialisasi Quill Editor ──────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    injectSharedCSS();

    if (!document.getElementById("quill-snow-css")) {
      const link = document.createElement("link");
      link.id = "quill-snow-css";
      link.rel = "stylesheet";
      link.href =
        "https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css";
      document.head.appendChild(link);
    }

    let imgObserver: MutationObserver | null = null;

    function destroyQuill() {
      imgObserver?.disconnect();
      if (quillRef.current) {
        try {
          quillRef.current.off("text-change");
        } catch (_) {}
        quillRef.current = null;
      }
      if (editorRef.current) {
        editorRef.current.parentNode
          ?.querySelectorAll(".img-ctrl")
          .forEach((el) => el.remove());
        editorRef.current.innerHTML = "";
      }
      setEditorReady(false);
    }

    function initQuill() {
      if (!mounted || !editorRef.current || quillRef.current) return;
      const existingToolbar = editorRef.current.querySelector(".ql-toolbar");
      if (existingToolbar) existingToolbar.remove();
      editorRef.current.innerHTML = "";

      const Quill = (window as any).Quill;
      if (!Quill) return;
      if (!Quill.imports["modules/imageResize"]) {
        Quill.register("modules/imageResize", ImageResizeModule);
      }

      const instance = new Quill(editorRef.current, {
        theme: "snow",
        placeholder: "Tulis konten artikel...",
        modules: {
          toolbar: {
            container: [
              [{ header: [1, 2, 3, false] }],
              ["bold", "italic", "underline", "strike"],
              [{ list: "ordered" }, { list: "bullet" }],
              [{ indent: "-1" }, { indent: "+1" }],
              [{ align: [] }],
              ["link", "image"],
              ["blockquote", "code-block"],
              ["clean"],
            ],
            handlers: {
              image: () => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/jpeg,image/png,image/webp";
                input.click();
                input.onchange = async () => {
                  const file = input.files?.[0];
                  if (!file) return;
                  if (
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      file.type
                    )
                  ) {
                    toast.error("Format tidak didukung (JPG/PNG/WebP)");
                    return;
                  }
                  if (file.size > 2 * 1024 * 1024) {
                    toast.error("Maksimal 2MB per gambar");
                    return;
                  }
                  setUploadingImage(true);
                  try {
                    const ext =
                      file.name.split(".").pop()?.toLowerCase() ?? "jpg";
                    const fileName = `content/${Date.now()}-${Math.random()
                      .toString(36)
                      .slice(2)}.${ext}`;
                    const { error: upErr } = await supabase.storage
                      .from("articles")
                      .upload(fileName, file, {
                        cacheControl: "31536000",
                        contentType: file.type,
                      });
                    if (upErr) throw upErr;
                    const { data: urlData } = supabase.storage
                      .from("articles")
                      .getPublicUrl(fileName);
                    const q = quillRef.current;
                    if (q) {
                      const range = q.getSelection(true);
                      const idx = range?.index ?? q.getLength();
                      q.insertEmbed(idx, "image", urlData.publicUrl);
                      setTimeout(() => {
                        const imgs = q.root.querySelectorAll("img");
                        const newImg = imgs[imgs.length - 1];
                        if (newImg && !newImg.style.marginLeft)
                          applyImageLayout(newImg, "block-center");
                        contentRef.current = q.root.innerHTML;
                      }, 50);
                      q.setSelection(idx + 1);
                      contentRef.current = q.root.innerHTML;
                    }
                    toast.success("Gambar berhasil diunggah");
                  } catch (err: any) {
                    toast.error(`Gagal upload: ${err.message}`);
                  } finally {
                    setUploadingImage(false);
                  }
                };
              },
            },
          },
          imageResize: {},
        },
      });

      quillRef.current = instance;

      const resizeModule = instance.getModule(
        "imageResize"
      ) as ImageResizeModule | undefined;
      resizeModule?.setContentRef(contentRef);

      if (editItem?.content) {
        instance.root.innerHTML = editItem.content;
        contentRef.current = editItem.content;
      }

      instance.on("text-change", () => {
        contentRef.current = quillRef.current?.root.innerHTML ?? "";
      });

      imgObserver = new MutationObserver((mutations) => {
        const hasStyleChange = mutations.some(
          (m) =>
            m.type === "attributes" &&
            (m.target as HTMLElement).tagName === "IMG"
        );
        if (hasStyleChange && quillRef.current) {
          contentRef.current = quillRef.current.root.innerHTML ?? "";
        }
      });
      imgObserver.observe(instance.root, {
        attributes: true,
        attributeFilter: ["style"],
        subtree: true,
      });

      if (mounted) setEditorReady(true);
    }

    const timer = setTimeout(() => {
      if ((window as any).Quill) {
        initQuill();
      } else {
        if (!document.getElementById("quill-script")) {
          const script = document.createElement("script");
          script.id = "quill-script";
          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js";
          script.onload = () => {
            if (mounted) initQuill();
          };
          document.body.appendChild(script);
        } else {
          const retry = setInterval(() => {
            if ((window as any).Quill) {
              clearInterval(retry);
              if (mounted) initQuill();
            }
          }, 100);
        }
      }
    }, 80);

    return () => {
      mounted = false;
      clearTimeout(timer);
      destroyQuill();
    };
  }, []);

  // ─── AI Generate ────────────────────────────────────────────────────
  const handleGenerateContent = async () => {
    if (!form.title.trim()) {
      toast.error("Judul harus diisi dulu");
      return;
    }
    setGeneratingAI(true);
    try {
      const categoryName =
        categories.find((c) => c.id === form.category_id)?.name ||
        "Pertanian";
      const html = await generateArticleContent({
        title: form.title,
        excerpt: form.excerpt || undefined,
        category: categoryName,
      });
      if (!html?.trim()) throw new Error("Konten kosong dari AI");
      if (quillRef.current) {
        quillRef.current.root.innerHTML = html;
        contentRef.current = html;
        toast.success("Konten berhasil digenerate!");
        setAiMinimized(true);
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal generate konten");
    } finally {
      setGeneratingAI(false);
    }
  };

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = "Judul wajib diisi";
    const c = contentRef.current;
    if (!c || c === "<p><br></p>" || c.trim() === "")
      errors.content = "Konten wajib diisi";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function setField<K extends keyof typeof form>(
    key: K,
    val: (typeof form)[K]
  ) {
    setForm((f) => ({ ...f, [key]: val }));
    if (fieldErrors[key])
      setFieldErrors((e) => {
        const c = { ...e };
        delete c[key];
        return c;
      });
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error("__validation__");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");
      let content = contentRef.current;
      if (!content || content === "<p><br></p>")
        throw new Error("Konten wajib diisi");
      const editorWidth =
        editorRef.current?.querySelector(".ql-editor")?.clientWidth ??
        editorRef.current?.clientWidth ??
        680;
      content = convertImageWidthsToPercent(content, editorWidth);
      content = normalizeImageFloats(content);
      const readMin = form.read_minutes
        ? parseInt(form.read_minutes)
        : null;
      const payload = {
        title: form.title.trim(),
        excerpt: form.excerpt.trim() || null,
        content,
        cover_image: form.cover_image.trim() || null,
        author_name: form.author_name.trim() || "Tim TaniAI",
        published: form.published,
        category_id: form.category_id || null,
        read_minutes: readMin,
      };
      if (editItem) {
        const oldPaths = extractStoragePaths(
          editItem.content,
          editItem.cover_image
        );
        const newPaths = extractStoragePaths(content, form.cover_image);
        await deleteStorageFiles(
          oldPaths.filter((p) => !newPaths.includes(p))
        );
        const { error } = await supabase
          .from("articles")
          .update(payload)
          .eq("id", editItem.id);
        if (error) throw error;
      } else {
        const slug =
          form.title
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
            .slice(0, 80) +
          "-" +
          Date.now();
        const { error } = await supabase
          .from("articles")
          .insert({ ...payload, slug });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      toast.success(editItem ? "Artikel diperbarui" : "Artikel disimpan");
      onClose();
    },
    onError: (e: Error) => {
      if (e.message !== "__validation__") toast.error(e.message);
    },
  });

  const isBusy = mutation.isPending || uploadingImage || generatingAI;

  // ─── Render Modal dengan lebar dinamis ───────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-[930px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 shrink-0">
          <div>
            <h2 className="text-sm font-bold">
              {editItem ? "Edit Artikel" : "Tulis Artikel Baru"}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {editItem ? `Mengedit: ${editItem.title}` : "Isi detail artikel di bawah ini"}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isBusy}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* BODY: scrollable area */}
        <div className="flex-1 overflow-y-auto overflow-x-auto px-5 py-4 space-y-5">
          {/* Title */}
          <div>
            <FieldLabel required>Judul Artikel</FieldLabel>
            <input
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Judul yang menarik dan informatif..."
              disabled={isBusy}
              className={cn(
                inputCls,
                "font-medium text-base",
                fieldErrors.title && "border-destructive"
              )}
            />
            {fieldErrors.title && (
              <p className="mt-1.5 text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {fieldErrors.title}
              </p>
            )}
          </div>

          {/* Excerpt */}
          <div>
            <FieldLabel>Ringkasan</FieldLabel>
            <textarea
              value={form.excerpt}
              onChange={(e) => setField("excerpt", e.target.value)}
              placeholder="Deskripsi singkat yang menarik pembaca..."
              rows={2}
              disabled={isBusy}
              className={cn(inputCls, "resize-none")}
            />
          </div>

          {/* Rich text editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel required>Konten Artikel</FieldLabel>
              {uploadingImage && (
                <span className="flex items-center gap-1 text-[11px] text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" /> Mengunggah...
                </span>
              )}
            </div>

            <div className="relative">
              <div
                className={cn(
                  "rounded-xl border overflow-hidden bg-background transition-all",
                  fieldErrors.content
                    ? "border-destructive"
                    : "border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
                )}
              >
                {!editorReady && (
                  <div className="flex flex-col items-center justify-center h-52 gap-3 bg-muted/20 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <p className="text-xs">Memuat editor...</p>
                  </div>
                )}
                <div
                  ref={editorRef}
                  style={{ display: editorReady ? "block" : "none" }}
                  className={cn(
                    "[&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-border/60 [&_.ql-toolbar]:bg-muted/30 [&_.ql-toolbar]:sticky [&_.ql-toolbar]:top-0 [&_.ql-toolbar]:z-10",
                    "[&_.ql-container]:border-0",
                    "[&_.ql-editor]:min-h-[420px] [&_.ql-editor]:text-base [&_.ql-editor]:px-6 [&_.ql-editor]:sm:px-8 [&_.ql-editor]:py-4 [&_.ql-editor]:leading-relaxed",
                    "[&_.ql-editor]:relative [&_.ql-editor]:overflow-x-auto",
                    isBusy && "[&_.ql-editor]:pointer-events-none [&_.ql-editor]:opacity-60"
                  )}
                />
              </div>

              {/* AI Button */}
              <div className="absolute bottom-3 right-3 z-10">
                {aiMinimized ? (
                  <button
                    type="button"
                    onClick={() => setAiMinimized(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 hover:scale-105 transition-all"
                    title="Generate dengan AI"
                  >
                    <Bot className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-card shadow-xl p-2">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5 bg-green-600 hover:bg-green-700 text-white h-8"
                      onClick={handleGenerateContent}
                      disabled={!form.title.trim() || generatingAI || !editorReady}
                    >
                      {generatingAI ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Bot className="h-3.5 w-3.5" />
                      )}
                      {generatingAI ? "Generate..." : "Generate AI"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setAiMinimized(true)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            {fieldErrors.content && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-destructive">
                <AlertCircle className="h-3 w-3" />
                {fieldErrors.content}
              </p>
            )}
          </div>

          {/* Cover image URL */}
          <div>
            <FieldLabel>URL Thumbnail</FieldLabel>
            <div className="relative">
              <ImageIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={form.cover_image}
                onChange={(e) => setField("cover_image", e.target.value)}
                placeholder="https://..."
                disabled={isBusy}
                className={cn(inputCls, "pl-9")}
              />
            </div>
          </div>

          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Penulis</FieldLabel>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={form.author_name}
                  onChange={(e) => setField("author_name", e.target.value)}
                  disabled={isBusy}
                  className={cn(inputCls, "pl-9")}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Baca (menit)</FieldLabel>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={form.read_minutes}
                  onChange={(e) => setField("read_minutes", e.target.value)}
                  placeholder="5"
                  className={cn(inputCls, "pl-9")}
                />
              </div>
            </div>
            <div className="col-span-2">
              <FieldLabel>Kategori</FieldLabel>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={form.category_id}
                  onChange={(e) => setField("category_id", e.target.value)}
                  className={cn(inputCls, "pl-9 pr-9 appearance-none")}
                >
                  <option value="">— Tanpa Kategori —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Publish toggle */}
          <button
            type="button"
            onClick={() => !isBusy && setField("published", !form.published)}
            disabled={isBusy}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
              form.published
                ? "border-success/30 bg-success/5 hover:bg-success/10"
                : "border-border bg-muted/30 hover:bg-muted/50",
              isBusy && "opacity-50 cursor-not-allowed"
            )}
          >
            <div
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                form.published ? "bg-success" : "bg-muted-foreground/30"
              )}
            >
              <div
                className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{
                  transform: form.published
                    ? "translateX(1.375rem)"
                    : "translateX(0.25rem)",
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {form.published ? "Publikasikan sekarang" : "Simpan sebagai draft"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {form.published
                  ? "Terlihat semua pengguna"
                  : "Hanya admin yang bisa lihat"}
              </p>
            </div>
            {form.published ? (
              <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success shrink-0">
                <CheckCircle2 className="h-3 w-3" /> Publik
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground shrink-0">
                <EyeOff className="h-3 w-3" /> Draft
              </span>
            )}
          </button>

          {/* Error banner */}
          {Object.keys(fieldErrors).length > 0 && !mutation.isPending && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <p className="text-xs text-destructive">
                Perbaiki field yang ditandai sebelum menyimpan
              </p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex gap-2 border-t border-border px-5 py-3.5 shrink-0">
          <Button
            variant="outline"
            className="flex-1 rounded-xl h-10 text-sm"
            onClick={onClose}
            disabled={isBusy}
          >
            Batal
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={isBusy || !form.title.trim()}
            className="flex-1 gap-2 rounded-xl h-10 text-sm font-semibold bg-gradient-to-r from-primary to-primary/80"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {editItem ? "Simpan Perubahan" : "Simpan Artikel"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETONS & EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function ArticlesGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
        >
          <Skeleton className="aspect-video w-full" />
          <div className="p-5 space-y-2.5">
            <Skeleton className="h-3.5 w-1/3 rounded-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  search,
  isAdmin,
  onWrite,
}: {
  search: string;
  isAdmin: boolean;
  onWrite: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card/50 py-16 text-center px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <BookOpen className="h-8 w-8 text-primary/40" />
      </div>
      <div>
        <p className="font-semibold text-lg">
          {search ? "Artikel tidak ditemukan" : "Belum ada artikel"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {search
            ? `Tidak ada yang cocok dengan "${search}".`
            : "Artikel pertanian akan segera hadir."}
        </p>
      </div>
      {isAdmin && !search && (
        <Button onClick={onWrite} className="gap-2 mt-1">
          <Plus className="h-4 w-4" /> Tulis Artikel Pertama
        </Button>
      )}
    </div>
  );
}