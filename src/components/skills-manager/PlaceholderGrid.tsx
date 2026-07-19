import { Folder, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PlaceholderGridProps {
  title: string
  description: string
  count?: number
}

export function PlaceholderGrid({
  title,
  description,
  count = 9,
}: PlaceholderGridProps) {
  const items = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `${title.toLowerCase().replace(/\s+/g, '-')}-item-${index + 1}`,
    kind: index % 3 === 0 ? 'directory' : 'file',
  }))

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-balance">{title}</h1>
        <Badge variant="secondary" className="tabular-nums">
          {count}
        </Badge>
      </div>
      <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
        {description}
      </p>

      <div className="grid grid-cols-3 gap-4">
        {items.map(item => (
          <Card key={item.id} className="gap-4 py-4">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                {item.kind === 'directory' ? (
                  <Folder className="text-muted-foreground size-4" />
                ) : (
                  <FileText className="text-muted-foreground size-4" />
                )}
                <span className="truncate">{item.name}</span>
              </CardTitle>
              <CardDescription className="text-pretty">
                Placeholder content for the {title} section.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">placeholder</Badge>
                <Badge variant="outline">{item.kind}</Badge>
              </div>
            </CardContent>
            <CardFooter
              className={cn(
                'text-muted-foreground justify-between border-t px-4 pt-4 text-xs'
              )}
            >
              <span>Generic</span>
              <span>Available</span>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
