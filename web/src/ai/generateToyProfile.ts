/**
 * Generate toy bio + monologue via the same /api/chat stack as conversation.
 * Falls back to local templates if the API fails.
 */
import type { Toy } from '../types'
import { chatToyReply } from '../ai/chatToyReply'
import { getStoredLocale, type Locale } from '../i18n'

export async function generateToyProfileCopy(input: {
  name: string
  role: string
  traits: string[]
  birthPlace: string
  zodiac: string
  birthDate: string
  locale?: Locale
}): Promise<{ bio: string; monologue: string; source: 'api' | 'local' }> {
  const locale = input.locale || getStoredLocale()
  const isEn = locale === 'en'

  const toyStub = {
    id: 'draft',
    name: input.name,
    role: input.role,
    traits: input.traits,
    birthPlace: input.birthPlace,
    birthDate: input.birthDate,
    zodiac: input.zodiac,
    createdAt: new Date().toISOString(),
  } as Toy

  const prompt = isEn
    ? [
        `Write two short English copy blocks for a toy companion. Output exactly two lines in this format:`,
        `BIO: <third-person intro, 40–80 words, personality and dreams>`,
        `MONO: <first-person line to the owner, 15–40 words>`,
        `Toy name: ${input.name}`,
        `Role: ${input.role}`,
        `Traits: ${input.traits.join(', ') || 'gentle'}`,
        `Birthplace: ${input.birthPlace}`,
        `Zodiac: ${input.zodiac}`,
        `No other commentary.`,
      ].join('\n')
    : [
        `请为玩偶写两段中文文案，严格按下面格式输出两行：`,
        `BIO: <简介，40～80字，第三人称介绍性格与梦想>`,
        `MONO: <独白，15～40字，第一人称对主人说的话>`,
        `玩偶名：${input.name}`,
        `身份：${input.role}`,
        `性格：${input.traits.join('、') || '温柔'}`,
        `出生地：${input.birthPlace}`,
        `星座：${input.zodiac}`,
        `不要输出其它说明。`,
      ].join('\n')

  try {
    const result = await chatToyReply({
      toy: toyStub,
      message: prompt,
      history: [],
      entries: [],
      quietMode: true,
      locale,
    })
    if (result.source === 'api' && result.reply) {
      const parsed = parseBioMono(result.reply)
      if (parsed) return { ...parsed, source: 'api' }
    }
  } catch {
    // fall through
  }

  return { ...localProfileCopy(input, locale), source: 'local' }
}

function parseBioMono(text: string): { bio: string; monologue: string } | null {
  const bio = text.match(/BIO\s*[:：]\s*(.+)/i)?.[1]?.trim()
  const mono = text.match(/MONO\s*[:：]\s*(.+)/i)?.[1]?.trim()
  if (bio && mono)
    return { bio: bio.slice(0, 220), monologue: mono.slice(0, 120) }
  const parts = text
    .split(/\n+/)
    .map((l) =>
      l
        .replace(/^BIO\s*[:：]\s*/i, '')
        .replace(/^MONO\s*[:：]\s*/i, '')
        .trim(),
    )
    .filter(Boolean)
  if (parts.length >= 2) {
    return { bio: parts[0].slice(0, 220), monologue: parts[1].slice(0, 120) }
  }
  return null
}

function localProfileCopy(
  input: {
    name: string
    role: string
    traits: string[]
    birthPlace: string
    zodiac: string
  },
  locale: Locale,
) {
  if (locale === 'en') {
    const traitStr = input.traits.join(', ') || 'gentle'
    return {
      bio: `${input.name} is a ${traitStr} ${input.role} born in ${input.birthPlace}. As a ${input.zodiac}, they carry a wide world inside a small body.`,
      monologue: `I'm ${input.name}, and my biggest dream is to collect every bit of light on the road with you.`,
    }
  }
  const traitStr = input.traits.join('、') || '温柔'
  return {
    bio: `${input.name}是一只${traitStr}的${input.role}，出生于${input.birthPlace}。作为${input.zodiac}，ta 总在小小的身体里装着大大的世界。`,
    monologue: `我是${input.name}，最大的梦想是和主人一起把路上的光都记下来。`,
  }
}
