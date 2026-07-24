import type { Entry, Toy } from '../types'

export const GROWTH_JSON_VERSION = 1 as const

export interface GrowthExportPayload {
  format: 'toydairy.growth'
  version: typeof GROWTH_JSON_VERSION
  exportedAt: string
  toys: Toy[]
  entries: Entry[]
  currentToyId: string | null
}

export function buildGrowthExport(input: {
  toys: Toy[]
  entries: Entry[]
  currentToyId: string | null
}): GrowthExportPayload {
  return {
    format: 'toydairy.growth',
    version: GROWTH_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    toys: input.toys,
    entries: input.entries,
    currentToyId: input.currentToyId,
  }
}

export function parseGrowthImport(raw: unknown): GrowthExportPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('文件格式无效')
  }
  const data = raw as Partial<GrowthExportPayload> & {
    toys?: Toy[]
    entries?: Entry[]
  }
  // Accept both new format and legacy MePage export
  if (!Array.isArray(data.toys) || !Array.isArray(data.entries)) {
    throw new Error('缺少 toys / entries 字段')
  }
  return {
    format: 'toydairy.growth',
    version: GROWTH_JSON_VERSION,
    exportedAt:
      typeof data.exportedAt === 'string'
        ? data.exportedAt
        : new Date().toISOString(),
    toys: data.toys,
    entries: data.entries,
    currentToyId:
      typeof data.currentToyId === 'string' || data.currentToyId === null
        ? (data.currentToyId as string | null)
        : data.toys[0]?.id ?? null,
  }
}

export function growthExportFilename() {
  return `toydairy-growth-${new Date().toISOString().slice(0, 10)}.json`
}
