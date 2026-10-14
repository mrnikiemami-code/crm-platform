import { type CoreApiClient } from 'twenty-client-sdk/core';

import { readTemplateTargetObject } from 'src/studio/template-studio-contract';
import { type StudioTemplate } from 'src/studio/template-studio-logic';

// Writes this workspace's NATIVE `messageTemplate` records through the
// workspace-scoped `CoreApiClient`. There is no second table, no local storage
// and no duplicated model: create/update/delete all go through the same object
// the composers already read.
//
// The BODY is written verbatim — it is the canonical technical text with
// `@token` placeholders. Newlines are preserved exactly (the value is never
// trimmed or normalised), and a translated label is NEVER written as a
// substitution identifier.
type MutationClient = Pick<CoreApiClient, 'mutation'>;

type RawMutationNode = {
  id?: string | null;
  title?: string | null;
  body?: string | null;
  targetObject?: string | null;
  updatedAt?: string | null;
};

const toStudioTemplate = (
  node: RawMutationNode | null | undefined,
): StudioTemplate | null => {
  if (node === null || node === undefined) {
    return null;
  }

  if (typeof node.id !== 'string' || node.id.length === 0) {
    return null;
  }

  return {
    id: node.id,
    title: typeof node.title === 'string' ? node.title : '',
    body: typeof node.body === 'string' ? node.body : '',
    targetObject: readTemplateTargetObject(node.targetObject),
    updatedAt: typeof node.updatedAt === 'string' ? node.updatedAt : '',
  };
};

export type TemplateWriteInput = {
  title: string;
  body: string;
  targetObject: string;
};

export const createMessageTemplate = async ({
  client,
  input,
}: {
  client: MutationClient;
  input: TemplateWriteInput;
}): Promise<StudioTemplate | null> => {
  const result = await client.mutation({
    createMessageTemplate: {
      __args: {
        data: {
          title: input.title,
          body: input.body,
          targetObject: input.targetObject,
        },
      },
      id: true,
      title: true,
      body: true,
      targetObject: true,
      updatedAt: true,
    },
  });

  return toStudioTemplate(
    result.createMessageTemplate as RawMutationNode | null | undefined,
  );
};

export const updateMessageTemplate = async ({
  client,
  id,
  input,
}: {
  client: MutationClient;
  id: string;
  input: TemplateWriteInput;
}): Promise<StudioTemplate | null> => {
  const result = await client.mutation({
    updateMessageTemplate: {
      __args: {
        id,
        data: {
          title: input.title,
          body: input.body,
          targetObject: input.targetObject,
        },
      },
      id: true,
      title: true,
      body: true,
      targetObject: true,
      updatedAt: true,
    },
  });

  return toStudioTemplate(
    result.updateMessageTemplate as RawMutationNode | null | undefined,
  );
};

/**
 * Deletes one template. This is a SOFT delete (`deleteMessageTemplate`), the
 * platform's normal delete: it removes the template from the studio and the
 * composers while keeping the row recoverable, and it is the operation the app's
 * role is authorized for — hard destroy stays denied on purpose.
 *
 * Returns the deleted id, or `null` when the platform did not return one (which
 * the caller reports as NOT_FOUND rather than success).
 */
export const deleteMessageTemplate = async ({
  client,
  id,
}: {
  client: MutationClient;
  id: string;
}): Promise<string | null> => {
  const result = await client.mutation({
    deleteMessageTemplate: {
      __args: { id },
      id: true,
    },
  });

  const deletedId = (
    result.deleteMessageTemplate as RawMutationNode | null | undefined
  )?.id;

  return typeof deletedId === 'string' && deletedId.length > 0
    ? deletedId
    : null;
};
