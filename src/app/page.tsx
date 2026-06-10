"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { Sprout, LogIn, UserPlus, Shield, Sparkles, CalendarDays, Heart, Image as ImageIcon } from "lucide-react";

export default function HomePage() {
  const { user, loading } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const router = useRouter();

  // Redirect to dashboard if logged in
  useEffect(() => {
    if (user && !loading) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Sprout className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors">
      {/* Top Header Navbar */}
      <header className="h-16 px-6 sm:px-12 flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-900 bg-white dark:bg-zinc-900 transition-colors shrink-0">
        <div className="flex items-center gap-2">
          <Sprout className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="text-base font-black tracking-tight text-zinc-950 dark:text-zinc-50">Plant Tracker</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Lang Selector */}
          <div className="flex gap-0.5 bg-zinc-100 dark:bg-zinc-950 rounded-lg p-0.5 border border-zinc-200/60 dark:border-zinc-850">
            <button
              onClick={() => setLanguage("en")}
              className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md transition-all ${
                language === "en"
                  ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs border border-zinc-200/50"
                  : "text-zinc-400 hover:text-zinc-650"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("th")}
              className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md transition-all ${
                language === "th"
                  ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs border border-zinc-200/50"
                  : "text-zinc-400 hover:text-zinc-650"
              }`}
            >
              TH
            </button>
          </div>

          <Link
            href="/login"
            className="text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 transition-colors"
          >
            {t("auth.signIn")}
          </Link>
        </div>
      </header>

      {/* Main hero section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-4xl mx-auto w-full text-center space-y-12">
        {/* Intro */}
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 border border-emerald-250 rounded-full text-xs font-extrabold select-none animate-bounce">
            <Sparkles className="h-3.5 w-3.5" />
            {t("landing.heroBadge")}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-zinc-950 dark:text-zinc-50 tracking-tight leading-tight">
            {t("landing.heroTitle")}
          </h1>
          <p className="text-base sm:text-lg text-zinc-500 dark:text-zinc-450 max-w-xl mx-auto leading-relaxed">
            {t("landing.heroSubtitle")}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto justify-center">
          <Link
            href="/register"
            className="flex items-center justify-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-md transition-all shrink-0"
          >
            <UserPlus className="h-4.5 w-4.5" />
            {t("auth.signUp")}
          </Link>
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 px-8 py-3.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 font-bold text-sm rounded-xl shadow-xs transition-all shrink-0"
          >
            <LogIn className="h-4.5 w-4.5" />
            {t("auth.signIn")}
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full pt-8">
          <div className="border border-zinc-200 dark:border-zinc-850 p-6 bg-white dark:bg-zinc-900/50 rounded-2xl shadow-xs text-left space-y-3">
            <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">{t("landing.schedulerTitle")}</h3>
            <p className="text-xs text-zinc-455 dark:text-zinc-400 leading-relaxed">
              {t("landing.schedulerDesc")}
            </p>
          </div>

          <div className="border border-zinc-200 dark:border-zinc-850 p-6 bg-white dark:bg-zinc-900/50 rounded-2xl shadow-xs text-left space-y-3">
            <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
              <ImageIcon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">{t("landing.galleryTitle")}</h3>
            <p className="text-xs text-zinc-455 dark:text-zinc-400 leading-relaxed">
              {t("landing.galleryDesc")}
            </p>
          </div>

          <div className="border border-zinc-200 dark:border-zinc-855 p-6 bg-white dark:bg-zinc-900/50 rounded-2xl shadow-xs text-left space-y-3">
            <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">{t("landing.accountsTitle")}</h3>
            <p className="text-xs text-zinc-455 dark:text-zinc-400 leading-relaxed">
              {t("landing.accountsDesc")}
            </p>
          </div>
        </div>
      </main>

      {/* Footer banner */}
      <footer className="h-14 px-6 text-center text-xs font-semibold text-zinc-400 dark:text-zinc-550 border-t border-zinc-200/50 dark:border-zinc-900 flex items-center justify-center gap-1 shrink-0 transition-colors">
        {t("landing.footerMade")} <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500 animate-pulse" /> {t("landing.footerFor")}
      </footer>
    </div>
  );
}
