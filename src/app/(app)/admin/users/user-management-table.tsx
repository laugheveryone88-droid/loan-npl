"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Save,
  Trash2,
} from "lucide-react";

import {
  deleteUser,
  updateUser,
  type AdminUser,
  type UserActionState,
} from "@/app/(app)/admin/users/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const initialState: UserActionState = {};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const ulaanbaatar = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const parts = [
    ulaanbaatar.getUTCFullYear(),
    String(ulaanbaatar.getUTCMonth() + 1).padStart(2, "0"),
    String(ulaanbaatar.getUTCDate()).padStart(2, "0"),
  ];
  const time = [
    String(ulaanbaatar.getUTCHours()).padStart(2, "0"),
    String(ulaanbaatar.getUTCMinutes()).padStart(2, "0"),
  ];
  return `${parts.join(".")} ${time.join(":")}`;
}

function UserRow({ user, isCurrentUser }: { user: AdminUser; isCurrentUser: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [updateState, updateAction, updating] = useActionState(updateUser, initialState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteUser, initialState);

  return (
    <TableRow>
      <TableCell className="min-w-64">
        <div className="space-y-0.5">
          <p className="font-medium">{user.fullName || "Нэр оруулаагүй"}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
          {isCurrentUser ? (
            <p className="text-xs font-medium text-primary">Таны бүртгэл</p>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
          {user.role === "admin" ? "Админ" : "Хэрэглэгч"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <KeyRound className="size-3.5" aria-hidden="true" />
          Харах боломжгүй
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={user.status === "active" ? "outline" : "destructive"}>
          {user.status === "active"
            ? "Идэвхтэй"
            : user.status === "banned"
              ? "Хаалттай"
              : "Баталгаажаагүй"}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        <p>{formatDate(user.createdAt)}</p>
        <p className="mt-1">Сүүлд: {formatDate(user.lastSignInAt)}</p>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Засах</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Хэрэглэгчийн мэдээлэл засах</DialogTitle>
                <DialogDescription>
                  Нэр, role болон шаардлагатай бол шинэ түр нууц үг тохируулна.
                </DialogDescription>
              </DialogHeader>
              <form action={updateAction} className="space-y-4">
                <input type="hidden" name="userId" value={user.id} />
                {updateState.error ? (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden="true" />
                    <AlertDescription>{updateState.error}</AlertDescription>
                  </Alert>
                ) : null}
                {updateState.success ? (
                  <Alert>
                    <CheckCircle2 aria-hidden="true" />
                    <AlertDescription>{updateState.success}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor={`fullName-${user.id}`}>Овог нэр</Label>
                  <Input
                    id={`fullName-${user.id}`}
                    name="fullName"
                    defaultValue={user.fullName}
                    maxLength={120}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`role-${user.id}`}>Role</Label>
                  <select
                    id={`role-${user.id}`}
                    name="role"
                    defaultValue={user.role}
                    disabled={isCurrentUser}
                    className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] disabled:opacity-60"
                  >
                    <option value="user">Энгийн хэрэглэгч</option>
                    <option value="admin">Админ</option>
                  </select>
                  {isCurrentUser ? <input type="hidden" name="role" value="admin" /> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`password-${user.id}`}>Шинэ түр нууц үг</Label>
                  <Input
                    id={`password-${user.id}`}
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    placeholder="Өөрчлөхгүй бол хоосон үлдээнэ"
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Болих</Button>
                  </DialogClose>
                  <Button type="submit" disabled={updating}>
                    {updating ? (
                      <LoaderCircle className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Save aria-hidden="true" />
                    )}
                    Хадгалах
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {!isCurrentUser ? (
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm" aria-label={`${user.email} хэрэглэгчийг устгах`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Хэрэглэгчийг устгах уу?</DialogTitle>
                  <DialogDescription>
                    {user.email} бүртгэлийг бүрмөсөн устгана. Энэ үйлдлийг буцаах боломжгүй.
                  </DialogDescription>
                </DialogHeader>
                {deleteState.error ? (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden="true" />
                    <AlertDescription>{deleteState.error}</AlertDescription>
                  </Alert>
                ) : null}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Болих</Button>
                  </DialogClose>
                  <form action={deleteAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <Button type="submit" variant="destructive" disabled={deleting}>
                      {deleting ? (
                        <LoaderCircle className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 aria-hidden="true" />
                      )}
                      Устгах
                    </Button>
                  </form>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function UserManagementTable({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  return (
    <div className="space-y-4">
      <Alert>
        <CheckCircle2 aria-hidden="true" />
        <AlertDescription>
          Аюулгүй байдлын улмаас одоогийн нууц үгийг харах боломжгүй. “Засах”
          хэсгээс шинэ түр нууц үг тохируулж болно.
        </AlertDescription>
      </Alert>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Хэрэглэгч</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Нууц үг</TableHead>
            <TableHead>Төлөв</TableHead>
            <TableHead>Огноо</TableHead>
            <TableHead className="text-right">Үйлдэл</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <UserRow key={user.id} user={user} isCurrentUser={user.id === currentUserId} />
          ))}
        </TableBody>
      </Table>
      {users.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Хэрэглэгч олдсонгүй.
        </p>
      ) : null}
    </div>
  );
}
