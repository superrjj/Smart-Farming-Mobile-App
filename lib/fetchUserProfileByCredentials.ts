import { supabase } from "@/lib/supabase";
import type { PostgrestError } from "@supabase/supabase-js";

export async function fetchUserProfileByCredentials(
  trimmedInput: string,
  hashedPassword: string,
): Promise<{
  profile: Record<string, unknown> | null;
  error: PostgrestError | null;
}> {
  const emailResult = await supabase
    .from("user_profiles")
    .select("*")
    .eq("email", trimmedInput)
    .eq("password", hashedPassword)
    .maybeSingle();

  if (emailResult.error) {
    return { profile: null, error: emailResult.error };
  }
  if (emailResult.data) {
    return {
      profile: emailResult.data as Record<string, unknown>,
      error: null,
    };
  }

  const phoneResult = await supabase
    .from("user_profiles")
    .select("*")
    .eq("phone_number", trimmedInput)
    .eq("password", hashedPassword)
    .maybeSingle();

  if (phoneResult.error) {
    return { profile: null, error: phoneResult.error };
  }
  if (phoneResult.data) {
    return {
      profile: phoneResult.data as Record<string, unknown>,
      error: null,
    };
  }

  return { profile: null, error: null };
}
