import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import type { CopyProviderResult, InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { platform } from '@platform';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { buildCopyProviderDialogModel, type CopyProviderOption } from './installed-skills-model';
import { isPermissionError } from './library-errors';

function ProviderCheckboxRow({
  option,
  checked,
  disabled,
  onCheckedChange,
}: {
  option: CopyProviderOption;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const id = `copy-provider-${option.id}`;
  return (
    <Field orientation="horizontal" data-disabled={disabled || undefined}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange?.(value === true)}
      />
      <FieldLabel htmlFor={id} className="font-normal">
        {option.name}
      </FieldLabel>
    </Field>
  );
}

function CollapsibleSection({
  title,
  open,
  onOpenChange,
  children,
  empty,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  empty?: boolean;
}) {
  if (empty) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="text-muted-foreground flex items-center gap-1 text-start text-sm font-medium"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <ChevronDown
          aria-hidden
          className={cn('size-4 shrink-0 transition-transform', open ? 'rotate-0' : '-rotate-90')}
        />
        {title}
      </button>
      {open ? children : null}
    </div>
  );
}

export function CopyProvidersDialog({
  skill,
  snapshot,
  open,
  onOpenChange,
}: {
  skill: ScannedSkill;
  snapshot: InstalledScanSnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const rescan = useInstalledScanStore((state) => state.rescan);
  const model = buildCopyProviderDialogModel(skill, snapshot);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [installedOpen, setInstalledOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedCount = selectedIds.size;
  const availableIds = model.available.map((p) => p.id);
  const availableSelectedCount = availableIds.filter((id) => selectedIds.has(id)).length;
  const allAvailableSelected =
    availableIds.length > 0 && availableSelectedCount === availableIds.length;
  const someAvailableSelected = availableSelectedCount > 0 && !allAvailableSelected;
  const availableGroupChecked: boolean | 'indeterminate' = allAvailableSelected
    ? true
    : someAvailableSelected
      ? 'indeterminate'
      : false;

  const resetState = () => {
    setSelectedIds(new Set());
    setInstalledOpen(false);
    setOtherOpen(false);
    setSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      resetState();
    }
  };

  const toggleId = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleCopyAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of availableIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const providerLabel = (providerId: string) =>
    snapshot.providers.find((p) => p.id === providerId)?.name ?? providerId;

  const issueProviderNames = (results: CopyProviderResult[]): string =>
    results
      .filter((r) => r.status === 'conflict' || r.status === 'failed')
      .map((r) => providerLabel(r.providerId))
      .join(', ');

  const handleSubmit = async () => {
    if (selectedCount === 0) return;
    setSubmitting(true);
    try {
      const result = await platform.copySkillToProviders(skill.uninstallName, [...selectedIds]);
      const copied = result.results.filter((r) => r.status === 'copied');
      const conflicts = result.results.filter((r) => r.status === 'conflict');
      const failed = result.results.filter((r) => r.status === 'failed');
      const issues = issueProviderNames(result.results);

      if (copied.length > 0 && conflicts.length === 0 && failed.length === 0) {
        toast.success(
          t('skills.installed.copySuccess', {
            name: skill.name,
            count: copied.length,
          }),
        );
      } else if (copied.length > 0) {
        toast.warning(
          t('skills.installed.copyPartial', {
            name: skill.name,
            copied: copied.length,
            failed: conflicts.length + failed.length,
          }),
          issues
            ? { description: t('skills.installed.copyIssuesDescription', { providers: issues }) }
            : undefined,
        );
      } else {
        toast.error(t('skills.installed.copyFailed', { name: skill.name }), {
          description: issues
            ? t('skills.installed.copyIssuesDescription', { providers: issues })
            : (failed[0]?.message ?? conflicts[0]?.message),
        });
      }

      handleOpenChange(false);
      if (copied.length > 0) {
        await rescan();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isPermissionError(message)) {
        toast.error(t('skills.install.permissionError'), { description: message });
      } else {
        toast.error(t('skills.installed.copyFailed', { name: skill.name }), {
          description: message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('skills.installed.copyTitle', { name: skill.name })}</DialogTitle>
          <DialogDescription>{t('skills.installed.copyDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex h-[min(60vh,24rem)] flex-col gap-4 overflow-y-auto">
          <FieldSet>
            {model.available.length > 0 ? (
              <FieldGroup data-slot="checkbox-group" className="gap-3">
                <Field orientation="horizontal">
                  <Checkbox
                    id="copy-all-available"
                    checked={availableGroupChecked}
                    onCheckedChange={(value) => handleCopyAll(value === true)}
                  />
                  <FieldLabel htmlFor="copy-all-available">
                    {t('skills.installed.copyAvailable')}
                  </FieldLabel>
                </Field>
                {model.available.map((option) => (
                  <ProviderCheckboxRow
                    key={option.id}
                    option={option}
                    checked={selectedIds.has(option.id)}
                    onCheckedChange={(checked) => toggleId(option.id, checked)}
                  />
                ))}
              </FieldGroup>
            ) : (
              <>
                <FieldLegend variant="label">{t('skills.installed.copyAvailable')}</FieldLegend>
                <p className="text-muted-foreground text-sm text-pretty">
                  {t('skills.installed.copyAvailableEmpty')}
                </p>
              </>
            )}
          </FieldSet>

          <CollapsibleSection
            title={t('skills.installed.copyInstalled')}
            open={installedOpen}
            onOpenChange={setInstalledOpen}
            empty={model.installed.length === 0}
          >
            <FieldGroup data-slot="checkbox-group" className="gap-3 ps-5">
              {model.installed.map((option) => (
                <ProviderCheckboxRow key={option.id} option={option} checked disabled />
              ))}
            </FieldGroup>
          </CollapsibleSection>

          <CollapsibleSection
            title={t('skills.installed.copyOther')}
            open={otherOpen}
            onOpenChange={setOtherOpen}
            empty={model.other.length === 0}
          >
            <FieldGroup data-slot="checkbox-group" className="gap-3 ps-5">
              {model.other.map((option) => (
                <ProviderCheckboxRow
                  key={option.id}
                  option={option}
                  checked={selectedIds.has(option.id)}
                  onCheckedChange={(checked) => toggleId(option.id, checked)}
                />
              ))}
            </FieldGroup>
          </CollapsibleSection>
        </div>

        <DialogFooter className="sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm text-pretty">
            {t('skills.installed.copySummary', { count: selectedCount })}
          </p>
          <Button
            type="button"
            disabled={selectedCount === 0 || submitting}
            onClick={() => void handleSubmit()}
          >
            {t('skills.installed.copySubmit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
