import { useEffect, useState } from 'react'
import { resolveChatBubbleImageUrl } from '../media/photoStorage'

/**
 * Chat messages have no hydration pass — entries get one in `api/client.ts` —
 * so the durable `toydiary-media://` reference a message stores is turned back
 * into a served URL here, once, on mount. On web the resolver is a passthrough
 * and the raw value renders as before.
 */
export function ChatImage({
  src,
  localPath,
  alt,
  className,
}: {
  src?: string
  localPath?: string
  alt: string
  className?: string
}) {
  const [resolved, setResolved] = useState<string>()

  useEffect(() => {
    if (!src) return
    let active = true
    void resolveChatBubbleImageUrl(src, localPath)
      .then((url) => {
        if (active) setResolved(url)
      })
      .catch(() => {
        // resolver already falls back internally; keep the bubble empty
      })
    return () => {
      active = false
    }
  }, [src, localPath])

  if (!src) return null
  // Placeholder keeps the bubble from jumping while the file URL resolves.
  if (!resolved) return <div className={`${className ?? ''} bg-line/30`} aria-hidden="true" />
  return <img src={resolved} alt={alt} className={className} />
}
