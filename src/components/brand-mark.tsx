import { BookOpen } from "lucide-react";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={className ? `brand-mark ${className}` : "brand-mark"} aria-hidden="true">
      <BookOpen size={16} strokeWidth={2.35} />
    </span>
  );
}
