import { isSupabaseConfigured, supabase } from "@/services/supabase";

export async function getUserFromRequest(request: Request): Promise<{ id: string; email: string; name: string } | null> {
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (isSupabaseConfigured && supabase) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        return {
          id: user.id,
          email: user.email || "",
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User"
        };
      }
    }
  }

  // Local storage mock fallback: look for mock headers passed by the client
  const mockUserHeader = request.headers.get("x-mock-user-id");
  if (mockUserHeader) {
    return {
      id: mockUserHeader,
      email: "google.gardener@example.com",
      name: "Google Gardener"
    };
  }

  return null;
}
