import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useTasks } from '@/contexts/TaskContext'
import {
  LayoutDashboard,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Globe,
  Sun,
  Moon,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react'

// 站点名称 - 可自定义
const SITE_NAME = 'QuantumSentry'

// 导航配置 - 可根据需要自定义
const navItems = [
  { icon: LayoutDashboard, label: '仪表盘', href: '/dashboard' },
]

// 任务状态图标
function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
    case 'analyzing':
      return <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
    case 'queued':
      return <Clock className="w-3 h-3 text-zinc-500" />
    case 'completed':
      return <CheckCircle2 className="w-3 h-3 text-emerald-400" />
    case 'failed':
      return <XCircle className="w-3 h-3 text-rose-400" />
    default:
      return <Play className="w-3 h-3 text-zinc-500" />
  }
}

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDarkMode] = useState(true)
  const [runningExpanded, setRunningExpanded] = useState(true)
  const [historyExpanded, setHistoryExpanded] = useState(true)
  const location = useLocation()
  const { runningTasks, completedTasks } = useTasks()

  // 获取当前页面标题
  const getPageTitle = () => {
    if (location.pathname.startsWith('/dashboard/task/')) {
      return '任务详情'
    }
    if (location.pathname.startsWith('/dashboard/history/')) {
      return '历史详情'
    }
    return navItems.find(item => 
      location.pathname === item.href || 
      (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
    )?.label || '仪表盘'
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-60 bg-zinc-950 border-r border-zinc-900 transform transition-transform duration-200 ease-in-out lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="relative flex items-center justify-center h-14 lg:h-16 px-4 border-b border-zinc-900">
            <Link to="/" className="flex items-center justify-center">
              <span className="text-xl font-extrabold text-white tracking-tight">{SITE_NAME}</span>
            </Link>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="absolute right-4 lg:hidden p-1.5 text-zinc-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto sidebar-nav-scroll">
            {/* 主导航 */}
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                      isActive 
                        ? 'bg-zinc-900 text-white' 
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </div>

            {/* 运行中任务 */}
            <div className="mt-6">
              <button
                onClick={() => setRunningExpanded(!runningExpanded)}
                className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-400"
              >
                <span className="flex items-center gap-2">
                  <Play className="w-3 h-3" />
                  运行中任务
                  {runningTasks.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold">
                      {runningTasks.length}
                    </span>
                  )}
                </span>
                <ChevronDown className={cn(
                  'w-3.5 h-3.5 transition-transform',
                  runningExpanded ? '' : '-rotate-90'
                )} />
              </button>
              
              {runningExpanded && (
                <div className="mt-1 space-y-0.5">
                  {runningTasks.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-zinc-600 italic">
                      暂无运行中的任务
                    </div>
                  ) : (
                    runningTasks.map((task) => {
                      const isActive = location.pathname === `/dashboard/task/${task.id}`
                      return (
                        <Link
                          key={task.id}
                          to={`/dashboard/task/${task.id}`}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-md text-[12px] transition-all',
                            isActive
                              ? 'bg-zinc-900 text-white'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                          )}
                        >
                          <TaskStatusIcon status={task.status} />
                          <span className="truncate flex-1">{task.name}</span>
                          <span className="text-[10px] text-zinc-600">{task.progress}%</span>
                        </Link>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* 已完成任务 */}
            <div className="mt-4">
              <button
                onClick={() => setHistoryExpanded(!historyExpanded)}
                className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-400"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3" />
                  已完成任务
                  {completedTasks.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold">
                      {completedTasks.length}
                    </span>
                  )}
                </span>
                <ChevronDown className={cn(
                  'w-3.5 h-3.5 transition-transform',
                  historyExpanded ? '' : '-rotate-90'
                )} />
              </button>
              
              {historyExpanded && (
                <div className="mt-1 space-y-0.5">
                  {completedTasks.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-zinc-600 italic">
                      暂无已完成的任务
                    </div>
                  ) : (
                    completedTasks.slice(0, 10).map((task) => {
                      const isActive = location.pathname === `/dashboard/history/${task.id}`
                      return (
                        <Link
                          key={task.id}
                          to={`/dashboard/history/${task.id}`}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-md text-[12px] transition-all',
                            isActive
                              ? 'bg-zinc-900 text-white'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                          )}
                        >
                          <TaskStatusIcon status={task.status} />
                          <span className="truncate flex-1">{task.name}</span>
                          {task.result && (
                            <span className="text-[10px] text-emerald-500">{task.result.fe}%</span>
                          )}
                        </Link>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-zinc-900">
            <div className="px-3 py-2 text-xs text-zinc-600">
              © 2025 QuantumSentry
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 lg:h-16 bg-black/80 backdrop-blur-xl border-b border-zinc-900">
          <div className="flex items-center justify-between h-full px-3 lg:px-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-zinc-500 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile title */}
            <div className="lg:hidden flex-1 text-center">
              <span className="text-sm font-medium text-zinc-400">
                {getPageTitle()}
              </span>
            </div>

            {/* Breadcrumb (Desktop only) */}
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-zinc-600">Dashboard</span>
              <ChevronRight className="w-4 h-4 text-zinc-700" />
              <span className="text-zinc-400">
                {getPageTitle()}
              </span>
            </div>

            {/* Right section - 工具按钮 */}
            <div className="flex items-center gap-0.5 lg:gap-1 px-1 lg:px-1.5 py-0.5 lg:py-1 rounded-full border border-zinc-800 bg-zinc-900/50">
              <button
                className="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                aria-label="切换语言"
              >
                <Globe className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </button>
              <button
                className="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                aria-label="切换主题"
              >
                {isDarkMode ? (
                  <Sun className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                ) : (
                  <Moon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
