import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Dış kabın genişlik/yerleşim sınıfları (ör. "flex-1 sm:max-w-sm") */
  containerClassName?: string;
};

/** Solunda mercek ikonu olan arama alanı */
export function SearchInput({ containerClassName, className, ...props }: SearchInputProps) {
  return (
    <div className={cn("relative min-w-0", containerClassName)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
        aria-hidden
      />
      <Input className={cn("pl-9", className)} {...props} />
    </div>
  );
}
