"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import { Sprout, Mail, ArrowLeft, Send } from "lucide-react";

export default function ForgotPasswordPage() {
  const { forgotUserPassword } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast(t("auth.emailRequired"), "error");
      return;
    }

    setLoading(true);
    const { error } = await forgotUserPassword(email);
    setLoading(false);

    if (error) {
      toast(error.message, "error");
    } else {
      setSuccess(true);
      toast(t("auth.resetSuccess"), "success");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 transition-colors">
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
            {t("auth.forgotPasswordSubtitle")}
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-900/50 text-sm font-medium">
              {t("auth.resetSuccess")}
            </div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              {t("common.back")}
            </Link>
          </div>
        ) : (
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-500/50 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {loading ? t("common.loading") : (
                <>
                  <Send className="h-4 w-4 shrink-0" />
                  {t("auth.sendResetLink")}
                </>
              )}
            </button>

            {/* Back to Login link */}
            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                {t("auth.signIn")}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
