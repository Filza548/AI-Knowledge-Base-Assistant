"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type SidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  isMobile: boolean;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

const STORAGE_KEY = "kb-sidebar-open";
const MOBILE_MQ = "(max-width: 1023px)";

function readIsMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_MQ).matches;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      if (mobile) {
        setOpenState(false);
      } else {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          setOpenState(stored == null ? true : stored === "1");
        } catch {
          setOpenState(true);
        }
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const setOpen = useCallback(
    (value: boolean) => {
      setOpenState(value);
      if (!readIsMobile()) {
        try {
          localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  const value = useMemo(
    () => ({ open, setOpen, toggle, isMobile }),
    [open, setOpen, toggle, isMobile],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
