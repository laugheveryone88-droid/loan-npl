"use client";

import { useActionState, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, UserPlus } from "lucide-react";

import {
  createUser,
  type UserActionState,
} from "@/app/(app)/admin/users/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: UserActionState = {};

export function UserRegistrationForm() {
  const [state, formAction, isPending] = useActionState(createUser, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {state.error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.success ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" />
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="fullName">Овог нэр</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          defaultValue={state.fullName}
          placeholder="Хэрэглэгчийн овог нэр"
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Нэвтрэх имэйл</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={state.email}
          placeholder="name@company.mn"
          maxLength={254}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">Түр нууц үг</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Нууц үг давтах</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Хэрэглэгчийн role</Label>
        <select
          id="role"
          name="role"
          defaultValue={state.role ?? "user"}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] sm:max-w-xs"
        >
          <option value="user">Энгийн хэрэглэгч</option>
          <option value="admin">Админ</option>
        </select>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Түр нууц үг нь 10-аас цөөнгүй тэмдэгттэй бөгөөд үсэг, тоо, тусгай
        тэмдэгт агуулсан байна. Нууц үгийг аюулгүй сувгаар хэрэглэгчид дамжуулна
        уу.
      </p>

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            Бүртгэж байна…
          </>
        ) : (
          <>
            <UserPlus aria-hidden="true" />
            Хэрэглэгч бүртгэх
          </>
        )}
      </Button>
    </form>
  );
}
