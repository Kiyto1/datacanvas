const PATHS = {
  upload: 'M12 16V4m0 0L8 8m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  download: 'M12 4v12m0 0-4-4m4 4 4-4M4 20h16',
  close: 'M6 6l12 12M18 6 6 18',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6',
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9 12l2 2 4-4',
  table: 'M4 6h16v12H4zM4 11h16M10 6v12',
  chart: 'M5 20V10m5 10V4m5 16v-7m5 7V8',
  reset: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4',
  check: 'M5 12l4 4 10-10',
  plus: 'M12 5v14M5 12h14',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  file: 'M7 3h7l4 4v14H7zM14 3v4h4',
  wand: 'M5 19 15 9m0 0 2-2 2 2-2 2m-2-2 2 2M7 5v3M5.5 6.5h3M18 15v3M16.5 16.5h3',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  monitor: 'M4 5h16v11H4zM9 20h6M12 16v4',
  arrow: 'M5 12h14m0 0-5-5m5 5-5 5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
