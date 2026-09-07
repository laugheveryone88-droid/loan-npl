"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  Building2,
  Database,
  ListTodo,
  Settings2,
  ShieldAlert,
  UserPlus,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { NavigationItem } from "@/types/navigation";

const navigationItems: NavigationItem[] = [
  { title: "Үндсэн цэс", icon: ShieldAlert, href: "/overdue", isAvailable: true },
  { title: "Өнөөдрийн ажил", icon: ListTodo },
  { title: "Зээлийн боломж", icon: BadgeDollarSign },
  { title: "Тохиргоо", icon: Settings2 },
];

export function AppSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const visibleNavigationItems = isAdmin
    ? [
        ...navigationItems,
        {
          title: "Хэрэглэгчийн удирдлага",
          icon: UserPlus,
          href: "/admin/users",
          isAvailable: true,
        },
      ]
    : navigationItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-transparent active:bg-transparent"
              tooltip="Loan NPL"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Building2 className="size-5" aria-hidden="true" />
              </span>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">Loan NPL</span>
                <span className="truncate text-xs text-muted-foreground">
                  Зээлийн багцын удирдлага
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Ажлын хэсэг</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild={Boolean(item.href && item.isAvailable)}
                    isActive={item.href === pathname}
                    disabled={!item.isAvailable}
                    tooltip={
                      item.isAvailable ? item.title : `${item.title} — удахгүй`
                    }
                    className="disabled:cursor-not-allowed"
                  >
                    {item.href && item.isAvailable ? (
                      <Link href={item.href}>
                        <item.icon aria-hidden="true" />
                        <span>{item.title}</span>
                      </Link>
                    ) : (
                      <>
                        <item.icon aria-hidden="true" />
                        <span>{item.title}</span>
                      </>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="rounded-lg bg-sidebar-accent p-3 text-xs text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
          <p className="flex items-center gap-1.5 font-medium">
            <Database className="size-3.5" aria-hidden="true" />
            Google Sheets хадгалсан өгөгдөл
          </p>
          <p className="mt-1 text-muted-foreground">Админ гараар шинэчлэх үед “Үндсэн” шийтийг уншина.</p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
