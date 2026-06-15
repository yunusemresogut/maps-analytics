"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { mockUsers } from "@/data/users";
import { migrateUser } from "@/lib/migrations";
import { appendActivityLog } from "@/lib/activity-log";
import {
  DEFAULT_USER_PERMISSIONS,
  getAdminPermissions,
  VIEW_ONLY_PERMISSIONS,
} from "@/lib/permissions";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import type { User, UserPermissions } from "@/types";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    expectedRole?: "admin" | "user"
  ) => boolean;
  logout: () => void;
  users: User[];
  addUser: (data: {
    email: string;
    name: string;
    password: string;
    permissions?: UserPermissions;
  }) => boolean;
  updateUserPermissions: (userId: string, permissions: UserPermissions) => void;
  updateUser: (
    userId: string,
    data: { name?: string; email?: string; password?: string }
  ) => boolean;
  deleteUser: (userId: string) => boolean;
  setUserRestricted: (userId: string, restricted: boolean) => void;
  getUserName: (userId: string) => string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loadUsers(): (User & { password: string })[] {
  if (typeof window === "undefined") return mockUsers;
  const stored = localStorage.getItem(STORAGE_KEYS.users);
  if (stored) {
    return (JSON.parse(stored) as Record<string, unknown>[]).map(migrateUser);
  }
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(mockUsers));
  return mockUsers;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<(User & { password: string })[]>([]);

  useEffect(() => {
    const allUsers = loadUsers();
    setUsers(allUsers);

    const sessionId = localStorage.getItem(STORAGE_KEYS.session);
    if (sessionId) {
      const found = allUsers.find((u) => u.id === sessionId);
      if (found) {
        const { password: _, ...safeUser } = found;
        setUser(safeUser);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    (email: string, password: string, expectedRole?: "admin" | "user") => {
      const allUsers = loadUsers();
      const found = allUsers.find(
        (u) => u.email === email && u.password === password
      );
      if (!found) return false;

      if (expectedRole === "admin" && found.role !== "admin") return false;
      if (expectedRole === "user" && found.role === "admin") return false;
      if (found.restricted) return false;

      const { password: _, ...safeUser } = found;
      setUser(safeUser);
      localStorage.setItem(STORAGE_KEYS.session, found.id);
      appendActivityLog({
        category: "auth",
        action: "login",
        message: `${found.name} giriş yaptı`,
        actorId: found.id,
        actorName: found.name,
      });
      return true;
    },
    []
  );

  const logout = useCallback(() => {
    if (user) {
      appendActivityLog({
        category: "auth",
        action: "logout",
        message: `${user.name} çıkış yaptı`,
        actorId: user.id,
        actorName: user.name,
      });
    }
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.session);
  }, [user]);

  const addUser = useCallback(
    (data: {
      email: string;
      name: string;
      password: string;
      permissions?: UserPermissions;
    }) => {
      const allUsers = loadUsers();
      if (allUsers.some((u) => u.email === data.email)) return false;

      const newUser: User & { password: string } = {
        id: `user-${Date.now()}`,
        email: data.email,
        name: data.name,
        role: "user",
        permissions: data.permissions ?? { ...DEFAULT_USER_PERMISSIONS },
        password: data.password,
      };

      const updated = [...allUsers, newUser];
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(updated));
      setUsers(updated);
      appendActivityLog({
        category: "user",
        action: "create",
        message: `Yeni kullanıcı oluşturuldu: ${newUser.name}`,
        targetId: newUser.id,
        targetLabel: newUser.email,
      });
      return true;
    },
    []
  );

  const updateUserPermissions = useCallback(
    (userId: string, permissions: UserPermissions) => {
      const allUsers = loadUsers();
      const target = allUsers.find((u) => u.id === userId);
      const updated = allUsers.map((u) =>
        u.id === userId ? { ...u, permissions } : u
      );
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(updated));
      setUsers(updated);

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
        const { password: _, ...safeUser } = updated.find((u) => u.id === userId)!;
        setUser(safeUser);
      }
    },
    [user]
  );

  const updateUser = useCallback(
    (
      userId: string,
      data: { name?: string; email?: string; password?: string }
    ) => {
      const allUsers = loadUsers();
      const target = allUsers.find((u) => u.id === userId);
      if (!target || target.role === "admin") return false;

      if (data.email && allUsers.some((u) => u.email === data.email && u.id !== userId)) {
        return false;
      }

      const updated = allUsers.map((u) => {
        if (u.id !== userId) return u;
        return {
          ...u,
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.password ? { password: data.password } : {}),
        };
      });

      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(updated));
      setUsers(updated);

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
        const { password: _, ...safeUser } = updated.find((u) => u.id === userId)!;
        setUser(safeUser);
      }

      return true;
    },
    [user]
  );

  const deleteUser = useCallback(
    (userId: string) => {
      const allUsers = loadUsers();
      const target = allUsers.find((u) => u.id === userId);
      if (!target || target.role === "admin") return false;

      const updated = allUsers.filter((u) => u.id !== userId);
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(updated));
      setUsers(updated);

      appendActivityLog({
        category: "user",
        action: "delete",
        message: `Kullanıcı silindi: ${target.name}`,
        targetId: userId,
        targetLabel: target.email,
      });

      if (user?.id === userId) {
        setUser(null);
        localStorage.removeItem(STORAGE_KEYS.session);
      }

      return true;
    },
    [user]
  );

  const setUserRestricted = useCallback(
    (userId: string, restricted: boolean) => {
      const allUsers = loadUsers();
      const target = allUsers.find((u) => u.id === userId);
      if (!target || target.role === "admin") return;

      const updated = allUsers.map((u) => {
        if (u.id !== userId) return u;
        return {
          ...u,
          restricted,
          permissions: restricted
            ? { ...VIEW_ONLY_PERMISSIONS }
            : { ...DEFAULT_USER_PERMISSIONS },
        };
      });

      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(updated));
      setUsers(updated);

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
        const { password: _, ...safeUser } = updated.find((u) => u.id === userId)!;
        setUser(safeUser);
      }
    },
    [user]
  );

  const getUserName = useCallback(
    (userId: string) => {
      const found = users.find((u) => u.id === userId);
      return found?.name ?? "Bilinmeyen";
    },
    [users]
  );

  const publicUsers = users.map(({ password: _, ...u }) => u);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        users: publicUsers,
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
