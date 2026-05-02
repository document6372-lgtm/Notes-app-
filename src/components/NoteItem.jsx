import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── Icons ────────────────────────────────────────────────
const DragIcon = () => (
  <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
    <circle cx="4" cy="3" r="1.4" fill="currentColor"/>
    <circle cx="8" cy="3" r="1.4" fill="currentColor"/>
    <circle cx="4" cy="8" r="1.4" fill="currentColor"/>
    <circle cx="8" cy="8" r="1.4" fill="currentColor"/>
    <circle cx="4" cy="13" r="1.4" fill="currentColor"/>
    <circle cx="8" cy="13" r="1.4" fill="currentColor"/>
  </svg>
)

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5.5 6v4.5M8.5 6v4.5M3 3.5l.7 8a.5.5 0 00.5.5h5.6a.5.5 0 00.5-.5l.7-8"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// ─── NoteItem ─────────────────────────────────────────────
export default function NoteItem({ item, onDelete, isDragging, isOverlay }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: item.id, disabled: isOverlay })

  const style = isOverlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isSortableDragging ? 0.35 : 1,
      }

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      className={`note-item ${isDragging ? 'dragging' : ''}`}
    >
      {/* Drag handle */}
      <div
        className="item-drag-handle"
        {...(isOverlay ? {} : attributes)}
        {...(isOverlay ? {} : listeners)}
        title="Drag to reorder"
      >
        <DragIcon />
      </div>

      {/* Body */}
      <div className="item-body">
        {/* Type badge */}
        <div className={`item-type-badge ${item.type}`}>
          {item.type === 'text' ? (
            <>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <rect x="0" y="0" width="10" height="1.8" rx=".9"/>
                <rect x="0" y="3" width="7.5" height="1.8" rx=".9"/>
                <rect x="0" y="6" width="9" height="1.8" rx=".9"/>
              </svg>
              Text
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x=".7" y=".7" width="8.6" height="8.6" rx="1.5"/>
                <circle cx="3.2" cy="3.5" r="1"/>
                <path d="M.7 7l2.8-2.8L6 6.7l1.5-1.5L9.3 7"/>
              </svg>
              Image
            </>
          )}
        </div>

        {/* Content */}
        {item.type === 'text' && (
          <div className="item-text-content">{item.content}</div>
        )}

        {item.type === 'image' && item.image_url && (
          <img
            src={item.image_url}
            alt="Note image"
            className="item-image-content"
            loading="lazy"
            onError={e => { e.target.style.display = 'none' }}
          />
        )}

        {item.type === 'image' && !item.image_url && (
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
            Image not available
          </div>
        )}
      </div>

      {/* Actions */}
      {!isOverlay && (
        <div className="item-actions">
          <button
            className="item-action-btn danger"
            title="Delete item"
            onClick={() => onDelete(item.id)}
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  )
}
