import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * The search box the copy dialogs share. It only narrows what is visible:
 * selections made before a query stay selected while their rows are hidden.
 */
export function ProviderSearchField({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <InputGroup>
      <InputGroupAddon>
        <Search className="size-3.5" />
      </InputGroupAddon>
      <InputGroupInput
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={t('skills.installed.searchProviders')}
        aria-label={t('skills.installed.searchProviders')}
        autoComplete="off"
        spellCheck={false}
        autoFocus
      />
      {query ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={t('skills.installed.clearProviderSearch')}
            onClick={() => onQueryChange('')}
          >
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
