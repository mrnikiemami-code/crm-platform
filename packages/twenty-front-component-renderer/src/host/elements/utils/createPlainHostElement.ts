import React from 'react';

import { type ElementRefCallback } from '@/host/elements/types/ElementRefCallback';

type CreatePlainHostElementParams = {
  htmlTag: string;
  elementType?: React.ElementType;
  isVoid: boolean;
  reactBindableProps: Record<string, unknown>;
  hostEnforcedProps: Record<string, unknown>;
  composedElementRef: ElementRefCallback;
  children: React.ReactNode;
};

export const createPlainHostElement = ({
  htmlTag,
  elementType,
  isVoid,
  reactBindableProps,
  hostEnforcedProps,
  composedElementRef,
  children,
}: CreatePlainHostElementParams) =>
  React.createElement(
    elementType ?? htmlTag,
    {
      ...reactBindableProps,
      ...hostEnforcedProps,
      ref: composedElementRef,
    },
    isVoid ? undefined : children,
  );
