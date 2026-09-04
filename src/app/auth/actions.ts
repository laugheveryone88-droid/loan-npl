"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { GOOGLE_SHEETS_ACCESS_TOKEN_COOKIE } from "@/lib/google-sheets";
import { createServerClient } from "@/lib/supabase";

export async function signOut() {
  const supabase = await createServerClient();

  await supabase.auth.signOut();
  (await cookies()).delete(GOOGLE_SHEETS_ACCESS_TOKEN_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login");
}
