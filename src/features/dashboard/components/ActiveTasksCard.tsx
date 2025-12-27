import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Activity, Clock, Cpu, CheckCircle2, AlertCircle, Box } from 'lucide-react'
import { useTasks } from '@/contexts/TaskContext'
import type { TaskStatus } from '@/contexts/TaskContext'
import { useEffect, useState } from 'react'

// Live Duration Component
function TaskDuration({ createdAt }: { createdAt: string }) {
  const [duration, setDuration] = useState('')

  useEffect(() => {
    const update = () => {
      const start = new Date(createdAt).getTime()
      const now = Date.now()
      const diff = Math.max(0, now - start)
      
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      
      const str = hours > 0 
        ? `${hours}h ${minutes}m ${seconds}s`
        : `${minutes}m ${seconds}s`
      setDuration(str)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [createdAt])

  return <span>{duration}</span>
}

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
  const navigate = useNavigate()
  const { runningTasks } = useTasks()

  if (runningTasks.length === 0) {
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
      {runningTasks.map((task) => {
        const config = STATUS_CONFIG[task.status] || STATUS_CONFIG['queued']
        const Icon = config.icon

        return (
          <div 
            key={task.id}
            onClick={() => navigate(`/dashboard/task/${task.id}`)}
            className="group flex items-center justify-between p-4 border-b border-zinc-900/50 last:border-0 hover:bg-zinc-900/30 transition-colors cursor-pointer"
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
              <div className="flex flex-col">
                <span className="text-xs text-zinc-500 truncate font-medium group-hover:text-zinc-400 transition-colors">
                    {task.name}
                </span>
              </div>
            </div>

            {/* Right: Status & Info */}
            <div className="flex items-center gap-3">
              {/* Progress/Time */}
              <div className="text-right hidden sm:block">
                <div className="text-[10px] font-mono text-zinc-500">
                  {task.status === 'running' || task.status === 'analyzing' 
                    ? <TaskDuration createdAt={task.createdAt} />
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

