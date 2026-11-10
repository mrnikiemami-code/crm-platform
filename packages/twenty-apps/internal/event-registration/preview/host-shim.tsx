import { createContext, useContext, type ReactNode } from 'react';

// Stand-in for `twenty-sdk/front-component` inside the preview harness.
//
// The real host injects the selected record and the side-panel controls. The
// preview supplies the same four things the form actually uses, so the component
// under test is the shipped one — only its host is simulated.

export type PreviewSelection = {
  objectNameSingular: string;
  selectedRecordIds: string[];
};

const SelectionContext = createContext<PreviewSelection>({
  objectNameSingular: 'eventLead',
  selectedRecordIds: [],
});

export const PreviewSelectionProvider = ({
  value,
  children,
}: {
  value: PreviewSelection;
  children: ReactNode;
}) => (
  <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
);

export const useSelectedRecordIds = (): string[] =>
  useContext(SelectionContext).selectedRecordIds;

export const useObjectNameSingular = (): string | null =>
  useContext(SelectionContext).objectNameSingular;

export const enqueueSnackbar = ({
  message,
  variant,
}: {
  message: string;
  variant: 'error' | 'success' | 'info' | 'warning';
}): void => {
  const host = document.getElementById('preview-toast');

  if (host !== null) {
    host.dataset.variant = variant;
    host.textContent = message;
    host.style.display = 'block';
  }

  // eslint-disable-next-line no-console
  console.log(`[snackbar:${variant}] ${message}`);
};

export const closeSidePanel = (): void => {
  const host = document.getElementById('preview-closed');

  if (host !== null) {
    host.textContent = 'side panel would close here';
    host.style.display = 'block';
  }
};
