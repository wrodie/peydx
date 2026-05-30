'use client'

export function RemoteNavLink() {
  return (
    <a
      href="/admin/remote"
      onClick={(e) => {
        e.preventDefault()
        window.location.href = '/admin/remote'
      }}
      style={{
        display: 'block',
        margin: '12px',
        padding: '10px 16px',
        textAlign: 'center',
        textDecoration: 'none',
        fontSize: '0.875rem',
        fontWeight: 600,
        color: '#fff',
        background: 'var(--theme-primary-500, #3b82f6)',
        borderRadius: 6,
        transition: 'background 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        ;(e.target as HTMLElement).style.background = 'var(--theme-primary-600, #2563eb)'
      }}
      onMouseLeave={(e) => {
        ;(e.target as HTMLElement).style.background = 'var(--theme-primary-500, #3b82f6)'
      }}
    >
      Remote Control
    </a>
  )
}
