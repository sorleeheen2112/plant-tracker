"use client";

import React, { useState } from "react";
import { useTranslation } from "@/context/LanguageContext";

// --- Colors Mapping ---
const STATUS_COLORS: Record<string, { fill: string; border: string; labelEn: string; labelTh: string }> = {
  healthy: { fill: "#10b981", border: "border-emerald-500", labelEn: "Healthy", labelTh: "แข็งแรงดี" },
  flowering: { fill: "#ec4899", border: "border-pink-500", labelEn: "Flowering", labelTh: "กำลังออกดอก" },
  fruiting: { fill: "#f59e0b", border: "border-amber-500", labelEn: "Fruiting", labelTh: "กำลังออกผล" },
  dormant: { fill: "#6b7280", border: "border-zinc-500", labelEn: "Dormant", labelTh: "พักตัว" },
  sick: { fill: "#ef4444", border: "border-red-500", labelEn: "Sick", labelTh: "เหี่ยวเฉา / ป่วย" },
};

// 1. Plant Status Distribution (Donut Chart)
interface StatusData {
  status: "healthy" | "flowering" | "fruiting" | "dormant" | "sick";
  count: number;
}

export const PlantStatusChart: React.FC<{ data: StatusData[] }> = ({ data }) => {
  const { language } = useTranslation();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const total = data.reduce((sum, item) => sum + item.count, 0);
  
  if (total === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-400">
        No plant status data available
      </div>
    );
  }

  // Pre-calculate segments
  let accumulatedAngle = 0;
  const segments = data.map((item, index) => {
    const percentage = total > 0 ? (item.count / total) * 100 : 0;
    const angle = (percentage / 100) * 360;
    const startAngle = accumulatedAngle;
    accumulatedAngle += angle;
    return {
      ...item,
      startAngle,
      angle,
      percentage,
      index,
    };
  });

  // Convert polar coordinates to cartesian coordinates
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  const getPiePath = (startAngle: number, angle: number) => {
    const size = 100;
    const radius = 80;
    const center = size;
    
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (startAngle + angle - 90) * (Math.PI / 180);

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
  };

  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col md:flex-row items-center justify-around gap-6">
      {/* SVG Donut */}
      <div className="relative h-44 w-44">
        <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90">
          <circle cx="80" cy="80" r={radius} className="fill-transparent stroke-zinc-100 dark:stroke-zinc-800" strokeWidth="20" />
          
          {/* Arc calculations */}
          {(() => {
            let currentOffset = 0;
            return segments.map((seg, i) => {
              if (seg.count === 0) return null;
              const strokeDash = (seg.count / total) * circumference;
              const strokeGap = circumference - strokeDash;
              const colorInfo = STATUS_COLORS[seg.status];
              const isHovered = activeIndex === i;

              const element = (
                <circle
                  key={seg.status}
                  cx="80"
                  cy="80"
                  r={radius}
                  className="fill-transparent transition-all duration-300"
                  stroke={colorInfo.fill}
                  strokeWidth={isHovered ? "28" : "20"}
                  strokeDasharray={`${strokeDash} ${strokeGap}`}
                  strokeDashoffset={-currentOffset}
                  strokeLinecap="round"
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(null)}
                  style={{ cursor: "pointer" }}
                />
              );
              currentOffset += strokeDash;
              return element;
            });
          })()}
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            {activeIndex !== null ? data[activeIndex].count : total}
          </span>
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
            {activeIndex !== null 
              ? (language === "th" ? STATUS_COLORS[data[activeIndex].status].labelTh : STATUS_COLORS[data[activeIndex].status].labelEn)
              : (language === "th" ? "ต้นไม้ทั้งหมด" : "Plants")
            }
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2.5 w-full max-w-[200px]">
        {segments.map((seg, i) => {
          const colorInfo = STATUS_COLORS[seg.status];
          const label = language === "th" ? colorInfo.labelTh : colorInfo.labelEn;
          const isHovered = activeIndex === i;

          return (
            <div
              key={seg.status}
              className={`flex items-center justify-between p-1.5 rounded-lg transition-colors duration-150 ${
                isHovered ? "bg-zinc-100 dark:bg-zinc-800/50" : ""
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{ cursor: "pointer" }}
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: colorInfo.fill }} />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
              </div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {seg.count} <span className="text-xs font-normal text-zinc-400">({Math.round(seg.percentage)}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


// 2. Monthly Care Activities (Bar Chart)
interface MonthlyData {
  month: string; // YYYY-MM
  count: number;
}

export const MonthlyActivitiesChart: React.FC<{ data: MonthlyData[] }> = ({ data }) => {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-400">
        No monthly activity logs available
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.count), 5);
  const chartHeight = 160;
  const paddingBottom = 25;
  const totalHeight = chartHeight + paddingBottom;

  const monthNames: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
    "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec"
  };

  const getMonthLabel = (monthStr: string) => {
    const parts = monthStr.split("-");
    if (parts.length < 2) return monthStr;
    const m = parts[1];
    return monthNames[m] || m;
  };

  return (
    <div className="relative w-full pt-4">
      {/* Grid Lines */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none h-[160px] border-b border-dashed border-zinc-100 dark:border-zinc-800">
        <div className="border-t border-dashed border-zinc-100 dark:border-zinc-800 w-full" />
        <div className="border-t border-dashed border-zinc-100 dark:border-zinc-800 w-full" />
        <div className="border-t border-dashed border-zinc-100 dark:border-zinc-800 w-full" />
      </div>

      <div className="relative flex justify-between items-end h-[160px] px-2 z-10">
        {data.map((item, idx) => {
          const percentage = item.count / maxVal;
          const height = Math.max(percentage * chartHeight, 6); // at least 6px bar

          return (
            <div
              key={item.month}
              className="flex flex-col items-center flex-1 group"
              onMouseEnter={() => setHoveredBar(idx)}
              onMouseLeave={() => setHoveredBar(null)}
            >
              {/* Tooltip */}
              <div
                className={`absolute bottom-[170px] bg-zinc-900 text-white text-xs px-2.5 py-1 rounded shadow-md transition-all duration-200 pointer-events-none ${
                  hoveredBar === idx ? "opacity-100 scale-100" : "opacity-0 scale-95"
                }`}
              >
                {item.count} activities
              </div>

              {/* Bar */}
              <div
                className="w-8 sm:w-10 md:w-12 rounded-t bg-emerald-100 hover:bg-emerald-500 dark:bg-emerald-950/40 dark:hover:bg-emerald-400 transition-colors duration-200 relative cursor-pointer"
                style={{ height: `${height}px` }}
              >
                {/* Active hover inner line */}
                <div className="absolute inset-x-0 top-0 h-1 bg-emerald-400 dark:bg-emerald-300 rounded-t opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          );
        })}
      </div>

      {/* X Axis Labels */}
      <div className="flex justify-between px-2 pt-2 text-[10px] sm:text-xs font-semibold text-zinc-400">
        {data.map(item => (
          <div key={item.month} className="flex-1 text-center font-mono">
            {getMonthLabel(item.month)}
          </div>
        ))}
      </div>
    </div>
  );
};


// 3. Task Completion Rate Chart (Radial progress gauge)
export const TaskCompletionRateChart: React.FC<{ completed: number; total: number }> = ({ completed, total }) => {
  const { t } = useTranslation();
  const rate = total > 0 ? (completed / total) * 100 : 0;
  
  const radius = 50;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (rate / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative h-36 w-36">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            className="fill-transparent stroke-zinc-100 dark:stroke-zinc-800"
            strokeWidth={strokeWidth}
          />
          {/* Foreground rate circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            className="fill-transparent stroke-emerald-500 dark:stroke-emerald-400 transition-all duration-500 ease-out"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-zinc-800 dark:text-zinc-100 font-mono">
            {Math.round(rate)}%
          </span>
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            {completed}/{total}
          </span>
        </div>
      </div>
      <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 mt-2">
        {t("dashboard.taskCompletionRate")}
      </span>
    </div>
  );
};
