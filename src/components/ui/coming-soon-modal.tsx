import { useState } from 'react'
import { X, Construction } from 'lucide-react'

interface ComingSoonModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ComingSoonModal({ isOpen, onClose }: ComingSoonModalProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-[101] -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-[320px] rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Construction className="w-7 h-7 text-zinc-500" />
            </div>
          </div>

          {/* Content */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-2">
              功能开发中
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed mb-1">
              此功能正在开发中
            </p>
            <p className="text-sm text-zinc-600">
              敬请期待后续更新 ✨
            </p>
          </div>

          {/* Button */}
          <button
            onClick={onClose}
            className="w-full mt-6 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            我知道了
          </button>
        </div>
      </div>
    </>
  )
}

// Hook for easy usage
export function useComingSoonModal() {
  const [isOpen, setIsOpen] = useState(false)
  
  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)
  
  return { isOpen, open, close }
}

