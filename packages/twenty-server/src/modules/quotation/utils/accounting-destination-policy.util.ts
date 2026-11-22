// Where a stored accounting destination is allowed to point.
//
// `transportApproved` answers "may an insecure transport carry a write?". It does NOT
// answer "which networks may this server reach?": a settings save that turned it into a
// blanket egress permission would let a workspace member aim the worker at a database or a
// cloud metadata endpoint. A private destination therefore needs a second, operator-owned
// decision — an entry in ACCOUNTING_PRIVATE_DESTINATION_ALLOWLIST — and even that cannot
// unlock the addresses that must never be reachable.

export type DestinationAddressClass = 'PUBLIC' | 'PRIVATE' | 'BLOCKED';

export type AllowlistEntry = {
  host: string;
  port: number | null;
};

const BLOCKED = 'BLOCKED' as const;
const PRIVATE = 'PRIVATE' as const;
const PUBLIC = 'PUBLIC' as const;

const parseIpv4 = (address: string): number[] | null => {
  const parts = address.split('.');

  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) =>
    /^\d{1,3}$/.test(part) ? Number(part) : Number.NaN,
  );

  return octets.every(
    (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255,
  )
    ? octets
    : null;
};

const classifyIpv4 = (octets: number[]): DestinationAddressClass => {
  const [first, second, third] = octets;

  // 0.0.0.0/8 names "this host" and the wildcard address; never a destination.
  if (first === 0) {
    return BLOCKED;
  }

  // The cloud metadata service is the classic SSRF objective, so it stays blocked even if
  // an operator allowlists the rest of link-local.
  if (first === 169 && second === 254 && third === 169 && octets[3] === 254) {
    return BLOCKED;
  }

  // A loopback or link-local destination is the host itself or its immediate segment:
  // neither is ever a vendor endpoint, so neither may be unlocked by an allowlist.
  if (first === 127) {
    return BLOCKED;
  }

  if (first === 169 && second === 254) {
    return BLOCKED;
  }

  if (first >= 224) {
    return BLOCKED;
  }

  if (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113)
  ) {
    return PRIVATE;
  }

  return PUBLIC;
};

const parseIpv6 = (address: string): number[] | null => {
  const text = address.trim().toLowerCase().split('%')[0];

  if (text.includes('.')) {
    const lastColon = text.lastIndexOf(':');
    const embedded = parseIpv4(text.slice(lastColon + 1));

    if (embedded === null) {
      return null;
    }

    const prefix = text.slice(0, lastColon + 1);
    const mapped = `${prefix}${(
      (embedded[0] << 8) |
      embedded[1]
    ).toString(16)}:${((embedded[2] << 8) | embedded[3]).toString(16)}`;

    return parseIpv6(mapped);
  }

  const halves = text.split('::');

  if (halves.length > 2) {
    return null;
  }

  const head = halves[0] === '' ? [] : halves[0].split(':');
  const tail = halves.length === 2 && halves[1] !== '' ? halves[1].split(':') : [];

  const hex = (part: string): number | null =>
    /^[0-9a-f]{1,4}$/.test(part) ? Number.parseInt(part, 16) : null;

  const headParts = head.map(hex);
  const tailParts = tail.map(hex);

  if ([...headParts, ...tailParts].some((part) => part === null)) {
    return null;
  }

  const missing = 8 - headParts.length - tailParts.length;

  if (halves.length === 2 ? missing < 0 : missing !== 0) {
    return null;
  }

  return [
    ...(headParts as number[]),
    ...Array.from({ length: halves.length === 2 ? missing : 0 }, () => 0),
    ...(tailParts as number[]),
  ];
};

const classifyIpv6 = (hextets: number[]): DestinationAddressClass => {
  const [first, second, third, fourth, fifth, sixth, seventh, eighth] = hextets;

  const leadingZero = hextets.slice(0, 5).every((part) => part === 0);

  // ::ffff:a.b.c.d — a mapped IPv4 destination is that IPv4 destination.
  if (leadingZero && sixth === 0xffff) {
    return classifyIpv4([
      (seventh >> 8) & 0xff,
      seventh & 0xff,
      (eighth >> 8) & 0xff,
      eighth & 0xff,
    ]);
  }

  // :: and ::1 — unspecified and loopback.
  if (hextets.every((part) => part === 0)) {
    return BLOCKED;
  }

  if (leadingZero && sixth === 0 && seventh === 0 && eighth === 1) {
    return BLOCKED;
  }

  // 6to4 embeds an IPv4 destination in the next two hextets.
  if (first === 0x2002) {
    return classifyIpv4([
      (second >> 8) & 0xff,
      second & 0xff,
      (third >> 8) & 0xff,
      third & 0xff,
    ]);
  }

  // NAT64 can translate a public-looking literal into an internal IPv4 destination.
  if (first === 0x0064 && second === 0xff9b) {
    return BLOCKED;
  }

  if ((first & 0xff00) === 0xff00) {
    return BLOCKED;
  }

  if (
    (first & 0xfe00) === 0xfc00 ||
    (first === 0x2001 && second === 0x0db8)
  ) {
    return PRIVATE;
  }

  // Link-local is the IPv6 analogue of 169.254/16: never a vendor endpoint, never
  // allowlistable.
  if ((first & 0xffc0) === 0xfe80) {
    return BLOCKED;
  }

  return PUBLIC;
};

const stripBrackets = (hostname: string): string =>
  hostname.trim().replace(/^\[|\]$/g, '');

export const isIpLiteral = (hostname: string): boolean =>
  parseIpv4(stripBrackets(hostname)) !== null ||
  (hostname.includes(':') && parseIpv6(stripBrackets(hostname)) !== null);

export const classifyIpAddress = (address: string): DestinationAddressClass => {
  const host = stripBrackets(address);
  const ipv4 = parseIpv4(host);

  if (ipv4 !== null) {
    return classifyIpv4(ipv4);
  }

  const ipv6 = parseIpv6(host);

  return ipv6 === null ? BLOCKED : classifyIpv6(ipv6);
};

// A hostname is not judged here: its addresses are only known when the connection is made,
// and judging the name would let a public name resolve privately later (DNS rebinding).
export const classifyDestinationHostname = (
  hostname: string,
): DestinationAddressClass =>
  isIpLiteral(hostname) ? classifyIpAddress(hostname) : PUBLIC;

export const parsePrivateDestinationAllowlist = (
  raw: string | undefined,
): AllowlistEntry[] =>
  String(raw ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '')
    .flatMap((entry) => {
      const bracketed = /^\[([^\]]+)\](?::(\d+))?$/.exec(entry);
      const plain = /^([^:]+)(?::(\d+))?$/.exec(entry);
      const match = bracketed ?? plain;

      if (match === null) {
        return [];
      }

      const portText = match[2];
      const port =
        portText === undefined ? null : Number.parseInt(portText, 10);

      return [
        {
          host: stripBrackets(match[1]),
          port: Number.isInteger(port) ? port : null,
        },
      ];
    });

export const readPrivateDestinationAllowlist = (): AllowlistEntry[] =>
  parsePrivateDestinationAllowlist(
    process.env.ACCOUNTING_PRIVATE_DESTINATION_ALLOWLIST,
  );

export const isDestinationAllowlisted = ({
  hostname,
  port,
  addresses,
  allowlist,
}: {
  hostname: string;
  port: number | null;
  addresses?: readonly string[];
  allowlist: readonly AllowlistEntry[];
}): boolean => {
  const candidates = [stripBrackets(hostname).toLowerCase(), ...(addresses ?? [])];

  return allowlist.some(
    (entry) =>
      (entry.port === null || entry.port === port) &&
      candidates.some((candidate) => candidate.toLowerCase() === entry.host),
  );
};

// What a settings save may store. A literal address is decided now; a hostname is decided
// again at connection time, because its answer can change.
export const checkStorableDestination = ({
  hostname,
  port,
  transportApproved,
  allowlist,
}: {
  hostname: string;
  port: number | null;
  transportApproved: boolean;
  allowlist: readonly AllowlistEntry[];
}): { ok: true } | { ok: false; code: string; message: string } => {
  const classification = classifyDestinationHostname(hostname);

  if (classification === 'PUBLIC') {
    return { ok: true };
  }

  if (classification === 'BLOCKED') {
    return {
      ok: false,
      code: 'CONNECTION_DESTINATION_BLOCKED',
      message: 'این نشانی مقصد هرگز مجاز نیست',
    };
  }

  if (!transportApproved) {
    return {
      ok: false,
      code: 'CONNECTION_PRIVATE_NETWORK_NOT_APPROVED',
      message:
        'آدرس سرویس در شبکهٔ داخلی است؛ برای این مقصد تأیید انتقال امن لازم است',
    };
  }

  if (
    !isDestinationAllowlisted({
      hostname,
      port,
      addresses: [hostname],
      allowlist,
    })
  ) {
    return {
      ok: false,
      code: 'CONNECTION_DESTINATION_NOT_ALLOWLISTED',
      message:
        'تأیید انتقال، دسترسی به هر نشانی داخلی را باز نمی‌کند؛ این مقصد باید در فهرست مجاز سرور ثبت شود',
    };
  }

  return { ok: true };
};
