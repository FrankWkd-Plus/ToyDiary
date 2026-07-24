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
  FileText,
  HelpCircle,
  Info,
  LayoutGrid,
  LogOut,
  Palette,
  Pencil,
  Share2,
  UserRound,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useApp } from '../context/AppContext'
import {
  loadProfileAvatar,
  loadProfileName,
  saveProfileAvatar,
  saveProfileName,
} from '../profile/profileStorage'
import { getToyVitality } from '../archive/toyVitality'
import { useTheme } from '../theme/ThemeProvider'

const DEFAULT_AVATAR = '/profile/default-avatar.jpg'

export function MePage() {
  const navigate = useNavigate()
  const { toys, entries, currentToy, showToast } = useApp()
  const { session, isLoggedIn, isGuest, logout } = useAuth()
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

  function exportGrowth() {
    const payload = {
      exportedAt: new Date().toISOString(),
      toys,
      entries,
      currentToyId: currentToy?.id ?? null,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `toydairy-growth-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('已导出成长轨迹 JSON')
  }

  function onLogout() {
    logout()
    showToast(isGuest ? '已退出随便看看' : '已退出登录')
    navigate('/login', { replace: true })
  }

  const displayId =
    session?.mode === 'user'
      ? session.account || '已登录'
      : isGuest
        ? '游客 · 随便看看'
        : '未登录'

  const currentVitality = currentToy
    ? getToyVitality(currentToy, entries)
    : null

  return (
    <div className="min-h-full">
      <div className="header-band pattern-soft px-4 pb-5 pt-4 sm:pb-6">
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
              {displayId} · {theme.name}
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

      {/* Stats banner — extra top space so it doesn't crowd the avatar */}
      <div className="mx-auto w-full max-w-lg space-y-3 px-4 pb-6 pt-6 sm:pt-7">
        <div className="card-paper px-1.5 py-4 shadow-[var(--shadow-warm)] sm:px-2 sm:py-5">
          <div className="grid grid-cols-4 gap-y-1 text-center">
            <Stat label="玩偶" value={String(toys.length)} to="/toys" highlight />
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
              sub={
                currentToy
                  ? `${currentVitality?.emoji ?? ''} ${currentToy.name}`.trim()
                  : undefined
              }
              to={
                isLoggedIn
                  ? currentToy
                    ? `/archive/toys/${currentToy.id}`
                    : '/toys/new'
                  : '/login'
              }
            />
          </div>
        </div>

        {/* A 快捷操作 */}
        <SectionCard title="快捷操作">
          <LinkRow
            to="/me/theme"
            icon={<Palette className="h-4 w-4" />}
            label="切换配色"
            hint={theme.name}
          />
          <button
            type="button"
            onClick={() => showToast('iOS 小组件即将开放')}
            className="flex min-h-12 w-full items-center gap-3 border-b border-line/70 px-4 py-3.5 text-left active:bg-cream"
          >
            <span className="text-matcha-deep">
              <LayoutGrid className="h-4 w-4" />
            </span>
            <span className="flex-1 text-sm text-ink">iOS 小组件</span>
            <span className="text-[10px] text-ink-muted">即将支持</span>
            <ChevronRight className="h-4 w-4 text-ink-muted" />
          </button>
          <button
            type="button"
            onClick={exportGrowth}
            className="flex min-h-12 w-full items-center gap-3 px-4 py-3.5 text-left active:bg-cream"
          >
            <span className="text-matcha-deep">
              <Share2 className="h-4 w-4" />
            </span>
            <span className="flex-1 text-sm text-ink">导出玩偶成长轨迹</span>
            <ChevronRight className="h-4 w-4 text-ink-muted" />
          </button>
        </SectionCard>

        {/* B 通知与声音 */}
        <SectionCard title="通知与声音">
          <LinkRow
            to="/me/notify"
            icon={<Bell className="h-4 w-4" />}
            label="玩偶提醒 / 日记 / 声音"
            hint="推送与回忆展厅"
          />
        </SectionCard>

        {/* C 版本信息 */}
        <SectionCard title="版本信息">
          <LinkRow
            to="/me/version"
            icon={<Info className="h-4 w-4" />}
            label="版本更新与介绍"
            hint="v0.1.0"
          />
        </SectionCard>

        {/* D 帮助中心 */}
        <SectionCard title="帮助中心">
          <LinkRow
            to="/help/docs"
            icon={<FileText className="h-4 w-4" />}
            label="使用文档"
          />
          <LinkRow
            to="/help/support"
            icon={<HelpCircle className="h-4 w-4" />}
            label="帮助与客服"
          />
          <LinkRow
            to="/help/about"
            icon={<Info className="h-4 w-4" />}
            label="关于我们"
            last
          />
        </SectionCard>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-rose-deep/30 bg-peach-soft/60 py-3.5 text-sm font-medium text-rose-deep transition-transform active:scale-[0.99]"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
        <p className="pb-2 text-center text-[10px] text-ink-muted">
          {isGuest
            ? '游客模式 · 退出后将回到登录页'
            : isLoggedIn
              ? '退出后需重新验证码登录'
              : '返回登录页'}
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
      className={`py-2.5 transition-colors sm:py-3 ${
        highlight ? 'rounded-2xl bg-mist-soft' : 'rounded-2xl active:bg-cream'
      }`}
    >
      <div className="font-display truncate px-1 text-xl leading-none text-matcha-deep">
        {sub ? (
          <span className="text-sm leading-7 text-ink">{sub}</span>
        ) : (
          value
        )}
      </div>
      <div className="mt-1 text-[11px] text-ink-muted">{label}</div>
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