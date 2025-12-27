import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Atom, ArrowRight, ArrowLeftRight, Loader2, Zap, Thermometer, Wind, Percent, BatteryCharging, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTasks } from '@/contexts/TaskContext'
import { useTemplates } from '@/contexts/TemplateContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// 参数模板来自全局 TemplateContext（与“预设参数模板库”共用，localStorage 持久化）

const QUBO_API_BASE =
  import.meta.env.VITE_QUBO_API_URL || 'http://localhost:5001'

function inferBackendTemplate(name: string): 'balanced' | 'precision' | 'speed' | 'safe' {
  const n = (name || '').toLowerCase()
  if (n.includes('精度') || n.includes('产率')) return 'precision'
  if (n.includes('低能耗') || n.includes('速度') || n.includes('经济')) return 'speed'
  if (n.includes('安全') || n.includes('保护')) return 'safe'
  return 'balanced'
}

function parseWeightsFromTemplateConfig(quboConfig: string): Record<string, number> | null {
  if (!quboConfig) return null
  try {
    const obj = JSON.parse(quboConfig)
    if (!obj || typeof obj !== 'object') return null

    // 后端原生字段
    const hasNative =
      'w_fe' in obj || 'w_spc' in obj || 'w_volt' in obj || 'w_risk' in obj
    if (hasNative) {
      const out: Record<string, number> = {}
      ;['w_fe', 'w_spc', 'w_volt', 'w_risk'].forEach((k) => {
        const v = (obj as any)[k]
        if (typeof v === 'number') out[k] = v
      })
      return Object.keys(out).length ? out : null
    }

    // 兼容 alpha/beta/gamma
    const alpha = (obj as any).alpha
    const beta = (obj as any).beta
    const gamma = (obj as any).gamma
    if (
      typeof alpha === 'number' ||
      typeof beta === 'number' ||
      typeof gamma === 'number'
    ) {
      return {
        alpha: typeof alpha === 'number' ? alpha : 1.0,
        beta: typeof beta === 'number' ? beta : 1.0,
        gamma: typeof gamma === 'number' ? gamma : 1.0,
      }
    }

    return null
  } catch {
    return null
  }
}

type PredictionMode = 'forward' | 'reverse'

interface PredictionResult {
  // 正向结果
  fe?: number
  voltage?: number
  spc?: number
  // 反向结果
  recommendedJ?: number
  recommendedT?: number
  recommendedV?: number
  achievableFE?: number
  achievableVoltage?: number
  // 用于启动任务的条件
  conditions: {
    currentDensity: number
    temperature: number
    co2Flow: number
  }
}

export function NewTaskCard() {
  const navigate = useNavigate()
  const { addTask } = useTasks()
  const { templates } = useTemplates()

  // 新建任务状态
  const [openTask, setOpenTask] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  // 参数预测状态
  const [openPredict, setOpenPredict] = useState(false)
  const [predictMode, setPredictMode] = useState<PredictionMode>('forward')
  const [isCalculating, setIsCalculating] = useState(false)
  const [isStartingTask, setIsStartingTask] = useState(false)
  const [predictError, setPredictError] = useState<string | null>(null)
  
  // 正向预测输入
  const [currentDensity, setCurrentDensity] = useState('250')
  const [temperature, setTemperature] = useState('50')
  const [co2Flow, setCo2Flow] = useState('50')
  
  // 反向推导输入
  const [targetFE, setTargetFE] = useState('90')
  const [targetVoltage, setTargetVoltage] = useState('2.0')
  
  // 预测结果
  const [result, setResult] = useState<PredictionResult | null>(null)

  // 获取选中模板
  const selectedTemplateData = templates.find(t => t.id === selectedTemplate)

  // 当选择模板时，更新初始条件显示
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = templates.find(t => t.id === templateId)
    if (template) {
      // 可以在这里预填充条件
    }
  }

  const handleCreateTask = () => {
    const template = selectedTemplateData
    if (!template) return

    // 创建新任务
    const newTask = addTask({
      name: taskName || '未命名任务',
      description: taskDescription || template.description,
      initialConditions: template.initialConditions,
      templateId: template.id,
    })

    // 关闭对话框并重置表单
    setOpenTask(false)
    setTaskName('')
    setTaskDescription('')
    setSelectedTemplate(null)

    // 导航到新任务详情页
    navigate(`/dashboard/task/${newTask.id}`)
  }

  const handlePredict = async () => {
    setIsCalculating(true)
    setResult(null)
    setPredictError(null)
    
    await new Promise(resolve => setTimeout(resolve, 200))

    const tpl = selectedTemplateData || templates[0]
    const backendTemplate = tpl ? inferBackendTemplate(tpl.name) : 'balanced'
    const weights = tpl?.quboConfig ? parseWeightsFromTemplateConfig(tpl.quboConfig) : null
    
    if (predictMode === 'forward') {
      const j = parseFloat(currentDensity) || 250
      const T = parseFloat(temperature) || 50
      const v = parseFloat(co2Flow) || 50
      try {
        const resp = await fetch(`${QUBO_API_BASE}/api/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'forward',
            template: backendTemplate,
            weights: weights || undefined,
            inputs: {
              currentDensity: j,
              temperature: T,
              co2Flow: v,
            },
            options: { electrode_area_cm2: 4.0 },
          }),
        })
        const data = await resp.json()
        if (!resp.ok || data?.status !== 'success') {
          throw new Error(data?.error || 'QUBO 后端预测失败')
        }

        setResult({
          fe: data.metrics?.fe,
          voltage: data.metrics?.voltage,
          spc: data.metrics?.spc,
          conditions: { currentDensity: j, temperature: T, co2Flow: v },
        })
      } catch (e: any) {
        setPredictError(e?.message || '预测失败，请确认 backend/server.py 已启动')
      }
    } else {
      const fe = parseFloat(targetFE) || 90
      const volt = parseFloat(targetVoltage) || 2.0
      try {
        const resp = await fetch(`${QUBO_API_BASE}/api/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'reverse',
            template: backendTemplate,
            weights: weights || undefined,
            targets: {
              fe,
              voltage: volt,
            },
            options: { electrode_area_cm2: 4.0 },
          }),
        })
        const data = await resp.json()
        if (!resp.ok || data?.status !== 'success') {
          throw new Error(data?.error || 'QUBO 后端反推失败')
        }

        const rec = data.recommended || {}
        const ach = data.achievable || {}

        setResult({
          recommendedJ: rec.currentDensity,
          recommendedT: rec.temperature,
          recommendedV: rec.co2Flow,
          achievableFE: ach.fe,
          achievableVoltage: ach.voltage,
          conditions: {
            currentDensity: rec.currentDensity,
            temperature: rec.temperature,
            co2Flow: rec.co2Flow,
          },
        })
      } catch (e: any) {
        setPredictError(e?.message || '反推失败，请确认 backend/server.py 已启动')
      }
    }
    
    setIsCalculating(false)
  }

  // 从预测结果直接启动任务
  const handleStartTaskFromPrediction = async () => {
    if (!result) return
    
    setIsStartingTask(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 创建新任务
    const newTask = addTask({
      name: `预测任务-${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
      description: predictMode === 'forward' 
        ? `正向预测任务：目标 FE ${result.fe}%` 
        : `反向推导任务：推荐条件 ${result.recommendedJ}mA/cm²`,
      initialConditions: result.conditions,
    })
    
    setIsStartingTask(false)
    setOpenPredict(false)
    setResult(null)
    
    // 导航到新任务详情页
    navigate(`/dashboard/task/${newTask.id}`)
  }

  return (
    <div className="relative h-full flex flex-col justify-between bg-white rounded-xl overflow-hidden shadow-sm">
      {/* 背景装饰 */}
      <div className="absolute -right-16 -top-16 opacity-[0.03] pointer-events-none select-none">
        <Atom className="w-72 h-72 text-black" strokeWidth={0.4} />
      </div>

      {/* 主内容区域 */}
      <div className="relative z-10 p-7 flex flex-col h-full">
        {/* 标题区域 */}
        <div className="flex-1 space-y-3">
          <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
            量子寻优任务
          </h2>
          <p className="text-base text-zinc-500 leading-relaxed max-w-[280px]">
            启动 CO₂ 电解参数优化，多智能体协同求解最优反应条件。
          </p>
        </div>

        {/* 底部按钮组 */}
        <div className="flex justify-end gap-3 pt-4">
          {/* 参数预测按钮 */}
          <Dialog open={openPredict} onOpenChange={(v) => { setOpenPredict(v); if (!v) setResult(null) }}>
            <DialogTrigger asChild>
              <button
                className={cn(
                  'px-5 py-2.5 rounded-full text-sm font-semibold',
                  'bg-zinc-900 text-white',
                  'transition-all duration-200',
                  'hover:bg-zinc-800 hover:shadow-md',
                  'focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-white',
                  'active:scale-[0.98]'
                )}
              >
                参数预测
              </button>
            </DialogTrigger>

            <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-zinc-100 flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
                  QUBO 参数预测
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                  基于物理代理模型，双向转换反应条件与性能指标。
                </DialogDescription>
              </DialogHeader>

              {/* 模式切换标签 - 胶囊形 */}
              <div className="flex gap-2 p-1 bg-zinc-900 rounded-full">
                <button
                  onClick={() => { setPredictMode('forward'); setResult(null) }}
                  className={cn(
                    'flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2',
                    predictMode === 'forward'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  <ArrowRight className="w-4 h-4" />
                  正向预测
                </button>
                <button
                  onClick={() => { setPredictMode('reverse'); setResult(null) }}
                  className={cn(
                    'flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2',
                    predictMode === 'reverse'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  反向推导
                </button>
              </div>

              <div className="space-y-5 py-4">
                {predictMode === 'forward' ? (
                  <>
                    {/* 正向预测：输入反应条件 */}
                    <div className="space-y-4">
                      <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                        输入反应条件
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label className="text-zinc-400 text-xs flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-400" />
                            电流密度
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={currentDensity}
                              onChange={(e) => setCurrentDensity(e.target.value)}
                              className="bg-zinc-900/50 border-zinc-800 text-zinc-100 text-sm pr-16 no-spinner"
                              placeholder="250"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                              mA/cm²
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-zinc-400 text-xs flex items-center gap-1">
                            <Thermometer className="w-3 h-3 text-rose-400" />
                            温度
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={temperature}
                              onChange={(e) => setTemperature(e.target.value)}
                              className="bg-zinc-900/50 border-zinc-800 text-zinc-100 text-sm pr-8 no-spinner"
                              placeholder="50"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                              °C
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-zinc-400 text-xs flex items-center gap-1">
                            <Wind className="w-3 h-3 text-sky-400" />
                            CO₂ 流量
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={co2Flow}
                              onChange={(e) => setCo2Flow(e.target.value)}
                              className="bg-zinc-900/50 border-zinc-800 text-zinc-100 text-sm pr-14 no-spinner"
                              placeholder="50"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                              sccm
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 错误提示 */}
                    {predictError && (
                      <div className="p-3 rounded-lg border border-rose-900/30 bg-rose-950/10 text-rose-300 text-sm">
                        <div className="text-xs font-medium uppercase tracking-wider text-rose-400 mb-1">
                          预测失败
                        </div>
                        <div className="text-[12px] leading-relaxed">{predictError}</div>
                        <div className="text-[10px] text-rose-400/70 mt-2">
                          请确认 Python 后端 `backend/server.py` 已启动（端口 5001），并已安装依赖。
                        </div>
                      </div>
                    )}

                    {/* 正向预测结果 */}
                    {result && result.fe !== undefined && (
                      <div className="space-y-3 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <div className="text-xs text-emerald-400 font-medium uppercase tracking-wider flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          预测性能指标
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-emerald-400">{result.fe}%</div>
                            <div className="text-xs text-zinc-500">FE(CO)</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-400">{result.voltage}V</div>
                            <div className="text-xs text-zinc-500">Cell Voltage</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-amber-400">{result.spc}%</div>
                            <div className="text-xs text-zinc-500">SPC</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* 反向推导：输入期望指标 */}
                    <div className="space-y-4">
                      <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                        输入期望性能指标
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-zinc-400 text-xs flex items-center gap-1">
                            <Percent className="w-3 h-3 text-emerald-400" />
                            目标 FE(CO)
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={targetFE}
                              onChange={(e) => setTargetFE(e.target.value)}
                              className="bg-zinc-900/50 border-zinc-800 text-zinc-100 text-sm pr-8 no-spinner"
                              placeholder="90"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                              %
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-zinc-400 text-xs flex items-center gap-1">
                            <BatteryCharging className="w-3 h-3 text-blue-400" />
                            目标 Cell Voltage
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.1"
                              value={targetVoltage}
                              onChange={(e) => setTargetVoltage(e.target.value)}
                              className="bg-zinc-900/50 border-zinc-800 text-zinc-100 text-sm pr-8 no-spinner"
                              placeholder="2.0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                              V
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 错误提示 */}
                    {predictError && (
                      <div className="p-3 rounded-lg border border-rose-900/30 bg-rose-950/10 text-rose-300 text-sm">
                        <div className="text-xs font-medium uppercase tracking-wider text-rose-400 mb-1">
                          反推失败
                        </div>
                        <div className="text-[12px] leading-relaxed">{predictError}</div>
                        <div className="text-[10px] text-rose-400/70 mt-2">
                          请确认 Python 后端 `backend/server.py` 已启动（端口 5001），并已安装依赖。
                        </div>
                      </div>
                    )}

                    {/* 反向推导结果 */}
                    {result && result.recommendedJ !== undefined && (
                      <div className="space-y-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <div className="text-xs text-cyan-400 font-medium uppercase tracking-wider flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                          推荐反应条件
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-xl font-bold text-zinc-100">{result.recommendedJ}</div>
                            <div className="text-xs text-zinc-500">mA/cm²</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold text-zinc-100">{result.recommendedT}°C</div>
                            <div className="text-xs text-zinc-500">温度</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold text-zinc-100">{result.recommendedV}</div>
                            <div className="text-xs text-zinc-500">sccm</div>
                          </div>
                        </div>
                        
                        <div className="border-t border-zinc-800 pt-3 mt-3">
                          <div className="text-xs text-zinc-500 mb-2">可达到的实际指标</div>
                          <div className="flex gap-6 justify-center">
                            <span className="text-sm">
                              FE: <span className="text-emerald-400 font-semibold">{result.achievableFE}%</span>
                            </span>
                            <span className="text-sm">
                              Voltage: <span className="text-blue-400 font-semibold">{result.achievableVoltage}V</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <DialogFooter className="flex justify-between items-center">
                {/* 左侧：开始任务按钮（只有有结果时才可点击） */}
                <Button
                  onClick={handleStartTaskFromPrediction}
                  disabled={!result || isStartingTask}
                  className={cn(
                    "rounded-full h-8 px-4 text-xs font-medium transition-all",
                    result 
                      ? "bg-emerald-600 text-white hover:bg-emerald-500" 
                      : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  )}
                >
                  {isStartingTask ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      启动中...
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 mr-1" />
                      开始任务
                    </>
                  )}
                </Button>

                {/* 右侧：关闭和开始预测 */}
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setOpenPredict(false)}
                    className="rounded-full h-8 min-w-[80px] text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                  >
                    关闭
                  </Button>
                  <Button
                    onClick={handlePredict}
                    disabled={isCalculating}
                    className="rounded-full h-8 min-w-[100px] text-xs font-medium bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-50"
                  >
                    {isCalculating ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        计算中...
                      </>
                    ) : (
                      '开始预测'
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 新建任务按钮 */}
          <Dialog open={openTask} onOpenChange={setOpenTask}>
            <DialogTrigger asChild>
              <button
                className={cn(
                  'px-6 py-2.5 rounded-full text-sm font-semibold',
                  'bg-zinc-900 text-white',
                  'transition-all duration-200',
                  'hover:bg-zinc-800 hover:shadow-md',
                  'focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-white',
                  'active:scale-[0.98]'
                )}
              >
                新建任务
              </button>
            </DialogTrigger>

            <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-zinc-100">创建新任务</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  配置任务信息、参数模板和初始反应条件，启动量子优化流程。
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4">
                {/* 任务名称 */}
                <div className="space-y-2">
                  <Label htmlFor="task-name" className="text-zinc-300">
                    任务名称
                  </Label>
                  <Input
                    id="task-name"
                    placeholder="例如：CO2 电解优化-V1"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700"
                  />
                </div>

                {/* 任务描述 */}
                <div className="space-y-2">
                  <Label htmlFor="task-desc" className="text-zinc-300">
                    任务描述
                  </Label>
                  <Textarea
                    id="task-desc"
                    placeholder="描述本次任务的目标和预期..."
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 min-h-[80px] resize-none"
                  />
                </div>

                {/* 参数模板选择 */}
                <div className="space-y-2">
                  <Label className="text-zinc-300">参数模板（含初始条件）</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between bg-zinc-900/50 border-zinc-800 text-zinc-100 hover:bg-zinc-900 hover:text-zinc-100 h-auto py-3"
                      >
                        <div className="text-left">
                          {selectedTemplateData ? (
                            <div>
                              <div className="font-medium">{selectedTemplateData.name}</div>
                              <div className="text-xs text-zinc-500 mt-0.5">{selectedTemplateData.description}</div>
                            </div>
                          ) : (
                            '选择预设模板'
                          )}
                        </div>
                        <span className="text-zinc-500 ml-2">▼</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full min-w-[320px] bg-zinc-950 border-zinc-800">
                      {templates.map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onClick={() => handleTemplateSelect(template.id)}
                          className="text-zinc-300 focus:bg-zinc-900 focus:text-zinc-100 cursor-pointer py-3"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'inline-block w-2 h-2 rounded-full',
                                  template.type === 'qubo'
                                    ? 'bg-cyan-500'
                                    : 'bg-amber-500'
                                )}
                              />
                              <span className="font-medium">{template.name}</span>
                            </div>
                            <div className="text-xs text-zinc-500 mt-1 ml-4">
                              {template.description}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* 显示选中模板的初始条件 */}
                {selectedTemplateData && (
                  <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-2">
                      初始反应条件
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-lg font-semibold text-zinc-100">
                          {selectedTemplateData.initialConditions.currentDensity}
                        </div>
                        <div className="text-xs text-zinc-500">mA/cm²</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-zinc-100">
                          {selectedTemplateData.initialConditions.temperature}°C
                        </div>
                        <div className="text-xs text-zinc-500">温度</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-zinc-100">
                          {selectedTemplateData.initialConditions.co2Flow}
                        </div>
                        <div className="text-xs text-zinc-500">sccm</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setOpenTask(false)}
                  className="rounded-full h-8 min-w-[80px] text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                >
                  取消
                </Button>
                <Button
                  onClick={handleCreateTask}
                  disabled={!taskName.trim() || !selectedTemplate}
                  className="rounded-full h-8 min-w-[80px] text-xs font-medium bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-50"
                >
                  确认并启动
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
