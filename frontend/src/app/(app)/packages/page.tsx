import type { Metadata } from "next";
import { PackagesView } from "@/components/packages/packages-view";

export const metadata: Metadata = { title: "Packages" };

export default function Page() {
  return <PackagesView />;
}
