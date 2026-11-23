/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { ReactNode } from 'react';
import { useSchemaText } from '@/hooks/useSchemaText';
import { FieldRow } from '@/components/forms/FieldRow';
import { VariantSelect } from '@/components/forms/VariantSelect';
import type { EmbeddedVariant } from '@/lib/embeddedSchema';
import { cn } from '@/lib/utils';
import type { FieldErrors, FieldValues, RenderableSection } from '@/components/forms/formLogic';
import type { FieldOverrides } from '@/components/forms/useDynamicForm';

interface VariantControl {
  variants: readonly EmbeddedVariant[];
  value: string;
  onChange: (variant: string) => void;
}

interface FormSectionsProps {
  sections: RenderableSection[];
  formKey?: string;
  sectionId?: (key: string) => string;
  data: FieldValues;
  errors: FieldErrors;
  readOnly: boolean;
  onFieldChange: (name: string, value: unknown) => void;
  variant?: VariantControl;
  renderers?: FieldOverrides['render'];
}

export function FormSections({
  sections,
  formKey,
  sectionId,
  data,
  errors,
  readOnly,
  onFieldChange,
  variant,
  renderers,
}: FormSectionsProps) {
  const display = useSchemaText();
  const fieldLabel = (name: string, label: string) =>
    formKey ? display(`form/${formKey}/field/${name}`, label) : label;
  return (
    <>
      {sections.map((section) => (
        <FormSectionCard
          key={section.key}
          id={sectionId?.(section.key)}
          title={section.title && formKey ? display(`form/${formKey}/section/${section.key}`, section.title) : section.title}
        >
          {section.fields.map(({ formField, field }) => {
            if (!field) {
              if (!variant) return null;
              return (
                <VariantSelect
                  key={formField.name}
                  label={fieldLabel(formField.name, formField.label)}
                  variantScope={formKey}
                  variants={variant.variants}
                  value={variant.value}
                  onChange={variant.onChange}
                  readOnly={readOnly}
                />
              );
            }
            const Render = renderers && Object.hasOwn(renderers, formField.name) ? renderers[formField.name] : null;
            if (Render) {
              return (
                <Render
                  key={formField.name}
                  field={field}
                  formField={formField}
                  data={data}
                  errors={errors}
                  readOnly={readOnly}
                  onFieldChange={onFieldChange}
                />
              );
            }
            return (
              <FieldRow
                key={formField.name}
                field={field}
                formField={formField}
                formKey={formKey}
                value={data[formField.name]}
                onChange={(v) => onFieldChange(formField.name, v)}
                error={errors[formField.name]}
              />
            );
          })}
        </FormSectionCard>
      ))}
    </>
  );
}

export function FormSectionCard({ id, title, children }: { id?: string; title?: string; children: ReactNode }) {
  return (
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      className="tile @container scroll-mt-20 px-5 pb-1.5 outline-none sm:px-6"
    >
      {title && <h2 className="section-title pb-1 pt-5">{title}</h2>}
      <div className={cn('divide-y divide-border', !title && 'pt-1')}>{children}</div>
    </section>
  );
}
