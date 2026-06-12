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
import {
  DEFAULT_USER_PERMISSIONS,
  getAdminPermissions,
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

      const { password: _, ...safeUser } = found;
      setUser(safeUser);
      localStorage.setItem(STORAGE_KEYS.session, found.id);
      return true;
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.session);
  }, []);

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
      return true;
    },
    []
  );

  const updateUserPermissions = useCallback(
    (userId: string, permissions: UserPermissions) => {
      const allUsers = loadUsers();
      const updated = allUsers.map((u) =>
        u.id === userId ? { ...u, permissions } : u
      );
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(updated));
      setUsers(updated);

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
