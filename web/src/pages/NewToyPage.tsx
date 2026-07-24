import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Sparkles } from 'lucide-react'
import { zodiacFromDate } from '../api/mockStore'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'

const ROLE_OPTIONS = ['旅行搭子', '童年伙伴', '治愈小宠', '冒险伙伴']
const TRAIT_OPTIONS = ['温柔', '胆小', '好奇', '活泼', '话多', '安静', '勇敢', '爱吃']

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
  const [submitting, setSubmitting] = useState(false)

  const zodiac = useMemo(() => zodiacFromDate(birthDate), [birthDate])

  function toggleTrait(t: string) {
    setTraits((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 4),
    )
  }

  function onPickAvatar(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('头像请小于 8MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(String(reader.result))
    reader.readAsDataURL(file)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
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
      <PageHeader title="新增玩偶" back="/archive" soft />
      <form onSubmit={onSubmit} className="space-y-4 px-4 py-4">
        <div className="card-paper flex flex-col items-center gap-3 p-5 text-center">
          <label className="relative cursor-pointer">
            <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.5rem] border-2 border-dashed border-line bg-cream text-4xl shadow-[var(--shadow-warm-sm)]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="头像预览" className="h-full w-full object-cover" />
              ) : (
                '🧸'
              )}
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-matcha text-white shadow-md">
              <Camera className="h-4 w-4" />
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-xs leading-relaxed text-ink-soft">
            上传照片，填写档案信息。星座会根据出生日期自动生成。
          </p>
        </div>

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
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </Field>
        <div className="rounded-2xl bg-mustard-soft/70 px-3.5 py-2.5 text-xs text-terra-deep">
          <Sparkles className="mr-1 inline h-3.5 w-3.5" />
          AI 星座：<strong>{zodiac}</strong>
        </div>
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
          disabled={submitting}
          className="btn-primary w-full py-3.5 text-sm"
        >
          {submitting ? '生成档案中…' : '保存并生成档案'}
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
