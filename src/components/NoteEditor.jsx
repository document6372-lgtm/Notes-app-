import React, { useState, useEffect, useContext, useCallback, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { supabase } from '../lib/supabase.js'
import { ToastContext } from './NotesApp.jsx'
import NoteItem from './NoteItem.jsx'
import AddItemPanel from './AddItemPanel.jsx'

// ─── PDF export ───────────────────────────────────────────
async function exportToPDF(note, items) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const PAGE_W = doc.internal.pageSize.getWidth()
  const PAGE_H = doc.internal.pageSize.getHeight()
  const MARGIN = 56
  const CONTENT_W = PAGE_W - MARGIN * 2
  let y = MARGIN

  const checkPageBreak = (neededHeight = 40) => {
    if (y + neededHeight > PAGE_H - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
  }

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(28, 25, 23)
  const titleLines = doc.splitTextToSize(note.title || 'Untitled', CONTENT_W)
  doc.text(titleLines, MARGIN, y)
  y += titleLines.length * 32 + 8

  // Date
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120, 113, 108)
  doc.text(new Date(note.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  }), MARGIN, y)
  y += 24

  // Divider
  doc.setDrawColor(228, 221, 208)
  doc.setLineWidth(0.8)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 24

  // Items
  for (const item of items) {
    if (item.type === 'text') {
      checkPageBreak(40)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(12)
      doc.setTextColor(28, 25, 23)
      const lines = doc.splitTextToSize(item.content || '', CONTENT_W)
      const blockH = lines.length * 18

      checkPageBreak(blockH)
      doc.text(lines, MARGIN, y)
      y += blockH + 20

    } else if (item.type === 'image' && item.image_url) {
      try {
        // Fetch image and convert to data URL
        const response = await fetch(item.image_url)
        const blob = await response.blob()
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })

        // Get image dimensions
        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = dataUrl
        })

        const maxW = CONTENT_W
        const maxH = 320
        let imgW = img.width
        let imgH = img.height

        if (imgW > maxW) { imgH = (imgH / imgW) * maxW; imgW = maxW }
        if (imgH > maxH) { imgW = (imgW / imgH) * maxH; imgH = maxH }

        checkPageBreak(imgH + 24)

        const format = dataUrl.includes('image/png') ? 'PNG' :
                       dataUrl.includes('image/webp') ? 'WEBP' : 'JPEG'
        doc.addImage(dataUrl, format, MARGIN, y, imgW, imgH)
        y += imgH + 24

      } catch (err) {
        console.warn('Could not load image for PDF:', err)
        checkPageBreak(24)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        doc.setTextColor(120, 113, 108)
        doc.text('[Image could not be loaded]', MARGIN, y)
        y += 24
      }
    }

    // Subtle separator between items
    if (items.indexOf(item) < items.length - 1) {
      checkPageBreak(24)
      doc.setDrawColor(240, 235, 228)
      doc.setLineWidth(0.4)
      doc.line(MARGIN + 40, y - 6, PAGE_W - MARGIN - 40, y - 6)
    }
  }

  // Footer on each page
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(168, 162, 158)
    doc.text(`${note.title || 'Note'} · Page ${i} of ${pageCount}`, MARGIN, PAGE_H - 28)
  }

  const safeName = (note.title || 'note').replace(/[^a-z0-9]/gi, '_').toLowerCase()
  doc.save(`${safeName}.pdf`)
}

// ─── NoteEditor ───────────────────────────────────────────
export default function NoteEditor({ note, onNoteUpdate, onBack }) {
  const toast = useContext(ToastContext)
  const [title, setTitle] = useState(note.title || '')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeId, setActiveId] = useState(null)

  const titleDebounceRef = useRef(null)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ── Load items ────────────────────────────────────────────
  useEffect(() => {
    const loadItems = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('note_items')
        .select('*')
        .eq('note_id', note.id)
        .order('position', { ascending: true })

      if (error) {
        toast('Failed to load items: ' + error.message, 'error')
      } else {
        setItems(data || [])
      }
      setLoading(false)
    }
    loadItems()
  }, [note.id, toast])

  // ── Auto-save title ───────────────────────────────────────
  const handleTitleChange = (val) => {
    setTitle(val)
    clearTimeout(titleDebounceRef.current)
    titleDebounceRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from('notes')
        .update({ title: val })
        .eq('id', note.id)
      if (!error) onNoteUpdate({ ...note, title: val })
    }, 700)
  }

  // ── Add item ──────────────────────────────────────────────
  const handleAddItem = useCallback(async (itemData) => {
    // itemData: { type, content?, file? }
    setSaving(true)

    try {
      let image_url = null

      if (itemData.type === 'image' && itemData.file) {
        const ext = itemData.file.name.split('.').pop()
        const path = `${note.id}/${Date.now()}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('note-images')
          .upload(path, itemData.file, { cacheControl: '3600', upsert: false })

        if (uploadErr) throw new Error('Image upload failed: ' + uploadErr.message)

        const { data: urlData } = supabase.storage
          .from('note-images')
          .getPublicUrl(path)

        image_url = urlData.publicUrl
      }

      const maxPos = items.length > 0
        ? Math.max(...items.map(i => i.position)) + 1
        : 0

      const { data, error } = await supabase
        .from('note_items')
        .insert({
          note_id: note.id,
          type: itemData.type,
          content: itemData.content || null,
          image_url,
          position: maxPos,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)

      setItems(prev => [...prev, data])
      toast('Item added', 'success')

    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }, [items, note.id, toast])

  // ── Delete item ───────────────────────────────────────────
  const handleDeleteItem = useCallback(async (itemId) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    // Delete from storage if image
    if (item.type === 'image' && item.image_url) {
      try {
        const url = new URL(item.image_url)
        const pathParts = url.pathname.split('/note-images/')
        if (pathParts[1]) {
          await supabase.storage.from('note-images').remove([pathParts[1]])
        }
      } catch (_) {}
    }

    const { error } = await supabase.from('note_items').delete().eq('id', itemId)
    if (error) {
      toast('Delete failed: ' + error.message, 'error')
      return
    }

    setItems(prev => {
      const updated = prev.filter(i => i.id !== itemId)
      // Reindex positions
      return updated.map((it, idx) => ({ ...it, position: idx }))
    })
    toast('Item removed', 'default')
  }, [items, toast])

  // ── DnD handlers ─────────────────────────────────────────
  const handleDragStart = ({ active }) => setActiveId(active.id)

  const handleDragEnd = useCallback(async ({ active, over }) => {
    setActiveId(null)
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      position: idx,
    }))

    setItems(reordered)

    // Batch update positions in Supabase
    const updates = reordered.map(item =>
      supabase.from('note_items').update({ position: item.position }).eq('id', item.id)
    )
    const results = await Promise.all(updates)
    const failed = results.find(r => r.error)
    if (failed) toast('Failed to save order', 'error')
  }, [items, toast])

  // ── Export PDF ────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (items.length === 0) {
      toast('Nothing to export — add some items first', 'default')
      return
    }
    setExporting(true)
    try {
      await exportToPDF({ ...note, title }, items)
      toast('PDF exported!', 'success')
    } catch (err) {
      toast('PDF export failed: ' + err.message, 'error')
    }
    setExporting(false)
  }

  // ── Active drag item ──────────────────────────────────────
  const activeItem = activeId ? items.find(i => i.id === activeId) : null

  // ── Render ────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="editor-header">
        <input
          className="editor-title-input"
          placeholder="Untitled note…"
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          maxLength={120}
        />
        <div className="editor-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportPDF}
            disabled={exporting || loading}
            title="Export as PDF"
          >
            {exporting
              ? <span className="spinner" style={{ width: 13, height: 13 }} />
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v8M4 6l3 3 3-3M2 11h10a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            }
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Add Item Panel */}
      <AddItemPanel onAdd={handleAddItem} saving={saving} />

      {/* Items */}
      {loading ? (
        <div className="loading-screen" style={{ padding: '40px 0' }}>
          <div className="spinner" />
          Loading items…
        </div>
      ) : items.length === 0 ? (
        <div className="items-empty">
          <div className="items-empty-icon">✦</div>
          <div className="items-empty-text">This note is empty</div>
          <div className="items-empty-hint">Add a text block or image above to get started.</div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="items-list">
              {items.map(item => (
                <NoteItem
                  key={item.id}
                  item={item}
                  onDelete={handleDeleteItem}
                  isDragging={item.id === activeId}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeItem && (
              <div className="drag-overlay-item">
                <NoteItem
                  item={activeItem}
                  onDelete={() => {}}
                  isOverlay
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Item count */}
      {items.length > 0 && (
        <div style={{ marginTop: 24, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
          {items.length} {items.length === 1 ? 'item' : 'items'} · Drag to reorder
        </div>
      )}
    </div>
  )
}
