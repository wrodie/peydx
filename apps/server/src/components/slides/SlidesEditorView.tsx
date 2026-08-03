'use client'

import '@fontsource/inter/400.css'
import '@fontsource/inter/700.css'
import '@fontsource/lora/400.css'
import '@fontsource/lora/700.css'
import '@fontsource/roboto-mono/400.css'

import { useDocumentInfo, useField, useListDrawer } from '@payloadcms/ui'
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { SlideDesign, SlideElement } from './editor/types'
import { createEmptyDesign, normalizeDesign, createElement as createElementFactory, duplicateElement, alignToCanvas, type Alignment } from './editor/designJson'
import { useMediaImage, imageCache } from './editor/useMediaImage'
import { captureRender, uploadRender } from './editor/useCapture'
import { useEditHistory } from './editor/useEditHistory'
import { Toolbar } from './editor/Toolbar'
import { FloatingToolbar } from './editor/FloatingToolbar'

const CanvasStage = dynamic(() => import('./editor/CanvasStage'), { ssr: false })

function ImagePreloader({ mediaId }: { mediaId: number }) {
  useMediaImage(mediaId)
  return null
}

export function SlidesEditorView({ path }: { path: string }) {
  const { id } = useDocumentInfo()

  const { value: designJsonValue, setValue: setDesignJson } = useField<SlideDesign>({ path })
  const { value: renderValue, setValue: setRender } = useField<number>({ path: 'render' })
  const { value: titleValue } = useField<string>({ path: 'title' })

  const [design, setDesign] = useState<SlideDesign>(() =>
    normalizeDesign(designJsonValue) || createEmptyDesign(),
  )
  const { pushState, undo, redo, canUndo, canRedo } = useEditHistory(
    normalizeDesign(designJsonValue) || createEmptyDesign(),
  )
  const [capturing, setCapturing] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingText, setEditingText] = useState<SlideElement | null>(null)
  const [browseField, setBrowseField] = useState<string | null>(null)
  const stageRef = useRef<any>(null)
  const transformerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [visScale, setVisScale] = useState(0.5)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const resize = () => {
      const available = container.clientWidth - 40
      setVisScale(Math.min(1, available / 1920))
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (designJsonValue) {
      setDesign(normalizeDesign(designJsonValue))
    }
  }, [designJsonValue])

  const allMediaIds = useMemo(() => {
    const ids = new Set<number>()
    if (design.background.imageMediaId) ids.add(design.background.imageMediaId)
    for (const el of design.elements) {
      if (el.type === 'image' && el.imageData?.mediaId) {
        ids.add(el.imageData.mediaId)
      }
    }
    return [...ids]
  }, [design])

  const filterOptions = useMemo(() => ({
    media: { mimeType: { contains: 'image' } },
  }), [])

  const [ListDrawer, , { openDrawer, closeDrawer }] = useListDrawer({
    collectionSlugs: ['media'],
    filterOptions,
  })

  const handleElementChange = useCallback((id: string, partial: Partial<SlideElement>) => {
    setDesign((prev) => {
      const elements = prev.elements.map((el) =>
        el.id === id ? { ...el, ...partial } as SlideElement : el,
      )
      const newDesign = { ...prev, elements }
      setDesignJson(newDesign)
      pushState(newDesign)
      return newDesign
    })
  }, [setDesignJson, pushState])

  const handleSelect = useCallback((id: string) => {
    setSelectedIds([id])
    setEditingText(null)
  }, [])

  const handleStageClick = useCallback(() => {
    setSelectedIds([])
    setEditingText(null)
  }, [])

  const handleTextEdit = useCallback((el: SlideElement) => {
    setEditingText(el)
    setSelectedIds([])
  }, [])

  const addElement = useCallback((type: SlideElement['type'], mediaId?: number) => {
    setDesign((prev) => {
      const el = createElementFactory(type)
      if (mediaId !== undefined && el.imageData) {
        el.imageData.mediaId = mediaId
      }
      el.zIndex = prev.elements.length
      const elements = [...prev.elements, el]
      const newDesign = { ...prev, elements }
      setDesignJson(newDesign)
      pushState(newDesign)
      return newDesign
    })
    setSelectedIds([])
  }, [setDesignJson, pushState])

  const handleAddImage = useCallback(() => {
    setBrowseField('image')
    openDrawer()
  }, [openDrawer])

  const handleListSelect = useCallback(({ doc }: { doc: any }) => {
    if (doc.id) {
      addElement('image', doc.id)
    }
    setBrowseField(null)
    closeDrawer()
  }, [addElement, closeDrawer])

  const deleteSelected = useCallback(() => {
    setDesign((prev) => {
      const elements = prev.elements.filter((el) => !selectedIds.includes(el.id))
      elements.forEach((el, i) => { el.zIndex = i })
      const newDesign = { ...prev, elements }
      setDesignJson(newDesign)
      pushState(newDesign)
      return newDesign
    })
    setSelectedIds([])
  }, [selectedIds, setDesignJson, pushState])

  const duplicateSelected = useCallback(() => {
    setDesign((prev) => {
      const newElements: SlideElement[] = []
      for (const el of prev.elements) {
        newElements.push(el)
        if (selectedIds.includes(el.id)) {
          newElements.push(duplicateElement(el))
        }
      }
      newElements.forEach((el, i) => { el.zIndex = i })
      const newDesign = { ...prev, elements: newElements }
      setDesignJson(newDesign)
      pushState(newDesign)
      return newDesign
    })
  }, [selectedIds, setDesignJson, pushState])

  const moveZOrder = useCallback((direction: 'forward' | 'backward' | 'front' | 'back') => {
    setDesign((prev) => {
      const elements = [...prev.elements]
      for (const id of selectedIds) {
        const idx = elements.findIndex((el) => el.id === id)
        if (idx < 0) continue
        const [el] = elements.splice(idx, 1)
        switch (direction) {
          case 'front':
            elements.push(el)
            break
          case 'back':
            elements.unshift(el)
            break
          case 'forward':
            elements.splice(Math.min(idx + 1, elements.length), 0, el)
            break
          case 'backward':
            elements.splice(Math.max(idx - 1, 0), 0, el)
            break
        }
      }
      elements.forEach((el, i) => { el.zIndex = i })
      const newDesign = { ...prev, elements }
      setDesignJson(newDesign)
      pushState(newDesign)
      return newDesign
    })
  }, [selectedIds, setDesignJson, pushState])

  const alignSelected = useCallback((alignment: Alignment) => {
    setDesign((prev) => {
      const elements = prev.elements.map((el) =>
        selectedIds.includes(el.id)
          ? alignToCanvas(el, alignment, 1920, 1080)
          : el,
      )
      const newDesign = { ...prev, elements }
      setDesignJson(newDesign)
      pushState(newDesign)
      return newDesign
    })
  }, [selectedIds, setDesignJson, pushState])

  const updateBackground = useCallback((bg: Partial<SlideDesign['background']>) => {
    setDesign((prev) => {
      const newDesign = { ...prev, background: { ...prev.background, ...bg } as SlideDesign['background'] }
      setDesignJson(newDesign)
      pushState(newDesign)
      return newDesign
    })
  }, [setDesignJson, pushState])

  const selectedElements = useMemo(() =>
    design.elements.filter((el) => selectedIds.includes(el.id)),
    [design.elements, selectedIds],
  )

  const handleCapture = useCallback(async () => {
    if (!stageRef.current) return
    setCapturing(true)
    setCaptureError(null)
    try {
      const blob = await captureRender(stageRef.current)
      const mediaId = await uploadRender(blob, titleValue || 'Slide', renderValue)
      setRender(mediaId)
    } catch (err: any) {
      setCaptureError(err.message || 'Capture failed')
    } finally {
      setCapturing(false)
    }
  }, [stageRef, titleValue, renderValue, setRender])

  if (!design) {
    return <div style={{ padding: 40, color: 'var(--theme-text)' }}>Loading slide editor...</div>
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px)',
        overflowY: 'auto',
        fontFamily: 'system-ui, sans-serif',
        color: 'var(--theme-text)',
        background: 'var(--theme-elevation-50)',
      }}
    >
      {/* Image preloader */}
      {allMediaIds.map((id) => (
        <ImagePreloader key={id} mediaId={id} />
      ))}

      <ListDrawer onSelect={handleListSelect} />

      <Toolbar
        selectedIds={selectedIds}
        canUndo={canUndo}
        canRedo={canRedo}
        capturing={capturing}
        captureError={captureError}
        hasElements={design.elements.length > 0}
        onAddText={() => addElement('text')}
        onAddShape={() => addElement('shape')}
        onAddImage={handleAddImage}
        onDuplicate={duplicateSelected}
        onDelete={deleteSelected}
        onUndo={() => { const prev = undo(); if (prev) { setDesign(prev); setDesignJson(prev) } }}
        onRedo={() => { const next = redo(); if (next) { setDesign(next); setDesignJson(next) } }}
        onMoveZOrder={moveZOrder}
        onAlign={alignSelected}
        onCapture={handleCapture}
      />

      {/* Editor area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <FloatingToolbar
          design={design}
          selectedElements={selectedElements}
          onElementChange={handleElementChange}
          onUpdateBackground={updateBackground}
          onDelete={deleteSelected}
        />
        {/* Canvas */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'center',
          background: 'var(--theme-elevation-200)',
          padding: '24px 0',
          alignItems: 'flex-start',
        }}>
          <CanvasStage
            design={design}
            visScale={visScale}
            imageCache={imageCache}
            selectedIds={selectedIds}
            editingTextId={editingText?.id ?? null}
            editingText={editingText}
            onSelect={handleSelect}
            onElementChange={handleElementChange}
            onTextEdit={handleTextEdit}
            onTextSave={(el, text) => {
              handleElementChange(el.id, {
                textData: { ...el.textData!, text },
              })
              setEditingText(null)
            }}
            onTextCancel={() => setEditingText(null)}
            onStageClick={handleStageClick}
            stageRef={stageRef}
            transformerRef={transformerRef}
          />
        </div>
      </div>
    </div>
  )
}
