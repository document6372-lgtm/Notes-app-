import React, { useState, useRef, useCallback } from 'react'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export default function AddItemPanel({ onAdd, saving }) {
  const [activeTab, setActiveTab] = useState('text') // 'text' | 'image'
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState('')

  const fileInputRef = useRef(null)

  // ── Text submit ───────────────────────────────────────────
  const handleAddText = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || saving) return
    await onAdd({ type: 'text', content: trimmed })
    setText('')
  }, [text, saving, onAdd])

  // ── Image handling ────────────────────────────────────────
  const processFile = (file) => {
    setFileError('')
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError('Please select a JPEG, PNG, WebP, or GIF image.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('File is too large. Maximum size is 10 MB.')
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e) => processFile(e.target.files[0])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    processFile(file)
  }

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  const handleAddImage = useCallback(async () => {
    if (!imageFile || saving) return
    await onAdd({ type: 'image', file: imageFile })
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [imageFile, saving, onAdd])

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setFileError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Keyboard shortcut ─────────────────────────────────────
  const handleTextKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleAddText()
    }
  }

  return (
    <div className="add-panel">
      <div className="add-panel-label">Add Block</div>

      {/* Tab switcher */}
      <div className="add-panel-tabs">
        <button
          className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTab('text')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect x="0" y="0" width="12" height="2.2" rx="1.1"/>
            <rect x="0" y="3.8" width="9" height="2.2" rx="1.1"/>
            <rect x="0" y="7.6" width="10.5" height="2.2" rx="1.1"/>
          </svg>
          Text
        </button>
        <button
          className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`}
          onClick={() => setActiveTab('image')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x=".7" y=".7" width="10.6" height="10.6" rx="1.8"/>
            <circle cx="3.8" cy="4.2" r="1.2"/>
            <path d=".7 8.5l3.3-3.4 2.7 2.8 1.8-1.8L11.3 8.5"/>
          </svg>
          Image
        </button>
      </div>

      {/* Text tab */}
      {activeTab === 'text' && (
        <>
          <textarea
            className="text-input-area"
            placeholder="Write your text block here… (⌘Enter to add)"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleTextKeyDown}
            rows={4}
          />
          <div className="add-panel-footer">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleAddText}
              disabled={!text.trim() || saving}
            >
              {saving
                ? <span className="spinner" style={{ width: 12, height: 12 }} />
                : <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
              }
              {saving ? 'Adding…' : 'Add Text'}
            </button>
          </div>
        </>
      )}

      {/* Image tab */}
      {activeTab === 'image' && (
        <>
          {!imagePreview ? (
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="upload-zone-icon">🖼</div>
              <div className="upload-zone-text">Click to upload or drag & drop</div>
              <div className="upload-zone-hint">JPEG, PNG, WebP, GIF · Max 10 MB</div>
            </div>
          ) : (
            <div className="upload-preview">
              <img src={imagePreview} alt="Preview" />
              <button className="upload-preview-remove" onClick={clearImage} title="Remove">✕</button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {fileError && (
            <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8 }}>
              {fileError}
            </div>
          )}

          <div className="add-panel-footer" style={{ marginTop: 12 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleAddImage}
              disabled={!imageFile || saving}
            >
              {saving
                ? <span className="spinner" style={{ width: 12, height: 12 }} />
                : <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
              }
              {saving ? 'Uploading…' : 'Add Image'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
