import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Heart, LoaderCircle, Sparkles, Wand2 } from 'lucide-react'
import { generateToyProfileCopy } from '../ai/generateToyProfile'
import { api } from '../api/client'
import { toyAvatar, toySignature } from '../archive/archiveUtils'
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

const DEFAULT_ROLE = '陪伴伙伴'
const TRAIT_OPTIONS = [
  '温柔',
  '胆小',
  '好奇',
  '活泼',
  '话多',
  '安静',
  '勇敢',
  '爱吃',
]

/**
 * Create-toy flow:
 * photo → sticker → name / birthday↔zodiac / traits → AI bio (via /api/chat) → save
 */
export function NewToyPage() {
  const nav = useNavigate()
  const location = useLocation()
  const { id: editingToyId } = useParams()
  const { toys, refreshToys, showToast } = useApp()
  const editingToy = editingToyId
    ? toys.find((toy) => toy.id === editingToyId)
    : undefined
  const editing = Boolean(editingToyId)
  const backTarget =
    (location.state as { from?: string } | null)?.from === 'me'
      ? '/toys'
      : '/archive'
  const traitOptions = Array.from(
    new Set([...(editingToy?.traits || []), ...TRAIT_OPTIONS]),
  )
  const [name, setName] = useState(() => editingToy?.name || '')
  const [birthDate, setBirthDate] = useState(() =>
    editingToy?.birthDate || new Date().toISOString().slice(0, 10),
  )
  const [birthPlace, setBirthPlace] = useState(
    () => editingToy?.birthPlace || '',
  )
  const role = editingToy?.role || DEFAULT_ROLE
  const [traits, setTraits] = useState<string[]>(
    () => editingToy?.traits || ['温柔', '好奇'],
  )
  const [signature, setSignature] = useState(() =>
    editingToy ? toySignature(editingToy) : '',
  )
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    () =>
      editingToy
        ? toyAvatar(
            editingToy,
            toys.findIndex((toy) => toy.id === editingToy.id),
          )
        : undefined,
  )
  const [avatarConfirmed, setAvatarConfirmed] = useState(
    () => Boolean(editingToy),
  )
  const [submitting, setSubmitting] = useState(false)
  const [aiWriting, setAiWriting] = useState(false)

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

  async function onAiWrite() {
    if (!name.trim()) {
      showToast('请先填写玩偶名称')
      return
    }
    if (!birthPlace.trim()) {
      showToast('请先填写出生地，AI 会写进人设')
      return
    }
    if (traits.length === 0) {
      showToast('请至少选一个性格')
      return
    }
    setAiWriting(true)
    try {
      const result = await generateToyProfileCopy({
        name: name.trim(),
        role,
        traits,
        birthPlace: birthPlace.trim(),
        zodiac,
        birthDate,
      })
      setSignature(result.monologue)
      showToast(
        result.source === 'api'
          ? 'AI 已写好个性签名'
          : '远程 AI 暂不可用，已生成一条温暖签名',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI 生成失败')
    } finally {
      setAiWriting(false)
    }
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
      // Demo: localStorage via api.*; contract = POST/PATCH /toys
      const payload = {
        name: name.trim(),
        birthDate,
        birthPlace: birthPlace.trim(),
        role,
        traits,
        signature: signature.trim() || undefined,
        avatarUrl,
        zodiac,
      }
      const toy =
        editing && editingToyId
          ? await api.updateToy(editingToyId, payload)
          : await api.createToy(payload)
      await refreshToys()
      showToast(
        editing
          ? `${toy.name} 的档案已更新（本机）`
          : `${toy.name} 的档案已保存到本机`,
      )
      if (editing) {
        nav(backTarget, { replace: true })
      } else {
        nav(`/archive/toys/${toy.id}`)
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title={editing ? '编辑玩偶' : '新增玩偶'}
        back={editing ? backTarget : '/archive'}
        soft
      />
      <form onSubmit={onSubmit} className="space-y-4 px-4 py-4">
        <section className="toy-profile-form-hero">
          <span className="toy-profile-form-hero__eyebrow">
            <Heart className="h-3.5 w-3.5" fill="currentColor" />
            {editing ? 'OUR LITTLE STORY' : 'A NEW LITTLE LIFE'}
          </span>
          <div className="relative z-[1] mt-3 max-w-[78%]">
            <h1 className="font-display text-xl leading-tight text-ink">
              {editing
                ? `把 ${editingToy?.name || '玩偶'} 的故事写得更像 TA`
                : '为新伙伴写下第一张生命档案'}
            </h1>
            <p className="mt-2 text-[11px] leading-5 text-ink-muted">
              照片、生日、性格与一句专属签名，会一起成为 TA 的身份。
            </p>
          </div>
          <Sparkles className="toy-profile-form-hero__sparkle" />
        </section>

        <ToyAvatarStudio
          value={avatarUrl}
          onToast={showToast}
          onConfirm={(url) => {
            setAvatarUrl(url)
            setAvatarConfirmed(true)
          }}
        />

        {!editing && avatarConfirmed && avatarUrl && (
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
        <Field label="性格关键词（最多 4 个）">
          <div className="flex flex-wrap gap-2">
            {traitOptions.map((t) => {
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

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs font-medium text-ink-soft">个性签名</span>
          <button
            type="button"
            onClick={() => void onAiWrite()}
            disabled={aiWriting}
            className="flex items-center gap-1 rounded-full bg-mist-soft px-3 py-1.5 text-[11px] font-medium text-matcha-deep disabled:opacity-50"
          >
            {aiWriting ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            {aiWriting ? 'AI 书写中…' : 'AI 帮写'}
          </button>
        </div>
        <Field label="写一句最像 TA 的话（可选）">
          <textarea
            className="input min-h-[68px] resize-none !rounded-2xl"
            placeholder='例如：人 熊生是旷野'
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            maxLength={80}
          />
          <span className="mt-1.5 block text-[10px] leading-4 text-ink-muted">
            会同步展示在档案卡、对话档案与“我的玩偶”中。
          </span>
        </Field>

        <button
          type="submit"
          disabled={submitting || !avatarConfirmed}
          className="btn-primary w-full py-3.5 text-sm disabled:opacity-60"
        >
          {submitting
            ? editing
              ? '保存修改中…'
              : '生成档案中…'
            : avatarConfirmed
              ? editing
                ? '保存档案修改'
                : '保存并生成档案'
              : '请先确认贴纸头像'}
        </button>
      </form>
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  )
}
