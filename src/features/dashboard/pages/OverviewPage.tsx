import { cn } from '@/lib/utils'
import { NewTaskCard } from '../components/NewTaskCard'
import { ActiveTasksCard } from '../components/ActiveTasksCard'
import { HistoryTasksCard } from '../components/HistoryTasksCard'
import { ImpactLedgerCard } from '../components/ImpactLedgerCard'
import { AgentLiveLogsCard } from '../components/AgentLiveLogsCard'
import { ParameterTemplatesCard } from '../components/ParameterTemplatesCard'
import { AiChatCard } from '../components/AiChatCard'

// 通用卡片容器组件
function DashboardCard({ 
  className, 
  title,
  children,
  noPadding = false
}: { 
  className?: string
  title?: string
  children?: React.ReactNode 
  noPadding?: boolean
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
      <div className={cn("flex-1 min-h-0 overflow-y-auto stock-scroll", !noPadding && "px-4 pb-4")}>
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
      {/* 1. 新建任务 (New Task) - 2x2 格子中的左上角 */}
      <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2">
        <NewTaskCard />
      </div>

      <DashboardCard 
        title="活跃任务" 
        className="lg:col-start-2 lg:row-start-1 lg:row-span-2" 
        noPadding={true}
      >
        <ActiveTasksCard />
      </DashboardCard>

      {/* 右上长卡（跨三行） */}
      <DashboardCard 
        title="Agent 运行日志" 
        className="lg:col-start-3 lg:row-start-1 lg:row-span-3" 
        noPadding={true}
      >
        <AgentLiveLogsCard />
      </DashboardCard>

      {/* 左中两张方卡 */}
      <DashboardCard 
        title="历史任务" 
        className="lg:col-start-1 lg:row-start-3 lg:row-span-2" 
        noPadding={true}
      >
        <HistoryTasksCard />
      </DashboardCard>
      
      <DashboardCard 
        title="商业价值看板" 
        className="lg:col-start-2 lg:row-start-3 lg:row-span-2" 
        noPadding={true}
      >
        <ImpactLedgerCard />
      </DashboardCard>

      {/* 右下长卡（与上方长卡等高） */}
      <DashboardCard 
        title="AI 对话" 
        className="lg:col-start-3 lg:row-start-4 lg:row-span-3" 
        noPadding={true}
      >
        <AiChatCard />
      </DashboardCard>

      {/* 底部横向宽卡（跨两列） */}
      <DashboardCard 
        title="预设参数模板库" 
        className="lg:col-start-1 lg:col-span-2 lg:row-start-5 lg:row-span-2" 
        noPadding={true}
      >
        <ParameterTemplatesCard />
      </DashboardCard>
    </div>
  )
}
