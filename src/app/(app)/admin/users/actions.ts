"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase";

export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "user";
  status: "active" | "pending" | "banned";
  createdAt: string;
  lastSignInAt: string | null;
};

export type UserActionState = {
  error?: string;
  success?: string;
  email?: string;
  fullName?: string;
  role?: "admin" | "user";
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validPassword(password: string) {
  return (
    password.length >= 10 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

async function invokeAdminAction(body: Record<string, unknown>) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || user.app_metadata?.role !== "admin") {
    return { ok: false, error: "Хэрэглэгч удирдах админ эрх алга." };
  }

  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body,
  });
  if (error) {
    return {
      ok: false,
      error: "Үйлдлийг гүйцэтгэж чадсангүй. Түр хүлээгээд дахин оролдоно уу.",
    };
  }
  return data as { ok?: boolean; error?: string };
}

export async function createUser(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const role: "admin" | "user" =
    formData.get("role") === "admin" ? "admin" : "user";
  const values = { email, fullName, role };

  if (fullName.length < 2 || fullName.length > 120) {
    return { ...values, error: "Овог нэрийг 2–120 тэмдэгтээр оруулна уу." };
  }
  if (!emailPattern.test(email) || email.length > 254) {
    return { ...values, error: "Зөв имэйл хаяг оруулна уу." };
  }
  if (!validPassword(password)) {
    return {
      ...values,
      error:
        "Түр нууц үг хамгийн багадаа 10 тэмдэгт, үсэг, тоо, тусгай тэмдэгт агуулсан байна.",
    };
  }
  if (password !== confirmPassword) {
    return { ...values, error: "Нууц үгийн баталгаажуулалт таарахгүй байна." };
  }

  const result = await invokeAdminAction({
    action: "create",
    email,
    fullName,
    password,
    role,
  });
  if (!result?.ok) {
    return { ...values, error: result?.error ?? "Хэрэглэгч бүртгэж чадсангүй." };
  }

  revalidatePath("/admin/users");
  return { success: `${email} хаягтай хэрэглэгчийг амжилттай бүртгэлээ.` };
}

export async function updateUser(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const userId = String(formData.get("userId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role: "admin" | "user" =
    formData.get("role") === "admin" ? "admin" : "user";
  const password = String(formData.get("password") ?? "");

  if (fullName.length < 2 || fullName.length > 120) {
    return { error: "Овог нэрийг 2–120 тэмдэгтээр оруулна уу." };
  }
  if (password && !validPassword(password)) {
    return {
      error:
        "Шинэ нууц үг хамгийн багадаа 10 тэмдэгт, үсэг, тоо, тусгай тэмдэгт агуулсан байна.",
    };
  }

  const result = await invokeAdminAction({
    action: "update",
    userId,
    fullName,
    role,
    password,
  });
  if (!result?.ok) {
    return { error: result?.error ?? "Хэрэглэгчийн мэдээллийг шинэчилж чадсангүй." };
  }

  revalidatePath("/admin/users");
  return { success: "Хэрэглэгчийн мэдээллийг шинэчиллээ." };
}

export async function deleteUser(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const userId = String(formData.get("userId") ?? "");
  const result = await invokeAdminAction({ action: "delete", userId });
  if (!result?.ok) {
    return { error: result?.error ?? "Хэрэглэгчийг устгаж чадсангүй." };
  }

  revalidatePath("/admin/users");
  return { success: "Хэрэглэгчийг устгалаа." };
}
