"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { PRO_CLAIM_PATH, writeProIntent } from "@/lib/auth/proIntent";
import { cn } from "@/lib/cn";

type ClaimCafeButtonProps = {
  label?: string;
  className?: string;
};

export default function ClaimCafeButton({
  label = "Revendiquer mon café",
  className,
}: ClaimCafeButtonProps) {
  return (
    /* No prefetch: signed out, the proxy answers with a redirect to /login
       that the router would keep and replay after sign-in. */
    <Link
      href={PRO_CLAIM_PATH}
      prefetch={false}
      onClick={writeProIntent}
      className={cn(
        "rounded-xl no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent",
        className
      )}
    >
      <Button variant="main" className="w-full sm:w-auto" tabIndex={-1}>
        {label}
      </Button>
    </Link>
  );
}
