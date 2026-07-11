"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function KnowMoreButton() {
  return (
    <Button
      className="w-full sm:w-auto"
      render={<Link href="#como-funciona" />}
      onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}
      nativeButton={false}
    >
      Saber mais
    </Button>
  );
}
