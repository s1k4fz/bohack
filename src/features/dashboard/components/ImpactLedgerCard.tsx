import { TrendingUp, TrendingDown, DollarSign, Factory, Zap } from 'lucide-react'

export function ImpactLedgerCard() {
  return (
    <div className="h-full flex flex-col justify-between py-2">
      {/* 1. CO2 Processed - Primary Metric */}
      <div className="group px-6 py-3 rounded-lg transition-colors hover:bg-zinc-900/40 cursor-default">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-300">
            <Factory className="w-4 h-4" />
            <span className="text-xs font-medium tracking-wide">累计 CO₂ 处理量</span>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <TrendingUp className="w-3 h-3" />
            +12.5%
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-zinc-100 tracking-tight">2,845.2</span>
          <span className="text-sm font-medium text-zinc-500">kg</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px bg-zinc-900/50" />

      {/* 2. Market Value - Financial Metric */}
      <div className="group px-6 py-3 rounded-lg transition-colors hover:bg-zinc-900/40 cursor-default">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-300">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium tracking-wide">CO 产物估值</span>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <TrendingUp className="w-3 h-3" />
            +8.2%
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg text-zinc-500 font-light">$</span>
          <span className="text-3xl font-bold text-zinc-100 tracking-tight">14,280</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px bg-zinc-900/50" />

      {/* 3. Avg FE Efficiency - Technical Metric */}
      <div className="group px-6 py-3 rounded-lg transition-colors hover:bg-zinc-900/40 cursor-default">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-300">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-medium tracking-wide">平均法拉第效率</span>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-medium text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
            <TrendingDown className="w-3 h-3" />
            -1.4%
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-zinc-100 tracking-tight">89.4</span>
          <span className="text-sm font-medium text-zinc-500">%</span>
        </div>
      </div>
    </div>
  )
}
