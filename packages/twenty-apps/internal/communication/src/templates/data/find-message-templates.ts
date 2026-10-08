import { type CoreApiClient } from 'twenty-client-sdk/core';

// A workspace message template as read for the composer's picker. Only the
// fields the composer needs are exposed; the workspace scope is enforced by the
// API client (an app can only ever read its own workspace's records).
export type MessageTemplateRecord = {
  id: string;
  title: string;
  body: string;
  channel: string;
};

type RawMessageTemplateNode = {
  id: string;
  title?: string | null;
  body?: string | null;
  channel?: string | null;
};

type ConnectionEdge<TNode> = { node?: TNode | null } | null;

// Lists this workspace's message templates, newest first. `messageTemplates` is
// a connection, so it is queried with `first` + `edges { node { … } }`.
export const findMessageTemplates = async ({
  client,
  limit = 100,
}: {
  client: Pick<CoreApiClient, 'query'>;
  limit?: number;
}): Promise<MessageTemplateRecord[]> => {
  const result = await client.query({
    messageTemplates: {
      __args: {
        first: limit,
        orderBy: [{ createdAt: 'DescNullsLast' }],
      },
      edges: {
        node: {
          id: true,
          title: true,
          body: true,
          channel: true,
        },
      },
    },
  });

  const edges: ConnectionEdge<RawMessageTemplateNode>[] =
    result.messageTemplates?.edges ?? [];

  return edges
    .map((edge) => edge?.node)
    .filter(
      (node): node is RawMessageTemplateNode =>
        node !== undefined && node !== null,
    )
    .map((node) => ({
      id: node.id,
      title: node.title?.trim() ?? '',
      body: node.body ?? '',
      channel: node.channel ?? 'SMS',
    }));
};
