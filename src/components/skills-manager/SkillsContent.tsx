import { ScrollArea } from '@/components/ui/scroll-area'
import { PlaceholderGrid } from './PlaceholderGrid'
import { SkillsLibraryView } from './SkillsLibraryView'
import type { SkillsNavId } from './types'

interface SkillsContentProps {
  active: SkillsNavId
}

export function SkillsContent({ active }: SkillsContentProps) {
  if (active === 'library') {
    return <SkillsLibraryView />
  }

  if (active === 'dashboard') {
    return (
      <ScrollArea className="h-full">
        <PlaceholderGrid
          title="Dashboard"
          description="Overview placeholders for skill health, recent installs, and sync status."
          count={8}
        />
      </ScrollArea>
    )
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
