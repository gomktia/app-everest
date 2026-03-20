import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export interface TabItem {
  value: string
  label: string
  icon?: ReactNode
  count?: number
  content: ReactNode
}

interface PageTabsProps {
  tabs: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
  /** 'auto' = fit content, 'full' = equal width grid, number = fixed grid cols */
  layout?: 'auto' | 'full' | number
}

// Tailwind-safe grid classes (dynamic class names are not detected by purge)
const gridColsMap: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
}

export function PageTabs({ tabs, value, onChange, className, layout = 'auto' }: PageTabsProps) {
  const cols = layout === 'full' ? tabs.length : typeof layout === 'number' ? layout : 0
  const useGrid = cols > 0 && cols <= 4
  const gridClass = useGrid ? gridColsMap[cols] || '' : ''

  return (
    <Tabs value={value} onValueChange={onChange} className={cn('w-full', className)}>
      <TabsList className={cn(
        useGrid ? `w-full max-w-md grid ${gridClass}` : 'overflow-x-auto flex w-full justify-start gap-0',
      )}>
        {tabs.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 shrink-0 text-xs sm:text-sm sm:gap-2">
            {tab.icon}
            <span className="truncate">{tab.label}</span>
            {tab.count !== undefined && (
              <span className="ml-1 text-xs opacity-70">({tab.count})</span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(tab => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
