import { SkillsDashboardView } from './SkillsDashboardView'
import { SkillsLibraryView } from './SkillsLibraryView'
import { PlaceholderGrid } from './PlaceholderGrid'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SkillsNavId } from './types'

interface SkillsContentProps {
  active: SkillsNavId
}

export function SkillsContent({ active }: SkillsContentProps) {
  if (active === 'installed') {
    return <SkillsLibraryView />
  }

  if (active === 'explore') {
    return <SkillsDashboardView />
  }

  if (active === 'install') {
    return (
      <ScrollArea className="h-full">
        <PlaceholderGrid
          title="Install Skills"
          description="Browse and install skills from registries. Placeholder cards only for this spike."
          count={10}
        />
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className="h-full">
      <PlaceholderGrid
        title="Presets"
        description="Saved skill bundles and preset packs. Placeholder content for navigation wiring."
        count={9}
      />
    </ScrollArea>
  )
}
