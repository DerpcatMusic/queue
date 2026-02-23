import type { PropsWithChildren } from "react";

import { KitSurface } from "@/components/ui/kit";

type BrandSurfaceProps = PropsWithChildren<{
  tone?: "default" | "alt" | "elevated";
  style?: object;
}>;

export function BrandSurface({ children, tone = "default", style }: BrandSurfaceProps) {
  const mappedTone = tone === "alt" ? "sunken" : tone === "elevated" ? "elevated" : "base";
  return (
    <KitSurface tone={mappedTone} style={style}>
      {children}
    </KitSurface>
  );
}

