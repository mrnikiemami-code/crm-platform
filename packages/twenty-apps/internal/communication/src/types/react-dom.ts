// Referenced explicitly from `studio-overlay.tsx`, because the SDK build type-
// checks only the import graph: an unreferenced declaration file would never be
// loaded there.
//
// Minimal ambient typing for the `react-dom` surface this app uses.
//
// WHY this file exists instead of a dependency: `react-dom` IS present in the
// front-component runtime (the SDK build inlines it into every front-component
// bundle), but the matching `@types/react-dom` package is not installed, so the
// import would otherwise be an implicit `any` and fail the `.ts`-only build.
// Declaring exactly the one function we call keeps the type surface honest — and
// keeps us from claiming types for APIs we do not use.
//
// This file has no top-level import/export on purpose: that makes it a global
// script, which is what lets `declare module` work as an ambient declaration.
declare module 'react-dom' {
  import { type ReactNode, type ReactPortal } from 'react';

  /**
   * Renders `children` into `container` while keeping the React tree (context,
   * hooks, providers) of the caller intact.
   */
  export const createPortal: (
    children: ReactNode,
    container: Element | DocumentFragment,
    key?: string | number | null,
  ) => ReactPortal;
}

