/** Three rising bars on an accent tile: the smallest picture of "numbers become a chart". Same shape as the favicon. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <rect x="7" y="17" width="4" height="8" rx="1.2" className="fill-brand-ink" opacity="0.55" />
      <rect x="14" y="11" width="4" height="14" rx="1.2" className="fill-brand-ink" opacity="0.8" />
      <rect x="21" y="6" width="4" height="19" rx="1.2" className="fill-brand-ink" />
    </svg>
  );
}

export function Wordmark({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark />
      <span dir="ltr" className="text-[1.05rem] font-semibold leading-none tracking-tight">
        {name}
      </span>
    </span>
  );
}
