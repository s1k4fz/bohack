import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Settings,
  Menu,
  X,
  ChevronRight,
  Globe,
  Sun,
  Moon,
} from 'lucide-react'

// 站点名称 - 可自定义
const SITE_NAME = 'Dashboard'

// Logo 组件 - 可替换为自己的 Logo
function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn('w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center', className)}>
      <span className="text-xs font-bold text-white">D</span>
    </div>
  )
}

// 导航配置 - 可根据需要自定义
const navItems = [
  { icon: LayoutDashboard, label: '仪表盘', href: '/dashboard' },
  { icon: Settings, label: '设置', href: '/dashboard/settings' },
]

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDarkMode] = useState(true)
  const location = useLocation()

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
        'fixed inset-y-0 left-0 z-50 w-56 bg-zinc-950 border-r border-zinc-900 transform transition-transform duration-200 ease-in-out lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-14 lg:h-16 px-4 border-b border-zinc-900">
            <Link to="/" className="flex items-center gap-2">
              <BrandLogo />
              <span className="text-[15px] font-semibold text-white tracking-tight">{SITE_NAME}</span>
            </Link>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-zinc-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto sidebar-nav-scroll">
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href || 
                  (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
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
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-zinc-900">
            <div className="px-3 py-2 text-xs text-zinc-600">
              © 2025 Your Company
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-56">
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
                {navItems.find(item => 
                  location.pathname === item.href || 
                  (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
                )?.label || '仪表盘'}
              </span>
            </div>

            {/* Breadcrumb (Desktop only) */}
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-zinc-600">Dashboard</span>
              <ChevronRight className="w-4 h-4 text-zinc-700" />
              <span className="text-zinc-400">
                {navItems.find(item => 
                  location.pathname === item.href || 
                  (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
                )?.label || '仪表盘'}
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
