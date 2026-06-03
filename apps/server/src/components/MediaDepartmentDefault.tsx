'use client'

import { usePreferences } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

export function MediaDepartmentDefault() {
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedDept, setSelectedDept] = useState<string>('')
  const { getPreference, setPreference } = usePreferences()

  useEffect(() => {
    fetch('/api/departments?depth=0&limit=100')
      .then((r) => r.json())
      .then((data) => setDepartments(data.docs || []))
      .catch(console.error)

    getPreference('media-default-department').then((pref: any) => {
      if (pref?.value) setSelectedDept(String(pref.value))
    })
  }, [getPreference])

  const handleSet = async () => {
    if (!selectedDept) return
    await setPreference('media-default-department', { value: parseInt(selectedDept, 10) })
  }

  const handleClear = async () => {
    setSelectedDept('')
    await setPreference('media-default-department', { value: null })
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 0' }}>
      <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Default Department:</label>
      <select
        value={selectedDept}
        onChange={(e) => setSelectedDept(e.target.value)}
        style={{
          padding: '6px 10px',
          fontSize: '0.85rem',
          borderRadius: 4,
          border: '1px solid var(--theme-elevation-200, #ccc)',
        }}
      >
        <option value="">Select...</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button
        onClick={handleSet}
        style={{
          padding: '6px 14px',
          fontSize: '0.85rem',
          borderRadius: 4,
          border: '1px solid var(--theme-elevation-200, #ccc)',
          background: 'var(--theme-primary-500, #2563eb)',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        Set
      </button>
      {selectedDept && (
        <button
          onClick={handleClear}
          style={{
            padding: '6px 14px',
            fontSize: '0.85rem',
            borderRadius: 4,
            border: '1px solid var(--theme-elevation-200, #ccc)',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      )}
    </div>
  )
}
