import { EngineComponentKey } from 'src/engine/metadata-modules/command-menu-item/enums/engine-component-key.enum';
import { NAVIGATION_INTERPOLATED_LABEL } from 'src/engine/metadata-modules/flat-command-menu-item/utils/build-object-navigation-universal-flat-command-menu-item.util';
import { type EffectiveEntityI18nContext } from 'src/engine/metadata-modules/overrides/types/effective-entity-i18n-context.type';
import { computeStandardDefaultPropertyI18nContext } from 'src/engine/metadata-modules/overrides/utils/compute-standard-default-property-i18n-context.util';

// Navigation commands the server creates for custom objects belong to the
// custom object's application but keep the standard "Go to {objectLabelPlural}"
// template until edited.
export const computeCommandMenuItemPropertyI18nContext = ({
  engineComponentKey,
  property,
  baseValue,
  i18nContext,
}: {
  engineComponentKey: unknown;
  property: string;
  baseValue: unknown;
  i18nContext: EffectiveEntityI18nContext;
}): EffectiveEntityI18nContext =>
  computeStandardDefaultPropertyI18nContext({
    metadataName: 'commandMenuItem',
    property,
    baseValue,
    defaultValue:
      engineComponentKey === EngineComponentKey.NAVIGATION &&
      property === 'label'
        ? NAVIGATION_INTERPOLATED_LABEL
        : undefined,
    i18nContext,
  });
