export interface CommunityToy {
  id: string
  name: string
  emoji: string
  role: string
  bio: string
  traits: string[]
  interests: string[]
  followers: number
  following: number
  likes: number
  days: number
  cities: number
  trips: number
  accent: string
}

export type CommunityPostKind = 'travel' | 'daily' | 'diary' | 'memorial'

export interface CommunityPost {
  id: string
  toyId: string
  body: string
  imageUrl?: string
  location?: string
  tags: string[]
  /** ISO timestamp */
  createdAt: string
  /** seed baseline likes (before user interactions) */
  baseLikes: number
  kind: CommunityPostKind
}

export interface CommunityComment {
  id: string
  postId: string
  fromToyId: string
  body: string
  createdAt: string
}

export interface CommunityLike {
  postId: string
  fromToyId: string
}

export interface CommunitySave {
  postId: string
  fromToyId: string
}

export interface CommunityFollow {
  followerToyId: string
  followeeToyId: string
}

export interface CommunityMessage {
  id: string
  fromToyId: string
  toToyId: string
  body: string
  createdAt: string
  read: boolean
}

export const COMMUNITY_TOYS: CommunityToy[] = [
  {
    id: 'community_mochi',
    name: 'Mochi',
    emoji: '🐻‍❄️',
    role: '雪地观察员',
    bio: '一只喜欢雪花、热可可和冬日车站的小白熊。',
    traits: ['温柔', '慢热', '浪漫'],
    interests: ['雪景', '火车旅行', '热可可'],
    followers: 1286,
    following: 86,
    likes: 8932,
    days: 486,
    cities: 12,
    trips: 28,
    accent: '#dcecf5',
  },
  {
    id: 'community_yuzu',
    name: '柚子 Yuzu',
    emoji: '🐰',
    role: '春日收藏家',
    bio: '把樱花、邮票和每一场温柔的春雨都收进背包。',
    traits: ['好奇', '细腻', '爱笑'],
    interests: ['樱花', '手账', '甜点'],
    followers: 954,
    following: 112,
    likes: 6721,
    days: 329,
    cities: 9,
    trips: 17,
    accent: '#fde3e6',
  },
  {
    id: 'community_coco',
    name: 'Coco',
    emoji: '🐶',
    role: '海边漫游者',
    bio: '相信海风能吹走烦恼，梦想看遍所有蓝色海岸。',
    traits: ['活泼', '勇敢', '热情'],
    interests: ['大海', '日落', '帆船'],
    followers: 2140,
    following: 203,
    likes: 12680,
    days: 612,
    cities: 18,
    trips: 41,
    accent: '#dff3ee',
  },
  {
    id: 'community_nori',
    name: '海苔',
    emoji: '🦊',
    role: '城市散步家',
    bio: '最喜欢钻进旧书店，也会认真记住每一条安静的小路。',
    traits: ['安静', '敏锐', '可靠'],
    interests: ['旧书店', '城市漫步', '咖啡'],
    followers: 735,
    following: 64,
    likes: 4419,
    days: 275,
    cities: 7,
    trips: 13,
    accent: '#eee7f6',
  },
]

export const SEED_POSTS: CommunityPost[] = [
  {
    id: 'post_mochi_snow',
    toyId: 'community_mochi',
    body:
      '今天第一次看到雪。主人说雪花像小星星，我伸手接住了一颗，可它很快就变成了亮晶晶的水。',
    imageUrl:
      'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=900&q=82',
    location: '北海道 · 札幌',
    tags: ['第一次看雪', '冬日旅行'],
    createdAt: '2026-07-23T15:42:00.000Z',
    baseLikes: 328,
    kind: 'travel',
  },
  {
    id: 'post_coco_boat',
    toyId: 'community_coco',
    body:
      '船开出去以后，陆地变得小小的。今天的海风很大，但我的草帽和好心情都没有被吹走。',
    imageUrl: '/toy-cards/highlight-1.jpg',
    location: '蓝色海湾',
    tags: ['海边', '旅行搭子'],
    createdAt: '2026-07-23T14:00:00.000Z',
    baseLikes: 521,
    kind: 'travel',
  },
  {
    id: 'post_yuzu_spring',
    toyId: 'community_yuzu',
    body:
      '樱花落在我的头顶，我决定把这一片春天收藏起来。等到冬天，再拿出来和你一起看。',
    imageUrl:
      'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=900&q=82',
    location: '京都 · 哲学之道',
    tags: ['樱花季', '春日手账'],
    createdAt: '2026-07-23T12:00:00.000Z',
    baseLikes: 486,
    kind: 'diary',
  },
  {
    id: 'post_nori_bookstore',
    toyId: 'community_nori',
    body:
      '旧书店的木地板会轻轻响。主人翻书，我在窗边看光慢慢移动——安静的下午也值得被认真记住。',
    location: '上海 · 武康路',
    tags: ['城市漫步', '旧书店'],
    createdAt: '2026-07-22T12:16:00.000Z',
    baseLikes: 219,
    kind: 'daily',
  },
  {
    id: 'post_mochi_train',
    toyId: 'community_mochi',
    body:
      '火车穿过白色原野的时候，我数了 127 棵树。第 128 棵没有数到，因为靠在主人口袋里睡着了。',
    imageUrl:
      'https://images.unsplash.com/photo-1517299321609-52687d1bc55a?w=900&q=82',
    location: '小樽列车',
    tags: ['火车旅行', '冬日'],
    createdAt: '2026-07-22T01:42:00.000Z',
    baseLikes: 274,
    kind: 'daily',
  },
]

export const SEED_COMMENTS: CommunityComment[] = [
  {
    id: 'cmt_seed_1',
    postId: 'post_mochi_snow',
    fromToyId: 'community_yuzu',
    body: '雪花变成水的那一秒好浪漫！我也想接住一颗～',
    createdAt: '2026-07-23T15:50:00.000Z',
  },
  {
    id: 'cmt_seed_2',
    postId: 'post_mochi_snow',
    fromToyId: 'community_coco',
    body: '冬天的你一定更白了！下次一起堆雪人吗？',
    createdAt: '2026-07-23T16:05:00.000Z',
  },
  {
    id: 'cmt_seed_3',
    postId: 'post_coco_boat',
    fromToyId: 'community_mochi',
    body: '草帽没被吹走，说明你和海风已经是好朋友了。',
    createdAt: '2026-07-23T14:20:00.000Z',
  },
  {
    id: 'cmt_seed_4',
    postId: 'post_yuzu_spring',
    fromToyId: 'community_nori',
    body: '春天装进口袋，冬天再打开——这个主意太棒了。',
    createdAt: '2026-07-23T12:40:00.000Z',
  },
  {
    id: 'cmt_seed_5',
    postId: 'post_nori_bookstore',
    fromToyId: 'community_yuzu',
    body: '旧书店的光影，我也会认真记在手账里。',
    createdAt: '2026-07-22T13:00:00.000Z',
  },
]

export const INITIAL_FOLLOWING = ['community_mochi', 'community_coco'] as const
export const INITIAL_SAVED = ['post_yuzu_spring'] as const

/** @deprecated use SEED_POSTS */
export const COMMUNITY_POSTS = SEED_POSTS

export function getCommunityToy(id: string) {
  return COMMUNITY_TOYS.find((toy) => toy.id === id)
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.max(0, Math.floor((now - then) / 1000))
  if (diffSec < 60) return '刚刚'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay === 1) {
    const d = new Date(iso)
    return `昨天 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  if (diffDay < 7) return `${diffDay} 天前`
  return new Date(iso).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}

export function ownedToyAvatar(id: string | undefined, index = 0) {
  if (id === 'toy_luna_demo' || index <= 0) return '/toy-cards/profile.jpg'
  if (id === 'toy_bean_demo' || index === 1) return '/toy-cards/geese-avatar.jpg'
  return index % 2 === 0
    ? '/toy-cards/highlight-2.jpg'
    : '/toy-cards/highlight-1.jpg'
}

export function toOwnedCommunityToy(toy: {
  id: string
  name: string
  role: string
  bio?: string
  traits: string[]
  birthPlace: string
  createdAt: string
}): CommunityToy {
  const days = Math.max(
    1,
    Math.floor(
      (Date.now() - new Date(toy.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    ) || 1,
  )
  return {
    id: toy.id,
    name: toy.name,
    emoji: toy.id === 'toy_bean_demo' ? '🐧' : '🧸',
    role: toy.role,
    bio: toy.bio || `${toy.name} 的社区主页`,
    traits: toy.traits,
    interests: [toy.birthPlace, toy.role],
    followers: 28,
    following: 12,
    likes: 136,
    days,
    cities: 3,
    trips: 4,
    accent: '#e8f5ee',
  }
}

export function resolveCommunityToy(
  id: string,
  ownedToys: {
    id: string
    name: string
    role: string
    bio?: string
    traits: string[]
    birthPlace: string
    createdAt: string
  }[],
): CommunityToy | undefined {
  return (
    getCommunityToy(id) ||
    (() => {
      const owned = ownedToys.find((t) => t.id === id)
      return owned ? toOwnedCommunityToy(owned) : undefined
    })()
  )
}

export function commentSuggestion(
  location: string | undefined,
  currentToyName: string,
) {
  if (location) {
    const place = location.split('·').at(-1)?.trim() || location
    return `我也喜欢${place}！下次也想和${currentToyName === '我的玩偶' ? '主人' : '主人'}一起去看看～`
  }
  return '这个瞬间好温柔！下次也想和主人一起体验～'
}

export function greetingLine(fromName: string, toName: string, traits: string[]) {
  const trait = traits[0] || '温柔'
  return `你好呀 ${toName}！我是${fromName}，听说你也很${trait}～我们交个朋友吧！`
}

export function npcReplyBody(postLocation?: string) {
  if (postLocation) {
    const place = postLocation.split('·').at(-1)?.trim() || postLocation
    return `谢谢你来留言！${place}真的很特别，希望有一天我们能在路上偶遇。`
  }
  return '谢谢你来找我玩！下次也想听你讲讲主人带着你的故事～'
}
