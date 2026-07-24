import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  HelpCircle,
  Info,
  Volume2,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { THEME_LIST, type ThemeId } from '../theme/themes'
import { useTheme } from '../theme/ThemeProvider'

/**
 * 个人资料设置（右上角「资料」）
 * 手机号 / 微信 / 设备管理
 */
export function ProfileSettingsPage() {
  const navigate = useNavigate()
  const { session, prefs, updatePrefs, logout, isLoggedIn } = useAuth()
  const { showToast } = useApp()
  const [phone, setPhone] = useState(
    () =>
      prefs.phone ||
      (session?.accountType === 'phone' ? session.account || '' : '') ||
      '',
  )
  const [wechat, setWechat] = useState(prefs.wechat || '')
  const [deviceLabel, setDeviceLabel] = useState(
    prefs.deviceLabel || '本机 · Safari / Chrome',
  )

  function saveField(patch: Partial<typeof prefs>, toast: string) {
    updatePrefs(patch)
    showToast(toast)
  }

  return (
    <>
      <PageHeader title="个人资料设置" back="/me" soft />
      <div className="space-y-3 px-4 py-4">
        {!isLoggedIn && (
          <div className="rounded-2xl bg-mustard-soft/80 px-3.5 py-3 text-xs text-terra-deep">
            当前为「随便看看」模式。绑定手机号/微信等能力需先
            <button
              type="button"
              className="mx-1 font-semibold underline"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              登录
            </button>
            。
          </div>
        )}

        <section className="card-paper space-y-3 p-4">
          <Field label="手机号">
            <input
              className="input !rounded-2xl"
              placeholder="未绑定"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => saveField({ phone }, '手机号已保存')}
              inputMode="numeric"
              maxLength={11}
            />
          </Field>
          <Field label="微信">
            <input
              className="input !rounded-2xl"
              placeholder="微信号 / 备注"
              value={wechat}
              onChange={(e) => setWechat(e.target.value)}
              onBlur={() => saveField({ wechat }, '微信信息已保存')}
              maxLength={40}
            />
          </Field>
          <Field label="设备管理">
            <input
              className="input !rounded-2xl"
              value={deviceLabel}
              onChange={(e) => setDeviceLabel(e.target.value)}
              onBlur={() => saveField({ deviceLabel }, '设备备注已保存')}
              maxLength={40}
            />
            <p className="mt-1 text-[10px] text-ink-muted">
              演示环境仅展示本机；正式版可管理多设备登录。
            </p>
          </Field>
        </section>

        {isLoggedIn && (
          <p className="px-1 text-center text-[11px] text-ink-muted">
            账号：{session?.account || '已登录'} · 本地演示会话
          </p>
        )}
      </div>
    </>
  )
}

/**
 * 切换配色 — 5 套主题实时生效
 */
export function ThemePickerPage() {
  const { themeId, setThemeId, theme } = useTheme()
  const { showToast } = useApp()

  function onPick(id: ThemeId) {
    if (id === themeId) return
    setThemeId(id)
    const name = THEME_LIST.find((t) => t.id === id)?.name ?? id
    showToast(`已切换为「${name}」`)
  }

  return (
    <>
      <PageHeader title="切换配色" back="/me" soft />
      <div className="mx-auto w-full max-w-lg space-y-3 px-4 py-4">
        <p className="px-1 text-xs text-ink-muted">
          当前：{theme.name} · 选择后立即应用到全站（抹茶绿 / 暖杏手帐 / 雾蓝晴空 /
          蜜桃粉 / 薰衣紫）
        </p>
        <div className="grid grid-cols-1 gap-2.5">
          {THEME_LIST.map((t) => {
            const active = t.id === themeId
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onPick(t.id)}
                className={`flex min-h-14 items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all ${
                  active
                    ? 'bg-mist-soft shadow-[var(--shadow-warm-sm)] ring-2 ring-matcha'
                    : 'bg-white ring-1 ring-line/50 active:bg-cream'
                }`}
              >
                <span className="flex shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5">
                  {t.swatches.map((c) => (
                    <span
                      key={c}
                      className="h-10 w-5 first:rounded-l-xl last:rounded-r-xl"
                      style={{ background: c }}
                    />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{t.name}</span>
                  <span className="block text-[11px] text-ink-muted">{t.desc}</span>
                </span>
                {active && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-matcha text-white">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

export function NotifySoundPage() {
  const { prefs, updatePrefs } = useAuth()
  const { showToast } = useApp()

  return (
    <>
      <PageHeader title="通知与声音" back="/me" soft />
      <div className="space-y-3 px-4 py-4">
        <section className="card-paper overflow-hidden">
          <ToggleRow
            icon={<Bell className="h-4 w-4" />}
            label="玩偶响应提醒"
            desc="玩偶想你、提到你时弹出轻提示，可跳转聊天"
            on={prefs.toyReminders}
            onChange={(v) => {
              updatePrefs({ toyReminders: v })
              showToast(v ? '已开启玩偶响应提醒' : '已关闭玩偶响应提醒')
            }}
          />
          <ToggleRow
            icon={<BookOpen className="h-4 w-4" />}
            label="日记提醒"
            desc="玩偶每日会发 push 提醒你写手帐（演示开关）"
            on={prefs.diaryPush}
            onChange={(v) => {
              updatePrefs({ diaryPush: v })
              showToast(v ? '已开启日记提醒' : '已关闭日记提醒')
            }}
          />
          <ToggleRow
            icon={<Volume2 className="h-4 w-4" />}
            label="声音"
            desc="回忆展厅幻灯片背景音开关"
            on={prefs.memorySound}
            onChange={(v) => {
              updatePrefs({ memorySound: v })
              showToast(v ? '已开启声音' : '已关闭声音')
            }}
            last
          />
        </section>
        <p className="px-1 text-[11px] leading-relaxed text-ink-muted">
          演示环境为应用内提醒，不会发送系统推送。关闭「玩偶响应提醒」后将不再弹出想你卡片。
        </p>
      </div>
    </>
  )
}

export function VersionPage() {
  return (
    <>
      <PageHeader title="版本信息" back="/me" soft />
      <div className="space-y-3 px-4 py-4">
        <section className="card-paper space-y-3 p-4">
          <InfoLine label="当前版本" value="0.1.0-demo" />
          <InfoLine label="构建" value="Toy Dairy MVP · Cloudflare Pages" />
          <InfoLine label="更新通道" value="main / production" />
        </section>
        <section className="card-paper p-4 text-xs leading-relaxed text-ink-soft">
          <h2 className="font-medium text-ink">版本介绍</h2>
          <p className="mt-2">
            本版本为黑客松演示：本地 mock 数据、浏览器 AI 抠图贴纸头像、
            旅行轨迹地图、玩偶对话与双视角日记。正式版将接入账号体系、对象存储与推送。
          </p>
          <p className="mt-3 text-ink-muted">更新日志请关注 GitHub Releases。</p>
        </section>
      </div>
    </>
  )
}

export function HelpCenterPage() {
  return (
    <>
      <PageHeader title="帮助中心" back="/me" soft />
      <div className="space-y-3 px-4 py-4">
        <section className="card-paper overflow-hidden">
          <LinkRow to="/help/docs" icon={<FileText className="h-4 w-4" />} label="使用文档" />
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
        </section>
      </div>
    </>
  )
}

export function HelpDocsPage() {
  return (
    <SimpleDoc
      title="使用文档"
      body={[
        '1. 档案页创建玩偶，上传照片生成贴纸头像。',
        '2. 底部「＋」记录旅行/日常，可搜索地点并生成玩偶日记。',
        '3. 成长页查看统计、时间线与旅行轨迹地图。',
        '4. 对话页与玩偶聊天；右上角可清空聊天记录。',
        '完整技术说明见仓库 docs/tech.md 与 docs/api.md。',
      ]}
    />
  )
}

export function HelpSupportPage() {
  return (
    <SimpleDoc
      title="帮助与客服"
      body={[
        '演示环境暂无真人客服。',
        '问题反馈可在 GitHub Issues 提交。',
        '紧急联系：support@toydairy.demo（占位邮箱）',
      ]}
    />
  )
}

export function HelpAboutPage() {
  return (
    <SimpleDoc
      title="关于我们"
      body={[
        'Toy Dairy · 让玩偶拥有「灵魂」的 AI 生命手帐。',
        '目标：身份卡 → 双视角日记 → 成长轨迹 → 对话陪伴。',
        'Made with 🧸 for travelers and toy lovers.',
      ]}
    />
  )
}

export function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const title = kind === 'terms' ? '服务协议' : '隐私政策'
  const body =
    kind === 'terms'
      ? [
          '本协议适用于 Toy Dairy 演示应用。',
          '演示数据默认保存在你的浏览器本地，不构成正式网络服务。',
          '请合理使用 AI 生成内容，勿上传违法违规材料。',
          '我们保留随时调整演示功能的权利。',
        ]
      : [
          '我们重视隐私：抠图与多数数据在本地处理。',
          '调用 AI 对话/日记接口时，会将必要的文本（不含完整密钥）发送至你配置的模型网关。',
          '演示账号与验证码仅存于本机 localStorage。',
          '正式版将提供更完整的数据删除与导出能力。',
        ]
  return <SimpleDoc title={title} body={body} back="/login" />
}

function SimpleDoc({
  title,
  body,
  back = '/help',
}: {
  title: string
  body: string[]
  back?: string
}) {
  return (
    <>
      <PageHeader title={title} back={back} soft />
      <div className="space-y-3 px-4 py-4">
        <section className="card-paper space-y-2.5 p-4 text-xs leading-relaxed text-ink-soft">
          {body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  )
}

function ToggleRow({
  icon,
  label,
  desc,
  on,
  onChange,
  last,
}: {
  icon: ReactNode
  label: string
  desc: string
  on: boolean
  onChange: (v: boolean) => void
  last?: boolean
}) {
  return (
    <div
      className={`flex min-h-14 items-center gap-3 px-4 py-3.5 ${last ? '' : 'border-b border-line/70'}`}
    >
      <span className="shrink-0 text-matcha-deep">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{label}</p>
        <p className="text-[11px] leading-relaxed text-ink-muted">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          on ? 'bg-matcha' : 'bg-cream-dark'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            on ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}

function LinkRow({
  to,
  icon,
  label,
  last,
}: {
  to: string
  icon: ReactNode
  label: string
  last?: boolean
}) {
  return (
    <Link
      to={to}
      className={`flex min-h-12 items-center gap-3 px-4 py-3.5 active:bg-cream ${
        last ? '' : 'border-b border-line/70'
      }`}
    >
      <span className="shrink-0 text-matcha-deep">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
    </Link>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  )
}