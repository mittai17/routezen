import { BarChart3, FileText, Gauge, LayoutDashboard, MapPin, Navigation, Package, Radio, Settings, Truck, Layers, Plane, type LucideIcon } from "lucide-react";

export interface NavItem { label: string; href: string; icon: LucideIcon; section?: string }
export const NAV_ITEMS: NavItem[] = [
  // ── Smart Travel ──
  { label: "Smart Travel", href: "/smart-travel", icon: Plane, section: "Travel" },
  // ── Delivery ──
  { label: "Overview", href: "/overview", icon: LayoutDashboard, section: "Delivery" },
  { label: "Plan Delivery", href: "/plan", icon: Navigation },
  { label: "Locations", href: "/locations", icon: MapPin },
  { label: "Packages", href: "/packages", icon: Package },
  { label: "Vehicle Profiles", href: "/vehicles", icon: Truck },
  { label: "Optimization Results", href: "/optimization", icon: Gauge },
  { label: "Live Tracking", href: "/tracking", icon: Radio },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Scenarios", href: "/scenarios", icon: Layers },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
];
