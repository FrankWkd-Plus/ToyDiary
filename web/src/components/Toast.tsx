import { useApp } from '../context/AppContext'

export function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(5.25rem,env(safe-area-inset-bottom))] z-[70] flex justify-center px-3 sm:bottom-8">
      <div className="flex w-full max-w-[390px] justify-center px-4">
        <div className="toast-enter max-w-[min(100%,20rem)] rounded-full border border-white/10 bg-ink/92 px-5 py-2.5 text-center text-sm font-medium text-white shadow-[var(--shadow-elevated)] backdrop-blur-md">
          {toast.message}
        </div>
      </div>
    </div>
  )
}
