const mockDynamicActivate = jest.fn();

jest.mock('~/utils/i18n/dynamicActivate', () => ({
  dynamicActivate: (locale: string) => mockDynamicActivate(locale),
}));

jest.mock('@lingui/detect-locale', () => ({
  fromUrl: () => mockDetect.url,
  fromStorage: () => mockDetect.storage,
}));

const mockDetect: { url: string | null; storage: string | null } = {
  url: null,
  storage: null,
};

import { initialI18nActivate } from '~/utils/i18n/initialI18nActivate';

const activateWith = ({
  url = null,
  storage = null,
}: {
  url?: string | null;
  storage?: string | null;
}) => {
  mockDetect.url = url;
  mockDetect.storage = storage;
  mockDynamicActivate.mockClear();
  initialI18nActivate();

  return mockDynamicActivate.mock.calls[0]?.[0];
};

describe('initialI18nActivate', () => {
  const originalNavigatorLanguage = Object.getOwnPropertyDescriptor(
    window.navigator,
    'language',
  );

  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // jsdom variant without storage; the assertions below do not need it.
    }
  });

  afterAll(() => {
    if (originalNavigatorLanguage) {
      Object.defineProperty(
        window.navigator,
        'language',
        originalNavigatorLanguage,
      );
    }
  });

  it('presents Persian to a visitor who has chosen nothing', () => {
    expect(activateWith({})).toBe('fa-IR');
  });

  it('ignores an English browser: the visitor has still chosen nothing', () => {
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      get: () => 'en-US',
    });

    expect(activateWith({})).toBe('fa-IR');
  });

  it('keeps an English choice made earlier', () => {
    expect(activateWith({ storage: 'en' })).toBe('en');
  });

  it('honours an explicit locale in the URL over the stored one', () => {
    expect(activateWith({ url: 'fr-FR', storage: 'en' })).toBe('fr-FR');
  });

  it('falls back to Persian for a stored value that is not a locale', () => {
    expect(activateWith({ storage: 'not-a-locale' })).toBe('fa-IR');
  });
});
