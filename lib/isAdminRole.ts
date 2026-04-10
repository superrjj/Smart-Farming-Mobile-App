/** Matches `public.user_role` enum values from Supabase (e.g. 'Admin', 'Farmer'). */
export function isAdminRole(role: unknown): boolean {
  if (typeof role !== "string") return false;
  return role.trim().toLowerCase() === "admin";
}
