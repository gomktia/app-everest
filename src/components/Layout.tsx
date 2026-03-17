import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { SidebarProvider } from './ui/sidebar'
import { UnifiedSidebar } from './UnifiedSidebar'
import { OfflineIndicator } from './ui/OfflineIndicator'
import { ViewAsStudentBanner } from './ViewAsStudentBanner'

export default function Layout() {
  const [isSidebarOpen, setSidebarOpen] = useState(true)

  return (
    <SidebarProvider open={isSidebarOpen} onOpenChange={setSidebarOpen}>
      <div className="flex min-h-screen w-full bg-background">
        <UnifiedSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <ViewAsStudentBanner />
          <Header />
          <main className="flex-grow p-3 sm:p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
      <OfflineIndicator />
    </SidebarProvider>
  )
}
