import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

type CreateUserRequest = {
  email?: unknown;
  fullName?: unknown;
  password?: unknown;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Зөвшөөрөгдөөгүй хүсэлт." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return json({ ok: false, error: "Нэвтрэх шаардлагатай." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return json({ ok: false, error: "Серверийн тохиргоо дутуу байна." }, 500);
  }

  const callerClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();

  if (userError || !user) {
    return json({ ok: false, error: "Нэвтрэх шаардлагатай." }, 401);
  }

  if (user.app_metadata?.role !== "admin") {
    return json({ ok: false, error: "Шинэ хэрэглэгч бүртгэх админ эрх алга." }, 403);
  }

  let body: CreateUserRequest;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Оруулсан мэдээлэл буруу байна." });
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (fullName.length < 2 || fullName.length > 120) {
    return json({ ok: false, error: "Овог нэрийг 2–120 тэмдэгтээр оруулна уу." });
  }

  if (!emailPattern.test(email) || email.length > 254) {
    return json({ ok: false, error: "Зөв имэйл хаяг оруулна уу." });
  }

  if (
    password.length < 10 ||
    !/[A-Za-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return json({
      ok: false,
      error:
        "Түр нууц үг хамгийн багадаа 10 тэмдэгт, үсэг, тоо, тусгай тэмдэгт агуулсан байна.",
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "user" },
  });

  if (createError) {
    const duplicate =
      createError.code === "email_exists" ||
      createError.message.toLowerCase().includes("already");
    return json({
      ok: false,
      error: duplicate
        ? "Энэ имэйл хаяг бүртгэлтэй байна."
        : "Хэрэглэгч бүртгэж чадсангүй. Мэдээллээ шалгаад дахин оролдоно уу.",
    });
  }

  return json({ ok: true });
});
