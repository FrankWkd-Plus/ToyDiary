import {
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import {
  Camera,
  Check,
  ChevronRight,
  Info,
  Palette,
  Pencil,
  Settings,
  Shield,
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
import { useTheme } from '../theme/ThemeProvider'

const DEFAULT_AVATAR = '/profile/default-avatar.jpg'

export function MePage() {
  const { toys, entries, currentToy, resetDemo, showToast } = useApp()
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

  return (
    <div className="min-h-full">
      <div className="header-band pattern-soft px-4 pb-5 pt-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="avatar-ring group relative h-[4.25rem] w-[4.25rem] shrink-0 rounded-full bg-gradient-to-br from-mustard-soft to-peach-soft transition-transform active:scale-95"
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
              ID: demo@toydairy · {theme.name}
            </p>
          </div>
          <Link
            to="/me/settings"
            className="flex h-10 items-center gap-1 rounded-full bg-paper px-2.5 text-matcha-deep shadow-[var(--shadow-warm-sm)] ring-1 ring-line/40 transition-transform active:scale-95"
            aria-label="个人资料设置"
            title="个人资料设置"
          >
            <UserRound className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            <span className="text-[10px] font-medium">资料</span>
          </Link>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4 -mt-1">
        <div className="card-paper px-2 py-4">
          <div className="grid grid-cols-4 text-center">
            <Stat
              label="玩偶"
              value={String(toys.length)}
              to="/toys"
              highlight
            />
            <Stat
              label="日记"
              value={String(entries.length)}
              to={currentToy ? '/growth/timeline' : '/growth'}
            />
            <Stat
              label="照片"
              value={String(entries.filter((e) => e.imageUrl).length)}
              to={currentToy ? '/growth/stats/moments' : '/growth'}
            />
            <Stat
              label="当前"
              value={currentToy ? '1' : '0'}
              sub={currentToy?.name}
              to={currentToy ? `/archive/toys/${currentToy.id}` : '/toys/new'}
            />
          </div>
        </div>

        <div className="card-paper overflow-hidden">
          <LinkRow
            to="/me/settings"
            icon={<Palette className="h-4 w-4" />}
            label="切换配色"
            hint={theme.name}
          />
          <LinkRow
            to="/me/settings"
            icon={<Settings className="h-4 w-4" />}
            label="设置"
          />
          <LinkRow
            to="/me/settings"
            icon={<Shield className="h-4 w-4" />}
            label="隐私设置"
          />
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="text-matcha-deep">
              <Info className="h-4 w-4" />
            </span>
            <span className="flex-1 text-sm text-ink">关于我们</span>
            <span className="text-xs text-ink-muted">Toy Dairy MVP</span>
          </div>
        </div>

        <div className="card-paper p-4 text-sm text-ink-soft">
          <p className="font-medium text-ink">前端 Mock 说明</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-ink-muted">
            <li>数据存在浏览器 localStorage</li>
            <li>接口对齐 plan.md</li>
            <li>图片仅本地预览，未接 R2</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={async () => {
            await resetDemo()
            showToast('演示数据已重置')
          }}
          className="btn-secondary w-full py-3 text-sm"
        >
          重置演示数据
        </button>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  to,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  to?: string
  highlight?: boolean
}) {
  const body = (
    <div
      className={`py-2 transition-colors ${
        highlight ? 'rounded-2xl bg-mist-soft' : 'rounded-2xl active:bg-cream'
      }`}
    >
      <div className="font-display truncate px-1 text-xl text-matcha-deep">
        {sub ? (
          <span className="text-sm leading-7 text-ink">{sub}</span>
        ) : (
          value
        )}
      </div>
      <div className="mt-0.5 text-[11px] text-ink-muted">{label}</div>
    </div>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="block px-1 transition-transform active:scale-95"
        aria-label={`查看${label}`}
      >
        {body}
      </Link>
    )
  }

  return body
}

function LinkRow({
  to,
  icon,
  label,
  hint,
}: {
  to: string
  icon: ReactNode
  label: string
  hint?: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-b border-line/70 px-4 py-3.5 active:bg-cream"
    >
      <span className="text-matcha-deep">{icon}</span>
      <span className="flex-1 text-sm text-ink">{label}</span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
      <ChevronRight className="h-4 w-4 text-ink-muted" />
    </Link>
  )
}
