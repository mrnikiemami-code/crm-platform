// Thin, injectable adapter over the platform `fetch`. It exists only so tests
// can supply a fake transport; there is no second HTTP stack here.
export type CommunicationHttpRequest = {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
};

export type CommunicationHttpResponse = {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
};

export type CommunicationHttpClient = (
  request: CommunicationHttpRequest,
) => Promise<CommunicationHttpResponse>;

export const defaultCommunicationHttpClient: CommunicationHttpClient = async (
  request,
) => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(request.body === undefined ? {} : { body: request.body }),
  });

  return {
    status: response.status,
    ok: response.ok,
    text: () => response.text(),
  };
};
