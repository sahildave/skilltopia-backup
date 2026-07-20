import { LayoutDashboard, Settings, Eye, ListChecks } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SkillsNavId } from './types'
import { executeCommand, useCommandContext } from '@/lib/commands'
import appLogo from '@/assets/logo.png'

const PRIMARY_NAV: {
  id: SkillsNavId
  labelKey: string
  icon: LucideIcon
}[] = [
  {
    id: 'explore',
    labelKey: 'skills.sidebar.explore',
    icon: LayoutDashboard,
  },
  { id: 'installed', labelKey: 'skills.sidebar.installed', icon: ListChecks },
]

interface SkillsSidebarProps {
  active: SkillsNavId
  onSelect: (id: SkillsNavId) => void
}

export function SkillsSidebar({ active, onSelect }: SkillsSidebarProps) {
  const { t } = useTranslation()
  const commandContext = useCommandContext()

  const handleOpenPreferences = async () => {
    const result = await executeCommand('open-preferences', commandContext)
    if (!result.success && result.error) {
      commandContext.showToast(result.error, 'error')
    }
  }

  return (
    <div className="flex h-full flex-col bg-muted/40">
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="size-11 overflow-hidden rounded-lg border bg-background">
          <img
            src={appLogo}
            alt=""
            className="size-full object-cover"
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 flex flex-col gap-1">
          <h1 className="truncate text-sm font-semibold text-balance">
            {t('web.shell.brand')}
          </h1>
          <p className="text-muted-foreground truncate text-xs">
            {t('skills.sidebar.workspace')}
          </p>
        </div>
      </div>

      <nav
        className="flex flex-1 flex-col gap-1 px-2"
        aria-label={t('skills.sidebar.primaryNav')}
      >
        {PRIMARY_NAV.map(item => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                'app-pressable app-pressable-subtle relative flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                isActive
                  ? 'bg-background text-foreground font-medium shadow-xs'
                  : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                'focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]'
              )}
            >
              {isActive ? (
                <span
                  aria-hidden
                  className="bg-primary absolute inset-y-1 start-0 w-0.5 rounded-full"
                />
              ) : null}
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{t(item.labelKey)}</span>
            </button>
          )
        })}
        <div className="mt-2 flex items-center gap-2 px-1">
          <Button
            disabled
            variant="ghost"
            className="text-muted-foreground flex-1 justify-start"
          >
            <Eye data-icon="inline-start" />
            {t('skills.sidebar.review')}
          </Button>
          <span className="text-muted-foreground shrink-0 text-xs">
            {t('skills.sidebar.comingSoon')}
          </span>
        </div>

        <div className="mt-auto py-2">
          <Button
            onClick={handleOpenPreferences}
            variant="ghost"
            className="text-muted-foreground w-full justify-start"
          >
            <Settings data-icon="inline-start" />
            {t('skills.sidebar.settings')}
          </Button>
        </div>
      </nav>
    </div>
  )
}
