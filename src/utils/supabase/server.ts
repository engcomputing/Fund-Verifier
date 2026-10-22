import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  isLiveSupabaseConfigured,
  readStore,
  SupabaseStoreSchema,
  writeStore,
} from "@/lib/db";

type TableName = keyof SupabaseStoreSchema;

function createLocalSupabaseAdapter() {
  return {
    from(table: string) {
      const key = table as TableName;
      return {
        async select() {
          const store = readStore();
          const rows = store[key] ?? [];
          return { data: rows, error: null };
        },
        async insert(values: unknown) {
          const store = readStore();
          const list = (store[key] as unknown[]) ?? [];
          const items = Array.isArray(values) ? values : [values];
          list.push(...items);
          writeStore(store);
          return { data: items, error: null };
        },
      };
    },
  };
}

export async function createClient() {
  if (!isLiveSupabaseConfigured()) {
    return createLocalSupabaseAdapter();
  }

  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }>
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          } catch {
            // Ignore in Server Components
          }
        },
      },
    }
  );
}
