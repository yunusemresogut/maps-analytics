import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)]",
        ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-white/5",
        outline:
          "border border-zinc-700 bg-transparent text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-300",
        danger:
          "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
