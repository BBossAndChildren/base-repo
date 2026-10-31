import type { ReactNode } from 'react'

type Tone = 'new' | 'success' | 'muted' | 'progress'

export function Badge({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
