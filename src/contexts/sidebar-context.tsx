"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";

type SidebarContextValue = {
  isOpen: boolean;
  isPinned: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  togglePin: () => void;
  setPinned: (pinned: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    const pinned =
      localStorage.getItem(STORAGE_KEYS.sidebarPinned) === "1";
    setIsPinned(pinned);
    if (pinned) setIsOpen(true);
  }, []);

  const persistPinned = useCallback((pinned: boolean) => {
    localStorage.setItem(STORAGE_KEYS.sidebarPinned, pinned ? "1" : "0");
  }, []);

  const open = useCallback(() => setIsOpen(true), []);

  const close = useCallback(() => {
    if (isPinned) return;
    setIsOpen(false);
  }, [isPinned]);

  const toggle = useCallback(() => {
    if (isPinned) {
      setIsPinned(false);
      persistPinned(false);
      setIsOpen(false);
      return;
    }
    setIsOpen((v) => !v);
  }, [isPinned, persistPinned]);

  const togglePin = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      persistPinned(next);
      if (next) setIsOpen(true);
      return next;
    });
  }, [persistPinned]);

  const setPinned = useCallback(
    (pinned: boolean) => {
      setIsPinned(pinned);
      persistPinned(pinned);
      if (pinned) setIsOpen(true);
    },
    [persistPinned]
  );

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isPinned,
        open,
        close,
        toggle,
        togglePin,
        setPinned,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
