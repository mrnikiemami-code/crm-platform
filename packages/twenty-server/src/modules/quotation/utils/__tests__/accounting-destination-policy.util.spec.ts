import {
  checkStorableDestination,
  classifyDestinationHostname,
  classifyIpAddress,
  isDestinationAllowlisted,
  parsePrivateDestinationAllowlist,
} from 'src/modules/quotation/utils/accounting-destination-policy.util';

describe('classifyIpAddress', () => {
  it.each([
    ['127.0.0.1', 'BLOCKED'],
    ['10.1.2.3', 'PRIVATE'],
    ['172.20.0.1', 'PRIVATE'],
    ['192.168.4.85', 'PRIVATE'],
    ['100.64.0.9', 'PRIVATE'],
    ['192.0.2.5', 'PRIVATE'],
    ['169.254.169.254', 'BLOCKED'],
    ['169.254.1.1', 'BLOCKED'],
    ['0.0.0.0', 'BLOCKED'],
    ['224.0.0.1', 'BLOCKED'],
    ['8.8.8.8', 'PUBLIC'],
    ['203.0.114.10', 'PUBLIC'],
  ])('classifies %s as %s', (address, expected) => {
    expect(classifyIpAddress(address)).toBe(expected);
  });

  it.each([
    ['::1', 'BLOCKED'],
    ['::', 'BLOCKED'],
    ['::ffff:127.0.0.1', 'BLOCKED'],
    ['::ffff:8.8.8.8', 'PUBLIC'],
    ['fe80::1', 'BLOCKED'],
    ['fc00::1', 'PRIVATE'],
    ['fd12:3456::1', 'PRIVATE'],
    ['ff02::1', 'BLOCKED'],
    ['2001:db8::1', 'PRIVATE'],
    ['64:ff9b::1', 'BLOCKED'],
    ['2002:7f00:1::', 'BLOCKED'],
    ['2606:4700::1111', 'PUBLIC'],
  ])('classifies %s as %s', (address, expected) => {
    expect(classifyIpAddress(address)).toBe(expected);
  });

  it('treats a hostname as undecided rather than public or private', () => {
    expect(classifyDestinationHostname('asan.example.ir')).toBe('PUBLIC');
    expect(classifyDestinationHostname('[::1]')).toBe('BLOCKED');
  });
});

describe('parsePrivateDestinationAllowlist', () => {
  it('reads hosts and host:port entries, ignoring blanks', () => {
    expect(
      parsePrivateDestinationAllowlist(' asan.internal:8080, ,10.0.0.5 '),
    ).toEqual([
      { host: 'asan.internal', port: 8080 },
      { host: '10.0.0.5', port: null },
    ]);
  });

  it('reads a bracketed IPv6 entry', () => {
    expect(parsePrivateDestinationAllowlist('[::1]:9000')).toEqual([
      { host: '::1', port: 9000 },
    ]);
  });
});

describe('isDestinationAllowlisted', () => {
  it('matches the hostname or a resolved address, honouring the port', () => {
    const allowlist = [{ host: 'asan.internal', port: 8080 }];

    expect(
      isDestinationAllowlisted({
        hostname: 'asan.internal',
        port: 8080,
        allowlist,
      }),
    ).toBe(true);
    expect(
      isDestinationAllowlisted({
        hostname: 'asan.internal',
        port: 80,
        allowlist,
      }),
    ).toBe(false);
    expect(
      isDestinationAllowlisted({
        hostname: 'other.internal',
        port: 8080,
        addresses: ['10.0.0.5'],
        allowlist: [{ host: '10.0.0.5', port: 8080 }],
      }),
    ).toBe(true);
  });
});

describe('checkStorableDestination', () => {
  it('admits a public hostname without any approval', () => {
    expect(
      checkStorableDestination({
        hostname: 'asan.example.ir',
        port: null,
        transportApproved: false,
        allowlist: [],
      }),
    ).toEqual({ ok: true });
  });

  it('refuses a private literal until it is both approved and allowlisted', () => {
    expect(
      checkStorableDestination({
        hostname: '10.0.0.5',
        port: 8080,
        transportApproved: false,
        allowlist: [{ host: '10.0.0.5', port: 8080 }],
      }),
    ).toMatchObject({ ok: false, code: 'CONNECTION_PRIVATE_NETWORK_NOT_APPROVED' });

    expect(
      checkStorableDestination({
        hostname: '10.0.0.5',
        port: 8080,
        transportApproved: true,
        allowlist: [],
      }),
    ).toMatchObject({ ok: false, code: 'CONNECTION_DESTINATION_NOT_ALLOWLISTED' });

    expect(
      checkStorableDestination({
        hostname: '10.0.0.5',
        port: 8080,
        transportApproved: true,
        allowlist: [{ host: '10.0.0.5', port: 8080 }],
      }),
    ).toEqual({ ok: true });
  });

  it('keeps the metadata service unreachable with any approval', () => {
    expect(
      checkStorableDestination({
        hostname: '169.254.169.254',
        port: null,
        transportApproved: true,
        allowlist: [{ host: '169.254.169.254', port: null }],
      }),
    ).toMatchObject({ ok: false, code: 'CONNECTION_DESTINATION_BLOCKED' });
  });

  it('keeps loopback and link-local unreachable with any approval or allowlist', () => {
    for (const hostname of ['127.0.0.1', '::1', '169.254.1.1', 'fe80::1']) {
      expect(
        checkStorableDestination({
          hostname,
          port: 8080,
          transportApproved: true,
          allowlist: [{ host: hostname, port: 8080 }],
        }),
      ).toMatchObject({ ok: false, code: 'CONNECTION_DESTINATION_BLOCKED' });
    }
  });
});
