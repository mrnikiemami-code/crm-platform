import { isNonEmptyString } from '@sniptt/guards';

import {
  decideSalesInteractionTitle,
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
 *
 * The backfill never treats a title as edited (`titleEditedInThisEvent` is false):
 * it is not reacting to an event, and any non-empty title is out of scope by rule.
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

    const decision = decideSalesInteractionTitle({
      state,
      titleEditedInThisEvent: false,
    });

    if (decision.kind === 'WRITE_TITLE' && decision.because === 'TITLE_EMPTY') {
      items.push({
        id: record.id,
        action: 'FILL',
        title: decision.title,
        because: 'TITLE_EMPTY',
      });
      continue;
    }

    if (decision.kind === 'NO_WRITE') {
      if (decision.because === 'TITLE_UNBUILDABLE') {
        items.push({
          id: record.id,
          action: 'PRESERVE',
          title: record.title,
          because: 'TITLE_UNBUILDABLE',
        });
        continue;
      }

      if (decision.because === 'TITLE_ALREADY_CORRECT') {
        items.push({
          id: record.id,
          action: 'PRESERVE',
          title: record.title,
          because: 'TITLE_UNCHANGED',
        });
        continue;
      }
    }

    // Everything else keeps the title as it is: a manual title, a legacy row with
    // no recorded ownership, or an automatic title whose facts changed. The last
    // one is out of scope for a backfill — the live trigger handles it.
    items.push({
      id: record.id,
      action: 'PRESERVE',
      title: record.title,
      because: 'TITLE_MANUAL',
    });
  }

  const countWhere = (predicate: (item: BackfillPlanItem) => boolean): number =>
    items.filter(predicate).length;

  return {
    items,
    fill: countWhere((item) => item.action === 'FILL'),
    preserve: countWhere((item) => item.action === 'PRESERVE'),
    preserveManual: countWhere(
      (item) => item.action === 'PRESERVE' && item.because === 'TITLE_MANUAL',
    ),
    preserveUnbuildable: countWhere(
      (item) =>
        item.action === 'PRESERVE' && item.because === 'TITLE_UNBUILDABLE',
    ),
  };
};

export const isNonEmptyTitle = (value: string | null): boolean =>
  isNonEmptyString(value) && value.trim().length > 0;
