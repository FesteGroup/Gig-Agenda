import type { QueryClient } from "@tanstack/react-query";
import type { AuthChangeEvent } from "@supabase/supabase-js";

/** Never carry private data or the previous account's roles across sign-ins. */
export function refreshAuthCache(queryClient: QueryClient, event: AuthChangeEvent) {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
    // Cancellation marks old requests as cancelled before clearing their entries.
    // Do not await here: auth callbacks must not wait on other auth operations.
    void queryClient.cancelQueries();
    queryClient.clear();
    return true;
  }
  if (event === "USER_UPDATED") {
    void queryClient.invalidateQueries();
    return true;
  }
  return false;
}