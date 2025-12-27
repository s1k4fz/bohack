import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

// Types
interface LogEntry {
  id: string
  timestamp: string
  agent: 'VISION' | 'QUANTUM' | 'DECISION'
  taskId: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

// Mock Data
const MOCK_LOGS: LogEntry[] = [
  { id: 'L-101', timestamp: '10:42:05', agent: 'VISION', taskId: 'T-8821', message: '检测到气泡生成速率 > 0.8mm/s', type: 'info' },
  { id: 'L-102', timestamp: '10:42:06', agent: 'QUANTUM', taskId: 'T-8821', message: '正在映射约束矩阵 (N=128 qubits)', type: 'info' },
  { id: 'L-103', timestamp: '10:42:08', agent: 'QUANTUM', taskId: 'T-8821', message: '退火完成。系统能量: -14.2 eV', type: 'success' },
  { id: 'L-104', timestamp: '10:42:09', agent: 'DECISION', taskId: 'T-8821', message: '自动校准电压参数至 2.4V', type: 'info' },
  { id: 'L-105', timestamp: '10:42:15', agent: 'VISION', taskId: 'T-8822', message: '表面重构分析进行中...', type: 'info' },
  { id: 'L-106', timestamp: '10:42:18', agent: 'QUANTUM', taskId: 'T-8822', message: 'QUBO 哈密顿量收敛性检查通过', type: 'success' },
  { id: 'L-107', timestamp: '10:42:20', agent: 'DECISION', taskId: 'T-8819', message: '警告: 检测到 pH 传感器漂移', type: 'warning' },
  { id: 'L-108', timestamp: '10:42:21', agent: 'VISION', taskId: 'T-8821', message: '正在验证 FE(CO) 稳定性', type: 'info' },
  { id: 'L-109', timestamp: '10:42:25', agent: 'QUANTUM', taskId: 'T-8821', message: '优化下一批次寻优轨迹', type: 'info' },
  { id: 'L-110', timestamp: '10:42:30', agent: 'DECISION', taskId: 'T-8821', message: '执行周期已完成', type: 'success' },
]

// Agent Colors Configuration
const AGENT_CONFIG = {
  VISION: { color: 'text-purple-400', label: 'VIS' },
  QUANTUM: { color: 'text-cyan-400', label: 'QPU' },
  DECISION: { color: 'text-amber-400', label: 'DEC' },
}

export function AgentLiveLogsCard() {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  return (
    <div className="h-full flex flex-col font-mono text-[11px] leading-relaxed pt-2">
      {/* Logs Container */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 stock-scroll">
        {MOCK_LOGS.map((log) => {
          const agentStyle = AGENT_CONFIG[log.agent]
          return (
            <div key={log.id} className="flex gap-3 group opacity-80 hover:opacity-100 transition-opacity">
              {/* Timestamp */}
              <span className="text-zinc-600 shrink-0 select-none">
                {log.timestamp}
              </span>

              {/* Log Content */}
              <div className="flex-1 min-w-0 break-words">
                {/* Prefix */}
                <span className="mr-2 text-zinc-500 select-none">
                  [{log.taskId}]
                </span>
                
                {/* Agent Label */}
                <span className={cn("mr-2 font-bold", agentStyle.color)}>
                  {agentStyle.label}
                  {'>'}
                </span>

                {/* Message */}
                <span className={cn(
                  "text-zinc-300",
                  log.type === 'warning' && "text-amber-300",
                  log.type === 'error' && "text-red-400"
                )}>
                  {log.message}
                </span>
              </div>
            </div>
          )
        })}
        {/* Fake cursor at the end */}
        <div className="w-2 h-4 bg-zinc-500 animate-pulse mt-2" />
      </div>
    </div>
  )
}
