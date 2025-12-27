import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { CheckCircle2, ArrowUpRight, Ban, Box } from 'lucide-react'
import { useTasks } from '@/contexts/TaskContext'

export function HistoryTasksCard() {
  const navigate = useNavigate()
  const { completedTasks } = useTasks()

  if (completedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-3 text-zinc-600">
        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
          <Box className="w-6 h-6 opacity-50" />
        </div>
        <p className="text-sm font-medium">暂无历史任务</p>
      </div>
    )
  }

  // 格式化时间显示
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = diff / (1000 * 60 * 60)
    
    if (hours < 24) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (hours < 48) {
      return '昨天'
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="flex flex-col h-full">
      {completedTasks.slice(0, 6).map((task) => {
        const isSuccess = task.status === 'completed'
        const feScore = task.result?.fe || 0

        return (
          <div 
            key={task.id}
            onClick={() => navigate(`/dashboard/history/${task.id}`)}
            className="group flex items-center justify-between p-4 border-b border-zinc-900/50 last:border-0 hover:bg-zinc-900/30 transition-colors cursor-pointer"
          >
            {/* Left: Info */}
            <div className="flex items-center gap-3">
              {/* Status Icon */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border transition-colors",
                isSuccess 
                  ? "bg-zinc-900 border-zinc-800 text-zinc-500 group-hover:text-zinc-300 group-hover:border-zinc-700" 
                  : "bg-red-950/20 border-red-900/30 text-red-700"
              )}>
                {isSuccess ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Ban className="w-4 h-4" />
                )}
              </div>
              
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                  {task.name}
                </span>
                <span className="text-[10px] text-zinc-600 font-mono">
                  {task.id} • {formatDate(task.createdAt)}
                </span>
              </div>
            </div>

            {/* Right: FE Score */}
            <div className="flex items-center gap-4">
              {isSuccess && task.result && (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">FE(CO)</span>
                  <span className={cn(
                    "font-mono text-sm font-bold",
                    feScore >= 90 ? "text-emerald-400" : "text-zinc-300"
                  )}>
                    {feScore}%
                  </span>
                </div>
              )}
              
              <ArrowUpRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
