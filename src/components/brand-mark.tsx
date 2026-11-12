import Image from "next/image";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={className ? `brand-mark ${className}` : "brand-mark"} aria-hidden="true">
      <Image src="/icons/sala-192.png" width={40} height={40} alt="" unoptimized />
    </span>
  );
}
