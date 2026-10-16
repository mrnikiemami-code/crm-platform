import { type FrontComponentExecutionContext } from '../types/FrontComponentExecutionContext';
import { useFrontComponentExecutionContext } from './useFrontComponentExecutionContext';

const selectObjectNameSingular = (
  context: FrontComponentExecutionContext,
): string | null => context.objectNameSingular;

/**
 * The `nameSingular` of the object the selected records belong to.
 *
 * A component that acts on a selection needs this: `selectedRecordIds` says
 * WHICH records, but not WHICH KIND, so an id alone cannot tell an Opportunity
 * from a Person. `null` means the component was opened with no record context.
 */
export const useObjectNameSingular = (): string | null => {
  return useFrontComponentExecutionContext(selectObjectNameSingular);
};
