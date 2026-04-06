interface LogoProps {
  className?: string;
  size?: number;
}

/**
 * AdOps Studio brand mark — three stacked bars forming an A-frame,
 * representing the Campaign → Ad Set → Ad hierarchy the app is built around.
 */
export function Logo({ className, size }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      className={className}
      role="img"
      aria-label="AdOps Studio"
    >
      <rect width="64" height="64" rx="14" fill="#1a1a1a" />
      <rect x="8"  y="44" width="48" height="10" rx="2.5" fill="#B2933D" />
      <rect x="16" y="30" width="32" height="10" rx="2.5" fill="#D2B24F" />
      <rect x="24" y="16" width="16" height="10" rx="2.5" fill="#F3D271" />
    </svg>
  );
}
