import { cn } from '@/lib/utils'

// 通用卡片容器组件
function DashboardCard({ 
  className, 
  title,
  children 
}: { 
  className?: string
  title?: string
  children?: React.ReactNode 
}) {
  return (
    <div
      className={cn(
        'rounded-xl bg-zinc-950 border border-zinc-900 shadow-[0_10px_60px_rgba(0,0,0,0.35)] h-full flex flex-col overflow-hidden',
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <span className="text-[15px] font-semibold text-zinc-100 tracking-tight">{title}</span>
        </div>
      )}
      <div className="flex-1 min-h-0 px-4 pb-4 overflow-y-auto stock-scroll">
        {children || (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            内容区域
          </div>
        )}
      </div>
    </div>
  )
}

export function OverviewPage() {
  return (
    <div
      className={cn(
        'grid gap-4',
        // 大屏：3列 x 6行，固定行高 160px
        'lg:[grid-template-columns:repeat(3,1fr)]',
        'lg:[grid-template-rows:repeat(6,160px)]'
      )}
    >
      {/* 左上两张方卡 */}
      <DashboardCard 
        title="卡片 1" 
        className="lg:col-start-1 lg:row-start-1 lg:row-span-2" 
      />
      <DashboardCard 
        title="卡片 2" 
        className="lg:col-start-2 lg:row-start-1 lg:row-span-2" 
      />

      {/* 右上长卡（跨三行） */}
      <DashboardCard 
        title="卡片 3" 
        className="lg:col-start-3 lg:row-start-1 lg:row-span-3" 
      />

      {/* 左中两张方卡 */}
      <DashboardCard 
        title="卡片 4" 
        className="lg:col-start-1 lg:row-start-3 lg:row-span-2" 
      />
      <DashboardCard 
        title="卡片 5" 
        className="lg:col-start-2 lg:row-start-3 lg:row-span-2" 
      />

      {/* 右下长卡（与上方长卡等高） */}
      <DashboardCard 
        title="卡片 6" 
        className="lg:col-start-3 lg:row-start-4 lg:row-span-3" 
      />

      {/* 底部横向宽卡（跨两列） */}
      <DashboardCard 
        title="卡片 7" 
        className="lg:col-start-1 lg:col-span-2 lg:row-start-5 lg:row-span-2" 
      />
    </div>
  )
}
