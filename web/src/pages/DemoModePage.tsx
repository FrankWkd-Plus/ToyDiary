import { useState } from 'react'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { activateDemoMode, deactivateDemoMode } from '../demo/demoActions'
import { isDemoMode } from '../demo/demoMode'
import { ToggleRow } from './MeSubpages'

/**
 * Demo mode settings. Toggling reloads the page: every provider and store is
 * built at boot against the active namespace, the same way the factory reset
 * restarts the app.
 */
export function DemoModePage() {
  const { toys, resetDemo, showToast } = useApp()
  const [on, setOn] = useState(() => isDemoMode())
  const [busy, setBusy] = useState(false)

  function toggle(next: boolean) {
    if (busy || next === on) return
    if (
      !next &&
      !window.confirm('关闭演示模式会丢弃演示期间的所有改动，并回到你自己的记录。继续？')
    ) {
      return
    }

    setBusy(true)
    setOn(next)
    try {
      if (next) activateDemoMode()
      else deactivateDemoMode()
    } catch (error) {
      // Roll back to real mode rather than leaving a half-seeded demo space.
      deactivateDemoMode()
      setBusy(false)
      setOn(false)
      showToast(error instanceof Error ? error.message : '切换演示模式失败')
      return
    }

    window.setTimeout(() => window.location.reload(), 60)
  }

  async function onReset() {
    if (busy || !on) return
    if (!window.confirm('演示数据会恢复成初始的示例玩偶、日记和对话。继续？')) return
    setBusy(true)
    try {
      await resetDemo()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '重置失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="演示模式" back="/me/preferences" soft />
      <div className="space-y-3 px-4 py-4">
        <section className="card-paper overflow-hidden">
          <ToggleRow
            icon={<FlaskConical className="h-4 w-4" />}
            label="演示模式"
            desc="使用一套独立的示例数据；关掉后回到你自己的记录"
            on={on}
            onChange={toggle}
            last
          />
        </section>

        <section className="card-paper space-y-2 p-4 text-xs leading-relaxed text-ink-muted">
          <p>
            演示模式里的玩偶、日记和对话都保存在另一套命名空间里，和你的真实记录互不读取。
            适合把 App 借给别人试用，或者现场讲一段完整的故事。
          </p>
          <p>
            关闭演示模式时，演示期间的改动会被清空；下次再打开，会重新装入初始的示例内容。
          </p>
          {on && (
            <p className="text-ink-soft">
              当前示例：{toys.length} 只玩偶 · 若干条日记与两段对话
            </p>
          )}
        </section>

        {on && (
          <button
            type="button"
            onClick={() => void onReset()}
            disabled={busy}
            className="card-paper flex min-h-12 w-full items-center justify-center gap-2 text-sm text-ink disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4 text-matcha-deep" aria-hidden="true" />
            重置演示数据
          </button>
        )}
      </div>
    </>
  )
}
