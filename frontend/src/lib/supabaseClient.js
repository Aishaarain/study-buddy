import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseanonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log("Supabase URL exists:", Boolean(supabaseUrl));
console.log("Supabase key exists:", Boolean(supabaseAnonKey));
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseanonKey, supabaseUrl, supabaseKey)
