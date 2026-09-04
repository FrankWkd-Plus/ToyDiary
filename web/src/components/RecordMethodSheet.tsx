import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Image, PenLine, ScanText, X } from 'lucide-react'
import {
  Camera as NativeCamera,
  CameraDirection,
  MediaTypeSelection,
} from '@capacitor/camera'
import { Filesystem } from '@capacitor/filesystem'
import { useApp } from '../context/AppContext'
import { isNativeApp } from '../media/photoStorage'
import { recognizeImageText } from '../ocr/recognizeImageText'

export function RecordMethodSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { showToast } = useApp()
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [capturedPreview, setCapturedPreview] = useState<string>()

  async function nativePhotoToFile(uri: string, name: string) {
    const source = await Filesystem.readFile({ path: uri })
    if (typeof source.data !== 'string') throw new Error('读取照片失败')
    const bytes = Uint8Array.from(atob(source.data), (char) => char.charCodeAt(0))
    return new File([bytes], name, { type: 'image/jpeg' })
  }

  async function onNativePhotoSelected(source: 'gallery' | 'camera') {
    try {
      const options = {
        quality: 88,
        targetWidth: 2000,
        targetHeight: 2000,
        includeMetadata: true,
      }
      const result =
        source === 'camera'
          ? await NativeCamera.takePhoto({
              ...options,
              cameraDirection: CameraDirection.Rear,
            })
          : (await NativeCamera.chooseFromGallery({
              ...options,
              mediaType: MediaTypeSelection.Photo,
              allowMultipleSelection: false,
              limit: 1,
            })).results[0]
      if (!result?.uri || !result.webPath) return

      const file = await nativePhotoToFile(result.uri, `photo.${result.metadata?.format || 'jpg'}`)
      if (source === 'gallery') {
        onClose()
        navigate('/compose', {
          state: {
            mode: 'photo',
            imageUrl: result.webPath,
            imageFile: file,
            nativeImageUri: result.uri,
          },
        })
        return
      }

      setCapturedPreview(result.webPath)
      setOcrProgress(0)
      setOcrRunning(true)
      try {
        const ocrText = await recognizeImageText(file, ({ progress }) => {
          setOcrProgress(Math.max(0, Math.min(1, progress)))
        })
        onClose()
        navigate('/compose', {
          state: {
            mode: 'photo',
            imageUrl: result.webPath,
            imageFile: file,
            nativeImageUri: result.uri,
            ocrText,
            fromCamera: true,
          },
        })
      } catch {
        onClose()
        navigate('/compose', {
          state: {
            mode: 'photo',
            imageUrl: result.webPath,
            imageFile: file,
            nativeImageUri: result.uri,
            fromCamera: true,
          },
        })
        showToast('拍照完成，OCR 暂时未识别成功')
      } finally {
        setOcrRunning(false)
        setCapturedPreview(undefined)
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '打开相机失败，请重试')
    }
  }

  async function onImageSelected(
    e: ChangeEvent<HTMLInputElement>,
    source: 'gallery' | 'camera',
  ) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      showToast('图片请小于 12MB')
      return
    }

    const imageUrl = URL.createObjectURL(file)
    onClose()
    if (source === 'gallery') {
      navigate('/compose', { state: { mode: 'photo', imageUrl, imageFile: file } })
      return
    }

    setCapturedPreview(imageUrl)
    setOcrProgress(0)
    setOcrRunning(true)
    try {
      const ocrText = await recognizeImageText(file, ({ progress }) => {
        setOcrProgress(Math.max(0, Math.min(1, progress)))
      })
      navigate('/compose', {
        state: {
          mode: 'photo',
          imageUrl,
          imageFile: file,
          ocrText,
          fromCamera: true,
        },
      })
      showToast(
        ocrText ? '照片文字已识别，可在描述中修改' : '拍照完成，未识别到文字',
      )
    } catch {
      navigate('/compose', {
        state: { mode: 'photo', imageUrl, imageFile: file, fromCamera: true },
      })
      showToast('拍照完成，OCR 暂时未识别成功')
    } finally {
      setOcrRunning(false)
      setCapturedPreview(undefined)
    }
  }

  return (
    <>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void onImageSelected(event, 'gallery')}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void onImageSelected(event, 'camera')}
      />

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 backdrop-blur-[2px]"
          role="presentation"
          onClick={onClose}
        >
          <section
            className="composer-sheet w-full max-w-[390px] rounded-t-[1.75rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-12px_40px_rgb(74_67_60_/_0.18)]"
            role="dialog"
            aria-modal="true"
            aria-label="选择记录方式"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-line" />
            <div className="mt-3 flex items-center justify-between px-1">
              <div>
                <h2 className="font-display text-lg text-ink">记录这一刻</h2>
                <p className="mt-0.5 text-xs text-ink-muted">选择一种方式开始</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-cream-dark text-ink-muted"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <RecordChoice
                icon={<Image className="h-6 w-6" />}
                label="从相册选择"
                color="bg-mist-soft text-matcha-deep"
                onClick={() => {
                  if (isNativeApp()) void onNativePhotoSelected('gallery')
                  else galleryInputRef.current?.click()
                }}
              />
              <RecordChoice
                icon={
                  <span className="relative">
                    <Camera className="h-6 w-6" />
                    <ScanText className="absolute -bottom-2 -right-2 h-3.5 w-3.5 rounded bg-white" />
                  </span>
                }
                label="拍照记录"
                color="bg-peach-soft text-rose-deep"
                onClick={() => {
                  if (isNativeApp()) void onNativePhotoSelected('camera')
                  else cameraInputRef.current?.click()
                }}
              />
              <RecordChoice
                icon={<PenLine className="h-6 w-6" />}
                label="纯文字记录"
                color="bg-mustard-soft text-terra-deep"
                onClick={() => {
                  onClose()
                  navigate('/compose', { state: { mode: 'text' } })
                }}
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-full bg-cream-dark py-3 text-sm font-medium text-ink-soft active:opacity-80"
            >
              取消
            </button>
          </section>
        </div>
      )}

      {ocrRunning && capturedPreview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/55 px-5 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <section className="w-full max-w-[340px] rounded-[1.75rem] bg-white p-4 text-center shadow-2xl">
            <div className="ocr-preview">
              <img src={capturedPreview} alt="正在识别的照片" />
              <span className="ocr-scan-line" />
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-matcha-deep">
              <ScanText className="h-5 w-5" />
              <h2 className="font-display text-lg text-ink">正在识别照片文字</h2>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              首次使用会准备中文识别模型，请稍候
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-cream-dark">
              <span
                className="block h-full rounded-full bg-matcha transition-[width] duration-300"
                style={{ width: `${Math.max(6, Math.round(ocrProgress * 100))}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-ink-muted">
              {Math.round(ocrProgress * 100)}%
            </p>
          </section>
        </div>
      )}
    </>
  )
}

function RecordChoice({
  icon,
  label,
  color,
  onClick,
}: {
  icon: ReactNode
  label: string
  color: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl py-2 active:scale-95 transition-transform"
    >
      <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${color}`}>
        {icon}
      </span>
      <span className="whitespace-nowrap text-xs text-ink-soft">{label}</span>
    </button>
  )
}
