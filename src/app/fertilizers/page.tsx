"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/ui/Modal";
import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import {
  getFertilizers,
  createFertilizer,
  updateFertilizer,
  archiveFertilizer,
  deleteFertilizer,
  getFertilizerHistory,
  Fertilizer,
  FertilizerHistory,
  FertilizerType,
} from "@/services/db";
import {
  FlaskConical,
  Plus,
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Leaf,
  Droplets,
  Sprout,
  Package,
  Wind,
  MoreHorizontal,
  History,
  X,
} from "lucide-react";

const FERTILIZER_TYPES: { value: FertilizerType; labelKey: string; icon: React.ElementType }[] = [
  { value: "granular", labelKey: "fertilizers.typeGranular", icon: Package },
  { value: "liquid", labelKey: "fertilizers.typeLiquid", icon: Droplets },
  { value: "organic", labelKey: "fertilizers.typeOrganic", icon: Sprout },
  { value: "compost", labelKey: "fertilizers.typeCompost", icon: Leaf },
  { value: "foliar", labelKey: "fertilizers.typeFoliar", icon: Wind },
  { value: "other", labelKey: "fertilizers.typeOther", icon: MoreHorizontal },
];

const PRESET_COLORS = [
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#ef4444", // red
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ec4899", // pink
];

const getTypeLabel = (type: FertilizerType, t: (key: string) => string): string => {
  const map: Record<FertilizerType, string> = {
    granular: t("fertilizers.typeGranular"),
    liquid: t("fertilizers.typeLiquid"),
    organic: t("fertilizers.typeOrganic"),
    compost: t("fertilizers.typeCompost"),
    foliar: t("fertilizers.typeFoliar"),
    other: t("fertilizers.typeOther"),
  };
  return map[type] ?? type;
};

const getTypeIcon = (type: FertilizerType): React.ElementType => {
  const map: Record<FertilizerType, React.ElementType> = {
    granular: Package,
    liquid: Droplets,
    organic: Sprout,
    compost: Leaf,
    foliar: Wind,
    other: MoreHorizontal,
  };
  return map[type] ?? FlaskConical;
};

const StatusDot = ({ status }: { status?: "due" | "overdue" | "upcoming" | "pending" }) => {
  if (!status) return null;
  const color =
    status === "overdue" ? "bg-rose-500" :
    status === "due" ? "bg-amber-500" :
    status === "upcoming" ? "bg-blue-500" : "bg-zinc-300";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
};

export default function FertilizersPage() {
  const { t, language } = useTranslation();
  const { toast } = useToast();

  const [fertilizers, setFertilizers] = useState<Fertilizer[]>([]);
  const [history, setHistory] = useState<FertilizerHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [historyFertilizerId, setHistoryFertilizerId] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFertilizer, setEditingFertilizer] = useState<Fertilizer | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formNpk, setFormNpk] = useState("");
  const [formType, setFormType] = useState<FertilizerType>("granular");
  const [formInterval, setFormInterval] = useState(14);
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fList, hList] = await Promise.all([
        getFertilizers(true), // include archived
        getFertilizerHistory(undefined, undefined, 50),
      ]);
      setFertilizers(fList);
      setHistory(hList);
    } catch (e) {
      toast(t("fertilizers.loadError"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // --- Separate active vs archived ---
  const activeFertilizers = fertilizers.filter(f => !f.is_archived);
  const archivedFertilizers = fertilizers.filter(f => f.is_archived);

  const openAdd = () => {
    setEditingFertilizer(null);
    setFormName("");
    setFormNpk("");
    setFormType("granular");
    setFormInterval(14);
    setFormDesc("");
    setFormColor(PRESET_COLORS[0]);
    setModalOpen(true);
  };

  const openEdit = (f: Fertilizer) => {
    setEditingFertilizer(f);
    setFormName(f.name);
    setFormNpk(f.npk_formula);
    setFormType(f.type);
    setFormInterval(f.default_interval_days);
    setFormDesc(f.description);
    setFormColor(f.color || PRESET_COLORS[0]);
    setActiveMenu(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast(t("fertilizers.requiredError", { field: t("fertilizers.name") }), "error");
      return;
    }
    if (formInterval < 1) {
      toast(t("fertilizers.intervalError"), "error");
      return;
    }
    try {
      if (editingFertilizer) {
        await updateFertilizer(editingFertilizer.id, {
          name: formName,
          npk_formula: formNpk,
          type: formType,
          default_interval_days: formInterval,
          description: formDesc,
          color: formColor,
        });
        toast(t("fertilizers.updateSuccess"), "success");
      } else {
        await createFertilizer({
          name: formName,
          npk_formula: formNpk,
          type: formType,
          default_interval_days: formInterval,
          description: formDesc,
          color: formColor,
        });
        toast(t("fertilizers.createSuccess"), "success");
      }
      setModalOpen(false);
      loadData();
    } catch {
      toast(t("fertilizers.saveError"), "error");
    }
  };

  const handleArchive = async (f: Fertilizer) => {
    setActiveMenu(null);
    try {
      await archiveFertilizer(f.id, !f.is_archived);
      toast(f.is_archived ? t("fertilizers.unarchiveSuccess") : t("fertilizers.archiveSuccess"), "success");
      loadData();
    } catch {
      toast(t("fertilizers.actionError"), "error");
    }
  };

  const handleDelete = async (f: Fertilizer) => {
    setActiveMenu(null);
    if (!confirm(t("fertilizers.confirmDelete"))) return;
    try {
      await deleteFertilizer(f.id);
      toast(t("fertilizers.deleteSuccess"), "success");
      loadData();
    } catch {
      toast(t("fertilizers.deleteError"), "error");
    }
  };

  const fertilizerHistory = historyFertilizerId
    ? history.filter(h => h.fertilizer_id === historyFertilizerId)
    : [];

  const historyFertilizer = historyFertilizerId
    ? fertilizers.find(f => f.id === historyFertilizerId)
    : null;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              {t("fertilizers.title")}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
              {t("fertilizers.subtitle")}
            </p>
          </div>
          <button
            id="add-fertilizer-btn"
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {t("fertilizers.addFertilizer")}
          </button>
        </div>

        {/* Stats row */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: language === "th" ? "ปุ๋ยทั้งหมด" : "Total Fertilizers", value: activeFertilizers.length, color: "text-emerald-600 dark:text-emerald-400" },
              { label: language === "th" ? "กำลังใช้งาน" : "In Use", value: activeFertilizers.filter(f => (f.usage_count ?? 0) > 0).length, color: "text-blue-600 dark:text-blue-400" },
              { label: language === "th" ? "การใส่ทั้งหมด" : "Applications", value: history.length, color: "text-violet-600 dark:text-violet-400" },
              { label: language === "th" ? "เก็บถาวร" : "Archived", value: archivedFertilizers.length, color: "text-zinc-500 dark:text-zinc-400" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Fertilizer Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : activeFertilizers.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
            <FlaskConical className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
            <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400">{t("fertilizers.noFertilizers")}</p>
            <button onClick={openAdd} className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-lg transition-all cursor-pointer">
              {t("fertilizers.addFertilizer")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeFertilizers.map(f => (
              <FertilizerCard
                key={f.id}
                fertilizer={f}
                isMenuOpen={activeMenu === f.id}
                onMenuToggle={() => setActiveMenu(activeMenu === f.id ? null : f.id)}
                onEdit={openEdit}
                onArchive={handleArchive}
                onDelete={handleDelete}
                onViewHistory={() => { setHistoryFertilizerId(f.id); }}
                t={t}
                language={language}
              />
            ))}
          </div>
        )}

        {/* Archived section */}
        {archivedFertilizers.length > 0 && (
          <div className="space-y-3">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              {showArchived ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showArchived ? t("fertilizers.hideArchived") : t("fertilizers.showArchived")}
              <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-full text-[10px] font-extrabold">
                {archivedFertilizers.length}
              </span>
            </button>

            {showArchived && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedFertilizers.map(f => (
                  <FertilizerCard
                    key={f.id}
                    fertilizer={f}
                    isMenuOpen={activeMenu === f.id}
                    onMenuToggle={() => setActiveMenu(activeMenu === f.id ? null : f.id)}
                    onEdit={openEdit}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                    onViewHistory={() => { setHistoryFertilizerId(f.id); }}
                    t={t}
                    language={language}
                    archived
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Application History (full list) */}
        {history.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <h2 className="text-sm font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <History className="h-4 w-4 text-violet-500 shrink-0" />
                {t("fertilizers.history")}
              </h2>
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">{history.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="text-left px-6 py-3 font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">{t("fertilizers.histDate")}</th>
                    <th className="text-left px-4 py-3 font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">{language === "th" ? "ต้นไม้" : "Plant"}</th>
                    <th className="text-left px-4 py-3 font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">{t("fertilizers.histFertilizer")}</th>
                    <th className="text-left px-4 py-3 font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">{t("fertilizers.histAmount")}</th>
                    <th className="text-left px-4 py-3 font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">{t("fertilizers.histNote")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {history.slice(0, 20).map(h => (
                    <tr key={h.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-3 font-mono font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                        {new Date(h.applied_date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3 font-bold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{h.plant_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: h.fertilizer_color || "#10b981" }} />
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">{h.fertilizer_name}</span>
                          {h.fertilizer_npk && (
                            <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded font-mono font-extrabold text-[10px]">{h.fertilizer_npk}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">{h.amount || "—"}</td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 max-w-xs truncate">{h.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingFertilizer ? t("fertilizers.editFertilizer") : t("fertilizers.addFertilizer")}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              {t("fertilizers.name")} <span className="text-rose-500">*</span>
            </label>
            <input
              id="fertilizer-name-input"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder={t("fertilizers.placeholderName")}
              required
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* NPK + Type row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                {t("fertilizers.npk")}
              </label>
              <input
                value={formNpk}
                onChange={e => setFormNpk(e.target.value)}
                placeholder={t("fertilizers.placeholderNpk")}
                className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                {t("fertilizers.type")}
              </label>
              <select
                value={formType}
                onChange={e => setFormType(e.target.value as FertilizerType)}
                className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
              >
                {FERTILIZER_TYPES.map(ft => (
                  <option key={ft.value} value={ft.value}>{t(ft.labelKey)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Interval */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              {t("fertilizers.defaultInterval")}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={365}
                value={formInterval}
                onChange={e => setFormInterval(Number(e.target.value))}
                placeholder={t("fertilizers.placeholderInterval")}
                className="w-28 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">
                {language === "th" ? "วัน" : "days"}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              {t("fertilizers.description")}
            </label>
            <textarea
              rows={2}
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder={t("fertilizers.placeholderDesc")}
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none transition-all"
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              {t("fertilizers.color")}
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormColor(c)}
                  className={`h-7 w-7 rounded-full transition-all cursor-pointer ${formColor === c ? "ring-2 ring-offset-2 ring-zinc-900 dark:ring-zinc-100 scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              {/* Custom color input */}
              <div className="relative">
                <input
                  type="color"
                  value={formColor}
                  onChange={e => setFormColor(e.target.value)}
                  className="h-7 w-7 rounded-full border-0 cursor-pointer opacity-0 absolute inset-0"
                />
                <div
                  className="h-7 w-7 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-400 dark:text-zinc-500 text-[10px] font-bold"
                  title="Custom color"
                >
                  +
                </div>
              </div>
              <div className="h-7 w-7 rounded-full border-2 border-zinc-200 dark:border-zinc-700" style={{ backgroundColor: formColor }} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              {t("common.save")}
            </button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={!!historyFertilizerId}
        onClose={() => setHistoryFertilizerId(null)}
        title={historyFertilizer ? `${historyFertilizer.name} — ${t("fertilizers.history")}` : t("fertilizers.history")}
      >
        {fertilizerHistory.length === 0 ? (
          <div className="py-8 text-center text-sm font-bold text-zinc-400 dark:text-zinc-500">
            {t("fertilizers.noHistory")}
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {fertilizerHistory.map(h => (
              <div key={h.id} className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                <div className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: h.fertilizer_color || "#10b981" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200">{h.plant_name}</span>
                    <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 shrink-0">
                      {new Date(h.applied_date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  {h.amount && <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">{t("fertilizers.histAmount")}: {h.amount}</p>}
                  {h.note && <p className="text-xs italic text-zinc-500 dark:text-zinc-400 mt-0.5">"{h.note}"</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

// --- Fertilizer Card Component ---
interface FertilizerCardProps {
  fertilizer: Fertilizer;
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onEdit: (f: Fertilizer) => void;
  onArchive: (f: Fertilizer) => void;
  onDelete: (f: Fertilizer) => void;
  onViewHistory: () => void;
  t: (key: string) => string;
  language: string;
  archived?: boolean;
}

function FertilizerCard({
  fertilizer: f,
  isMenuOpen,
  onMenuToggle,
  onEdit,
  onArchive,
  onDelete,
  onViewHistory,
  t,
  language,
  archived = false,
}: FertilizerCardProps) {
  const TypeIcon = getTypeIcon(f.type);

  return (
    <div className={`relative group bg-white dark:bg-zinc-900 border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all ${
      archived
        ? "border-zinc-100 dark:border-zinc-800 opacity-60"
        : "border-zinc-200 dark:border-zinc-800 hover:border-emerald-200 dark:hover:border-emerald-900/40"
    }`}>
      {/* Color bar */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl transition-all" style={{ backgroundColor: f.color || "#10b981" }} />

      <div className="flex items-start justify-between gap-3 mt-1">
        <div className="flex items-start gap-3 min-w-0">
          {/* Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: (f.color || "#10b981") + "22" }}>
            <TypeIcon className="h-5 w-5 shrink-0" style={{ color: f.color || "#10b981" }} />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-50 truncate leading-5">{f.name}</h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {f.npk_formula && (
                <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded font-mono font-extrabold text-[10px]">
                  {f.npk_formula}
                </span>
              )}
              <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded font-bold text-[10px] capitalize">
                {getTypeLabel(f.type, t)}
              </span>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="relative shrink-0">
          <button
            onClick={onMenuToggle}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-all cursor-pointer"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-8 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <button onClick={() => onEdit(f)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
                <Edit className="h-3.5 w-3.5" />{t("common.edit")}
              </button>
              <button onClick={onViewHistory} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
                <History className="h-3.5 w-3.5" />{t("fertilizers.history")}
              </button>
              <button onClick={() => onArchive(f)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
                {archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                {archived ? t("fertilizers.unarchiveFertilizer") : t("fertilizers.archiveFertilizer")}
              </button>
              <div className="border-t border-zinc-100 dark:border-zinc-800" />
              <button onClick={() => onDelete(f)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />{t("common.delete")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {f.description && (
        <p className="mt-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">{f.description}</p>
      )}

      {/* Footer stats */}
      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
          <span className="text-zinc-400 dark:text-zinc-500">🔁</span>
          <span>{language === "th" ? `ทุก ${f.default_interval_days} วัน` : `Every ${f.default_interval_days} days`}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-bold">
          {(f.usage_count ?? 0) > 0 ? (
            <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-full">
              {t("fertilizers.usageCount").replace("{count}", String(f.usage_count))}
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">{t("fertilizers.noneUsed")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
