'use client'

import Link from 'next/link'
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
  MenuIcon,
  CloseIcon,
} from './icons'

export function TopNavHeader() {
  const pathname = usePathname()
  const { user } = useAuth<any>()
  const { config } = useConfig()
  const [adminOpen, setAdminOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const accountDropdownRef = useRef<HTMLDivElement>(null)

  const adminRoute = config.routes?.admin || '/admin'
  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'manager'

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!drawerOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [drawerOpen])

  useEffect(() => {
    if (!adminOpen && !accountOpen) return
    function handleClick(e: MouseEvent) {
      if (adminOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAdminOpen(false)
      }
      if (accountOpen && accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [adminOpen, accountOpen])

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
    { label: 'Updates', href: `${adminRoute}/globals/settings` },
    { label: 'Device Health Dashboard', href: `${adminRoute}/health` },
  ]

  const closeDrawer = () => setDrawerOpen(false)

  return (
    <>
      <div
        className={`top-nav-header__overlay${drawerOpen ? ' top-nav-header__overlay--open' : ''}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <div className={`top-nav-header__drawer${drawerOpen ? ' top-nav-header__drawer--open' : ''}`}>
        <div className="top-nav-header__drawer-header">
          <span className="top-nav-header__drawer-title">Menu</span>
          <button
            type="button"
            className="top-nav-header__hamburger"
            onClick={closeDrawer}
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="top-nav-header__drawer-nav">
          {mainLinks.map((link) => (
            <Link
              key={link.slug}
              href={link.href}
              className={`top-nav-header__drawer-link${isActive(link.href) ? ' top-nav-header__drawer-link--active' : ''}`}
              onClick={closeDrawer}
            >
              <link.icon size={20} />
              {link.label}
            </Link>
          ))}
          <Link
            href={`${adminRoute}/remote`}
            className={`top-nav-header__drawer-link${isActive(`${adminRoute}/remote`) ? ' top-nav-header__drawer-link--active' : ''}`}
            onClick={closeDrawer}
          >
            <RemoteGenIcon size={20} />
            Remote Control
          </Link>
          {isAdmin && (
            <div className="top-nav-header__drawer-section">
              <div className="top-nav-header__drawer-section-title">Admin</div>
              {adminLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`top-nav-header__drawer-link${isActive(link.href) ? ' top-nav-header__drawer-link--active' : ''}`}
                  onClick={closeDrawer}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
          {isManager && (
            <div className="top-nav-header__drawer-section">
              <div className="top-nav-header__drawer-section-title">Management</div>
              <Link
                href={`${adminRoute}/collections/users`}
                className={`top-nav-header__drawer-link${isActive(`${adminRoute}/collections/users`) ? ' top-nav-header__drawer-link--active' : ''}`}
                onClick={closeDrawer}
              >
                <GroupIcon size={20} />
                Users
              </Link>
            </div>
          )}
          <div className="top-nav-header__drawer-section">
            <div className="top-nav-header__drawer-section-title">Account</div>
            <Link
              href={`${adminRoute}/account`}
              className="top-nav-header__drawer-link"
              onClick={closeDrawer}
            >
              <PersonIcon size={20} />
              Account
            </Link>
            <Link
              href={`${adminRoute}/logout`}
              className="top-nav-header__drawer-link"
              onClick={closeDrawer}
            >
              Logout
            </Link>
          </div>
        </nav>
      </div>
      <header className="top-nav-header">
        <div className="top-nav-header__inner">
          <nav className="top-nav-header__nav">
            <button
              type="button"
              className="top-nav-header__link top-nav-header__hamburger"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <MenuIcon size={20} />
            </button>
            {mainLinks.map((link) => (
              <Link
                key={link.slug}
                href={link.href}
                className={`top-nav-header__link ${isActive(link.href) ? 'top-nav-header__link--active' : ''}`}
              >
                <link.icon />
                <span>{link.label}</span>
              </Link>
            ))}
            <Link
              href={`${adminRoute}/remote`}
              className={`top-nav-header__link ${isActive(`${adminRoute}/remote`) ? 'top-nav-header__link--active' : ''}`}
            >
              <RemoteGenIcon />
              <span>Remote Control</span>
            </Link>
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
                      <Link
                        key={link.label}
                        href={link.href}
                        className={`top-nav-header__dropdown-item ${isActive(link.href) ? 'top-nav-header__dropdown-item--active' : ''}`}
                        onClick={() => setAdminOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isManager && (
              <Link
                href={`${adminRoute}/collections/users`}
                className={`top-nav-header__link ${isActive(`${adminRoute}/collections/users`) ? 'top-nav-header__link--active' : ''}`}
              >
                <GroupIcon />
                <span>Users</span>
              </Link>
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
                  <Link
                    href={adminRoute + '/account'}
                    className="top-nav-header__dropdown-item"
                    onClick={() => setAccountOpen(false)}
                  >
                    Account
                  </Link>
                  <Link
                    href={`${adminRoute}/logout`}
                    className="top-nav-header__dropdown-item"
                    onClick={() => setAccountOpen(false)}
                  >
                    Logout
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>
    </>
  )
}
