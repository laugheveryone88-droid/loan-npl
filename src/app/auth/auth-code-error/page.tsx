import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/35 p-6">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Баталгаажуулалт амжилтгүй боллоо
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Нэвтрэх эсвэл нууц үг сэргээх линк хүчингүй, хугацаа дууссан, эсвэл
          эрх олголт цуцлагдсан байна. Нэвтрэх хуудас руу буцаж дахин оролдоно уу.
        </p>
        <Button asChild type="button" size="lg" className="mt-7">
          <Link href="/login">
            <ArrowLeft aria-hidden="true" />
            Нэвтрэх хуудас руу буцах
          </Link>
        </Button>
      </div>
    </main>
  );
}
