import { ChevronRight, FlaskConical } from 'lucide-react'
import { Link } from 'react-router-dom'

/** Persistent reminder that the records on screen are sample data. */
export function DemoModeBanner() {
  return (
    <Link
      to="/me/demo"
      className="demo-banner"
      aria-label="当前为演示模式，示例数据不影响真实记录；点按打开演示模式设置"
    >
      <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
      <span>演示模式 · 示例数据，不影响真实记录</span>
      <ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
    </Link>
  )
}
