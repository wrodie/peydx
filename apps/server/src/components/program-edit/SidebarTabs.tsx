'use client'

import { useField, useDocumentInfo } from '@payloadcms/ui'
import { useState, type FC } from 'react'

type SidebarTabsProps = Record<string, never>

type Tab = {
  key: string
  label: string
}

const tabs: Tab[] = [
  { key: 'status', label: 'Status' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'devices', label: 'Devices' },
]

export const SidebarTabs: FC<SidebarTabsProps> = () => {
  const [activeTab, setActiveTab] = useState<string>('status')
  const { id } = useDocumentInfo()

  return (
    <div
      style={{
        borderTop: '1px solid var(--theme-elevation-200, #e5e7eb)',
        background: 'var(--theme-elevation-50, #f9fafb)',
      }}
    >
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--theme-elevation-200, #e5e7eb)',
          padding: '0 16px',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              fontSize: '0.8rem',
              fontWeight: activeTab === tab.key ? 600 : 400,
              color:
                activeTab === tab.key
                  ? 'var(--theme-primary-500, #3b82f6)'
                  : 'var(--theme-elevation-600, #4b5563)',
              background: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === tab.key
                  ? '2px solid var(--theme-primary-500, #3b82f6)'
                  : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '12px 16px' }}>
        {activeTab === 'status' && <StatusTab />}
        {activeTab === 'schedule' && <ScheduleTab />}
        {activeTab === 'devices' && <DevicesTab />}
      </div>
    </div>
  )
}

const StatusTab: FC = () => {
  const statusField = useField<string>({ path: 'status' })
  const loopField = useField<boolean>({ path: 'loop' })
  const autoBlackField = useField<boolean>({ path: 'autoBlackEndSlide' })
  const descField = useField<string>({ path: 'description' })
  const folderField = useField<number | string>({ path: 'folder' })

  const { id } = useDocumentInfo()

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 180 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.775rem' }}>
          Status
        </label>
        <select
          value={statusField.value || 'draft'}
          onChange={(e) => statusField.setValue(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '0.8rem',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 4,
          }}
        >
          <option value="draft">Draft</option>
          <option value="approved">Approved / Ready</option>
        </select>
      </div>

      <div style={{ minWidth: 180 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.775rem' }}>
          Description
        </label>
        <textarea
          value={descField.value || ''}
          onChange={(e) => descField.setValue(e.target.value)}
          rows={2}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '0.8rem',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 4,
            resize: 'vertical',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
          <input
            type="checkbox"
            checked={loopField.value || false}
            onChange={(e) => loopField.setValue(e.target.checked)}
          />
          Loop
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
          <input
            type="checkbox"
            checked={autoBlackField.value !== false}
            onChange={(e) => autoBlackField.setValue(e.target.checked)}
          />
          Auto Black End Slide
        </label>
      </div>

      <div style={{ minWidth: 180 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.775rem' }}>
          Folder
        </label>
        <input
          type="number"
          value={
            folderField.value
              ? typeof folderField.value === 'object'
                ? (folderField.value as any).id || ''
                : folderField.value
              : ''
          }
          onChange={(e) => {
            const val = e.target.value
            folderField.setValue(val ? Number(val) : null)
          }}
          placeholder="Folder ID"
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '0.8rem',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 4,
          }}
        />
      </div>

      {id && (
        <div style={{ minWidth: 150 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.775rem' }}>
            Preview
          </label>
          <a
            href={`/preview/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              background: 'var(--theme-elevation-800, #1a1a1a)',
              color: 'var(--theme-elevation-100, #e0e0e0)',
              border: '1px solid var(--theme-elevation-400, #444)',
              borderRadius: 4,
              textDecoration: 'none',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            Open Preview
          </a>
        </div>
      )}
    </div>
  )
}

const ScheduleTab: FC = () => {
  const fromField = useField<string>({ path: 'availableFrom' })
  const untilField = useField<string>({ path: 'availableUntil' })

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 200 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.775rem' }}>
          Available From
        </label>
        <input
          type="date"
          value={fromField.value ? String(fromField.value).slice(0, 10) : ''}
          onChange={(e) => fromField.setValue(e.target.value ? `${e.target.value}T00:00:00.000Z` : null)}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '0.8rem',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 4,
          }}
        />
      </div>

      <div style={{ minWidth: 200 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.775rem' }}>
          Available Until
        </label>
        <input
          type="date"
          value={untilField.value ? String(untilField.value).slice(0, 10) : ''}
          onChange={(e) => untilField.setValue(e.target.value ? `${e.target.value}T00:00:00.000Z` : null)}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '0.8rem',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 4,
          }}
        />
        <div style={{ fontSize: '0.7rem', color: 'var(--theme-elevation-500, #6b7280)', marginTop: 2 }}>
          Leave blank for indefinite availability.
        </div>
      </div>
    </div>
  )
}

const DevicesTab: FC = () => {
  const devicesField = useField<number[]>({ path: 'availableDevices' })
  const [inputVal, setInputVal] = useState('')
  const devices = devicesField.value || []

  const addDevice = () => {
    const id = Number(inputVal.trim())
    if (inputVal.trim() && !isNaN(id) && !devices.includes(id)) {
      devicesField.setValue([...devices, id])
      setInputVal('')
    }
  }

  const removeDevice = (id: number) => {
    devicesField.setValue(devices.filter((d) => d !== id))
  }

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.775rem' }}>
        Available Devices
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--theme-elevation-500, #6b7280)', marginBottom: 8 }}>
        Devices that can manually select this program.
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addDevice()}
          placeholder="Device ID"
          style={{
            padding: '6px 8px',
            fontSize: '0.8rem',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 4,
            width: 120,
          }}
        />
        <button
          onClick={addDevice}
          style={{
            padding: '6px 12px',
            background: 'var(--theme-elevation-200, #e5e7eb)',
            border: '1px solid var(--theme-elevation-300, #d1d5db)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          Add
        </button>
      </div>

      {devices.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--theme-elevation-400, #9ca3af)' }}>
          No devices selected.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {devices.map((id) => (
            <span
              key={id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                background: 'var(--theme-elevation-100, #f3f4f6)',
                border: '1px solid var(--theme-elevation-200, #e5e7eb)',
                borderRadius: 16,
                fontSize: '0.8rem',
              }}
            >
              Device #{id}
              <button
                onClick={() => removeDevice(id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: 0,
                }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
