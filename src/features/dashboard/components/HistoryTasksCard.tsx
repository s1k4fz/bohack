import { cn } from '@/lib/utils'
import { CheckCircle2, ArrowUpRight, Ban } from 'lucide-react'

// Mock Data Types
interface HistoryTask {
  id: string
  name: string
  feScore: number // 法拉第效率 FE(CO) %
  date: string
  status: 'success' | 'failed'
}

// Mock Data
const MOCK_HISTORY: HistoryTask[] = [
  { id: 'T-8820', name: '预检-Delta', feScore: 92.4, date: '10:30 AM', status: 'success' },
  { id: 'T-8818', name: '基准测试-V1', feScore: 89.1, date: 'Yesterday', status: 'success' },
  { id: 'T-8815', name: '高压环境-Alpha', feScore: 94.8, date: 'Oct 24', status: 'success' },
  { id: 'T-8812', name: '异常重试-Beta', feScore: 0, date: 'Oct 23', status: 'failed' },
  { id: 'T-8810', name: '初始校准', feScore: 85.2, date: 'Oct 22', status: 'success' },
  { id: 'T-8809', name: '量子映射-Test', feScore: 88.5, date: 'Oct 21', status: 'success' },
]

export function HistoryTasksCard() {
  const tasks = MOCK_HISTORY

  return (
    <div className="flex flex-col h-full">
      {tasks.map((task) => (
        <div 
          key={task.id}
          className="group flex items-center justify-between p-4 border-b border-zinc-900/50 last:border-0 hover:bg-zinc-900/30 transition-colors cursor-pointer"
        >
          {/* Left: Info */}
          <div className="flex items-center gap-3">
            {/* Status Icon */}
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center border transition-colors",
              task.status === 'success' 
                ? "bg-zinc-900 border-zinc-800 text-zinc-500 group-hover:text-zinc-300 group-hover:border-zinc-700" 
                : "bg-red-950/20 border-red-900/30 text-red-700"
            )}>
              {task.status === 'success' ? (
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
                {task.id} • {task.date}
              </span>
            </div>
          </div>

          {/* Right: FE Score */}
          <div className="flex items-center gap-4">
            {task.status === 'success' && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">FE(CO)</span>
                <span className={cn(
                  "font-mono text-sm font-bold",
                  task.feScore >= 90 ? "text-emerald-400" : "text-zinc-300"
                )}>
                  {task.feScore}%
                </span>
              </div>
            )}
            
            <ArrowUpRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
          </div>
        </div>
      ))}
    </div>
  )
}



