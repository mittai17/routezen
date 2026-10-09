import { ShieldCheck, ShieldQuestion, UserRound, FileText } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { VERIFICATION_HELP, VERIFICATION_LABEL, type Verification } from "./vehicle-utils";

const TONE: Record<Verification, Tone> = { measured: "success", external: "info", user: "violet", assumed: "warning" };
const ICON = { measured: ShieldCheck, external: FileText, user: UserRound, assumed: ShieldQuestion } as const;

/** Verification is conveyed by icon and text, never colour alone. */
export function VerificationBadge({ value }: { value: Verification }) {
  const Icon = ICON[value];
  return (
    <span title={VERIFICATION_HELP[value]}>
      <Badge tone={TONE[value]}><Icon className="size-3" aria-hidden />{VERIFICATION_LABEL[value]}</Badge>
    </span>
  );
}
