import { useState } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'
import { 
  ArrowLeft, 
  Activity, 
  TrendingUp,
  Zap,
  Thermometer,
  Gauge,
  Factory,
  DollarSign,
  Percent,
  Clock,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Calendar,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// 通用卡片容器组件
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

// 曲线配置
const CURVE_CONFIG = [
  { key: 'fe', label: 'FE(CO)', unit: '%', color: '#34d399', icon: Activity, min: 80, max: 100 },
  { key: 'currentDensity', label: '电流密度', unit: 'mA/cm²', color: '#fbbf24', icon: Zap, min: 200, max: 300 },
  { key: 'temperature', label: '温度', unit: '°C', color: '#f43f5e', icon: Thermometer, min: 40, max: 60 },
  { key: 'cellVoltage', label: '电压', unit: 'V', color: '#3b82f6', icon: Gauge, min: 1.8, max: 2.5 },
]

// 生成全程历史数据 (Mock)
function generateFullHistory() {
  const points = 100
  const history: Record<string, number[]> = {}
  
  CURVE_CONFIG.forEach(cfg => {
    const range = cfg.max - cfg.min
    const mid = (cfg.max + cfg.min) / 2
    history[cfg.key] = Array.from({ length: points }, (_, i) => {
      // 模拟优化过程：前期波动大，后期收敛
      const progress = i / points
      const noise = (Math.random() - 0.5) * range * (0.3 * (1 - progress)) // 噪声随进度减小
      
      // 趋势项
      let trend = 0
      if (cfg.key === 'fe') trend = progress * range * 0.4 // FE 上升
      if (cfg.key === 'cellVoltage') trend = -progress * range * 0.2 // 电压下降
      if (cfg.key === 'currentDensity') trend = progress * range * 0.1 // 电流密度微升
      
      let val = mid + noise + trend
      return Math.max(cfg.min, Math.min(cfg.max, val))
    })
  })
  return history
}

// SVG 全程曲线图组件
function FullHistoryChart({ 
  data, 
  config,
  width = 600,
  height = 100
}: { 
  data: number[]
  config: typeof CURVE_CONFIG[0]
  width?: number
  height?: number
}) {
  const padding = { top: 10, right: 10, bottom: 20, left: 35 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // 计算路径
  const points = data.map((value, index) => {
    const x = padding.left + (index / (data.length - 1)) * chartWidth
    const y = padding.top + chartHeight - ((value - config.min) / (config.max - config.min)) * chartHeight
    return { x, y }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`gradient-history-${config.key}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={config.color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={config.color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y 轴刻度线 */}
      {[0, 0.5, 1].map((ratio, i) => {
        const y = padding.top + chartHeight * (1 - ratio)
        return (
          <g key={i}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#27272a" strokeDasharray="4 4" />
            <text x={padding.left - 6} y={y + 3} textAnchor="end" className="text-[9px] fill-zinc-600 font-mono">
              {(config.min + (config.max - config.min) * ratio).toFixed(1)}
            </text>
          </g>
        )
      })}

      <path d={areaD} fill={`url(#gradient-history-${config.key})`} />
      <path d={pathD} fill="none" stroke={config.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* X 轴标签 */}
      <text x={padding.left} y={height - 5} className="text-[9px] fill-zinc-600 font-mono">Start</text>
      <text x={width - padding.right} y={height - 5} textAnchor="end" className="text-[9px] fill-zinc-600 font-mono">End</text>
    </svg>
  )
}

// Mock 完整日志
const FULL_LOGS = [
  { time: '14:20:01', agent: 'SYSTEM', message: '任务初始化完成，加载参数模板 TPL-001', color: 'text-zinc-400' },
  { time: '14:20:05', agent: 'VISION', message: '初始环境扫描：电解槽状态正常', color: 'text-purple-400' },
  { time: '14:20:12', agent: 'QUANTUM', message: 'QUBO 求解器启动，初始权重 alpha=0.5', color: 'text-cyan-400' },
  { time: '14:25:30', agent: 'DECISION', message: '检测到电压波动，请求重新寻优', color: 'text-amber-400' },
  { time: '14:25:35', agent: 'QUANTUM', message: '调整 Ising 模型参数，迭代 #120', color: 'text-cyan-400' },
  { time: '14:40:15', agent: 'VISION', message: '气泡生成速率稳定，未检测到聚集', color: 'text-purple-400' },
  { time: '15:10:00', agent: 'DECISION', message: 'FE(CO) 达到 91.5%，锁定当前参数', color: 'text-amber-400' },
  { time: '15:30:22', agent: 'SYSTEM', message: '任务按计划完成，正在生成报告', color: 'text-emerald-400' },
  { time: '15:30:25', agent: 'SYSTEM', message: '数据归档完成，ID: T-8810', color: 'text-zinc-400' },
]

export function HistoryDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const { getTask } = useTasks()
  const [historyData] = useState(generateFullHistory())
  
  const task = taskId ? getTask(taskId) : undefined

  // 如果任务不存在，重定向到仪表盘
  if (!task) {
    return <Navigate to="/dashboard" replace />
  }

  // 如果任务仍在运行，重定向到运行详情页
  if (task.status !== 'completed' && task.status !== 'failed') {
    return <Navigate to={`/dashboard/task/${taskId}`} replace />
  }

  const isSuccess = task.status === 'completed'

  // 最终产品数据
  const finalProductData = {
    co2Processed: task.result?.co2Processed || 0,
    coValue: task.result?.coValue || 0,
    avgFE: task.result?.fe || 0,
  }

  return (
    <div className="space-y-4">
      {/* 页面标题与操作栏 */}
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
                <Calendar className="w-3 h-3" />
                {new Date(task.createdAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                耗时 {task.timeElapsed}
              </span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-9 gap-2 rounded-full border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800">
            <Download className="w-3.5 h-3.5" />
            导出报告
          </Button>
          <div className={cn(
            "px-4 py-2 rounded-full border text-sm font-medium flex items-center gap-2",
            isSuccess 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          )}>
            {isSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {isSuccess ? '已完成' : '失败'}
          </div>
        </div>
      </div>

      {/* 主内容网格 */}
      <div className="grid grid-cols-3 gap-4" style={{ gridTemplateRows: '320px auto' }}>
        
        {/* 视频回放卡片 */}
        <DetailCard 
          title="实验过程回放" 
          className="col-span-2 row-span-1"
          headerRight={
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-500">REC-01 | 1080p</span>
            </div>
          }
        >
          <div className="h-full flex items-center justify-center bg-zinc-900/50 rounded-lg border border-zinc-800/50 relative overflow-hidden group cursor-pointer">
            {/* 模拟视频缩略图背景 */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 opacity-80" />
            
            {/* 网格线装饰 */}
            <div className="absolute inset-0 opacity-5">
              {[...Array(8)].map((_, i) => (
                <div key={`h-${i}`} className="absolute w-full h-px bg-white" style={{ top: `${i * 12.5}%` }} />
              ))}
              {[...Array(12)].map((_, i) => (
                <div key={`v-${i}`} className="absolute h-full w-px bg-white" style={{ left: `${i * 8.33}%` }} />
              ))}
            </div>

            {/* 播放按钮 */}
            <div className="relative z-10 flex flex-col items-center gap-3 transition-transform duration-300 group-hover:scale-110">
              <PlayCircle className="w-16 h-16 text-zinc-200 fill-zinc-900/50" strokeWidth={1} />
              <span className="text-sm font-medium text-zinc-300 tracking-wide">点击播放回放</span>
            </div>

            {/* 视频信息覆盖层 */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-mono text-zinc-400">DURATION: {task.timeElapsed}</span>
                <span className="text-xs font-mono text-zinc-500">{new Date(task.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex gap-2">
                 <div className="px-2 py-1 rounded bg-black/50 border border-zinc-800 text-[10px] text-zinc-400">1.0x</div>
                 <div className="px-2 py-1 rounded bg-black/50 border border-zinc-800 text-[10px] text-zinc-400">HD</div>
              </div>
            </div>
          </div>
        </DetailCard>

        {/* 实际产品数据 */}
        <DetailCard title="最终产出报告" className="col-span-1 row-span-1" noPadding>
          <div className="h-full flex flex-col justify-between py-2">
            {/* 1. CO2 Processed */}
            <div className="group px-6 py-3 rounded-lg transition-colors hover:bg-zinc-900/40 cursor-default">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-300">
                  <Factory className="w-4 h-4" />
                  <span className="text-xs font-medium tracking-wide">总 CO₂ 处理量</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <Activity className="w-3 h-3" />
                  98.2% 达标
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-zinc-100 tracking-tight">{finalProductData.co2Processed}</span>
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
                  <span className="text-xs font-medium tracking-wide">产物总估值</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  ROI 12.5%
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg text-zinc-500 font-light">¥</span>
                <span className="text-3xl font-bold text-zinc-100 tracking-tight">{finalProductData.coValue.toLocaleString()}</span>
              </div>
            </div>

            {/* Divider */}
            <div className="mx-6 h-px bg-zinc-900/50" />

            {/* 3. Avg FE Efficiency */}
            <div className="group px-6 py-3 rounded-lg transition-colors hover:bg-zinc-900/40 cursor-default">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-300">
                  <Percent className="w-4 h-4" />
                  <span className="text-xs font-medium tracking-wide">最终平均 FE</span>
                </div>
                {finalProductData.avgFE >= 90 ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3" />
                    优秀
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    <Activity className="w-3 h-3" />
                    一般
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-3xl font-bold tracking-tight",
                  finalProductData.avgFE >= 90 ? "text-emerald-400" : "text-amber-400"
                )}>
                  {finalProductData.avgFE.toFixed(1)}
                </span>
                <span className="text-sm font-medium text-zinc-500">%</span>
              </div>
            </div>
          </div>
        </DetailCard>

        {/* 全程参数变化曲线 */}
        <DetailCard 
          title="全程参数演变分析" 
          className="col-span-2 min-h-[400px]"
          headerRight={
            <div className="flex items-center gap-3">
              {CURVE_CONFIG.map(cfg => (
                <div key={cfg.key} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <span className="text-[10px] text-zinc-400">{cfg.label}</span>
                </div>
              ))}
            </div>
          }
          noPadding
        >
          <div className="h-full flex flex-col p-2 space-y-4">
            {CURVE_CONFIG.map((cfg) => (
              <div key={cfg.key} className="flex-1 min-h-0 flex items-center px-2">
                 <div className="w-16 flex flex-col justify-center mr-2 text-right">
                    <span className="text-[10px] font-medium text-zinc-400">{cfg.label}</span>
                    <span className="text-[9px] text-zinc-600 font-mono">{cfg.unit}</span>
                 </div>
                 <div className="flex-1 h-full">
                   <FullHistoryChart 
                     data={historyData[cfg.key]} 
                     config={cfg} 
                     width={600} // 响应式宽度在实际项目中应动态获取，这里简化
                     height={80} 
                   />
                 </div>
              </div>
            ))}
          </div>
        </DetailCard>

        {/* 完整 Agent 日志 */}
        <DetailCard 
          title="完整运行日志归档" 
          className="col-span-1 min-h-[400px]"
          noPadding
        >
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-[11px]">
              {FULL_LOGS.map((log, idx) => (
                <div key={idx} className="flex gap-2 pb-2 border-b border-zinc-900/50 last:border-0 items-start">
                  <span className="text-zinc-600 flex-shrink-0 mt-0.5">{log.time}</span>
                  <span className={cn("font-semibold flex-shrink-0 w-16 mt-0.5", log.color)}>[{log.agent}]</span>
                  <span className="text-zinc-400 leading-relaxed">{log.message}</span>
                </div>
              ))}
              <div className="text-center py-4 text-zinc-600 italic">
                -- End of Log --
              </div>
            </div>
          </div>
        </DetailCard>
      </div>
    </div>
  )
}
