import { z } from 'zod';

// Zod's default "JIT" mode probes `new Function`, which a strict CSP reports as a violation even
// when the probe is caught. We never allow eval, so run Zod without it (before any schema exists).
z.config({ jitless: true });

export const decisionsSchema = z
  .array(
    z.object({
      columnId: z.string().min(1).max(64),
      from: z.array(z.string().min(1).max(500)).min(1).max(1000),
      to: z.string().min(1).max(500),
    }),
  )
  .max(5000);
