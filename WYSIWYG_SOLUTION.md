# WYSIWYG Float Image Solution - Dokumentasi

## 📋 Ringkasan

Solusi WYSIWYG lengkap untuk artikel Quill editor di TaniAI Nexus yang memastikan **gambar floating (left/right) tampil konsisten antara editor dan halaman detail**.

## 🎯 Masalah yang Diselesaikan

1. **Float tidak konsisten**: Gambar di editor bisa di-float (kiri/kanan), tapi tidak tampil sama di detail page
2. **Ukuran berubah**: Pixel width di editor tidak tekonversi untuk responsive display
3. **Teks tidak mengalir natural**: Float tidak bekerja karena CSS overflow:hidden pada container
4. **Preview tidak akurat**: Split panel preview tidak mencerminkan final output

## ✨ Solusi Implementasi

### 1. **CSS Float Fix**
File: `SHARED_ARTICLE_CSS` di `articles.tsx` (lines 131-397)

**Key Points:**
- ❌ **NO** `overflow:hidden` di paragraph atau container (breaks float containment)
- ✅ Clearfix divs (`.float-clearfix`) untuk mark end of float context
- ✅ CSS selector untuk float images: `img[style*="float: left"]`, `img[style*="float: right"]`
- ✅ Sama untuk `.ql-editor` (editor) dan `.article-content` (display)

**CSS Layers:**
- Base layout: word-break + overflow-wrap
- Float images: explicit float + margin rules
- Block images: margin auto centering
- Clearfix: block clear untuk end float
- Typography: h1-h6, ul/ol, blockquote, code, dll dengan `clear: both`

### 2. **HTML Normalization**
Functions: `convertImageWidthsToPercent()` + `normalizeImageFloats()` (lines 399-474)

**Flow:**
```
Raw HTML (pixel widths)
    ↓
convertImageWidthsToPercent()
    → Parse img width (px), convert to % based on editor width
    → Clamp 10%-100%
    ↓
normalizeImageFloats()
    → Extract float images from <p> tags → move as siblings
    → Remove empty <p> tags
    → Insert clearfix divs after float groups
    ↓
Normalized HTML (ready for storage)
```

**Key Logic:**
- Pixel to percent: `(px / editorWidth) * 100`
- Float extraction: Move `<img style="float:left/right">` out of `<p>`
- Clearfix insertion: Between float groups and block elements (h1-h6, ul, ol, blockquote, pre, hr, table)

### 3. **Live Preview (Split Panel)**
- **Editor Panel** (left): Quill editor + form fields
- **Preview Panel** (right): Real-time preview with SAME CSS as detail page
- **Debounced sync** (300ms): Update preview when content/layout changes
- **Mobile toggle**: Switch editor/preview on small screens

### 4. **Image Resize Module**
Class: `ImageResizeModule` (lines 476-788)

**Features:**
- ✅ Click image → toolbar appears with layout options
- ✅ 6 layout modes: wrap-left, wrap-right, block-left, block-center, block-right, full-width
- ✅ Width presets: 25%, 50%, 75%, 100%
- ✅ Drag resize handle (green dot) untuk custom width
- ✅ Sync content setiap kali layout/width berubah
- ✅ MutationObserver untuk track style changes

### 5. **AI Generation Button**
- **Floating green button** (hijau) di bottom-right editor
- **Minimize/Expand**: Click untuk expand form
- **Generate**: Buat konten berdasarkan title + category
- **Direct inject**: Replace editor content with AI output

### 6. **ArticleContentRenderer**
Component: `ArticleContentRenderer()` (lines 790-880)

**Fungsi:**
- Render HTML content dengan post-processing sama seperti normalization
- Extract float images → insert clearfixes
- Ensure semua img punya height:auto
- Pakai same CSS class `.article-content` seperti preview

## 🔄 User Flow

### Membuat/Edit Artikel:

1. **Klik "Tulis Artikel"** → Modal membuka (split panel)
2. **Edit di editor** (left panel):
   - Type judul, excerpt, konten
   - Upload/paste gambar
   - Klik gambar → layout toolbar
   - Pilih layout (float/block) + width
3. **Live preview** (right panel):
   - Update real-time (debounced 300ms)
   - Sama persis seperti detail page
   - See float + text wrapping
4. **AI Button** (green, bottom-right):
   - Click untuk expand
   - Fill judul (required)
   - Click "Generate AI"
   - Content auto-generated + injected
5. **Save** → Normalisasi HTML:
   - Pixel width → percent
   - Float images → extracted + clearfixes
   - Store to DB
6. **View article** → Detail page:
   - Render dengan ArticleContentRenderer
   - Same CSS + post-processing
   - Float + text layout exactly like preview

### Melihat Artikel:

1. **Browse articles** → Article cards grid
2. **Click "Baca"** → Detail page
3. **Content rendered** dengan:
   - Cover image
   - Title, author, category, read time
   - Article content (ArticleContentRenderer)
   - Related articles sidebar
4. **Float images** bekerja natural:
   - Teks mengalir di samping
   - Clearfix setelah float groups
   - Block images centered/left/right

## 📝 Technical Details

### Pixel to Percent Conversion

```typescript
editorWidth = 680px (default, atau actual .ql-editor width)
imagePixelWidth = 300px
percentage = (300 / 680) * 100 = 44%
clamped = Math.max(10, Math.min(100, 44)) = 44%
```

### Float Context Tracking

```
IMG (float:left) → inFloatContext = true
P                → continue (part of float context)
H2               → inFloatContext = true → insert clearfix before H2 → inFloatContext = false
P                → continue
IMG (no float)   → insert clearfix before IMG → inFloatContext = false
```

### CSS Clearfix Mechanism

```css
.float-clearfix {
  clear: both;          /* ends float context */
  display: block;
  height: 0;           /* invisible */
  overflow: hidden;
  visibility: hidden;
}
```

Inserted before block elements (h1-h6, ul, ol, etc) atau di end of container jika float masih active.

## 🎨 Image Layout Modes

| Mode | Behavior | CSS |
|------|----------|-----|
| wrap-left | Teks melingkar kanan | `float: left; margin: 0 16px 8px 0` |
| wrap-right | Teks melingkar kiri | `float: right; margin: 0 0 8px 16px` |
| block-left | Blok rata kiri | `margin-left: 0; margin-right: auto` |
| block-center | Blok tengah | `margin: auto` |
| block-right | Blok rata kanan | `margin-left: auto; margin-right: 0` |
| full-width | Lebar penuh | `width: 100%; margin: 0` |

## 🚀 Performance Optimizations

1. **Debounced preview sync** (300ms) - Avoid excessive re-renders
2. **MutationObserver** - Track only style attribute changes
3. **LazyLoad images** - `loading="lazy"` di article cards
4. **CSS classes** - Reuse `.ql-editor` + `.article-content` 
5. **Clearfix DIVs** - Minimal DOM overhead

## ⚙️ Configuration

### Editor Width (for pixel→percent conversion)

```typescript
const editorWidth = 
  editorRef.current?.querySelector(".ql-editor")?.clientWidth
  ?? editorRef.current?.clientWidth
  ?? 680; // default fallback
```

Adjust based on your actual editor container width.

### Image Constraints

- Max file size: **2MB**
- Allowed formats: **JPG, PNG, WebP**
- Min width: **10%**
- Max width: **100%**

## 🔍 Debugging Tips

### Issue: Float tidak bekerja di preview

**Check:**
1. Pastikan CSS class `.article-content` tidak punya `overflow:hidden`
2. Verify `normalizeImageFloats()` executed saat save
3. Check browser DevTools: `Elements` → inspect `.article-content`

### Issue: Gambar terlalu besar/kecil

**Check:**
1. Editor width detection: `console.log(editorWidth)`
2. Pixel width conversion: `(px / editorWidth) * 100`
3. If needed, adjust clamp range: `Math.max(10, Math.min(100, pct))`

### Issue: Preview tidak update

**Check:**
1. `triggerPreviewSync()` called after content change
2. Debounce timeout: 300ms (adjust if needed)
3. MutationObserver: Check if style changes detected

## 📦 No Database Schema Changes

✅ Semua data tetap sama:
- `articles.content` → simpan HTML normalisasi saja
- `articles.cover_image` → URL tetap sama
- Tidak ada kolom baru

## 🎯 File Structure

```
src/routes/_authenticated/articles.tsx
├── CSS: SHARED_ARTICLE_CSS (lines 131-397)
├── Helpers: extractStoragePaths, deleteStorageFiles (lines 399-396)
├── Normalization: convertImageWidthsToPercent, normalizeImageFloats, insertFloatClearfixes (lines 399-474)
├── ImageResizeModule (lines 476-788)
├── ArticleContentRenderer (lines 790-880)
├── ArticlesPage (lines 882-1061)
├── ArticleCard (lines 1063-1291)
├── AdminArticleTable (lines 1293-1404)
├── ArticleDetail (lines 1406-1579)
├── ArticleFormModal (lines 1581-2530)
├── Skeletons & EmptyState (lines 2532-end)
```

## ✅ Testing Checklist

- [ ] Create article dengan gambar
- [ ] Set gambar ke float-left/wrap-right
- [ ] Save artikel
- [ ] View di detail page → Float bekerja?
- [ ] Text melingkar di samping gambar? ✓
- [ ] Resize gambar (drag green handle)
- [ ] Live preview update real-time? ✓
- [ ] Clearfix setelah float group?
- [ ] Block heading tidak overlap gambar?
- [ ] Mobile: Toggle editor/preview ✓
- [ ] AI button: Generate konten ✓
- [ ] Edit existing article → layout preserved? ✓

## 🤝 Support

Jika ada issues:
1. Check console errors (DevTools F12)
2. Verify Quill script loaded (`window.Quill`)
3. Check CSS class applied (`.article-content`, `.ql-editor`)
4. Verify normalization logic (run `normalizeImageFloats()` in console)
