import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { accepted, refused, type Result } from 'src/domain/shared/result';

export const CUSTOMER_LINK_TOKEN_BYTES = 32;
export const DEFAULT_CUSTOMER_LINK_TTL_HOURS = 168;

export type CustomerLinkTokenMaterial = {
  // Shown once to the operator; never persisted.
  rawToken: string;
  // sha256 hex of rawToken — stored and used for lookup.
  tokenHash: string;
};

export const hashCustomerLinkToken = (rawToken: string): string =>
  createHash('sha256').update(rawToken, 'utf8').digest('hex');

export const mintCustomerLinkToken = (): CustomerLinkTokenMaterial => {
  const rawToken = randomBytes(CUSTOMER_LINK_TOKEN_BYTES).toString('base64url');

  return {
    rawToken,
    tokenHash: hashCustomerLinkToken(rawToken),
  };
};

export const customerLinkTokenHashesEqual = (
  leftHex: string,
  rightHex: string,
): boolean => {
  try {
    const left = Buffer.from(leftHex, 'hex');
    const right = Buffer.from(rightHex, 'hex');

    if (left.length === 0 || left.length !== right.length) {
      return false;
    }

    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
};

export const computeCustomerLinkExpiry = ({
  now,
  ttlHours = DEFAULT_CUSTOMER_LINK_TTL_HOURS,
}: {
  now: Date;
  ttlHours?: number;
}): Result<Date> => {
  if (!Number.isFinite(ttlHours) || ttlHours <= 0 || ttlHours > 24 * 90) {
    return refused(
      'CUSTOMER_LINK_TTL_INVALID',
      'ttlHours must be between 1 and 2160',
    );
  }

  return accepted(new Date(now.getTime() + ttlHours * 60 * 60 * 1000));
};

export type CustomerLinkAccessState =
  | { kind: 'ACTIVE' }
  | { kind: 'MISSING' }
  | { kind: 'REVOKED' }
  | { kind: 'EXPIRED' };

export const evaluateCustomerLinkAccess = ({
  now,
  expiresAt,
  revokedAt,
}: {
  now: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}): CustomerLinkAccessState => {
  if (expiresAt === null) {
    return { kind: 'MISSING' };
  }

  if (revokedAt !== null) {
    return { kind: 'REVOKED' };
  }

  if (expiresAt.getTime() <= now.getTime()) {
    return { kind: 'EXPIRED' };
  }

  return { kind: 'ACTIVE' };
};

export const statusesAllowedForCustomerLink = [
  'READY_TO_SEND',
  'SENT',
  'CUSTOMER_ACCEPTED',
  'CUSTOMER_REJECTED',
] as const;

export type CustomerLinkableStatus =
  (typeof statusesAllowedForCustomerLink)[number];

export const canIssueCustomerLinkForStatus = (
  status: string,
): status is CustomerLinkableStatus =>
  (statusesAllowedForCustomerLink as readonly string[]).includes(status);
