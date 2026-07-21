import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { InstalledScanSnapshot, ScanWarning } from '@/platform/types';
import type { LibraryLayoutMode } from '@/store/installed-skills-ui-store';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FilteredSkillSections, ProviderFilterId } from './installed-skills-model';
import { emptyMessage, warningKey } from './library-path';
import { ScanWarningBanner } from './ScanWarningBanner';
import { SkillCardContainer } from './SkillCardContainer';

export function InstalledContent({
  snapshot,
  error,
  showPermissionCard,
  refreshing,
  warnings,
  sections,
  providerFilter,
  layoutMode,
  hasActiveSkillQuery = false,
  onRescan,
}: {
  snapshot: InstalledScanSnapshot | null;
  error: string | null;
  showPermissionCard: boolean;
  refreshing: boolean;
  warnings: ScanWarning[];
  sections: FilteredSkillSections | null;
  providerFilter: ProviderFilterId;
  layoutMode: LibraryLayoutMode;
  hasActiveSkillQuery?: boolean;
  onRescan: () => void;
}) {
  const { t } = useTranslation();
  const isEmpty =
    sections !== null && sections.primary.length === 0 && !sections.universalSection?.length;

  return (
    <div className="relative min-h-0 flex-1">
      {showPermissionCard ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-6">
          <Card className="w-full max-w-md shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="size-4" />
                {t('skills.installed.permissionTitle')}
              </CardTitle>
              <CardDescription className="text-pretty">
                {t('skills.installed.permissionBody')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs text-pretty whitespace-pre-wrap">
                {error}
              </pre>
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={onRescan} disabled={refreshing}>
                {t('skills.installed.tryAgain')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : null}

      <ScrollArea className="h-full">
        <div className="flex flex-col gap-6 p-6">
          {error && !showPermissionCard ? (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="text-destructive text-base">
                  {t('skills.installed.scanFailedTitle')}
                </CardTitle>
                <CardDescription className="text-pretty">
                  {t('skills.installed.scanFailedBody')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                  {error}
                </pre>
              </CardContent>
            </Card>
          ) : null}

          {warnings.length > 0 ? (
            <div className="flex flex-col gap-2">
              {warnings.map((warning) => (
                <ScanWarningBanner key={warningKey(warning)} warning={warning} />
              ))}
            </div>
          ) : null}

          {snapshot === null && refreshing ? (
            <p className="text-muted-foreground text-sm text-pretty">
              {t('skills.installed.loading')}
            </p>
          ) : null}

          {isEmpty ? (
            <p className="text-muted-foreground text-sm text-pretty">
              {hasActiveSkillQuery
                ? t('skills.installed.noMatchingSkills')
                : emptyMessage(providerFilter, t)}
            </p>
          ) : null}

          {sections && sections.primary.length > 0 && snapshot ? (
            <SkillCardContainer
              skills={sections.primary}
              snapshot={snapshot}
              providerFilter={providerFilter}
              layoutMode={layoutMode}
            />
          ) : null}

          {sections?.universalSection && sections.universalSection.length > 0 && snapshot ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">{t('skills.installed.universalSection')}</h2>
              <SkillCardContainer
                skills={sections.universalSection}
                snapshot={snapshot}
                providerFilter={providerFilter}
                layoutMode={layoutMode}
              />
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
