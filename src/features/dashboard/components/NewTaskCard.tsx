import { useState } from 'react'
import { Atom, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createOptimizationTask } from '@/lib/api'
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

// Mock 参数模板数据
const PARAMETER_TEMPLATES = [
  { id: 'tmpl-001', name: 'QUBO 平衡模式', type: 'qubo' },
  { id: 'tmpl-002', name: 'QUBO 精度优先', type: 'qubo' },
  { id: 'tmpl-003', name: 'QUBO 速度优先', type: 'qubo' },
  { id: 'tmpl-004', name: 'Agent 默认配置', type: 'agent' },
  { id: 'tmpl-005', name: 'Agent 高并发模式', type: 'agent' },
]

export function NewTaskCard() {
  const [open, setOpen] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!taskName.trim()) return
    
    setLoading(true)
    try {
      const result = await createOptimizationTask(taskName, selectedTemplate)
      console.log('Task created successfully:', result)
      
      // TODO: 这里应该更新全局状态或触发通知，为了演示暂且 console.log
      // 真实场景下会将 result 传递给 ActiveTasksCard 或 HistoryTasksCard
      
      setOpen(false)
      setTaskName('')
      setSelectedTemplate(null)
    } catch (error) {
      console.error('Failed to create task', error)
      // TODO: Show error toast
    } finally {
      setLoading(false)
    }
  }

  const selectedTemplateName = PARAMETER_TEMPLATES.find(
    (t) => t.id === selectedTemplate
  )?.name

  return (
    <div className="relative h-full flex flex-col justify-between bg-white rounded-lg overflow-hidden">
      {/* 背景装饰：巨大的 Atom 图标 */}
      <div className="absolute -right-12 -top-12 opacity-[0.04] pointer-events-none">
        <Atom className="w-64 h-64 text-black" strokeWidth={0.5} />
      </div>

      {/* 主内容 */}
      <div className="relative z-10 p-6 flex flex-col h-full">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-black tracking-tight mb-1">
            新建任务
          </h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            配置多智能体协作参数，启动 QUBO 求解流程。
          </p>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                className={cn(
                  'px-5 py-2 rounded-full text-sm font-medium',
                  'bg-black text-white',
                  'transition-colors hover:bg-zinc-800',
                  'focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-white'
                )}
              >
                新建任务
              </button>
            </DialogTrigger>

            <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-zinc-100">创建新任务</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  配置任务名称和参数模板，启动量子优化流程。
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

                {/* 参数模板选择 */}
                <div className="space-y-2">
                  <Label className="text-zinc-300">参数模板</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between bg-zinc-900/50 border-zinc-800 text-zinc-100 hover:bg-zinc-900 hover:text-zinc-100"
                      >
                        {selectedTemplateName || '选择预设模板'}
                        <span className="text-zinc-500">▼</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full min-w-[200px] bg-zinc-950 border-zinc-800">
                      {PARAMETER_TEMPLATES.map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onClick={() => setSelectedTemplate(template.id)}
                          className="text-zinc-300 focus:bg-zinc-900 focus:text-zinc-100 cursor-pointer"
                        >
                          <span
                            className={cn(
                              'inline-block w-2 h-2 rounded-full mr-2',
                              template.type === 'qubo'
                                ? 'bg-cyan-500'
                                : 'bg-amber-500'
                            )}
                          />
                          {template.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <p className="text-xs text-zinc-600">
                    包含 QUBO 权重配置与 Agent 模型设定。
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  className="rounded-full h-8 min-w-[80px] text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                >
                  取消
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!taskName.trim() || loading}
                  className="rounded-full h-8 min-w-[80px] text-xs font-medium bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  {loading ? '计算中...' : '确认并启动'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
