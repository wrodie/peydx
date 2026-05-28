'use client'

import { useField } from '@payloadcms/ui'
import { useCallback, useState } from 'react'

const DEPT_COLORS: Record<string, string> = {
  children: '#f1c40f',
  signage: '#2ecc71',
  youth: '#3498db',
}

const DEPT_LABELS: Record<string, string> = {
  children: "Children's Ministry",
  signage: 'Digital Signage',
  youth: 'Youth Ministry',
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function toLocalDateStr(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

interface ScheduleEntry {
  id?: string
  program?: { id: number; title: string; durationMinutes?: number } | number
  startTime: string
  durationMinutes?: number
  department?: string
  createdBy?: string | number
}

function findOverlaps(entries: ScheduleEntry[]): Set<string> {
  const overlapping = new Set<string>()
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i]
    const sa = new Date(a.startTime).getTime()
    if (isNaN(sa)) continue
    const ea = sa + ((a.durationMinutes || 30) * 60 * 1000)
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j]
      const sb = new Date(b.startTime).getTime()
      if (isNaN(sb)) continue
      const eb = sb + ((b.durationMinutes || 30) * 60 * 1000)
      if (sa < eb && ea > sb) {
        overlapping.add(a.id || String(i))
        overlapping.add(b.id || String(j))
      }
    }
  }
  return overlapping
}

export function ScheduleCalendar() {
  const { value = [], setValue } = useField<ScheduleEntry[]>({ path: 'schedule' })
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const entries = Array.isArray(value) ? value : []
  const selDateStr = toLocalDateStr(selectedDate)

  const dayEntries = entries
    .filter((e) => {
      try { return new Date(e.startTime).toISOString().startsWith(selDateStr) } catch { return false }
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  const overlaps = findOverlaps(dayEntries)

  const prevDay = useCallback(() => {
    setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })
  }, [])
  const nextDay = useCallback(() => {
    setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })
  }, [])

  const handleSave = useCallback((entry: ScheduleEntry) => {
    if (editId) {
      setValue(entries.map((e) => (e.id === editId ? { ...e, ...entry } : e)))
    } else {
      setValue([...entries, entry])
    }
    setShowForm(false)
    setEditId(null)
  }, [entries, setValue, editId])

  const handleDelete = useCallback((entryId: string) => {
    setValue(entries.filter((e) => e.id !== entryId))
    setShowForm(false)
    setEditId(null)
  }, [entries, setValue])

  const editEntry = dayEntries.find((e) => e.id === editId)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, padding: '12px 0', borderBottom: '1px solid var(--theme-elevation-200, #333)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={prevDay} style={navBtnStyle}>&larr;</button>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--theme-elevation-800, #e0e0e0)' }}>
            {formatDate(selectedDate)}
          </span>
          <button type="button" onClick={nextDay} style={navBtnStyle}>&rarr;</button>
          <input
            type="date"
            value={selDateStr}
            onChange={(e) => { if (e.target.value) setSelectedDate(new Date(e.target.value + 'T00:00:00')) }}
            style={dateInputStyle}
          />
        </div>
        <button type="button" onClick={() => { setShowForm(true); setEditId(null) }} style={addBtnStyle}>
          + Add Program
        </button>
      </div>

      {showForm && (
        <EntryForm
          entry={editEntry || undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditId(null) }}
          onDelete={editId ? () => handleDelete(editId) : undefined}
        />
      )}

      {dayEntries.length === 0 && !showForm && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--theme-elevation-500, #666)', fontSize: '0.9rem' }}>
          No programs scheduled for this day.
        </div>
      )}

      {dayEntries.length > 0 && !showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {dayEntries.map((entry, idx) => {
            const startDate = new Date(entry.startTime)
            const dur = entry.durationMinutes || 30
            const isOverlap = overlaps.has(entry.id || String(idx))
            const deptColor = DEPT_COLORS[entry.department || 'signage'] || '#2ecc71'
            const programTitle = typeof entry.program === 'object' && entry.program !== null
              ? entry.program.title
              : `Program #${entry.program}`

            return (
              <div
                key={entry.id || idx}
                onClick={() => { setEditId(entry.id || null); setShowForm(true) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', cursor: 'pointer', borderRadius: 4,
                  border: isOverlap ? '1px solid rgba(220, 50, 50, 0.5)' : '1px solid var(--theme-elevation-300, #333)',
                  background: isOverlap ? 'rgba(220, 50, 50, 0.08)' : 'var(--theme-elevation-50, #111)',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
              >
                <div style={{ textAlign: 'center', minWidth: 48 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500, #666)' }}>
                    {formatTime(startDate)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--theme-elevation-500, #666)' }}>
                    &ndash;
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500, #666)' }}>
                    {formatTime(new Date(startDate.getTime() + dur * 60000))}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--theme-elevation-800, #e0e0e0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {programTitle}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    {entry.department && (
                      <span style={{
                        display: 'inline-block', padding: '1px 6px', borderRadius: 3,
                        background: deptColor, color: '#000', fontSize: '0.65rem', fontWeight: 600,
                      }}>
                        {DEPT_LABELS[entry.department] || entry.department}
                      </span>
                    )}
                    {isOverlap && (
                      <span style={{
                        display: 'inline-block', padding: '1px 6px', borderRadius: 3,
                        background: '#dc3232', color: '#fff', fontSize: '0.65rem', fontWeight: 600,
                      }}>
                        Overlap!
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--theme-elevation-500, #666)' }}>
                  {dur} min
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 16, padding: '8px 0', borderTop: '1px solid var(--theme-elevation-200, #333)', display: 'flex', gap: 12, fontSize: '0.75rem' }}>
        {Object.entries(DEPT_COLORS).map(([key, color]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--theme-elevation-600, #999)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
            {DEPT_LABELS[key] || key}
          </span>
        ))}
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'var(--theme-elevation-100, #1a1a1a)',
  border: '1px solid var(--theme-elevation-400, #444)',
  color: 'var(--theme-elevation-800, #e0e0e0)',
  borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: '0.9rem',
}

const addBtnStyle: React.CSSProperties = {
  background: 'var(--theme-elevation-800)',
  border: 'none',
  color: 'var(--theme-elevation-0, #fff)',
  borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
}

const dateInputStyle: React.CSSProperties = {
  marginLeft: 8, padding: '4px 8px', borderRadius: 4,
  border: '1px solid var(--theme-elevation-400, #444)',
  background: 'var(--theme-elevation-100, #1a1a1a)',
  color: 'var(--theme-elevation-800, #e0e0e0)',
  fontSize: '0.85rem',
}

function EntryForm({
  entry,
  onSave,
  onCancel,
  onDelete,
}: {
  entry?: ScheduleEntry
  onSave: (entry: ScheduleEntry) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [programId, setProgramId] = useState(
    entry?.program
      ? typeof entry.program === 'object'
        ? String((entry.program as any).id)
        : String(entry.program)
      : ''
  )
  const [startTime, setStartTime] = useState(() => {
    if (entry?.startTime) return entry.startTime.slice(0, 16)
    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0)
    return now.toISOString().slice(0, 16)
  })
  const [duration, setDuration] = useState(entry?.durationMinutes || 30)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!programId) return
    onSave({
      id: entry?.id,
      program: Number(programId),
      startTime: startTime + ':00.000Z',
      durationMinutes: duration,
    })
  }

  return (
    <div style={{
      marginBottom: 16, padding: 16,
      background: 'var(--theme-elevation-50, #111)',
      border: '1px solid var(--theme-elevation-300, #333)',
      borderRadius: 6,
    }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-600, #999)' }}>Program ID</label>
          <input
            type="number"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            placeholder="e.g. 123"
            required
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-600, #999)' }}>Start Time</label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-600, #999)' }}>Duration (min)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            min={1}
            max={480}
            style={{ ...inputStyle, width: 80 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button type="submit" style={addBtnStyle}>
            {entry ? 'Update' : 'Add'}
          </button>
          <button type="button" onClick={onCancel} style={navBtnStyle}>
            Cancel
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete} style={{ ...navBtnStyle, color: '#dc3232', borderColor: '#dc3232' }}>
              Remove
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 4,
  border: '1px solid var(--theme-elevation-400, #444)',
  background: 'var(--theme-elevation-0, #0d0d0d)',
  color: 'var(--theme-elevation-800, #e0e0e0)',
  fontSize: '0.85rem',
  width: 180,
}
