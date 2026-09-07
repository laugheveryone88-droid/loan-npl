"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LogOut, Search, UserPlus } from "lucide-react";

import { signOut } from "@/app/auth/actions";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

type SiteHeaderProps = {
  userEmail?: string;
  isAdmin?: boolean;
};

const pageTitles: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Loan NPL ажлын орчин",
    description: "Google Sheets хадгалсан өгөгдөл ба самбарын төлөв",
  },
  "/overdue": {
    title: "Хугацаа хэтрэлт ба collection",
    description: "Хугацаа хэтэрсэн хоног, үлдэгдэл, төлөлт, эрсдэлийн хяналт",
  },
  "/admin/users": {
    title: "Хэрэглэгчийн удирдлага",
    description: "Зөвхөн админ шинэ хэрэглэгч бүртгэнэ",
  },
};

export function SiteHeader({ userEmail, isAdmin = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const pageTitle = pageTitles[pathname] ?? pageTitles["/"];
  const initials = userEmail?.slice(0, 2).toUpperCase() ?? "LN";

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{pageTitle.title}</p>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {pageTitle.description}
        </p>
      </div>

      <div className="relative hidden w-full max-w-xs lg:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="h-9 bg-muted/50 pl-9"
          placeholder="Одоогийн самбараас хайх"
          aria-label="Одоогийн самбараас хайх"
          disabled
        />
      </div>

      <Button variant="ghost" size="icon" aria-label="Мэдэгдэл" disabled>
        <Bell className="size-4" aria-hidden="true" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 px-2 sm:px-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </span>
            <span className="hidden max-w-40 truncate text-sm sm:inline">
              {userEmail ?? "Ажлын хэсэг"}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="space-y-0.5">
            <span className="block">Loan NPL ажлын хэсэг</span>
            {userEmail ? (
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {userEmail}
              </span>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Бүртгэлийн тохиргоо</DropdownMenuItem>
          {isAdmin ? (
            <DropdownMenuItem asChild>
              <Link href="/admin/users">
                <UserPlus aria-hidden="true" />
                Хэрэглэгчийн удирдлага
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>Хэрэглэгчийн удирдлага</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <form action={signOut}>
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full cursor-pointer">
                <LogOut aria-hidden="true" />
                Гарах
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
