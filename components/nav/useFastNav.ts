"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { isNavActive, PREFETCH_HREFS } from "@/lib/navConfig";

/** Ignore rapid re-taps on the same or different tabs. */
const TAP_COOLDOWN_MS = 320;
/** Block overlapping navigations until the route settles. */
const IN_FLIGHT_TIMEOUT_MS = 8_000;

export function useFastNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const blockedUntilRef = useRef(0);
  const inFlightRef = useRef(false);
  const inFlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    for (const href of PREFETCH_HREFS) {
      router.prefetch(href);
    }
  }, [router]);

  useEffect(() => {
    inFlightRef.current = false;
    setOptimisticPath(null);
    if (inFlightTimerRef.current) {
      clearTimeout(inFlightTimerRef.current);
      inFlightTimerRef.current = null;
    }
  }, [pathname]);

  useEffect(
    () => () => {
      if (inFlightTimerRef.current) clearTimeout(inFlightTimerRef.current);
    },
    []
  );

  const navigate = useCallback(
    (href: string) => {
      const now = Date.now();
      if (isNavActive(pathname, href)) return;
      if (inFlightRef.current) return;
      if (now < blockedUntilRef.current) return;

      blockedUntilRef.current = now + TAP_COOLDOWN_MS;
      inFlightRef.current = true;
      setOptimisticPath(href);

      if (inFlightTimerRef.current) clearTimeout(inFlightTimerRef.current);
      inFlightTimerRef.current = setTimeout(() => {
        inFlightRef.current = false;
        setOptimisticPath(null);
      }, IN_FLIGHT_TIMEOUT_MS);

      startTransition(() => {
        router.push(href);
      });
    },
    [pathname, router]
  );

  const activePath = optimisticPath ?? pathname;
  const isNavigating = isPending || optimisticPath !== null;

  return { navigate, activePath, isNavigating, pathname };
}
