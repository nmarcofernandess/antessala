import type { SVGProps } from 'react'

export function FlowKitMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" fill="none" {...props}>
      <path
        d="M18 17h24c7 0 12 5 12 12v17"
        stroke="#7DD3FC"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 32h24"
        stroke="#4ADE80"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M18 47h20c9 0 16-7 16-16V17"
        stroke="#FACC15"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36 32l16 20"
        stroke="#38BDF8"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="18" cy="17" r="6" fill="#0F172A" stroke="#BAE6FD" strokeWidth="3" />
      <circle cx="18" cy="32" r="6" fill="#0F172A" stroke="#A7F3D0" strokeWidth="3" />
      <circle cx="18" cy="47" r="6" fill="#0F172A" stroke="#FDE68A" strokeWidth="3" />
      <circle cx="52" cy="17" r="6" fill="#0F172A" stroke="#7DD3FC" strokeWidth="3" />
      <circle cx="52" cy="47" r="6" fill="#0F172A" stroke="#FACC15" strokeWidth="3" />
      <circle cx="36" cy="32" r="5" fill="#E2E8F0" />
      <circle cx="36" cy="32" r="2" fill="#111827" />
    </svg>
  )
}
