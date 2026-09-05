'use client'

import { useAuth } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { io, type Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from 'signage-core'
import { buildDeviceStatusPatch } from './deviceStatusPatch'
import { RepeatIcon } from './icons'
import { getThumbnailUrl, getBlockIcon } from '../utilities/ui/slideMedia'
import { DeviceStatusBadge } from './deviceStatus/DeviceStatusBadge'

function getDayLabel(dayBits: number): string[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const result: string[] = []
  for (let i = 0; i < 7; i++) {
    if (dayBits & (1 << i)) result.push(days[i])
  }
  return result
}

function getDateInTimezone(iso: string, tz: string): Date {
  const fmt = new Intl.DateTimeFormat('en', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  })
  const parts = fmt.formatToParts(new Date(iso))
  const y = Number(parts.find(p => p.type === 'year')!.value)
  const m = Number(parts.find(p => p.type === 'month')!.value)
  const d = Number(parts.find(p => p.type === 'day')!.value)
  return new Date(y, m - 1, d)
}

export function DashboardView() {
  const { user } = useAuth<any>()
  const pathname = usePathname()
  const [programs, setPrograms] = useState<any[]>([])
  const [upcomingPrograms, setUpcomingPrograms] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [serverTz, setServerTz] = useState('UTC')
  const [devicesError, setDevicesError] = useState<string | null>(null)
  const [programsError, setProgramsError] = useState<string | null>(null)
  const [schedulesError, setSchedulesError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const retry = () => setReloadToken((t) => t + 1)

  const renderErrorBanner = (message: string) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
        padding: '8px 12px',
        borderRadius: 6,
        background: 'rgba(239,68,68,0.1)',
        color: '#ef4444',
        fontSize: '0.8rem',
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={retry}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#ef4444',
          textDecoration: 'underline',
          fontSize: '0.8rem',
          padding: 0,
        }}
      >
        Retry
      </button>
    </div>
  )

  useEffect(() => {
    let cancelled = false

    if (!user) return
    const deptIds = (user.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)
    const isAdmin = user.role === 'admin'
    const adminRoute = '/admin'

    const programQuery = isAdmin || deptIds.length === 0
      ? '/api/programs?depth=1&limit=100'
      : `/api/programs?depth=1&limit=100&where[folder.department][in]=${deptIds.join(',')}`

    const scheduleQuery = isAdmin || deptIds.length === 0
      ? '/api/schedule?depth=2&sort=startTime&limit=20'
      : `/api/schedule?depth=2&sort=startTime&limit=20&where[department][in]=${deptIds.join(',')}`

    const deviceQuery = isAdmin || deptIds.length === 0
      ? '/api/devices?depth=2&limit=100'
      : `/api/devices?depth=2&limit=100&where[departments][in]=${deptIds.join(',')}`

    const tzPromise = fetch('/api/timezone').then((r) => r.json())

    ;(async () => {
      try {
        const [tzRes, progResult, schedResult, devResult] = await Promise.allSettled([
          tzPromise,
          fetch(programQuery).then((r) => r.json()),
          fetch(scheduleQuery).then((r) => r.json()),
          fetch(deviceQuery).then((r) => r.json()),
        ])
        const serverTz = tzRes.status === 'fulfilled' ? tzRes.value.timezone || 'UTC' : 'UTC'
        setServerTz(serverTz)

        let progData: any = { docs: [] }
        let schedData: any = { docs: [] }
        let devData: any = { docs: [] }

        if (progResult.status === 'fulfilled') {
          progData = progResult.value
          setProgramsError(null)
        } else {
          setProgramsError('Failed to load programs')
        }
        if (schedResult.status === 'fulfilled') {
          schedData = schedResult.value
          setSchedulesError(null)
        } else {
          setSchedulesError('Failed to load schedules')
        }
        if (devResult.status === 'fulfilled') {
          devData = devResult.value
          setDevicesError(null)
        } else {
          setDevicesError('Failed to load devices')
        }

        if (cancelled) return

        const now = new Date()
        const todayLocal = getDateInTimezone(now.toISOString(), serverTz)
        const future = new Date(now.getTime() + 2 * 86400000)
        const twoDaysLocal = getDateInTimezone(future.toISOString(), serverTz)

        const available: any[] = []
        const upcoming: any[] = []

        for (const p of progData.docs || []) {
          const hasFrom = !!p.availableFrom
          const hasUntil = !!p.availableUntil
          if (!hasFrom && !hasUntil) continue

          const fromDate = hasFrom ? getDateInTimezone(p.availableFrom, serverTz) : null
          const untilDate = hasUntil ? getDateInTimezone(p.availableUntil, serverTz) : null

          const fromOk = !fromDate || fromDate <= todayLocal
          const untilOk = !untilDate || untilDate >= todayLocal
          if (fromOk && untilOk) {
            available.push(p)
            continue
          }

          if (fromDate && fromDate > todayLocal && fromDate <= twoDaysLocal) {
            upcoming.push(p)
          }
        }

        const progMap = new Map(
          (progData.docs || []).map((p: any) => [String(p.id), p.title])
        )

        const stateResults = await Promise.all(
          (devData.docs || []).map(async (d: any) => {
            try {
              const r = await fetch(`/api/device-state/${d.id}`)
              return r.ok ? await r.json() : null
            } catch { return null }
          })
        )

        const mergedDevices = await Promise.all(
          (devData.docs || []).map(async (d: any, i: number) => {
            const state = stateResults[i]
            let programId: number | null = null

            if (state?.state === 'playing' && state.programId) {
              programId = state.programId
            } else if (d.currentProgram) {
              programId = typeof d.currentProgram === 'object' ? d.currentProgram.id : d.currentProgram
            }

            let currentProgramTitle: string | null = (progMap.get(String(programId)) as string) || null

            if (programId && !currentProgramTitle) {
              try {
                const r = await fetch(`/api/programs/${programId}?depth=0`)
                if (r.ok) currentProgramTitle = (await r.json()).title || null
                if (!currentProgramTitle) console.warn(`DashboardView: program ${programId} title not found (device ${d.id})`)
              } catch (e) {
                console.warn(`DashboardView: fetch failed for program ${programId} (device ${d.id})`, e)
              }
            }

            return { ...d, currentProgram: programId, currentProgramTitle }
          })
        )

        const upcomingSchedules = (schedData.docs || []).filter((s: any) => {
          if (s.daysOfWeek?.length) {
            if (s.untilDate) {
              const tz = s.untilDate_tz || serverTz
              const untilStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(s.untilDate))
              const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: serverTz }).format(now)
              if (untilStr < todayStr) return false
            }
            return true
          }
          if (s.endTime && new Date(s.endTime) < now) return false
          return true
        })

        setPrograms(available)
        setUpcomingPrograms(upcoming)
        setSchedules(upcomingSchedules)
        setDevices(mergedDevices)
        if (!cancelled) setLoading(false)
      } catch {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user, pathname, reloadToken])

  useEffect(() => {
    const deptIds = (user?.departments || []).map((d: any) => typeof d === 'object' ? d.id : d)

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(window.location.origin, { path: '/api/ws' })

    socket.on('device:status', (data: any) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === data.id
            ? { ...d, status: data.status, ...buildDeviceStatusPatch(data), currentProgram: data.programId ?? d.currentProgram, currentSlideIndex: data.slideIndex }
            : d
        )
      )
    })

    socket.on('device:stateChange', (data: any) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === data.id
            ? { ...d, lastHeartbeat: new Date().toISOString(), currentProgram: data.programId, currentSlideIndex: data.slideIndex ?? 0 }
            : d
        )
      )
    })

    return () => { socket.disconnect() }
  }, [])

  if (loading) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: '32px', maxWidth: '1200px', margin: '0 auto', color: 'var(--theme-text)' }}>
        Loading...
      </div>
    )
  }

  return (
    <div className="dash-outer" style={{ fontFamily: 'system-ui', padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Devices Section */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 16px 0', color: 'var(--theme-text)' }}>
          Devices ({devices.length})
        </h2>
        {devicesError && renderErrorBanner(devicesError)}
        {devices.length === 0 ? (
          <p style={{ color: 'var(--theme-elevation-500)', padding: '20px 0' }}>No devices in your departments</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {devices.map((d) => {
              const programName = d.currentProgramTitle || null
              return (
                <div
                  key={d.id}
                  className="dash-device-card"
                  style={{
                    width: '240px',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid var(--theme-elevation-200)',
                    background: 'var(--theme-elevation-50)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <DeviceStatusBadge lastHeartbeat={d.lastHeartbeat} showLabel />
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--theme-text)' }}>
                    {d.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)' }}>
                    Program: {programName || '--'}
                  </div>
                  <a
                    href={`/admin/remote?device=${d.id}`}
                    style={{
                      display: 'inline-block',
                      textAlign: 'center',
                      textDecoration: 'none',
                      marginTop: '4px',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background: 'var(--theme-primary-500, #2563eb)',
                      color: '#fff',
                    }}
                  >
                    Remote Control
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Available Programs Section */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 16px 0', color: 'var(--theme-text)' }}>
          Available Programs ({programs.length})
        </h2>
        {programsError && renderErrorBanner(programsError)}
        {programs.length === 0 ? (
          <p style={{ color: 'var(--theme-elevation-500)', padding: '20px 0' }}>No programs currently available</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {programs.map((p) => {
              const slides = p.slides || []
              let firstSlide = slides[0]
              if (firstSlide?.blockType === 'segmentBlock' && firstSlide.slides?.length) {
                firstSlide = firstSlide.slides[0]
              }
              const thumbnailUrl = getThumbnailUrl(firstSlide)
              const blockIcon = getBlockIcon(firstSlide?.blockType, 32)
              return (
                <a
                  key={p.id}
                  href={`/admin/collections/programs/${p.id}`}
                  className="prog-card"
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    width: '220px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid var(--theme-elevation-200)',
                    background: 'var(--theme-elevation-50)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '140px',
                      background: 'var(--theme-elevation-100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={p.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : blockIcon ? (
                      <span style={{ fontSize: '2rem' }}>{blockIcon}</span>
                    ) : (
                      <span style={{ color: 'var(--theme-elevation-400)', fontSize: '0.85rem' }}>No preview</span>
                    )}
                  </div>
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: 'var(--theme-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: '4px',
                      }}
                    >
                      {p.title}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{slides.length} slides</span>
                      {p.loop && (
                        <span style={{ fontSize: '0.75rem', background: 'var(--theme-elevation-100)', padding: '1px 6px', borderRadius: '4px' }}>                        <RepeatIcon size={14} /></span>
                      )}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </section>

      {/* Upcoming Programs Section */}
      {upcomingPrograms.length > 0 && (
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 16px 0', color: 'var(--theme-text)' }}>
          Upcoming Programs ({upcomingPrograms.length})
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {upcomingPrograms.map((p) => {
              const slides = p.slides || []
              let firstSlide = slides[0]
              if (firstSlide?.blockType === 'segmentBlock' && firstSlide.slides?.length) {
                firstSlide = firstSlide.slides[0]
              }
              const thumbnailUrl = getThumbnailUrl(firstSlide)
              const blockIcon = getBlockIcon(firstSlide?.blockType, 32)
              return (
                <a
                  key={p.id}
                  href={`/admin/collections/programs/${p.id}`}
                  className="prog-card"
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    width: '220px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid var(--theme-elevation-200)',
                    background: 'var(--theme-elevation-50)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '140px',
                      background: 'var(--theme-elevation-100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={p.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : blockIcon ? (
                      <span style={{ fontSize: '2rem' }}>{blockIcon}</span>
                    ) : (
                      <span style={{ color: 'var(--theme-elevation-400)', fontSize: '0.85rem' }}>No preview</span>
                    )}
                  </div>
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: 'var(--theme-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: '4px',
                      }}
                    >
                      {p.title}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{slides.length} slides</span>
                      {p.loop && (
                        <span style={{ fontSize: '0.75rem', background: 'var(--theme-elevation-100)', padding: '1px 6px', borderRadius: '4px' }}>                        <RepeatIcon size={14} /></span>
                      )}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
      </section>
      )}

      {/* Upcoming Automated Schedules */}
      {(schedules.length > 0 || schedulesError) && (
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 16px 0', color: 'var(--theme-text)' }}>
          Upcoming Automated Schedules ({schedules.length})
        </h2>
        {schedulesError && renderErrorBanner(schedulesError)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {schedules.map((s) => {
              const deviceNames = (s.devices || []).map((d: any) => d.name || `Device ${d.id}`).join(', ')
              const dayLabels = (s.daysOfWeek || []).map((d: string) => d.charAt(0).toUpperCase() + d.slice(1))
              const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-AU'
              const fmtOpts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
              return (
                <a
                  key={s.id}
                  href={`/admin/collections/schedule/${s.id}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--theme-elevation-200)',
                    background: 'var(--theme-elevation-50)',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--theme-text)', marginBottom: '4px' }}>
                      {s.program?.title || `Program ${s.program?.id || '?'}`}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-500)' }}>
                      {deviceNames ? `Devices: ${deviceNames}` : 'No devices assigned'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {dayLabels.length > 0 && dayLabels.map((day: string) => (
                      <span
                        key={day}
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: '12px',
                          background: 'var(--theme-elevation-100)',
                          color: 'var(--theme-elevation-700)',
                        }}
                      >
                        {day}
                      </span>
                    ))}
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--theme-text)', whiteSpace: 'nowrap' }}>
                      {s.startTime ? (s.daysOfWeek?.length
                        ? `${new Date(s.startTime).toLocaleString(locale, { hour: '2-digit', minute: '2-digit', timeZone: s.startTime_tz || serverTz })} – ${new Date(s.endTime || s.startTime).toLocaleString(locale, { hour: '2-digit', minute: '2-digit', timeZone: s.endTime_tz || serverTz })}`
                        : `${new Date(s.startTime).toLocaleString(locale, { ...fmtOpts, timeZone: s.startTime_tz || serverTz })} – ${new Date(s.endTime || s.startTime).toLocaleString(locale, { ...fmtOpts, timeZone: s.endTime_tz || serverTz })}`
                      ) : '––'}
                    </span>
                  </div>
                </a>
              )
            })}
          </div>
      </section>
      )}
    </div>
  )
}
