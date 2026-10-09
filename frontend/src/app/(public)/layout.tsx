import { PublicFooter, PublicHeader } from "@/components/public/public-shell";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#content" className="sr-only z-50 rounded-lg bg-brand px-3 py-2 font-semibold text-brand-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
      <PublicHeader />
      <main id="content" className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
