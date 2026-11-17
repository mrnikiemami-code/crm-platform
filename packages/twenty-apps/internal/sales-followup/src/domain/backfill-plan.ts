import {
  buildSalesInteractionTitle,
  type SalesInteractionTitleState,
} from 'src/domain/sales-interaction-title';

// Planning a one-off backfill, as a pure function.
//
// The backfill is the ONE place where a title with no recorded ownership may be
// given one, because a person reviews the plan before it runs. The rules are still
// conservative: only an EMPTY title is filled, and every non-empty title is
// reported as preserved — including the legacy hand-written ones, whose flag is
// `null`. Nothing is ever deleted or shortened.
export type BackfillRecord = {
  id: string;
  callAttempt: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  title: string | null;
  titleIsAuto: boolean | null;
};

export type BackfillPlanItem =
  | { id: string; action: 'FILL'; title: string; because: 'TITLE_EMPTY' }
  | {
      id: string;
      action: 'PRESERVE';
      title: string | null;
      because: 'TITLE_MANUAL' | 'TITLE_UNBUILDABLE' | 'TITLE_UNCHANGED';
    };

export type BackfillPlanSummary = {
  items: BackfillPlanItem[];
  fill: number;
  preserve: number;
  preserveManual: number;
  preserveUnbuildable: number;
};

/**
 * Decides, per record, whether the backfill would write and what it would write.
 *
 * A record whose computed title already equals the stored one is `PRESERVE` with
 * `TITLE_UNCHANGED`, so running the backfill twice is a no-op the second time —
 * the property that makes it safe to re-run after a partial failure.
 */
export const planTitleBackfill = (
  records: readonly BackfillRecord[],
): BackfillPlanSummary => {
  const items: BackfillPlanItem[] = [];

  for (const record of records) {
    const state: SalesInteractionTitleState = {
      callAttempt: record.callAttempt,
      customerFirstName: record.customerFirstName,
      customerLastName: record.customerLastName,
      title: record.title,
      titleIsAuto: record.titleIsAuto,
    };

    const computed = buildSalesInteractionTitle(state);
    const hasTitle =
      typeof record.title === 'string' && record.title.trim().length > 0;

    if (computed === null) {
      items.push({
        id: record.id,
        action: 'PRESERVE',
        title: record.title,
        because: 'TITLE_UNBUILDABLE',
      });
      continue;
    }

    if (!hasTitle) {
      items.push({
        id: record.id,
        action: 'FILL',
        title: computed,
        because: 'TITLE_EMPTY',
      });
      continue;
    }

    items.push({
      id: record.id,
      action: 'PRESERVE',
      title: record.title,
      because:
        computed === record.title?.trim() ? 'TITLE_UNCHANGED' : 'TITLE_MANUAL',
    });
  }

  return {
    items,
    fill: items.filter((item) => item.action === 'FILL').length,
    preserve: items.filter((item) => item.action === 'PRESERVE').length,
    preserveManual: items.filter(
      (item) => item.action === 'PRESERVE' && item.because === 'TITLE_MANUAL',
    ).length,
    preserveUnbuildable: items.filter(
      (item) =>
        item.action === 'PRESERVE' && item.because === 'TITLE_UNBUILDABLE',
    ).length,
  };
};
