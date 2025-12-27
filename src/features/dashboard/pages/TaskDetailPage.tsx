import { useState, useEffect, useRef } from 'react'
import { useParams, Navigate, Link, useNavigate } from 'react-router-dom'
import { useTasks } from '@/contexts/TaskContext'
import { useTemplates } from '@/contexts/TemplateContext'
import { cn } from '@/lib/utils'
import { 
  ArrowLeft, 
  Video, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Zap,
  Thermometer,
  Gauge,
  Factory,
  DollarSign,
  Percent,
  Clock,
  Loader2,
  StopCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const DECISION_API_URL =
  import.meta.env.VITE_AI_DECISION_API_URL || 'http://localhost:3001/api/agents/decision'

// 通用卡片容器组件 - 复用仪表盘样式
function DetailCard({ 
  className, 
  title,
  children,
  noPadding = false,
  headerRight
}: { 
  className?: string
  title?: string
  children?: React.ReactNode 
  noPadding?: boolean
  headerRight?: React.ReactNode
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
          {headerRight}
        </div>
      )}
      <div className={cn("flex-1 min-h-0 overflow-y-auto stock-scroll", !noPadding && "px-4 pb-4")}>
        {children}
      </div>
    </div>
  )
}

// 状态配置
const STATUS_CONFIG = {
  running: { label: '寻优中', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  analyzing: { label: '分析中', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  queued: { label: '队列中', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
}

// 曲线配置
const CURVE_CONFIG = [
  { key: 'fe', label: 'FE(CO)', unit: '%', color: '#34d399', icon: Activity, min: 80, max: 100 },
  { key: 'currentDensity', label: '电流密度', unit: 'mA/cm²', color: '#fbbf24', icon: Zap, min: 200, max: 300 },
  { key: 'temperature', label: '温度', unit: '°C', color: '#f43f5e', icon: Thermometer, min: 40, max: 60 },
  { key: 'cellVoltage', label: '电压', unit: 'V', color: '#3b82f6', icon: Gauge, min: 1.8, max: 2.5 },
]

// 数据点数量
const DATA_POINTS = 60

// 生成初始历史数据
function generateInitialHistory() {
  const history: Record<string, number[]> = {}
  CURVE_CONFIG.forEach(cfg => {
    const range = cfg.max - cfg.min
    const mid = (cfg.max + cfg.min) / 2
    history[cfg.key] = Array.from({ length: DATA_POINTS }, (_, i) => {
      // 模拟渐进式优化曲线
      const progress = i / DATA_POINTS
      const trend = cfg.key === 'fe' ? progress * 0.1 : -progress * 0.05
      return mid + (Math.random() - 0.5) * range * 0.3 + trend * range
    })
  })
  return history
}

// 物理代理模型（与 NewTaskCard / quantum_core.py 保持一致的近似形式）
function getSurrogateFE(j: number, T: number, v: number): number {
  const j_norm = (j - 250.0) / 150.0
  const fe_j = Math.exp(-0.5 * j_norm * j_norm)
  const fe_t = 0.9 + 0.2 * (T - 20) / 60.0
  const fe_v = (v / (v + 20.0)) * 1.5
  const fe_total = 95.0 * fe_j * fe_t * fe_v
  return Math.max(0, Math.min(99.9, fe_total))
}

function getSurrogateVoltage(j: number, T: number): number {
  const j_safe = Math.max(j, 1.0)
  const V0 = 1.5
  const Tafel_slope = 0.1
  const R_temp = 2.0 - 1.0 * (T - 20) / 60.0
  const v_ohmic = (j_safe / 1000.0) * R_temp
  const v_act = Tafel_slope * Math.log10(j_safe)
  return V0 + v_act + v_ohmic
}

// Mock Agent 日志
const MOCK_LOGS = [
  { time: '10:45:32', agent: 'VISION', message: '检测到电极表面状态正常，无气泡聚集', color: 'text-purple-400' },
  { time: '10:45:35', agent: 'QUANTUM', message: '优化迭代 #847：电流密度调整至 252 mA/cm²', color: 'text-cyan-400' },
  { time: '10:45:38', agent: 'DECISION', message: '应用新参数，预计 FE 提升 0.3%', color: 'text-amber-400' },
  { time: '10:45:42', agent: 'VISION', message: '确认参数变更后系统稳定', color: 'text-purple-400' },
  { time: '10:45:45', agent: 'QUANTUM', message: '收敛度分析：当前距最优解 3.2%', color: 'text-cyan-400' },
  { time: '10:45:48', agent: 'DECISION', message: '继续迭代，目标 FE > 92%', color: 'text-amber-400' },
  { time: '10:45:52', agent: 'VISION', message: '膜电极温度梯度在安全范围内', color: 'text-purple-400' },
  { time: '10:45:55', agent: 'QUANTUM', message: '优化迭代 #848：温度微调至 51.2°C', color: 'text-cyan-400' },
]

// SVG 实时曲线图组件
function RealtimeChart({ 
  data, 
  config,
  width = 600,
  height = 180
}: { 
  data: number[]
  config: typeof CURVE_CONFIG[0]
  width?: number
  height?: number
}) {
  const padding = { top: 10, right: 10, bottom: 20, left: 45 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // 计算路径
  const points = data.map((value, index) => {
    const x = padding.left + (index / (data.length - 1)) * chartWidth
    const y = padding.top + chartHeight - ((value - config.min) / (config.max - config.min)) * chartHeight
    return { x, y, value }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  
  // 渐变区域路径
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`

  // Y 轴刻度
  const yTicks = [config.min, (config.min + config.max) / 2, config.max]

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`gradient-${config.key}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={config.color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={config.color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 背景网格线 */}
      {yTicks.map((tick, i) => {
        const y = padding.top + chartHeight - ((tick - config.min) / (config.max - config.min)) * chartHeight
        return (
          <g key={i}>
            <line 
              x1={padding.left} 
              y1={y} 
              x2={width - padding.right} 
              y2={y} 
              stroke="#27272a" 
              strokeDasharray="4 4"
            />
            <text 
              x={padding.left - 8} 
              y={y + 4} 
              textAnchor="end" 
              className="text-[10px] fill-zinc-600 font-mono"
            >
              {tick.toFixed(config.key === 'cellVoltage' ? 1 : 0)}
            </text>
          </g>
        )
      })}

      {/* 渐变区域 */}
      <path d={areaD} fill={`url(#gradient-${config.key})`} />

      {/* 曲线 */}
      <path 
        d={pathD} 
        fill="none" 
        stroke={config.color} 
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 当前值点 */}
      <circle 
        cx={points[points.length - 1].x} 
        cy={points[points.length - 1].y} 
        r="4" 
        fill={config.color}
        className="animate-pulse"
      />

      {/* X 轴时间标签 */}
      <text 
        x={padding.left} 
        y={height - 4} 
        className="text-[9px] fill-zinc-600 font-mono"
      >
        -60s
      </text>
      <text 
        x={width - padding.right} 
        y={height - 4} 
        textAnchor="end"
        className="text-[9px] fill-zinc-600 font-mono"
      >
        现在
      </text>
    </svg>
  )
}

/**
 * 运行中任务详情页
 * 路由: /dashboard/task/:taskId
 */
export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { getTask, completeTask, updateTask } = useTasks()
  const { templates } = useTemplates()
  const [dataHistory, setDataHistory] = useState<Record<string, number[]>>(generateInitialHistory)
  const [logs, setLogs] = useState(MOCK_LOGS)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(600)
  const [isEnding, setIsEnding] = useState(false)
  // 本地实时计时显示
  const [liveTimeElapsed, setLiveTimeElapsed] = useState('')

  // 决策 Agent 调参（用于驱动曲线向目标收敛）
  const [setpoints, setSetpoints] = useState(() => ({
    currentDensity: 250,
    temperature: 50,
    co2Flow: 50,
  }))
  const setpointsRef = useRef(setpoints)
  useEffect(() => {
    setpointsRef.current = setpoints
  }, [setpoints])

  // Agent 循环控制
  const decisionInFlightRef = useRef(false)
  const lastDecisionAtRef = useRef(0)
  const latestValuesRef = useRef<Record<string, number>>({})
  const latestHistoryRef = useRef<Record<string, number[]>>({})

  const task = taskId ? getTask(taskId) : undefined

  // 初始化/同步 setpoints（来自任务当前条件）
  useEffect(() => {
    if (!task) return
    const base = task.currentConditions || task.initialConditions
    setSetpoints({
      currentDensity: base.currentDensity,
      temperature: base.temperature,
      co2Flow: base.co2Flow,
    })
  }, [task?.id])

  // 实时更新任务时长
  useEffect(() => {
    if (!task) return
    // 只要任务未完成/失败，都启动计时器
    if (task.status === 'completed' || task.status === 'failed') return

    const updateTimer = () => {
      const startTime = new Date(task.createdAt).getTime()
      const now = Date.now()
      const diff = Math.max(0, now - startTime)
      
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      
      const timeStr = hours > 0 
        ? `${hours}h ${minutes}m ${seconds}s`
        : `${minutes}m ${seconds}s`
      
      setLiveTimeElapsed(timeStr)
      
      // 每分钟同步一次到全局状态，避免频繁重渲染
      if (seconds === 0) {
        updateTask(task.id, { timeElapsed: timeStr })
      }
    }

    // 立即执行一次
    updateTimer()
    
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [task?.id, task?.status, task?.createdAt, updateTask])

  // 获取当前值
  const currentValues: Record<string, number> = Object.fromEntries(
    CURVE_CONFIG.map(cfg => [cfg.key, dataHistory[cfg.key]?.[dataHistory[cfg.key].length - 1] || 0])
  )

  // 让定时 Agent 循环读取到最新的数值/历史
  useEffect(() => {
    latestValuesRef.current = currentValues
    latestHistoryRef.current = dataHistory
  }, [currentValues, dataHistory])

  // 模拟实时数据更新
  useEffect(() => {
    const interval = setInterval(() => {
      const sp = setpointsRef.current

      setDataHistory(prev => {
        const next: Record<string, number[]> = {}
        CURVE_CONFIG.forEach(cfg => {
          const arr = prev[cfg.key] || []
          const lastVal = arr[arr.length - 1] || (cfg.max + cfg.min) / 2
          const range = cfg.max - cfg.min

          // 目标值（由 Decision Agent 动态 setpoints 驱动）
          let target: number | null = null
          if (cfg.key === 'currentDensity') target = sp.currentDensity
          if (cfg.key === 'temperature') target = sp.temperature
          if (cfg.key === 'cellVoltage') target = getSurrogateVoltage(sp.currentDensity, sp.temperature)
          if (cfg.key === 'fe') target = getSurrogateFE(sp.currentDensity, sp.temperature, sp.co2Flow)

          // 模拟带趋势的随机波动 + 控制回路（向 target 缓慢收敛）
          const trend = cfg.key === 'fe' ? 0.015 : 0.0
          const noise = (Math.random() - 0.5) * range * 0.06
          const control = target == null ? 0 : (target - lastVal) * 0.08

          let newVal = lastVal + noise + control + trend * range * 0.03
          newVal = Math.max(cfg.min, Math.min(cfg.max, newVal))
          next[cfg.key] = [...arr.slice(-(DATA_POINTS - 1)), newVal]
        })
        return next
      })

      // 偶尔添加新日志
      if (Math.random() > 0.6) {
        const agents = ['VISION', 'QUANTUM', 'DECISION']
        const colors = ['text-purple-400', 'text-cyan-400', 'text-amber-400']
        const messages = [
          '检测到反应参数波动，正在分析...',
          '优化迭代进行中，参数微调',
          '系统状态良好，继续监控',
          '电极表面无异常沉积物',
          '温度梯度在安全范围内',
        ]
        const idx = Math.floor(Math.random() * 3)
        const msgIdx = Math.floor(Math.random() * messages.length)
        const now = new Date()
        const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        setLogs(prev => [...prev.slice(-8), {
          time: timeStr,
          agent: agents[idx],
          message: messages[msgIdx],
          color: colors[idx]
        }])
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // ───────────────────────────────────────────────────────────
  // Agent: 异常监控 -> 决策调参（调用后端 AI Decision Agent）
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!taskId) return
    if (!task) return
    if (task.status === 'completed' || task.status === 'failed') return

    const interval = setInterval(async () => {
      if (!taskId) return
      if (decisionInFlightRef.current) return

      // 冷却：避免高频触发
      const now = Date.now()
      if (now - lastDecisionAtRef.current < 15_000) return

      const v = latestValuesRef.current
      const h = latestHistoryRef.current
      const fe = v.fe ?? 0
      const currentDensity = v.currentDensity ?? 0
      const temperature = v.temperature ?? 0
      const cellVoltage = v.cellVoltage ?? 0

      // 基础阈值检测（可后续接入更复杂的统计/分位数）
      const signals: string[] = []
      if (cellVoltage > 2.35) signals.push(`电压偏高 ${cellVoltage.toFixed(2)}V`)
      if (fe < 88) signals.push(`FE 偏低 ${fe.toFixed(1)}%`)
      if (temperature > 58) signals.push(`温度偏高 ${temperature.toFixed(1)}°C`)
      if (currentDensity > 290) signals.push(`电流密度偏高 ${currentDensity.toFixed(0)} mA/cm²`)

      // 斜率/突变检测（用最近两点）
      const vArr = h.cellVoltage || []
      if (vArr.length >= 2) {
        const dv = vArr[vArr.length - 1] - vArr[vArr.length - 2]
        if (dv > 0.12) signals.push(`电压突增 +${dv.toFixed(2)}V`)
      }
      const feArr = h.fe || []
      if (feArr.length >= 2) {
        const dfe = feArr[feArr.length - 1] - feArr[feArr.length - 2]
        if (dfe < -2.0) signals.push(`FE 快速下滑 ${dfe.toFixed(1)}%`)
      }

      if (signals.length === 0) return

      const severity: 'low' | 'medium' | 'high' =
        cellVoltage > 2.42 || fe < 85 || temperature > 59 ? 'high' : cellVoltage > 2.35 || fe < 88 ? 'medium' : 'low'

      const anomalyType = signals.length >= 2 ? 'combined' : (
        signals[0]?.includes('电压') ? 'voltage_spike' : signals[0]?.includes('FE') ? 'fe_drop' : signals[0]?.includes('温度') ? 'temp_over' : 'current_over'
      )

      const atIso = new Date().toISOString()
      const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

      // 写入任务状态：分析中
      updateTask(taskId, {
        status: 'analyzing',
        lastAnomaly: {
          type: anomalyType,
          severity,
          message: signals.join(' · '),
          at: atIso,
        },
      })

      // 写入日志：异常出现
      setLogs(prev => [
        ...prev.slice(-8),
        {
          time: timeStr,
          agent: 'VISION',
          message: `异常检测(${severity}): ${signals.join(' · ')}`,
          color: 'text-purple-400',
        },
        {
          time: timeStr,
          agent: 'DECISION',
          message: '已接收异常样本，调用决策 Agent 生成调参策略...',
          color: 'text-amber-400',
        },
      ])

      decisionInFlightRef.current = true
      lastDecisionAtRef.current = Date.now()

      try {
        const latestTask = getTask(taskId)
        const template = templates.find(t => t.id === latestTask?.templateId)

        const resp = await fetch(DECISION_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: latestTask,
            template,
            sample: {
              fe,
              currentDensity,
              temperature,
              cellVoltage,
            },
          }),
        })

        const data = await resp.json()
        if (!resp.ok) {
          throw new Error(data?.error || '决策 Agent 请求失败')
        }

        // 应用策略：更新 setpoints + 任务期望指标 + QUBO 调参
        const newSetpoints = {
          currentDensity: data.setpoints?.currentDensity ?? setpointsRef.current.currentDensity,
          temperature: data.setpoints?.temperature ?? setpointsRef.current.temperature,
          co2Flow: data.setpoints?.co2Flow ?? setpointsRef.current.co2Flow,
        }
        setSetpoints(newSetpoints)

        updateTask(taskId, {
          status: 'running',
          currentConditions: newSetpoints,
          expectedMetrics: data.expectedMetrics,
          quboConfig: JSON.stringify(data.quboTuning),
          lastDecisionAt: data.decidedAt,
        })

        const timeStr2 = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        setLogs(prev => [
          ...prev.slice(-8),
          {
            time: timeStr2,
            agent: 'QUANTUM',
            message: `QUBO 调参: α=${data.quboTuning?.alpha?.toFixed?.(2) ?? data.quboTuning?.alpha} β=${data.quboTuning?.beta?.toFixed?.(2) ?? data.quboTuning?.beta} γ=${data.quboTuning?.gamma?.toFixed?.(2) ?? data.quboTuning?.gamma} penalty=${data.quboTuning?.constraintPenalty}`,
            color: 'text-cyan-400',
          },
          {
            time: timeStr2,
            agent: 'DECISION',
            message: data.actionSummary || '已应用新参数并更新期望指标',
            color: 'text-amber-400',
          },
        ])
      } catch (e: any) {
        const timeStr2 = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        setLogs(prev => [
          ...prev.slice(-8),
          {
            time: timeStr2,
            agent: 'DECISION',
            message: `决策 Agent 调用失败：${e?.message || '未知错误'}（已回到监控态）`,
            color: 'text-rose-400',
          },
        ])
        updateTask(taskId, { status: 'running' })
      } finally {
        decisionInFlightRef.current = false
      }
    }, 2500)

    return () => clearInterval(interval)
  }, [taskId, task?.status, getTask, updateTask, templates])

  // 响应式图表宽度
  useEffect(() => {
    const updateWidth = () => {
      if (chartContainerRef.current) {
        setChartWidth(chartContainerRef.current.offsetWidth - 180) // 留出右侧数值区域的空间
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // 如果任务不存在，重定向到仪表盘
  if (!task) {
    return <Navigate to="/dashboard" replace />
  }

  // 如果任务已完成，重定向到历史详情页
  if (task.status === 'completed' || task.status === 'failed') {
    return <Navigate to={`/dashboard/history/${taskId}`} replace />
  }

  const statusConfig = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.running

  // Calculate accumulated data based on runtime
  const startTime = new Date(task.createdAt).getTime()
  const now = Date.now()
  const durationSeconds = Math.max(0, (now - startTime) / 1000)
  
  // Mock rates: 0.1 kg/s CO2, 50 ¥/kg CO value
  const co2Processed = durationSeconds * 0.1
  const coValue = co2Processed * 50

  // Mock 累计数据
  const feValue = currentValues.fe || 90
  const accumulatedData = {
    co2Processed: co2Processed,
    coValue: coValue,
    avgFE: feValue,
  }

  // 结束任务处理
  const handleEndTask = () => {
    if (!taskId) return
    setIsEnding(true)
    
    // 模拟数据打包过程
    setTimeout(() => {
      completeTask(taskId, {
        fe: parseFloat(feValue.toFixed(1)),
        voltage: parseFloat((currentValues.cellVoltage || 2.0).toFixed(2)),
        spc: parseFloat(((currentValues.spc || 30) + Math.random() * 5).toFixed(1)),
        co2Processed: parseFloat(co2Processed.toFixed(1)),
        coValue: parseFloat(coValue.toFixed(0)),
        completedAt: new Date().toISOString()
      })
      navigate(`/dashboard/history/${taskId}`)
    }, 1000)
  }

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/dashboard" 
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">{task.name}</h1>
            <p className="text-zinc-500 text-sm mt-0.5 flex items-center gap-3">
              <span>ID: {task.id}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {task.timeElapsed}
              </span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* 进度 / 持续时间 */}
          <div className="text-right flex items-center gap-2">
            <div className="text-right">
              <div className="text-lg font-bold text-zinc-100 font-mono">
                {liveTimeElapsed || task.timeElapsed || '0m 0s'}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">运行时长</div>
            </div>
          </div>

          {/* 手动结束任务按钮 */}
          <Button 
            variant="outline" 
            onClick={handleEndTask}
            disabled={isEnding}
            className="h-9 gap-2 rounded-full border-red-900/30 bg-red-950/10 text-red-400 hover:text-red-300 hover:bg-red-950/30 hover:border-red-900/50 transition-all"
          >
            {isEnding ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                正在归档...
              </>
            ) : (
              <>
                <StopCircle className="w-3.5 h-3.5" />
                结束任务
              </>
            )}
          </Button>

          {/* 状态标签 */}
          <div className={cn(
            "px-4 py-2 rounded-full border text-sm font-medium flex items-center gap-2",
            statusConfig.color
          )}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {statusConfig.label}
          </div>
        </div>
      </div>

      {/* 主内容网格 */}
      <div className="grid grid-cols-3 gap-4" style={{ gridTemplateRows: '320px auto' }}>
        
        {/* 视频监控卡片 - 大卡片 */}
        <DetailCard 
          title="实时视频监控" 
          className="col-span-2 row-span-1"
          headerRight={
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>
          }
        >
          <div className="h-full flex items-center justify-center bg-zinc-900/50 rounded-lg border border-zinc-800/50 relative overflow-hidden">
            {/* 模拟视频画面 */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800/50 to-zinc-900">
              {/* 网格线效果 */}
              <div className="absolute inset-0 opacity-10">
                {[...Array(10)].map((_, i) => (
                  <div key={`h-${i}`} className="absolute w-full h-px bg-cyan-500" style={{ top: `${i * 10}%` }} />
                ))}
                {[...Array(10)].map((_, i) => (
                  <div key={`v-${i}`} className="absolute h-full w-px bg-cyan-500" style={{ left: `${i * 10}%` }} />
                ))}
              </div>
              {/* 中心十字准星 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 border border-cyan-500/30 rounded-lg flex items-center justify-center">
                  <div className="w-4 h-px bg-cyan-500/50" />
                  <div className="w-px h-4 bg-cyan-500/50 absolute" />
                </div>
              </div>
            </div>
            
            {/* 视频信息覆盖层 */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <Video className="w-4 h-4 text-zinc-500" />
              <span className="text-xs font-mono text-zinc-500">CAM-01 | 1080p 30fps</span>
            </div>
            <div className="absolute bottom-3 left-3 text-xs font-mono text-zinc-600">
              {new Date().toLocaleString('zh-CN')}
            </div>
            
            {/* 模拟电极区域标注 */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="w-32 h-20 border-2 border-dashed border-cyan-500/30 rounded flex items-center justify-center">
                <span className="text-[10px] text-cyan-500/50 uppercase tracking-wider">电极区域</span>
              </div>
            </div>
          </div>
        </DetailCard>

        {/* 商业价值仪表盘 */}
        <DetailCard title="任务产出统计" className="col-span-1 row-span-1" noPadding>
          <div className="h-full flex flex-col justify-between py-2">
            {/* 1. CO2 Processed */}
            <div className="group px-6 py-3 rounded-lg transition-colors hover:bg-zinc-900/40 cursor-default">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-300">
                  <Factory className="w-4 h-4" />
                  <span className="text-xs font-medium tracking-wide">累计 CO₂ 处理量</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  +2.3%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-zinc-100 tracking-tight">{accumulatedData.co2Processed.toFixed(1)}</span>
                <span className="text-sm font-medium text-zinc-500">kg</span>
              </div>
            </div>

            {/* Divider */}
            <div className="mx-6 h-px bg-zinc-900/50" />

            {/* 2. Market Value */}
            <div className="group px-6 py-3 rounded-lg transition-colors hover:bg-zinc-900/40 cursor-default">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-300">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs font-medium tracking-wide">CO 产物估值</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  +1.5%
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg text-zinc-500 font-light">¥</span>
                <span className="text-3xl font-bold text-zinc-100 tracking-tight">{accumulatedData.coValue.toFixed(0)}</span>
              </div>
            </div>

            {/* Divider */}
            <div className="mx-6 h-px bg-zinc-900/50" />

            {/* 3. Avg FE Efficiency */}
            <div className="group px-6 py-3 rounded-lg transition-colors hover:bg-zinc-900/40 cursor-default">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-300">
                  <Percent className="w-4 h-4" />
                  <span className="text-xs font-medium tracking-wide">平均法拉第效率</span>
                </div>
                {accumulatedData.avgFE >= 90 ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3" />
                    目标达成
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    <TrendingDown className="w-3 h-3" />
                    优化中
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-3xl font-bold tracking-tight",
                  accumulatedData.avgFE >= 90 ? "text-emerald-400" : "text-zinc-100"
                )}>
                  {accumulatedData.avgFE.toFixed(1)}
                </span>
                <span className="text-sm font-medium text-zinc-500">%</span>
              </div>
            </div>
          </div>
        </DetailCard>

        {/* 反应参数监控 - 曲线图 + 右侧胶囊数值 */}
        <DetailCard 
          title="反应参数实时曲线" 
          className="col-span-2"
          headerRight={
            <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              实时更新 1Hz
            </span>
          }
          noPadding
        >
          <div ref={chartContainerRef} className="h-full flex">
            {/* 左侧曲线图区域 */}
            <div className="flex-1 flex flex-col py-2 pl-2 overflow-hidden">
              {CURVE_CONFIG.map((cfg, idx) => (
                <div key={cfg.key} className={cn(
                  "flex-1 min-h-0",
                  idx < CURVE_CONFIG.length - 1 && "border-b border-zinc-900/50"
                )}>
                  <div className="h-full flex items-center">
                    <RealtimeChart 
                      data={dataHistory[cfg.key] || []} 
                      config={cfg}
                      width={chartWidth}
                      height={55}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 右侧胶囊数值区域 */}
            <div className="w-[160px] flex flex-col p-3 border-l border-zinc-900/50 space-y-2">
              {CURVE_CONFIG.map(cfg => {
                const Icon = cfg.icon
                const value = currentValues[cfg.key] || 0
                return (
                  <div 
                    key={cfg.key}
                    className="flex-1 flex items-center gap-2 px-3 py-2 rounded-full border"
                    style={{ 
                      backgroundColor: `${cfg.color}10`,
                      borderColor: `${cfg.color}30`
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-zinc-500 truncate">{cfg.label}</div>
                      <div className="text-sm font-bold text-zinc-100">
                        {value.toFixed(cfg.key === 'cellVoltage' ? 2 : 1)}
                        <span className="text-[10px] text-zinc-500 ml-0.5">{cfg.unit}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </DetailCard>

        {/* Agent 运行日志 */}
        <DetailCard 
          title="Agent 运行日志" 
          className="col-span-1"
          noPadding
        >
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-[11px]">
              {logs.map((log, idx) => (
                <div key={idx} className="flex gap-2 py-1 border-b border-zinc-900/50 last:border-0">
                  <span className="text-zinc-600 flex-shrink-0">{log.time}</span>
                  <span className={cn("font-semibold flex-shrink-0 w-16", log.color)}>[{log.agent}]</span>
                  <span className="text-zinc-400 truncate">{log.message}</span>
                </div>
              ))}
            </div>
            {/* 底部闪烁光标 */}
            <div className="px-3 py-2 border-t border-zinc-900/50 flex items-center gap-2">
              <span className="w-2 h-4 bg-cyan-500 animate-pulse" />
              <span className="text-[10px] text-zinc-600">等待新日志...</span>
            </div>
          </div>
        </DetailCard>
      </div>
    </div>
  )
}
