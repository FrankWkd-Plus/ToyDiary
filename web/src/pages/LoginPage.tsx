/**
 * Fix LoginPage hooks order (no early return before useEffect).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Mail, Smartphone, Sparkles } from 'lucide-react'
import {
  DEMO_OTP,
  isValidEmail,
  isValidPhone,
} from '../auth/authStorage'
import { useAuth } from '../auth/AuthContext'
import { useApp } from '../context/AppContext'

type Channel = 'phone' | 'email'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, enterGuest, isLoggedIn, isGuest } = useAuth()
  const { showToast } = useApp()
  const [channel, setChannel] = useState<Channel>('phone')
  const [account, setAccount] = useState('')
  const [otp, setOtp] = useState('')
  const [sent, setSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (countdown <= 0) return
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [countdown])

  const accountOk = useMemo(() => {
    return channel === 'phone' ? isValidPhone(account) : isValidEmail(account)
  }, [channel, account])

  if (isLoggedIn || isGuest) {
    return <Navigate to="/archive" replace />
  }

  function sendCode() {
    if (!accountOk) {
      showToast(channel === 'phone' ? '请输入有效手机号' : '请输入有效邮箱')
      return
    }
    setSent(true)
    setCountdown(60)
    showToast(
      channel === 'phone'
        ? `验证码已发送至 ${account}（演示码 ${DEMO_OTP}）`
        : `验证码已发送至邮箱（演示码 ${DEMO_OTP}）`,
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) {
      showToast('请先勾选同意服务协议与隐私政策')
      return
    }
    if (!accountOk) {
      showToast(channel === 'phone' ? '请输入有效手机号' : '请输入有效邮箱')
      return
    }
    if (otp.trim() !== DEMO_OTP) {
      showToast(`验证码错误（演示请填 ${DEMO_OTP}）`)
      return
    }
    setBusy(true)
    try {
      login({
        mode: 'user',
        account: account.trim(),
        accountType: channel,
        name:
          channel === 'phone'
            ? `用户${account.slice(-4)}`
            : account.split('@')[0],
      })
      showToast('登录成功')
      navigate('/archive', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  function onGuest() {
    enterGuest()
    showToast('已进入随便看看模式，创建档案需登录')
    navigate('/archive', { replace: true })
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-gradient-to-b from-[var(--header-from)] via-white to-[var(--color-cream)] px-5 pb-8 pt-4 sm:px-8">
      <div className="mx-auto flex w-full max-w-[420px] items-center justify-between">
        <span className="font-display text-lg text-ink">Toy Dairy</span>
        <button
          type="button"
          onClick={onGuest}
          className="min-h-9 rounded-full bg-white/90 px-3.5 py-1.5 text-[11px] font-medium text-matcha-deep shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50 transition-transform active:scale-95"
        >
          随便看看
        </button>
      </div>

      <div className="mx-auto mt-10 w-full max-w-[360px] flex-1 sm:mt-14">
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-white text-3xl shadow-[var(--shadow-warm)]">
            🧸
          </span>
          {/* Avoid display font for CJK with 回 — some devices render it as a black blob */}
          <h1 className="mt-4 text-2xl font-semibold tracking-wide text-ink">
            欢迎回来
          </h1>
          <p className="mt-1.5 text-xs text-ink-muted">
            登录后可创建玩偶档案与同步成长轨迹
          </p>
        </div>

        <div className="mt-6 flex rounded-2xl bg-cream p-1">
          <button
            type="button"
            onClick={() => {
              setChannel('phone')
              setSent(false)
              setOtp('')
            }}
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-medium transition-colors ${
              channel === 'phone'
                ? 'bg-white text-matcha-deep shadow-sm'
                : 'text-ink-muted'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            手机号登录
          </button>
          <button
            type="button"
            onClick={() => {
              setChannel('email')
              setSent(false)
              setOtp('')
            }}
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-medium transition-colors ${
              channel === 'email'
                ? 'bg-white text-matcha-deep shadow-sm'
                : 'text-ink-muted'
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            邮箱登录
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">
              {channel === 'phone' ? '手机号' : '邮箱'}
            </span>
            <input
              className="input !rounded-2xl"
              inputMode={channel === 'phone' ? 'numeric' : 'email'}
              placeholder={
                channel === 'phone' ? '请输入 11 位手机号' : 'name@example.com'
              }
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              maxLength={channel === 'phone' ? 11 : 80}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">
              验证码
            </span>
            <div className="flex gap-2">
              <input
                className="input min-w-0 flex-1 !rounded-2xl"
                inputMode="numeric"
                placeholder="6 位验证码"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                maxLength={6}
              />
              <button
                type="button"
                disabled={countdown > 0 || !accountOk}
                onClick={sendCode}
                className="shrink-0 rounded-2xl bg-mist-soft px-3 text-xs font-medium text-matcha-deep disabled:opacity-50"
              >
                {countdown > 0
                  ? `${countdown}s`
                  : sent
                    ? '重新发送'
                    : '获取验证码'}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-ink-muted">
              演示环境验证码固定为 <strong>{DEMO_OTP}</strong>
            </p>
          </label>

          <label className="flex items-start gap-2 pt-1 text-[11px] leading-relaxed text-ink-muted">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-matcha)]"
            />
            <span>
              我已阅读并同意
              <Link
                to="/legal/terms"
                className="mx-0.5 text-matcha-deep underline"
              >
                《服务协议》
              </Link>
              和
              <Link
                to="/legal/privacy"
                className="mx-0.5 text-matcha-deep underline"
              >
                《隐私政策》
              </Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full py-3.5 text-sm"
          >
            {busy ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="mt-6 flex items-center justify-center gap-1 text-[10px] text-ink-muted">
          <Sparkles className="h-3 w-3 text-terra-deep" />
          本地演示登录 · 数据仍保存在本机
        </p>
      </div>
    </div>
  )
}
