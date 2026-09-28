"use client";

import { cn } from "@/lib/utils";

type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toLocaleUpperCase("tr");
  return (
    parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toLocaleUpperCase("tr");
}

const SIZE_CLASS = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

export function UserAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: UserAvatarProps) {
  const initials = initialsFromName(name);

  if (avatarUrl?.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={cn(
          "rounded-full object-cover ring-1 ring-zinc-700",
          SIZE_CLASS[size],
          className
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-semibold text-cyan-300 ring-1 ring-cyan-500/30",
        SIZE_CLASS[size],
        className
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export { initialsFromName };
