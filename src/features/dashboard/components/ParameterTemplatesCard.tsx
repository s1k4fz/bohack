import { useState } from 'react'
import { Plus, Trash2, Settings2, Database, Network } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Types
interface ParamTemplate {
  id: string
  name: string
  type: 'qubo' | 'agent' | 'network'
  description: string
  // Extended fields for editing
  quboConfig?: string
  agentModel?: string
}

// Mock Data
const MOCK_TEMPLATES: ParamTemplate[] = [
  { 
    id: 'TPL-001', 
    name: 'Standard-QUBO-V1', 
    type: 'qubo', 
    description: '通用伊辛模型权重配置，平衡精度与速度', 
  },
  { 
    id: 'TPL-002', 
    name: 'High-Fidelity-Agent', 
    type: 'agent', 
    description: '高精度视觉感知 Agent 配置，适用于微观分析', 
  },
  { 
    id: 'TPL-003', 
    name: 'Fast-Anneal-Net', 
    type: 'network', 
    description: '快速退火网络拓扑，优先响应时间', 
  },
  { 
    id: 'TPL-004', 
    name: 'Custom-Risk-Profile', 
    type: 'qubo', 
    description: '高风险容忍度权重矩阵，探索边缘解', 
  },
]

const TYPE_CONFIG = {
  qubo: { icon: Database, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', label: 'QUBO 模型' },
  agent: { icon: Settings2, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', label: 'Agent 智能体' },
  network: { icon: Network, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: '网络拓扑' },
}

export function ParameterTemplatesCard() {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    type: 'qubo',
    description: '',
    quboWeights: '{"alpha": 0.5, "beta": 0.8}',
    agentModel: 'gpt-4o-mini'
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <div className="h-full flex flex-col">
        {/* Content Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-2">
          {/* Create New Card */}
          <DialogTrigger asChild>
            <button className="group relative flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/50 hover:border-zinc-700 transition-all duration-200">
              <div className="w-12 h-12 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-800 transition-colors group-hover:border-zinc-700 shadow-lg">
                <Plus className="w-6 h-6 text-zinc-400 group-hover:text-zinc-100" />
              </div>
              <span className="text-xs font-medium text-zinc-500 group-hover:text-zinc-300">新建参数模板</span>
            </button>
          </DialogTrigger>

          {/* Template Cards */}
          {MOCK_TEMPLATES.map((tpl) => {
            const config = TYPE_CONFIG[tpl.type]
            const Icon = config.icon
            
            return (
              <div 
                key={tpl.id}
                className="group relative flex flex-col p-5 rounded-lg border border-zinc-900 bg-zinc-950 hover:bg-zinc-900/60 hover:border-zinc-800 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("p-2 rounded-md border", config.bg, config.border)}>
                    <Icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity -mr-2 -mt-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-950/20">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2 mt-auto">
                  <h3 className="text-sm font-semibold text-zinc-200 tracking-tight group-hover:text-white transition-colors">
                    {tpl.name}
                  </h3>
                  <p className="text-[12px] text-zinc-500 leading-relaxed line-clamp-2 font-medium">
                    {tpl.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit Dialog */}
      <DialogContent className="bg-zinc-950 border-zinc-900 text-zinc-100 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">新建参数模板</DialogTitle>
          <DialogDescription className="text-zinc-500">
            定义可复用的实验参数配置，以便在任务中快速调用。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Name & Type Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-zinc-400">模板名称</Label>
              <Input
                placeholder="例如: High-Precision-V2"
                className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-zinc-400">配置类型</Label>
              <Select 
                defaultValue="qubo" 
                onValueChange={(v) => setFormData({...formData, type: v})}
              >
                <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-900 text-zinc-100">
                  <SelectItem value="qubo" className="focus:bg-zinc-900 focus:text-zinc-100">QUBO 模型</SelectItem>
                  <SelectItem value="agent" className="focus:bg-zinc-900 focus:text-zinc-100">Agent 智能体</SelectItem>
                  <SelectItem value="network" className="focus:bg-zinc-900 focus:text-zinc-100">网络拓扑</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conditional Fields based on Type */}
          {formData.type === 'qubo' && (
            <div className="grid gap-2">
              <Label className="text-zinc-400">QUBO 权重矩阵 (JSON)</Label>
              <Textarea 
                className="bg-zinc-900/50 border-zinc-800 font-mono text-xs min-h-[100px] text-zinc-300 placeholder:text-zinc-600"
                placeholder='{"linear": {...}, "quadratic": {...}}'
                value={formData.quboWeights}
                onChange={(e) => setFormData({...formData, quboWeights: e.target.value})}
              />
            </div>
          )}

          {formData.type === 'agent' && (
            <div className="grid gap-2">
              <Label className="text-zinc-400">Agent 模型版本</Label>
              <Select 
                defaultValue="gpt-4o-mini"
                onValueChange={(v) => setFormData({...formData, agentModel: v})}
              >
                <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-900 text-zinc-100">
                  <SelectItem value="gpt-4o" className="focus:bg-zinc-900 focus:text-zinc-100">GPT-4o (High Performance)</SelectItem>
                  <SelectItem value="gpt-4o-mini" className="focus:bg-zinc-900 focus:text-zinc-100">GPT-4o Mini (Fast)</SelectItem>
                  <SelectItem value="claude-3-5-sonnet" className="focus:bg-zinc-900 focus:text-zinc-100">Claude 3.5 Sonnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="grid gap-2">
            <Label className="text-zinc-400">描述备注</Label>
            <Textarea 
              className="bg-zinc-900/50 border-zinc-800 min-h-[80px] text-zinc-100 placeholder:text-zinc-600"
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
            onClick={() => setIsOpen(false)}
            className="rounded-full min-w-[80px] bg-zinc-100 text-zinc-950 hover:bg-zinc-300 h-8 text-xs font-medium transition-colors"
          >
            保存配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
