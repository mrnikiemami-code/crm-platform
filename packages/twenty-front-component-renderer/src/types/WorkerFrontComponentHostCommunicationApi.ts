import {
  type CloseSidePanelFunction,
  type CopyToClipboardFunction,
  type EnqueueSnackbarFunction,
  type NavigateFunction,
  type OpenCommandConfirmationModalFunction,
  type OpenSidePanelPageFunction,
  type RequestAccessTokenRefreshFunction,
  type StorageClearFunction,
  type StorageDeleteFunction,
  type StorageSetFunction,
  type UnmountFrontComponentFunction,
  type UpdateProgressFunction,
  type UploadFileFunction,
} from 'twenty-sdk/front-component';

export type WorkerFrontComponentHostCommunicationApi = {
  navigate?: NavigateFunction;
  requestAccessTokenRefresh?: RequestAccessTokenRefreshFunction;
  openSidePanelPage?: OpenSidePanelPageFunction;
  openCommandConfirmationModal?: OpenCommandConfirmationModalFunction;
  unmountFrontComponent?: UnmountFrontComponentFunction;
  enqueueSnackbar?: EnqueueSnackbarFunction;
  closeSidePanel?: CloseSidePanelFunction;
  updateProgress?: UpdateProgressFunction;
  copyToClipboard?: CopyToClipboardFunction;
  uploadFile?: UploadFileFunction;
  storageSet?: StorageSetFunction;
  storageDelete?: StorageDeleteFunction;
  storageClear?: StorageClearFunction;
  /**
   * Runs a user-scoped Communication operation through the host.
   *
   * Typed locally rather than imported from `twenty-sdk/front-component`: the SDK
   * an app builds against is a published package, while this renderer is part of
   * the host, so the contract has to be declared on the side that actually
   * provides it.
   */
  callCommunicationRoute?: (request: {
    action: string;
    payload?: Record<string, unknown>;
  }) => Promise<unknown>;
};
