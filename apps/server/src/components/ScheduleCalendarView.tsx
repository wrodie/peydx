'use client'

import { useAuth } from '@payloadcms/ui'
import { useEffect, useMemo, useState } from 'react'
import {
  buildBlocks,
  detectOverlaps,
  dayColumnLabel,
  priorityColor,
  positionFor,
  heightFor,
  dateStrInTz,
  weekdayMonIndex,
} from '../utilities/ui/scheduleCalendar'

const TIME_RANGES = [
  { label: '6:00 – 22:00', startHour: 6, endHour: 22 },
  { label: '0:00 – 24:00', startHour: 0, endHour: 24 },
  { label: '8:00 – 18:00', startHour: 8, endHour: 18 },
]

function weekRange(tz: string): { start: string; end: string } {
  const now = new Date()
  const monIdx = weekdayMonIndex(now, tz)
  const monday = new Date(now)
  monday.setDate(monday.getDate() - monIdx)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: dateStrInTz(monday, tz), end: dateStrInTz(sunday, tz) }
}

export function ScheduleCalendarView() {
  const { user } = useAuth<any>()
  const [schedules, setSchedules] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<number> | null>(null)
  const [timeRange, setTimeRange] = useState(TIME_RANGES[0])
  const [loading, setLoading] = useState(true)
  const [tz, setTz] = useState('UTC')

  const deptIds = (user?.departments || []).map((d: any) => (typeof d === 'object' ? d.id : d))
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [tzRes, schedRes, devRes] = await Promise.all([
          fetch('/api/timezone').then((r) => r.json()),
          fetch('/api/schedule?depth=2&limit=100').then((r) => r.json()),
          fetch('/api/devices?depth=0&limit=100').then((r) => r.json()),
        ])
        if (cancelled) return
        setTz(tzRes.timezone || 'UTC')
        setSchedules(schedRes.docs || [])
        const allDevices = devRes.docs || []
        setDevices(
          isAdmin || deptIds.length === 0
            ? allDevices
            : allDevices.filter((d: any) => {
                const devDepts = (d.departments || []).map((x: any) => (typeof x === 'object' ? x.id : x))
                return devDepts.some((id: number) => deptIds.includes(id))
              }),
        )
      } catch (err) {
        console.error('Failed to load schedule calendar', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const week = useMemo(() => weekRange(tz), [tz])

  const { blocks, oneOffs } = useMemo(
    () => buildBlocks(schedules, selectedDeviceIds, tz, week.start, week.end),
    [schedules, selectedDeviceIds, tz, week],
  )

  const overlappingIds = useMemo(() => detectOverlaps(blocks), [blocks])

  const hours: number[] = []
  for (let h = timeRange.startHour; h <= timeRange.endHour; h++) hours.push(h)

  const startHour = timeRange.startHour
  const totalMinutes = (timeRange.endHour - timeRange.startHour) * 60

  const adminRoute = '/admin'

  return (
    <div style={{ fontFamily: 'system-ui', padding: '24px 32px', color: 'var(--theme-text)' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Schedule Calendar</h2>
        <div style={{ flex: 1 }} />
        <select
          multiple
          size={Math.min(devices.length || 1, 4)}
          value={selectedDeviceIds ? [...selectedDeviceIds].map(String) : []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, (o) => Number(o.value))
            setSelectedDeviceIds(selected.length > 0 ? new Set(selected) : null)
          }}
          style={{
            minWidth: 160,
            padding: '6px 8px',
            fontSize: '0.8rem',
            border: '1px solid var(--theme-elevation-200, #ccc)',
            borderRadius: 4,
            background: 'var(--theme-input-bg, #fff)',
          }}
          title="Filter by device (Ctrl+click to select multiple)"
        >
          {devices.map((d: any) => (
            <option key={d.id} value={d.id}>
              {d.name || `Device ${d.id}`}
            </option>
          ))}
        </select>
        <select
          value={`${timeRange.startHour}-${timeRange.endHour}`}
          onChange={(e) => {
            const found = TIME_RANGES.find((t) => `${t.startHour}-${t.endHour}` === e.target.value)
            if (found) setTimeRange(found)
          }}
          style={{
            padding: '6px 8px',
            fontSize: '0.8rem',
            border: '1px solid var(--theme-elevation-200, #ccc)',
            borderRadius: 4,
            background: 'var(--theme-input-bg, #fff)',
          }}
        >
          {TIME_RANGES.map((t) => (
            <option key={`${t.startHour}-${t.endHour}`} value={`${t.startHour}-${t.endHour}`}>
              {t.label}
            </option>
          ))}
        </select>
        <a
          href={`${adminRoute}/collections/schedule/create`}
          style={{
            padding: '8px 16px',
            background: 'var(--theme-primary-500, #2563eb)',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 6,
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          + Create
        </a>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, fontSize: '0.75rem', color: 'var(--theme-elevation-600, #666)' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: priorityColor('normal'), marginRight: 4 }} /> Normal</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: priorityColor('high'), marginRight: 4 }} /> High</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: priorityColor('override'), marginRight: 4 }} /> Override</span>
        <span>↻ recurring</span>
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', color: 'var(--theme-elevation-500, #888)' }}>Loading schedules...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', border: '1px solid var(--theme-elevation-200, #e5e7eb)', borderRadius: 8, overflow: 'hidden' }}>
          <div />
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 600, fontSize: '0.8rem', borderBottom: '1px solid var(--theme-elevation-200, #e5e7eb)', borderLeft: '1px solid var(--theme-elevation-100, #f3f4f6)' }}>
              {dayColumnLabel(i)}
            </div>
          ))}

          <div style={{ position: 'relative', borderTop: '1px solid var(--theme-elevation-100, #f3f4f6)' }}>
            {hours.map((h) => (
              <div key={h} style={{ position: 'absolute', top: positionFor(h * 60, startHour), right: 6, fontSize: '0.65rem', color: 'var(--theme-elevation-400, #9ca3af)', transform: 'translateY(-50%)' }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {Array.from({ length: 7 }, (_, dayIndex) => (
            <div key={dayIndex} style={{ position: 'relative', height: totalMinutes, borderLeft: '1px solid var(--theme-elevation-100, #f3f4f6)', borderTop: '1px solid var(--theme-elevation-100, #f3f4f6)' }}>
              {hours.map((h) => (
                <div key={h} style={{ position: 'absolute', top: positionFor(h * 60, startHour), left: 0, right: 0, borderTop: '1px solid var(--theme-elevation-100, #f3f4f6)' }} />
              ))}
              {blocks
                .filter((b) => b.dayIndex === dayIndex)
                .map((b) => {
                  const overlapping = overlappingIds.has(b.id)
                  return (
                    <a
                      key={b.id}
                      href={`${adminRoute}/collections/schedule/${b.scheduleId}`}
                      title={`${b.title} — ${b.deviceName}`}
                      style={{
                        position: 'absolute',
                        left: 2,
                        right: 2,
                        top: positionFor(b.startMin, startHour),
                        height: heightFor(b.startMin, b.endMin),
                        background: priorityColor(b.priority),
                        color: '#fff',
                        fontSize: '0.68rem',
                        lineHeight: 1.2,
                        padding: '2px 4px',
                        borderRadius: 4,
                        overflow: 'hidden',
                        textDecoration: 'none',
                        boxSizing: 'border-box',
                        border: overlapping ? '2px dashed rgba(255,255,255,0.9)' : '2px solid transparent',
                        boxShadow: overlapping ? '0 0 0 2px #ef4444' : undefined,
                      }}
                    >
                      <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {b.isRecurring ? '↻ ' : ''}{b.title}
                      </div>
                      <div style={{ opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.deviceName}</div>
                    </a>
                  )
                })}
            </div>
          ))}
        </div>
      )}

      {!loading && oneOffs.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 8, color: 'var(--theme-text)' }}>One-time events (outside current week)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {oneOffs.map((b) => (
              <a
                key={b.id}
                href={`${adminRoute}/collections/schedule/${b.scheduleId}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--theme-elevation-200, #e5e7eb)',
                  textDecoration: 'none',
                  color: 'inherit',
                  fontSize: '0.8rem',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 2, background: priorityColor(b.priority), flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{b.title}</span>
                <span style={{ color: 'var(--theme-elevation-500, #888)' }}>{b.deviceName}</span>
                <span style={{ color: 'var(--theme-elevation-400, #9ca3af)', marginLeft: 'auto' }}>{b.oneOffDate}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
