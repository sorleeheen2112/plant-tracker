"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import { Sprout, User, Mail, Lock, Eye, EyeOff, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const { register, user, loading: authLoading } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      toast(t("auth.nameRequired"), "error");
      return;
    }
    if (!email) {
      toast(t("auth.emailRequired"), "error");
      return;
    }
    if (!password) {
      toast(t("auth.passwordRequired"), "error");
      return;
    }
    if (password !== confirmPassword) {
      toast(t("auth.passwordsDoNotMatch"), "error");
      return;
    }

    setLoading(true);
    const { user: registeredUser, error } = await register(email, password, name);
    setLoading(false);

    if (error) {
      toast(t("auth.registerError") + `: ${error.message}`, "error");
    } else if (registeredUser) {
      toast(`${t("common.success")}!`, "success");
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 transition-colors">
      {/* Language switcher overlay */}
      <div className="absolute top-4 right-4 flex gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 shadow-xs z-10">
        <button
          onClick={() => setLanguage("en")}
          className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
            language === "en"
              ? "bg-emerald-500 text-white"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          EN
        </button>
        <button
          onClick={() => setLanguage("th")}
          className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
            language === "th"
              ? "bg-emerald-500 text-white"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          TH
        </button>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden p-8 transition-all">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shadow-xs">
            <Sprout className="h-6 w-6 shrink-0" />
          </div>
          <h1 className="text-2xl font-black text-zinc-950 dark:text-zinc-50 tracking-tight">
            Plant Tracker
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center font-medium">
            {t("auth.registerSubtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {t("auth.fullName")}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 transition-all font-medium"
              />
            </div>
          </div>

          {/* Email input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {t("auth.email")}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 transition-all font-medium"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {t("auth.password")}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {t("auth.confirmPassword")}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 transition-all font-medium"
              />
            </div>
          </div>

          {/* Register Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-500/50 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            {loading ? t("common.loading") : (
              <>
                <UserPlus className="h-4 w-4 shrink-0" />
                {t("auth.signUp")}
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400 font-medium">
          {t("auth.haveAccount")}{" "}
          <Link
            href="/login"
            className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            {t("auth.signIn")}
          </Link>
        </div>
      </div>
    </div>
  );
}
