"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import { Sprout, LogIn, Mail, Lock, Eye, EyeOff, Languages } from "lucide-react";

export default function LoginPage() {
  const { login, googleLogin, user, loading: authLoading } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user && !authLoading) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast(t("auth.emailRequired"), "error");
      return;
    }

    setLoading(true);
    const { user: loggedInUser, error } = await login(email, password);
    setLoading(false);

    if (error) {
      toast(t("auth.loginError") + `: ${error.message}`, "error");
    } else if (loggedInUser) {
      toast(`${t("common.success")}!`, "success");
      router.push("/dashboard");
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { user: loggedInUser, error } = await googleLogin();
    setLoading(false);

    if (error) {
      toast(error.message, "error");
    } else if (loggedInUser) {
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
            {t("auth.loginSubtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                {t("auth.password")}
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {t("auth.forgotPassword")}
              </Link>
            </div>
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

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-500/50 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            {loading ? t("common.loading") : (
              <>
                <LogIn className="h-4 w-4 shrink-0" />
                {t("auth.signIn")}
              </>
            )}
          </button>
        </form>

        {/* Separator */}
        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
          <span className="flex-shrink mx-4 text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest">
            {language === "th" ? "หรือ" : "or"}
          </span>
          <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
        </div>

        {/* Google Login */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold text-sm rounded-xl transition-colors cursor-pointer"
        >
          {/* Google Icon */}
          <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 14.99 0 12 0 7.35 0 3.37 2.67 1.43 6.56l3.85 2.99C6.2 6.53 8.88 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.45c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.37-4.87 3.37-8.5z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.49c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.43 6.92C.52 8.74 0 10.79 0 12.92s.52 4.18 1.43 6l3.85-2.99-1e-6-1.44z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.66-2.84c-1.01.68-2.31 1.09-4.27 1.09-3.12 0-5.8-2.04-6.72-4.8l-3.88 3.01C3.37 21.05 7.35 24 12 24z"
            />
          </svg>
          {t("auth.googleSignIn")}
        </button>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400 font-medium">
          {t("auth.noAccount")}{" "}
          <Link
            href="/register"
            className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            {t("auth.signUp")}
          </Link>
        </div>
      </div>
    </div>
  );
}
