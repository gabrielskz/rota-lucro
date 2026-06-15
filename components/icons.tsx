import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function RouteIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M8 17h3a3 3 0 0 0 3-3v-4a3 3 0 0 1 3-3"/></BaseIcon>;
}

export function WalletIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M4 7.5h15a1 1 0 0 1 1 1v10H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h12v4"/><path d="M15 12h5v4h-5a2 2 0 0 1 0-4Z"/></BaseIcon>;
}

export function FuelIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M7 7h6v5H7z"/><path d="m15 8 3 3v6.5a1.5 1.5 0 0 0 3 0V9l-2-2"/></BaseIcon>;
}

export function RoadIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="m8 3-3 18M16 3l3 18M12 4v4M12 12v4M12 20v1"/></BaseIcon>;
}

export function PlusIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M12 5v14M5 12h14"/></BaseIcon>;
}

export function TrashIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></BaseIcon>;
}

export function LogInIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></BaseIcon>;
}

export function XIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="m6 6 12 12M18 6 6 18"/></BaseIcon>;
}

export function CheckIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="m5 12 4 4L19 6"/></BaseIcon>;
}

export function ChevronIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="m9 18 6-6-6-6"/></BaseIcon>;
}

export function ChartIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></BaseIcon>;
}

export function HomeIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></BaseIcon>;
}
