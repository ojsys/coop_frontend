import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

type Toast = { id: number; message: string; tone: 'success' | 'error' }
const ToastCtx = createContext<(message: string, tone?: 'success' | 'error') => void>(
  () => {},
)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-md border px-3.5 py-2.5 text-sm shadow-float ${
              t.tone === 'success'
                ? 'border-green-100 bg-card text-green'
                : 'border-danger-50 bg-card text-danger'
            }`}
          >
            <Icon name={t.tone === 'success' ? 'check_circle' : 'error'} size={18} fill />
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}
