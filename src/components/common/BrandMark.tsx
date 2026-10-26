import Image from 'next/image';

export function BrandMark({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <Image
      src="/casepulse-mark.svg"
      alt=""
      width={300}
      height={220}
      unoptimized
      className={`object-contain ${className}`}
      aria-hidden="true"
    />
  );
}
