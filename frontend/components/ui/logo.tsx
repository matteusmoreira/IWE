import Image from "next/image";
import React from "react";

type LogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  alt?: string;
};

const sizeMap: Record<NonNullable<LogoProps["size"]>, number> = {
  sm: 24,
  md: 40,
  lg: 64,
  xl: 160,
};

export function Logo({ size = "md", className = "", alt = "IWE logo" }: LogoProps) {
  const dimension = sizeMap[size];

  return (
    <div
      className={className}
      style={{ lineHeight: 0, position: "relative", width: dimension, height: dimension }}
    >
      <Image
        src="/logo.png"
        alt={alt}
        fill
        sizes={typeof dimension === "number" ? `${dimension}px` : "100vw"}
        priority
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}

export default Logo;