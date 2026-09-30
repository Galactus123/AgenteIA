"use client";

import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

/**
 * Indica se o componente já foi hidratado no cliente.
 * Substitui o padrão `useState(false)` + `useEffect(() => setMounted(true))`,
 * que é proibido pela regra `react-hooks/set-state-in-effect`.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
