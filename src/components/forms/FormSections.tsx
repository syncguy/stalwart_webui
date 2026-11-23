/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { ReactNode } from 'react';
import { useSchemaText } from '@/hooks/useSchemaText';
import { sectionDisplayContext } from '@/i18n/schemaFormContext';
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
  variantFormKey?: string;
  parentSectionCount?: number;
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
  variantFormKey,
  parentSectionCount = 0,
  sectionId,
  data,
  errors,
  readOnly,
  onFieldChange,
  variant,
  renderers,
}: FormSectionsProps) {
  const display = useSchemaText();
  return (
    <>
      {sections.map((section) => {
        const context = sectionDisplayContext(section.key, formKey, variantFormKey, parentSectionCount);
        const fieldLabel = (name: string, label: string) =>
          context.formKey ? display(`form/${context.formKey}/field/${name}`, label) : label;
        return (
        <FormSectionCard
          key={section.key}
          id={sectionId?.(section.key)}
          title={section.title && context.formKey ? display(`form/${context.formKey}/section/${context.sectionKey}`, section.title) : section.title}
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
                  formField={{
                    ...formField,
                    label: fieldLabel(formField.name, formField.label),
                    keyLabel: formField.keyLabel && context.formKey
                      ? display(`form/${context.formKey}/field/${formField.name}/keyLabel`, formField.keyLabel)
                      : formField.keyLabel,
                    valueLabel: formField.valueLabel && context.formKey
                      ? display(`form/${context.formKey}/field/${formField.name}/valueLabel`, formField.valueLabel)
                      : formField.valueLabel,
                    placeholder: formField.placeholder && context.formKey
                      ? display(`form/${context.formKey}/field/${formField.name}/placeholder`, formField.placeholder)
                      : formField.placeholder,
                  }}
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
                formKey={context.formKey}
                value={data[formField.name]}
                onChange={(v) => onFieldChange(formField.name, v)}
                error={errors[formField.name]}
              />
            );
          })}
        </FormSectionCard>
        );
      })}
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
