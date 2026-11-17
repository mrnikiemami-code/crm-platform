import { type ObjectRecordDiff } from '@/database-events/object-record-diff';

type Properties<T> = {
  updatedFields?: string[];
  before?: T;
  after?: T;
  diff?: Partial<ObjectRecordDiff<T>>;
};

export class ObjectRecordBaseEvent<T = object> {
  /**
   * Stable identity of THIS write, stamped once when the write is observed.
   *
   * Every consumer that replays the event — a queue retry, a duplicate delivery,
   * a manual workflow replay — receives the same value, while two separate real
   * changes always receive different ones. That is what lets a deduplicated
   * send distinguish "the same event again" from "the same field changed back",
   * which a value-based key cannot.
   *
   * Optional for backward compatibility with payloads produced before it
   * existed; the producer always sets it.
   */
  eventId?: string;
  recordId: string;
  userId?: string;
  userWorkspaceId?: string;
  workspaceMemberId?: string;
  properties: Properties<T>;
}
