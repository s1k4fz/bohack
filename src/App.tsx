import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DashboardLayout } from '@/features/dashboard/layouts/DashboardLayout'
import { OverviewPage } from '@/features/dashboard/pages/OverviewPage'
import { TaskDetailPage } from '@/features/dashboard/pages/TaskDetailPage'
import { HistoryDetailPage } from '@/features/dashboard/pages/HistoryDetailPage'
import { TaskProvider } from '@/contexts/TaskContext'
import { TemplateProvider } from '@/contexts/TemplateContext'

// 占位页面
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-zinc-100 mb-2">{title}</h1>
        <p className="text-zinc-500">此页面正在开发中...</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <TaskProvider>
      <TemplateProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<OverviewPage />} />
              {/* 运行中任务详情页 */}
              <Route path="task/:taskId" element={<TaskDetailPage />} />
              {/* 已完成任务详情页 */}
              <Route path="history/:taskId" element={<HistoryDetailPage />} />
              {/* 设置页面 */}
              <Route path="settings" element={<PlaceholderPage title="设置" />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TemplateProvider>
    </TaskProvider>
  )
}

export default App
