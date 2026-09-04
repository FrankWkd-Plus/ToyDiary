import {
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  Camera,
  Check,
  ChevronRight,
  Pencil,
  ScrollText,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  loadProfileAvatar,
  loadProfileName,
  saveProfileAvatar,
  saveProfileName,
} from '../profile/profileStorage'
import { DayCountNumber } from '../components/DayCountNumber'
import { companionDays } from '../archive/archiveUtils'
import { useTheme } from '../theme/ThemeProvider'
import type { DayCountPalette } from '../daysmatter/dayCountTheme'

const DEFAULT_AVATAR = '/profile/default-avatar.jpg'

export function MePage() {
  const navigate = useNavigate()
  const { toys, entries, currentToy, showToast } = useApp()
  const { theme } = useTheme()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [profileName, setProfileName] = useState(() => loadProfileName())
  const [draftName, setDraftName] = useState(profileName)
  const [editingName, setEditingName] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(() =>
    loadProfileAvatar(DEFAULT_AVATAR),
  )

  function saveName() {
    const nextName = draftName.trim()
    if (!nextName) {
      showToast('昵称不能为空')
      return
    }
    setProfileName(nextName)
    setDraftName(nextName)
    setEditingName(false)
    saveProfileName(nextName)
    showToast('昵称已更新')
  }

  function onNameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') saveName()
    if (e.key === 'Escape') {
      setDraftName(profileName)
      setEditingName(false)
    }
  }

  function onAvatarSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast('头像图片请小于 3MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      setAvatarUrl(reader.result)
      try {
        saveProfileAvatar(reader.result)
      } catch {
        showToast('图片较大，头像可能无法长期保存')
        return
      }
      showToast('头像已更新')
    }
    reader.readAsDataURL(file)
  }

  /** Wipe all Toy Diary localStorage keys and hard-reload to factory defaults. */
  function onFactoryReset() {
    if (
      !window.confirm(
        '将清除本机全部 Toy Diary 数据（玩偶、日记、主题、正数日与对话记录等）。此操作不可撤销。继续？',
      )
    ) {
      return
    }
    if (
      !window.confirm(
        '再次确认：清空 localStorage 并重新加载？页面将回到首页。',
      )
    ) {
      return
    }
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('toydairy.')) keys.push(k)
      }
      for (const k of keys) localStorage.removeItem(k)
    } catch {
      try {
        localStorage.clear()
      } catch {
        /* ignore */
      }
    }
    // Full reload so ThemeProvider / Auth / mockStore all re-seed from empty storage
    window.location.assign('/archive')
  }

  const themeDayCountPalette: DayCountPalette =
    theme.id === 'warm' ? 'ink' : theme.id === 'mint' ? 'matcha' : theme.id

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
      <div className="header-band pattern-soft px-4 pb-5 pt-[calc(var(--safe-top)+1rem)] sm:pb-6">
        <div className="mx-auto flex w-full max-w-lg items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="avatar-ring group relative h-[4.25rem] w-[4.25rem] shrink-0 rounded-full bg-gradient-to-br from-mustard-soft to-peach-soft transition-transform active:scale-95 sm:h-[4.5rem] sm:w-[4.5rem]"
            aria-label="修改头像"
          >
            <img
              src={avatarUrl}
              alt={`${profileName}的头像`}
              className="h-full w-full rounded-full object-cover"
              onError={() => setAvatarUrl(DEFAULT_AVATAR)}
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-matcha text-white shadow-sm">
              <Camera className="h-3 w-3" />
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onAvatarSelected}
          />
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={draftName}
                  maxLength={16}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={onNameKeyDown}
                  className="min-w-0 flex-1 rounded-xl border border-matcha bg-white px-2.5 py-1.5 text-sm text-ink outline-none"
                  aria-label="新昵称"
                />
                <button
                  type="button"
                  onClick={saveName}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-matcha text-white"
                  aria-label="保存昵称"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(profileName)
                    setEditingName(false)
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream-dark text-ink-muted"
                  aria-label="取消修改昵称"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="flex max-w-full items-center gap-1.5 text-left"
                aria-label="修改昵称"
              >
                <h2 className="truncate font-medium text-ink">{profileName}</h2>
                <Pencil className="h-3.5 w-3.5 shrink-0 text-matcha-deep" />
              </button>
            )}
            <p className="mt-0.5 text-xs text-ink-muted">
              本地优先 · {theme.name}
            </p>
          </div>
          <Link
            to="/me/profile"
            className="flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-full bg-paper px-2.5 text-matcha-deep shadow-[var(--shadow-warm-sm)] ring-1 ring-line/40 transition-transform active:scale-95 sm:px-3"
            aria-label="资料"
            title="资料"
          >
            <UserRound className="h-[18px] w-[18px]" />
            <span className="hidden text-[10px] font-medium min-[360px]:inline">
              资料
            </span>
          </Link>
        </div>
      </div>

      {/* Stats banner — Days Matter style numbers */}
      <div className="mx-auto w-full max-w-lg space-y-3 px-4 pb-6 pt-6 sm:pt-7">
        <DayCountNumber
          value={currentToy ? companionDays(currentToy) : 0}
          label={
            currentToy ? `和 ${currentToy.name} 相遇` : '还没有玩偶'
          }
          unit="天"
          size="hero"
          style={{ palette: themeDayCountPalette }}
          photoUrl={entries.find((e) => e.imageUrl)?.imageUrl}
          sublabel="正数日"
          onClick={() => navigate('/days')}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <DayCountNumber
            value={toys.length}
            label="玩偶"
            unit="只"
            size="stat"
            onClick={() =>
              navigate('/toys', { state: { from: 'me' } })
            }
          />
          <DayCountNumber
            value={entries.length}
            label="日记"
            unit="篇"
            size="stat"
            onClick={() =>
              navigate(
                currentToy ? '/growth/stats/moments' : '/growth',
                { state: { from: 'me' } },
              )
            }
          />
          <DayCountNumber
            value={entries.filter((e) => e.imageUrl).length}
            label="照片"
            unit="张"
            size="stat"
            onClick={() =>
              navigate(currentToy ? '/me/photos' : '/growth', {
                state: { from: 'me' },
              })
            }
          />
          <DayCountNumber
            value={currentToy ? companionDays(currentToy) : 0}
            label="陪伴"
            unit="天"
            size="stat"
            onClick={() =>
              navigate(
                currentToy ? '/growth/stats/companion' : '/growth',
                { state: { from: 'me' } },
              )
            }
          />
        </div>

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
            label="通知设置"
            hint="玩偶提醒 · 日记 · 声音"
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
          onClick={onFactoryReset}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-line/80 bg-white py-3 text-sm font-medium text-ink-soft transition-transform active:scale-[0.99]"
        >
          <Trash2 className="h-4 w-4 text-rose-deep" />
          删除本地数据
        </button>
        <p className="pb-2 text-center text-[10px] leading-relaxed text-ink-muted">
          清除本机 Toy Diary 数据，包括玩偶、日记、主题、正数日与对话记录。
          删除前请先在「偏好设置」中导出完整备份。
        </p>
      </div>
    </div>
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
