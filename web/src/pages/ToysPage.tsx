import { useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { ToyCardCarousel } from '../components/ToyCardCarousel'
import { useApp } from '../context/AppContext'
import { useLocale } from '../i18n'

export function ToysPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useLocale()
  const { toys } = useApp()
  const fromMe =
    (location.state as { from?: string } | null)?.from === 'me'

  function goNewToy() {
    navigate('/toys/new')
  }
  return (
    <>
      <PageHeader
        title={t('toys.title')}
        subtitle={t('toys.subtitle', { n: toys.length })}
        back={fromMe ? '/me' : '/archive'}
        soft
        right={
          <button
            type="button"
            onClick={goNewToy}
            className="btn-primary h-9 w-9"
            aria-label={t('toys.new')}
            title={t('toys.new')}
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </button>
        }
      />

      <div className="px-4 pb-5 pt-3">
        {toys.length === 0 ? (
          <EmptyState
            title={t('toys.emptyTitle')}
            desc={t('toys.emptyDesc')}
            action={
              <button
                type="button"
                onClick={goNewToy}
                className="btn-primary px-6 py-2.5 text-sm"
              >
                {t('toys.new')}
              </button>
            }
          />
        ) : (
          <ToyCardCarousel />
        )}
      </div>
    </>
  )
}
