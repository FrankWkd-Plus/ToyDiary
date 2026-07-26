import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Info,
  Link2,
  RotateCcw,
  Upload,
  Volume2,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  buildExplorerTxUrl,
  computeRecordHash,
  ensureInjectiveNetwork,
  mintOwnershipSbt,
  requestAccount,
} from '../chain/injectiveSbt'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import {
  buildGrowthExport,
  growthExportFilename,
  parseGrowthImport,
} from '../share/growthJson'
import { shareOrDownloadFile } from '../share/shareHelpers'
import { THEME_LIST, type ThemeId } from '../theme/themes'
import { useTheme } from '../theme/ThemeProvider'

/**
 * 个人资料设置（右上角「资料」）
 * 手机号 / 微信 / 设备管理
 */
export function ProfileSettingsPage() {
  const { session, prefs, updatePrefs } = useAuth()
  const { showToast, currentToy, entries } = useApp()
  const [phone, setPhone] = useState(
    () =>
      prefs.phone ||
      (session.accountType === 'phone' ? session.account || '' : '') ||
      '',
  )
  const [wechat, setWechat] = useState(prefs.wechat || '')
  const [deviceLabel, setDeviceLabel] = useState(
    prefs.deviceLabel || '本机 · Safari / Chrome',
  )
  const [sbtBusy, setSbtBusy] = useState(false)
  const [sbtResult, setSbtResult] = useState<{
    hash: string
    explorerUrl: string
  } | null>(null)

  function saveField(patch: Partial<typeof prefs>, toast: string) {
    updatePrefs(patch)
    showToast(toast)
  }

  async function onMintOwnershipSbt() {
    if (!currentToy) {
      showToast('请先创建一只玩偶')
      return
    }
    setSbtBusy(true)
    setSbtResult(null)
    try {
      const account = await requestAccount()
      await ensureInjectiveNetwork()
      const latestEntry = entries
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0]
      const dataHash = computeRecordHash({
        toy: {
          id: currentToy.id,
          name: currentToy.name,
          birthDate: currentToy.birthDate,
        },
        latestEntry: latestEntry
          ? {
              id: latestEntry.id,
              date: latestEntry.date,
              title: latestEntry.title,
              userNote: latestEntry.userNote,
              aiDiary: latestEntry.aiDiary,
            }
          : null,
      })
      const hash = await mintOwnershipSbt({ account, dataHash })
      setSbtResult({ hash, explorerUrl: buildExplorerTxUrl(hash) })
      showToast('交易已提交，正在链上确权')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '链上确权失败，请重试')
    } finally {
      setSbtBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="个人资料设置" back="/me" soft />
      <div className="space-y-3 px-4 py-4">
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

        <section className="card-paper space-y-2 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <Link2 className="h-4 w-4 text-matcha-deep" />
            Injective 链上确权
          </div>
          <p className="text-[11px] text-ink-muted">
            演示：为当前玩偶生成专属确权 SBT，并将最新一条记录的哈希提交上链存证。
          </p>
          <button
            type="button"
            disabled={sbtBusy}
            onClick={() => void onMintOwnershipSbt()}
            className="flex min-h-11 w-full items-center justify-center rounded-2xl bg-matcha px-4 text-sm font-medium text-white active:bg-matcha-deep disabled:opacity-60"
          >
            {sbtBusy ? '确权中…' : '发起链上确权'}
          </button>
          {sbtResult && (
            <a
              href={sbtResult.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-matcha-deep underline"
            >
              交易 {sbtResult.hash.slice(0, 10)}…{sbtResult.hash.slice(-8)}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </section>

        <p className="px-1 text-center text-[11px] text-ink-muted">
          账号：{session.account || '已登录'} · 本地演示会话
        </p>
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
          <div className="border-b border-line/70 px-4 py-2.5 text-xs font-medium text-ink-muted">
            提醒开关
          </div>
          <ToggleRow
            icon={<Bell className="h-4 w-4" />}
            label="玩偶响应提醒"
            desc="总开关：关闭后不再弹出想你卡片"
            on={prefs.toyReminders}
            onChange={(v) => {
              updatePrefs({ toyReminders: v })
              showToast(v ? '已开启玩偶响应提醒' : '已关闭玩偶响应提醒')
            }}
          />
          <ToggleRow
            icon={<Bell className="h-4 w-4" />}
            label="想你 / 闲聊提醒"
            desc="「想你啦」「窗外的光」一类趣味打扰"
            on={prefs.nudgeMiss}
            onChange={(v) => {
              updatePrefs({ nudgeMiss: v })
              showToast(v ? '已开启想你提醒' : '已关闭想你提醒')
            }}
          />
          <ToggleRow
            icon={<BookOpen className="h-4 w-4" />}
            label="日记提醒"
            desc="玩偶催你写手帐（演示推送）"
            on={prefs.diaryPush}
            onChange={(v) => {
              updatePrefs({ diaryPush: v })
              showToast(v ? '已开启日记提醒' : '已关闭日记提醒')
            }}
          />
          <ToggleRow
            icon={<Bell className="h-4 w-4" />}
            label="旅行回忆提醒"
            desc="梦见上次旅行时来敲你一下"
            on={prefs.nudgeTravel}
            onChange={(v) => {
              updatePrefs({ nudgeTravel: v })
              showToast(v ? '已开启旅行回忆' : '已关闭旅行回忆')
            }}
          />
          <ToggleRow
            icon={<Bell className="h-4 w-4" />}
            label="夜间 / 电量状态"
            desc="困困的、电量低时的温柔提醒"
            on={prefs.nudgeNight}
            onChange={(v) => {
              updatePrefs({ nudgeNight: v })
              showToast(v ? '已开启夜间提醒' : '已关闭夜间提醒')
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

        <section className="card-paper p-4">
          <p className="text-xs font-medium text-ink">提醒频率</p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {(
              [
                { id: 'rare' as const, label: '佛系', desc: '少打扰' },
                { id: 'normal' as const, label: '适中', desc: '推荐' },
                { id: 'chatty' as const, label: '话唠', desc: '更勤快' },
              ] as const
            ).map((opt) => {
              const active = prefs.nudgeFrequency === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    updatePrefs({ nudgeFrequency: opt.id })
                    showToast(`提醒频率：${opt.label}`)
                  }}
                  className={`rounded-2xl px-2 py-2.5 text-center transition-all ${
                    active
                      ? 'bg-mist-soft ring-2 ring-matcha'
                      : 'bg-cream ring-1 ring-line/50'
                  }`}
                >
                  <span className="block text-xs font-semibold text-ink">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-ink-muted">
                    {opt.desc}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <p className="px-1 text-[11px] leading-relaxed text-ink-muted">
          演示环境为应用内卡片提醒，不会发送系统推送。对话页开启「安静陪伴」时也会暂停主动消息。
        </p>
      </div>
    </>
  )
}

/**
 * JSON 备份：导出 / 导入成长轨迹；重置演示数据
 */
export function DataBackupPage() {
  const {
    toys,
    entries,
    currentToy,
    importGrowthData,
    resetDemo,
    showToast,
  } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onExportJson() {
    setBusy(true)
    try {
      const payload = buildGrowthExport({
        toys,
        entries,
        currentToyId: currentToy?.id ?? null,
      })
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const filename = growthExportFilename()
      const mode = await shareOrDownloadFile({
        blob,
        filename,
        title: 'Toy Dairy 成长轨迹备份',
        text: `toys ${toys.length} · entries ${entries.length}`,
      })
      showToast(
        mode === 'shared' ? '已分享 / 导出成长轨迹 JSON' : '已下载成长轨迹 JSON',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导出失败')
    } finally {
      setBusy(false)
    }
  }

  function onPickImport() {
    fileRef.current?.click()
  }

  async function onImportFile(file: File | null) {
    if (!file) return
    setBusy(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text) as unknown
      const payload = parseGrowthImport(json)
      if (
        !window.confirm(
          `将导入 ${payload.toys.length} 只玩偶、${payload.entries.length} 条日记，并覆盖当前本地数据。继续？`,
        )
      ) {
        return
      }
      await importGrowthData(payload)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入失败，请检查 JSON')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onResetDemo() {
    if (
      !window.confirm(
        '将清除当前玩偶与日记，并恢复内置演示数据。主题、正数日样式、对话记录不会清除。继续？',
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await resetDemo()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="数据备份" back="/me" soft />
      <div className="space-y-3 px-4 py-4">
        <section className="card-paper overflow-hidden">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onExportJson()}
            className="flex min-h-14 w-full items-center gap-3 border-b border-line/70 px-4 py-3.5 text-left active:bg-cream disabled:opacity-50"
          >
            <span className="text-matcha-deep">
              <Download className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">导出成长轨迹 JSON</p>
              <p className="text-[11px] text-ink-muted">
                含玩偶档案与日记（演示本地备份）
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-ink-muted" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onPickImport}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-3.5 text-left active:bg-cream disabled:opacity-50"
          >
            <span className="text-matcha-deep">
              <Upload className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">导入成长轨迹 JSON</p>
              <p className="text-[11px] text-ink-muted">
                覆盖当前本地数据，请先自行备份
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-ink-muted" />
          </button>
        </section>

        <section className="card-paper overflow-hidden">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onResetDemo()}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-3.5 text-left active:bg-cream disabled:opacity-50"
          >
            <span className="text-rose-deep">
              <RotateCcw className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">重置演示数据</p>
              <p className="text-[11px] text-ink-muted">
                恢复种子玩偶与示例日记（不改主题 / 正数日 / 对话）
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-ink-muted" />
          </button>
        </section>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
        />
        <p className="px-1 text-[11px] leading-relaxed text-ink-muted">
          当前：{toys.length} 只玩偶 · {entries.length} 条日记。图片若为本地
          data URL 会一并写入 JSON，体积可能较大。
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
        'Toy Dairy · 玩偶生命手帐。把「人看玩偶」反转成「玩偶看世界」——让陪伴物从被记录的物品，变成共同生活的叙事主角。',
        '核心链路：身份卡（谁）→ 记一笔（发生了什么）→ 双视角日记（我怎么说 / 它怎么说）→ 成长时间轴与旅行地图 → 对话陪伴、正数日与分享卡片。',
        'Slogan：Through toy eyes, your world rewinds. / Reverse the gaze. 从物品到陪伴。',
        '面向喜欢收藏、携带玩偶旅行拍照，并希望用玩偶记录生活与情绪的年轻人。演示数据保存在本机浏览器；AI 日记与对话可走服务端接口。',
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
  return <SimpleDoc title={title} body={body} back="/archive" />
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