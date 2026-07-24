import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { api } from '../api/client'
import {
  dateFromZodiac,
  isZodiacSign,
  ZODIAC_SIGNS,
  zodiacFromDate,
  zodiacRangeLabel,
  type ZodiacSign,
} from '../archive/zodiac'
import { PageHeader } from '../components/PageHeader'
import { ToyAvatarStudio } from '../components/ToyAvatarStudio'
import { useApp } from '../context/AppContext'

const ROLE_OPTIONS = ['旅行搭子', '童年伙伴', '治愈小宠', '冒险伙伴']
const TRAIT_OPTIONS = ['温柔', '胆小', '好奇', '活泼', '话多', '安静', '勇敢', '爱吃']

/**
 * Create-toy flow:
 * photo → local AI cutout sticker → name / birthday↔zodiac / traits → save archive
 */
export function NewToyPage() {
  const nav = useNavigate()
  const { refreshToys, showToast } = useApp()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [birthPlace, setBirthPlace] = useState('')
  const [role, setRole] = useState(ROLE_OPTIONS[0])
  const [traits, setTraits] = useState<string[]>(['温柔', '好奇'])
  const [bio, setBio] = useState('')
  const [monologue, setMonologue] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string>()
  const [avatarConfirmed, setAvatarConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Linked: change date → zodiac; pick zodiac → rewrite date into that sign.
  const zodiac = useMemo(() => {
    const z = zodiacFromDate(birthDate)
    return z === '神秘座' ? '巨蟹座' : z
  }, [birthDate])

  function onBirthDateChange(next: string) {
    setBirthDate(next)
  }

  function onZodiacChange(next: string) {
    if (!isZodiacSign(next)) return
    const year = Number(birthDate.slice(0, 4)) || new Date().getFullYear()
    const matched = dateFromZodiac(next as ZodiacSign, year)
    setBirthDate(matched)
    showToast(`已按「${next}」匹配出生日期 ${matched}`)
  }

  function toggleTrait(t: string) {
    setTraits((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 4),
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!avatarConfirmed || !avatarUrl) {
      showToast('请先确认玩偶贴纸头像')
      return
    }
    if (!name.trim() || !birthPlace.trim()) {
      showToast('请填写名称和出生地')
      return
    }
    if (traits.length === 0) {
      showToast('请至少选一个性格')
      return
    }
    setSubmitting(true)
    try {
      // MVP: avatarUrl is a compressed Data URL.
      // REPLACE_WITH_BACKEND: upload blob to R2/S3, store public URL only.
      const toy = await api.createToy({
        name: name.trim(),
        birthDate,
        birthPlace: birthPlace.trim(),
        role,
        traits,
        bio: bio.trim() || undefined,
        monologue: monologue.trim() || undefined,
        avatarUrl,
        zodiac,
      })
      await refreshToys()
      showToast(`${toy.name} 的档案已生成`)
      nav(`/archive/toys/${toy.id}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader title="新增玩偶" back="/toys" soft />
      <form onSubmit={onSubmit} className="space-y-4 px-4 py-4">
        <ToyAvatarStudio
          value={avatarUrl}
          onToast={showToast}
          onConfirm={(url) => {
            setAvatarUrl(url)
            setAvatarConfirmed(true)
          }}
        />

        {avatarConfirmed && avatarUrl && (
          <div className="flex items-center gap-3 rounded-2xl bg-mist-soft px-3 py-2.5 text-xs text-matcha-deep">
            <img
              src={avatarUrl}
              alt="已确认头像"
              className="h-12 w-12 rounded-2xl bg-white object-contain shadow-sm ring-1 ring-line/40"
            />
            <span className="min-w-0 flex-1">
              贴纸头像已就绪，继续填写档案信息吧。
            </span>
          </div>
        )}

        <Field label="玩偶名称">
          <input
            className="input !rounded-2xl"
            placeholder="例如：小熊 Luna"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
          />
        </Field>

        <Field label="出生日期">
          <input
            type="date"
            className="input !rounded-2xl"
            value={birthDate}
            onChange={(e) => onBirthDateChange(e.target.value)}
          />
          <span className="mt-1 block text-[10px] text-ink-muted">
            修改日期后，星座会自动联动
          </span>
        </Field>

        <Field label="星座">
          <div className="rounded-2xl bg-mustard-soft/70 px-3.5 py-2.5">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-terra-deep">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>
                当前：<strong>{zodiac}</strong>
                <span className="ml-1 text-[10px] text-ink-muted">
                  （{zodiacRangeLabel(zodiac)}）
                </span>
              </span>
            </div>
            <select
              className="input !rounded-2xl !bg-white"
              value={zodiac}
              onChange={(e) => onZodiacChange(e.target.value)}
              aria-label="选择星座"
            >
              {ZODIAC_SIGNS.map((sign) => (
                <option key={sign} value={sign}>
                  {sign} · {zodiacRangeLabel(sign)}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[10px] leading-relaxed text-ink-muted">
              可手动选择星座；选择后会自动分配一个匹配该星座的出生日期。
            </p>
          </div>
        </Field>

        <Field label="出生地">
          <input
            className="input !rounded-2xl"
            placeholder="例如：上海迪士尼"
            value={birthPlace}
            onChange={(e) => setBirthPlace(e.target.value)}
            maxLength={40}
          />
        </Field>
        <Field label="身份">
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={role === r ? 'chip chip-active' : 'chip'}
              >
                {r}
              </button>
            ))}
          </div>
        </Field>
        <Field label="性格关键词（最多 4 个）">
          <div className="flex flex-wrap gap-2">
            {TRAIT_OPTIONS.map((t) => {
              const on = traits.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTrait(t)}
                  className={on ? 'chip chip-soft-active' : 'chip'}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="人设简介（可选）">
          <textarea
            className="input min-h-[72px] resize-none !rounded-2xl"
            placeholder="不写的话会根据性格自动生成"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
          />
        </Field>
        <Field label="AI 独白（可选）">
          <textarea
            className="input min-h-[64px] resize-none !rounded-2xl"
            placeholder="例如：今天也想和你一起出门～"
            value={monologue}
            onChange={(e) => setMonologue(e.target.value)}
            maxLength={80}
          />
        </Field>

        <button
          type="submit"
          disabled={submitting || !avatarConfirmed}
          className="btn-primary w-full py-3.5 text-sm disabled:opacity-60"
        >
          {submitting
            ? '生成档案中…'
            : avatarConfirmed
              ? '保存并生成档案'
              : '请先确认贴纸头像'}
        </button>
      </form>
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
