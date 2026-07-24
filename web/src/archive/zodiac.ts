/**
 * Western zodiac helpers — date ↔ sign stay in sync for NewToy form.
 * Ranges match mockStore.zodiacFromDate (month/day cutovers).
 */

export const ZODIAC_SIGNS = [
  '白羊座',
  '金牛座',
  '双子座',
  '巨蟹座',
  '狮子座',
  '处女座',
  '天秤座',
  '天蝎座',
  '射手座',
  '摩羯座',
  '水瓶座',
  '双鱼座',
] as const

export type ZodiacSign = (typeof ZODIAC_SIGNS)[number]

/** Inclusive month-day ranges; Capricorn wraps year-end. */
const RANGES: {
  name: ZodiacSign
  /** start month (1-12) */
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
}[] = [
  { name: '摩羯座', startMonth: 12, startDay: 23, endMonth: 1, endDay: 20 },
  { name: '水瓶座', startMonth: 1, startDay: 21, endMonth: 2, endDay: 19 },
  { name: '双鱼座', startMonth: 2, startDay: 20, endMonth: 3, endDay: 21 },
  { name: '白羊座', startMonth: 3, startDay: 22, endMonth: 4, endDay: 20 },
  { name: '金牛座', startMonth: 4, startDay: 21, endMonth: 5, endDay: 21 },
  { name: '双子座', startMonth: 5, startDay: 22, endMonth: 6, endDay: 21 },
  { name: '巨蟹座', startMonth: 6, startDay: 22, endMonth: 7, endDay: 23 },
  { name: '狮子座', startMonth: 7, startDay: 24, endMonth: 8, endDay: 23 },
  { name: '处女座', startMonth: 8, startDay: 24, endMonth: 9, endDay: 23 },
  { name: '天秤座', startMonth: 9, startDay: 24, endMonth: 10, endDay: 23 },
  { name: '天蝎座', startMonth: 10, startDay: 24, endMonth: 11, endDay: 22 },
  { name: '射手座', startMonth: 11, startDay: 23, endMonth: 12, endDay: 22 },
]

/** Mid-range month/day used when user picks a sign → assign a matching birthday. */
const MIDPOINTS: Record<ZodiacSign, { month: number; day: number }> = {
  摩羯座: { month: 1, day: 10 },
  水瓶座: { month: 2, day: 5 },
  双鱼座: { month: 3, day: 5 },
  白羊座: { month: 4, day: 5 },
  金牛座: { month: 5, day: 5 },
  双子座: { month: 6, day: 5 },
  巨蟹座: { month: 7, day: 5 },
  狮子座: { month: 8, day: 5 },
  处女座: { month: 9, day: 5 },
  天秤座: { month: 10, day: 5 },
  天蝎座: { month: 11, day: 5 },
  射手座: { month: 12, day: 5 },
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * Same cutovers as mockStore.zodiacFromDate — kept here for UI without pulling mock.
 */
export function zodiacFromDate(isoDate: string): ZodiacSign | '神秘座' {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return '神秘座'
  const m = d.getMonth() + 1
  const day = d.getDate()
  // Same table order as mockStore (first matching upper bound wins).
  const table: [number, number, ZodiacSign][] = [
    [1, 20, '摩羯座'],
    [2, 19, '水瓶座'],
    [3, 21, '双鱼座'],
    [4, 20, '白羊座'],
    [5, 21, '金牛座'],
    [6, 21, '双子座'],
    [7, 23, '巨蟹座'],
    [8, 23, '狮子座'],
    [9, 23, '处女座'],
    [10, 23, '天秤座'],
    [11, 22, '天蝎座'],
    [12, 22, '射手座'],
    [12, 32, '摩羯座'],
  ]
  for (const [month, lastDay, name] of table) {
    if (m < month || (m === month && day <= lastDay)) return name
  }
  return '摩羯座'
}

/**
 * Pick a birth date that falls inside the sign's range.
 * Keeps the existing year when possible; Capricorn mid-point uses Jan of that year.
 */
export function dateFromZodiac(
  sign: ZodiacSign,
  preferYear?: number,
): string {
  const year =
    preferYear && Number.isFinite(preferYear)
      ? preferYear
      : new Date().getFullYear()
  const mid = MIDPOINTS[sign]
  return `${year}-${pad(mid.month)}-${pad(mid.day)}`
}

export function isZodiacSign(value: string): value is ZodiacSign {
  return (ZODIAC_SIGNS as readonly string[]).includes(value)
}

/** For display chips / tooltips */
export function zodiacRangeLabel(sign: ZodiacSign): string {
  const r = RANGES.find((x) => x.name === sign)
  if (!r) return ''
  if (r.startMonth > r.endMonth) {
    return `${r.startMonth}/${r.startDay}–次年${r.endMonth}/${r.endDay}`
  }
  return `${r.startMonth}/${r.startDay}–${r.endMonth}/${r.endDay}`
}
