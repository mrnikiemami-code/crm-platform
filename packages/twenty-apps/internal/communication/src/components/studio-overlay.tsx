/// <reference path="../types/react-dom.ts" />
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Renders overlay content as a direct child of `<body>` instead of inside the
// app's widget container.
//
// WHY this exists: a front component is mounted deep inside the workspace page
// layout, inside an ancestor that establishes a containing block (transform /
// contain / positioned scroll area). A `position: fixed` overlay rendered in
// place is therefore trapped in that ancestor: it is clipped to the widget box
// and, worse, pointer gestures inside it are no longer delivered to the
// overlay's own controls — which is exactly how the studio's modal buttons,
// combobox, drag-drop and double-click silently stopped working.
//
// Rendering through a portal to `document.body` puts the overlay in the same
// place the host's own modals live, so `position: fixed` resolves against the
// real viewport again and the controls receive their events normally.
//
// The portal preserves the React tree (context, hooks, providers), so the
// translated copy and the studio state keep working unchanged.
export const StudioOverlay = ({ children }: { children: ReactNode }) => {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Read the host only after mount so a non-browser render never touches it.
    setHost(typeof document === 'undefined' ? null : document.body);
  }, []);

  if (host === null) {
    return null;
  }

  return createPortal(children, host);
};
