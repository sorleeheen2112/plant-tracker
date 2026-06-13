"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import {
  getActivities,
  getPlants,
  Activity,
  Plant
} from "@/services/db";
import {
  Camera,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Columns
} from "lucide-react";

export default function PhotosPage() {
  const { t, language } = useTranslation();
  const { toast } = useToast();

  const [photos, setPhotos] = useState<Activity[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Before/After Slider state
  const [selectedPlantId, setSelectedPlantId] = useState<string>("");
  const [plantPhotos, setPlantPhotos] = useState<Activity[]>([]);
  const [beforePhoto, setBeforePhoto] = useState<string>("");
  const [afterPhoto, setAfterPhoto] = useState<string>("");
  const [sliderPosition, setSliderPosition] = useState<number>(50);

  const loadPhotos = async () => {
    try {
      const allActs = await getActivities();
      const photoActs = allActs.filter((a) => a.photo_url);
      const activePlants = await getPlants(null, false);

      setPhotos(photoActs);
      setPlants(activePlants);

      if (activePlants.length > 0) {
        setSelectedPlantId(activePlants[0].id);
      }
    } catch (err) {
      toast(t("photos.loadError"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, []);

  // Sync plant photos when selection changes
  useEffect(() => {
    if (selectedPlantId) {
      const filtered = photos.filter((p) => p.plant_id === selectedPlantId);
      // Sort oldest to newest
      const sorted = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setPlantPhotos(sorted);

      if (sorted.length >= 2) {
        setBeforePhoto(sorted[0].photo_url || "");
        setAfterPhoto(sorted[sorted.length - 1].photo_url || "");
      } else {
        setBeforePhoto("");
        setAfterPhoto("");
      }
    }
  }, [selectedPlantId, photos]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPosition(Number(e.target.value));
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950 dark:text-zinc-50 tracking-tight flex items-center gap-2">
              <Camera className="h-6 w-6 text-emerald-600" />
              {t("photos.title")}
            </h1>
            <p className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">
              {t("photos.subtitle")}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="text-zinc-400 font-bold">{t("photos.loadingGallery")}</span>
          </div>
        ) : photos.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title={t("photos.noPhotos")}
            description={t("photos.noPhotosDescription")}
          />
        ) : (
          <div className="space-y-8">
            {/* 1. BEFORE/AFTER SLIDER TOOL */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-6">
              <h2 className="text-sm font-bold text-zinc-850 dark:text-zinc-150 flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-emerald-600" />
                {t("photos.beforeAfter")}
              </h2>

              <div className="flex flex-col md:flex-row gap-6">
                {/* Image Selection Sidebar */}
                <div className="w-full md:w-80 space-y-4 shrink-0">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                      {t("photos.selectPlant")}
                    </label>
                    <select
                      value={selectedPlantId}
                      onChange={(e) => setSelectedPlantId(e.target.value)}
                      className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold"
                    >
                      {plants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {plantPhotos.length < 2 ? (
                    <div className="text-xs font-semibold text-zinc-400 p-4 border border-dashed rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 leading-relaxed">
                      {t("photos.needsPhotos")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                          {t("photos.selectBefore")}
                        </label>
                        <select
                          value={beforePhoto}
                          onChange={(e) => setBeforePhoto(e.target.value)}
                          className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold font-mono"
                        >
                          {plantPhotos.map((p, idx) => (
                            <option key={p.id} value={p.photo_url}>
                              Photo {idx + 1} - {new Date(p.date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", { month: "short", day: "numeric", year: "2-digit" })}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                          {t("photos.selectAfter")}
                        </label>
                        <select
                          value={afterPhoto}
                          onChange={(e) => setAfterPhoto(e.target.value)}
                          className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold font-mono"
                        >
                          {plantPhotos.map((p, idx) => (
                            <option key={p.id} value={p.photo_url}>
                              Photo {idx + 1} - {new Date(p.date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", { month: "short", day: "numeric", year: "2-digit" })}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Slider Render Container */}
                <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 rounded-xl p-4 overflow-hidden min-h-[300px]">
                  {beforePhoto && afterPhoto ? (
                    <div className="relative w-full max-w-lg aspect-4/3 rounded-xl overflow-hidden shadow-lg border border-zinc-200 dark:border-zinc-800 select-none">
                      {/* Before Image (Background) */}
                      <img
                        src={beforePhoto}
                        alt="Before comparison"
                        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                      />
                      <div className="absolute left-3 bottom-3 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded font-black tracking-widest uppercase z-20">
                        {t("photos.beforeLabel")}
                      </div>

                      {/* After Image (Foreground clipped overlay) */}
                      <div
                        className="absolute inset-y-0 left-0 right-0 overflow-hidden pointer-events-none transition-all duration-75"
                        style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
                      >
                        <img
                          src={afterPhoto}
                          alt="After comparison"
                          className="absolute inset-0 h-full w-full object-cover"
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div className="absolute right-3 bottom-3 bg-emerald-600/80 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded font-black tracking-widest uppercase z-20">
                        {t("photos.afterLabel")}
                      </div>

                      {/* Slider Line Divider */}
                      <div
                        className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] z-30 pointer-events-none"
                        style={{ left: `${sliderPosition}%` }}
                      >
                        {/* Slide center handle */}
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-white dark:bg-zinc-900 border-2 border-emerald-500 shadow-md flex items-center justify-center">
                          <Columns className="h-4.5 w-4.5 text-emerald-600" />
                        </div>
                      </div>

                      {/* HTML range inputs overlay covering whole container */}
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sliderPosition}
                        onChange={handleSliderChange}
                        className="absolute inset-0 w-full h-full opacity-0 z-40 cursor-ew-resize"
                      />
                    </div>
                  ) : (
                    <div className="text-center py-12 text-sm text-zinc-400 dark:text-zinc-500 font-semibold max-w-xs leading-relaxed">
                      {t("photos.sliderInstruction")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. CHRONOLOGICAL PHOTOS GRID */}
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
                {t("photos.timeline")}
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {photos.map((act) => (
                  <div
                    key={act.id}
                    className="group border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 hover:border-emerald-500 hover:shadow-md transition-all duration-200"
                  >
                    <div className="h-40 overflow-hidden bg-zinc-150 relative cursor-zoom-in">
                      <img
                        src={act.photo_url}
                        alt={act.plant_name}
                        className="h-full w-full object-cover group-hover:scale-102 transition-transform hover:opacity-90"
                        onClick={() => setSelectedPhoto(act.photo_url || null)}
                      />
                    </div>
                    <div className="p-4 space-y-1">
                      <h4 className="text-xs font-extrabold text-zinc-850 dark:text-zinc-150 truncate">
                        {act.plant_name}
                      </h4>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        {t(`activities.${act.type}`)}
                      </p>
                      <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 font-mono">
                        {new Date(act.date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PHOTO PREVIEW MODAL */}
      <Modal
        isOpen={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        title={t("photos.title")}
      >
        <div className="flex flex-col items-center justify-center p-2">
          {selectedPhoto && (
            <img
              src={selectedPhoto}
              alt="Full size growth milestone"
              className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-lg bg-zinc-100 dark:bg-zinc-800"
            />
          )}
        </div>
      </Modal>
    </AppShell>
  );
}
