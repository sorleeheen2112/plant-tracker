"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/services/supabase";
import { Sprout } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const client = supabase;
        if (!isSupabaseConfigured || !client) {
          // If Supabase is not configured, fall back to dashboard
          router.push("/dashboard");
          return;
        }

        // Supabase client automatically handles hash parameters (implicit flow) on init/load.
        // But for PKCE flow (authorization code flow), we need to exchange the code.
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");

        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // Check if session has been established
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;

        if (session) {
          // Successfully logged in! Redirect to dashboard.
          router.push("/dashboard");
        } else {
          // Wait briefly in case it's processing the hash fragment asynchronously
          let attempts = 0;
          const interval = setInterval(async () => {
            attempts++;
            const { data: { session: currentSession } } = await client.auth.getSession();
            if (currentSession) {
              clearInterval(interval);
              router.push("/dashboard");
            } else if (attempts >= 10) {
              clearInterval(interval);
              // If we timed out and still have no session, redirect to login
              router.push("/login");
            }
          }, 300);
        }
      } catch (err: any) {
        console.error("Error in auth callback:", err);
        setStatus("error");
        setErrorMessage(err.message || "Authentication failed");
        
        // Redirect to login after showing error briefly
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden p-8 text-center transition-all">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shadow-xs">
            <Sprout className="h-6 w-6 shrink-0" />
          </div>
          
          <h1 className="text-2xl font-black text-zinc-950 dark:text-zinc-50 tracking-tight">
            Plant Tracker
          </h1>

          {status === "loading" ? (
            <div className="flex flex-col items-center gap-3 mt-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                กำลังเข้าสู่ระบบ... / Authenticating...
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                กรุณารอสักครู่ ระบบกำลังยืนยันตัวตนของคุณ
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 mt-4 text-red-500 dark:text-red-400">
              <p className="text-sm font-semibold">
                เกิดข้อผิดพลาดในการเข้าสู่ระบบ / Authentication Error
              </p>
              <p className="text-xs opacity-80">{errorMessage}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                กำลังกลับไปหน้าเข้าสู่ระบบ...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
