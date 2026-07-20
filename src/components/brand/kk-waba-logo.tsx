import Image from "next/image";
import { cn } from "@/lib/utils";

type KkWabaLogoProps = {
  className?: string;
  priority?: boolean;
};

export function KkWabaLogo({ className, priority = false }: KkWabaLogoProps) {
  return (
    <Image
      src="/brand/kk-waba-logo.png"
      alt="KK WABA — WhatsApp API CRM"
      width={1498}
      height={403}
      priority={priority}
      sizes="(max-width: 640px) 150px, 220px"
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}
