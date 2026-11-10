import { QueryClient } from "@tanstack/react-query";

/**
 * The renderer's TanStack Query cache, for data fetched from APIs. App state stays in Redux.
 * Results stay fresh for five minutes, and focusing the window doesn't refetch them, since
 * switching to and from a game would otherwise refetch every query on screen. Failed queries
 * aren't retried unless a query opts in with its own `retry`, so errors show straight away.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});
