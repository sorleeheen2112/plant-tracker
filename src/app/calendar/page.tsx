"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/ui/Modal";
import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import {
  getSchedules,
  performSchedule,
  Schedule,
  ActivityType
} from "@/services/db";
import {
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  CalendarDays,
  Clock,
  Check,
  Leaf
} from "lucide-react";

export default function CalendarPage() {
  const { t, language } = useTranslation();
  const { toast } = useToast();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar Navigation
  const [currentDate, setCurrentDate] = useState(new Date());

  // Task Details Modal
  const [selectedTask, setSelectedTask] = useState<Schedule | null>(null);

  const loadSchedules = async () => {
    try {
      const sList = await getSchedules();
      setSchedules(sList);
    } catch (err) {
      toast(t("calendar.loadError"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const handleCompleteTask = async (id: string) => {
    try {
      const todayISO = new Date().toISOString();
      await performSchedule(id, todayISO);
      toast(t("schedules.taskCompletedMsg"), "success");
      setSelectedTask(null);
      loadSchedules();
    } catch (err) {
      toast(t("schedules.completeError"), "error");
    }
  };

  // --- Calendar Math ---
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNamesEn = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthNamesTh = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const monthName = language === "th" ? monthNamesTh[month] : monthNamesEn[month];

  const weekdayNamesEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayNamesTh = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const weekdays = language === "th" ? weekdayNamesTh : weekdayNamesEn;

  // Days in month grid
  const getDaysInMonth = () => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];

    // Pre-padding from previous month
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthDays - i));
    }

    // Days in current month
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }

    // Post-padding from next month to complete the row
    const totalCells = Math.ceil(days.length / 7) * 7;
    const paddingCount = totalCells - days.length;
    for (let i = 1; i <= paddingCount; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const daysGrid = getDaysInMonth();

  // Map schedules to dynamic dates
  const getTasksForDay = (date: Date) => {
    return schedules.filter((s) => {
      if (!s.next_due_date) return false;
      const due = new Date(s.next_due_date);
      return (
        due.getDate() === date.getDate() &&
        due.getMonth() === date.getMonth() &&
        due.getFullYear() === date.getFullYear()
      );
    });
  };

  const getTaskColorClass = (status: string) => {
    switch (status) {
      case "overdue": return "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/50";
      case "due": return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50";
      default: return "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/50";
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950 dark:text-zinc-50 tracking-tight flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-emerald-600" />
              {t("calendar.title")}
            </h1>
            <p className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">
              {language === "th" ? "ตั้งกำหนดเวลางานดูแลเป็นรอบ และติดตามงานที่ครบกำหนดดูแล" : "Schedule recurring tasks and monitor due care items"}
            </p>
          </div>

          {/* Month Navigator Controls */}
          <div className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 rounded-xl shadow-xs shrink-0 self-start sm:self-center font-bold">
            <button
              onClick={prevMonth}
              className="p-1 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 cursor-pointer"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
            <span className="px-3 text-sm font-black min-w-[120px] text-center">
              {monthName} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 cursor-pointer"
            >
              <ChevronRight className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs font-bold text-zinc-500 px-1">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-rose-500 shrink-0" />
            <span>{t("calendar.overdue")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-amber-500 shrink-0" />
            <span>{t("calendar.due")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-emerald-500 shrink-0" />
            <span>{t("calendar.scheduled")}</span>
          </div>
        </div>

        {/* CALENDAR MONTH GRID */}
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="text-zinc-400 font-bold">{t("calendar.loadingPlanner")}</span>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-55/30 dark:bg-zinc-900/50">
              {weekdays.map((day) => (
                <div key={day} className="py-3 text-center text-xs font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid days */}
            <div className="grid grid-cols-7 gap-[1px] bg-zinc-200 dark:bg-zinc-800">
              {daysGrid.map((day, idx) => {
                if (!day) return null;
                const isCurrentMonth = day.getMonth() === month;
                const isToday =
                  day.getDate() === new Date().getDate() &&
                  day.getMonth() === new Date().getMonth() &&
                  day.getFullYear() === new Date().getFullYear();

                const dayTasks = getTasksForDay(day);

                return (
                  <div
                    key={idx}
                    className={`min-h-[110px] p-2 bg-white dark:bg-zinc-900 transition-colors flex flex-col justify-between ${
                      !isCurrentMonth ? "bg-zinc-50/50 dark:bg-zinc-900/20 text-zinc-300 dark:text-zinc-600" : ""
                    } ${isToday ? "bg-emerald-50/10 dark:bg-emerald-950/5 ring-1 ring-emerald-500/50" : ""}`}
                  >
                    {/* Day Number */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold leading-5 h-5 w-5 rounded-full flex items-center justify-center font-mono ${
                          isToday
                            ? "bg-emerald-600 text-white font-extrabold"
                            : isCurrentMonth
                            ? "text-zinc-800 dark:text-zinc-200"
                            : "text-zinc-350 dark:text-zinc-600"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>

                    {/* Tasks list */}
                    <div className="flex-1 mt-1.5 space-y-1 overflow-y-auto max-h-[70px]">
                      {dayTasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className={`px-1.5 py-0.5 border rounded-sm text-[9px] font-bold truncate cursor-pointer transition-all border-dashed hover:border-solid hover:scale-[1.01] ${getTaskColorClass(
                            task.task_status || "upcoming"
                          )}`}
                          title={`${task.plant_name}: ${task.type}`}
                        >
                          <span className="capitalize">{t(`activities.${task.type}`)}</span> - {task.plant_name}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TASK DETAILS & COMPLETE MODAL */}
        <Modal
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          title={t("calendar.plannerDetails")}
        >
          {selectedTask && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Leaf className="h-5 w-5 shrink-0" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 capitalize">
                    {t("calendar.careCycle", { type: t(`activities.${selectedTask.type}`) })}
                  </h3>
                  <p className="text-xs font-bold text-zinc-400 font-mono">
                    {t("calendar.plantLabel", { name: selectedTask.plant_name ?? "" })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-y border-zinc-100 dark:border-zinc-800 py-3.5 text-xs font-semibold">
                <div>
                  <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-widest block">
                    {t("schedules.interval")}
                  </span>
                  <span>{t("plantDetail.daysInterval", { days: selectedTask.interval_days })}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-widest block">
                    {t("schedules.nextDue")}
                  </span>
                  <span className="font-mono">
                    {selectedTask.next_due_date
                      ? new Date(selectedTask.next_due_date).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })
                      : t("common.none")
                    }
                  </span>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => {
                    setSelectedTask(null);
                  }}
                  className="px-4 py-2 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-55 dark:hover:bg-zinc-850 cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={() => handleCompleteTask(selectedTask.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm cursor-pointer"
                >
                  <Check className="h-4 w-4 shrink-0" />
                  {t("schedules.markCompleted")}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppShell>
  );
}
