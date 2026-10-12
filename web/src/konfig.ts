// konfig.ts
// Welche Supabase-Datenbank diese Fassung benutzt. Die Werte kommen beim
// Bauen aus web/.env.test bzw. web/.env.live — ein Code, zwei Fassungen.

export const UMGEBUNG     = import.meta.env.VITE_UMGEBUNG as "test" | "live";
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string;
export const IST_TEST     = UMGEBUNG !== "live";
