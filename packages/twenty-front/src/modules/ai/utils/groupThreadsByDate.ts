import { t } from '@lingui/core/macro';
import { differenceInCalendarDays } from 'date-fns';
import { Temporal } from 'temporal-polyfill';

import { formatDateTimeForAppLocale } from '@/localization/utils/formatDateTimeForAppLocale';
import { formatYearForAppLocale } from '@/localization/utils/formatYearForAppLocale';
import { getCalendarSystemForLocale } from '@/localization/utils/getCalendarSystemForLocale';
import { type AgentChatThread } from '~/generated-metadata/graphql';

export type AgentChatThreadDateGroup = {
  id: string;
  title: string;
  threads: AgentChatThread[];
};

const getLocalDayDifference = (date: Date, today: Date) =>
  differenceInCalendarDays(today, date);

// Buckets use the local day, like the Today/Yesterday sections above, so the
// persian month is derived from the local calendar date as well.
const getMonthGroup = (
  date: Date,
  locale: string | null | undefined,
): Omit<AgentChatThreadDateGroup, 'threads'> => {
  if (getCalendarSystemForLocale(locale) === 'persian') {
    const persianDate = Temporal.PlainDate.from({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    }).withCalendar('persian');
    const monthName = formatDateTimeForAppLocale({
      date,
      locale,
      options: { month: 'long' },
    });

    return {
      id: `month:persian:${persianDate.year}-${persianDate.month}`,
      title: `${monthName} ${formatYearForAppLocale(persianDate.year, locale)}`,
    };
  }

  return {
    id: `month:${date.getFullYear()}-${date.getMonth() + 1}`,
    title: formatDateTimeForAppLocale({
      date,
      locale,
      options: { month: 'long', year: 'numeric' },
    }),
  };
};

const getThreadDateGroup = (
  threadActivityAt: Date,
  today: Date,
  locale: string | null | undefined,
): Omit<AgentChatThreadDateGroup, 'threads'> => {
  const localDayDifference = getLocalDayDifference(threadActivityAt, today);

  if (localDayDifference === 0) {
    return {
      id: 'today',
      title: t`Today`,
    };
  }

  if (localDayDifference === 1) {
    return {
      id: 'yesterday',
      title: t`Yesterday`,
    };
  }

  if (localDayDifference >= 2 && localDayDifference <= 7) {
    return {
      id: 'previous-7-days',
      title: t`Previous 7 days`,
    };
  }

  return getMonthGroup(threadActivityAt, locale);
};

export const groupThreadsByDate = (
  threads: AgentChatThread[],
  today = new Date(),
  locale?: string | null,
): AgentChatThreadDateGroup[] => {
  const groupedThreadsByDate = new Map<string, AgentChatThreadDateGroup>();

  for (const thread of threads) {
    const threadDateGroup = getThreadDateGroup(
      new Date(thread.lastMessageAt ?? thread.updatedAt),
      today,
      locale,
    );
    const existingThreadDateGroup = groupedThreadsByDate.get(
      threadDateGroup.id,
    );

    if (existingThreadDateGroup !== undefined) {
      existingThreadDateGroup.threads.push(thread);
    } else {
      groupedThreadsByDate.set(threadDateGroup.id, {
        ...threadDateGroup,
        threads: [thread],
      });
    }
  }

  return [...groupedThreadsByDate.values()];
};
