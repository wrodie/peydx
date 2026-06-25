'use client'

import { usePathname } from 'next/navigation'
import { useAuth, useConfig } from '@payloadcms/ui'
import { useEffect, useRef, useState } from 'react'

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function MediaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function ProgramsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function SchedulesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function RemoteControlIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function TopNavHeader() {
  const pathname = usePathname()
  const { user } = useAuth<any>()
  const { config } = useConfig()
  const [adminOpen, setAdminOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const accountDropdownRef = useRef<HTMLDivElement>(null)

  const adminRoute = config.routes?.admin || '/admin'
  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'manager'

  useEffect(() => {
    if (!adminOpen) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAdminOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [adminOpen])

  useEffect(() => {
    if (!accountOpen) return
    function handleClick(e: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [accountOpen])

  const isActive = (href: string) => {
    if (pathname === href) return true
    if (href !== adminRoute && pathname.startsWith(href + '/')) return true
    return false
  }

  const mainLinks = [
    { slug: 'home', label: 'Home', icon: HomeIcon, href: `${adminRoute}` },
    { slug: 'media', label: 'Media', icon: MediaIcon, href: `${adminRoute}/collections/media` },
    { slug: 'programs', label: 'Programs', icon: ProgramsIcon, href: `${adminRoute}/collections/programs` },
    { slug: 'schedule', label: 'Schedules', icon: SchedulesIcon, href: `${adminRoute}/collections/schedule` },
  ]

  const adminLinks = [
    { label: 'Departments', href: `${adminRoute}/collections/departments` },
    { label: 'Folders', href: `${adminRoute}/collections/folders` },
    { label: 'Users', href: `${adminRoute}/collections/users` },
    { label: 'Devices', href: `${adminRoute}/collections/devices` },
    { label: 'Integrations', href: `${adminRoute}/collections/integrations` },
    { label: 'Settings', href: `${adminRoute}/globals/settings` },
  ]

  return (
    <header className="top-nav-header">
      <div className="top-nav-header__inner">
        <nav className="top-nav-header__nav">
          {mainLinks.map((link) => (
            <a
              key={link.slug}
              href={link.href}
              className={`top-nav-header__link ${isActive(link.href) ? 'top-nav-header__link--active' : ''}`}
            >
              <link.icon />
              <span>{link.label}</span>
            </a>
          ))}

          <a
            href="/admin/remote"
            className={`top-nav-header__link ${isActive('/admin/remote') ? 'top-nav-header__link--active' : ''}`}
          >
            <RemoteControlIcon />
            <span>Remote Control</span>
          </a>

          {isAdmin && (
            <div className="top-nav-header__dropdown" ref={dropdownRef}>
              <button
                type="button"
                className={`top-nav-header__link top-nav-header__dropdown-toggle ${adminOpen ? 'top-nav-header__link--active' : ''}`}
                onClick={() => setAdminOpen(!adminOpen)}
              >
                <AdminIcon />
                <span>Admin</span>
                <ChevronDown />
              </button>
              {adminOpen && (
                <div className="top-nav-header__dropdown-menu">
                  {adminLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className={`top-nav-header__dropdown-item ${isActive(link.href) ? 'top-nav-header__dropdown-item--active' : ''}`}
                      onClick={() => setAdminOpen(false)}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {isManager && (
            <a
              href={`${adminRoute}/collections/users`}
              className={`top-nav-header__link ${isActive(`${adminRoute}/collections/users`) ? 'top-nav-header__link--active' : ''}`}
            >
              <UsersIcon />
              <span>Users</span>
            </a>
          )}

          <div className="top-nav-header__dropdown top-nav-header__account" ref={accountDropdownRef}>
            <button
              type="button"
              className={`top-nav-header__link top-nav-header__dropdown-toggle ${accountOpen ? 'top-nav-header__link--active' : ''}`}
              onClick={() => setAccountOpen(!accountOpen)}
            >
              <AccountIcon />
            </button>
            {accountOpen && (
              <div className="top-nav-header__dropdown-menu top-nav-header__dropdown-menu--right">
                <a
                  href={adminRoute + '/account'}
                  className="top-nav-header__dropdown-item"
                  onClick={() => setAccountOpen(false)}
                >
                  Account
                </a>
                <a
                  href={`${adminRoute}/logout`}
                  className="top-nav-header__dropdown-item"
                  onClick={() => setAccountOpen(false)}
                >
                  Logout
                </a>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
