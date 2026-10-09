import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";

export function PlaceholderPage({ title, description, icon: Icon, emptyTitle, emptyDescription }: { title: string; description: string; icon: LucideIcon; emptyTitle: string; emptyDescription: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState icon={<Icon />} title={emptyTitle} description={emptyDescription} />
    </>
  );
}
