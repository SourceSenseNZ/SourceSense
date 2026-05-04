"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type LogoProps = {
  variant?: "full" | "icon";
};

function getIsDarkTheme() {
  if (typeof window === "undefined") {
    return true;
  }

  const root = document.documentElement;

  if (root.dataset.theme === "dark" || root.classList.contains("dark")) {
    return true;
  }

  if (root.dataset.theme === "light") {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function Logo({ variant = "full" }: LogoProps) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const updateTheme = () => setIsDark(getIsDarkTheme());
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const observer = new MutationObserver(updateTheme);

    updateTheme();
    mediaQuery.addEventListener("change", updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => {
      mediaQuery.removeEventListener("change", updateTheme);
      observer.disconnect();
    };
  }, []);

  const src =
    variant === "icon" ? "/logo-icon.png" : isDark ? "/logo-dark.png" : "/logo-light.png";

  return (
    <Image
      src={src}
      alt="SourceSense"
      width={variant === "icon" ? 40 : 200}
      height={variant === "icon" ? 40 : 60}
      preload
      style={{ height: "auto" }}
    />
  );
}
