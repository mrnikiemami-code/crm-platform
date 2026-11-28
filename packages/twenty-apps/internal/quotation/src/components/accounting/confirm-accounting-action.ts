import { enqueueSnackbar, openCommandConfirmationModal } from 'twenty-sdk/front-component';

// The front component runs in a worker. Only the supported host confirmation
// bridge may request confirmation. A missing bridge is a refusal, never consent.
let pending = false;
export const confirmAccountingAction = async (subtitle: string, title = 'تأیید عملیات'): Promise<boolean> => {
  if (pending) return false;
  pending = true;
  try {
    return await openCommandConfirmationModal({ title, subtitle, confirmButtonText: 'تأیید', confirmButtonAccent: 'blue' }) === 'confirm';
  } catch {
    try { await enqueueSnackbar({ message: 'پنجره تأیید در دسترس نیست؛ عملیات انجام نشد.', variant: 'error' }); } catch { /* fail closed even if host is unavailable */ }
    return false;
  } finally { pending = false; }
};
