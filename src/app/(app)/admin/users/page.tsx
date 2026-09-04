import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck, UserPlus, Users } from "lucide-react";

import type { AdminUser } from "@/app/(app)/admin/users/actions";
import { UserManagementTable } from "@/app/(app)/admin/users/user-management-table";
import { UserRegistrationForm } from "@/app/(app)/admin/users/user-registration-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createServerClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Хэрэглэгчийн удирдлага",
};

export default async function AdminUsersPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin/users");
  if (user.app_metadata?.role !== "admin") redirect("/overdue");

  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: { action: "list" },
  });
  const users = data?.ok && Array.isArray(data.users) ? (data.users as AdminUser[]) : [];

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
            Зөвхөн админ
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Хэрэглэгчийн удирдлага
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Системийн бүх хэрэглэгчийг харах, шинэ хэрэглэгч бүртгэх, нэр болон
            role шинэчлэх, түр нууц үг тохируулах, бүртгэл устгах боломжтой.
          </p>
        </div>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>Шинэ хэрэглэгч бүртгэх</CardTitle>
            <CardDescription>
              Нэвтрэх имэйл, түр нууц үг болон role сонгоно уу.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserRegistrationForm />
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>Бүх хэрэглэгч</CardTitle>
            <CardDescription>{users.length} хэрэглэгч бүртгэлтэй байна.</CardDescription>
          </CardHeader>
          <CardContent>
            {error || !data?.ok ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {typeof data?.error === "string"
                    ? data.error
                    : "Хэрэглэгчдийн жагсаалтыг уншиж чадсангүй."}
                </AlertDescription>
              </Alert>
            ) : (
              <UserManagementTable users={users} currentUserId={user.id} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
