"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type LogoProps = {
  variant?: "full" | "mark" | "icon";
  tone?: "auto" | "dark" | "light";
  className?: string;
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

export default function Logo({ variant = "full", tone = "auto", className }: LogoProps) {
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

  const resolvedDark = tone === "auto" ? isDark : tone === "dark";
  const logoVariant = variant === "icon" ? "mark" : variant;
  const src = resolvedDark
    ? `/logo-dark-${logoVariant}-cropped.png`
    : `/logo-light-${logoVariant}-cropped.png`;
  const width = logoVariant === "full" ? 240 : 170;
  const height = logoVariant === "full" ? 78 : 55;

  return (
    <Image
      src={src}
      alt="SourceSense"
      width={width}
      height={height}
      className={className}
      preload
      sizes={`${width}px`}
      style={{ display: "block", margin: "0 auto", width: "100%", maxWidth: width, height: "auto" }}
    />
  );
}
