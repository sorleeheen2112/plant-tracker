"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  Notification,
  globalSearch,
  Plant,
  Activity
} from "@/services/db";
import {
  Sprout,
  LayoutDashboard,
  Leaf,
  History,
  Calendar as CalendarIcon,
  Image as ImageIcon,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  Sun,
  Moon,
  Laptop,
  Check,
  ChevronRight,
  Loader2,
  FlaskConical
} from "lucide-react";
import { Modal } from "./ui/Modal";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { user, logout, loading: authLoading } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();

  // Responsive Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Search State
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ plants: Plant[]; activities: Activity[] }>({ plants: [], activities: [] });
  const [searchLoading, setSearchLoading] = useState(false);

  // Active Menu List
  const menuItems = [
    { name: t("nav.dashboard"), path: "/dashboard", icon: LayoutDashboard },
    { name: t("nav.plants"), path: "/plants", icon: Leaf },
    { name: t("nav.activities"), path: "/activities", icon: History },
    { name: t("nav.calendar"), path: "/calendar", icon: CalendarIcon },
    { name: t("nav.photos"), path: "/photos", icon: ImageIcon },
    { name: t("fertilizers.title"), path: "/fertilizers", icon: FlaskConical },
    { name: t("nav.settings"), path: "/settings", icon: SettingsIcon },
  ];

  // Refresh notifications list
  const refreshNotifications = async () => {
    try {
      const data = await getNotifications();
      // Only keep unread, or all? Let's keep all but count unread
      setNotifications(data);
    } catch (e) {
      console.error("Error fetching notifications", e);
    }
  };

  useEffect(() => {
    if (user) {
      refreshNotifications();
      // Poll notifications every 30 seconds
      const interval = setInterval(refreshNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Handle outside click for notification dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle Search Input changes
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        setSearchLoading(true);
        try {
          const results = await globalSearch(searchQuery);
          setSearchResults(results);
        } catch (err) {
          console.error(err);
        } finally {
          setSearchLoading(false);
        }
      } else {
        setSearchResults({ plants: [], activities: [] });
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleLogout = async () => {
    const { error } = await logout();
    if (error) {
      toast(error.message, "error");
    } else {
      toast(language === "th" ? "ออกจากระบบสำเร็จ!" : "Goodbye!", "info");
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    toast(t("notifications.markAllRead"), "success");
    refreshNotifications();
  };

  const handleNotificationClick = async (notif: Notification) => {
    await markNotificationRead(notif.id);
    refreshNotifications();
    setNotifOpen(false);
    
    // Redirect to calendar or details if a plant task
    if (notif.id.includes("auto-")) {
      router.push("/calendar");
    } else {
      router.push("/dashboard");
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Protect route client-side during shell mount
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center space-y-4">
          <p className="text-zinc-600 dark:text-zinc-400 font-bold">{t("common.unauthorized")}</p>
          <Link href="/login" className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold">
            {t("auth.signIn")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors">
      {/* SIDEBAR - DESKTOP */}
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <Sprout className="h-5 w-5 shrink-0" />
          </div>
          <span className="text-lg font-black tracking-tight text-zinc-950 dark:text-zinc-50">
            Plant Tracker
          </span>
        </div>

        {/* Links */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-bold rounded-lg transition-colors group ${
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                  isActive 
                    ? "text-emerald-600 dark:text-emerald-400" 
                    : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200"
                }`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={user.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.name)}`}
              alt={user.name}
              className="h-9 w-9 rounded-full object-cover shrink-0 border border-zinc-100 dark:border-zinc-800"
            />
            <div className="min-w-0">
              <p className="text-xs font-black text-zinc-800 dark:text-zinc-200 truncate leading-4">
                {user.name}
              </p>
              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 truncate leading-3">
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all shrink-0 cursor-pointer"
            title={t("auth.logout")}
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </aside>

      {/* MOBILE SIDEBAR DRAWERS */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <Sprout className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-lg font-black tracking-tight text-zinc-950">Plant Tracker</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5 shrink-0" />
              </button>
            </div>
            
            <nav className="flex-1 px-4 py-6 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-lg ${
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={user.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.name}`}
                  alt={user.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <div className="text-left">
                  <p className="text-xs font-bold truncate max-w-[120px]">{user.name}</p>
                  <p className="text-[10px] text-zinc-400 truncate max-w-[120px]">{user.email}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-zinc-400 hover:text-rose-600">
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CORE CONTENT REGION */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* NAVBAR */}
        <header className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 sm:px-6 shrink-0 transition-colors z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Quick Global Search Trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 w-40 sm:w-64 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 hover:text-zinc-500 rounded-lg border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-left transition-all font-medium cursor-pointer"
            >
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-zinc-400" />
              <span className="truncate flex-1">{t("common.search")}</span>
              <kbd className="hidden sm:inline-flex items-center h-4.5 px-1.5 font-mono text-[10px] font-bold text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-850 rounded border border-zinc-200 dark:border-zinc-800 select-none pointer-events-none">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher */}
            <div className="flex gap-0.5 bg-zinc-50 dark:bg-zinc-950 rounded-lg p-0.5 border border-zinc-200/60 dark:border-zinc-850">
              <button
                onClick={() => setLanguage("en")}
                className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md transition-all ${
                  language === "en"
                    ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs border border-zinc-200/50 dark:border-zinc-800"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("th")}
                className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md transition-all ${
                  language === "th"
                    ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs border border-zinc-200/50 dark:border-zinc-800"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                }`}
              >
                TH
              </button>
            </div>

            {/* Theme Toggle */}
            <div className="flex gap-0.5 bg-zinc-50 dark:bg-zinc-950 rounded-lg p-0.5 border border-zinc-200/60 dark:border-zinc-850">
              {(["light", "dark", "system"] as const).map((tValue) => {
                const Icon = tValue === "light" ? Sun : tValue === "dark" ? Moon : Laptop;
                return (
                  <button
                    key={tValue}
                    onClick={() => setTheme(tValue)}
                    className={`p-1.5 rounded-md transition-all ${
                      theme === tValue
                        ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs border border-zinc-200/50 dark:border-zinc-800"
                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    }`}
                    title={tValue.charAt(0).toUpperCase() + tValue.slice(1)}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Notifications Alert Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg shrink-0 cursor-pointer"
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-900" />
                )}
              </button>

              {/* Notification Menu */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                      {t("notifications.title")}
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 rounded-full">
                          {t("notifications.unreadCountBadge", { count: unreadCount })}
                        </span>
                      )}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        {t("notifications.markAllRead")}
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                        {t("notifications.noNotifications")}
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-4 hover:bg-zinc-50 dark:hover:bg-zinc-850 cursor-pointer transition-colors ${
                            !notif.read ? "bg-emerald-50/25 dark:bg-emerald-950/5" : ""
                          }`}
                        >
                          <div className="flex gap-3">
                            <span className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${
                              notif.type === "overdue" ? "bg-rose-500" : notif.type === "due" ? "bg-amber-500" : "bg-blue-500"
                            }`} />
                            <div className="space-y-1">
                              <p className={`text-xs font-bold leading-none ${
                                !notif.read ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
                              }`}>
                                {language === "th" ? notif.title_th : notif.title_en}
                              </p>
                              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                {language === "th" ? notif.message_th : notif.message_en}
                              </p>
                              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 font-mono">
                                {new Date(notif.created_at).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>
      </div>

      {/* SEARCH MODAL */}
      <Modal isOpen={searchOpen} onClose={() => setSearchOpen(false)} title={t("search.title")}>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search.placeholder")}
              className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 transition-all font-medium"
              autoFocus
            />
          </div>

          <div className="max-h-96 overflow-y-auto pr-1">
            {searchLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            ) : searchQuery.trim().length > 1 && searchResults.plants.length === 0 && searchResults.activities.length === 0 ? (
              <div className="text-center py-8 text-sm text-zinc-400 dark:text-zinc-500 font-medium">
                {t("search.noResults", { query: searchQuery })}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Plants Results */}
                {searchResults.plants.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
                      {t("search.plantsFound", { count: searchResults.plants.length })}
                    </h4>
                    <div className="space-y-1">
                      {searchResults.plants.map((plant) => (
                        <button
                          key={plant.id}
                          onClick={() => {
                            setSearchOpen(false);
                            router.push(`/plants?id=${plant.id}`); // Details route identifier
                          }}
                          className="w-full flex items-center justify-between p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={plant.cover_image}
                              alt={plant.name}
                              className="h-9 w-9 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                {plant.name}
                              </p>
                              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold truncate font-mono">
                                {plant.species}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activities Results */}
                {searchResults.activities.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
                      {t("search.activitiesFound", { count: searchResults.activities.length })}
                    </h4>
                    <div className="space-y-1">
                      {searchResults.activities.map((act) => (
                        <button
                          key={act.id}
                          onClick={() => {
                            setSearchOpen(false);
                            router.push(`/activities`);
                          }}
                          className="w-full p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-left group flex justify-between items-center"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 rounded font-semibold capitalize">
                                {t(`activities.${act.type}`)}
                              </span>
                              <span className="text-xs font-black text-zinc-500 dark:text-zinc-400 truncate">
                                {language === "th" ? `สำหรับ ${act.plant_name}` : `for ${act.plant_name}`}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mt-1.5 line-clamp-1">
                              {act.details}
                            </p>
                            {act.notes && (
                              <p className="text-[10px] italic text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1">
                                &quot;{act.notes}&quot;
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0 ml-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
