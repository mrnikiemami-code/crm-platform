import {
  type CloseSidePanelFunction,
  type CopyToClipboardFunction,
  type EnqueueSnackbarFunction,
  type NavigateFunction,
  type OpenCommandConfirmationModalHostFunction,
  type OpenSidePanelPageFunction,
  type RequestAccessTokenRefreshFunction,
  type StorageClearFunction,
  type StorageDeleteFunction,
  type StorageSetFunction,
  type UnmountFrontComponentFunction,
  type UpdateProgressFunction,
  type UploadFileFunction,
} from 'twenty-sdk/front-component';

/**
 * Calls the Communication app route AS THE SIGNED-IN USER.
 *
 * Why a dedicated function instead of letting the component fetch: a front
 * component reaches the server with the APPLICATION token, so it can never act as
 * the person looking at the screen. This bridge is the only supported way to run a
 * user-scoped Communication operation, and it is deliberately narrow:
 *
 *  - the WORKER supplies an ACTION and a PAYLOAD, never a URL, a user id, a role
 *    or a workspace — the host pins the route and checks the action against an
 *    allow-list, so the worker cannot redirect the call or name an identity;
 *  - the HOST performs the request with the browser's own session credential, so
 *    the user's token is never handed to the worker, written to storage or logged;
 *  - the server then applies the real authorization, exactly as it does for the
 *    app's own settings panels.
 */
export type CallCommunicationRouteFunction = (request: {
  /** One of the allow-listed Communication actions. */
  action: string;
  /** Action arguments. Never carries an identity. */
  payload?: Record<string, unknown>;
}) => Promise<unknown>;

export type FrontComponentHostCommunicationApi = {
  navigate: NavigateFunction;
  requestAccessTokenRefresh: RequestAccessTokenRefreshFunction;
  openSidePanelPage: OpenSidePanelPageFunction;
  openCommandConfirmationModal: OpenCommandConfirmationModalHostFunction;
  unmountFrontComponent: UnmountFrontComponentFunction;
  enqueueSnackbar: EnqueueSnackbarFunction;
  closeSidePanel: CloseSidePanelFunction;
  updateProgress: UpdateProgressFunction;
  copyToClipboard: CopyToClipboardFunction;
  uploadFile: UploadFileFunction;
  storageSet: StorageSetFunction;
  storageDelete: StorageDeleteFunction;
  storageClear: StorageClearFunction;
  callCommunicationRoute: CallCommunicationRouteFunction;
};
