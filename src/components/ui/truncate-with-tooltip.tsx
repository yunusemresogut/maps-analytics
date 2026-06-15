"use client";

type TruncateWithTooltipProps = {
  text: string;
  className?: string;
  maxWidth?: string;
};

export function TruncateWithTooltip({
  text,
  className = "",
  maxWidth,
}: TruncateWithTooltipProps) {
  return (
    <span
      title={text}
      className={`block truncate ${className}`}
      style={maxWidth ? { maxWidth } : undefined}
    >
      {text}
    </span>
  );
}
