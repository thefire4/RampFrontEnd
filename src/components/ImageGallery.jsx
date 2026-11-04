import { useEffect, useRef, useState } from 'react'

// Sketch and image thumbnails, plus a full-size viewer with previous/next/close.
// `images` is a list of { id, file_name, url }.

function ImageFallback({ name, large = false }) {
  return (
    <div className={`image-fallback${large ? ' image-fallback-large' : ''}`} role="img" aria-label={`${name} could not be loaded`}>
      <span aria-hidden="true">🖼</span>
      <span>Image unavailable</span>
    </div>
  )
}

// Keeps its own "failed" state, so a broken image only affects itself
function SafeImage({ image, large = false, ...props }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <ImageFallback name={image.file_name} large={large} />
  return <img src={image.url} alt={image.file_name} onError={() => setFailed(true)} {...props} />
}

function ImageViewer({ images, index, onChange, onClose }) {
  const image = images[index]
  const many = images.length > 1
  const closeRef = useRef(null)

  const go = (step) => onChange((index + step + images.length) % images.length)

  // Keyboard: Esc closes, arrow keys move between images
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && many) onChange((index + 1) % images.length)
      else if (e.key === 'ArrowLeft' && many) onChange((index - 1 + images.length) % images.length)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, images.length, many, onChange, onClose])

  // Focus the close button when the viewer opens, and stop the page behind it from scrolling
  useEffect(() => {
    closeRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  return (
    <div className="viewer-backdrop" onClick={onClose}>
      <div
        className="viewer"
        role="dialog"
        aria-modal="true"
        aria-label={`${image.file_name} (${index + 1} of ${images.length})`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="viewer-bar">
          <span className="viewer-title">{image.file_name}</span>
          <span className="viewer-count">{index + 1} / {images.length}</span>
          <a href={image.url} target="_blank" rel="noreferrer" className="viewer-link">Open original</a>
          <button ref={closeRef} type="button" className="viewer-close" onClick={onClose} aria-label="Close viewer">
            ×
          </button>
        </div>

        <div className="viewer-stage">
          {many && (
            <button type="button" className="viewer-nav viewer-prev" onClick={() => go(-1)} aria-label="Previous image">
              ‹
            </button>
          )}
          <SafeImage key={image.id} image={image} large className="viewer-image" />
          {many && (
            <button type="button" className="viewer-nav viewer-next" onClick={() => go(1)} aria-label="Next image">
              ›
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ImageGallery({ images }) {
  const [openIndex, setOpenIndex] = useState(null)
  const thumbRefs = useRef([])

  function close() {
    const last = openIndex
    setOpenIndex(null)
    
    requestAnimationFrame(() => thumbRefs.current[last]?.focus())
  }

  if (images.length === 0) {
    return <div className="sketch-placeholder">No sketches or images uploaded yet</div>
  }

  return (
    <>
      <ul className="sketch-grid" aria-label="Sketches and images">
        {images.map((image, i) => (
          <li key={image.id}>
            <button
              ref={(el) => { thumbRefs.current[i] = el }}
              type="button"
              className="thumb"
              onClick={() => setOpenIndex(i)}
              aria-label={`Open ${image.file_name} full size`}
            >
              <SafeImage image={image} loading="lazy" />
              <span>{image.file_name}</span>
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null && (
        <ImageViewer images={images} index={openIndex} onChange={setOpenIndex} onClose={close} />
      )}
    </>
  )
}
