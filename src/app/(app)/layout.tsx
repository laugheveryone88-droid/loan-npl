import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { GoogleSheetsDataProvider } from "@/features/workbook-data/components/google-sheets-data-provider";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  const userEmail = data.user.email;
  const isAdmin = data.user.app_metadata?.role === "admin";

  return (
    <GoogleSheetsDataProvider>
      <SidebarProvider>
        <AppSidebar isAdmin={isAdmin} />
        <SidebarInset>
          <SiteHeader userEmail={userEmail} isAdmin={isAdmin} />
          <main className="flex flex-1 flex-col bg-muted/35">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </GoogleSheetsDataProvider>
  );
}
