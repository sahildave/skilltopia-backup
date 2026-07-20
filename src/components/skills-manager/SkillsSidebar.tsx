import {
  BookOpen,
  Download,
  LayoutDashboard,
  Layers,
  Settings,
  Eye,
  ListChecks,
  EyeClosed,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SkillsNavId } from './types'
import { executeCommand, useCommandContext } from '@/lib/commands'
import appLogo from '@/assets/logo.png';

const PRIMARY_NAV: {
  id: SkillsNavId
  label: string
  icon: typeof BookOpen
}[] = [
  { id: 'dashboard', label: 'Explore', icon: LayoutDashboard },
  { id: 'library', label: 'Installed', icon: ListChecks },
]

interface SkillsSidebarProps {
  active: SkillsNavId
  onSelect: (id: SkillsNavId) => void
}

export function SkillsSidebar({ active, onSelect }: SkillsSidebarProps) {
  const commandContext = useCommandContext()

  const handleOpenPreferences = async () => {
    const result = await executeCommand('open-preferences', commandContext)
    if (!result.success && result.error) {
      commandContext.showToast(result.error, 'error')
    }
  }

  return (
    <div className="flex h-full flex-col bg-muted/40">
      <div className="flex items-center gap-1.5 px-4 py-4">
        <div className="size-12 items-center justify-center rounded-xl overflow-clip">
         <img src={appLogo} alt="Logo" width="100%" height="100%" />
        </div>
        <div className="min-w-0 flex flex-col gap-1">
          {/* <h1 className="truncate text-xl pt-1 leading-none font-semibold text-balance">
            Skills<br/> Hub
          </h1> */}
          
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
        <div className="flex flex-row justify-between items-center">
          <Button
          disabled
          variant="ghost"
          className="text-muted-foreground justify-center"
        >
          <Eye className="size-4" />
          Review
        </Button>
        <p className="text-xs text-muted-foreground/70 shrink-0">Coming soon</p>
        </div>


      <div className="py-2 h-full flex justify-end items-end">
        <Button
        onClick={handleOpenPreferences}
          variant="ghost"
          className="text-muted-foreground w-full justify-start"
          
        >
          <Settings className="size-4" />
          Settings
        </Button>
      </div>

      </nav>
    </div>
  )
}
