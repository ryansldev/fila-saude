import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" className={cn("size-[2.2rem]", className)}>
      <title>Logo Fila Saúde</title>
      <path
        fill="currentColor"
        d="M5.127 23.609C6.564 36.242 20.52 48.093 29.33 54.212a4.673 4.673 0 0 0 5.34 0c8.81-6.119 22.767-17.97 24.203-30.603C60.863 6.099 38.967 3.972 32 13.977 25.033 3.972 3.137 6.1 5.127 23.61Z"
      />
      <path
        fill="#fff"
        d="M28.704 21.09a2.583 2.583 0 0 1 2.583-2.584h2.583a2.583 2.583 0 0 1 2.583 2.583v20.665a2.583 2.583 0 0 1-2.583 2.583h-2.583a2.583 2.583 0 0 1-2.583-2.583V21.09Z"
      />
      <path
        fill="#fff"
        d="M19.663 30.13a2.583 2.583 0 0 1 2.583-2.583H42.91a2.583 2.583 0 0 1 2.583 2.583v2.583a2.583 2.583 0 0 1-2.583 2.583H22.246a2.583 2.583 0 0 1-2.583-2.583V30.13Z"
      />
    </svg>
  );
}
