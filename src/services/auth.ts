import { supabase, isSupabaseConfigured } from "./supabase";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  language: "en" | "th";
  theme: "light" | "dark" | "system";
  created_at: string;
}

export interface Session {
  user: UserProfile | null;
}

// Key names for localStorage fallbacks
const AUTH_USERS_KEY = "plant_tracker_mock_users";
const AUTH_SESSION_KEY = "plant_tracker_mock_session";

// Fallback user database loader/saver
const getMockUsers = (): any[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(AUTH_USERS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveMockUsers = (users: any[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
};

const getMockSession = (): UserProfile | null => {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(AUTH_SESSION_KEY);
  return stored ? JSON.parse(stored) : null;
};

const saveMockSession = (profile: UserProfile | null) => {
  if (typeof window === "undefined") return;
  if (profile) {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(profile));
  } else {
    localStorage.removeItem(AUTH_SESSION_KEY);
  }
};

// Global listener for session changes
let authStateListeners: ((session: Session) => void)[] = [];

export const onAuthStateChange = (callback: (session: Session) => void) => {
  authStateListeners.push(callback);
  
  // Trigger initial callback
  getCurrentUser().then(user => {
    callback({ user });
  });

  return {
    unsubscribe: () => {
      authStateListeners = authStateListeners.filter(l => l !== callback);
    }
  };
};

const notifyAuthStateChange = (user: UserProfile | null) => {
  authStateListeners.forEach(listener => listener({ user }));
};

export const getCurrentUser = async (): Promise<UserProfile | null> => {
  if (isSupabaseConfigured && supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Fetch profile
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      // Create profile if missing but user exists in Auth
      const newProfile: UserProfile = {
        id: user.id,
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        email: user.email || "",
        avatar_url: user.user_metadata?.avatar_url || "",
        language: "th",
        theme: "system",
        created_at: new Date().toISOString(),
      };
      await supabase.from("profiles").insert(newProfile);
      return newProfile;
    }
    return data as UserProfile;
  }

  // Local Storage Fallback
  return getMockSession();
};

export const signIn = async (email: string, password?: string): Promise<{ user: UserProfile | null; error: Error | null }> => {
  if (isSupabaseConfigured && supabase) {
    if (!password) return { user: null, error: new Error("Password is required") };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { user: null, error };
    
    const profile = await getCurrentUser();
    notifyAuthStateChange(profile);
    return { user: profile, error: null };
  }

  // Local Storage Fallback
  const users = getMockUsers();
  const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!found || (password && found.password !== password)) {
    return { user: null, error: new Error("Invalid email or password") };
  }

  const profile: UserProfile = {
    id: found.id,
    name: found.name,
    email: found.email,
    avatar_url: found.avatar_url,
    language: found.language || "th",
    theme: found.theme || "system",
    created_at: found.created_at,
  };

  saveMockSession(profile);
  notifyAuthStateChange(profile);
  return { user: profile, error: null };
};

export const signUp = async (email: string, password?: string, name?: string): Promise<{ user: UserProfile | null; error: Error | null }> => {
  const finalName = name || email.split("@")[0] || "Gardener";
  
  if (isSupabaseConfigured && supabase) {
    if (!password) return { user: null, error: new Error("Password is required") };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: finalName,
        }
      }
    });
    
    if (error) return { user: null, error };
    if (!data.user) return { user: null, error: new Error("SignUp did not return a user") };

    const profile: UserProfile = {
      id: data.user.id,
      name: finalName,
      email: email,
      avatar_url: "",
      language: "th",
      theme: "system",
      created_at: new Date().toISOString(),
    };

    // Save profile record
    await supabase.from("profiles").upsert(profile, { onConflict: "id" });
    notifyAuthStateChange(profile);
    return { user: profile, error: null };
  }

  // Local Storage Fallback
  const users = getMockUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { user: null, error: new Error("Email is already registered") };
  }

  const newId = crypto.randomUUID();
  const newUser = {
    id: newId,
    email: email.toLowerCase(),
    password: password || "demo1234",
    name: finalName,
    avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(finalName)}`,
    language: "th" as const,
    theme: "system" as const,
    created_at: new Date().toISOString(),
  };

  users.push(newUser);
  saveMockUsers(users);

  const profile: UserProfile = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    avatar_url: newUser.avatar_url,
    language: newUser.language,
    theme: newUser.theme,
    created_at: newUser.created_at,
  };

  saveMockSession(profile);
  notifyAuthStateChange(profile);
  return { user: profile, error: null };
};

export const signInWithGoogle = async (): Promise<{ user: UserProfile | null; error: Error | null }> => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined
      }
    });
    if (error) return { user: null, error };
    return { user: null, error: null }; // Will redirect
  }

  // Local Storage Mock Google Login
  const mockEmail = "google.gardener@example.com";
  const users = getMockUsers();
  let found = users.find(u => u.email === mockEmail);

  if (!found) {
    const newId = crypto.randomUUID();
    found = {
      id: newId,
      email: mockEmail,
      name: "Google Gardener",
      avatar_url: "https://api.dicebear.com/7.x/adventurer/svg?seed=GoogleGardener",
      language: "th",
      theme: "system",
      created_at: new Date().toISOString(),
    };
    users.push(found);
    saveMockUsers(users);
  }

  const profile: UserProfile = {
    id: found.id,
    name: found.name,
    email: found.email,
    avatar_url: found.avatar_url,
    language: found.language || "th",
    theme: found.theme || "system",
    created_at: found.created_at,
  };

  saveMockSession(profile);
  notifyAuthStateChange(profile);
  return { user: profile, error: null };
};

export const signOut = async (): Promise<{ error: Error | null }> => {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.auth.signOut();
    notifyAuthStateChange(null);
    return { error };
  }

  // Local Storage Fallback
  saveMockSession(null);
  notifyAuthStateChange(null);
  return { error: null };
};

export const forgotPassword = async (email: string): Promise<{ error: Error | null }> => {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined
    });
    return { error };
  }

  // Local Storage Mock
  const users = getMockUsers();
  const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!found) {
    return { error: new Error("Email not found") };
  }
  return { error: null };
};

export const resetPassword = async (password: string): Promise<{ error: Error | null }> => {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  }

  // Local Storage Mock
  const current = getMockSession();
  if (!current) return { error: new Error("No active reset session") };

  const users = getMockUsers();
  const updatedUsers = users.map(u => {
    if (u.id === current.id) {
      return { ...u, password };
    }
    return u;
  });
  saveMockUsers(updatedUsers);
  return { error: null };
};

export const updateProfile = async (updates: Partial<UserProfile>): Promise<{ user: UserProfile | null; error: Error | null }> => {
  const current = await getCurrentUser();
  if (!current) return { user: null, error: new Error("Not authenticated") };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", current.id)
      .select()
      .single();

    if (error) return { user: null, error };
    notifyAuthStateChange(data);
    return { user: data as UserProfile, error: null };
  }

  // Local Storage Mock
  const users = getMockUsers();
  const updatedUsers = users.map(u => {
    if (u.id === current.id) {
      return { ...u, ...updates };
    }
    return u;
  });
  saveMockUsers(updatedUsers);

  const updatedProfile: UserProfile = {
    ...current,
    ...updates,
  };
  saveMockSession(updatedProfile);
  notifyAuthStateChange(updatedProfile);
  return { user: updatedProfile, error: null };
};
