"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useDb } from "@/contexts/db-context";
import { supabase } from "@/lib/supabase";
import { appendActivityLog } from "@/lib/activity-log";
import {
  DEFAULT_USER_PERMISSIONS,
  getAdminPermissions,
  VIEW_ONLY_PERMISSIONS,
} from "@/lib/permissions";
import type { User, UserPermissions } from "@/types";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    expectedRole?: "admin" | "user"
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  users: User[];
  addUser: (data: {
    email: string;
    name: string;
    password: string;
    permissions?: UserPermissions;
  }) => Promise<boolean>;
  updateUserPermissions: (userId: string, permissions: UserPermissions) => Promise<void>;
  updateUser: (
    userId: string,
    data: { name?: string; email?: string; password?: string }
  ) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;
  setUserRestricted: (userId: string, restricted: boolean) => Promise<void>;
  getUserName: (userId: string) => string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { users, setUsers, refetch: refetchDb } = useDb();

  const fetchProfile = async (uid: string) => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .single();

      if (error) throw error;

      if (profile) {
        if (profile.restricted) {
          await supabase.auth.signOut();
          setUser(null);
        } else {
          setUser({
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role as "admin" | "user",
            permissions: profile.permissions as UserPermissions,
            restricted: profile.restricted,
          });
        }
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, expectedRole?: "admin" | "user") => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        if (!data.user) return false;

        // Fetch user profile from public.profiles to check roles / restriction status
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        if (profileErr || !profile) {
          await supabase.auth.signOut();
          return false;
        }

        if (expectedRole === "admin" && profile.role !== "admin") {
          await supabase.auth.signOut();
          return false;
        }
        if (expectedRole === "user" && profile.role === "admin") {
          await supabase.auth.signOut();
          return false;
        }
        if (profile.restricted) {
          await supabase.auth.signOut();
          return false;
        }

        setUser({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role as "admin" | "user",
          permissions: profile.permissions as UserPermissions,
          restricted: profile.restricted,
        });

        appendActivityLog({
          category: "auth",
          action: "login",
          message: `${profile.name} giriş yaptı`,
          actorId: profile.id,
          actorName: profile.name,
        });
        return true;
      } catch (err) {
        console.error("Giriş hatası:", err);
        return false;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    if (user) {
      appendActivityLog({
        category: "auth",
        action: "logout",
        message: `${user.name} çıkış yaptı`,
        actorId: user.id,
        actorName: user.name,
      });
    }
    await supabase.auth.signOut();
    setUser(null);
  }, [user]);

  const addUser = useCallback(
    async (data: {
      email: string;
      name: string;
      password: string;
      permissions?: UserPermissions;
    }) => {
      try {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            name: data.name,
            permissions: data.permissions || { ...DEFAULT_USER_PERMISSIONS },
          }),
        });

        if (!response.ok) {
          const errRes = await response.json();
          throw new Error(errRes.error || "Kullanıcı eklenemedi");
        }

        const resData = await response.json();
        await refetchDb(); // Reload users list in DbContext

        appendActivityLog({
          category: "user",
          action: "create",
          message: `Yeni kullanıcı oluşturuldu: ${data.name}`,
          targetId: resData.user.id,
          targetLabel: data.email,
        });
        return true;
      } catch (err) {
        console.error("User creation error:", err);
        return false;
      }
    },
    [refetchDb]
  );

  const updateUserPermissions = useCallback(
    async (userId: string, permissions: UserPermissions) => {
      try {
        const response = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: userId,
            permissions,
          }),
        });

        if (!response.ok) {
          const errRes = await response.json();
          throw new Error(errRes.error || "Kullanıcı yetkileri güncellenemedi");
        }

        const target = users.find((u) => u.id === userId);
        await refetchDb();

        if (target) {
          appendActivityLog({
            category: "permission",
            action: "update",
            message: `${target.name} kullanıcısının yetkileri güncellendi`,
            targetId: userId,
            targetLabel: target.email,
          });
        }

        // If updating currently logged in user's permissions, refresh their local profile state
        if (user?.id === userId) {
          await fetchProfile(userId);
        }
      } catch (err) {
        console.error("User permissions update error:", err);
      }
    },
    [users, user, refetchDb]
  );

  const updateUser = useCallback(
    async (
      userId: string,
      data: { name?: string; email?: string; password?: string }
    ) => {
      try {
        const target = users.find((u) => u.id === userId);
        if (!target || target.role === "admin") return false;

        const response = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: userId,
            ...data,
          }),
        });

        if (!response.ok) {
          const errRes = await response.json();
          throw new Error(errRes.error || "Kullanıcı güncellenemedi");
        }

        await refetchDb();

        if (target) {
          appendActivityLog({
            category: "user",
            action: "update",
            message: `Kullanıcı güncellendi: ${target.name}`,
            targetId: userId,
            targetLabel: target.email,
          });
        }

        if (user?.id === userId) {
          await fetchProfile(userId);
        }

        return true;
      } catch (err) {
        console.error("User update error:", err);
        return false;
      }
    },
    [users, user, refetchDb]
  );

  const deleteUser = useCallback(
    async (userId: string) => {
      try {
        const target = users.find((u) => u.id === userId);
        if (!target || target.role === "admin") return false;

        const response = await fetch(`/api/admin/users?id=${userId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errRes = await response.json();
          throw new Error(errRes.error || "Kullanıcı silinemedi");
        }

        await refetchDb();

        appendActivityLog({
          category: "user",
          action: "delete",
          message: `Kullanıcı silindi: ${target.name}`,
          targetId: userId,
          targetLabel: target.email,
        });

        if (user?.id === userId) {
          setUser(null);
        }

        return true;
      } catch (err) {
        console.error("User delete error:", err);
        return false;
      }
    },
    [users, user, refetchDb]
  );

  const setUserRestricted = useCallback(
    async (userId: string, restricted: boolean) => {
      try {
        const target = users.find((u) => u.id === userId);
        if (!target || target.role === "admin") return;

        const response = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: userId,
            restricted,
            permissions: restricted
              ? { ...VIEW_ONLY_PERMISSIONS }
              : { ...DEFAULT_USER_PERMISSIONS },
          }),
        });

        if (!response.ok) {
          const errRes = await response.json();
          throw new Error(errRes.error || "Kullanıcı kısıtlanamadı");
        }

        await refetchDb();

        appendActivityLog({
          category: "user",
          action: restricted ? "restrict" : "unrestrict",
          message: restricted
            ? `${target.name} kısıtlandı`
            : `${target.name} kısıtlaması kaldırıldı`,
          targetId: userId,
          targetLabel: target.email,
        });

        if (user?.id === userId) {
          await fetchProfile(userId);
        }
      } catch (err) {
        console.error("User restrict error:", err);
      }
    },
    [users, user, refetchDb]
  );

  const getUserName = useCallback(
    (userId: string) => {
      const found = users.find((u) => u.id === userId);
      return found?.name ?? "Bilinmeyen";
    },
    [users]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        users,
        addUser,
        updateUserPermissions,
        updateUser,
        deleteUser,
        setUserRestricted,
        getUserName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { getAdminPermissions };
