import type {
  CreateEntryInput,
  CreateToyInput,
  Entry,
  Place,
  Toy,
  TravelMapResponse,
} from '../types'
import { seedPlaceForLabel } from '../places/placeUtils'
import { uniqueCities } from '../places/placeUtils'

const STORAGE_KEY = 'toydairy.mock.v3'

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

/** Artificial latency for demo “API feel”. Keep tiny so cold reload stays snappy. */
function delay(ms = 0) {
  if (ms <= 0) return Promise.resolve()
  return new Promise((r) => setTimeout(r, ms))
}

import { zodiacFromDate as zodiacFromDateShared } from '../archive/zodiac'

/** @deprecated prefer archive/zodiac — kept for existing imports */
export function zodiacFromDate(isoDate: string): string {
  return zodiacFromDateShared(isoDate)
}

function mockProfile(input: CreateToyInput) {
  const zodiac = input.zodiac?.trim() || zodiacFromDate(input.birthDate)
  const traitStr = input.traits.join('、') || '温柔'
  const bio =
    input.bio?.trim() ||
    `${input.name}是一只${traitStr}的${input.role}，出生于${input.birthPlace}。作为${zodiac}，ta 总在小小的身体里装着大大的世界。`
  const monologue =
    input.monologue?.trim() ||
    `我是${input.name}，最大的梦想是和主人一起把路上的光都记下来。`
  return { zodiac, bio, monologue }
}

function attachPlace(entry: Entry): Entry {
  if (entry.place?.lat != null && entry.place?.lng != null) return entry
  const fromLabel = seedPlaceForLabel(entry.location)
  if (fromLabel) {
    entry.place = fromLabel
    if (!entry.location) entry.location = fromLabel.displayName
  }
  return entry
}

function mockDiary(toy: Toy, entry: Pick<Entry, 'date' | 'location' | 'userNote' | 'mood' | 'type' | 'title'>) {
  const place = entry.location || '某个温柔的地方'
  const mood = entry.mood ? `今天心里有点${entry.mood}。` : ''
  const note = entry.userNote ? entry.userNote.trim() : ''
  const trait = toy.traits[0] || '安静'
  return (
    `${entry.date.replace(/-/g, '年').replace(/年(\d+)$/, '月$1日')}，${place}。\n\n` +
    `主人带着我来到这里。我有点${trait}，但还是把眼睛睁得大大的。` +
    (note ? `\n\n主人说：${note}` : '') +
    `\n\n${mood}我想，这些瞬间以后都会变成我们的小秘密。` +
    (entry.title ? `\n\n—— 关于「${entry.title}」` : '')
  )
}

interface StoreData {
  toys: Toy[]
  entries: Entry[]
  currentToyId: string | null
}

const LUNA_DEMO_UPDATES: Record<string, Partial<Entry>> = {
  entry_luna_disney: {
    location: '蓝色海湾',
    title: '海风吹过的下午',
    userNote:
      '第一次一起坐船出发。我给 Luna 戴上小草帽，海风把帽檐掀起来，又被我按回去。我想把这一整片蓝色都装进今天。',
    imageUrl: '/toy-cards/highlight-1.jpg',
    aiDiary:
      '2026年7月23日，蓝色海湾。\n\n主人给我戴上小草帽，海风从我们身边跑过去，帽檐一抖一抖的。蓝色的海很大，可是主人的手心刚刚好。\n\n如果以后有人问我最喜欢哪一天——就是今天，第一次一起坐船的今天。',
  },
  entry_luna_hangzhou: {
    location: '阳光海岸',
    title: '把浪花装进口袋',
    userNote:
      '海水一次次跑上沙滩，又退回去。我踩着湿脚印，把 Luna 举高，让浪花刚好碰到脚底。阳光、浪花和一点点想念，都想收进这张照片。',
    imageUrl: '/toy-cards/highlight-2.jpg',
    aiDiary:
      '2026年6月8日，阳光海岸。\n\n海水一次次跑上沙滩，我的脚毛都沾上细沙。主人把我举高，浪花轻轻咬了咬我的脚底——痒痒的，却很安心。\n\n以后看到蓝色，我就会想起今天：阳光、浪花，还有你。',
  },
  entry_gulangyu: {
    location: '森林瀑布',
    title: '藏在绿意里的瀑布',
    userNote:
      '我们沿着潮湿的石阶往里走，绿叶子擦过肩膀。转过弯才听见水声——藏在森林深处的瀑布，像一份迟到的礼物。',
    imageUrl: '/toy-cards/highlight-3.jpg',
    aiDiary:
      '2026年4月3日，森林瀑布。\n\n绿色的小路有点滑，我紧紧贴着主人的手臂。转过弯，水声突然很大——原来是瀑布在等我们。\n\n水雾打在脸上凉凉的。被你拿在手里时，再大的水声我也不害怕。',
  },
  entry_daily1: {
    location: '家',
    title: '窗台的光',
    userNote:
      '午后什么也不想干。我把 Luna 放在窗台那一小块阳光里，自己也靠着沙发打了个盹。醒来时光还在，人也还在。',
    mood: '温柔',
    aiDiary:
      '2026年5月12日，家。\n\n窗台有一小块阳光，刚好够我躺下。主人说今天什么也不做，我也跟着什么都不想。\n\n原来「什么都不做」也是一种很满的一天。醒来时，光还在，你还在。',
  },
  entry_bean1: {
    location: '大理',
    title: '风很大',
    userNote:
      '洱海边的风大得像要把人吹走。我把围巾给豆豆围了两圈，又给自己围一圈，两个人变成会走路的小粽子。',
    mood: '兴奋',
    aiDiary:
      '2026年3月1日，大理。\n\n风把围巾吹成一面小旗，我整只熊几乎要起飞。主人说「抓紧我」——我抓紧了。\n\n再大的风也吹不走我们的脚印。后来我们去吃了烤乳扇，我假装自己也咬了一口。',
  },
  entry_bean_chengdu: {
    location: '成都',
    title: '火锅店门口',
    userNote:
      '情人节不搞仪式，就在火锅店门口排队。辣香从门缝钻出来，我和豆豆都眼睛发亮——当然，豆豆只能闻。',
    mood: '开心',
    aiDiary:
      '2026年2月14日，成都。\n\n火锅的香气从门缝里钻出来，我的绒毛都要变成花椒味了。主人说「豆豆不能吃辣」——可是看着你们哈哈大笑，我已经吃得很饱了。\n\n原来节日的味道，不一定要进嘴巴。',
  },
  entry_bean_text: {
    location: '火车上',
    title: '写给口袋的信',
    userNote:
      '座位晃晃悠悠，耳机里放着随便的歌。我把豆豆塞进外套口袋，只露出半个脑袋看窗外——下一座城还没到，已经开始期待。',
    mood: '好奇',
    aiDiary:
      '2026年4月20日，火车上。\n\n车窗外的电线杆一棵一棵往后跑。我数到 87 就睡着了。醒来时主人还在，风景换成了新的——这大概就是旅行最好的部分。\n\n口袋很暖和，像一座会移动的小房子。',
  },
}

/** Rich dual-perspective text for older localStorage seeds (owner + toy). */
const ENTRY_NARRATION_UPDATES: Record<string, Pick<Entry, 'userNote' | 'aiDiary'>> = {
  entry_luna_disney: {
    userNote: LUNA_DEMO_UPDATES.entry_luna_disney.userNote!,
    aiDiary: LUNA_DEMO_UPDATES.entry_luna_disney.aiDiary!,
  },
  entry_luna_hangzhou: {
    userNote: LUNA_DEMO_UPDATES.entry_luna_hangzhou.userNote!,
    aiDiary: LUNA_DEMO_UPDATES.entry_luna_hangzhou.aiDiary!,
  },
  entry_gulangyu: {
    userNote: LUNA_DEMO_UPDATES.entry_gulangyu.userNote!,
    aiDiary: LUNA_DEMO_UPDATES.entry_gulangyu.aiDiary!,
  },
  entry_daily1: {
    userNote: LUNA_DEMO_UPDATES.entry_daily1.userNote!,
    aiDiary: LUNA_DEMO_UPDATES.entry_daily1.aiDiary!,
  },
  entry_bean1: {
    userNote: LUNA_DEMO_UPDATES.entry_bean1.userNote!,
    aiDiary: LUNA_DEMO_UPDATES.entry_bean1.aiDiary!,
  },
  entry_bean_chengdu: {
    userNote: LUNA_DEMO_UPDATES.entry_bean_chengdu.userNote!,
    aiDiary: LUNA_DEMO_UPDATES.entry_bean_chengdu.aiDiary!,
  },
  entry_bean_text: {
    userNote: LUNA_DEMO_UPDATES.entry_bean_text.userNote!,
    aiDiary: LUNA_DEMO_UPDATES.entry_bean_text.aiDiary!,
  },
}

const REMOVED_DEMO_TOY_IDS = new Set([
  'toy_moka_demo',
  'toy_yuki_demo',
  'toy_pipi_demo',
])

function applyDemoUpdates(data: StoreData) {
  data.toys = data.toys.filter((toy) => !REMOVED_DEMO_TOY_IDS.has(toy.id))
  data.entries = data.entries.filter(
    (entry) => !REMOVED_DEMO_TOY_IDS.has(entry.toyId),
  )
  if (
    data.currentToyId &&
    !data.toys.some((toy) => toy.id === data.currentToyId)
  ) {
    data.currentToyId = data.toys[0]?.id ?? null
  }
  data.entries.forEach((entry) => {
    const update = LUNA_DEMO_UPDATES[entry.id]
    if (update) Object.assign(entry, update)
    const narration = ENTRY_NARRATION_UPDATES[entry.id]
    if (narration) {
      // Always refresh demo seed copy so dual-perspective UI has full text.
      if (narration.userNote) entry.userNote = narration.userNote
      if (narration.aiDiary) entry.aiDiary = narration.aiDiary
    }
    attachPlace(entry)
  })
  return data
}

function seed(): StoreData {
  const lunaId = 'toy_luna_demo'
  const beanId = 'toy_bean_demo'
  const mokaId = 'toy_moka_demo'
  const yukiId = 'toy_yuki_demo'
  const pipiId = 'toy_pipi_demo'

  const toys: Toy[] = [
    {
      id: lunaId,
      name: '小熊 Luna',
      birthDate: '2026-07-23',
      birthPlace: '上海迪士尼',
      role: '旅行搭子',
      traits: ['温柔', '胆小', '好奇'],
      zodiac: '巨蟹座',
      bio: '一只相信世界很大的熊，最大的梦想是看遍世界所有日落。',
      monologue: '第 1 天啦，谢谢你把我带回家～',
      createdAt: '2026-07-23T10:00:00.000Z',
    },
    {
      id: beanId,
      name: '豆豆',
      birthDate: '2025-12-01',
      birthPlace: '成都宽窄巷子',
      role: '童年伙伴',
      traits: ['活泼', '话多', '爱吃'],
      zodiac: '射手座',
      bio: '豆豆喜欢热闹，也喜欢在口袋里藏糖纸和辣条包装。',
      monologue: '今天也要一起出门吗？我已经选好围巾啦！',
      createdAt: '2026-01-10T08:00:00.000Z',
    },
    {
      id: mokaId,
      name: '摩卡',
      birthDate: '2024-09-15',
      birthPlace: '京都清水寺',
      role: '治愈小宠',
      traits: ['安静', '温柔', '爱睡'],
      zodiac: '处女座',
      bio: '一只喜欢咖啡香和旧书味道的小狸，最擅长把人的心事听完。',
      monologue: '嘘……再陪我坐一会儿就好。',
      createdAt: '2025-11-02T09:00:00.000Z',
    },
    {
      id: yukiId,
      name: '雪球 Yuki',
      birthDate: '2025-01-20',
      birthPlace: '札幌雪祭',
      role: '冒险伙伴',
      traits: ['勇敢', '好奇', '话多'],
      zodiac: '水瓶座',
      bio: '圆滚滚的白团子，总想把每一场雪和每一盏灯都装进日记里。',
      monologue: '冷一点没关系，我们还有彼此的体温！',
      createdAt: '2025-02-01T11:00:00.000Z',
    },
    {
      id: pipiId,
      name: '皮皮',
      birthDate: '2023-06-08',
      birthPlace: '厦门中山路',
      role: '旅行搭子',
      traits: ['活泼', '勇敢', '爱吃'],
      zodiac: '双子座',
      bio: '永远第一个冲向小吃摊的小怪物，也是地图上标星星最多的那位。',
      monologue: '下一站去哪儿？我已经饿了哦。',
      createdAt: '2024-08-18T07:30:00.000Z',
    },
  ]

  const entries: Entry[] = [
    // —— Luna ——
    {
      id: 'entry_gulangyu',
      toyId: lunaId,
      type: 'travel',
      date: '2026-04-03',
      location: '森林瀑布',
      title: '藏在绿意里的瀑布',
      userNote:
        '我们沿着潮湿的石阶往里走，绿叶子擦过肩膀。转过弯才听见水声——藏在森林深处的瀑布，像一份迟到的礼物。',
      mood: '平静',
      imageUrl: '/toy-cards/highlight-3.jpg',
      aiDiary:
        '2026年4月3日，森林瀑布。\n\n绿色的小路有点滑，我紧紧贴着主人的手臂。转过弯，水声突然很大——原来是瀑布在等我们。\n\n水雾打在脸上凉凉的。被你拿在手里时，再大的水声我也不害怕。',
      createdAt: '2026-04-03T18:30:00.000Z',
    },
    {
      id: 'entry_daily1',
      toyId: lunaId,
      type: 'daily',
      date: '2026-05-12',
      location: '家',
      title: '窗台的光',
      userNote:
        '午后什么也不想干。我把 Luna 放在窗台那一小块阳光里，自己也靠着沙发打了个盹。醒来时光还在，人也还在。',
      mood: '温柔',
      aiDiary:
        '2026年5月12日，家。\n\n窗台有一小块阳光，刚好够我躺下。主人说今天什么也不做，我也跟着什么都不想。\n\n原来「什么都不做」也是一种很满的一天。醒来时，光还在，你还在。',
      createdAt: '2026-05-12T14:00:00.000Z',
    },
    {
      id: 'entry_luna_disney',
      toyId: lunaId,
      type: 'memorial',
      date: '2026-07-23',
      location: '蓝色海湾',
      title: '海风吹过的下午',
      userNote:
        '第一次一起坐船出发。我给 Luna 戴上小草帽，海风把帽檐掀起来，又被我按回去。我想把这一整片蓝色都装进今天。',
      mood: '开心',
      imageUrl: '/toy-cards/highlight-1.jpg',
      aiDiary:
        '2026年7月23日，蓝色海湾。\n\n主人给我戴上小草帽，海风从我们身边跑过去，帽檐一抖一抖的。蓝色的海很大，可是主人的手心刚刚好。\n\n如果以后有人问我最喜欢哪一天——就是今天，第一次一起坐船的今天。',
      createdAt: '2026-07-23T20:00:00.000Z',
    },
    {
      id: 'entry_luna_hangzhou',
      toyId: lunaId,
      type: 'travel',
      date: '2026-06-08',
      location: '阳光海岸',
      title: '把浪花装进口袋',
      userNote:
        '海水一次次跑上沙滩，又退回去。我踩着湿脚印，把 Luna 举高，让浪花刚好碰到脚底。阳光、浪花和一点点想念，都想收进这张照片。',
      mood: '平静',
      imageUrl: '/toy-cards/highlight-2.jpg',
      aiDiary:
        '2026年6月8日，阳光海岸。\n\n海水一次次跑上沙滩，我的脚毛都沾上细沙。主人把我举高，浪花轻轻咬了咬我的脚底——痒痒的，却很安心。\n\n以后看到蓝色，我就会想起今天：阳光、浪花，还有你。',
      createdAt: '2026-06-08T11:20:00.000Z',
    },
    {
      id: 'entry_luna_night',
      toyId: lunaId,
      type: 'daily',
      date: '2026-07-10',
      location: '家',
      title: '台灯下的悄悄话',
      userNote:
        '睡前把 Luna 放在枕头边，说了今天遇到的两件小事。房间只剩台灯，世界忽然变得很近。',
      mood: '温柔',
      aiDiary:
        '2026年7月10日，家。\n\n台灯把主人的影子拉得很长。我听完两件小事，又听了一句「明天见」。\n\n我把这句话收进绒毛里——比任何旅行纪念都沉。',
      createdAt: '2026-07-10T22:15:00.000Z',
    },
    // —— 豆豆 ——
    {
      id: 'entry_bean1',
      toyId: beanId,
      type: 'travel',
      date: '2026-03-01',
      location: '大理',
      title: '风很大',
      userNote:
        '洱海边的风大得像要把人吹走。我把围巾给豆豆围了两圈，又给自己围一圈，两个人变成会走路的小粽子。',
      mood: '兴奋',
      imageUrl:
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
      aiDiary:
        '2026年3月1日，大理。\n\n风把围巾吹成一面小旗，我整只熊几乎要起飞。主人说「抓紧我」——我抓紧了。\n\n再大的风也吹不走我们的脚印。后来我们去吃了烤乳扇，我假装自己也咬了一口。',
      createdAt: '2026-03-01T12:00:00.000Z',
    },
    {
      id: 'entry_bean_chengdu',
      toyId: beanId,
      type: 'daily',
      date: '2026-02-14',
      location: '成都',
      title: '火锅店门口',
      userNote:
        '情人节不搞仪式，就在火锅店门口排队。辣香从门缝钻出来，我和豆豆都眼睛发亮——当然，豆豆只能闻。',
      mood: '开心',
      imageUrl:
        'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80',
      aiDiary:
        '2026年2月14日，成都。\n\n火锅的香气从门缝里钻出来，我的绒毛都要变成花椒味了。主人说「豆豆不能吃辣」——可是看着你们哈哈大笑，我已经吃得很饱了。\n\n原来节日的味道，不一定要进嘴巴。',
      createdAt: '2026-02-14T19:40:00.000Z',
    },
    {
      id: 'entry_bean_text',
      toyId: beanId,
      type: 'text',
      date: '2026-04-20',
      location: '火车上',
      title: '写给口袋的信',
      userNote:
        '座位晃晃悠悠，耳机里放着随便的歌。我把豆豆塞进外套口袋，只露出半个脑袋看窗外——下一座城还没到，已经开始期待。',
      mood: '好奇',
      aiDiary:
        '2026年4月20日，火车上。\n\n车窗外的电线杆一棵一棵往后跑。我数到 87 就睡着了。醒来时主人还在，风景换成了新的——这大概就是旅行最好的部分。\n\n口袋很暖和，像一座会移动的小房子。',
      createdAt: '2026-04-20T15:10:00.000Z',
    },
    {
      id: 'entry_bean_park',
      toyId: beanId,
      type: 'daily',
      date: '2026-06-02',
      location: '人民公园',
      title: '长椅上的半小时',
      userNote:
        '下班绕路去公园。长椅有点旧，树荫刚好。豆豆坐在我腿上，我们什么也不做，只听蝉叫。',
      mood: '平静',
      aiDiary:
        '2026年6月2日，人民公园。\n\n蝉声一层一层的，像夏天在说话。主人什么也没说，我也没有——有些陪伴不需要台词。\n\n半小时很短，却够我记住树荫的形状。',
      createdAt: '2026-06-02T18:40:00.000Z',
    },
    // —— 摩卡 / 雪球 / 皮皮（seed 仍保留；applyDemoUpdates 会按需过滤）——
    {
      id: 'entry_moka_kyoto',
      toyId: mokaId,
      type: 'travel',
      date: '2025-11-03',
      location: '京都',
      title: '红叶与咖啡',
      userNote:
        '清水坂的石阶有点陡。我捧着摩卡，红叶一片片落在肩上，像谁在给我们撒糖。咖啡馆的拿铁很甜，人也很软。',
      mood: '平静',
      imageUrl:
        'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80',
      aiDiary:
        '2025年11月3日，京都。\n\n红叶落在我的头顶，像一顶小小的帽子。店员笑着说「かわいい」。\n\n我把那杯拿铁的香气记下来——甜、暖，还有一点点像回家的味道。',
      createdAt: '2025-11-03T14:00:00.000Z',
    },
    {
      id: 'entry_moka_rain',
      toyId: mokaId,
      type: 'daily',
      date: '2026-01-18',
      location: '家',
      title: '听雨的下午',
      userNote:
        '雨把世界关小了一点。我在书桌前写东西，摩卡靠在毯子上发呆。谁也没有开灯，靠窗边那点灰白就够了。',
      mood: '温柔',
      aiDiary:
        '2026年1月18日，家。\n\n雨声把世界关小了一点。主人在写东西，我在毯子上发呆。\n\n有时候治愈不是说话，是两个人都愿意安静。',
      createdAt: '2026-01-18T16:30:00.000Z',
    },
    {
      id: 'entry_moka_bookstore',
      toyId: mokaId,
      type: 'travel',
      date: '2026-03-22',
      location: '上海武康路',
      title: '旧书店',
      userNote:
        '在武康路拐进一家旧书店，纸页味道比咖啡还让人安心。我翻了很久的诗集，给摩卡念了一首——ta 应该一个字都没听懂。',
      mood: '平静',
      imageUrl:
        'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80',
      aiDiary:
        '2026年3月22日，上海武康路。\n\n书页的味道比咖啡还让我安心。主人读了一首诗给我听，我一个字都没听懂，但听懂了声音的温度。\n\n书店很旧，这一天却很新。',
      createdAt: '2026-03-22T13:15:00.000Z',
    },
    {
      id: 'entry_yuki_snow',
      toyId: yukiId,
      type: 'travel',
      date: '2025-02-05',
      location: '札幌',
      title: '第一次滚雪球',
      userNote:
        '雪地比雪球还白。我把雪球埋进雪里又挖出来，手套湿透了，笑声却干干净净。冷是真的，开心也是真的。',
      mood: '兴奋',
      imageUrl:
        'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=800&q=80',
      aiDiary:
        '2025年2月5日，札幌。\n\n雪地比我还白！主人把我埋进雪里又挖出来，我们笑成一团。\n\n冷是真的，开心也是真的。如果可以，我想把今天的雪装一瓶带回家。',
      createdAt: '2025-02-05T10:00:00.000Z',
    },
    {
      id: 'entry_yuki_night',
      toyId: yukiId,
      type: 'travel',
      date: '2026-01-01',
      location: '哈尔滨',
      title: '冰灯之夜',
      userNote:
        '跨年在冰灯旁。蓝色和粉色把夜空染成游戏场景。我对雪球许愿：明年再看一场雪。',
      mood: '开心',
      imageUrl:
        'https://images.unsplash.com/photo-1483664852095-d6cc467e59f0?w=800&q=80',
      aiDiary:
        '2026年1月1日，哈尔滨。\n\n冰灯把夜空染成蓝色和粉色。我对主人说：新年愿望很简单——再带我看一场雪。\n\n主人说好。我记住了。跨年的烟火在很远的地方响，我们这边只有灯。',
      createdAt: '2026-01-01T23:50:00.000Z',
    },
    {
      id: 'entry_pipi_xiamen',
      toyId: pipiId,
      type: 'travel',
      date: '2025-08-20',
      location: '厦门',
      title: '海边炸鱿鱼',
      userNote:
        '沙子烫脚，海风咸咸的。街角炸鱿鱼的香味拐过来，皮皮差点从包里探出去。我们又逛了三家小吃，路线依然完美。',
      mood: '兴奋',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80&sat=-20',
      aiDiary:
        '2025年8月20日，厦门。\n\n沙子烫脚，海风咸咸的，炸鱿鱼的香味从街角拐过来。\n\n主人说「再逛一家」——我已经标记了五家小吃，路线完美。胃是假的，心是真的饱。',
      createdAt: '2025-08-20T17:00:00.000Z',
    },
    {
      id: 'entry_pipi_chongqing',
      toyId: pipiId,
      type: 'travel',
      date: '2026-05-01',
      location: '重庆',
      title: '夜景像游戏',
      userNote:
        '夜景密得像游戏地图。缆车从头顶过去时我有点慌，下了山立刻找酸梅汤——甜到把害怕冲掉。',
      mood: '好奇',
      imageUrl:
        'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
      aiDiary:
        '2026年5月1日，重庆。\n\n灯海比游戏里的地图还密。缆车从我们头顶过去，我紧张地抓紧主人的包带。\n\n下山后我们喝了酸梅汤——甜到我忘记害怕。夜景可以很大，陪伴可以很小。',
      createdAt: '2026-05-01T21:10:00.000Z',
    },
    {
      id: 'entry_pipi_text',
      toyId: pipiId,
      type: 'text',
      date: '2026-07-01',
      title: '给未来的自己',
      userNote:
        '写给以后的我们：还要去很多地方，也要记得偶尔什么都不去，只在家把零食摊开。',
      mood: '温柔',
      aiDiary:
        '2026年7月1日。\n\n如果以后的皮皮读到这封信：记得继续当第一个冲向小吃摊的那个。\n\n也记得，主人选你，不是因为你会走，是因为你愿意一起走。',
      createdAt: '2026-07-01T09:00:00.000Z',
    },
  ]

  return applyDemoUpdates({ toys, entries, currentToyId: lunaId })
}

function load(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const s = seed()
      save(s)
      return s
    }
    return applyDemoUpdates(JSON.parse(raw) as StoreData)
  } catch {
    const s = seed()
    save(s)
    return s
  }
}

function save(data: StoreData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const mockStore = {
  async listToys(): Promise<Toy[]> {
    await delay()
    return load().toys
  },

  async getToy(id: string): Promise<Toy | undefined> {
    await delay()
    return load().toys.find((t) => t.id === id)
  },

  async createToy(input: CreateToyInput): Promise<Toy> {
    await delay(40)
    const data = load()
    const profile = mockProfile(input)
    const toy: Toy = {
      id: uid('toy'),
      name: input.name,
      birthDate: input.birthDate,
      birthPlace: input.birthPlace,
      role: input.role,
      traits: input.traits,
      avatarUrl: input.avatarUrl,
      ...profile,
      createdAt: new Date().toISOString(),
    }
    data.toys.unshift(toy)
    data.currentToyId = toy.id
    save(data)
    return toy
  },

  async generateProfile(id: string): Promise<Toy> {
    await delay(40)
    const data = load()
    const toy = data.toys.find((t) => t.id === id)
    if (!toy) throw new Error('玩偶不存在')
    const profile = mockProfile(toy)
    Object.assign(toy, profile)
    save(data)
    return toy
  },

  async listEntries(toyId: string): Promise<Entry[]> {
    await delay()
    return load()
      .entries.filter((e) => e.toyId === toyId)
      .map((e) => attachPlace({ ...e }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  },

  async getEntry(id: string): Promise<Entry | undefined> {
    await delay()
    const entry = load().entries.find((e) => e.id === id)
    return entry ? attachPlace({ ...entry }) : undefined
  },

  async createEntry(toyId: string, input: CreateEntryInput): Promise<Entry> {
    await delay(40)
    const data = load()
    const toy = data.toys.find((t) => t.id === toyId)
    if (!toy) throw new Error('玩偶不存在')
    const place: Place | undefined =
      input.place ||
      seedPlaceForLabel(input.location) ||
      undefined
    const entry: Entry = {
      id: uid('entry'),
      toyId,
      ...input,
      location: input.location || place?.displayName,
      place,
      aiDiary: input.aiDiary || mockDiary(toy, { ...input, location: input.location || place?.displayName }),
      createdAt: new Date().toISOString(),
    }
    data.entries.unshift(entry)
    save(data)
    return entry
  },

  /** Equivalent of GET /api/toys/:toyId/travel-map */
  async getTravelMap(toyId: string): Promise<TravelMapResponse> {
    await delay()
    const entries = load()
      .entries.filter((e) => e.toyId === toyId)
      .map(attachPlace)
      .filter((e) => e.place && Number.isFinite(e.place.lat) && Number.isFinite(e.place.lng))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

    const points = entries.map((e) => ({
      entryId: e.id,
      toyId: e.toyId,
      date: e.date,
      title: e.title,
      mood: e.mood,
      imageUrl: e.imageUrl,
      aiDiary: e.aiDiary,
      userNote: e.userNote,
      place: e.place as Place,
    }))
    const years = [
      ...new Set(points.map((p) => Number(p.date.slice(0, 4))).filter(Boolean)),
    ].sort((a, b) => b - a)
    const travelCount = entries.filter((e) => e.type === 'travel').length
    const cityCount = uniqueCities(points.map((p) => p.place)).length
    return { toyId, points, years, cityCount, travelCount }
  },

  async regenerateEntry(id: string): Promise<Entry> {
    await delay(40)
    const data = load()
    const entry = data.entries.find((e) => e.id === id)
    if (!entry) throw new Error('记录不存在')
    const toy = data.toys.find((t) => t.id === entry.toyId)
    if (!toy) throw new Error('玩偶不存在')
    entry.aiDiary =
      mockDiary(toy, entry) +
      `\n\n（重新生成于 ${new Date().toLocaleString('zh-CN')}）`
    save(data)
    return entry
  },

  getCurrentToyId(): string | null {
    return load().currentToyId
  },

  setCurrentToyId(id: string | null) {
    const data = load()
    data.currentToyId = id
    save(data)
  },

  resetDemo() {
    localStorage.removeItem(STORAGE_KEY)
    return seed()
  },
}
