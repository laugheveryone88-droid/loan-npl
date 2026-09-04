import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient, type User } from "npm:@supabase/supabase-js@2.112.2";

type AdminRequest = {
  action?: unknown;
  email?: unknown;
  fullName?: unknown;
  password?: unknown;
  role?: unknown;
  userId?: unknown;
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
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validPassword(password: string) {
  return (
    password.length >= 10 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function passwordError() {
  return "Түр нууц үг хамгийн багадаа 10 тэмдэгт, үсэг, тоо, тусгай тэмдэгт агуулсан байна.";
}

function publicUser(user: User) {
  const bannedUntil = user.banned_until ? Date.parse(user.banned_until) : 0;
  return {
    id: user.id,
    email: user.email ?? "",
    fullName:
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "",
    role: user.app_metadata?.role === "admin" ? "admin" : "user",
    status:
      bannedUntil > Date.now()
        ? "banned"
        : user.email_confirmed_at
          ? "active"
          : "pending",
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
  };
}

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
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !caller) {
    return json({ ok: false, error: "Нэвтрэх шаардлагатай." }, 401);
  }
  if (caller.app_metadata?.role !== "admin") {
    return json({ ok: false, error: "Хэрэглэгч удирдах админ эрх алга." }, 403);
  }

  let body: AdminRequest;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Оруулсан мэдээлэл буруу байна." });
  }

  const action = typeof body.action === "string" ? body.action : "list";
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === "list") {
    const users: User[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) {
        return json({ ok: false, error: "Хэрэглэгчдийн жагсаалтыг уншиж чадсангүй." });
      }
      users.push(...data.users);
      if (data.users.length < 1000) break;
    }
    return json({
      ok: true,
      users: users
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map(publicUser),
    });
  }

  if (action === "create") {
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role === "admin" ? "admin" : "user";

    if (fullName.length < 2 || fullName.length > 120) {
      return json({ ok: false, error: "Овог нэрийг 2–120 тэмдэгтээр оруулна уу." });
    }
    if (!emailPattern.test(email) || email.length > 254) {
      return json({ ok: false, error: "Зөв имэйл хаяг оруулна уу." });
    }
    if (!validPassword(password)) {
      return json({ ok: false, error: passwordError() });
    }

    const { error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role },
    });
    if (error) {
      const duplicate =
        error.code === "email_exists" || error.message.toLowerCase().includes("already");
      return json({
        ok: false,
        error: duplicate
          ? "Энэ имэйл хаяг бүртгэлтэй байна."
          : "Хэрэглэгч бүртгэж чадсангүй. Мэдээллээ шалгаад дахин оролдоно уу.",
      });
    }
    return json({ ok: true });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!uuidPattern.test(userId)) {
    return json({ ok: false, error: "Хэрэглэгчийн дугаар буруу байна." });
  }

  if (action === "update") {
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role === "admin" ? "admin" : body.role === "user" ? "user" : null;

    if (fullName.length < 2 || fullName.length > 120) {
      return json({ ok: false, error: "Овог нэрийг 2–120 тэмдэгтээр оруулна уу." });
    }
    if (!role) {
      return json({ ok: false, error: "Хэрэглэгчийн role буруу байна." });
    }
    if (password && !validPassword(password)) {
      return json({ ok: false, error: passwordError() });
    }
    if (userId === caller.id && role !== "admin") {
      return json({ ok: false, error: "Өөрийн админ эрхийг бууруулах боломжгүй." });
    }

    const { data: targetData, error: targetError } =
      await adminClient.auth.admin.getUserById(userId);
    if (targetError || !targetData.user) {
      return json({ ok: false, error: "Хэрэглэгч олдсонгүй." });
    }
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: { ...targetData.user.user_metadata, full_name: fullName },
      app_metadata: { ...targetData.user.app_metadata, role },
      ...(password ? { password } : {}),
    });
    if (error) {
      return json({ ok: false, error: "Хэрэглэгчийн мэдээллийг шинэчилж чадсангүй." });
    }
    return json({ ok: true });
  }

  if (action === "delete") {
    if (userId === caller.id) {
      return json({ ok: false, error: "Өөрийн админ бүртгэлийг устгах боломжгүй." });
    }
    const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });
    if (banError) {
      return json({ ok: false, error: "Хэрэглэгчийн эрхийг хааж чадсангүй." });
    }
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) {
      return json({ ok: false, error: "Хэрэглэгчийг устгаж чадсангүй." });
    }
    return json({ ok: true });
  }

  return json({ ok: false, error: "Тодорхойгүй үйлдэл байна." });
});
