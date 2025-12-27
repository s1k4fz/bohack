import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DashboardLayout } from '@/features/dashboard/layouts/DashboardLayout'
import { OverviewPage } from '@/features/dashboard/pages/OverviewPage'

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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="settings" element={<PlaceholderPage title="设置" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
