import { useCallback, useRef, useState } from 'react'
import ReactCrop, {
  convertToPixelCrop,
  type Crop,
  type PixelCrop
} from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { createPortal } from 'react-dom'

const BANNER_ASPECT = 16 / 4

function getCroppedDataUrl(image: HTMLImageElement, crop: PixelCrop): string {
  const canvas = document.createElement('canvas')
  // Use getBoundingClientRect for accurate rendered dimensions on HiDPI screens
  const rect = image.getBoundingClientRect()
  const scaleX = image.naturalWidth / rect.width
  const scaleY = image.naturalHeight / rect.height

  canvas.width = Math.round(crop.width * scaleX)
  canvas.height = Math.round(crop.height * scaleY)

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  )
  return canvas.toDataURL('image/jpeg', 0.92)
}

export default function BannerCropModal({
  srcUrl,
  onConfirm,
  onCancel
}: {
  srcUrl: string
  onConfirm: (croppedDataUrl: string) => void
  onCancel: () => void
}): React.ReactElement {
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    // Pin the crop to the top of the image so the top is never lost
    const cropHeightPct = Math.min(100, (width / BANNER_ASPECT / height) * 100)
    const topCrop: Crop = { unit: '%', x: 0, y: 0, width: 100, height: cropHeightPct }
    setCrop(topCrop)
    setCompletedCrop(convertToPixelCrop(topCrop, width, height))
  }, [])

  function confirm(): void {
    const img = imgRef.current
    if (!img) return
    // If user never moved the crop, derive pixel crop from current % crop
    const pixelCrop =
      completedCrop ?? (crop ? convertToPixelCrop(crop, img.getBoundingClientRect().width, img.getBoundingClientRect().height) : null)
    if (!pixelCrop) {
      onConfirm(srcUrl)
      return
    }
    onConfirm(getCroppedDataUrl(img, pixelCrop))
  }

  return createPortal(
    <div className="crop-modal-backdrop" onClick={onCancel}>
      <div className="crop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="crop-modal-header">
          <h2 className="crop-modal-title">Crop cover photo</h2>
          <p className="muted small">Drag to reposition · Pull handles to resize</p>
        </div>
        <div className="crop-modal-body">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={BANNER_ASPECT}
            minHeight={30}
          >
            <img
              ref={imgRef}
              src={srcUrl}
              alt="Crop preview"
              className="crop-modal-img"
              onLoad={onImageLoad}
            />
          </ReactCrop>
        </div>
        <div className="crop-modal-footer">
          <button type="button" className="primary" onClick={confirm}>
            Apply
          </button>
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
