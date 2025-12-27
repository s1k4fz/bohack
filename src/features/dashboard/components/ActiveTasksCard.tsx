import { cn } from '@/lib/utils'
import { Activity, Clock, Cpu, CheckCircle2, AlertCircle, Box } from 'lucide-react'

// Mock Data Types
type TaskStatus = 'running' | 'queued' | 'analyzing' | 'completed' | 'failed'

interface Task {
  id: string
  name: string
  status: TaskStatus
  progress: number
  timeElapsed: string
}

// Mock Data
const MOCK_TASKS: Task[] = [
  { id: 'T-8821', name: '二氧化碳还原-Alpha', status: 'running', progress: 45, timeElapsed: '12m 30s' },
  { id: 'T-8822', name: '催化剂寻优-Beta', status: 'analyzing', progress: 88, timeElapsed: '45m 10s' },
  { id: 'T-8823', name: '伊辛模型映射-Gamma', status: 'queued', progress: 0, timeElapsed: '0s' },
  { id: 'T-8820', name: '预检-Delta', status: 'completed', progress: 100, timeElapsed: '1h 20m' },
  { id: 'T-8819', name: '容错测试-Epsilon', status: 'failed', progress: 12, timeElapsed: '2m 15s' },
  { id: 'T-8824', name: '等待调度-Zeta', status: 'queued', progress: 0, timeElapsed: '0s' },
]

// Status Configuration
const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: any }> = {
  running: { 
    label: '寻优中', 
    color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    icon: Activity
  },
  analyzing: { 
    label: '分析中', 
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    icon: Cpu
  },
  queued: { 
    label: '队列中', 
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    icon: Clock
  },
  completed: { 
    label: '已完成', 
    color: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    icon: CheckCircle2
  },
  failed: { 
    label: '异常', 
    color: 'bg-red-500/10 text-red-500 border-red-500/20',
    icon: AlertCircle
  },
}

export function ActiveTasksCard() {
  const tasks = MOCK_TASKS.filter(t => t.status !== 'completed')

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-3 text-zinc-600">
        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
          <Box className="w-6 h-6 opacity-50" />
        </div>
        <p className="text-sm font-medium">暂无活跃任务</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {tasks.map((task) => {
        const config = STATUS_CONFIG[task.status]
        const Icon = config.icon

        return (
          <div 
            key={task.id}
            className="group flex items-center justify-between p-4 border-b border-zinc-900/50 last:border-0 hover:bg-zinc-900/30 transition-colors"
          >
            {/* Left: ID & Name */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-zinc-300 tracking-wider">
                  {task.id}
                </span>
                {task.status === 'running' && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-500 truncate font-medium group-hover:text-zinc-400 transition-colors">
                {task.name}
              </span>
            </div>

            {/* Right: Status & Info */}
            <div className="flex items-center gap-3">
              {/* Progress/Time */}
              <div className="text-right hidden sm:block">
                <div className="text-[10px] font-mono text-zinc-500">
                  {task.status === 'running' || task.status === 'analyzing' 
                    ? `${task.progress}%` 
                    : task.timeElapsed}
                </div>
              </div>

              {/* Status Badge */}
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium uppercase tracking-wider min-w-[70px] justify-center",
                config.color
              )}>
                <Icon className="w-3 h-3" />
                {config.label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

