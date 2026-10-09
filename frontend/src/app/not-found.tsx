import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <LogoMark className="mx-auto mb-4 h-14 w-12" />
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">That route does not exist. Let&apos;s get you back on the road.</p>
        <Link href="/overview" className="mt-6 inline-flex h-10 items-center rounded-[10px] bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover">Back to Overview</Link>
      </div>
    </div>
  );
}
