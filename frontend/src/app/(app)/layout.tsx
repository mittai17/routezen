import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <a href="#main" className="sr-only z-50 rounded-lg bg-brand px-3 py-2 font-semibold text-brand-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-[220px]">
        <Topbar />
        <main id="main" className="flex-1 px-4 py-5 lg:px-6">{children}</main>
      </div>
    </Providers>
  );
}
