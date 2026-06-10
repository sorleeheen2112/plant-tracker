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
import {
  getGardens,
  getPlants,
  getSchedules,
  getActivities,
  performSchedule,
  Garden,
  Plant,
  Schedule,
  Activity,
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
  Play
} from "lucide-react";

export default function DashboardPage() {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const loadDashboardData = async () => {
    try {
      const gList = await getGardens();
      const pList = await getPlants(null, false); // Active plants only
      const sList = await getSchedules();
      const aList = await getActivities(null, 15);

      setGardens(gList);
      setPlants(pList);
      setSchedules(sList);
      setActivities(aList);
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

  const handleCompleteTask = async (scheduleId: string) => {
    try {
      const todayISO = new Date().toISOString();
      await performSchedule(scheduleId, todayISO);
      toast(t("schedules.taskCompletedMsg"), "success");
      // Reload dashboard stats
      await loadDashboardData();
    } catch (e) {
      toast(t("dashboard.completeTaskError"), "error");
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
                  <div className="space-y-3">
                    {dueTodayTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/30 dark:bg-zinc-950/25 hover:border-zinc-250 dark:hover:border-zinc-700/80 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-8.5 w-8.5 shrink-0 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 text-xs font-bold uppercase tracking-wider select-none font-semibold">
                            {t(`activities.${task.type}`).slice(0, 2)}
                          </span>
                          <div>
                            <p className="text-sm font-extrabold text-zinc-850 dark:text-zinc-150">
                              {t(`activities.${task.type}`)}
                            </p>
                            <p className="text-xs font-medium text-zinc-400">
                              {task.plant_name}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCompleteTask(task.id)}
                          className="self-end sm:self-center px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors duration-150 cursor-pointer"
                        >
                          {t("schedules.markCompleted")}
                        </button>
                      </div>
                    ))}
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
    </AppShell>
  );
}
