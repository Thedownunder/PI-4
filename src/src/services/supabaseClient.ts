// src/services/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não foram definidas no .env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
