import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { ToyCardCarousel } from '../components/ToyCardCarousel'
import { useApp } from '../context/AppContext'

export function ToysPage() {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()
  const { toys, showToast } = useApp()

  function goNewToy() {
    if (!isLoggedIn) {
      showToast('创建玩偶档案需要先登录')
      navigate('/login')
      return
    }
    navigate('/toys/new')
  }
  return (
    <>
      <PageHeader
        title="我的玩偶"
        subtitle={`${toys.length} 位陪伴伙伴`}
        soft
        right={
          <button
            type="button"
            onClick={goNewToy}
            className="btn-primary h-9 w-9"
            aria-label="新增玩偶"
            title="新增玩偶"
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </button>
        }
      />

      <div className="px-4 pb-5 pt-3">
        {toys.length === 0 ? (
          <EmptyState
            title="还没有玩偶"
            desc={
              isLoggedIn
                ? '创建第一只玩偶，生成身份卡吧。'
                : '游客可浏览演示数据；创建档案需登录。'
            }
            action={
              <button
                type="button"
                onClick={goNewToy}
                className="btn-primary px-6 py-2.5 text-sm"
              >
                {isLoggedIn ? '新建玩偶' : '去登录'}
              </button>
            }
          />
        ) : <ToyCardCarousel />}
      </div>
    </>
  )
}
