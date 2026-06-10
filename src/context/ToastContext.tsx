"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextType {
  toast: (message: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start justify-between gap-3 p-4 rounded-lg border shadow-lg pointer-events-auto animate-in slide-in-from-bottom-4 duration-300 ${
              t.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/50"
                : t.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/50"
                : "bg-zinc-50 text-zinc-800 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
            }`}
          >
            <div className="flex gap-2.5 items-start mt-0.5">
              {t.type === "success" && <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
              {t.type === "error" && <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />}
              {t.type === "info" && <Info className="h-5 w-5 shrink-0 text-zinc-600 dark:text-zinc-400" />}
              <span className="text-sm font-medium leading-5">{t.message}</span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors shrink-0"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
