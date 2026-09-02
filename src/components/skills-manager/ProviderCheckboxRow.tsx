import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import type { ReactNode } from 'react';
import type { CopyProviderOption } from './installed-skills-model';

export function ProviderCheckboxRow({
  option,
  checked,
  disabled,
  description,
  onCheckedChange,
}: {
  option: CopyProviderOption;
  checked: boolean;
  disabled?: boolean;
  description?: ReactNode;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const id = `copy-provider-${option.id}`;
  const label = (
    <FieldLabel htmlFor={id} className="font-normal">
      {option.name}
    </FieldLabel>
  );

  return (
    <Field orientation="horizontal" data-disabled={disabled || undefined}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange?.(value === true)}
      />
      {description ? (
        <FieldContent>
          {label}
          <FieldDescription>{description}</FieldDescription>
        </FieldContent>
      ) : (
        label
      )}
    </Field>
  );
}
