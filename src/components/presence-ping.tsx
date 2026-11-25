"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const AWAY_KEY = "r5_desk_away";

type PresenceState = {
  online: boolean;
  setAvailable: (next: boolean) => Promise<void>;
};

const PresenceContext = createContext<PresenceState>({
  online: true,
  setAvailable: async () => {},
});

export function usePresence() {
  return useContext(PresenceContext);
}

function isAway() {
  return typeof window !== "undefined" && localStorage.getItem(AWAY_KEY) === "1";
}

async function postPresence(isOnline?: boolean) {
  try {
    const res = await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(typeof isOnline === "boolean" ? { isOnline } : {}),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const away = isAway();
    setOnline(!away);
    void postPresence(!away);
    const id = setInterval(() => {
      void postPresence(isAway() ? false : true);
    }, 45_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void postPresence(isAway() ? false : true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const setAvailable = useCallback(async (next: boolean) => {
    setOnline(next);
    if (next) localStorage.removeItem(AWAY_KEY);
    else localStorage.setItem(AWAY_KEY, "1");
    await postPresence(next);
  }, []);

  return <PresenceContext.Provider value={{ online, setAvailable }}>{children}</PresenceContext.Provider>;
}

export function clearAwayPreference() {
  if (typeof window !== "undefined") localStorage.removeItem(AWAY_KEY);
}
