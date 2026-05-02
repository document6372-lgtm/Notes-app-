import React, { useState, useEffect, useContext, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { ToastContext } from './NotesApp.jsx'

// ─── Create Note Modal ────────────────────────────────────
function CreateNoteModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const trimmed = title.trim()
    if (!trimmed) return
    setLoading(true)
    await onCreate(trimmed)
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">New Note</div>
        <div className="modal-body">Give your note a title to get started.</div>
        <input
          className="input-field"
          placeholder="e.g. Meeting notes, Recipe ideas…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
          maxLength={120}
        />
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!title.trim() || loading}
          >
            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
            Create Note
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────
function DeleteConfirmModal({ note, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Delete Note?</div>
        <div className="modal-body">
          "<strong>{note.title || 'Untitled'}</strong>" and all its content will be permanently deleted. This cannot be undone.
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={async () => {
            setLoading(true)
            await onConfirm()
            setLoading(false)
          }} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── NotesList ────────────────────────────────────────────
export default function NotesList({ onOpenNote }) {
  const toast = useContext(ToastContext)
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast('Failed to load notes: ' + error.message, 'error')
    } else {
      setNotes(data || [])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  const handleCreate = async (title) => {
    const { data, error } = await supabase
      .from('notes')
      .insert({ title, user_id: null })
      .select()
      .single()

    if (error) {
      toast('Failed to create note: ' + error.message, 'error')
      return
    }
    setShowCreate(false)
    toast('Note created!', 'success')
    onOpenNote(data)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    // Delete associated note items first (cascade may handle this but being explicit)
    await supabase.from('note_items').delete().eq('note_id', deleteTarget.id)

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', deleteTarget.id)

    if (error) {
      toast('Failed to delete note: ' + error.message, 'error')
    } else {
      toast('Note deleted', 'default')
      setNotes(prev => prev.filter(n => n.id !== deleteTarget.id))
    }
    setDeleteTarget(null)
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" style={{ width: 28, height: 28 }} />
        Loading your notes…
      </div>
    )
  }

  return (
    <>
      <div className="notes-list-header">
        <div>
          <div className="notes-list-title">
            Your <em>Notes</em>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 6 }}>
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          New Note
        </button>
      </div>

      <div className="notes-grid">
        {/* New note card shortcut */}
        <button
          className="note-card note-card-new"
          onClick={() => setShowCreate(true)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2v14M2 9h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          New Note
        </button>

        {notes.map(note => (
          <div
            key={note.id}
            className="note-card"
            onClick={() => onOpenNote(note)}
          >
            <div className="note-card-title">{note.title || 'Untitled'}</div>
            <div className="note-card-meta">
              <span>{formatDate(note.created_at)}</span>
              <button
                className="note-card-delete"
                title="Delete note"
                onClick={e => { e.stopPropagation(); setDeleteTarget(note) }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5.5 6v4.5M8.5 6v4.5M3 3.5l.7 8a.5.5 0 00.5.5h5.6a.5.5 0 00.5-.5l.7-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {notes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✦</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>
            No notes yet
          </div>
          <div style={{ fontSize: 13 }}>Create your first note to get started.</div>
        </div>
      )}

      {showCreate && (
        <CreateNoteModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          note={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}
