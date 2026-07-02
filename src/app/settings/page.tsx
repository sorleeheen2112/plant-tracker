"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import { useTheme } from "@/context/ThemeContext";
import { Settings, User, Globe, Moon, Save, Languages } from "lucide-react";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";
import { supabase, isSupabaseConfigured } from "@/services/supabase";

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

  // LINE Connection state
  const [lineConnected, setLineConnected] = useState(false);
  const [lineDisplayName, setLineDisplayName] = useState("");
  const [linePictureUrl, setLinePictureUrl] = useState("");
  const [lineConnectedAt, setLineConnectedAt] = useState("");
  const [linePrefs, setLinePrefs] = useState({ watering: true, fertilizer: true, plantHealth: true });
  const [loadingLine, setLoadingLine] = useState(true);
  const [updatingLinePrefs, setUpdatingLinePrefs] = useState(false);

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

  // Load LINE Connection Status
  useEffect(() => {
    // Sync mock cookies to localStorage on mount for fallback testing
    if (typeof window !== "undefined") {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(";").shift();
        return null;
      };

      const mockConnected = getCookie("mock_line_connected");
      if (mockConnected === "true") {
        localStorage.setItem("mock_line_connected", "true");
        const mockName = getCookie("mock_line_display_name");
        if (mockName) localStorage.setItem("mock_line_display_name", decodeURIComponent(mockName));
        const mockPic = getCookie("mock_line_picture_url");
        if (mockPic) localStorage.setItem("mock_line_picture_url", decodeURIComponent(mockPic));
        
        // Clear mock cookies
        document.cookie = "mock_line_connected=; Max-Age=0; path=/;";
        document.cookie = "mock_line_display_name=; Max-Age=0; path=/;";
        document.cookie = "mock_line_picture_url=; Max-Age=0; path=/;";
      }
    }

    const fetchLineStatus = async () => {
      if (!user) return;
      try {
        setLoadingLine(true);
        let headers: Record<string, string> = { "Content-Type": "application/json" };
        let session = null;
        if (isSupabaseConfigured && supabase) {
          const sessionResult = await supabase.auth.getSession();
          session = sessionResult.data.session;
        }

        if (session) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        } else {
          headers["x-mock-user-id"] = user.id;
          headers["x-mock-line-connected"] = localStorage.getItem("mock_line_connected") || "false";
          headers["x-mock-line-preferences"] = localStorage.getItem("mock_line_preferences") || JSON.stringify({ watering: true, fertilizer: true, plantHealth: true });
        }

        const res = await fetch("/api/integrations/line", { headers });
        if (res.ok) {
          const data = await res.json();
          setLineConnected(data.connected);
          setLineDisplayName(data.displayName || "");
          setLinePictureUrl(data.pictureUrl || "");
          setLineConnectedAt(data.connectedAt || "");
          setLinePrefs(data.preferences || { watering: true, fertilizer: true, plantHealth: true });
        }
      } catch (err) {
        console.error("Failed to fetch LINE status:", err);
      } finally {
        setLoadingLine(false);
      }
    };

    fetchLineStatus();
  }, [user]);

  // Check URL params for connection feedback (toasts)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const lineStatus = params.get("line");
      if (lineStatus === "connected") {
        toast(t("settings.lineConnectSuccess"), "success");
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (lineStatus === "error") {
        const msg = params.get("msg") || "Failed to connect LINE";
        toast(msg, "error");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [language, toast, t]);

  const handleConnectLine = async () => {
    if (!user) return;
    try {
      let headers: Record<string, string> = { "Content-Type": "application/json" };
      let session = null;
      if (isSupabaseConfigured && supabase) {
        const sessionResult = await supabase.auth.getSession();
        session = sessionResult.data.session;
      }

      if (session) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      } else {
        headers["x-mock-user-id"] = user.id;
      }

      const res = await fetch("/api/integrations/line/connect", {
        method: "POST",
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          if (!session) {
            // Mock connection: redirect directly to callback
            window.location.href = `/api/integrations/line/callback?code=mock_code&state=${data.url.split("state=")[1].split("&")[0]}`;
          } else {
            window.location.href = data.url;
          }
        }
      } else {
        toast("Failed to initiate LINE connection", "error");
      }
    } catch (err) {
      toast("Error initiating LINE connection", "error");
    }
  };

  const handleDisconnectLine = async () => {
    if (!user) return;
    try {
      let headers: Record<string, string> = { "Content-Type": "application/json" };
      let session = null;
      if (isSupabaseConfigured && supabase) {
        const sessionResult = await supabase.auth.getSession();
        session = sessionResult.data.session;
      }

      if (session) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      } else {
        headers["x-mock-user-id"] = user.id;
      }

      const res = await fetch("/api/integrations/line", {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        setLineConnected(false);
        setLineDisplayName("");
        setLinePictureUrl("");
        setLineConnectedAt("");
        if (!session) {
          localStorage.removeItem("mock_line_connected");
          localStorage.removeItem("mock_line_display_name");
          localStorage.removeItem("mock_line_picture_url");
        }
        toast(t("settings.lineDisconnectSuccess"), "success");
      } else {
        toast("Failed to disconnect LINE account", "error");
      }
    } catch (err) {
      toast("Error disconnecting LINE account", "error");
    }
  };

  const handleUpdateLinePref = async (key: "watering" | "fertilizer" | "plantHealth", value: boolean) => {
    const updated = { ...linePrefs, [key]: value };
    setLinePrefs(updated);

    if (!user) return;
    setUpdatingLinePrefs(true);
    try {
      let headers: Record<string, string> = { "Content-Type": "application/json" };
      let session = null;
      if (isSupabaseConfigured && supabase) {
        const sessionResult = await supabase.auth.getSession();
        session = sessionResult.data.session;
      }

      if (session) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      } else {
        headers["x-mock-user-id"] = user.id;
      }

      const res = await fetch("/api/integrations/line", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ preferences: updated }),
      });

      if (res.ok) {
        if (!session) {
          localStorage.setItem("mock_line_preferences", JSON.stringify(updated));
        }
        toast(t("settings.linePreferencesSuccess"), "success");
      } else {
        toast("Failed to update preferences", "error");
      }
    } catch (err) {
      toast("Error updating preferences", "error");
    } finally {
      setUpdatingLinePrefs(false);
    }
  };

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

          {/* Section 3: LINE Integration */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-extrabold text-zinc-850 dark:text-zinc-200 flex items-center gap-2 border-b border-zinc-150 dark:border-zinc-850 pb-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#06C755]/10 text-[#06C755]">
                <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.564.39.084.922.258 1.057.592.12.3.079.769.038 1.072l-.171 1.026c-.052.312-.252 1.22.1 1.394.351.173 1.157-.531 1.625-.975 1.124-1.068 3.109-3.738 4.237-5.388 3.197-2.312 5.078-4.99 5.078-7.705zm-15.011 3.513h-2.18c-.287 0-.52-.233-.52-.52v-4.385c0-.287.233-.52.52-.52h2.18c.287 0 .52.233.52.52v.69c0 .287-.233.52-.52.52H7.989v.91h1.53c.287 0 .52.233.52.52v.69c0 .287-.233.52-.52.52h-1.53v.91h2.01c.287 0 .52.233.52.52v.69c0 .287-.233.52-.52.52zm3.398 0h-2.18c-.287 0-.52-.233-.52-.52v-4.385c0-.287.233-.52.52-.52h.69c.287 0 .52.233.52.52v3.695h1.49c.287 0 .52.233.52.52v.69c0 .287-.233.52-.52.52zm1.696-.52v-4.385c0-.287.233-.52.52-.52h.69c.287 0 .52.233.52.52v4.385c0 .287-.233.52-.52.52h-.69c-.287 0-.52-.233-.52-.52zm6.262 0c0 .287-.233.52-.52.52h-1.92l-1.98-2.61v2.09c0 .287-.233.52-.52.52h-.69c-.287 0-.52-.233-.52-.52v-4.385c0-.287.233-.52.52-.52h.69c.287 0 .52.233.52.52v2.09l1.98-2.09c.14-.145.29-.21.46-.21h1.46c.36 0 .58.41.34.69l-1.58 1.66 1.83 2.45c.16.21.16.51 0 .69z" />
                </svg>
              </span>
              {t("settings.lineSection")}
            </h2>

            {loadingLine ? (
              <div className="flex items-center gap-2 text-zinc-400 py-4 text-xs font-semibold">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                กำลังโหลด... / Loading...
              </div>
            ) : lineConnected ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-150 dark:border-zinc-850 rounded-xl">
                  <div className="flex items-center gap-3">
                    <img
                      src={linePictureUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=LINE"}
                      alt="LINE profile"
                      className="h-12 w-12 rounded-full border border-zinc-200 dark:border-zinc-800 object-cover bg-zinc-100"
                    />
                    <div>
                      <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                        {lineDisplayName}
                      </div>
                      <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                        {t("settings.lineConnectedStatus")}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectLine}
                    className="w-full sm:w-auto px-4 py-2 border border-red-200 hover:border-red-300 dark:border-red-950 dark:hover:border-red-900 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    {t("settings.lineDisconnectBtn")}
                  </button>
                </div>

                {/* LINE Preferences */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    {t("settings.linePreferencesTitle")}
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Watering */}
                    <label className="flex items-center gap-2.5 p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-all select-none">
                      <input
                        type="checkbox"
                        checked={linePrefs.watering}
                        disabled={updatingLinePrefs}
                        onChange={(e) => handleUpdateLinePref("watering", e.target.checked)}
                        className="h-4.5 w-4.5 rounded-sm border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        {t("settings.linePrefWatering")}
                      </span>
                    </label>

                    {/* Fertilizer */}
                    <label className="flex items-center gap-2.5 p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-all select-none">
                      <input
                        type="checkbox"
                        checked={linePrefs.fertilizer}
                        disabled={updatingLinePrefs}
                        onChange={(e) => handleUpdateLinePref("fertilizer", e.target.checked)}
                        className="h-4.5 w-4.5 rounded-sm border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        {t("settings.linePrefFertilizer")}
                      </span>
                    </label>

                    {/* Plant Health */}
                    <label className="flex items-center gap-2.5 p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-all select-none">
                      <input
                        type="checkbox"
                        checked={linePrefs.plantHealth}
                        disabled={updatingLinePrefs}
                        onChange={(e) => handleUpdateLinePref("plantHealth", e.target.checked)}
                        className="h-4.5 w-4.5 rounded-sm border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        {t("settings.linePrefPlantHealth")}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-150 dark:border-zinc-850 rounded-xl">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    {t("settings.lineDisconnectedStatus")}
                  </div>
                  <p className="text-[11px] text-zinc-400 font-semibold">
                    เชื่อมต่อบัญชีไลน์ของคุณ เพื่อรับการแจ้งเตือนงานดูแลต้นไม้ในแต่ละวัน
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleConnectLine}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.564.39.084.922.258 1.057.592.12.3.079.769.038 1.072l-.171 1.026c-.052.312-.252 1.22.1 1.394.351.173 1.157-.531 1.625-.975 1.124-1.068 3.109-3.738 4.237-5.388 3.197-2.312 5.078-4.99 5.078-7.705z" />
                  </svg>
                  {t("settings.lineConnectBtn")}
                </button>
              </div>
            )}
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
