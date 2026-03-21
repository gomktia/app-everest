import * as React from 'react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  sublabel?: string
}

interface SearchableComboboxProps {
  options: ComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
}

export function SearchableCombobox({
  options,
  value,
  onValueChange,
  placeholder = 'Selecione...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum resultado encontrado.',
  className,
  disabled,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const selected = options.find(o => o.value === value)

  const filtered = React.useMemo(() => {
    if (!search.trim()) return options
    const q = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return options.filter(o => {
      const label = o.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const sub = (o.sublabel || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return label.includes(q) || sub.includes(q)
    })
  }, [options, search])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm',
            'ring-offset-background placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'hover:bg-muted/30 transition-colors',
            className
          )}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? (
              <span className="flex items-center gap-2">
                <span className="truncate">{selected.label}</span>
                {selected.sublabel && (
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">{selected.sublabel}</span>
                )}
              </span>
            ) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 max-h-[300px]">
        <div className="flex items-center border-b border-border px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[240px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onValueChange(option.value === value ? '' : option.value)
                  setOpen(false)
                  setSearch('')
                }}
                className={cn(
                  'relative flex w-full cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm outline-none transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  option.value === value && 'bg-accent/50'
                )}
              >
                <Check className={cn('mr-2 h-4 w-4 shrink-0', option.value === value ? 'opacity-100' : 'opacity-0')} />
                <div className="flex flex-col min-w-0">
                  <span className="truncate font-medium">{option.label}</span>
                  {option.sublabel && (
                    <span className="truncate text-xs text-muted-foreground">{option.sublabel}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
