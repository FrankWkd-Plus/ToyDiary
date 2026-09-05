import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Heart,
  ScrollText,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../api/client'
import { companionDayStatus, toyAvatar } from '../archive/archiveUtils'
import { seedPlaceForLabel, uniqueCities } from '../places/placeUtils'
import type { Entry } from '../types'
import { deleteAllPersistedDiaryPhotos } from '../media/photoStorage'

const COLLECTION_TOY_KEY = 'toydairy.me.collectionToyId'

export function MePage() {
  const navigate = useNavigate()
  const { toys, showToast } = useApp()
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [collectionToyId, setCollectionToyId] = useState(() => {
    try {
      return localStorage.getItem(COLLECTION_TOY_KEY) || ''
    } catch {
      return ''
    }
  })
  const [collectionEntries, setCollectionEntries] = useState<Entry[]>([])
  const collectionToy =
    toys.find((toy) => toy.id === collectionToyId) || toys[0] || null

  useEffect(() => {
    if (!toys.length) {
      setCollectionToyId('')
      setCollectionEntries([])
      return
    }
    if (toys.some((toy) => toy.id === collectionToyId)) return
    setCollectionToyId(toys[0].id)
    try {
      localStorage.setItem(COLLECTION_TOY_KEY, toys[0].id)
    } catch {
      /* local selection can safely fall back to this session */
    }
  }, [collectionToyId, toys])

  useEffect(() => {
    if (!collectionToy) {
      setCollectionEntries([])
      return
    }
    let cancelled = false
    void api.listEntries(collectionToy.id).then((list) => {
      if (!cancelled) setCollectionEntries(list)
    })
    return () => {
      cancelled = true
    }
  }, [collectionToy])

  const currentEntries = useMemo(
    () =>
      collectionEntries.filter((entry) => entry.toyId === collectionToy?.id),
    [collectionEntries, collectionToy?.id],
  )
  const companion = collectionToy ? companionDayStatus(collectionToy) : null
  const travelCount = currentEntries.filter(
    (entry) => entry.type === 'travel',
  ).length
  const cityCount = useMemo(() => {
    const places = currentEntries
      .map((entry) => entry.place || seedPlaceForLabel(entry.location))
      .filter((place): place is NonNullable<typeof place> => Boolean(place))
    return uniqueCities(places).length
  }, [currentEntries])
  const collectionToyIndex = toys.findIndex(
    (toy) => toy.id === collectionToy?.id,
  )

  function selectCollectionToy(id: string) {
    setCollectionToyId(id)
    try {
      localStorage.setItem(COLLECTION_TOY_KEY, id)
    } catch {
      /* local selection can safely fall back to this session */
    }
  }

  /** Wipe all Toy Diary records and native photo files, then start empty. */
  async function onFactoryReset() {
    if (
      !window.confirm(
        '将永久删除本机中的全部玩偶、日志、照片、对话和偏好设置。删除后无法恢复，建议先导出完整备份。继续？',
      )
    ) {
      return
    }
    if (
      !window.confirm(
        '再次确认：删除全部本地数据？此操作不可撤销。',
      )
    ) {
      return
    }
    setResetting(true)
    try {
      await deleteAllPersistedDiaryPhotos()
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('toydairy.')) keys.push(k)
      }
      for (const k of keys) localStorage.removeItem(k)
      sessionStorage.clear()
      // Full reload lets every provider rebuild from the now-empty local database.
      window.location.assign('/archive')
    } catch {
      setResetting(false)
      showToast('删除未完成，请重试；现有数据未被整体重置')
    }
  }

  return (
    /*
     * MePage renders its own gradient header band, so it should NOT inherit
     * the safe-area inset from `.page-scroll` (which would otherwise stack
     * two bands of empty space at the top). We negate that padding and pull
     * it back into the header band itself.
     */
    <div
      className="min-h-full"
      style={{ marginTop: 'calc(var(--safe-top) * -1)' }}
    >
      <div className="header-band pattern-soft px-5 pb-6 pt-[calc(var(--safe-top)+1.15rem)]">
        <div className="mx-auto flex w-full max-w-lg items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-wide text-ink">
              我的
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
              属于你和玩偶的私人收藏夹
            </p>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-matcha-deep shadow-[var(--shadow-warm-sm)] ring-1 ring-white/80">
            <Sparkles className="h-3.5 w-3.5 text-terra-deep" />
            TOY DIARY
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-6 pt-5">
        <Link
          to="/toys"
          state={{ from: 'me' }}
          className="group relative block overflow-hidden rounded-[1.5rem] border border-mint/70 bg-gradient-to-br from-mist-soft via-white to-mustard-soft p-4 shadow-[var(--shadow-warm)] transition-transform active:scale-[0.99]"
          aria-label={`查看我的玩偶，共 ${toys.length} 只`}
        >
          <span className="pointer-events-none absolute -right-7 -top-8 h-28 w-28 rounded-full bg-mustard-soft/80" />
          <span className="pointer-events-none absolute -bottom-10 left-12 h-24 w-24 rounded-full bg-mint/35" />

          <div className="relative flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 fill-peach text-rose-deep" />
                <h2 className="text-sm font-semibold tracking-wide text-ink">
                  我的玩偶
                </h2>
              </div>
              <p className="mt-1.5 text-[11px] text-ink-muted">
                管理每一位陪伴你的朋友
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/85 px-2.5 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-line/50">
              {toys.length} 只
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-active:translate-x-0.5" />
            </span>
          </div>

          <div className="relative mt-4 flex items-center gap-3 rounded-[1.15rem] bg-white/72 p-3 ring-1 ring-white/90">
            <div className="flex min-w-[4.5rem] -space-x-3">
              {toys.slice(0, 3).map((toy) => (
                <span
                  key={toy.id}
                  className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-mustard-soft to-mist-soft text-lg shadow-sm"
                >
                  <span aria-hidden="true">🧸</span>
                  {toy.avatarUrl && (
                    <img
                      src={toy.avatarUrl}
                      alt={toy.name}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                </span>
              ))}
              {toys.length === 0 && (
                <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-matcha/45 bg-white text-lg">
                  ＋
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {toys.length > 0
                  ? `收藏着 ${toys.length} 位玩偶朋友`
                  : '创建第一位玩偶朋友'}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                {toys.length > 0
                  ? toys.map((toy) => toy.name).join(' · ')
                  : '从一张角色卡开始你们的故事'}
              </p>
            </div>
          </div>
        </Link>

        <div className="flex items-end justify-between gap-3 px-1 pt-1">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-wide text-ink">
              {collectionToy ? `${collectionToy.name}的共同收藏` : '共同收藏'}
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              记录你们一起走过的日子
            </p>
          </div>
          {toys.length > 1 && (
            <button
              type="button"
              onClick={() => setCollectionPickerOpen(true)}
              className="flex shrink-0 items-center gap-1 rounded-full bg-white/85 px-2.5 py-1.5 text-[10px] font-semibold text-matcha-deep shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50 transition-transform active:scale-95"
              aria-haspopup="dialog"
              aria-expanded={collectionPickerOpen}
            >
              选择玩偶
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
        </div>

        <section className="overflow-hidden rounded-[1.45rem] border border-peach/60 bg-white shadow-[var(--shadow-warm)]">
          <button
            type="button"
            onClick={() =>
              navigate(
                collectionToy ? `/memories/${collectionToy.id}` : '/toys/new',
                { state: { from: 'me', toyId: collectionToy?.id } },
              )
            }
            className="relative flex min-h-[7.6rem] w-full items-center overflow-hidden bg-gradient-to-br from-[#fff8ef] via-mustard-soft/70 to-mist-soft/55 px-4 py-3.5 text-left active:opacity-90"
          >
            <span className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-white/45" />
            <div className="relative z-[1] min-w-0 flex-1 pr-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2 py-1 text-[9px] font-semibold text-terra-deep">
                <Sparkles className="h-3 w-3" />
                陪伴纪念
              </span>
              <p className="mt-2 text-[11px] font-medium text-ink-soft">
                {collectionToy && companion
                  ? companion.isFuture
                    ? `距离和 ${collectionToy.name} 相遇还有 ${companion.daysUntil} 天`
                    : `今天是我们认识的第 ${companion.days} 天`
                  : '从创建一位玩偶朋友开始'}
              </p>
              <p className="mt-0.5 truncate font-display text-[1.85rem] leading-none text-ink">
                {companion?.isFuture
                  ? 'COMING SOON'
                  : `${companion?.days ?? 0} DAYS`}
              </p>
              <span className="mt-2 inline-flex items-center text-[10px] font-semibold text-matcha-deep">
                {collectionToy ? '进入回忆展厅' : '创建玩偶'}
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <span className="relative z-[1] flex h-[5.2rem] w-[5.2rem] shrink-0 rotate-3 items-center justify-center overflow-hidden rounded-[1.35rem] border-4 border-white bg-white text-2xl shadow-md">
              <span aria-hidden="true">🧸</span>
              {collectionToy && (
                <img
                  src={toyAvatar(collectionToy, collectionToyIndex)}
                  alt={collectionToy.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
            </span>
          </button>

          <div className="grid grid-cols-4 border-t border-line/60 bg-white">
            <CompactMemoryStat
              icon="✈️"
              label="旅行"
              value={travelCount}
              unit="次"
              onClick={() =>
                navigate(collectionToy ? '/growth/stats/travel' : '/growth', {
                  state: { from: 'me', toyId: collectionToy?.id },
                })
              }
            />
            <CompactMemoryStat
              icon="🏙️"
              label="城市"
              value={cityCount}
              unit="座"
              onClick={() =>
                navigate(collectionToy ? '/growth/stats/cities' : '/growth', {
                  state: { from: 'me', toyId: collectionToy?.id },
                })
              }
            />
            <CompactMemoryStat
              icon="📖"
              label="记录"
              value={currentEntries.length}
              unit="条"
              onClick={() =>
                navigate(collectionToy ? '/growth/stats/moments' : '/growth', {
                  state: { from: 'me', toyId: collectionToy?.id },
                })
              }
            />
            <CompactMemoryStat
              icon="🖼️"
              label="照片"
              value={currentEntries.filter((entry) => entry.imageUrl).length}
              unit="张"
              last
              onClick={() =>
                navigate(collectionToy ? '/me/photos' : '/growth', {
                  state: { from: 'me', toyId: collectionToy?.id },
                })
              }
            />
          </div>
        </section>

        <SectionCard title="通用">
          <LinkRow
            to="/me/preferences"
            icon={<Settings2 className="h-4 w-4" />}
            label="偏好设置"
            hint="外观 · 正数日 · 本地备份"
          />
          <LinkRow
            to="/me/notify"
            icon={<Bell className="h-4 w-4" />}
            label="应用内提醒"
            hint="使用 App 时的玩偶卡片 · 声音"
            last
          />
        </SectionCard>

        <SectionCard title="隐私与条款">
          <LinkRow
            to="/legal/privacy"
            icon={<ShieldCheck className="h-4 w-4" />}
            label="隐私政策"
            hint="数据与权限说明"
          />
          <LinkRow
            to="/legal/terms"
            icon={<ScrollText className="h-4 w-4" />}
            label="使用条款"
            hint="服务使用约定"
            last
          />
        </SectionCard>

        <button
          type="button"
          onClick={() => void onFactoryReset()}
          disabled={resetting}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-line/80 bg-white py-3 text-sm font-medium text-ink-soft transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4 text-rose-deep" />
          {resetting ? '正在删除…' : '删除全部本地数据'}
        </button>
        <p className="pb-2 text-center text-[10px] leading-relaxed text-ink-muted">
          Toy Diary · 记录默认保存在本机
          <br />
          删除前请先在「偏好设置」中导出完整备份
        </p>
      </div>

      {collectionPickerOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/35 backdrop-blur-[2px]"
            onClick={() => setCollectionPickerOpen(false)}
          >
            <section
              className="composer-sheet flex max-h-[min(78dvh,38rem)] w-full max-w-[390px] flex-col rounded-t-[1.75rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-12px_40px_rgb(74_67_60_/_0.18)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="collection-toy-picker-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-line" aria-hidden="true" />
              <div className="flex shrink-0 items-center justify-between">
                <div>
                  <h2
                    id="collection-toy-picker-title"
                    className="font-display text-lg text-ink"
                  >
                    查看谁的收藏
                  </h2>
                  <p className="mt-0.5 text-[10px] text-ink-muted">
                    只切换本页收藏，不影响其他功能
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCollectionPickerOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-ink-muted"
                  aria-label="关闭玩偶选择"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 min-h-0 space-y-2 overflow-y-auto overscroll-contain pb-1">
                {toys.map((toy, index) => {
                  const selected = toy.id === collectionToy?.id
                  return (
                    <button
                      key={toy.id}
                      type="button"
                      onClick={() => {
                        selectCollectionToy(toy.id)
                        setCollectionPickerOpen(false)
                        showToast(`正在查看${toy.name}的共同收藏`)
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                        selected
                          ? 'border-matcha/50 bg-mist-soft/70'
                          : 'border-line/70 bg-cream/55'
                      }`}
                      aria-current={selected ? 'true' : undefined}
                    >
                      <img
                        src={toyAvatar(toy, index)}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-[0.9rem] border-2 border-white object-cover shadow-sm"
                      />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate font-display text-sm text-ink">
                          {toy.name}
                        </strong>
                        <span className="mt-1 block truncate text-[10px] text-ink-muted">
                          {toy.signature || toy.role || '一起收藏我们的故事'}
                        </span>
                      </span>
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          selected
                            ? 'bg-matcha text-white'
                            : 'border border-line bg-white text-transparent'
                        }`}
                        aria-label={selected ? '正在查看' : undefined}
                      >
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </div>
  )
}

function CompactMemoryStat({
  icon,
  label,
  value,
  unit,
  onClick,
  last,
}: {
  icon: string
  label: string
  value: number
  unit: string
  onClick: () => void
  last?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[4.6rem] px-2 py-2.5 text-center active:bg-cream/70 ${last ? '' : 'border-r border-line/60'}`}
      aria-label={`${label} ${value}${unit}`}
    >
      <span className="block text-[10px] text-ink-muted">
        {icon} {label}
      </span>
      <span className="mt-1 block font-display text-xl leading-none text-ink">
        {value}
        <small className="ml-0.5 font-sans text-[10px] text-ink-muted">{unit}</small>
      </span>
    </button>
  )
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="card-paper overflow-hidden">
      <div className="border-b border-line/70 px-4 py-2.5 text-xs font-medium text-ink-muted">
        {title}
      </div>
      {children}
    </section>
  )
}


function LinkRow({
  to,
  icon,
  label,
  hint,
  last,
}: {
  to: string
  icon: ReactNode
  label: string
  hint?: string
  last?: boolean
}) {
  return (
    <Link
      to={to}
      className={`flex min-h-12 items-center gap-3 px-4 py-3.5 active:bg-cream ${
        last ? '' : 'border-b border-line/70'
      }`}
    >
      <span className="text-matcha-deep">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{label}</span>
      {hint && (
        <span className="max-w-[40%] shrink-0 truncate text-xs text-ink-muted">
          {hint}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
    </Link>
  )
}
