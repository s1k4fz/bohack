import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export interface InitialConditions {
  currentDensity: number // mA/cm²
  temperature: number // °C
  co2Flow: number // sccm
}

export interface ParamTemplate {
  id: string
  name: string
  description: string
  type: 'qubo'
  initialConditions: InitialConditions
  quboConfig: string
  createdAt: string
}

interface TemplateContextType {
  templates: ParamTemplate[]
  addTemplate: (template: Omit<ParamTemplate, 'id' | 'createdAt'>) => ParamTemplate
  updateTemplate: (templateId: string, updates: Partial<ParamTemplate>) => void
  deleteTemplate: (templateId: string) => void
  getTemplate: (templateId: string) => ParamTemplate | undefined
}

const STORAGE_KEY = 'paramTemplates'

const DEFAULT_TEMPLATES: ParamTemplate[] = [
  {
    id: 'TPL-001',
    name: 'QUBO 平衡模式',
    type: 'qubo',
    description: '兼顾效率与能耗的均衡配置',
    initialConditions: { currentDensity: 250, temperature: 50, co2Flow: 50 },
    quboConfig: '{"alpha": 0.5, "beta": 0.8, "gamma": 0.3}',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TPL-002',
    name: 'QUBO 精度优先',
    type: 'qubo',
    description: '最大化法拉第效率，适合高纯度需求',
    initialConditions: { currentDensity: 220, temperature: 55, co2Flow: 60 },
    quboConfig: '{"alpha": 0.8, "beta": 0.9, "gamma": 0.2}',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TPL-003',
    name: 'QUBO 速度优先',
    type: 'qubo',
    description: '快速收敛，适合快速迭代场景',
    initialConditions: { currentDensity: 300, temperature: 45, co2Flow: 40 },
    quboConfig: '{"alpha": 0.6, "beta": 0.4, "gamma": 0.7}',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TPL-004',
    name: '低能耗模式',
    type: 'qubo',
    description: '最小化电压，节能运行',
    initialConditions: { currentDensity: 180, temperature: 60, co2Flow: 55 },
    quboConfig: '{"alpha": 0.3, "beta": 0.5, "gamma": 0.9}',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TPL-005',
    name: '高产率模式',
    type: 'qubo',
    description: '最大化产出，适合大规模生产',
    initialConditions: { currentDensity: 350, temperature: 50, co2Flow: 70 },
    quboConfig: '{"alpha": 0.7, "beta": 0.6, "gamma": 0.4}',
    createdAt: new Date().toISOString(),
  },
]

const TemplateContext = createContext<TemplateContextType | undefined>(undefined)

function generateTemplateId(): string {
  return `TPL-${Math.floor(1000 + Math.random() * 9000)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

export function TemplateProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<ParamTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return DEFAULT_TEMPLATES
      const parsed = JSON.parse(raw) as ParamTemplate[]
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TEMPLATES
    } catch {
      return DEFAULT_TEMPLATES
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
    } catch {
      // ignore
    }
  }, [templates])

  const addTemplate = useCallback(
    (template: Omit<ParamTemplate, 'id' | 'createdAt'>): ParamTemplate => {
      const newTemplate: ParamTemplate = {
        ...template,
        id: generateTemplateId(),
        createdAt: nowIso(),
      }
      setTemplates((prev) => [newTemplate, ...prev])
      return newTemplate
    },
    [],
  )

  const updateTemplate = useCallback((templateId: string, updates: Partial<ParamTemplate>) => {
    setTemplates((prev) => prev.map((t) => (t.id === templateId ? { ...t, ...updates } : t)))
  }, [])

  const deleteTemplate = useCallback((templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId))
  }, [])

  const getTemplate = useCallback(
    (templateId: string) => templates.find((t) => t.id === templateId),
    [templates],
  )

  return (
    <TemplateContext.Provider
      value={{
        templates,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        getTemplate,
      }}
    >
      {children}
    </TemplateContext.Provider>
  )
}

export function useTemplates() {
  const ctx = useContext(TemplateContext)
  if (!ctx) throw new Error('useTemplates must be used within a TemplateProvider')
  return ctx
}


