"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  UserProfile,
  getCurrentUser,
  onAuthStateChange,
  signIn,
  signUp,
  signInWithGoogle,
  signOut,
  forgotPassword,
  resetPassword,
  updateProfile,
} from "@/services/auth";
import { useTheme } from "./ThemeContext";
import { useTranslation } from "./LanguageContext";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: typeof signIn;
  register: typeof signUp;
  googleLogin: typeof signInWithGoogle;
  logout: typeof signOut;
  forgotUserPassword: typeof forgotPassword;
  resetUserPassword: typeof resetPassword;
  updateUserProfile: typeof updateProfile;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const { setLanguage } = useTranslation();

  // Use refs to avoid stale closures in the auth state listener
  // without making it a dependency that causes re-subscription on every language change
  const setThemeRef = useRef(setTheme);
  const setLanguageRef = useRef(setLanguage);
  useEffect(() => { setThemeRef.current = setTheme; }, [setTheme]);
  useEffect(() => { setLanguageRef.current = setLanguage; }, [setLanguage]);

  useEffect(() => {
    const { unsubscribe } = onAuthStateChange((session) => {
      setUser(session.user);
      setLoading(false);

      if (session.user) {
        // Sync user preferences with contexts
        if (session.user.theme) setThemeRef.current(session.user.theme);
        if (session.user.language) setLanguageRef.current(session.user.language);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []); // Run only once on mount — refs keep callbacks fresh without re-subscribing

  // Handle route protection client-side
  useEffect(() => {
    if (!loading) {
      const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/"];
      const isPublicRoute = publicRoutes.includes(pathname);

      if (!user && !isPublicRoute) {
        router.push("/login");
      } else if (user && (pathname === "/login" || pathname === "/register")) {
        router.push("/dashboard");
      }
    }
  }, [user, loading, pathname, router]);

  const login: typeof signIn = async (email, password) => {
    setLoading(true);
    try {
      const result = await signIn(email, password);
      if (result.user) setUser(result.user);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const register: typeof signUp = async (email, password, name) => {
    setLoading(true);
    try {
      const result = await signUp(email, password, name);
      if (result.user) setUser(result.user);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const googleLogin: typeof signInWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.user) setUser(result.user);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const logout: typeof signOut = async () => {
    setLoading(true);
    try {
      const result = await signOut();
      setUser(null);
      router.push("/login");
      return result;
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfile: typeof updateProfile = async (updates) => {
    const result = await updateProfile(updates);
    if (result.user) {
      setUser(result.user);
      if (result.user.theme) setTheme(result.user.theme);
      if (result.user.language) setLanguage(result.user.language);
    }
    return result;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        googleLogin,
        logout,
        forgotUserPassword: forgotPassword,
        resetUserPassword: resetPassword,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
