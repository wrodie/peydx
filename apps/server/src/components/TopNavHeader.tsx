'use client'

import { usePathname } from 'next/navigation'
import { useAuth, useConfig } from '@payloadcms/ui'
import { useEffect, useRef, useState } from 'react'
import {
  HomeIcon,
  PhotoLibraryIcon,
  SlideshowIcon,
  CalendarMonthIcon,
  RemoteGenIcon,
  SettingsIcon,
  PersonIcon,
  GroupIcon,
  KeyboardArrowDownIcon,
} from './icons'

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
    { slug: 'media', label: 'Media', icon: PhotoLibraryIcon, href: `${adminRoute}/collections/media` },
    { slug: 'programs', label: 'Programs', icon: SlideshowIcon, href: `${adminRoute}/collections/programs` },
    { slug: 'schedule', label: 'Schedules', icon: CalendarMonthIcon, href: `${adminRoute}/collections/schedule` },
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
            <RemoteGenIcon />
            <span>Remote Control</span>
          </a>

          {isAdmin && (
            <div className="top-nav-header__dropdown" ref={dropdownRef}>
              <button
                type="button"
                className={`top-nav-header__link top-nav-header__dropdown-toggle ${adminOpen ? 'top-nav-header__link--active' : ''}`}
                onClick={() => setAdminOpen(!adminOpen)}
              >
                <SettingsIcon />
                <span>Admin</span>
                <KeyboardArrowDownIcon />
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
              <GroupIcon />
              <span>Users</span>
            </a>
          )}

          <div className="top-nav-header__dropdown top-nav-header__account" ref={accountDropdownRef}>
            <button
              type="button"
              className={`top-nav-header__link top-nav-header__dropdown-toggle ${accountOpen ? 'top-nav-header__link--active' : ''}`}
              onClick={() => setAccountOpen(!accountOpen)}
            >
              <PersonIcon />
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
