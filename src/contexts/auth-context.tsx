"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { mockUsers } from "@/data/users";
import type { User } from "@/types";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  users: User[];
  addUser: (data: {
    email: string;
    name: string;
    password: string;
  }) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = "lcw-map-session";
const USERS_KEY = "lcw-map-users";

function loadUsers(): (User & { password: string })[] {
  if (typeof window === "undefined") return mockUsers;
  const stored = localStorage.getItem(USERS_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(USERS_KEY, JSON.stringify(mockUsers));
  return mockUsers;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<(User & { password: string })[]>([]);

  useEffect(() => {
    const allUsers = loadUsers();
    setUsers(allUsers);

    const sessionId = localStorage.getItem(SESSION_KEY);
    if (sessionId) {
      const found = allUsers.find((u) => u.id === sessionId);
      if (found) {
        const { password: _, ...safeUser } = found;
        setUser(safeUser);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((email: string, password: string) => {
    const allUsers = loadUsers();
    const found = allUsers.find(
      (u) => u.email === email && u.password === password
    );
    if (!found) return false;

    const { password: _, ...safeUser } = found;
    setUser(safeUser);
    localStorage.setItem(SESSION_KEY, found.id);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const addUser = useCallback(
    (data: { email: string; name: string; password: string }) => {
      const allUsers = loadUsers();
      if (allUsers.some((u) => u.email === data.email)) return false;

      const newUser: User & { password: string } = {
        id: `user-${Date.now()}`,
        email: data.email,
        name: data.name,
        role: "user",
        password: data.password,
      };

      const updated = [...allUsers, newUser];
      localStorage.setItem(USERS_KEY, JSON.stringify(updated));
      setUsers(updated);
      return true;
    },
    []
  );

  const publicUsers = users.map(({ password: _, ...u }) => u);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, users: publicUsers, addUser }}
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
