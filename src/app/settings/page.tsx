"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import { useTheme } from "@/context/ThemeContext";
import { Settings, User, Globe, Moon, Save, Languages } from "lucide-react";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";

const BANGKOK_DISTRICTS = [
  { nameTh: "จตุจักร (Chatuchak)", nameEn: "Chatuchak", lat: 13.8099, lng: 100.5616 },
  { nameTh: "พญาไท (Phaya Thai)", nameEn: "Phaya Thai", lat: 13.7800, lng: 100.5400 },
  { nameTh: "ราชเทวี (Ratchathewi)", nameEn: "Ratchathewi", lat: 13.7589, lng: 100.5344 },
  { nameTh: "ปทุมวัน (Pathum Wan)", nameEn: "Pathum Wan", lat: 13.7462, lng: 100.5291 },
  { nameTh: "ดินแดง (Din Daeng)", nameEn: "Din Daeng", lat: 13.7697, lng: 100.5527 },
  { nameTh: "บางกะปิ (Bang Kapi)", nameEn: "Bang Kapi", lat: 13.7658, lng: 100.6486 },
  { nameTh: "ห้วยขวาง (Huai Khwang)", nameEn: "Huai Khwang", lat: 13.7766, lng: 100.5794 },
  { nameTh: "คลองเตย (Khlong Toei)", nameEn: "Khlong Toei", lat: 13.7081, lng: 100.5838 },
  { nameTh: "วัฒนา (Vadhana)", nameEn: "Vadhana", lat: 13.7371, lng: 100.5604 },
  { nameTh: "เชียงใหม่ (Chiang Mai)", nameEn: "Chiang Mai", lat: 18.7883, lng: 98.9853 },
  { nameTh: "ภูเก็ต (Phuket)", nameEn: "Phuket", lat: 7.8804, lng: 98.3923 },
  { nameTh: "ขอนแก่น (Khon Kaen)", nameEn: "Khon Kaen", lat: 16.4322, lng: 102.8236 },
];

export default function SettingsPage() {
  const { user, updateUserProfile } = useAuth();
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [langPreference, setLangPreference] = useState<"en" | "th">("en");
  const [themePreference, setThemePreference] = useState<"light" | "dark" | "system">("system");
  const [saving, setSaving] = useState(false);

  // Weather Location settings
  const [selectedDistrict, setSelectedDistrict] = useState("custom");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  // Sync state values on user mount
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setAvatarUrl(user.avatar_url || "");
      setLangPreference(user.language || "th");
      setThemePreference(user.theme || "system");

      const storedLat = localStorage.getItem(`plant_tracker_user_latitude_${user.id}`) || "";
      const storedLng = localStorage.getItem(`plant_tracker_user_longitude_${user.id}`) || "";
      const storedName = localStorage.getItem(`plant_tracker_user_location_name_${user.id}`) || "";
      const storedDistrict = localStorage.getItem(`plant_tracker_user_district_${user.id}`) || "custom";

      setLatitude(storedLat);
      setLongitude(storedLng);
      setLocationName(storedName);
      setSelectedDistrict(storedDistrict);
    }
  }, [user]);

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    if (value === "custom") return;

    const districtObj = BANGKOK_DISTRICTS.find(d => d.nameEn === value);
    if (districtObj) {
      setLatitude(String(districtObj.lat));
      setLongitude(String(districtObj.lng));
      setLocationName(language === "th" ? districtObj.nameTh.split(" ")[0] : districtObj.nameEn);
    }
  };

  const handleGetGPSLocation = () => {
    if (!navigator.geolocation) {
      toast(t("settings.weatherGPSError"), "error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setLatitude(String(lat.toFixed(4)));
        setLongitude(String(lng.toFixed(4)));
        setSelectedDistrict("custom");
        setLocationName(language === "th" ? "พิกัดปัจจุบัน (GPS)" : "Current Location (GPS)");
        toast(t("settings.weatherGPSSuccess"), "success");
      },
      (error) => {
        console.error("GPS error:", error);
        toast(t("settings.weatherGPSError"), "error");
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast(t("settings.nameEmptyError"), "error");
      return;
    }

    setSaving(true);
    try {
      if (user) {
        localStorage.setItem(`plant_tracker_user_latitude_${user.id}`, latitude);
        localStorage.setItem(`plant_tracker_user_longitude_${user.id}`, longitude);
        localStorage.setItem(`plant_tracker_user_location_name_${user.id}`, locationName);
        localStorage.setItem(`plant_tracker_user_district_${user.id}`, selectedDistrict);
      }
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
                <ImageUploadInput
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                  placeholder="https://images.unsplash.com/photo-..."
                />
              </div>
            </div>
          </div>

          {/* Section 1.5: Weather Location Settings */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-extrabold text-zinc-850 dark:text-zinc-200 flex items-center justify-between border-b border-zinc-150 dark:border-zinc-850 pb-2.5">
              <span className="flex items-center gap-2">
                <Globe className="h-4.5 w-4.5 text-zinc-400" />
                {t("settings.weatherSection")}
              </span>
              <button
                type="button"
                onClick={handleGetGPSLocation}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                {t("settings.weatherGPSBtn")}
              </button>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Select District / Area */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                  {t("settings.weatherSelectDistrict")}
                </label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="custom">{t("settings.weatherCustomCoord")}</option>
                  {BANGKOK_DISTRICTS.map((d, idx) => (
                    <option key={idx} value={d.nameEn}>
                      {language === "th" ? d.nameTh : d.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Display Location Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                  {t("settings.weatherCustomName")}
                </label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g. Chatuchak / จตุจักร"
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Latitude */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                  {t("settings.weatherLatitude")}
                </label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => {
                    setLatitude(e.target.value);
                    setSelectedDistrict("custom");
                  }}
                  placeholder="e.g. 13.7563"
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Longitude */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                  {t("settings.weatherLongitude")}
                </label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => {
                    setLongitude(e.target.value);
                    setSelectedDistrict("custom");
                  }}
                  placeholder="e.g. 100.5018"
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  required
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
