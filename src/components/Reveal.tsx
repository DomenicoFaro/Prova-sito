import { useEffect, useRef, type ReactNode } from 'react'

/** Fa comparire il contenuto con una leggera animazione quando entra nel viewport. */
export function Reveal({
  children,
  className = '',
  ritardo = 0,
}: {
  children: ReactNode
  className?: string
  ritardo?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) {
      el.classList.add('visibile')
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('visibile')
            obs.unobserve(e.target)
          }
        }
      },
      { threshold: 0.12 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${ritardo}ms` }}>
      {children}
    </div>
  )
}
