"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import { useTheme } from "@/context/ThemeContext";
import { Settings, User, Globe, Moon, Save, Languages } from "lucide-react";

export default function SettingsPage() {
  const { user, updateUserProfile } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [langPreference, setLangPreference] = useState<"en" | "th">("en");
  const [themePreference, setThemePreference] = useState<"light" | "dark" | "system">("system");
  const [saving, setSaving] = useState(false);

  // Sync state values on user mount
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setAvatarUrl(user.avatar_url || "");
      setLangPreference(user.language || "th");
      setThemePreference(user.theme || "system");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast(t("settings.nameEmptyError"), "error");
      return;
    }

    setSaving(true);
    try {
      const { user: updatedUser, error } = await updateUserProfile({
        name,
        avatar_url: avatarUrl,
        language: langPreference,
        theme: themePreference,
      });

      if (error) {
        toast(`Error: ${error.message}`, "error");
      } else {
        toast(t("settings.saveSuccess"), "success");
      }
    } catch (err) {
      toast(t("settings.updateError"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-zinc-950 dark:text-zinc-50 tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-emerald-600" />
            {t("settings.title")}
          </h1>
          <p className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">
            {t("settings.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: User Profile */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 border-b border-zinc-150 dark:border-zinc-850 pb-2.5">
              <User className="h-4.5 w-4.5 text-zinc-400" />
              {t("settings.profileSection")}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("settings.name")}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("settings.email")}</label>
                <input
                  type="email"
                  value={email}
                  className="w-full p-2.5 bg-zinc-100 dark:bg-zinc-950 text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold font-mono"
                  disabled
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("settings.avatar")}</label>
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <img
                  src={avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}`}
                  alt="Avatar snap"
                  className="h-14 w-14 rounded-full object-cover border border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50"
                />
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Preferences */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-extrabold text-zinc-855 dark:text-zinc-200 flex items-center gap-2 border-b border-zinc-150 dark:border-zinc-850 pb-2.5">
              <Globe className="h-4.5 w-4.5 text-zinc-400" />
              {t("settings.preferencesSection")}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Language Preference */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <Languages className="h-3.5 w-3.5" />
                  {t("settings.language")}
                </label>
                <select
                  value={langPreference}
                  onChange={(e) => setLangPreference(e.target.value as any)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold"
                >
                  <option value="en">English (Default)</option>
                  <option value="th">ไทย (Thai)</option>
                </select>
              </div>

              {/* Theme Preference */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <Moon className="h-3.5 w-3.5" />
                  {t("settings.theme")}
                </label>
                <select
                  value={themePreference}
                  onChange={(e) => setThemePreference(e.target.value as any)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold"
                >
                  <option value="light">{t("settings.themeLight")}</option>
                  <option value="dark">{t("settings.themeDark")}</option>
                  <option value="system">{t("settings.themeSystem")}</option>
                </select>
              </div>
            </div>
          </div>



          {/* Submit Action */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-500/50 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Save className="h-4.5 w-4.5 shrink-0" />
              {saving ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
