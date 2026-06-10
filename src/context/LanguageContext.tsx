"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { en } from "@/locales/en";
import { th } from "@/locales/th";

type LanguageType = "en" | "th";

interface LanguageContextType {
  language: LanguageType;
  setLanguage: (lang: LanguageType) => void;
  t: (keyPath: string, variables?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const dictionaries = { en, th };

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageType>("th");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load preference from local storage or system default
    const saved = localStorage.getItem("plant_tracker_lang");
    if (saved === "en" || saved === "th") {
      setLanguageState(saved);
    } else {
      setLanguageState("th");
    }
    setMounted(true);
  }, []);

  const setLanguage = useCallback((lang: LanguageType) => {
    setLanguageState(lang);
    localStorage.setItem("plant_tracker_lang", lang);
    
    // Dispatch custom event to notify other windows or settings
    window.dispatchEvent(new Event("languagechange"));
  }, []);

  const t = (keyPath: string, variables?: Record<string, string | number>): string => {
    const dict = dictionaries[language] || en;
    const keys = keyPath.split(".");
    let current: any = dict;

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        // Fallback to English dictionary if not found in current language
        let enFallback: any = en;
        let found = true;
        for (const k of keys) {
          if (enFallback && typeof enFallback === "object" && k in enFallback) {
            enFallback = enFallback[k];
          } else {
            found = false;
            break;
          }
        }
        if (found && typeof enFallback === "string") {
          current = enFallback;
        } else {
          return keyPath; // Return key path if lookup completely fails
        }
        break;
      }
    }

    if (typeof current !== "string") {
      return keyPath;
    }

    let text = current;
    if (variables) {
      Object.entries(variables).forEach(([key, val]) => {
        text = text.replace(new RegExp(`{${key}}`, "g"), String(val));
      });
    }

    return text;
  };

  // Avoid hydration issues by rendering children only after mounting (or fallback to en translations)
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
};
