import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Root page ("/") — routing gate.
 *
 * - Authenticated users → /sanctuary
 * - Unauthenticated users → /sign-in
 *
 * The original public landing page is archived at /archive/home.
 */
export default async function RootPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/sanctuary");
  }

  redirect("/sign-in");
}
