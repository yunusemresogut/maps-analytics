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
import { appendActivityLog, logActivity } from "@/lib/activity-log";
import {
  MODULE_KEYS,
  VIEW_ONLY_CRUD,
  getAdminPermissions,
  normalizePermissions,
  resolveDefaultMatrixForRole,
} from "@/lib/permissions";
import { normalizeRole } from "@/lib/roles";
import { mapOrganizationFromDb } from "@/lib/migrations";
import type {
  Organization,
  PermissionMatrix,
  User,
  UserPermissions,
  UserRole,
} from "@/types";

type AuthContextValue = {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    companyName: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  users: User[];
  addUser: (data: {
    email: string;
    name: string;
    password: string;
    role: UserRole;
    permissions?: UserPermissions;
  }) => Promise<boolean>;
  updateUserPermissions: (
    userId: string,
    permissions: UserPermissions
  ) => Promise<void>;
  updateUser: (
    userId: string,
    data: {
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
      phone?: string;
      /** When role changes, replace permissions with role defaults */
      applyRoleDefaultPermissions?: boolean;
    }
  ) => Promise<boolean>;
  updateProfile: (data: {
    name?: string;
    phone?: string;
    avatarUrl?: string;
  }) => Promise<boolean>;
  updateOrganization: (
    data: Partial<Omit<Organization, "id" | "createdAt">>
  ) => Promise<boolean>;
  /** Role default matrix: org override → built-in seed */
  getRoleDefaultMatrix: (role: UserRole) => PermissionMatrix;
  deleteUser: (userId: string) => Promise<boolean>;
  setUserRestricted: (userId: string, restricted: boolean) => Promise<void>;
  getUserName: (userId: string) => string;
  refreshOrganization: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapProfile(profile: Record<string, any>): User {
  const role = normalizeRole(profile.role);
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role,
    permissions: normalizePermissions(role, profile.permissions),
    organizationId: profile.organization_id || undefined,
    phone: profile.phone || undefined,
    avatarUrl: profile.avatar_url || undefined,
    restricted: profile.restricted,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const {
    users,
    setUsers,
    refetch: refetchDb,
    organization,
    setOrganization,
  } = useDb();

  const loadOrganization = async (organizationId?: string) => {
    if (!organizationId) {
      setOrganization(null);
      return;
    }
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .maybeSingle();
    setOrganization(data ? mapOrganizationFromDb(data) : null);
  };

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
          setOrganization(null);
        } else {
          const mapped = mapProfile(profile);
          setUser(mapped);
          await loadOrganization(mapped.organizationId);
        }
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setUser(null);
      setOrganization(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setOrganization(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          const msg = error.message?.toLowerCase() || "";
          if (
            msg.includes("invalid login") ||
            msg.includes("invalid credentials")
          ) {
            return {
              ok: false,
              error: "E-posta veya şifre hatalı",
            };
          }
          return { ok: false, error: error.message };
        }
        if (!data.user) {
          return { ok: false, error: "Giriş başarısız" };
        }

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        if (profileErr || !profile) {
          await supabase.auth.signOut();
          return {
            ok: false,
            error:
              "Profil bulunamadı. Hesap migration sonrası bozulmuş olabilir.",
          };
        }

        if (profile.restricted) {
          await supabase.auth.signOut();
          return { ok: false, error: "Hesabınız kısıtlanmış" };
        }

        const mapped = mapProfile(profile);
        // Refresh DB under the new session BEFORE setting user
        // (setting user triggers redirect; empty cached RLS data must not win the race)
        await refetchDb();
        await loadOrganization(mapped.organizationId);
        setUser(mapped);

        appendActivityLog({
          category: "auth",
          action: "login",
          message: `${profile.name} giriş yaptı`,
          actorId: profile.id,
          actorName: profile.name,
        });
        return { ok: true };
      } catch (err: any) {
        console.error("Giriş hatası:", err);
        return { ok: false, error: err?.message || "Giriş başarısız" };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refetchDb]
  );

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      name: string;
      companyName: string;
    }) => {
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const res = await response.json();
        if (!response.ok) {
          return { ok: false, error: res.error || "Kayıt başarısız" };
        }

        const loginResult = await login(data.email, data.password);
        if (!loginResult.ok) {
          return {
            ok: false,
            error:
              loginResult.error ||
              "Kayıt oluştu ancak giriş yapılamadı. Lütfen giriş yapın.",
          };
        }
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err.message || "Kayıt başarısız" };
      }
    },
    [login]
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
    setOrganization(null);
  }, [user, setOrganization]);

  const addUser = useCallback(
    async (data: {
      email: string;
      name: string;
      password: string;
      role: UserRole;
      permissions?: UserPermissions;
    }) => {
      try {
        if (!user?.organizationId) return false;
        const role = normalizeRole(data.role);
        const permissions =
          data.permissions ||
          resolveDefaultMatrixForRole(role, organization?.rolePermissionDefaults);

        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            name: data.name,
            role,
            permissions,
            organizationId: user.organizationId,
          }),
        });

        if (!response.ok) {
          const errRes = await response.json();
          throw new Error(errRes.error || "Kullanıcı eklenemedi");
        }

        const resData = await response.json();
        await refetchDb();

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
    [refetchDb, user?.organizationId, organization?.rolePermissionDefaults]
  );

  const updateUserPermissions = useCallback(
    async (userId: string, permissions: UserPermissions) => {
      try {
        const response = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: userId, permissions }),
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

        if (user?.id === userId) {
          await fetchProfile(userId);
        }
      } catch (err) {
        console.error("User permissions update error:", err);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, user, refetchDb]
  );

  const updateUser = useCallback(
    async (
      userId: string,
      data: {
        name?: string;
        email?: string;
        password?: string;
        role?: UserRole;
        phone?: string;
        applyRoleDefaultPermissions?: boolean;
      }
    ) => {
      try {
        const target = users.find((u) => u.id === userId);
        if (!target || target.role === "admin") return false;

        const nextRole = data.role ? normalizeRole(data.role) : undefined;
        const payload: Record<string, unknown> = {
          id: userId,
          name: data.name,
          email: data.email,
          password: data.password,
          phone: data.phone,
          role: nextRole,
        };

        if (
          nextRole &&
          data.applyRoleDefaultPermissions &&
          nextRole !== target.role
        ) {
          payload.permissions = resolveDefaultMatrixForRole(
            nextRole,
            organization?.rolePermissionDefaults
          );
        }

        const response = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errRes = await response.json();
          throw new Error(errRes.error || "Kullanıcı güncellenemedi");
        }

        await refetchDb();

        appendActivityLog({
          category: "user",
          action: "update",
          message: `Kullanıcı güncellendi: ${target.name}`,
          targetId: userId,
          targetLabel: target.email,
        });

        if (user?.id === userId) {
          await fetchProfile(userId);
        }

        return true;
      } catch (err) {
        console.error("User update error:", err);
        return false;
      }
    },
    [users, user, refetchDb, organization?.rolePermissionDefaults]
  );

  const updateProfile = useCallback(
    async (data: { name?: string; phone?: string; avatarUrl?: string }) => {
      if (!user) return false;
      try {
        const response = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: user.id,
            name: data.name,
            phone: data.phone,
            avatarUrl: data.avatarUrl,
          }),
        });
        if (!response.ok) {
          const errRes = await response.json();
          throw new Error(errRes.error || "Profil güncellenemedi");
        }
        await fetchProfile(user.id);
        await refetchDb();
        logActivity({
          category: "profile",
          action: "update",
          message: `Profil güncellendi: ${user.name}`,
          actorId: user.id,
          actorName: user.name,
          targetId: user.id,
          targetLabel: user.email,
        });
        return true;
      } catch (err) {
        console.error(err);
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, refetchDb]
  );

  const updateOrganization = useCallback(
    async (data: Partial<Omit<Organization, "id" | "createdAt">>) => {
      if (!user?.organizationId || user.role !== "admin") return false;
      try {
        const payload: Record<string, unknown> = {};
        if (data.name !== undefined) payload.name = data.name;
        if (data.taxNumber !== undefined) payload.tax_number = data.taxNumber;
        if (data.authorizedPerson !== undefined)
          payload.authorized_person = data.authorizedPerson;
        if (data.phone !== undefined) payload.phone = data.phone;
        if (data.address !== undefined) payload.address = data.address;
        if (data.avatarUrl !== undefined) payload.avatar_url = data.avatarUrl;
        if (data.rolePermissionDefaults !== undefined) {
          payload.role_permission_defaults = data.rolePermissionDefaults;
        }

        const { data: updated, error } = await supabase
          .from("organizations")
          .update(payload)
          .eq("id", user.organizationId)
          .select("*")
          .single();

        if (error) throw error;
        setOrganization(mapOrganizationFromDb(updated));
        const detail = data.rolePermissionDefaults
          ? "rol yetki şablonları"
          : "firma bilgileri";
        logActivity({
          category: "organization",
          action: "update",
          message: `Organizasyon güncellendi (${detail})`,
          actorId: user.id,
          actorName: user.name,
          targetId: user.organizationId,
          targetLabel: updated.name,
        });
        return true;
      } catch (err) {
        console.error(err);
        return false;
      }
    },
    [user, setOrganization]
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
              ? (Object.fromEntries(
                  MODULE_KEYS.map((k) => [k, { ...VIEW_ONLY_CRUD }])
                ) as UserPermissions)
              : resolveDefaultMatrixForRole(
                  target.role,
                  organization?.rolePermissionDefaults
                ),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, user, refetchDb, organization?.rolePermissionDefaults]
  );

  const getRoleDefaultMatrix = useCallback(
    (role: UserRole): PermissionMatrix =>
      resolveDefaultMatrixForRole(role, organization?.rolePermissionDefaults),
    [organization?.rolePermissionDefaults]
  );

  const getUserName = useCallback(
    (userId: string) => {
      const found = users.find((u) => u.id === userId);
      return found?.name ?? "Bilinmeyen";
    },
    [users]
  );

  const refreshOrganization = useCallback(async () => {
    await loadOrganization(user?.organizationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.organizationId]);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        isLoading,
        login,
        register,
        logout,
        users,
        addUser,
        updateUserPermissions,
        updateUser,
        updateProfile,
        updateOrganization,
        deleteUser,
        setUserRestricted,
        getRoleDefaultMatrix,
        getUserName,
        refreshOrganization,
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
