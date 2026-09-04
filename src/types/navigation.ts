import type { LucideIcon } from "lucide-react";

export type NavigationItem = {
  title: string;
  icon: LucideIcon;
  href?: string;
  isAvailable?: boolean;
};
