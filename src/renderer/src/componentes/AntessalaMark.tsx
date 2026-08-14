import type { SVGProps } from 'react'

/** Marca provisória herdada; a composição não define fila física nem prioridade. */
export function AntessalaMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" fill="none" {...props}>
      <circle cx="20" cy="20" r="7" fill="currentColor" />
      <path
        d="M8 48c0-7 5.4-12 12-12s12 5 12 12"
        fill="currentColor"
      />
      <circle cx="38" cy="22" r="6" stroke="currentColor" strokeWidth="3.5" opacity=".55" />
      <path
        d="M28 48c0-6 4.5-10.5 10-10.5S48 42 48 48"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity=".55"
      />
      <circle cx="53" cy="24" r="5" stroke="currentColor" strokeWidth="3" opacity=".28" />
      <path
        d="M45 48c0-5 3.6-8.5 8-8.5s8 3.5 8 8.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".28"
      />
    </svg>
  )
}
