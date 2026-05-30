// src/routes/_authenticated/plants.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlants, useAddPlant, useDeletePlant, useUpdatePlantStatus, type UserPlantWithAge } from "@/hooks/useUserPlants";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, Sprout, MapPin, Calendar, X,
  Edit2, Droplets, Sun, Check, MessageCircle, StickyNote,
  ChevronDown, ChevronUp, Search,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/plants")({
  head: () => ({ meta: [{ title: "Tanaman Saya — TaniAI Nexus" }] }),
  component: PlantsPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlantNote {
  id: string;
  text: string;
  updated_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLANT_TYPES_LIST = [
  "Padi", "Jagung", "Cabai", "Tomat", "Kedelai", "Bawang Merah",
  "Bawang Putih", "Kentang", "Singkong", "Ubi Jalar", "Kopi",
  "Kakao", "Pisang", "Mangga", "Jeruk", "Pepaya", "Tebu", "Lainnya",
];

const SOIL_OPTIONS = [
  { value: "Kering", icon: "☀️", desc: "Tanah retak/berdebu" },
  { value: "Normal", icon: "✅", desc: "Lembap ideal" },
  { value: "Basah/Becek", icon: "💧", desc: "Jenuh air" },
];

const STATUS_OPTIONS = [
  { value: "Aktif", color: "bg-success/10 text-success border-success/20" },
  { value: "Panen", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "Mati", color: "bg-muted text-muted-foreground border-border" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPlantEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("padi") || n.includes("beras")) return "🌾";
  if (n.includes("jagung")) return "🌽";
  if (n.includes("cabai") || n.includes("cabe")) return "🌶️";
  if (n.includes("tomat")) return "🍅";
  if (n.includes("bawang")) return "🧅";
  if (n.includes("kentang")) return "🥔";
  if (n.includes("singkong")) return "🥕";
  if (n.includes("pisang")) return "🍌";
  if (n.includes("mangga")) return "🥭";
  if (n.includes("jeruk")) return "🍊";
  if (n.includes("kopi")) return "☕";
  if (n.includes("kakao")) return "🍫";
  if (n.includes("kedelai")) return "🫘";
  return "🌱";
}

function parseNotes(raw: unknown): PlantNote[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed as PlantNote[];
  } catch {
    if (typeof raw === "string" && raw.trim()) {
      return [{ id: crypto.randomUUID(), text: raw.trim(), updated_at: new Date().toISOString() }];
    }
  }
  return [];
}

function buildAIQuery(plant: UserPlantWithAge, notes: PlantNote[]): string {
  const base = `Tanaman ${plant.name} saya berumur ${plant.age_days} HST, kondisi tanah ${plant.soil_condition}${plant.location ? `, lokasi ${plant.location}` : ""}.`;
  if (notes.length > 0) {
    const noteLines = notes
      .slice(-3)
      .map((n) => `- ${n.text}`)
      .join("\n");
    return `${base}\n\nCatatan saya:\n${noteLines}\n\nBerdasarkan kondisi dan catatan di atas, apa saran perawatan dan hal yang perlu diwaspadai?`;
  }
  return `${base} Apa saran perawatan dan hal yang perlu diwaspadai saat ini?`;
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  plantName,
  onConfirm,
  onCancel,
  isPending,
}: {
  plantName: string;
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
        <h3 className="font-bold text-base">Hapus Tanaman?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{plantName}</span> akan dihapus permanen beserta semua catatannya.
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

// ─── Custom Dropdown dengan Search ───────────────────────────────────────────

interface PlantDropdownProps {
  value: string;
  onChange: (value: string) => void;
  onCustomChange?: (value: string) => void;
}

function PlantDropdown({ value, onChange, onCustomChange }: PlantDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter tanaman berdasarkan search
  const filteredPlants = PLANT_TYPES_LIST.filter((plant) =>
    plant.toLowerCase().includes(search.toLowerCase())
  );

  // Cek apakah search query adalah "Lainnya" atau tidak ditemukan
  const isSearchNotFound = search.trim() !== "" && 
    !PLANT_TYPES_LIST.some(plant => plant.toLowerCase() === search.trim().toLowerCase()) &&
    search.trim().toLowerCase() !== "lainnya";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (plant: string) => {
    onChange(plant);
    onCustomChange?.(""); // reset custom
    setIsOpen(false);
    setSearch("");
  };

  const handleUseCustomSearch = () => {
    if (search.trim()) {
      // Langsung kirim nama tanaman tanpa "Lainnya"
      onChange(search.trim());
      onCustomChange?.(search.trim());
      setIsOpen(false);
      setSearch("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && search.trim()) {
      e.preventDefault();
      handleUseCustomSearch();
    }
  };

  // Tampilkan nilai yang dipilih
  const selectedEmoji = value ? getPlantEmoji(value) : "🌱";
  const displayValue = value || "";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
      >
        <span className="flex items-center gap-2">
          {displayValue ? (
            <>
              <span>{selectedEmoji}</span>
              <span className="truncate">{displayValue}</span>
            </>
          ) : (
            <span className="text-muted-foreground">— Pilih atau ketik jenis tanaman —</span>
          )}
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-card shadow-elevated">
          {/* Search input */}
          <div className="sticky top-0 bg-card p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik nama tanaman..."
                className="w-full rounded-lg border border-input bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                autoFocus
              />
            </div>
          </div>

          <div className="py-1">
            {/* Saran dari daftar */}
            {filteredPlants.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Saran
                </div>
                {filteredPlants.map((plant) => (
                  <button
                    key={plant}
                    type="button"
                    onClick={() => handleSelect(plant)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left hover:bg-muted/50",
                      displayValue === plant && "bg-primary/8 text-primary font-medium"
                    )}
                  >
                    <span className="text-base w-6 text-center">{getPlantEmoji(plant)}</span>
                    <span>{plant}</span>
                    {displayValue === plant && (
                      <Check className="ml-auto h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </>
            )}

            {/* Opsi untuk menggunakan teks sebagai custom */}
            {isSearchNotFound && (
              <>
                {filteredPlants.length > 0 && <div className="border-t border-border my-1" />}
                <button
                  type="button"
                  onClick={handleUseCustomSearch}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left hover:bg-primary/10"
                >
                  <span className="text-base w-6 text-center">✨</span>
                  <div className="flex flex-col flex-1">
                    <span>
                      Gunakan "<span className="font-medium text-primary">{search}</span>"
                    </span>
                    <span className="text-[10px] text-muted-foreground">(tanaman tidak terdaftar)</span>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                </button>
              </>
            )}

            {/* Pesan ketika search kosong */}
            {!search.trim() && filteredPlants.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                Mulai ketik nama tanaman...
              </div>
            )}

            {/* Pesan ketika search ditemukan tapi tidak ada di daftar? seharusnya sudah di-handle di atas */}
            {search.trim() && !isSearchNotFound && filteredPlants.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                Tidak ada tanaman yang cocok
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Plant Modal ──────────────────────────────────────────────────────────

function AddPlantModal({ onClose }: { onClose: () => void }) {
  const addPlant = useAddPlant();
  const [form, setForm] = useState({
    name: "",        // langsung berisi nama tanaman (bisa dari list atau custom)
    plant_date: format(new Date(), "yyyy-MM-dd"),
    soil_condition: "Normal",
    notes: "",
  });

  const handlePlantChange = (value: string) => {
    setForm((f) => ({ ...f, name: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.plant_date) {
      toast.error("Nama tanaman dan tanggal tanam wajib diisi");
      return;
    }
    await addPlant.mutateAsync({
      name: form.name,
      type: form.name, // type sama dengan name
      plant_date: form.plant_date,
      soil_condition: form.soil_condition,
      notes: form.notes || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-elevated overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-bold text-base">Tambah Tanaman</h2>
            <p className="text-xs text-muted-foreground">Data lengkap untuk rekomendasi AI yang akurat</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
          {/* Pilih Tanaman - 1 input saja! */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Nama Tanaman *
            </label>
            <PlantDropdown 
              value={form.name} 
              onChange={handlePlantChange}
            />
          </div>

          {/* Tanggal tanam */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Tanggal Tanam *
            </label>
            <input
              type="date"
              value={form.plant_date}
              onChange={(e) => setForm((f) => ({ ...f, plant_date: e.target.value }))}
              max={format(new Date(), "yyyy-MM-dd")}
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Kondisi Tanah */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Kondisi Tanah
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SOIL_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, soil_condition: s.value }))}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-xs font-medium transition-all text-center",
                    form.soil_condition === s.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-muted/20 hover:border-primary/30"
                  )}
                >
                  <span className="text-xl">{s.icon}</span>
                  <span>{s.value}</span>
                  <span className="text-[9px] font-normal text-muted-foreground">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Catatan Awal */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Catatan Awal (opsional)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Varietas, kondisi khusus, dll..."
              rows={2}
              className="mt-1.5 w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-primary to-primary/80"
              disabled={addPlant.isPending || !form.name}
            >
              {addPlant.isPending ? "Menyimpan..." : "Tambah Tanaman"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Notes Section ─────────────────────────────────────────────────────────────

interface NotesSectionProps {
  plantId: string;
  rawNotes: unknown;
  onNotesChange?: (notes: PlantNote[]) => void;
}

function NotesSection({ plantId, rawNotes, onNotesChange }: NotesSectionProps) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<PlantNote[]>(() => parseNotes(rawNotes));
  const [addingNew, setAddingNew] = useState(false);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const persistNotes = useMutation({
    mutationFn: async (updated: PlantNote[]) => {
      const { error } = await supabase
        .from("user_plants")
        .update({ notes: JSON.stringify(updated) } as any)
        .eq("id", plantId);
      if (error) throw error;
      return updated;
    },
    onSuccess: (updated) => {
      setNotes(updated);
      onNotesChange?.(updated);
      qc.invalidateQueries({ queryKey: ["user-plants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAdd = () => {
    if (!newText.trim()) return;
    const updated = [
      ...notes,
      { id: crypto.randomUUID(), text: newText.trim(), updated_at: new Date().toISOString() },
    ];
    persistNotes.mutate(updated, {
      onSuccess: () => {
        setNewText("");
        setAddingNew(false);
        toast.success("Catatan ditambahkan");
      },
    });
  };

  const handleEdit = (id: string) => {
    if (!editText.trim()) return;
    const updated = notes.map((n) =>
      n.id === id ? { ...n, text: editText.trim(), updated_at: new Date().toISOString() } : n
    );
    persistNotes.mutate(updated, {
      onSuccess: () => {
        setEditingId(null);
        toast.success("Catatan diperbarui");
      },
    });
  };

  const handleDelete = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    persistNotes.mutate(updated, {
      onSuccess: () => toast.success("Catatan dihapus"),
    });
  };

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          <StickyNote className="h-3 w-3" /> Catatan
          {notes.length > 0 && (
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px]">{notes.length}</span>
          )}
        </span>
        {!addingNew && (
          <button
            onClick={() => setAddingNew(true)}
            className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/8 transition-colors"
          >
            <Plus className="h-3 w-3" /> Tambah
          </button>
        )}
      </div>

      {notes.length > 0 && (
        <div className="space-y-1">
          {notes.map((note) =>
            editingId === note.id ? (
              <div key={note.id} className="flex gap-1.5 items-start">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={2}
                  autoFocus
                  className="flex-1 resize-none rounded-lg border border-primary bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20"
                />
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => handleEdit(note.id)}
                    disabled={persistNotes.isPending}
                    className="rounded-lg bg-primary p-1.5 text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg bg-muted p-1.5 text-muted-foreground hover:bg-muted/80 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={note.id}
                className="group/note flex items-start gap-2 rounded-lg bg-muted/30 px-2.5 py-2 hover:bg-muted/50 transition-colors"
              >
                <p className="flex-1 text-xs leading-relaxed">{note.text}</p>
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/note:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingId(note.id); setEditText(note.text); }}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Edit catatan"
                  >
                    <Edit2 className="h-2.5 w-2.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Hapus catatan"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {addingNew && (
        <div className="flex gap-1.5 items-start">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={2}
            autoFocus
            placeholder="Varietas, kondisi khusus, dll..."
            className="flex-1 resize-none rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(); }
              if (e.key === "Escape") { setAddingNew(false); setNewText(""); }
            }}
          />
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={handleAdd}
              disabled={persistNotes.isPending || !newText.trim()}
              className="rounded-lg bg-primary p-1.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={() => { setAddingNew(false); setNewText(""); }}
              className="rounded-lg bg-muted p-1.5 text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 && !addingNew && (
        <p className="text-[10px] text-muted-foreground/60 italic px-1">Belum ada catatan</p>
      )}
    </div>
  );
}

// ─── Plant Card ────────────────────────────────────────────────────────────────

function PlantCard({ plant }: { plant: UserPlantWithAge }) {
  const navigate = useNavigate();
  const deletePlant = useDeletePlant();
  const updateStatus = useUpdatePlantStatus();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentNotes, setCurrentNotes] = useState<PlantNote[]>(() => parseNotes(plant.notes));

  const emoji = getPlantEmoji(plant.name);
  const statusColor = STATUS_OPTIONS.find((s) => s.value === plant.status)?.color
    ?? "bg-muted text-muted-foreground border-border";

  const handleDelete = () => {
    deletePlant.mutate(plant.id, {
      onSuccess: () => {
        setShowDeleteModal(false);
        // toast sudah ditampilkan oleh useDeletePlant
      },
      onError: (e: Error) => {
        toast.error(e.message, { position: "top-right" });
        setShowDeleteModal(false);
      },
    });
  };

  const handleAskAI = () => {
    const query = buildAIQuery(plant, currentNotes);
    navigate({ to: "/assistant", search: { q: query } });
  };

  return (
    <>
      <div className="group rounded-2xl border border-border bg-card shadow-card overflow-hidden hover:shadow-elevated transition-all">
        <div className={cn(
          "h-1.5",
          plant.status === "Aktif" ? "bg-gradient-to-r from-success to-emerald-400"
            : plant.status === "Panen" ? "bg-gradient-to-r from-blue-500 to-sky-400"
            : "bg-muted"
        )} />

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                {emoji}
              </div>
              <div>
                <h3 className="font-bold">{plant.name}</h3>
                <p className="text-xs text-muted-foreground">{plant.type}</p>
              </div>
            </div>

            <div className="relative shrink-0">
              <button
                onClick={() => setShowStatusMenu((v) => !v)}
                className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors", statusColor)}
              >
                {plant.status}
              </button>
              {showStatusMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
                  <div className="absolute right-0 top-7 z-20 w-32 overflow-hidden rounded-xl border border-border bg-card shadow-elevated">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => {
                          updateStatus.mutate({ id: plant.id, status: s.value });
                          setShowStatusMenu(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-xs font-medium hover:bg-muted/50 transition-colors",
                          plant.status === s.value && "bg-muted/30"
                        )}
                      >
                        {s.value}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>Tanam: {format(parseISO(plant.plant_date), "d MMM yyyy", { locale: idLocale })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Sprout className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium text-foreground">{plant.age_days} HST</span>
            </div>
            {plant.location && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{plant.location}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              {plant.soil_condition === "Kering" ? (
                <Sun className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              ) : plant.soil_condition === "Basah/Becek" ? (
                <Droplets className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              ) : (
                <span className="text-xs">✅</span>
              )}
              <span className="text-muted-foreground">{plant.soil_condition}</span>
            </div>
          </div>

          <NotesSection
            plantId={plant.id}
            rawNotes={plant.notes}
            onNotesChange={setCurrentNotes}
          />

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleAskAI}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-medium hover:bg-primary/5 hover:border-primary/30 transition-colors"
            >
              <MessageCircle className="h-3 w-3" /> Tanya AI
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteConfirmModal
          plantName={plant.name}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          isPending={deletePlant.isPending}
        />
      )}
    </>
  );
}

// ─── Plants Page ───────────────────────────────────────────────────────────────

function PlantsPage() {
  const { data: plants = [], isLoading } = usePlants();
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<"semua" | "Aktif" | "Panen" | "Mati">("semua");

  const filtered = (filter as string) === "semua" ? plants : plants.filter((p) => p.status === (filter as string));
  const activePlants = plants.filter((p) => p.status === "Aktif");
  const totalAgeDays = activePlants.reduce((s, p) => s + p.age_days, 0);
  const avgAge = activePlants.length ? Math.round(totalAgeDays / activePlants.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tanaman Saya</h1>
          <p className="text-sm text-muted-foreground">
            {plants.length === 0
              ? "Tambahkan tanaman untuk mulai"
              : `${plants.length} tanaman terdaftar · ${activePlants.length} aktif`}
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="gap-2 bg-gradient-to-r from-primary to-primary/80 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Tambah Tanaman
        </Button>
      </div>

      {plants.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Tanaman", value: plants.length, icon: "🌱" },
            { label: "Sedang Aktif", value: activePlants.length, icon: "✅" },
            { label: "Rata-rata Umur", value: `${avgAge} HST`, icon: "📅" },
            { label: "Siap Panen", value: plants.filter((p) => p.age_days >= 75 && p.status === "Aktif").length, icon: "🌾" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4 text-center shadow-card">
              <p className="text-2xl">{s.icon}</p>
              <p className="mt-1 text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {plants.length > 0 && (
        <div className="flex gap-2">
          {(["semua", "Aktif", "Panen", "Mati"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors capitalize",
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              )}
            >
              {f}{" "}
              {f !== "semua" && `(${plants.filter((p) => p.status === (f as string)).length})`}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card/50 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Sprout className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-lg">
              {plants.length === 0 ? "Belum ada tanaman" : `Tidak ada tanaman ${filter}`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              {plants.length === 0
                ? "Tambahkan tanaman pertama Anda untuk mendapatkan rekomendasi AI, peringatan penyakit, dan tips perawatan personal."
                : "Ubah status tanaman dari menu card masing-masing tanaman."}
            </p>
          </div>
          {plants.length === 0 && (
            <Button
              onClick={() => setShowAdd(true)}
              className="bg-gradient-to-r from-primary to-primary/80"
            >
              <Plus className="mr-2 h-4 w-4" /> Tambah Tanaman Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((plant) => (
            <PlantCard key={plant.id} plant={plant} />
          ))}
        </div>
      )}

      {showAdd && <AddPlantModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}