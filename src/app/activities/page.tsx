"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";
import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import {
  getActivities,
  getPlants,
  createActivity,
  Activity,
  Plant,
  ActivityType
} from "@/services/db";
import {
  History,
  Plus,
  Filter,
  Droplet,
  Flame,
  Scissors,
  RefreshCw,
  Bug,
  Eye,
  Flower,
  Sprout,
  Image as ImageIcon
} from "lucide-react";

export default function ActivitiesPage() {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Filters State
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<string>("all");


  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [plantId, setPlantId] = useState("");
  const [actType, setActType] = useState<ActivityType>("pruning");

  const [actDetails, setActDetails] = useState("");
  const [actNotes, setActNotes] = useState("");
  const [actPhoto, setActPhoto] = useState("");

  const loadData = async () => {
    try {
      const aList = await getActivities();
      const pList = await getPlants(null, false);
      setActivities(aList);
      setPlants(pList);
      
      // Pre-set default plant in form
      if (pList.length > 0 && !plantId) {
        setPlantId(pList[0].id);
      }
    } catch (err) {
      toast(t("activities.loadError"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plantId) {
      toast(t("activities.selectPlantError"), "error");
      return;
    }

    try {
      await createActivity({
        plant_id: plantId,
        type: actType,
        date: new Date().toISOString(),
        details: actDetails || t("activities.performedActivity", { type: t(`activities.${actType}`) }),
        notes: actNotes,
        photo_url: actPhoto || undefined,
      });

      toast(t("activities.createSuccess"), "success");
      setModalOpen(false);
      setActDetails("");
      setActNotes("");
      setActPhoto("");
      loadData();
    } catch (err) {
      toast(t("activities.createError"), "error");
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "watering": return <Droplet className="h-4 w-4 text-blue-600 shrink-0" />;
      case "bulk_watering": return <Droplet className="h-4 w-4 text-blue-600 shrink-0" />;
      case "fertilizing": return <Flame className="h-4 w-4 text-amber-500 shrink-0" />;
      case "pruning": return <Scissors className="h-4 w-4 text-zinc-655 shrink-0" />;
      case "repotting": return <RefreshCw className="h-4 w-4 text-emerald-600 shrink-0" />;
      case "pest_control": return <Bug className="h-4 w-4 text-rose-500 shrink-0" />;
      case "observation": return <Eye className="h-4 w-4 text-indigo-500 shrink-0" />;
      case "flowering": return <Flower className="h-4 w-4 text-pink-500 shrink-0" />;
      case "harvest": return <Sprout className="h-4 w-4 text-emerald-500 shrink-0" />;
      default: return <History className="h-4 w-4 text-zinc-400 shrink-0" />;
    }
  };

  const filteredActivities = activities.filter((act) => {
    const matchesType = selectedTypeFilter === "all" || act.type === selectedTypeFilter;
    const matchesPlant = selectedPlantFilter === "all" || act.plant_id === selectedPlantFilter;
    return matchesType && matchesPlant;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950 dark:text-zinc-50 tracking-tight">
              {t("activities.title")}
            </h1>
            <p className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">
              {language === "th" ? "เรียกดูบันทึกการดูแลและบันทึกกิจกรรมทำสวนของคุณเอง" : "Browse care records and log custom gardening activities"}
            </p>
          </div>
          
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {t("activities.addActivity")}
          </button>
        </div>

        {/* Filter controls */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4 shadow-xs">
          <div className="flex-1">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">
              {t("activities.filterPlant")}
            </label>
            <select
              value={selectedPlantFilter}
              onChange={(e) => setSelectedPlantFilter(e.target.value)}
              className="w-full p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold"
            >
              <option value="all">{t("activities.allPlants")}</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">
              {t("activities.filterType")}
            </label>
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="w-full p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold"
            >
              <option value="all">{t("activities.allTypes")}</option>
              <option value="bulk_watering">{t("activities.bulk_watering")}</option>
              <option value="pruning">{t("activities.pruned")}</option>
              <option value="repotting">{t("activities.repotted")}</option>
              <option value="pest_control">{t("activities.pest_control")}</option>
              <option value="observation">{t("activities.observed")}</option>
              <option value="flowering">{t("activities.flowering")}</option>
              <option value="harvest">{t("activities.harvested")}</option>
            </select>
          </div>
        </div>

        {/* Timeline Log */}
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="text-zinc-400 font-bold">{t("activities.loadingActivities")}</span>
          </div>
        ) : filteredActivities.length === 0 ? (
          <EmptyState
            icon={History}
            title={t("activities.noActivities")}
            description={t("activities.noActivitiesDescription")}
            actionLabel={t("activities.addActivity")}
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs">
            <div className="relative border-l-2 border-zinc-100 dark:border-zinc-850 pl-6 ml-2 space-y-6">
              {filteredActivities.map((act) => (
                <div key={act.id} className="relative">
                  {/* Styled bullet bullet type */}
                  <span className={`absolute -left-[32px] top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border-2 shadow-xs ${
                    act.type === "bulk_watering" ? "border-blue-500" : "border-emerald-500"
                  }`}>
                    {getActivityIcon(act.type)}
                  </span>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {act.type === "bulk_watering" ? (
                        <span className="text-xs font-black text-zinc-800 dark:text-zinc-100">
                          {language === "th" ? "ทุกต้น" : "All Plants"}
                        </span>
                      ) : (
                        <button
                          onClick={() => router.push(`/plants?id=${act.plant_id}`)}
                          className="text-xs font-black text-emerald-700 dark:text-emerald-400 hover:underline hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors cursor-pointer text-left"
                        >
                          {act.plant_name}
                        </button>
                      )}
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase font-semibold ${
                        act.type === "bulk_watering"
                          ? "text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/20"
                          : "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20"
                      }`}>
                        {t(`activities.${act.type}`)}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-400 font-mono ml-auto">
                        {new Date(act.date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-zinc-655 dark:text-zinc-300 leading-relaxed">
                      {act.type === "bulk_watering"
                        ? t("activities.bulkWateringDetail", { count: act.details })
                        : act.details}
                    </p>

                    {act.notes && (
                      <p className="text-xs italic text-zinc-450 dark:text-zinc-400 border-l border-zinc-200 dark:border-zinc-800 pl-3 py-0.5 leading-relaxed bg-zinc-50/20 dark:bg-zinc-950/10 rounded-r">
                        &quot;{act.notes}&quot;
                      </p>
                    )}

                    {act.photo_url && (
                      <div className="mt-2.5 relative max-w-sm rounded-lg overflow-hidden border border-zinc-100 dark:border-zinc-850 shadow-xs">
                        <img
                          src={act.photo_url}
                          alt="milestone snapshot"
                          className="h-48 w-full object-cover bg-zinc-100 cursor-zoom-in hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedPhoto(act.photo_url || null)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOG ACTIVITY MODAL */}
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t("activities.addActivity")}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                {t("activities.selectPlant")}
              </label>
              <select
                value={plantId}
                onChange={(e) => setPlantId(e.target.value)}
                className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold"
                required
              >
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.species})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("activities.type")}</label>
              <select
                value={actType}
                onChange={(e) => setActType(e.target.value as any)}
                className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                <option value="pruning">{t("activities.pruned")}</option>
                <option value="repotting">{t("activities.repotted")}</option>
                <option value="pest_control">{t("activities.pest_control")}</option>
                <option value="observation">{t("activities.observed")}</option>
                <option value="flowering">{t("activities.flowering")}</option>
                <option value="harvest">{t("activities.harvested")}</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("activities.details")}</label>
              <input
                type="text"
                value={actDetails}
                onChange={(e) => setActDetails(e.target.value)}
                placeholder={t("activities.placeholderDetails")}
                className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("activities.notes")}</label>
              <textarea
                value={actNotes}
                onChange={(e) => setActNotes(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div className="space-y-1">
              <ImageUploadInput
                value={actPhoto}
                onChange={setActPhoto}
                placeholder="https://images.unsplash.com/photo-..."
                label={t("activities.photo")}
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-bold border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm cursor-pointer"
              >
                {t("common.save")}
              </button>
            </div>
          </form>
        </Modal>

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
      </div>
    </AppShell>
  );
}
