import { type AgentChatThread } from '~/generated-metadata/graphql';
import { groupThreadsByDate } from '@/ai/utils/groupThreadsByDate';

describe('groupThreadsByDate', () => {
  const today = new Date('2026-04-26T12:00:00');

  const getDateDaysAgo = (daysAgo: number) => {
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);

    return date;
  };

  const yesterday = getDateDaysAgo(1);
  const twoDaysAgo = getDateDaysAgo(2);
  const sevenDaysAgo = getDateDaysAgo(7);
  const eightDaysAgo = getDateDaysAgo(8);
  const fourteenDaysAgo = getDateDaysAgo(14);

  const baseThread: Omit<
    AgentChatThread,
    'updatedAt' | 'id' | 'lastMessageAt'
  > = {
    title: 'Test Thread',
    createdAt: twoDaysAgo.toISOString(),
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    contextWindowTokens: null,
    conversationSize: 0,
    totalInputCredits: 0,
    totalOutputCredits: 0,
  };

  const buildThread = (id: string, lastMessageAt: Date): AgentChatThread => ({
    ...baseThread,
    id,
    lastMessageAt: lastMessageAt.toISOString(),
    updatedAt: lastMessageAt.toISOString(),
  });

  it('groups threads into Today, Yesterday, Previous 7 days, and month sections', () => {
    const threads: AgentChatThread[] = [
      buildThread('1', today),
      buildThread('2', yesterday),
      buildThread('3', twoDaysAgo),
      buildThread('4', sevenDaysAgo),
      buildThread('5', eightDaysAgo),
      buildThread('6', fourteenDaysAgo),
    ];

    const result = groupThreadsByDate(threads, today);

    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({
      id: 'today',
      title: 'Today',
      threads: [{ id: '1' }],
    });
    expect(result[1]).toMatchObject({
      id: 'yesterday',
      title: 'Yesterday',
      threads: [{ id: '2' }],
    });
    expect(result[2]).toMatchObject({
      id: 'previous-7-days',
      title: 'Previous 7 days',
      threads: [{ id: '3' }, { id: '4' }],
    });
    expect(result[3]).toMatchObject({
      id: 'month:2026-4',
      title: 'April 2026',
      threads: [{ id: '5' }, { id: '6' }],
    });
  });

  it('labels month sections in the app locale instead of the host locale', () => {
    const [group] = groupThreadsByDate(
      [buildThread('1', new Date('2026-03-15T12:00:00'))],
      today,
      'fr-FR',
    );

    expect(group).toMatchObject({ id: 'month:2026-3', title: 'mars 2026' });
  });

  it('groups fa-IR month sections by Persian month', () => {
    const result = groupThreadsByDate(
      [
        buildThread('farvardin-late', new Date('2026-04-10T12:00:00')),
        buildThread('esfand', new Date('2026-03-15T12:00:00')),
        buildThread('farvardin-early', new Date('2026-03-25T12:00:00')),
      ],
      today,
      'fa-IR',
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'month:persian:1405-1',
      title: 'فروردین ۱۴۰۵',
      threads: [{ id: 'farvardin-late' }, { id: 'farvardin-early' }],
    });
    expect(result[1]).toMatchObject({
      id: 'month:persian:1404-12',
      title: 'اسفند ۱۴۰۴',
      threads: [{ id: 'esfand' }],
    });
  });

  it('returns no groups if no threads', () => {
    expect(groupThreadsByDate([], today)).toEqual([]);
  });

  it('falls back to updatedAt when lastMessageAt is null', () => {
    const thread: AgentChatThread = {
      ...baseThread,
      id: '1',
      lastMessageAt: null,
      updatedAt: yesterday.toISOString(),
    };

    const [group] = groupThreadsByDate([thread], today);

    expect(group.id).toBe('yesterday');
  });

  describe('timezone handling', () => {
    it('keeps a thread last touched a few hours ago in Today across DST/midnight boundaries', () => {
      const todayLate = new Date('2026-04-26T23:30:00');
      const todayEarly = new Date('2026-04-26T00:15:00');

      const result = groupThreadsByDate(
        [buildThread('late', todayLate), buildThread('early', todayEarly)],
        today,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'today',
        threads: [{ id: 'late' }, { id: 'early' }],
      });
    });

    it('places a thread last touched late yesterday in the Yesterday bucket', () => {
      const yesterdayJustBeforeMidnight = new Date('2026-04-25T23:59:00');

      const [group] = groupThreadsByDate(
        [buildThread('y', yesterdayJustBeforeMidnight)],
        today,
      );

      expect(group.id).toBe('yesterday');
    });

    it('does not slip a thread from yesterday into Today when local times differ by hours', () => {
      const yesterdayMorning = new Date('2026-04-25T08:00:00');

      const [group] = groupThreadsByDate(
        [buildThread('y', yesterdayMorning)],
        today,
      );

      expect(group.id).toBe('yesterday');
    });
  });
});
