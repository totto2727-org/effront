import { Iterable } from "effect";

import type { RouteTreeModel } from "#core/rsc/route-tree.ts";

type HistoryEntry = Pick<NavigationHistoryEntry, "addEventListener" | "id" | "removeEventListener">;

type CachedRoute = Readonly<{
  entry: HistoryEntry;
  onDispose: () => void;
  routeTree: RouteTreeModel;
}>;

export type RouteCache = Map<string, CachedRoute>;

const removeRoute = (cache: RouteCache, entry: HistoryEntry): void => {
  const cached = cache.get(entry.id);
  if (cached?.entry === entry) {
    cache.delete(entry.id);
  }
};

export const storeRoute = (
  cache: RouteCache,
  entry: HistoryEntry,
  routeTree: RouteTreeModel,
): void => {
  const cached = cache.get(entry.id);
  if (cached?.entry === entry) {
    cache.set(entry.id, { ...cached, routeTree });
    return;
  }

  cached?.entry.removeEventListener("dispose", cached.onDispose);
  const onDispose = (): void => {
    removeRoute(cache, entry);
  };
  entry.addEventListener("dispose", onDispose, { once: true });
  cache.set(entry.id, { entry, onDispose, routeTree });
};

export const clearRoutes = (cache: RouteCache): void => {
  Iterable.forEach(cache.values(), ({ entry, onDispose }) => {
    entry.removeEventListener("dispose", onDispose);
  });
  cache.clear();
};
