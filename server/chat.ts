/**
 * QuantumSentry AI Chat Server
 * 使用 OpenRouter 作为 LLM Provider
 * 
 * 运行方式: npx tsx server/chat.ts
 */
import express from 'express'
import cors from 'cors'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { streamText, convertToModelMessages, type UIMessage, tool, stepCountIs, generateText, Output } from 'ai'
import { z } from 'zod'
import dotenv from 'dotenv'

// 加载环境变量
dotenv.config({ path: '.env.local' })

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ─────────────────────────────────────────────────────────────
// OpenRouter Provider 初始化
// ─────────────────────────────────────────────────────────────
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

// 默认模型
const DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet'

// ─────────────────────────────────────────────────────────────
// 系统提示词 - QuantumSentry AI 助手
// ─────────────────────────────────────────────────────────────
export const SYSTEM_PROMPT = `你是 QuantumSentry（量子哨兵）的 AI 助手，一个专门用于 CO₂ 电解优化的智能系统。

## 系统背景
QuantumSentry 是一个多智能体协作系统，通过玻色量子的 QUBO（二次无约束二进制优化）算力引擎，实时优化 CO₂ 电解反应的参数配置，以最大化法拉第效率（FE(CO)）和产物价值。

## 核心组件
1. **Vision Agent（视觉智能体）**：通过摄像头实时监控电极表面状态，检测气泡、沉积物等异常
2. **Quantum Agent（量子智能体）**：运行 QUBO 模型求解最优反应参数（电流密度、温度、气体流量）
3. **Decision Agent（决策智能体）**：综合分析并执行参数调整指令

## 关键指标
- **FE(CO)**：法拉第效率，目标 > 90%
- **电流密度**：典型范围 200-300 mA/cm²
- **反应温度**：典型范围 40-60°C
- **电池电压**：典型范围 1.8-2.5 V
- **SPC（单程转化率）**：典型范围 20-40%

## 你的职责
1. 回答用户关于任务状态、效率趋势、参数配置的问题
2. 解释 QUBO 模型和量子优化的基本原理
3. 提供参数调整建议
4. 帮助用户理解 Agent 日志和系统状态

## 回复风格
- 专业但易懂，避免过度技术术语
- 使用 Markdown 格式化复杂信息（表格、代码块、列表）
- 回复简洁，重点突出
- 中文回复

## 可用工具（必须按需调用）
当用户询问任务列表/任务详情/商业价值看板/参数模板库时，你必须优先调用工具获取数据后再回答，禁止凭空编造。

- getActiveTasks: 获取运行中任务列表
- getHistoryTasks: 获取已完成/失败任务列表
- getTaskById: 根据任务 ID 获取详情
- getImpactMetrics: 获取商业价值看板汇总指标（累计 CO₂、估值、平均 FE）
- getQuboTemplates: 获取参数模板库列表（含初始反应条件与 QUBO JSON）
- getTemplateById: 根据模板 ID 获取详情`

type ChatContext = {
  runningTasks?: any[]
  completedTasks?: any[]
  impactMetrics?: {
    totalCO2?: number
    totalValue?: number
    avgFE?: number
  }
  templates?: any[]
}

function formatDurationFromCreatedAt(createdAt: unknown): string | null {
  if (typeof createdAt !== 'string') return null
  const start = new Date(createdAt).getTime()
  if (Number.isNaN(start)) return null
  const diff = Math.max(0, Date.now() - start)
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  return hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`
}

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

function getSurrogateSPC(fe: number, voltage: number): number {
  return (voltage / (fe / 100.0 + 0.01)) * 2.5
}

// ─────────────────────────────────────────────────────────────
// Decision Agent API（用于任务异常分析与参数自适应）
// ─────────────────────────────────────────────────────────────
const DecisionOutputSchema = z.object({
  anomaly: z.object({
    isAnomaly: z.boolean(),
    severity: z.enum(['low', 'medium', 'high']),
    type: z.string().describe('异常类型，如 voltage_spike / fe_drop / temp_over / current_over / combined'),
    description: z.string().describe('对异常的简短描述'),
  }),
  setpoints: z.object({
    currentDensity: z.number().min(50).max(450).describe('推荐电流密度 (mA/cm²)'),
    temperature: z.number().min(20).max(80).describe('推荐温度 (°C)'),
    co2Flow: z.number().min(10).max(150).describe('推荐 CO₂ 流量 (sccm)'),
  }),
  quboTuning: z.object({
    alpha: z.number().min(0).max(1).describe('QUBO 权重 alpha'),
    beta: z.number().min(0).max(1).describe('QUBO 权重 beta'),
    gamma: z.number().min(0).max(1).describe('QUBO 权重 gamma'),
    constraintPenalty: z.number().min(0).max(5).describe('约束惩罚系数'),
  }),
  actionSummary: z.string().describe('给 UI/日志显示的一句话决策摘要（中文）'),
})

app.post('/api/agents/decision', async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({
        error: 'OPENROUTER_API_KEY is not configured. Please set it in .env.local file.',
      })
    }

    const body = (req.body || {}) as any
    const task = body.task || {}
    const template = body.template || {}
    const sample = body.sample || {}

    const fe = Number(sample.fe)
    const currentDensity = Number(sample.currentDensity)
    const temperature = Number(sample.temperature)
    const cellVoltage = Number(sample.cellVoltage)

    const co2Flow = Number(task?.currentConditions?.co2Flow ?? task?.initialConditions?.co2Flow ?? 50)

    // 给模型的“异常信号摘要”（我们先做一层确定性判断，避免模型瞎猜）
    const signals: string[] = []
    if (!Number.isNaN(cellVoltage) && cellVoltage > 2.35) signals.push(`电池电压偏高: ${cellVoltage.toFixed(2)}V (> 2.35V)`)
    if (!Number.isNaN(fe) && fe < 88) signals.push(`FE(CO) 偏低: ${fe.toFixed(1)}% (< 88%)`)
    if (!Number.isNaN(temperature) && temperature > 58) signals.push(`温度偏高: ${temperature.toFixed(1)}°C (> 58°C)`)
    if (!Number.isNaN(currentDensity) && currentDensity > 290) signals.push(`电流密度偏高: ${currentDensity.toFixed(0)} mA/cm² (> 290)`)

    const decisionSystem = `你是 QuantumSentry 的 Decision Agent（决策智能体）。\n\n你将收到运行中任务的实时采样指标（来自传感曲线），以及可能的异常信号摘要。你的目标是：\n- 在不牺牲安全边界的前提下，提高 FE(CO)，降低过高的电压与温度风险。\n- 给出新的反应条件 setpoints（电流密度/温度/CO₂ 流量），并给出 QUBO 权重调参建议（alpha/beta/gamma/constraintPenalty）。\n\n约束要求：\n- currentDensity 范围: 50~450\n- temperature 范围: 20~80\n- co2Flow 范围: 10~150\n- alpha/beta/gamma 范围: 0~1\n- constraintPenalty 范围: 0~5\n\n输出必须严格符合 JSON schema（由系统强制），不要输出多余字段。actionSummary 必须为中文短句，适合写入任务日志。`

    const prompt = `任务信息:\n${JSON.stringify(
      {
        id: task?.id,
        name: task?.name,
        status: task?.status,
        createdAt: task?.createdAt,
        initialConditions: task?.initialConditions,
        currentConditions: task?.currentConditions,
        expectedMetrics: task?.expectedMetrics,
        templateId: task?.templateId,
      },
      null,
      2,
    )}\n\n模板信息:\n${JSON.stringify(
      {
        id: template?.id,
        name: template?.name,
        description: template?.description,
        initialConditions: template?.initialConditions,
        quboConfig: template?.quboConfig,
      },
      null,
      2,
    )}\n\n实时采样:\n${JSON.stringify(
      {
        fe,
        currentDensity,
        temperature,
        cellVoltage,
        co2Flow,
      },
      null,
      2,
    )}\n\n异常信号摘要:\n- ${signals.length > 0 ? signals.join('\n- ') : '无明显异常，但仍需微调以提高稳定性'}\n\n请给出决策输出。`

    const { output } = await generateText({
      model: openrouter(DEFAULT_MODEL),
      system: decisionSystem,
      prompt,
      output: Output.object({
        schema: DecisionOutputSchema,
        name: 'DecisionAgentOutput',
        description: 'Decision agent output for adaptive parameter tuning',
      }),
    })

    // 由后端用代理模型计算“期望性能指标”（保证数值稳定）
    const expectedFe = getSurrogateFE(output.setpoints.currentDensity, output.setpoints.temperature, output.setpoints.co2Flow)
    const expectedVoltage = getSurrogateVoltage(output.setpoints.currentDensity, output.setpoints.temperature)
    const expectedSpc = getSurrogateSPC(expectedFe, expectedVoltage)

    return res.json({
      ...output,
      expectedMetrics: {
        fe: parseFloat(expectedFe.toFixed(1)),
        voltage: parseFloat(expectedVoltage.toFixed(2)),
        spc: parseFloat(expectedSpc.toFixed(1)),
      },
      receivedSignals: signals,
      decidedAt: new Date().toISOString(),
      model: DEFAULT_MODEL,
    })
  } catch (error) {
    console.error('Decision Agent error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─────────────────────────────────────────────────────────────
// Chat API 路由
// ─────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, context } = req.body as { messages: UIMessage[]; context?: ChatContext }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages is required and must be an array' })
    }

    // 检查 API Key
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ 
        error: 'OPENROUTER_API_KEY is not configured. Please set it in .env.local file.' 
      })
    }

    const ctx = context || {}
    const safeRunningTasks = Array.isArray(ctx.runningTasks) ? ctx.runningTasks : []
    const safeCompletedTasks = Array.isArray(ctx.completedTasks) ? ctx.completedTasks : []
    const safeTemplates = Array.isArray(ctx.templates) ? ctx.templates : []

    const tools = {
      getActiveTasks: tool({
        description: '获取当前正在运行的活跃任务列表（包含 ID、名称、状态、运行时长、初始条件等）',
        inputSchema: z.object({
          limit: z.number().int().min(1).max(50).optional().default(10).describe('返回数量上限'),
        }),
        execute: async ({ limit }) => {
          return safeRunningTasks.slice(0, limit).map((t: any) => {
            const runtime = formatDurationFromCreatedAt(t?.createdAt)
            return runtime ? { ...t, timeElapsed: runtime, runtime } : t
          })
        },
      }),
      getHistoryTasks: tool({
        description: '获取已完成或失败的历史任务列表（包含最终结果、产出数据等）',
        inputSchema: z.object({
          limit: z.number().int().min(1).max(50).optional().default(10).describe('返回数量上限'),
        }),
        execute: async ({ limit }) => {
          return safeCompletedTasks.slice(0, limit)
        },
      }),
      getTaskById: tool({
        description: '根据任务 ID 获取任务详情（优先用于用户指定某个任务 ID 的查询）',
        inputSchema: z.object({
          taskId: z.string().min(1).describe('任务 ID，例如 T-1234'),
        }),
        execute: async ({ taskId }) => {
          const all = [...safeRunningTasks, ...safeCompletedTasks]
          const found = all.find((t: any) => t?.id === taskId) || null
          if (found && (found.status === 'running' || found.status === 'queued' || found.status === 'analyzing')) {
            const runtime = formatDurationFromCreatedAt((found as any)?.createdAt)
            return runtime ? { ...(found as any), timeElapsed: runtime, runtime } : found
          }
          return found
        },
      }),
      getImpactMetrics: tool({
        description: '获取商业价值看板汇总指标：累计 CO₂ 处理量、CO 产物估值、平均法拉第效率',
        inputSchema: z.object({}),
        execute: async () => {
          // 优先使用前端传入的汇总（如果存在），否则用历史任务计算
          const totalCO2FromCtx = ctx.impactMetrics?.totalCO2
          const totalValueFromCtx = ctx.impactMetrics?.totalValue
          const avgFEFromCtx = ctx.impactMetrics?.avgFE

          const totalCO2 =
            typeof totalCO2FromCtx === 'number'
              ? totalCO2FromCtx
              : safeCompletedTasks.reduce((acc: number, t: any) => acc + (t?.result?.co2Processed || 0), 0)
          const totalValue =
            typeof totalValueFromCtx === 'number'
              ? totalValueFromCtx
              : safeCompletedTasks.reduce((acc: number, t: any) => acc + (t?.result?.coValue || 0), 0)
          const avgFE =
            typeof avgFEFromCtx === 'number'
              ? avgFEFromCtx
              : safeCompletedTasks.length > 0
                ? safeCompletedTasks.reduce((acc: number, t: any) => acc + (t?.result?.fe || 0), 0) / safeCompletedTasks.length
                : 0

          return {
            totalCO2,
            totalValue,
            avgFE,
            historyCount: safeCompletedTasks.length,
          }
        },
      }),
      getQuboTemplates: tool({
        description: '获取参数模板库列表（包含模板名称、描述、初始条件、QUBO JSON 配置）',
        inputSchema: z.object({
          limit: z.number().int().min(1).max(100).optional().default(50).describe('返回数量上限'),
          query: z.string().optional().describe('按名称/描述关键字过滤'),
        }),
        execute: async ({ limit, query }) => {
          const q = (query || '').trim().toLowerCase()
          const filtered = q
            ? safeTemplates.filter((t: any) => `${t?.name || ''} ${t?.description || ''}`.toLowerCase().includes(q))
            : safeTemplates
          return filtered.slice(0, limit)
        },
      }),
      getTemplateById: tool({
        description: '根据模板 ID 获取模板详情（含初始条件与 QUBO JSON）',
        inputSchema: z.object({
          templateId: z.string().min(1).describe('模板 ID，例如 TPL-001'),
        }),
        execute: async ({ templateId }) => {
          return safeTemplates.find((t: any) => t?.id === templateId) || null
        },
      }),
    }

    const result = streamText({
      model: openrouter(DEFAULT_MODEL),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
    })

    // 使用 pipeUIMessageStreamToResponse 直接管道到 Express response
    result.pipeUIMessageStreamToResponse(res)

  } catch (error) {
    console.error('Chat API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Health check
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', service: 'QuantumSentry AI Chat' })
})

// ─────────────────────────────────────────────────────────────
// 启动服务器
// ─────────────────────────────────────────────────────────────
const PORT = process.env.CHAT_PORT || 3001

app.listen(PORT, () => {
  console.log(`\n🚀 QuantumSentry AI Chat Server running on http://localhost:${PORT}`)
  console.log(`   Model: ${DEFAULT_MODEL}`)
  console.log(`   API Key: ${process.env.OPENROUTER_API_KEY ? '✅ Configured' : '❌ Not configured'}`)
  console.log(`\n   System prompt location: server/chat.ts (SYSTEM_PROMPT constant)\n`)
})
