"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  PlantStatusChart,
  MonthlyActivitiesChart,
  TaskCompletionRateChart
} from "@/components/Charts";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import {
  getGardens,
  getPlants,
  getSchedules,
  getActivities,
  performSchedule,
  waterAllPlants,
  getFertilizers,
  getFertilizerHistory,
  Garden,
  Plant,
  Schedule,
  Activity,
  Fertilizer,
  enrichSchedule
} from "@/services/db";
import {
  Leaf,
  Calendar,
  AlertTriangle,
  History,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Activity as ActivityIcon,
  Play,
  Droplet,
  Flame,
  Scissors,
  RefreshCw,
  Bug,
  Eye,
  Sprout,
  Check,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Wind,
  Thermometer,
  Droplets
} from "lucide-react";

const activityConfigs: Record<string, { icon: React.ComponentType<any>; bgClass: string; textClass: string }> = {
  watering: {
    icon: Droplet,
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    textClass: "text-blue-600 dark:text-blue-400"
  },
  fertilizing: {
    icon: Flame,
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    textClass: "text-amber-600 dark:text-amber-400"
  },
  pruning: {
    icon: Scissors,
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    textClass: "text-emerald-600 dark:text-emerald-400"
  },
  repotting: {
    icon: RefreshCw,
    bgClass: "bg-purple-50 dark:bg-purple-950/30",
    textClass: "text-purple-600 dark:text-purple-400"
  },
  pest_control: {
    icon: Bug,
    bgClass: "bg-rose-50 dark:bg-rose-950/30",
    textClass: "text-rose-600 dark:text-rose-400"
  },
  observation: {
    icon: Eye,
    bgClass: "bg-zinc-100 dark:bg-zinc-800",
    textClass: "text-zinc-600 dark:text-zinc-400"
  },
  observed: {
    icon: Eye,
    bgClass: "bg-zinc-100 dark:bg-zinc-800",
    textClass: "text-zinc-600 dark:text-zinc-400"
  },
  flowering: {
    icon: Sprout,
    bgClass: "bg-pink-50 dark:bg-pink-950/30",
    textClass: "text-pink-600 dark:text-pink-400"
  },
  harvest: {
    icon: Sprout,
    bgClass: "bg-teal-50 dark:bg-teal-950/30",
    textClass: "text-teal-600 dark:text-teal-400"
  },
  bulk_watering: {
    icon: Droplet,
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    textClass: "text-blue-600 dark:text-blue-400"
  }
};

const getActivityConfig = (type: string) => {
  return activityConfigs[type] || {
    icon: Leaf,
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    textClass: "text-emerald-600 dark:text-emerald-400"
  };
};

interface WeatherData {
  condition: "sunny" | "rainy" | "cloudy" | "windy" | "unknown";
  temp: number | string;
  humidity: number | string;
  windSpeed: number | string;
  rainProb: number | string;
  forecast: {
    dayLabel: string;
    condition: "sunny" | "rainy" | "cloudy" | "windy" | "unknown";
    temp: number | string;
  }[];
}

export default function DashboardPage() {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [schedules, setSchedules] = useState<(Schedule & { last_fertilizer?: string })[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isWaterAllModalOpen, setIsWaterAllModalOpen] = useState(false);

  // Fertilizer selection states
  const [fertilizers, setFertilizers] = useState<Fertilizer[]>([]);
  const [isFertilizerModalOpen, setIsFertilizerModalOpen] = useState(false);
  const [selectedFertilizerId, setSelectedFertilizerId] = useState("");
  const [fertilizerAmount, setFertilizerAmount] = useState("");
  const [fertilizerNotes, setFertilizerNotes] = useState("");
  const [activeFertilizingTask, setActiveFertilizingTask] = useState<Schedule | null>(null);

  // Weather state
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [activeLocationName, setActiveLocationName] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString(language === "th" ? "th-TH" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      const dateStr = now.toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
        month: "short",
        day: "numeric"
      });
      setCurrentTime(`${dateStr} • ${timeStr}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 10000); // update every 10 seconds
    return () => clearInterval(timer);
  }, [language]);

  useEffect(() => {
    if (!user) return;

    const lat = localStorage.getItem(`plant_tracker_user_latitude_${user.id}`);
    const lng = localStorage.getItem(`plant_tracker_user_longitude_${user.id}`);
    const locName = localStorage.getItem(`plant_tracker_user_location_name_${user.id}`);

    const getForecastDayLabel = (offset: number) => {
      const days = language === "th"
        ? ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return days[date.getDay()];
    };

    // Simulated/mock fallback function
    const runSimulation = () => {
      const dayOfWeek = new Date().getDay();
      let mainCondition: "sunny" | "rainy" | "cloudy" | "windy" = "sunny";
      let temp = 33;
      let humidity = 60;
      let windSpeed = 12;
      let rainProb = 15;

      if (dayOfWeek === 1 || dayOfWeek === 4) {
        mainCondition = "rainy";
        temp = 28;
        humidity = 85;
        windSpeed = 16;
        rainProb = 80;
      } else if (dayOfWeek === 3 || dayOfWeek === 6) {
        mainCondition = "cloudy";
        temp = 30;
        humidity = 70;
        windSpeed = 10;
        rainProb = 40;
      } else if (dayOfWeek === 2) {
        mainCondition = "windy";
        temp = 31;
        humidity = 55;
        windSpeed = 22;
        rainProb = 20;
      }

      setActiveLocationName(language === "th" ? "กรุงเทพฯ" : "Bangkok");
      setWeatherData({
        condition: mainCondition,
        temp,
        humidity,
        windSpeed,
        rainProb,
        forecast: [
          {
            dayLabel: getForecastDayLabel(1),
            condition: mainCondition === "sunny" ? "cloudy" : mainCondition === "rainy" ? "sunny" : "windy",
            temp: mainCondition === "sunny" ? 31 : 33,
          },
          {
            dayLabel: getForecastDayLabel(2),
            condition: mainCondition === "rainy" ? "cloudy" : "rainy",
            temp: mainCondition === "rainy" ? 30 : 28,
          },
          {
            dayLabel: getForecastDayLabel(3),
            condition: "sunny",
            temp: 34,
          }
        ]
      });
    };

    // Map weather code from Open-Meteo to our weather conditions
    const mapWmoCode = (code: number, wind: number): "sunny" | "rainy" | "cloudy" | "windy" => {
      if (wind > 18) return "windy";
      if ([0, 1].includes(code)) return "sunny";
      if ([2, 3, 45, 48].includes(code)) return "cloudy";
      return "rainy"; // fallback/drizzle/rain/showers/thunderstorm
    };

    const fetchRealWeather = async (latitudeVal: string, longitudeVal: string) => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitudeVal}&longitude=${longitudeVal}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max&timezone=auto`
        );
        if (!response.ok) throw new Error("Weather API status not OK");
        
        const data = await response.json();
        const currentData = data.current;
        const dailyData = data.daily;

        const currentWind = currentData.wind_speed_10m;
        const currentCode = currentData.weather_code;
        const currentTemp = Math.round(currentData.temperature_2m);
        const currentHumidity = Math.round(currentData.relative_humidity_2m);
        
        // Estimate rain probability based on weather code
        let rainProbability = 10;
        if ([51, 53, 55].includes(currentCode)) rainProbability = 40;
        else if ([61, 63, 65, 80, 81, 82].includes(currentCode)) rainProbability = 75;
        else if ([95, 96, 99].includes(currentCode)) rainProbability = 95;

        // Map forecast conditions
        const mappedForecast = (dailyData.weather_code || []).slice(1, 4).map((codeItem: number, idx: number) => {
          const tempMax = Math.round(dailyData.temperature_2m_max[idx + 1] || 32);
          return {
            dayLabel: getForecastDayLabel(idx + 1),
            condition: mapWmoCode(codeItem, 10),
            temp: tempMax
          };
        });

        // Set state
        setActiveLocationName(locName || (language === "th" ? "พิกัดที่ตั้ง" : "My Location"));
        setWeatherData({
          condition: mapWmoCode(currentCode, currentWind),
          temp: currentTemp,
          humidity: currentHumidity,
          windSpeed: Math.round(currentWind),
          rainProb: rainProbability,
          forecast: mappedForecast.length > 0 ? mappedForecast : [
            { dayLabel: getForecastDayLabel(1), condition: "unknown", temp: "?" },
            { dayLabel: getForecastDayLabel(2), condition: "unknown", temp: "?" },
            { dayLabel: getForecastDayLabel(3), condition: "unknown", temp: "?" }
          ]
        });
      } catch (err) {
        console.warn("Could not fetch from Open-Meteo, falling back to simulation:", err);
        runSimulation();
      }
    };

    if (lat && lng) {
      fetchRealWeather(lat, lng);
    } else {
      runSimulation();
    }
  }, [user, language]);

  const loadDashboardData = async () => {
    try {
      const gList = await getGardens();
      const pList = await getPlants(null, false); // Active plants only
      const sList = await getSchedules();
      const aList = await getActivities(null, 15);
      const fList = await getFertilizers();
      const histList = await getFertilizerHistory();

      // Enrich schedules with the last applied fertilizer for fertilizing tasks
      const enrichedSchedules = sList.map(s => {
        if (s.type === "fertilizing") {
          const lastHist = histList.find(h => h.plant_id === s.plant_id);
          if (lastHist) {
            return {
              ...s,
              last_fertilizer: `${lastHist.fertilizer_name}${lastHist.fertilizer_npk ? ` (${lastHist.fertilizer_npk})` : ""}`
            };
          }
        }
        return s;
      });

      setGardens(gList);
      setPlants(pList);
      setSchedules(enrichedSchedules);
      setActivities(aList);
      setFertilizers(fList);
    } catch (e) {
      console.error(e);
      toast(t("dashboard.loadError"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleCompleteTask = async (task: Schedule) => {
    if (task.type === "fertilizing") {
      setActiveFertilizingTask(task);
      setFertilizerAmount("");
      setFertilizerNotes("");
      
      // Load fertilizers dynamically in case they changed
      const fList = await getFertilizers();
      setFertilizers(fList);
      
      if (fList.length > 0) {
        setSelectedFertilizerId(fList[0].id);
      } else {
        setSelectedFertilizerId("");
      }
      setIsFertilizerModalOpen(true);
      return;
    }

    try {
      const todayISO = new Date().toISOString();
      await performSchedule(task.id, todayISO);
      toast(t("schedules.taskCompletedMsg"), "success");
      // Reload dashboard stats
      await loadDashboardData();
    } catch (e) {
      toast(t("dashboard.completeTaskError"), "error");
    }
  };

  const handleFertilizerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFertilizingTask) return;

    try {
      const todayISO = new Date().toISOString();
      const selectedFert = fertilizers.find(f => f.id === selectedFertilizerId);
      const fertLabel = selectedFert ? `${selectedFert.name} (${selectedFert.npk_formula})` : "";
      
      const details = fertLabel
        ? (language === "th" ? `ใส่ปุ๋ย: ${fertLabel}${fertilizerAmount ? ` — ${fertilizerAmount}` : ""}` : `Applied: ${fertLabel}${fertilizerAmount ? ` — ${fertilizerAmount}` : ""}`)
        : (language === "th" ? "ใส่ปุ๋ย" : "Fertilizing");

      await performSchedule(
        activeFertilizingTask.id,
        todayISO,
        details,
        fertilizerNotes,
        selectedFertilizerId,
        fertilizerAmount
      );
      toast(t("schedules.taskCompletedMsg"), "success");
      setIsFertilizerModalOpen(false);
      await loadDashboardData();
    } catch (err) {
      toast(t("dashboard.completeTaskError"), "error");
    }
  };

  const handleWaterAllConfirm = async () => {
    try {
      const result = await waterAllPlants();
      if (result.success) {
        toast(t("dashboard.waterAllSuccess"), "success");
        await loadDashboardData();
      }
    } catch (e) {
      console.error(e);
      toast(t("common.error"), "error");
    } finally {
      setIsWaterAllModalOpen(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6 animate-pulse">
          {/* Top Bar skeleton */}
          <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
          
          {/* Card grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl" />
            ))}
          </div>

          {/* Body columns skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl" />
              <div className="h-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl" />
            </div>
            <div className="space-y-6">
              <div className="h-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl" />
              <div className="h-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // --- Aggregate Stats ---
  const totalPlantsCount = plants.length;
  
  // Tasks due today (includes 'due')
  const dueTodayTasks = schedules.filter(s => s.task_status === "due");
  const dueTodayCount = dueTodayTasks.length;

  // Overdue tasks (includes 'overdue')
  const overdueTasks = schedules.filter(s => s.task_status === "overdue");
  const overdueCount = overdueTasks.length;

  // Activities this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const thisMonthActivitiesCount = activities.filter(
    a => new Date(a.date).getTime() >= startOfMonth.getTime()
  ).length;

  // Task health rate (schedules not overdue / total schedules)
  const totalSchedulesCount = schedules.length;
  const completedSchedulesCount = totalSchedulesCount - overdueCount;

  // Plant Health Overview Data
  const plantStatusSummary = {
    healthy: 0,
    flowering: 0,
    fruiting: 0,
    dormant: 0,
    sick: 0,
  };
  plants.forEach(p => {
    if (p.status in plantStatusSummary) {
      plantStatusSummary[p.status]++;
    }
  });

  const statusChartData = Object.entries(plantStatusSummary).map(([status, count]) => ({
    status: status as any,
    count,
  }));

  // Monthly Activity Chart Data (last 6 months)
  const monthlyActivitySummary: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyActivitySummary[monthKey] = 0;
  }

  activities.forEach(a => {
    const activityMonth = a.date.slice(0, 7); // YYYY-MM
    if (activityMonth in monthlyActivitySummary) {
      monthlyActivitySummary[activityMonth]++;
    }
  });

  const monthlyChartData = Object.entries(monthlyActivitySummary).map(([month, count]) => ({
    month,
    count,
  }));

  // Filter Tasks lists
  const upcomingTasks = schedules
    .filter(s => s.task_status === "upcoming")
    .sort((a, b) => new Date(a.next_due_date!).getTime() - new Date(b.next_due_date!).getTime());

  const sortedOverdueTasks = [...overdueTasks].sort(
    (a, b) => new Date(a.next_due_date!).getTime() - new Date(b.next_due_date!).getTime()
  );

  // Recent timeline (last 4 activities)
  const recentActivities = activities.slice(0, 4);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950 dark:text-zinc-50 tracking-tight">
              {t("nav.dashboard")}
            </h1>
            <p className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">
              {t("dashboard.welcome")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsWaterAllModalOpen(true)}
              disabled={plants.length === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-zinc-300 disabled:dark:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all duration-150 cursor-pointer"
              title={plants.length === 0 ? t("dashboard.noPlantsToWater") : t("dashboard.waterAll")}
            >
              <Droplet className="h-4 w-4" />
              <span>{plants.length === 0 ? t("dashboard.noPlantsToWater") : t("dashboard.waterAll")}</span>
            </button>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Plants */}
          <div
            onClick={() => router.push("/plants")}
            className="group cursor-pointer flex items-center justify-between p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs hover:border-emerald-500 hover:shadow-md transition-all duration-200"
          >
            <div className="space-y-1">
              <span className="text-xs font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">
                {t("dashboard.totalPlants")}
              </span>
              <p className="text-3xl font-black text-zinc-800 dark:text-zinc-100 group-hover:text-emerald-600 transition-colors">
                {totalPlantsCount}
              </p>
            </div>
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
              <Leaf className="h-5 w-5" />
            </div>
          </div>

          {/* Card 2: Due Today */}
          <div
            onClick={() => router.push("/calendar")}
            className="group cursor-pointer flex items-center justify-between p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs hover:border-emerald-500 hover:shadow-md transition-all duration-200"
          >
            <div className="space-y-1">
              <span className="text-xs font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">
                {t("dashboard.dueToday")}
              </span>
              <p className="text-3xl font-black text-zinc-800 dark:text-zinc-100">
                {dueTodayCount}
              </p>
            </div>
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">
              <Calendar className="h-5 w-5" />
            </div>
          </div>

          {/* Card 3: Overdue */}
          <div
            onClick={() => router.push("/calendar")}
            className="group cursor-pointer flex items-center justify-between p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs hover:border-rose-500 hover:shadow-md transition-all duration-200"
          >
            <div className="space-y-1">
              <span className="text-xs font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">
                {t("dashboard.overdueTasks")}
              </span>
              <p className="text-3xl font-black text-rose-600 dark:text-rose-400">
                {overdueCount}
              </p>
            </div>
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>

          {/* Card 4: Month Activities */}
          <div
            onClick={() => router.push("/activities")}
            className="group cursor-pointer flex items-center justify-between p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs hover:border-emerald-500 hover:shadow-md transition-all duration-200"
          >
            <div className="space-y-1">
              <span className="text-xs font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">
                {t("dashboard.activitiesMonth")}
              </span>
              <p className="text-3xl font-black text-zinc-800 dark:text-zinc-100">
                {thisMonthActivitiesCount}
              </p>
            </div>
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
              <History className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* TWO-COLUMN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* COLUMN 1: TASKS & HISTORY (2/3 WIDTH) */}
          <div className="lg:col-span-2 space-y-6">
            {/* OVERDUE TASKS (FORGOT TO DO) */}
            {overdueCount > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/50 rounded-xl shadow-xs overflow-hidden">
                <div className="px-6 py-5 border-b border-rose-100 dark:border-rose-900/40 flex items-center justify-between bg-rose-50/10 dark:bg-rose-950/5">
                  <h2 className="text-sm font-bold text-rose-800 dark:text-rose-455 flex items-center gap-2">
                    <AlertTriangle className="h-4.5 w-4.5 text-rose-600 animate-pulse" />
                    {t("dashboard.overdueTasksBox")}
                    <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-rose-600 rounded-full">
                      {overdueCount}
                    </span>
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {sortedOverdueTasks.map((task) => {
                      const { icon: IconComponent, bgClass, textClass } = getActivityConfig(task.type);
                      return (
                        <div
                          key={task.id}
                          className="flex items-center justify-between gap-3 p-4 border border-rose-100 dark:border-rose-900/30 rounded-xl bg-white dark:bg-zinc-900/50 shadow-xs hover:border-rose-500/50 hover:shadow-sm transition-all duration-200"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Plant Cover Image or Activity Icon Fallback */}
                            {task.plant_cover_image ? (
                              <img
                                src={task.plant_cover_image}
                                alt={task.plant_name}
                                className="h-10 w-10 shrink-0 rounded-xl object-cover bg-zinc-100 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/50"
                              />
                            ) : (
                              <div className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-xl ${bgClass} transition-colors`}>
                                <IconComponent className={`h-5 w-5 ${textClass}`} />
                              </div>
                            )}
                            {/* Plant and Task Details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col">
                                <button
                                  onClick={() => router.push(`/plants?id=${task.plant_id}`)}
                                  className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 hover:text-rose-600 dark:hover:text-rose-400 hover:underline transition-colors cursor-pointer truncate text-left leading-tight"
                                >
                                  {task.plant_name}
                                </button>
                                <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 mt-0.5">
                                  {t(`activities.${task.type}`)}
                                </span>
                                <span className="w-fit mt-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/20 border border-rose-100/50 dark:border-rose-900/30 rounded">
                                  {t("dashboard.overdueDaysCount", { days: task.overdue_days || 1 })}
                                </span>
                                {task.type === "fertilizing" && task.last_fertilizer && (
                                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 mt-1 truncate" title={task.last_fertilizer}>
                                    🧪 {language === "th" ? `ปุ๋ยล่าสุด: ${task.last_fertilizer}` : `Last: ${task.last_fertilizer}`}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Circle Mark Completed Button */}
                          <button
                            onClick={() => handleCompleteTask(task)}
                            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-rose-50 hover:bg-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-700 text-rose-600 hover:text-white dark:text-rose-400 transition-all duration-150 cursor-pointer shadow-xs"
                            title={t("schedules.markCompleted")}
                          >
                            <Check className="h-4.5 w-4.5 stroke-[3]" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TODAY'S TASKS */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
              <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/25 dark:bg-zinc-900/50">
                <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                  {t("dashboard.todaysTasks")}
                  {dueTodayCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-emerald-600 rounded-full">
                      {dueTodayCount}
                    </span>
                  )}
                </h2>
              </div>
              
              <div className="p-6">
                {dueTodayCount === 0 ? (
                  <div className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500 font-semibold">
                    {t("dashboard.noTasksToday")}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {dueTodayTasks.map((task) => {
                      const { icon: IconComponent, bgClass, textClass } = getActivityConfig(task.type);
                      return (
                        <div
                          key={task.id}
                          className="flex items-center justify-between gap-3 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/50 shadow-xs hover:border-emerald-500/50 hover:shadow-sm transition-all duration-200"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Plant Cover Image or Activity Icon Fallback */}
                            {task.plant_cover_image ? (
                              <img
                                src={task.plant_cover_image}
                                alt={task.plant_name}
                                className="h-10 w-10 shrink-0 rounded-xl object-cover bg-zinc-100 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/50"
                              />
                            ) : (
                              <div className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-xl ${bgClass} transition-colors`}>
                                <IconComponent className={`h-5 w-5 ${textClass}`} />
                              </div>
                            )}
                            {/* Plant and Task Details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col">
                                <button
                                  onClick={() => router.push(`/plants?id=${task.plant_id}`)}
                                  className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors cursor-pointer truncate text-left leading-tight"
                                >
                                  {task.plant_name}
                                </button>
                                <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 mt-0.5">
                                  {t(`activities.${task.type}`)}
                                </span>
                                {task.type === "fertilizing" && task.last_fertilizer && (
                                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 mt-1 truncate" title={task.last_fertilizer}>
                                    🧪 {language === "th" ? `ปุ๋ยล่าสุด: ${task.last_fertilizer}` : `Last: ${task.last_fertilizer}`}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Circle Mark Completed Button */}
                          <button
                            onClick={() => handleCompleteTask(task)}
                            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-600 dark:bg-emerald-950/20 dark:hover:bg-emerald-700 text-emerald-600 hover:text-white dark:text-emerald-400 transition-all duration-150 cursor-pointer shadow-xs"
                            title={t("schedules.markCompleted")}
                          >
                            <Check className="h-4.5 w-4.5 stroke-[3]" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* UPCOMING TASKS (NEXT 7 DAYS) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
              <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
                <h2 className="text-sm font-bold text-zinc-850 dark:text-zinc-150">
                  {t("dashboard.upcomingTasks")}
                </h2>
              </div>
              <div className="p-6">
                {upcomingTasks.length === 0 ? (
                  <div className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500 font-semibold">
                    {t("dashboard.noUpcomingTasks")}
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 space-y-3">
                    {upcomingTasks.slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={task.plant_cover_image}
                            alt={task.plant_name}
                            className="h-9 w-9 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-850"
                          />
                          <div>
                            <p className="text-sm font-bold text-zinc-850 dark:text-zinc-150">
                              {t(`activities.${task.type}`)}
                            </p>
                            <p className="text-xs font-bold text-zinc-400 font-mono">
                              {task.plant_name}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-extrabold text-zinc-500 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-1 rounded-md font-mono">
                          {new Date(task.next_due_date!).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RECENT ACTIVITIES TIMELINE */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
              <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-850 dark:text-zinc-150">
                  {t("dashboard.recentActivities")}
                </h2>
                <button
                  onClick={() => router.push("/activities")}
                  className="text-xs font-bold text-emerald-650 hover:text-emerald-550 dark:text-emerald-450 flex items-center gap-0.5 cursor-pointer"
                >
                  {t("common.viewAll")}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-6">
                {recentActivities.length === 0 ? (
                  <div className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500 font-semibold">
                    {t("dashboard.noActivities")}
                  </div>
                ) : (
                  <div className="relative border-l-2 border-zinc-100 dark:border-zinc-850 pl-5 ml-2.5 space-y-6">
                    {recentActivities.map((act) => (
                      <div key={act.id} className="relative">
                        {/* Circle bullet indicator */}
                        <span className="absolute -left-[27px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-white dark:ring-zinc-900" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 dark:text-emerald-450 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded uppercase">
                              {t(`activities.${act.type}`)}
                            </span>
                            <span className="text-xs font-black text-zinc-500 dark:text-zinc-400 truncate">
                              {language === "th" ? `สำหรับ ${act.plant_name}` : `for ${act.plant_name}`}
                            </span>
                            <span className="text-[10px] font-bold text-zinc-400 font-mono ml-auto">
                              {new Date(act.date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mt-1.5">
                            {act.details}
                          </p>
                          {act.notes && (
                            <p className="text-[10px] italic text-zinc-400 dark:text-zinc-500 mt-1 leading-relaxed border-l border-zinc-200 dark:border-zinc-850 pl-2.5">
                              &quot;{act.notes}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COLUMN 2: ANALYTICS & CHARTS (1/3 WIDTH) */}
          <div className="space-y-6">
            {/* WEATHER & GARDENING ADVISOR */}
            {weatherData && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
                {/* Card Header */}
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/25 dark:bg-zinc-900/50">
                  <h3 className="text-sm font-bold text-zinc-850 dark:text-zinc-150 flex items-center gap-2">
                    <Sun className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
                    <span>{t("dashboard.weatherWidgetTitle")}</span>
                    {activeLocationName && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded uppercase">
                        📍 {activeLocationName}
                      </span>
                    )}
                  </h3>
                  {currentTime && (
                    <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 font-mono">
                      {currentTime}
                    </span>
                  )}
                </div>
                
                <div className="p-6 space-y-4">
                  {/* Current weather layout */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                        weatherData.condition === "sunny" ? "bg-amber-50 dark:bg-amber-950/20 text-amber-500" :
                        weatherData.condition === "rainy" ? "bg-blue-50 dark:bg-blue-950/20 text-blue-500" :
                        weatherData.condition === "cloudy" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500" :
                        "bg-teal-50 dark:bg-teal-950/20 text-teal-500"
                      }`}>
                        {weatherData.condition === "sunny" && <Sun className="h-7 w-7 animate-pulse" />}
                        {weatherData.condition === "rainy" && <CloudRain className="h-7 w-7 animate-bounce" />}
                        {weatherData.condition === "cloudy" && <Cloud className="h-7 w-7 animate-pulse" />}
                        {weatherData.condition === "windy" && <Wind className="h-7 w-7" />}
                      </div>
                      <div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{weatherData.temp}</span>
                          <span className="text-sm font-bold text-zinc-500">°C</span>
                        </div>
                        <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                          {t(`dashboard.weatherCondition${weatherData.condition.charAt(0).toUpperCase() + weatherData.condition.slice(1)}`)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Extra stats */}
                    <div className="text-right space-y-0.5 shrink-0">
                      <div className="flex items-center justify-end gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-bold">
                        <Droplets className="h-3 w-3" />
                        <span>{t("dashboard.weatherHumidity")}: {weatherData.humidity}%</span>
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-bold">
                        <Wind className="h-3 w-3" />
                        <span>{t("dashboard.weatherWind")}: {weatherData.windSpeed} km/h</span>
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-bold">
                        <CloudRain className="h-3 w-3" />
                        <span>{t("dashboard.weatherRainProb")}: {weatherData.rainProb}%</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Care Advice Banner */}
                  <div className="p-3 rounded-xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
                    <h4 className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-1">
                      💡 {t("dashboard.weatherRecommendation")}
                    </h4>
                    <p className="text-xs font-bold text-zinc-650 dark:text-zinc-350 leading-relaxed">
                      {weatherData.condition === "sunny" && t("dashboard.weatherAdviceSunny")}
                      {weatherData.condition === "rainy" && t("dashboard.weatherAdviceRainy")}
                      {weatherData.condition === "cloudy" && t("dashboard.weatherAdviceCloudy")}
                      {weatherData.condition === "windy" && t("dashboard.weatherAdviceWindy")}
                    </p>
                  </div>

                  {/* 3-day forecast details */}
                  <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-850">
                    <h4 className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">
                      📅 {t("dashboard.weatherForecast")}
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {weatherData.forecast.map((fc, i) => (
                        <div key={i} className="flex flex-col items-center justify-center p-2 rounded-xl border border-zinc-100 dark:border-zinc-850 bg-zinc-50/25 dark:bg-zinc-950/10 text-center">
                          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">{fc.dayLabel}</span>
                          <div className="my-1.5 flex items-center justify-center min-h-4.5">
                            {fc.condition === "sunny" && <Sun className="h-4.5 w-4.5 text-amber-500" />}
                            {fc.condition === "rainy" && <CloudRain className="h-4.5 w-4.5 text-blue-500" />}
                            {fc.condition === "cloudy" && <Cloud className="h-4.5 w-4.5 text-zinc-500" />}
                            {fc.condition === "windy" && <Wind className="h-4.5 w-4.5 text-teal-500" />}
                            {fc.condition === "unknown" && <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 font-mono">?</span>}
                          </div>
                          <span className="text-[11px] font-black text-zinc-850 dark:text-zinc-200">
                            {fc.temp === "?" ? "?" : `${fc.temp}°C`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PLANT HEALTH OVERVIEW (DONUT) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs p-6 space-y-4">
              <h3 className="text-sm font-bold text-zinc-850 dark:text-zinc-150">
                {t("dashboard.plantHealthOverview")}
              </h3>
              <PlantStatusChart data={statusChartData} />
            </div>

            {/* MONTHLY ACTIVITIES (BAR) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs p-6 space-y-4">
              <h3 className="text-sm font-bold text-zinc-850 dark:text-zinc-150">
                {t("dashboard.monthlyActivityChart")}
              </h3>
              <MonthlyActivitiesChart data={monthlyChartData} />
            </div>

            {/* TASK COMPLETION HEALTH GAUGE */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs p-6">
              <TaskCompletionRateChart
                completed={completedSchedulesCount}
                total={totalSchedulesCount}
              />
            </div>
          </div>
        </div>
      </div>

      {isWaterAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <Droplet className="h-5 w-5 animate-bounce" />
              </div>
              <div>
                <h3 className="text-lg font-black text-zinc-950 dark:text-zinc-50 tracking-tight">
                  {t("dashboard.waterAllConfirmTitle")}
                </h3>
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mt-1">
                  {t("dashboard.waterAllConfirmText")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsWaterAllModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg shadow-sm transition-colors duration-150 cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleWaterAllConfirm}
                className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600 rounded-lg shadow-sm transition-colors duration-150 cursor-pointer"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isFertilizerModalOpen && activeFertilizingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400">
                <Flame className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-zinc-950 dark:text-zinc-50 tracking-tight">
                  {language === "th" ? `ใส่ปุ๋ยสำหรับ ${activeFertilizingTask.plant_name}` : `Fertilizing for ${activeFertilizingTask.plant_name}`}
                </h3>
                <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {language === "th" ? "กรุณาเลือกปุ๋ยและระบุรายละเอียดเพื่อบันทึกงานดูแล" : "Please select a fertilizer and add optional details."}
                </p>
              </div>
            </div>

            <form onSubmit={handleFertilizerSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                  {language === "th" ? "เลือกปุ๋ย" : "Select Fertilizer"}
                </label>
                {fertilizers.length === 0 ? (
                  <div className="text-xs text-rose-500 font-semibold p-2 border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl">
                    {language === "th" ? "ไม่มีปุ๋ยในระบบ กรุณาเพิ่มปุ๋ยในการตั้งค่าหรือแท็บปุ๋ยก่อน" : "No fertilizers available. Please add a fertilizer first."}
                  </div>
                ) : (
                  <select
                    value={selectedFertilizerId}
                    onChange={(e) => setSelectedFertilizerId(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold"
                    required
                  >
                    {fertilizers.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.npk_formula})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                  {language === "th" ? "ปริมาณ (ไม่บังคับ)" : "Amount (Optional)"}
                </label>
                <input
                  type="text"
                  value={fertilizerAmount}
                  onChange={(e) => setFertilizerAmount(e.target.value)}
                  placeholder={language === "th" ? "เช่น 1 ช้อนโต๊ะ, 50 มล." : "e.g. 1 tbsp, 50 ml"}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                  {language === "th" ? "บันทึกย่อ (ไม่บังคับ)" : "Notes (Optional)"}
                </label>
                <textarea
                  value={fertilizerNotes}
                  onChange={(e) => setFertilizerNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFertilizerModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg shadow-sm transition-colors duration-150 cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={fertilizers.length === 0}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors duration-150 cursor-pointer"
                >
                  {t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
