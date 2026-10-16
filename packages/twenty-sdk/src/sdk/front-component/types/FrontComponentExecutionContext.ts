import { type AppLocale } from 'twenty-shared/translations';

import { type FrontComponentToolCall } from './FrontComponentToolCall';

export type FrontComponentExecutionContext = {
  frontComponentId: string;
  userId: string | null;
  /**
   * @deprecated Use `selectedRecordIds` instead. Derive single record as `selectedRecordIds.length === 1 ? selectedRecordIds[0] : null`.
   */
  recordId: string | null;
  /** All selected record IDs */
  selectedRecordIds: string[];
  /**
   * The `nameSingular` of the object the records were selected FROM, when the
   * component was opened from a record context (a record page or a record
   * index). It is how a component can tell «اشخاص» from «فرصت‌ها» without
   * guessing: the ids alone do not say which object they belong to.
   *
   * `null` when the component was opened with no record context at all, which is
   * a different thing from an empty selection.
   */
  objectNameSingular: string | null;
  timelineActivityId: string | null;
  /** Resolved color scheme of the host UI ('System' is already resolved) */
  colorScheme: 'light' | 'dark';
  locale?: AppLocale;
  /** Set when the component renders an AI chat tool call */
  toolCall?: FrontComponentToolCall;
};
