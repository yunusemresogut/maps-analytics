import Image from "next/image";
import { cn } from "@/lib/utils";

// Koordine logosu (public/img/koordine-logo.png'den kırpıldı). Lacivert kısımlar koyu
// zeminde kaybolduğu için "-dark" varyantı açık renklidir; tema html.light ile seçilir.
const VARIANTS = {
  mark: { src: "/img/koordine-mark", width: 128, height: 128 },
  full: { src: "/img/koordine-logo-wide", width: 814, height: 168 },
} as const;

type BrandLogoProps = {
  variant?: keyof typeof VARIANTS;
  // "auto" temaya uyar; "dark" her zaman koyu zemin içindir
  tone?: "auto" | "dark";
  className?: string;
};

export function BrandLogo({ variant = "full", tone = "auto", className }: BrandLogoProps) {
  const { src, width, height } = VARIANTS[variant];
  // self-start: flex-col ebeveynde (ör. login paneli) yatayda gerilip basılmasını önler
  const imgClass = cn("w-auto max-w-full shrink-0 self-start object-contain select-none", className);

  if (tone === "dark") {
    return <Image src={`${src}-dark.png`} alt="Koordine" width={width} height={height} priority className={imgClass} />;
  }

  return (
    <>
      <Image
        src={`${src}-dark.png`}
        alt="Koordine"
        width={width}
        height={height}
        priority
        className={cn(imgClass, "in-[.light]:hidden")}
      />
      <Image
        src={`${src}.png`}
        alt="Koordine"
        width={width}
        height={height}
        priority
        className={cn(imgClass, "hidden in-[.light]:block")}
      />
    </>
  );
}
