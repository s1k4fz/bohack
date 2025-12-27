import { useState } from 'react'
import { Plus, Trash2, Database, Zap, Thermometer, Wind } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTemplates, type InitialConditions } from '@/contexts/TemplateContext'
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

// 参数模板来自全局 TemplateContext（localStorage 持久化）

const TYPE_CONFIG = {
  qubo: { icon: Database, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', label: 'QUBO 模型' },
}

const DEFAULT_CONDITIONS: InitialConditions = {
  currentDensity: 250,
  temperature: 50,
  co2Flow: 50
}

export function ParameterTemplatesCard() {
  const { templates, addTemplate, deleteTemplate } = useTemplates()
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    quboWeights: '{"alpha": 0.5, "beta": 0.8}',
    initialConditions: { ...DEFAULT_CONDITIONS }
  })

  const handleDeleteTemplate = (id: string) => {
    deleteTemplate(id)
  }

  const handleSaveTemplate = () => {
    addTemplate({
      name: formData.name || '未命名模板',
      type: 'qubo',
      description: formData.description,
      initialConditions: formData.initialConditions,
      quboConfig: formData.quboWeights,
    })
    setIsOpen(false)
    // Reset form
    setFormData({
      name: '',
      description: '',
      quboWeights: '{"alpha": 0.5, "beta": 0.8}',
      initialConditions: { ...DEFAULT_CONDITIONS }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <div className="h-full flex flex-col">
        {/* Content Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-2">
          {/* Create New Card */}
          <DialogTrigger asChild>
            <button className="group relative flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/50 hover:border-zinc-700 transition-all duration-200 min-h-[140px]">
              <div className="w-12 h-12 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-800 transition-colors group-hover:border-zinc-700 shadow-lg">
                <Plus className="w-6 h-6 text-zinc-400 group-hover:text-zinc-100" />
              </div>
              <span className="text-xs font-medium text-zinc-500 group-hover:text-zinc-300">新建参数模板</span>
            </button>
          </DialogTrigger>

          {/* Template Cards */}
          {templates.map((tpl) => {
            const config = TYPE_CONFIG.qubo
            const Icon = config.icon
            
            return (
              <div 
                key={tpl.id}
                className="group relative flex flex-col p-4 rounded-lg border border-zinc-900 bg-zinc-950 hover:bg-zinc-900/60 hover:border-zinc-800 transition-all duration-300 cursor-pointer min-h-[140px]"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={cn("p-2 rounded-md border", config.bg, config.border)}>
                    <Icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-red-950/20"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteTemplate(tpl.id)
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-sm font-semibold text-zinc-200 tracking-tight group-hover:text-white transition-colors">
                    {tpl.name}
                  </h3>
                  <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">
                    {tpl.description}
                  </p>
                </div>

                {/* 初始条件预览 */}
                <div className="mt-2 pt-2 border-t border-zinc-800/50">
                  <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                    <span className="flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5 text-amber-500/50" />
                      {tpl.initialConditions.currentDensity}
                    </span>
                    <span className="flex items-center gap-1">
                      <Thermometer className="w-2.5 h-2.5 text-rose-500/50" />
                      {tpl.initialConditions.temperature}°
                    </span>
                    <span className="flex items-center gap-1">
                      <Wind className="w-2.5 h-2.5 text-sky-500/50" />
                      {tpl.initialConditions.co2Flow}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit Dialog */}
      <DialogContent className="bg-zinc-950 border-zinc-900 text-zinc-100 sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">新建参数模板</DialogTitle>
          <DialogDescription className="text-zinc-500">
            定义可复用的实验参数配置，包含初始反应条件。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label className="text-zinc-400 text-xs">模板名称</Label>
            <Input
              placeholder="例如: QUBO 高精度模式"
              className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-zinc-100 placeholder:text-zinc-600 h-9 text-sm"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          {/* Initial Conditions - 新增 */}
          <div className="space-y-3">
            <Label className="text-zinc-400 text-xs flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              初始反应条件
            </Label>
            <div className="grid grid-cols-3 gap-3 p-3 bg-zinc-900/30 rounded-lg border border-zinc-800/50">
              <div className="space-y-1.5">
                <Label className="text-zinc-500 text-[10px] flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  电流密度 (mA/cm²)
                </Label>
                <Input
                  type="number"
                  value={formData.initialConditions.currentDensity}
                  onChange={(e) => setFormData({
                    ...formData, 
                    initialConditions: {...formData.initialConditions, currentDensity: parseFloat(e.target.value) || 0}
                  })}
                  className="bg-zinc-900/50 border-zinc-800 text-zinc-100 text-sm h-8 no-spinner"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-500 text-[10px] flex items-center gap-1">
                  <Thermometer className="w-2.5 h-2.5 text-rose-400" />
                  温度 (°C)
                </Label>
                <Input
                  type="number"
                  value={formData.initialConditions.temperature}
                  onChange={(e) => setFormData({
                    ...formData, 
                    initialConditions: {...formData.initialConditions, temperature: parseFloat(e.target.value) || 0}
                  })}
                  className="bg-zinc-900/50 border-zinc-800 text-zinc-100 text-sm h-8 no-spinner"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-500 text-[10px] flex items-center gap-1">
                  <Wind className="w-2.5 h-2.5 text-sky-400" />
                  CO₂ 流量 (sccm)
                </Label>
                <Input
                  type="number"
                  value={formData.initialConditions.co2Flow}
                  onChange={(e) => setFormData({
                    ...formData, 
                    initialConditions: {...formData.initialConditions, co2Flow: parseFloat(e.target.value) || 0}
                  })}
                  className="bg-zinc-900/50 border-zinc-800 text-zinc-100 text-sm h-8 no-spinner"
                />
              </div>
            </div>
          </div>

          {/* QUBO 权重矩阵 */}
          <div className="grid gap-2">
            <Label className="text-zinc-400 text-xs">QUBO 权重矩阵 (JSON)</Label>
            <Textarea 
              className="bg-zinc-900/50 border-zinc-800 font-mono text-xs min-h-[80px] text-zinc-300 placeholder:text-zinc-600"
              placeholder='{"linear": {...}, "quadratic": {...}}'
              value={formData.quboWeights}
              onChange={(e) => setFormData({...formData, quboWeights: e.target.value})}
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label className="text-zinc-400 text-xs">描述备注</Label>
            <Textarea 
              className="bg-zinc-900/50 border-zinc-800 min-h-[60px] text-zinc-100 placeholder:text-zinc-600 text-sm"
              placeholder="简要描述该配置的适用场景..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>
        </div>

        <DialogFooter className="sm:gap-3">
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            className="rounded-full min-w-[80px] border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 h-8 text-xs transition-colors"
          >
            取消
          </Button>
          <Button 
            onClick={handleSaveTemplate}
            className="rounded-full min-w-[80px] bg-zinc-100 text-zinc-950 hover:bg-zinc-300 h-8 text-xs font-medium transition-colors"
          >
            保存配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
