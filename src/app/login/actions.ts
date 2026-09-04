"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase";

export type LoginState = {
  error?: string;
  email?: string;
};

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedNext = String(formData.get("next") ?? "/overdue");
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/overdue";

  if (!email || !password) {
    return {
      error: "Имэйл хаяг болон нууц үгээ бүрэн оруулна уу.",
      email,
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error: "Имэйл хаяг эсвэл нууц үг буруу байна. Дахин оролдоно уу.",
      email,
    };
  }

  revalidatePath("/", "layout");
  redirect(next);
}
