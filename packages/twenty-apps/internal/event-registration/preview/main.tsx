import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { RegistrationForm } from 'src/components/registration-form';
import { PreviewSelectionProvider, type PreviewSelection } from './host-shim';

// HARNESS ONLY. Everything in this file — the two source tabs, the disabled save
// button — belongs to the local preview and is never part of the shipped form.
// The real component receives one selected record from the host and no switch.

const RECORDS = {
  eventLead: {
    label: 'سرنخ‌های همایش',
    sublabel: 'Event Leads',
    ids: ['004f3cff-ab38-4f13-a480-95ca9f4383f4'],
  },
  salesInteraction: {
    label: 'پیگیری‌های فروش',
    sublabel: 'Sales Interactions',
    ids: ['01732fc5-c0ad-4cc0-8d58-bb0955fe300b'],
  },
} as const;

type SourceKey = keyof typeof RECORDS;

const App = () => {
  const initial =
    new URLSearchParams(window.location.search).get('source') ===
    'salesInteraction'
      ? 'salesInteraction'
      : 'eventLead';

  const [source, setSource] = useState<SourceKey>(initial);

  // The preview must not be able to save, and that must not depend on a click
  // being delivered. The save control is disabled in the DOM by its own
  // attribute, so the guarantee holds even if an event is swallowed.
  useEffect(() => {
    const disableSaveControls = () => {
      document
        .querySelectorAll<HTMLButtonElement>('[data-registration-save]')
        .forEach((button) => {
          button.disabled = true;
          button.setAttribute('aria-disabled', 'true');
          button.style.background = '#9ca3af';
          button.style.cursor = 'not-allowed';
        });
    };

    disableSaveControls();

    const root = document.getElementById('root');
    const observer = new MutationObserver(disableSaveControls);

    if (root !== null) {
      observer.observe(root, { childList: true, subtree: true });
    }

    return () => observer.disconnect();
  }, [source]);

  const selection: PreviewSelection = {
    objectNameSingular: source,
    selectedRecordIds: [...RECORDS[source].ids],
  };

  return (
    <div
      dir="rtl"
      lang="fa"
      style={{
        background: '#fafafa',
        fontFamily: 'system-ui, sans-serif',
        minHeight: '100vh',
        padding: 20,
      }}
    >
      <div style={{ margin: '0 auto', maxWidth: 460 }}>
        <div
          style={{
            background: '#fffbe6',
            border: '1px solid #f0b429',
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.8,
            marginBottom: 14,
            padding: '10px 12px',
          }}
        >
          <strong>حالت پیش‌نمایش</strong> — دکمه ذخیره غیرفعال است و هیچ
          ثبت‌نام یا پرداختی ساخته نمی‌شود.
        </div>

        {/* Preview-only navigation. Simulates the command menu entry point. */}
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            display: 'flex',
            marginBottom: 14,
            overflow: 'hidden',
          }}
        >
          {(Object.keys(RECORDS) as SourceKey[]).map((key) => {
            const isActive = source === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSource(key)}
                style={{
                  background: isActive ? '#31363f' : '#fff',
                  border: 'none',
                  color: isActive ? '#fff' : '#1f2937',
                  cursor: 'pointer',
                  display: 'flex',
                  flex: 1,
                  flexDirection: 'column',
                  gap: 1,
                  padding: '9px 8px',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {RECORDS[key].label}
                </span>
                <span
                  style={{
                    color: isActive ? '#d1d5db' : '#9ca3af',
                    direction: 'ltr',
                    fontSize: 10,
                  }}
                >
                  {RECORDS[key].sublabel}
                </span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <PreviewSelectionProvider value={selection}>
            <RegistrationForm key={source} />
          </PreviewSelectionProvider>
        </div>
      </div>

      <div
        id="preview-toast"
        style={{
          background: '#fdecea',
          border: '1px solid #f5c2c0',
          borderRadius: 8,
          display: 'none',
          fontSize: 12.5,
          margin: '12px auto 0',
          maxWidth: 460,
          padding: '10px 12px',
        }}
      />

      <div
        id="preview-closed"
        style={{ display: 'none', fontSize: 11, color: '#666', textAlign: 'center' }}
      />
    </div>
  );
};

const container = document.getElementById('root');

if (container !== null) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
