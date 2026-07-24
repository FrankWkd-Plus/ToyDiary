import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pause,
  Play,
  Share2,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import {
  archivePhotos,
  companionDays,
  toyAvatar,
} from '../archive/archiveUtils'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'

export function MemoryHallPage() {
  const { id } = useParams()
  const { toys, currentToy, entries, setCurrentToyId, showToast } = useApp()
  const { prefs, updatePrefs } = useAuth()
  const toy = toys.find((item) => item.id === id)
  const [slide, setSlide] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [musicOn, setMusicOn] = useState(() => prefs.memorySound)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    setMusicOn(prefs.memorySound)
  }, [prefs.memorySound])
  // Wait until currentToy matches route id so we don't flash another toy's photos.
  const ready = Boolean(toy && currentToy?.id === toy.id)
  const photos = useMemo(
    () => (ready ? archivePhotos(entries) : []),
    [entries, ready],
  )

  useEffect(() => {
    if (toy && currentToy?.id !== toy.id) setCurrentToyId(toy.id)
  }, [currentToy?.id, setCurrentToyId, toy])

  useEffect(() => {
    if (!playing || photos.length < 2) return
    const timer = window.setInterval(
      () => setSlide((current) => (current + 1) % photos.length),
      3600,
    )
    return () => window.clearInterval(timer)
  }, [photos.length, playing])

  if (!toy) {
    return (
      <>
        <PageHeader title="回忆展厅" back="/archive" soft />
        <div className="px-4 py-16 text-center text-sm text-ink-muted">这段回忆暂时找不到了</div>
      </>
    )
  }

  const days = companionDays(toy)
  const toyName = toy.name
  const currentPhoto = photos[slide] || photos[0]
  const cities = Array.from(
    new Set(
      entries
        .map((entry) => entry.location)
        .filter((place): place is string => Boolean(place && place !== '家')),
    ),
  )
  const photoCount = entries.filter((entry) => entry.imageUrl).length

  function moveSlide(direction: number) {
    setSlide((current) => (current + direction + photos.length) % photos.length)
  }

  async function shareMemory() {
    const text = `我和 ${toyName} 已经认识 ${days} 天了。`
    if (navigator.share) {
      try {
        await navigator.share({ title: `${days} DAYS 陪伴纪念`, text, url: window.location.href })
        return
      } catch {
        return
      }
    }
    await navigator.clipboard?.writeText(`${text} ${window.location.href}`)
    showToast('纪念链接已复制')
  }

  async function saveMemoryCard() {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1350
    const context = canvas.getContext('2d')
    if (!context) return

    const image = new Image()
    image.src = currentPhoto.src.startsWith('http')
      ? '/toy-cards/highlight-1.jpg'
      : currentPhoto.src
    await image.decode()

    const gradient = context.createLinearGradient(0, 0, 1080, 1350)
    gradient.addColorStop(0, '#fff8e8')
    gradient.addColorStop(1, '#e8f5ee')
    context.fillStyle = gradient
    context.fillRect(0, 0, 1080, 1350)
    context.fillStyle = '#ffffff'
    context.roundRect(70, 70, 940, 1210, 48)
    context.fill()
    context.save()
    context.beginPath()
    context.roundRect(110, 110, 860, 720, 34)
    context.clip()
    const scale = Math.max(860 / image.width, 720 / image.height)
    const width = image.width * scale
    const height = image.height * scale
    context.drawImage(image, 110 + (860 - width) / 2, 110 + (720 - height) / 2, width, height)
    context.restore()
    context.fillStyle = '#4a433c'
    context.textAlign = 'center'
    context.font = '700 92px sans-serif'
    context.fillText(`${days} DAYS`, 540, 950)
    context.font = '500 34px sans-serif'
    context.fillText(`我和 ${toyName} 的陪伴纪念`, 540, 1015)
    context.fillStyle = '#6b635a'
    context.font = '28px sans-serif'
    context.fillText('谢谢你，把普通日子变成我们的纪念日。', 540, 1095)
    context.fillStyle = '#9a8758'
    context.font = '600 28px sans-serif'
    context.fillText('Toy Dairy · 把陪伴写进时间里', 540, 1205)

    const link = document.createElement('a')
    link.download = `Toy-Dairy-${days}-days.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    showToast('纪念卡片已保存')
  }

  return (
    <>
      <PageHeader title="回忆展厅" subtitle={`我和 ${toy.name} 的 ${days} 天`} back="/archive" soft />
      <main className="space-y-5 px-4 pb-5 pt-4">
        <section className="memory-stage">
          <img src={currentPhoto.src} alt={currentPhoto.title} />
          <div className="memory-stage__shade" />
          <div className="absolute inset-x-0 top-0 z-[2] flex items-center justify-between p-3">
            <span className="rounded-full bg-black/25 px-2.5 py-1 text-[9px] tracking-widest text-white backdrop-blur-sm">
              {slide + 1} / {photos.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setMusicOn((value) => {
                  const next = !value
                  updatePrefs({ memorySound: next })
                  showToast(next ? '已开启回忆展厅声音' : '已关闭回忆展厅声音')
                  return next
                })
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm"
              aria-label={musicOn ? '关闭背景音乐' : '开启背景音乐'}
            >
              {musicOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-[2] p-4 text-white">
            <p className="text-[10px] text-white/75">
              {currentPhoto.date} · {currentPhoto.location}
              {musicOn ? ' · ♪ 声音开' : ' · 静音'}
            </p>
            <h2 className="mt-1 font-display text-xl">{currentPhoto.title}</h2>
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-white/90">
              {currentPhoto.narration}
            </p>
          </div>
        </section>

        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={() => moveSlide(-1)} className="memory-control" aria-label="上一张">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            className="memory-control memory-control--main"
            aria-label={playing ? '暂停幻灯片' : '播放幻灯片'}
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
          </button>
          <button type="button" onClick={() => moveSlide(1)} className="memory-control" aria-label="下一张">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <section className="card-paper border border-line/60 p-4">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-matcha-deep">
            <Sparkles className="h-3.5 w-3.5" />
            自动生成的阶段回忆
          </span>
          <h2 className="mt-2 font-display text-xl text-ink">这 {days} 天，我们一起……</h2>
          <div className="mt-3 space-y-2 text-xs leading-6 text-ink-soft">
            <p>写下了 <strong className="text-ink">{entries.length}</strong> 次心事，留下了 <strong className="text-ink">{photoCount}</strong> 张照片。</p>
            <p>
              去过 <strong className="text-ink">{cities.length}</strong> 个地方
              {cities.length > 0 ? `：${cities.slice(0, 3).join('、')}。` : '，下一段旅程正在等待我们。'}
            </p>
            <p>你最常在 <strong className="text-ink">深夜 23:00</strong> 和我聊天，那是我们最安静的秘密时间。</p>
          </div>
        </section>

        <section className="memory-letter">
          <img src={toyAvatar(toy, toys.indexOf(toy))} alt="" className="h-12 w-12 rounded-2xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base text-ink">{toy.name} 写给你</p>
            <p className="mt-2 text-xs leading-6 text-ink-soft">
              “这 {days} 天里，我看过你开心，也陪过你难过。谢谢你每次出门都愿意把我装进包里。以后也让我继续待在你身边吧。”
            </p>
          </div>
        </section>

        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm"
        >
          <Sparkles className="h-4 w-4" />
          生成纪念卡片
        </button>
      </main>

      {shareOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 px-4 pb-4 backdrop-blur-[2px]" onClick={() => setShareOpen(false)}>
          <div className="w-full max-w-[358px] rounded-[1.75rem] bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-lg text-ink">纪念卡片</p>
                <p className="text-[10px] text-ink-muted">保存图片，或和朋友分享这份陪伴</p>
              </div>
              <button type="button" onClick={() => setShareOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-cream" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="memory-share-preview mt-3">
              <img src={currentPhoto.src} alt="" />
              <p className="mt-3 font-display text-3xl text-ink">{days} DAYS</p>
              <p className="mt-1 text-xs text-ink-soft">我和 {toy.name} 的陪伴纪念</p>
              <p className="mt-3 text-[10px] text-matcha-deep">Toy Dairy · 把陪伴写进时间里</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void saveMemoryCard()} className="flex items-center justify-center gap-1.5 rounded-xl bg-mist-soft py-2.5 text-xs font-semibold text-matcha-deep">
                <Download className="h-4 w-4" /> 保存图片
              </button>
              <button type="button" onClick={() => void shareMemory()} className="flex items-center justify-center gap-1.5 rounded-xl bg-mustard-soft py-2.5 text-xs font-semibold text-terra-deep">
                <Share2 className="h-4 w-4" /> 分享
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
