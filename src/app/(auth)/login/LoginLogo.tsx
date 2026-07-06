"use client";

import Image from "next/image";
import { useTheme } from "@wrksz/themes/client";

/**
 * Theme-aware logo for the login page.
 * Shows light logo variant in dark mode, dark logo variant in light mode.
 */
export default function LoginLogo() {
  const { resolvedTheme } = useTheme();

  const logoSrc =
    resolvedTheme === "dark"
      ? "/images/logo-with-name.png"
      : "/images/logo-with-name-light.png";

  return (
    <Image
      src={logoSrc}
      alt="Ops Upgrade"
      width={200}
      height={50}
      priority
      className="h-12 w-auto rounded"
    />
  );
}