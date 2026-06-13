"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";
import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import {
  getGardens,
  getPlants,
  getSchedules,
  getActivities,
  createGarden,
  updateGarden,
  deleteGarden,
  createPlant,
  updatePlant,
  deletePlant,
  archivePlant,
  createActivity,
  createSchedule,
  deleteSchedule,
  performSchedule,
  getFertilizers,
  getPlantFertilizers,
  createPlantFertilizer,
  deletePlantFertilizer,
  applyFertilizer,
  getFertilizerHistory,
  Garden,
  Plant,
  Schedule,
  Activity,
  ActivityType,
  Fertilizer,
  PlantFertilizer,
  FertilizerHistory,
} from "@/services/db";
import {
  Plus,
  FolderPlus,
  Edit,
  Trash2,
  Archive,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  BookOpen,
  Camera,
  Activity as ActivityIcon,
  HelpCircle,
  MapPin,
  Tag,
  LogOut,
  CalendarCheck,
  TrendingUp,
  Sparkles,
  Columns,
  History as HistoryIcon,
  Search,
  Leaf,
  FlaskConical,
  Droplets,
  Package,
  Sprout,
  Wind,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Droplet,
  Flame,
  Scissors,
  RefreshCw,
  Bug,
  Eye,
  Flower,
} from "lucide-react";


// Wrap the page component with Suspense to resolve searchParams
export default function PlantsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <span className="text-zinc-500 font-bold">Loading Plants...</span>
      </div>
    }>
      <PlantsContent />
    </Suspense>
  );
}

function PlantsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, language } = useTranslation();
  const { toast } = useToast();

  const plantId = searchParams.get("id");

  // Core Data Lists
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  // Filters State
  const [selectedGardenFilter, setSelectedGardenFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "watering": return <Droplet className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400 shrink-0" />;
      case "fertilizing": return <Flame className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400 shrink-0" />;
      case "pruning": return <Scissors className="h-2.5 w-2.5 text-zinc-650 dark:text-zinc-400 shrink-0" />;
      case "repotting": return <RefreshCw className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case "pest_control": return <Bug className="h-2.5 w-2.5 text-rose-500 dark:text-rose-400 shrink-0" />;
      case "observation": return <Eye className="h-2.5 w-2.5 text-indigo-500 dark:text-indigo-400 shrink-0" />;
      case "flowering": return <Flower className="h-2.5 w-2.5 text-pink-500 dark:text-pink-400 shrink-0" />;
      case "harvest": return <Sprout className="h-2.5 w-2.5 text-emerald-500 dark:text-emerald-400 shrink-0" />;
      default: return <HistoryIcon className="h-2.5 w-2.5 text-zinc-400 shrink-0" />;
    }
  };

  const getActivityBadgeClass = (type: string) => {
    switch (type) {
      case "watering": return "text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/25";
      case "fertilizing": return "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/25";
      case "pruning": return "text-zinc-700 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-950/25";
      case "repotting": return "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/25";
      case "pest_control": return "text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/25";
      case "observation": return "text-indigo-700 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/25";
      case "flowering": return "text-pink-700 bg-pink-50 dark:text-pink-400 dark:bg-pink-950/25";
      case "harvest": return "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/25";
      default: return "text-zinc-700 bg-zinc-50 dark:text-zinc-450 dark:bg-zinc-950/25";
    }
  };

  const getActivityBorderClass = (type: string) => {
    switch (type) {
      case "watering": return "border-blue-500 dark:border-blue-700";
      case "fertilizing": return "border-amber-500 dark:border-amber-700";
      case "pruning": return "border-zinc-400 dark:border-zinc-650";
      case "repotting": return "border-emerald-500 dark:border-emerald-700";
      case "pest_control": return "border-rose-500 dark:border-rose-700";
      case "observation": return "border-indigo-500 dark:border-indigo-700";
      case "flowering": return "border-pink-500 dark:border-pink-700";
      case "harvest": return "border-emerald-500 dark:border-emerald-700";
      default: return "border-zinc-300 dark:border-zinc-700";
    }
  };

  // --- Modal States ---
  const [gardenModalOpen, setGardenModalOpen] = useState(false);
  const [editingGarden, setEditingGarden] = useState<Garden | null>(null);
  const [gardenName, setGardenName] = useState("");
  const [gardenDesc, setGardenDesc] = useState("");
  const [gardenCover, setGardenCover] = useState("");

  const [plantModalOpen, setPlantModalOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [plantName, setPlantName] = useState("");
  const [plantSpecies, setPlantSpecies] = useState("");
  const [plantGardenId, setPlantGardenId] = useState("");
  const [plantLoc, setPlantLoc] = useState("");
  const [plantDate, setPlantDate] = useState("");
  const [plantStatus, setPlantStatus] = useState<"healthy" | "flowering" | "fruiting" | "dormant" | "sick">("healthy");
  const [plantNotes, setPlantNotes] = useState("");
  const [plantCover, setPlantCover] = useState("");

  // Detailed view Tab State
  const [activeTab, setActiveTab] = useState<"overview" | "activities" | "photos" | "schedules" | "fertilizers" | "analytics">("overview");

  // Full-size Photo Preview Modal state
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Add schedule form states (within detail tab)
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedType, setSchedType] = useState<ActivityType>("fertilizing");
  const [schedInterval, setSchedInterval] = useState(2);
  const [schedStartDate, setSchedStartDate] = useState(new Date().toLocaleDateString("sv-SE"));

  // Log activity form states (within detail tab)
  const [actModalOpen, setActModalOpen] = useState(false);
  const [actType, setActType] = useState<ActivityType>("fertilizing");
  const [actDetails, setActDetails] = useState("");
  const [actNotes, setActNotes] = useState("");
  const [actPhoto, setActPhoto] = useState("");

  // Fertilizer tab states
  const [fertLibrary, setFertLibrary] = useState<Fertilizer[]>([]);
  const [plantFertilizers, setPlantFertilizers] = useState<PlantFertilizer[]>([]);
  const [fertHistory, setFertHistory] = useState<FertilizerHistory[]>([]);
  const [assignFertModalOpen, setAssignFertModalOpen] = useState(false);
  const [selectedFertId, setSelectedFertId] = useState("");
  const [fertIntervalOverride, setFertIntervalOverride] = useState<number | null>(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyingPF, setApplyingPF] = useState<PlantFertilizer | null>(null);
  const [applyAmount, setApplyAmount] = useState("");
  const [applyNote, setApplyNote] = useState("");
  const [applyDate, setApplyDate] = useState(new Date().toLocaleDateString("sv-SE"));

  // --- Loader Helper ---
  const loadData = async () => {
    try {
      const gList = await getGardens();
      const pList = await getPlants(null, true); // Get all including archived
      setGardens(gList);
      setPlants(pList);

      if (plantId) {
        const [sList, aList, fertLib, pfList, fhList] = await Promise.all([
          getSchedules(plantId),
          getActivities(plantId),
          getFertilizers(false), // active only for assignment
          getPlantFertilizers(plantId),
          getFertilizerHistory(plantId, undefined, 20),
        ]);
        setSchedules(sList);
        setActivities(aList);
        setFertLibrary(fertLib);
        setPlantFertilizers(pfList);
        setFertHistory(fhList);
      }
    } catch (err) {
      toast(t("plants.dbError"), "error");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadData();
  }, [plantId]);

  // --- Garden CRUD operations ---
  const openAddGarden = () => {
    setEditingGarden(null);
    setGardenName("");
    setGardenDesc("");
    setGardenCover("");
    setGardenModalOpen(true);
  };

  const openEditGarden = (g: Garden, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGarden(g);
    setGardenName(g.name);
    setGardenDesc(g.description || "");
    setGardenCover(g.cover_image || "");
    setGardenModalOpen(true);
  };

  const handleGardenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gardenName.trim()) {
      toast(t("plants.gardenNameRequired"), "error");
      return;
    }
    
    try {
      if (editingGarden) {
        await updateGarden(editingGarden.id, {
          name: gardenName,
          description: gardenDesc,
          cover_image: gardenCover,
        });
        toast(t("plants.gardenUpdateSuccess"), "success");
      } else {
        await createGarden(gardenName, gardenDesc, gardenCover);
        toast(t("plants.gardenCreateSuccess"), "success");
      }
      setGardenModalOpen(false);
      loadData();
    } catch (err) {
      toast(t("plants.gardenSaveError"), "error");
    }
  };

  const handleDeleteGarden = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t("common.confirmDelete"))) {
      try {
        await deleteGarden(id);
        toast(t("plants.gardenDeleteSuccess"), "success");
        if (selectedGardenFilter === id) setSelectedGardenFilter("all");
        loadData();
      } catch (err) {
        toast(t("plants.gardenDeleteError"), "error");
      }
    }
  };

  // --- Plant CRUD operations ---
  const openAddPlant = () => {
    setEditingPlant(null);
    setPlantName("");
    setPlantSpecies("");
    setPlantGardenId(selectedGardenFilter !== "all" ? selectedGardenFilter : gardens[0]?.id || "");
    setPlantLoc("");
    setPlantDate(new Date().toLocaleDateString("sv-SE"));
    setPlantStatus("healthy");
    setPlantNotes("");
    setPlantCover("");
    setPlantModalOpen(true);
  };

  const openEditPlant = (p: Plant, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPlant(p);
    setPlantName(p.name);
    setPlantSpecies(p.species);
    setPlantGardenId(p.garden_id || "");
    setPlantLoc(p.location || "");
    
    // Format planting_date safely to YYYY-MM-DD for input type="date"
    let formattedDate = "";
    if (p.planting_date) {
      formattedDate = p.planting_date.split(/[T ]/)[0];
    } else {
      formattedDate = new Date().toLocaleDateString("sv-SE");
    }
    setPlantDate(formattedDate);
    
    setPlantStatus(p.status);
    setPlantNotes(p.notes || "");
    setPlantCover(p.cover_image || "");
    setPlantModalOpen(true);
  };

  const handlePlantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plantName.trim() || !plantSpecies.trim()) {
      toast(t("plants.nameSpeciesRequired"), "error");
      return;
    }

    const defaultCover = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop";

    try {
      const plantPayload = {
        name: plantName,
        species: plantSpecies,
        garden_id: plantGardenId || null,
        location: plantLoc,
        planting_date: plantDate,
        status: plantStatus,
        notes: plantNotes,
        cover_image: plantCover || defaultCover,
      };

      if (editingPlant) {
        await updatePlant(editingPlant.id, plantPayload);
        toast(t("plants.updateSuccess"), "success");
      } else {
        await createPlant(plantPayload);
        toast(t("plants.createSuccess"), "success");
      }
      setPlantModalOpen(false);
      loadData();
    } catch (err) {
      toast(t("plants.saveError"), "error");
    }
  };

  const handleToggleArchive = async (p: Plant, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await archivePlant(p.id, !p.archived);
      toast(p.archived ? t("plants.unarchiveSuccess") : t("plants.archiveSuccess"), "success");
      loadData();
    } catch (err) {
      toast(t("plants.archiveError"), "error");
    }
  };

  const handleDeletePlant = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t("common.confirmDelete"))) {
      try {
        await deletePlant(id);
        toast(t("plants.deleteSuccess"), "success");
        if (plantId === id) {
          router.push("/plants");
        } else {
          loadData();
        }
      } catch (err) {
        toast(t("plants.deleteError"), "error");
      }
    }
  };

  // --- Schedules (Detail Page) ---
  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plantId) return;

    try {
      await createSchedule({
        plant_id: plantId,
        type: schedType,
        interval_days: Number(schedInterval),
        start_date: schedStartDate,
      });
      toast(t("schedules.createSuccess"), "success");
      setSchedModalOpen(false);
      loadData();
    } catch (err) {
      toast(t("schedules.createError"), "error");
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (confirm(t("common.confirmDelete"))) {
      try {
        await deleteSchedule(id);
        toast(t("schedules.deleteSuccess"), "success");
        loadData();
      } catch (err) {
        toast(t("schedules.deleteError"), "error");
      }
    }
  };

  const handlePerformSchedule = async (id: string) => {
    try {
      toast(t("schedules.taskCompletedMsg"), "success");
      loadData();
    } catch (err) {
      toast(t("schedules.completeError"), "error");
    }
  };

  // --- Activity Log (Detail Page) ---
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plantId) return;

    try {
      await createActivity({
        plant_id: plantId,
        type: actType,
        date: new Date().toISOString(),
        details: actDetails || `Log ${actType} activity`,
        notes: actNotes,
        photo_url: actPhoto || undefined,
      });
      
      // Update plant status if we logged "observed" or flowering/harvest
      if (actType === "flowering") {
        await updatePlant(plantId, { status: "flowering" });
      }

      toast(t("activities.createSuccess"), "success");
      setActModalOpen(false);
      setActDetails("");
      setActNotes("");
      setActPhoto("");
      loadData();
    } catch (err) {
      toast(t("activities.createError"), "error");
    }
  };

  // --- Filtering computations ---
  const activePlants = plants.filter(p => !p.archived);
  const archivedPlants = plants.filter(p => p.archived);
  const currentPlantsList = showArchived ? archivedPlants : activePlants;

  const filteredPlants = currentPlantsList.filter(p => {
    const matchesGarden = selectedGardenFilter === "all" || p.garden_id === selectedGardenFilter;
    const matchesStatus = selectedStatusFilter === "all" || p.status === selectedStatusFilter;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.species.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesGarden && matchesStatus && matchesSearch;
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "healthy": return t("plants.statusHealthy");
      case "flowering": return t("plants.statusFlowering");
      case "fruiting": return t("plants.statusFruiting");
      case "dormant": return t("plants.statusDormant");
      case "sick": return t("plants.statusSick");
      default: return status;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "healthy": return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40";
      case "flowering": return "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/20 dark:text-pink-400 dark:border-pink-900/40";
      case "fruiting": return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40";
      case "dormant": return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-400 dark:border-zinc-750";
      case "sick": return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40";
      default: return "bg-zinc-50 border-zinc-200 text-zinc-600";
    }
  };

  // --- SUBCOMPONENT: PLANT DETAIL VIEW ---
  if (plantId) {
    const activePlant = plants.find(p => p.id === plantId);
    
    if (!activePlant) {
      return (
        <AppShell>
          <div className="text-center py-12">
            <h3 className="text-lg font-bold">{t("plants.notFound")}</h3>
            <button onClick={() => router.push("/plants")} className="mt-4 text-emerald-600 font-bold">
              {t("plantDetail.backToPlants")}
            </button>
          </div>
        </AppShell>
      );
    }

    // Compute Plant Age
    const plantAgeDays = Math.max(
      Math.ceil((Date.now() - new Date(activePlant.planting_date).getTime()) / (1000 * 60 * 60 * 24)),
      1
    );

    const formatAge = () => {
      if (plantAgeDays < 30) return t("plantDetail.daysOld", { days: plantAgeDays });
      const months = Math.floor(plantAgeDays / 30);
      if (months < 12) return t("plantDetail.monthsOld", { months });
      const years = (plantAgeDays / 365).toFixed(1);
      return t("plantDetail.yearsOld", { years });
    };

    const lastPrunedAct = activities.find(a => a.type === "pruning");
    const lastFertilizedAct = activities.find(a => a.type === "fertilizing");

    return (
      <AppShell>
        <div className="space-y-6">
          {/* Back button & Action buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              onClick={() => router.push("/plants")}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
              {t("plantDetail.backToPlants")}
            </button>

            <div className="flex gap-2">
              <button
                onClick={(e) => openEditPlant(activePlant, e)}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-750 dark:text-zinc-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Edit className="h-3.5 w-3.5" />
                {t("common.edit")}
              </button>
              <button
                onClick={(e) => handleToggleArchive(activePlant, e)}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-750 dark:text-zinc-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Archive className="h-3.5 w-3.5" />
                {activePlant.archived ? t("common.unarchive") : t("common.archive")}
              </button>
              <button
                onClick={(e) => handleDeletePlant(activePlant.id, e)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("common.delete")}
              </button>
            </div>
          </div>

          {/* Plant Profile Header */}
          <div className="flex flex-col md:flex-row gap-6 p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs">
            <img
              src={activePlant.cover_image}
              alt={activePlant.name}
              className="h-32 w-full md:w-32 rounded-xl object-cover bg-zinc-100 dark:bg-zinc-800 self-center"
            />
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50 truncate">
                  {activePlant.name}
                </h1>
                <span className={`px-2.5 py-0.5 border text-[10px] font-extrabold rounded-full ${getStatusBadgeColor(activePlant.status)}`}>
                  {getStatusLabel(activePlant.status)}
                </span>
                {activePlant.archived && (
                  <span className="px-2.5 py-0.5 border border-zinc-200 text-zinc-500 bg-zinc-50 text-[10px] font-extrabold rounded-full">
                    {t("dashboard.archivedPlants")}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-zinc-400 font-mono -mt-1 truncate">
                {activePlant.species}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    {t("plants.garden")}
                  </span>
                  <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {gardens.find(g => g.id === activePlant.garden_id)?.name || t("common.none")}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    {t("plants.location")}
                  </span>
                  <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">
                    {activePlant.location || t("common.none")}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    {t("plantDetail.age")}
                  </span>
                  <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {formatAge()}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    {t("plants.plantingDate")}
                  </span>
                  <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {new Date(activePlant.planting_date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed View Tabs */}
          <div className="border-b border-zinc-200 dark:border-zinc-800 flex overflow-x-auto gap-2">
            {(["overview", "activities", "photos", "schedules", "fertilizers", "analytics"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab
                    ? "border-emerald-600 text-emerald-600 dark:border-emerald-450 dark:text-emerald-450"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {t(`plantDetail.tabs.${tab}`)}
              </button>
            ))}
          </div>

          {/* TAB CONTENT PANEL */}
          <div className="pt-2">
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  {/* Notes Card */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs space-y-2">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{t("plants.notes")}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                      {activePlant.notes || (language === "th" ? "ยังไม่มีบันทึกย่อสำหรับต้นไม้นี้" : "No notes written for this plant yet.")}
                    </p>
                  </div>

                  {/* Last performed timestamps */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-center gap-4 shadow-xs">
                      <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg bg-zinc-50 dark:bg-zinc-950/20 text-zinc-600">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                          {t("plantDetail.lastPruned")}
                        </span>
                        <p className="text-sm font-black text-zinc-800 dark:text-zinc-200 mt-0.5">
                          {lastPrunedAct
                            ? new Date(lastPrunedAct.date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })
                            : t("common.none")
                          }
                        </p>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-center gap-4 shadow-xs">
                      <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-600">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                          {t("plantDetail.lastFertilized")}
                        </span>
                        <p className="text-sm font-black text-zinc-800 dark:text-zinc-200 mt-0.5">
                          {lastFertilizedAct
                            ? new Date(lastFertilizedAct.date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })
                            : t("common.none")
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick actions panel sidebar */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs h-fit space-y-4">
                  <h3 className="text-sm font-bold text-zinc-850 dark:text-zinc-150">
                    {t("plantDetail.quickLog")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(["fertilizing", "pruning", "repotting", "observation"] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          setActType(type);
                          setActDetails(`Quick log of ${type} care`);
                          setActModalOpen(true);
                        }}
                        className="p-3 border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/10 rounded-xl text-center text-xs font-bold transition-all cursor-pointer capitalize"
                      >
                        {t(`activities.${type}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ACTIVITIES TIMELINE TAB */}
            {activeTab === "activities" && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-850 dark:text-zinc-150">
                    {t("activities.title")}
                  </h3>
                  <button
                    onClick={() => {
                      setActType("fertilizing");
                      setActDetails("");
                      setActModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    {t("activities.addActivity")}
                  </button>
                </div>
                <div className="p-6">
                  {activities.length === 0 ? (
                    <EmptyState
                      icon={HistoryIcon}
                      title={t("plantDetail.noActivity")}
                      description="Log custom fertilizations, prunings, and repottings to create a growth journal."
                      actionLabel={t("activities.addActivity")}
                      onAction={() => {
                        setActType("fertilizing");
                        setActDetails("");
                        setActModalOpen(true);
                      }}
                    />
                  ) : (
                    <div className="relative border-l-2 border-zinc-100 dark:border-zinc-850 pl-5 ml-2.5 space-y-6">
                      {activities.map((act) => (
                        <div key={act.id} className="relative">
                          <span className={`absolute -left-[30px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border-2 shadow-xs ${getActivityBorderClass(act.type)}`}>
                            {getActivityIcon(act.type)}
                          </span>
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 bg-zinc-50/10 dark:bg-zinc-950/5 border border-zinc-100 dark:border-zinc-850/50 p-4 rounded-xl hover:border-zinc-200 dark:hover:border-zinc-800 transition-colors">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase font-semibold ${getActivityBadgeClass(act.type)}`}>
                                  {t(`activities.${act.type}`)}
                                </span>
                                <span className="text-[10px] font-extrabold text-zinc-400 font-mono">
                                  {new Date(act.date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                {act.details}
                              </p>
                              {act.notes && (
                                <p className="text-xs italic text-zinc-500 dark:text-zinc-400 border-l border-zinc-200 dark:border-zinc-850 pl-2.5 mt-1">
                                  &quot;{act.notes}&quot;
                                </p>
                              )}
                              {act.photo_url && (
                                <img
                                  src={act.photo_url}
                                  alt="Activity snap"
                                  className="h-20 rounded-lg object-cover bg-zinc-100 mt-2 cursor-zoom-in hover:opacity-90 transition-opacity"
                                  onClick={() => setSelectedPhoto(act.photo_url || null)}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PHOTOS GALLERY TAB */}
            {activeTab === "photos" && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-850 dark:text-zinc-150">
                    {t("photos.title")}
                  </h3>
                  <button
                    onClick={() => router.push("/photos")}
                    className="text-xs font-bold text-emerald-650 hover:text-emerald-550 flex items-center cursor-pointer"
                  >
                    Open Photo comparison slider
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                
                {activities.filter(a => a.photo_url).length === 0 ? (
                  <EmptyState
                    icon={Camera}
                    title={t("plantDetail.noPhoto")}
                    description="Upload progress photos when recording care activities to populate the growth timeline."
                    actionLabel={t("activities.addActivity")}
                    onAction={() => {
                      setActType("observation");
                      setActModalOpen(true);
                    }}
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {activities
                      .filter(a => a.photo_url)
                      .map((act) => (
                        <div
                          key={act.id}
                          className="group border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs bg-zinc-50/20 dark:bg-zinc-950/10 flex flex-col"
                        >
                          <img
                            src={act.photo_url}
                            alt="growth milestone"
                            className="h-32 w-full object-cover bg-zinc-100 cursor-zoom-in hover:opacity-90 transition-opacity"
                            onClick={() => setSelectedPhoto(act.photo_url || null)}
                          />
                          <div className="p-3">
                            <p className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 dark:text-emerald-450 dark:bg-emerald-950/25 px-1.5 py-0.5 rounded uppercase w-fit font-semibold">
                              {t(`activities.${act.type}`)}
                            </p>
                            <p className="text-[10px] font-bold text-zinc-400 font-mono mt-1">
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
                )}
              </div>
            )}

            {/* SCHEDULES TABS */}
            {activeTab === "schedules" && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/25 dark:bg-zinc-900/50">
                  <h3 className="text-sm font-bold text-zinc-850 dark:text-zinc-150">
                    {t("plantDetail.tabs.schedules")}
                  </h3>
                  <button
                    onClick={() => {
                      setSchedType("fertilizing");
                      setSchedInterval(14);
                      setSchedModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    {t("plantDetail.addSchedule")}
                  </button>
                </div>
                <div className="p-6">
                  {schedules.length === 0 ? (
                    <EmptyState
                      icon={Calendar}
                      title={t("plantDetail.noSchedule")}
                      description="Create customized recurring timers to fertilize, prune, or repot your plants on set day frequencies."
                      actionLabel={t("plantDetail.addSchedule")}
                      onAction={() => {
                        setSchedType("fertilizing");
                        setSchedInterval(14);
                        setSchedModalOpen(true);
                      }}
                    />
                  ) : (
                    <div className="space-y-4">
                      {schedules.map((sched) => (
                        <div
                          key={sched.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-zinc-150 dark:border-zinc-800 rounded-xl bg-zinc-50/20 dark:bg-zinc-950/10 hover:border-zinc-350 dark:hover:border-zinc-700/80 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 text-xs font-bold uppercase tracking-wider font-semibold">
                              {t(`activities.${sched.type}`).slice(0, 2)}
                            </span>
                            <div>
                              <p className="text-sm font-black text-zinc-800 dark:text-zinc-100">
                                {t(`activities.${sched.type}`)}
                              </p>
                              <p className="text-xs text-zinc-400 font-semibold font-mono">
                                {t("plantDetail.daysInterval", { days: sched.interval_days })}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 justify-between sm:justify-end">
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                                {t("schedules.nextDue")}
                              </span>
                              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 font-mono">
                                {sched.next_due_date
                                  ? new Date(sched.next_due_date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : t("common.none")
                                }
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {sched.task_status === "overdue" && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 dark:text-rose-400 dark:bg-rose-950/20 dark:border-rose-900/40">
                                  {t("schedules.statusOverdue")}
                                </span>
                              )}
                              {sched.task_status === "due" && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-950/20 dark:border-amber-900/40">
                                  {t("schedules.statusDue")}
                                </span>
                              )}
                              
                              <button
                                onClick={() => handlePerformSchedule(sched.id)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 rounded-lg text-xs font-bold cursor-pointer"
                                title="Mark done"
                              >
                                <CalendarCheck className="h-4 w-4 shrink-0" />
                              </button>
                              <button
                                onClick={() => handleDeleteSchedule(sched.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-600 rounded-lg text-xs font-bold cursor-pointer"
                                title="Delete schedule"
                              >
                                <Trash2 className="h-4 w-4 shrink-0" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FERTILIZERS TAB */}
            {activeTab === "fertilizers" && (
              <div className="space-y-6">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    {t("fertilizers.assignedFertilizers")}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedFertId(fertLibrary[0]?.id || "");
                      setFertIntervalOverride(null);
                      setAssignFertModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("fertilizers.assignFertilizer")}
                  </button>
                </div>

                {/* Schedule list */}
                {plantFertilizers.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center">
                    <FlaskConical className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                    <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400">{t("fertilizers.noAssigned")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {plantFertilizers.map((pf) => {
                      const statusColor =
                        pf.task_status === "overdue" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-200 dark:border-rose-900/30" :
                        pf.task_status === "due" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200 dark:border-amber-900/30" :
                        pf.task_status === "upcoming" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/10 dark:text-blue-400 border-blue-100 dark:border-blue-900/20" :
                        "bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700";
                      const StatusIcon =
                        pf.task_status === "overdue" ? AlertCircle :
                        pf.task_status === "due" ? AlertTriangle :
                        pf.task_status === "upcoming" ? Clock : Clock;

                      return (
                        <div key={pf.id} className={`flex items-start gap-4 p-4 bg-white dark:bg-zinc-900 rounded-xl border shadow-xs hover:shadow-sm transition-all ${
                          pf.task_status === "overdue" ? "border-rose-200 dark:border-rose-900/40" :
                          pf.task_status === "due" ? "border-amber-200 dark:border-amber-900/40" :
                          "border-zinc-200 dark:border-zinc-800"
                        }`}>
                          {/* Color dot */}
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl mt-0.5"
                            style={{ backgroundColor: (pf.fertilizer_color || "#10b981") + "22" }}>
                            <FlaskConical className="h-5 w-5 shrink-0" style={{ color: pf.fertilizer_color || "#10b981" }} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-zinc-900 dark:text-zinc-50">{pf.fertilizer_name}</span>
                              {pf.fertilizer_npk && (
                                <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded font-mono font-extrabold text-[10px]">
                                  {pf.fertilizer_npk}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusColor}`}>
                                {pf.task_status === "overdue" ? t("fertilizers.statusOverdue") :
                                 pf.task_status === "due" ? t("fertilizers.statusDue") :
                                 pf.task_status === "upcoming" ? t("fertilizers.statusUpcoming") :
                                 t("fertilizers.statusPending")}
                              </span>
                            </div>

                            <div className="mt-1.5 flex items-center gap-4 text-xs font-bold text-zinc-400 dark:text-zinc-500 flex-wrap">
                              <span>🔁 {language === "th" ? `ทุก ${pf.interval_days} วัน` : `Every ${pf.interval_days} days`}</span>
                              {pf.next_due_date && (
                                <span>{t("fertilizers.nextDue")}: {new Date(pf.next_due_date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", { month: "short", day: "numeric" })}</span>
                              )}
                              {pf.last_applied_date ? (
                                <span>{t("fertilizers.lastApplied")}: {new Date(pf.last_applied_date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", { month: "short", day: "numeric" })}</span>
                              ) : (
                                <span className="text-zinc-400 dark:text-zinc-600">{t("fertilizers.neverApplied")}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => {
                                setApplyingPF(pf);
                                setApplyAmount("");
                                setApplyNote("");
                                setApplyDate(new Date().toLocaleDateString("sv-SE"));
                                setApplyModalOpen(true);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              {t("fertilizers.applyNow")}
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(t("fertilizers.confirmRemoveSchedule"))) return;
                                try {
                                  await deletePlantFertilizer(pf.id);
                                  toast(t("fertilizers.removeScheduleSuccess"), "success");
                                  loadData();
                                } catch {
                                  toast(t("fertilizers.removeScheduleError"), "error");
                                }
                              }}
                              className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer"
                              title={t("fertilizers.removeSchedule")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Fertilizer History */}
                {fertHistory.length > 0 && (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                        <HistoryIcon className="h-3.5 w-3.5 text-violet-500" />
                        {t("fertilizers.history")}
                      </h4>
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">{fertHistory.length} records</span>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {fertHistory.map((h) => (
                        <div key={h.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: h.fertilizer_color || "#10b981" }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{h.fertilizer_name}</span>
                              {h.fertilizer_npk && (
                                <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded font-mono font-extrabold text-[10px]">{h.fertilizer_npk}</span>
                              )}
                              {h.amount && <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">— {h.amount}</span>}
                            </div>
                            {h.note && <p className="text-[11px] italic text-zinc-400 dark:text-zinc-500 mt-0.5">"{h.note}"</p>}
                          </div>
                          <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 shrink-0">
                            {new Date(h.applied_date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === "analytics" && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs p-6 space-y-4">
                <h3 className="text-sm font-bold text-zinc-850 dark:text-zinc-150">
                  {t("plantDetail.tabs.analytics")}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="border border-zinc-100 dark:border-zinc-850 rounded-xl p-5 bg-zinc-50/20 dark:bg-zinc-950/10 text-center">
                    <span className="text-3xl font-black text-emerald-600 font-mono">
                      {activities.length}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mt-1">
                      Total Activities logged
                    </span>
                  </div>

                  <div className="border border-zinc-100 dark:border-zinc-850 rounded-xl p-5 bg-zinc-50/20 dark:bg-zinc-950/10 text-center">
                    <span className="text-3xl font-black text-amber-500 font-mono">
                      {activities.filter(a => a.type === "fertilizing").length}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mt-1">
                      Fertilizations completed
                    </span>
                  </div>

                  <div className="border border-zinc-100 dark:border-zinc-850 rounded-xl p-5 bg-zinc-50/20 dark:bg-zinc-950/10 text-center">
                    <span className="text-3xl font-black text-indigo-500 font-mono">
                      {schedules.length}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mt-1">
                      Recurring care cycles
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-emerald-50/10 dark:bg-emerald-950/5 border border-emerald-100 dark:border-emerald-950/30 p-4 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                  <Sparkles className="h-4.5 w-4.5 shrink-0" />
                  Your plant is experiencing optimal health with structured scheduler cycles.
                </div>
              </div>
            )}
          </div>

          {/* SCHEDULE TIMERS ADD MODAL */}
          <Modal isOpen={schedModalOpen} onClose={() => setSchedModalOpen(false)} title={t("plantDetail.addSchedule")}>
            <form onSubmit={handleAddSchedule} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("schedules.type")}</label>
                <select
                  value={schedType}
                  onChange={(e) => setSchedType(e.target.value as any)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="fertilizing">{t("activities.fertilized")}</option>
                  <option value="pruning">{t("activities.pruned")}</option>
                  <option value="repotting">{t("activities.repotted")}</option>
                  <option value="pest_control">{t("activities.pest_control")}</option>
                  <option value="observation">{t("activities.observed")}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("schedules.interval")}</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={schedInterval}
                  onChange={(e) => setSchedInterval(Number(e.target.value))}
                  placeholder={t("schedules.placeholderInterval")}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("schedules.startDate")}</label>
                <input
                  type="date"
                  value={schedStartDate}
                  onChange={(e) => setSchedStartDate(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold font-mono"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSchedModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-850 cursor-pointer"
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

          {/* ACTIVITY LOGGER MODAL */}
          <Modal isOpen={actModalOpen} onClose={() => setActModalOpen(false)} title={t("activities.addActivity")}>
            <form onSubmit={handleAddActivity} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("activities.type")}</label>
                <select
                  value={actType}
                  onChange={(e) => setActType(e.target.value as any)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="fertilizing">{t("activities.fertilized")}</option>
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
                  onClick={() => setActModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-850 cursor-pointer"
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

          {/* ASSIGN FERTILIZER MODAL */}
          <Modal
            isOpen={assignFertModalOpen}
            onClose={() => setAssignFertModalOpen(false)}
            title={t("fertilizers.assignFertilizer")}
          >
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!selectedFertId) {
                  toast(t("fertilizers.requiredError", { field: t("fertilizers.selectFertilizer") }), "error");
                  return;
                }
                const chosenFert = fertLibrary.find(f => f.id === selectedFertId);
                const interval = fertIntervalOverride ?? chosenFert?.default_interval_days ?? 14;
                try {
                  await createPlantFertilizer({
                    plant_id: activePlant.id,
                    fertilizer_id: selectedFertId,
                    interval_days: interval,
                  });
                  toast(t("fertilizers.assignSuccess"), "success");
                  setAssignFertModalOpen(false);
                  loadData();
                } catch {
                  toast(t("fertilizers.assignError"), "error");
                }
              }}
              className="space-y-5"
            >
              {/* Select fertilizer */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  {t("fertilizers.selectFertilizer")} *
                </label>
                <select
                  value={selectedFertId}
                  onChange={e => {
                    setSelectedFertId(e.target.value);
                    setFertIntervalOverride(null); // reset override when fertilizer changes
                  }}
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                  required
                >
                  <option value="">— {t("fertilizers.selectFertilizer")} —</option>
                  {fertLibrary.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}{f.npk_formula ? ` (${f.npk_formula})` : ""}
                    </option>
                  ))}
                </select>
                {fertLibrary.length === 0 && (
                  <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500">
                    {language === "th" ? "ยังไม่มีปุ๋ยในคลัง — กรุณาเพิ่มปุ๋ยก่อน" : "No fertilizers in library — add fertilizers first."}
                  </p>
                )}
              </div>

              {/* Interval override */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  {t("fertilizers.intervalDays")}
                </label>
                {selectedFertId && (
                  <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">
                    {t("fertilizers.useDefault").replace("{days}", String(fertLibrary.find(f => f.id === selectedFertId)?.default_interval_days ?? 14))}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={fertIntervalOverride ?? fertLibrary.find(f => f.id === selectedFertId)?.default_interval_days ?? 14}
                    onChange={e => setFertIntervalOverride(Number(e.target.value))}
                    className="w-24 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                  <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">
                    {language === "th" ? "วัน" : "days"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setAssignFertModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  {t("fertilizers.assignFertilizer")}
                </button>
              </div>
            </form>
          </Modal>

          {/* APPLY FERTILIZER MODAL */}
          <Modal
            isOpen={applyModalOpen}
            onClose={() => setApplyModalOpen(false)}
            title={t("fertilizers.applyFertilizer")}
          >
            {applyingPF && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await applyFertilizer(applyingPF.id, applyAmount, applyNote, applyDate);
                    toast(t("fertilizers.applySuccess"), "success");
                    setApplyModalOpen(false);
                    setApplyingPF(null);
                    loadData();
                  } catch {
                    toast(t("fertilizers.applyError"), "error");
                  }
                }}
                className="space-y-4"
              >
                {/* Fertilizer info */}
                <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                  <div className="h-9 w-9 flex items-center justify-center rounded-lg shrink-0"
                    style={{ backgroundColor: (applyingPF.fertilizer_color || "#10b981") + "22" }}>
                    <FlaskConical className="h-4.5 w-4.5" style={{ color: applyingPF.fertilizer_color || "#10b981" }} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">{applyingPF.fertilizer_name}</p>
                    <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{applyingPF.fertilizer_npk}</p>
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    {t("fertilizers.applyDate")}
                  </label>
                  <input
                    type="date"
                    value={applyDate}
                    onChange={e => setApplyDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    {t("fertilizers.applyAmount")}
                  </label>
                  <input
                    value={applyAmount}
                    onChange={e => setApplyAmount(e.target.value)}
                    placeholder={t("fertilizers.applyAmountPlaceholder")}
                    className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>

                {/* Note */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    {t("fertilizers.applyNote")}
                  </label>
                  <textarea
                    rows={2}
                    value={applyNote}
                    onChange={e => setApplyNote(e.target.value)}
                    placeholder={language === "th" ? "บันทึกเพิ่มเติม..." : "Optional notes..."}
                    className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none transition-all"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => { setApplyModalOpen(false); setApplyingPF(null); }}
                    className="px-4 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t("fertilizers.applyFertilizer")}
                  </button>
                </div>
              </form>
            )}
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

  // --- SUBCOMPONENT: GARDENS & PLANTS LIST VIEW ---
  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950 dark:text-zinc-50 tracking-tight">
              {t("nav.plants")}
            </h1>
            <p className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">
              Manage your gardens, register plants, and track health statuses
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openAddGarden}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-zinc-750 dark:text-zinc-300 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <FolderPlus className="h-4 w-4 shrink-0" />
              {t("gardens.addGarden")}
            </button>
            <button
              onClick={openAddPlant}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4 shrink-0" />
              {t("plants.addPlant")}
            </button>
          </div>
        </div>

        {/* GARDENS CONTAINER GRID */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {t("nav.gardens")}
          </h3>
          
          {gardens.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400 dark:text-zinc-500 font-semibold border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              {t("gardens.noGardens")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* "All Gardens" selection card */}
              <div
                onClick={() => setSelectedGardenFilter("all")}
                className={`group cursor-pointer border rounded-2xl overflow-hidden shadow-xs hover:border-emerald-500 transition-all duration-200 flex ${
                  selectedGardenFilter === "all"
                    ? "border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/5 ring-1 ring-emerald-500"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                }`}
              >
                <div className="h-20 w-20 shrink-0 bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600">
                  <Columns className="h-6 w-6" />
                </div>
                <div className="p-4 flex flex-col justify-center min-w-0">
                  <h4 className="text-sm font-extrabold text-zinc-850 dark:text-zinc-150 truncate">
                    {t("plants.filterGarden")}
                  </h4>
                  <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {plants.filter(p => !p.archived).length} active plants
                  </p>
                </div>
              </div>

              {/* Dynamic Gardens cards */}
              {gardens.map((g) => {
                const isSelected = selectedGardenFilter === g.id;
                const gardenPlantsCount = plants.filter(p => p.garden_id === g.id && !p.archived).length;
                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGardenFilter(g.id)}
                    className={`group cursor-pointer border rounded-2xl overflow-hidden shadow-xs hover:border-emerald-500 transition-all duration-200 flex relative ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/5 ring-1 ring-emerald-500"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                    }`}
                  >
                    <img
                      src={g.cover_image}
                      alt={g.name}
                      className="h-20 w-20 shrink-0 object-cover bg-zinc-100"
                    />
                    <div className="p-4 flex flex-col justify-center min-w-0 pr-12">
                      <h4 className="text-sm font-extrabold text-zinc-850 dark:text-zinc-150 truncate">
                        {g.name}
                      </h4>
                      <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                        {g.description || "No description"}
                      </p>
                      <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mt-0.5 font-mono">
                        {t("gardens.plantsCount", { count: gardenPlantsCount })}
                      </p>
                    </div>

                    {/* Garden CRUD actions hover overlays */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => openEditGarden(g, e)}
                        className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                        title="Edit garden"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteGarden(g.id, e)}
                        className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-rose-600 cursor-pointer"
                        title="Delete garden"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PLANTS FILTERING BAR */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3 shadow-xs">
          {/* Status selector */}
          <div className="flex-1 max-w-xs">
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold"
            >
              <option value="all">{t("plants.filterStatus")}</option>
              <option value="healthy">{t("plants.statusHealthy")}</option>
              <option value="flowering">{t("plants.statusFlowering")}</option>
              <option value="fruiting">{t("plants.statusFruiting")}</option>
              <option value="dormant">{t("plants.statusDormant")}</option>
              <option value="sick">{t("plants.statusSick")}</option>
            </select>
          </div>

          {/* Search bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("plants.placeholderSearch")}
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold"
            />
          </div>

          {/* Archive toggle */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-2 border rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              showArchived
                ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/40"
                : "border-zinc-200 dark:border-zinc-800 text-zinc-650 hover:bg-zinc-50 dark:hover:bg-zinc-850"
            }`}
          >
            {showArchived ? t("plants.hideArchived") : t("plants.showArchived")}
          </button>
        </div>

        {/* PLANTS GRID */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {showArchived ? t("plants.archivedTitle") : t("nav.plants")}
          </h3>

          {filteredPlants.length === 0 ? (
            <EmptyState
              icon={Leaf}
              title={t("plants.noPlants")}
              description="Register new green companions and configure their care requirements to get started."
              actionLabel={t("plants.addPlant")}
              onAction={openAddPlant}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPlants.map((plant) => (
                <div
                  key={plant.id}
                  onClick={() => router.push(`/plants?id=${plant.id}`)}
                  className="group cursor-pointer border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs hover:border-emerald-500 hover:shadow-md bg-white dark:bg-zinc-900 transition-all duration-200 flex flex-col"
                >
                  {/* Card Cover */}
                  <div className="h-40 bg-zinc-100 relative overflow-hidden">
                    <img
                      src={plant.cover_image}
                      alt={plant.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Status badge */}
                    <span className={`absolute top-3 right-3 px-2 py-0.5 border text-[10px] font-extrabold rounded-full ${getStatusBadgeColor(plant.status)}`}>
                      {getStatusLabel(plant.status)}
                    </span>
                  </div>

                  {/* Card Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-zinc-850 dark:text-zinc-150 group-hover:text-emerald-600 transition-colors truncate">
                        {plant.name}
                      </h4>
                      <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 font-mono -mt-0.5 truncate">
                        {plant.species}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-850 pt-3">
                      {plant.location ? (
                        <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-bold max-w-[120px] truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {plant.location}
                        </div>
                      ) : (
                        <span />
                      )}
                      
                      {/* Hover action indicators */}
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => openEditPlant(plant, e)}
                          className="p-1 rounded bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                          title="Edit plant"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleToggleArchive(plant, e)}
                          className="p-1 rounded bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-rose-600 cursor-pointer"
                          title="Archive/unarchive"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GARDEN FORM MODAL */}
        <Modal
          isOpen={gardenModalOpen}
          onClose={() => setGardenModalOpen(false)}
          title={editingGarden ? t("gardens.editGarden") : t("gardens.addGarden")}
        >
          <form onSubmit={handleGardenSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("gardens.name")}</label>
              <input
                type="text"
                value={gardenName}
                onChange={(e) => setGardenName(e.target.value)}
                placeholder={t("gardens.placeholderName")}
                className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("gardens.description")}</label>
              <textarea
                value={gardenDesc}
                onChange={(e) => setGardenDesc(e.target.value)}
                placeholder={t("gardens.placeholderDesc")}
                rows={3}
                className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div className="space-y-1">
              <ImageUploadInput
                value={gardenCover}
                onChange={setGardenCover}
                placeholder="https://images.unsplash.com/photo-..."
                label={t("gardens.coverImage")}
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setGardenModalOpen(false)}
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

        {/* PLANT FORM MODAL */}
        <Modal
          isOpen={plantModalOpen}
          onClose={() => setPlantModalOpen(false)}
          title={editingPlant ? t("plants.editPlant") : t("plants.addPlant")}
        >
          <form onSubmit={handlePlantSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("plants.name")}</label>
                <input
                  type="text"
                  value={plantName}
                  onChange={(e) => setPlantName(e.target.value)}
                  placeholder={t("plants.placeholderName")}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("plants.species")}</label>
                <input
                  type="text"
                  value={plantSpecies}
                  onChange={(e) => setPlantSpecies(e.target.value)}
                  placeholder={t("plants.placeholderSpecies")}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("plants.garden")}</label>
                <select
                  value={plantGardenId}
                  onChange={(e) => setPlantGardenId(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="">{t("plants.noGarden")}</option>
                  {gardens.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("plants.location")}</label>
                <input
                  type="text"
                  value={plantLoc}
                  onChange={(e) => setPlantLoc(e.target.value)}
                  placeholder={t("plants.placeholderLocation")}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("plants.plantingDate")}</label>
                <input
                  type="date"
                  value={plantDate}
                  onChange={(e) => setPlantDate(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("plants.status")}</label>
                <select
                  value={plantStatus}
                  onChange={(e) => setPlantStatus(e.target.value as any)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="healthy">{t("plants.statusHealthy")}</option>
                  <option value="flowering">{t("plants.statusFlowering")}</option>
                  <option value="fruiting">{t("plants.statusFruiting")}</option>
                  <option value="dormant">{t("plants.statusDormant")}</option>
                  <option value="sick">{t("plants.statusSick")}</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("plants.notes")}</label>
              <textarea
                value={plantNotes}
                onChange={(e) => setPlantNotes(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div className="space-y-1">
              <ImageUploadInput
                value={plantCover}
                onChange={setPlantCover}
                placeholder="https://images.unsplash.com/photo-..."
                label={t("plants.coverImage")}
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setPlantModalOpen(false)}
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
