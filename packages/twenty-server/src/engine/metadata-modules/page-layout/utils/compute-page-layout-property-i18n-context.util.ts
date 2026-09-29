import { RECORD_FORM_TAB_PROPS } from 'src/engine/metadata-modules/metadata-side-effect/constants/record-form-tab-props.constant';
import { type EffectiveEntityI18nContext } from 'src/engine/metadata-modules/overrides/types/effective-entity-i18n-context.type';
import { computeStandardDefaultPropertyI18nContext } from 'src/engine/metadata-modules/overrides/utils/compute-standard-default-property-i18n-context.util';
import {
  TAB_PROPS,
  WIDGET_PROPS,
} from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-page-layout-tabs.template';

type PageLayoutMetadataName = 'pageLayoutTab' | 'pageLayoutWidget';

const SYSTEM_PAGE_LAYOUT_TITLES: Record<
  PageLayoutMetadataName,
  ReadonlySet<string>
> = {
  pageLayoutTab: new Set([
    ...Object.values(TAB_PROPS).map(({ title }) => title),
    RECORD_FORM_TAB_PROPS.title,
  ]),
  pageLayoutWidget: new Set(
    Object.values(WIDGET_PROPS).map(({ title }) => title),
  ),
};

// Record pages the server creates for custom objects (Home, Timeline, Tasks,
// Notes, Files tabs and their widgets) are flagged as system side effects and
// keep the standard titles until edited.
export const computePageLayoutPropertyI18nContext = ({
  metadataName,
  isSystemSideEffect,
  property,
  baseValue,
  i18nContext,
}: {
  metadataName: PageLayoutMetadataName;
  isSystemSideEffect: unknown;
  property: string;
  baseValue: unknown;
  i18nContext: EffectiveEntityI18nContext;
}): EffectiveEntityI18nContext => {
  const isSystemTitle =
    isSystemSideEffect === true &&
    property === 'title' &&
    typeof baseValue === 'string' &&
    SYSTEM_PAGE_LAYOUT_TITLES[metadataName].has(baseValue);

  return computeStandardDefaultPropertyI18nContext({
    metadataName,
    property,
    baseValue,
    defaultValue: isSystemTitle ? baseValue : undefined,
    i18nContext,
  });
};
