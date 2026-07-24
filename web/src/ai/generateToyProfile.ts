/**
 * Generate toy bio + monologue via the same /api/chat stack as conversation.
 * Falls back to local templates if the API fails.
 */
import type { Toy } from '../types'
import { chatToyReply } from '../ai/chatToyReply'

export async function generateToyProfileCopy(input: {
  name: string
  role: string
  traits: string[]
  birthPlace: string
  zodiac: string
  birthDate: string
}): Promise<{ bio: string; monologue: string; source: 'api' | 'local' }> {
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

  const prompt = [
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
    })
    if (result.source === 'api' && result.reply) {
      const parsed = parseBioMono(result.reply)
      if (parsed) return { ...parsed, source: 'api' }
    }
  } catch {
    // fall through
  }

  return { ...localProfileCopy(input), source: 'local' }
}

function parseBioMono(text: string): { bio: string; monologue: string } | null {
  const bio = text.match(/BIO\s*[:：]\s*(.+)/i)?.[1]?.trim()
  const mono = text.match(/MONO\s*[:：]\s*(.+)/i)?.[1]?.trim()
  if (bio && mono) return { bio: bio.slice(0, 160), monologue: mono.slice(0, 80) }
  // fallback: split paragraphs
  const parts = text
    .split(/\n+/)
    .map((l) => l.replace(/^BIO\s*[:：]\s*/i, '').replace(/^MONO\s*[:：]\s*/i, '').trim())
    .filter(Boolean)
  if (parts.length >= 2) {
    return { bio: parts[0].slice(0, 160), monologue: parts[1].slice(0, 80) }
  }
  return null
}

function localProfileCopy(input: {
  name: string
  role: string
  traits: string[]
  birthPlace: string
  zodiac: string
}) {
  const traitStr = input.traits.join('、') || '温柔'
  return {
    bio: `${input.name}是一只${traitStr}的${input.role}，出生于${input.birthPlace}。作为${input.zodiac}，ta 总在小小的身体里装着大大的世界。`,
    monologue: `我是${input.name}，最大的梦想是和主人一起把路上的光都记下来。`,
  }
}
