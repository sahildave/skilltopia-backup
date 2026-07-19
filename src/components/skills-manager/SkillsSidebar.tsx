import {
  BookOpen,
  Download,
  LayoutDashboard,
  Layers,
  Settings,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { SkillsNavId } from './types'

const PRIMARY_NAV: {
  id: SkillsNavId
  label: string
  icon: typeof BookOpen
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'install', label: 'Install Skills', icon: Download },
  { id: 'presets', label: 'Presets', icon: Layers },
]

interface SkillsSidebarProps {
  active: SkillsNavId
  onSelect: (id: SkillsNavId) => void
}

export function SkillsSidebar({ active, onSelect }: SkillsSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-muted/40">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md text-sm font-semibold">
          S
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-balance">
            Skills Manager
          </p>
          <p className="text-muted-foreground truncate text-xs">
            Global agent skills
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Primary">
        {PRIMARY_NAV.map(item => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                'relative flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-background text-foreground font-medium shadow-xs'
                  : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
              )}
            >
              {isActive ? (
                <span
                  aria-hidden
                  className="bg-primary absolute inset-y-1 start-0 w-0.5 rounded-full"
                />
              ) : null}
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}

        <Separator className="my-3" />

        <div className="px-3 py-1">
          <p className="text-muted-foreground text-xs font-medium uppercase">
            Global Workspace
          </p>
        </div>
        <div className="text-muted-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm">
          <Sparkles className="size-4 shrink-0" />
          <span className="truncate">All Agents</span>
          <span className="bg-muted ms-auto rounded-md px-1.5 py-0.5 text-xs tabular-nums">
            —
          </span>
        </div>
      </nav>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          className="text-muted-foreground w-full justify-start"
          disabled
        >
          <Settings className="size-4" />
          Settings
        </Button>
      </div>
    </div>
  )
}
