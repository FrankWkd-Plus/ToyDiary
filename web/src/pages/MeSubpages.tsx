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
import { useLocale } from '../i18n'
import { api } from '../api/client'
import {
  buildFullBackup,
  fullBackupFilename,
  parseFullBackup,
  restoreFullBackupMedia,
} from '../share/fullBackup'
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
  const { t } = useLocale()
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
      <PageHeader title={t('profile.title')} back="/me" soft />
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
 * Theme picker — 5 palettes apply immediately
 */
export function ThemePickerPage() {
  const { themeId, setThemeId } = useTheme()
  const { showToast } = useApp()
  const { t } = useLocale()

  function themeName(id: ThemeId) {
    return t(`theme.${id}`)
  }
  function themeDesc(id: ThemeId) {
    return t(`theme.${id}Desc`)
  }

  function onPick(id: ThemeId) {
    if (id === themeId) return
    setThemeId(id)
    showToast(t('themePicker.switched', { name: themeName(id) }))
  }

  return (
    <>
      <PageHeader title={t('themePicker.title')} back="/me" soft />
      <div className="mx-auto w-full max-w-lg space-y-3 px-4 py-4">
        <p className="px-1 text-xs text-ink-muted">
          {themeName(themeId)} · {themeDesc(themeId)}
        </p>
        <div className="grid grid-cols-1 gap-2.5">
          {THEME_LIST.map((item) => {
            const active = item.id === themeId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item.id)}
                className={`flex min-h-14 items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all ${
                  active
                    ? 'bg-mist-soft shadow-[var(--shadow-warm-sm)] ring-2 ring-matcha'
                    : 'bg-white ring-1 ring-line/50 active:bg-cream'
                }`}
              >
                <span className="flex shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5">
                  {item.swatches.map((c) => (
                    <span
                      key={c}
                      className="h-10 w-5 first:rounded-l-xl last:rounded-r-xl"
                      style={{ background: c }}
                    />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">
                    {themeName(item.id)}
                  </span>
                  <span className="block text-[11px] text-ink-muted">
                    {themeDesc(item.id)}
                  </span>
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

/** A calm home for preferences that do not belong in the account/profile UI. */
export function PreferencesPage() {
  return (
    <>
      <PageHeader title="偏好设置" back="/me" soft />
      <div className="space-y-3 px-4 py-4">
        <section className="card-paper overflow-hidden">
          <PreferenceLink
            to="/me/theme"
            label="外观与配色"
            hint="主题 · 字体 · 页面氛围"
          />
          <PreferenceLink
            to="/days"
            label="正数日样式"
            hint="卡片配色 · 字体与背景"
          />
          <PreferenceLink
            to="/me/data"
            label="本地数据与备份"
            hint="完整备份 · 导入恢复"
            last
          />
        </section>
        <p className="px-1 text-[11px] leading-relaxed text-ink-muted">
          Toy Diary 默认将记录保存在本机。建议在更换设备、更新系统或删除 App 前导出完整备份。
        </p>
      </div>
    </>
  )
}

function PreferenceLink({
  to,
  label,
  hint,
  last,
}: {
  to: string
  label: string
  hint: string
  last?: boolean
}) {
  return (
    <Link
      to={to}
      className={`flex min-h-14 items-center gap-3 px-4 py-3.5 active:bg-cream ${last ? '' : 'border-b border-line/70'}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">{label}</span>
        <span className="mt-0.5 block text-[11px] text-ink-muted">{hint}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
    </Link>
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
 * Complete offline backup: profile data + all diary entries + native photos.
 */
export function DataBackupPage() {
  const {
    toys,
    currentToy,
    importGrowthData,
    showToast,
  } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onExportBackup() {
    setBusy(true)
    try {
      // AppContext keeps only the current toy's entries in memory. A backup
      // must explicitly load every toy so no diary is silently omitted.
      const entries = (
        await Promise.all(toys.map((toy) => api.listEntries(toy.id)))
      ).flat()
      const payload = await buildFullBackup({
        toys,
        entries,
        currentToyId: currentToy?.id ?? null,
      })
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const filename = fullBackupFilename()
      const mode = await shareOrDownloadFile({
        blob,
        filename,
        title: 'Toy Diary 成长轨迹备份',
        text: `${toys.length} 只玩偶 · ${entries.length} 条日记 · ${payload.media.photos.length} 张本地照片`,
      })
      showToast(
        mode === 'shared' ? '已分享完整备份' : '完整备份已下载',
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
      const backup = parseFullBackup(json)
      if (
        !window.confirm(
          `将导入 ${backup.growth.toys.length} 只玩偶、${backup.growth.entries.length} 条日记、${backup.photos.length} 张本地照片，并覆盖当前本地数据。继续？`,
        )
      ) {
        return
      }
      // Restore files first, then reveal the diary records that reference them.
      await restoreFullBackupMedia(backup.photos)
      await importGrowthData(backup.growth)
      showToast(
        backup.legacy
          ? '已导入旧版 JSON（其中不含本地照片）'
          : `已恢复完整备份 · ${backup.photos.length} 张照片`,
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入失败，请检查 JSON')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
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
            onClick={() => void onExportBackup()}
            className="flex min-h-14 w-full items-center gap-3 border-b border-line/70 px-4 py-3.5 text-left active:bg-cream disabled:opacity-50"
          >
            <span className="text-matcha-deep">
              <Download className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">导出完整备份</p>
              <p className="text-[11px] text-ink-muted">
                含全部玩偶、日志和本地照片
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
              <p className="text-sm text-ink">导入完整备份</p>
              <p className="text-[11px] text-ink-muted">
                覆盖当前本地数据，也兼容旧版 JSON
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
          完整备份适合换机、误删或卸载前保存。照片会写入备份文件，文件体积会随照片数量增加。
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
          <InfoLine label="构建" value="Toy Diary MVP · Cloudflare Pages" />
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
        '联系邮箱：gxz4992563@gmail.com',
      ]}
    />
  )
}

export function HelpAboutPage() {
  return (
    <SimpleDoc
      title="关于我们"
      body={[
        'Toy Diary · 玩偶生命手帐。把「人看玩偶」反转成「玩偶看世界」——让陪伴物从被记录的物品，变成共同生活的叙事主角。',
        '核心链路：身份卡（谁）→ 记一笔（发生了什么）→ 双视角日记（我怎么说 / 它怎么说）→ 成长时间轴与旅行地图 → 对话陪伴、正数日与分享卡片。',
        'Slogan：Through toy eyes, your world rewinds. / Reverse the gaze. 从物品到陪伴。',
        '面向喜欢收藏、携带玩偶旅行拍照，并希望用玩偶记录生活与情绪的年轻人。演示数据保存在本机浏览器；AI 日记与对话可走服务端接口。',
        'Made with 🧸 for travelers and toy lovers.',
      ]}
    />
  )
}

export function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const privacy = kind === 'privacy'
  const title = privacy ? '隐私政策' : '使用条款'
  const sections: Array<{ title: string; body: string[] }> = privacy
    ? [
        {
          title: '简介',
          body: [
            'Toy Diary 是一款本地优先的玩偶陪伴记录工具。我们重视你的隐私；本政策说明本应用处理哪些信息、如何使用这些信息，以及你可如何管理自己的数据。',
            '生效日期：2026 年 9 月 4 日 · 最后更新：2026 年 9 月 4 日。',
          ],
        },
        {
          title: '本地存储的信息',
          body: [
            '本应用不要求注册账号。玩偶档案、日志文字、照片、地点、对话记录、偏好设置和完整备份，默认保存在你的设备本地。',
            '卸载应用、清除应用数据、重置设备或设备故障可能导致本地内容无法恢复。请在「偏好设置 → 本地数据与备份」中定期导出完整备份。',
          ],
        },
        {
          title: '相机、相册与定位',
          body: [
            '当你主动拍照、从相册选择图片或设置头像时，本应用才会请求相机或照片库权限；不会自行读取或上传你未选择的照片。',
            '当你主动使用“当前位置”时，本应用会请求定位权限，用于填写日志地点和生成成长轨迹。你可以拒绝定位，并手动输入地点。',
          ],
        },
        {
          title: 'AI 与地点服务',
          body: [
            '当你主动使用生成玩偶日记、重新生成或玩偶对话时，完成请求所必需的玩偶设定、文字、日期、地点，以及你选择用于图片理解的压缩图片，可能经由本应用接口发送至 AI 服务处理。请不要输入身份证号、银行卡号、精确住址等敏感信息。',
            '地点搜索或逆地理编码会将你主动输入的关键词或授权的坐标发送至地点服务以返回地点结果。AI 与地点服务仅用于你主动发起的功能，不用于广告、跨 App 跟踪或建立营销画像。',
          ],
        },
        {
          title: '备份、删除与分享',
          body: [
            '完整备份由你主动导出，可能包含玩偶、日志与本地照片。保存到“文件”、电脑或网盘后，该文件的保管责任由你和对应服务承担。',
            '你可以在应用内删除单篇日志、玩偶或清除本地数据。删除日志时，关联的本地照片会一并清理。',
          ],
        },
        {
          title: '我们不会做什么',
          body: [
            '我们不会出售、出租或交易你的日志、照片和玩偶档案；不会将其用于广告定向或跨 App 跟踪；也不会在未经你主动操作的情况下公开发布你的内容。',
          ],
        },
        {
          title: '政策更新与联系我们',
          body: [
            '若因功能、法律或服务变化需要更新本政策，我们会在本页面更新日期并提供新版内容。',
            '如对隐私或数据处理有疑问，请联系：gxz4992563@gmail.com。',
          ],
        },
      ]
    : [
        {
          title: '接受条款',
          body: [
            '下载、安装或使用 Toy Diary，即表示你同意本使用条款；如不同意，请停止使用本应用。',
            '生效日期：2026 年 9 月 4 日 · 最后更新：2026 年 9 月 4 日。',
          ],
        },
        {
          title: '服务说明',
          body: [
            'Toy Diary 用于创建玩偶档案、记录日常与旅行、生成玩偶日记、查看成长轨迹、导出纪念卡片和完整备份。当前版本不提供账号、登录或跨设备云同步功能。',
          ],
        },
        {
          title: '本地数据与备份',
          body: [
            '你的内容默认保存在设备本地。你应自行保管设备和备份文件，并在更换设备、卸载应用或清除数据前导出完整备份。',
            '在适用法律允许的范围内，我们不对因未备份、误操作、设备故障或第三方存储服务异常导致的数据丢失承担责任。',
          ],
        },
        {
          title: '用户内容',
          body: [
            '你保留自己创建、上传或保存的日志、照片、文字和玩偶设定的权利。你应确保拥有这些内容的合法使用权。',
            '不得利用本应用上传、保存或分享违法、侵权、欺诈、暴力、骚扰、恶意代码或侵犯他人隐私、肖像权、著作权的内容。',
          ],
        },
        {
          title: 'AI 功能',
          body: [
            '玩偶日记、对话和图片理解由 AI 生成，可能不准确、不完整或不符合你的预期。你应自行决定是否保存、修改、导出或分享生成内容。',
            'AI 内容仅供陪伴记录与创作参考，不构成医疗、法律、金融、心理咨询或其他专业建议。',
          ],
        },
        {
          title: '第三方服务与知识产权',
          body: [
            '部分功能依赖相机、相册、定位、地图、地点或 AI 服务。你可自行决定是否授权；第三方服务的可用性、结果准确性和服务条款由其自身负责。',
            'Toy Diary 的名称、界面设计、图标、插画、代码与开发者提供的内容受相关法律保护。未经许可，不得复制、反向工程、出售或不当使用。',
          ],
        },
        {
          title: '服务变更与联系我们',
          body: [
            '我们可能因维护、安全、功能优化或法律要求调整部分功能。若变更明显影响核心使用方式，会尽合理努力提前说明。',
            '如对本条款有疑问，请联系：gxz4992563@gmail.com。',
          ],
        },
      ]

  return <LegalDocument title={title} sections={sections} />
}

function LegalDocument({
  title,
  sections,
}: {
  title: string
  sections: Array<{ title: string; body: string[] }>
}) {
  return (
    <div className="legal-standalone">
      <PageHeader title={title} back="/me" soft />
      <div className="space-y-4 px-5 py-5 pb-10">
        {sections.map((section, i) => (
          <section key={section.title} className="card-paper p-5">
            <h2 className="flex items-baseline gap-2 text-base font-semibold tracking-wide text-ink">
              <span className="inline-block h-4 w-1 shrink-0 self-center rounded-full bg-matcha/70" aria-hidden="true" />
              {section.title}
            </h2>
            <div className="mt-3 space-y-3 text-[13px] leading-7 text-ink-soft">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {i === sections.length - 1 && (
              <p className="mt-4 border-t border-line/50 pt-3 text-center text-[11px] text-ink-muted">
                Toy Diary · 与你的玩偶一起，把陪伴写进时间里
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  )
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
