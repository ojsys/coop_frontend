import { initials as toInitials } from '@/lib/format'

const TONES = [
  'bg-green-50 text-green',
  'bg-gold-50 text-gold-deep',
  'bg-[#e6eef5] text-[#2c5f8a]',
  'bg-[#efe6f2] text-[#7a4c8a]',
]

function toneFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return TONES[h % TONES.length]
}

export function Avatar({
  name,
  size = 36,
  className = '',
}: {
  name: string
  size?: number
  className?: string
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${toneFor(name)} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {toInitials(name)}
    </span>
  )
}
