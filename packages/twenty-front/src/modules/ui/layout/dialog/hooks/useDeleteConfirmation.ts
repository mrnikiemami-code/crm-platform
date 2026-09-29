import { useLingui } from '@lingui/react/macro';

export const useDeleteConfirmation = () => {
  const { t } = useLingui();

  const confirmationValue = t({
    message: 'yes',
    context: 'Delete confirmation value',
  });

  return {
    confirmationValue,
    confirmationInstruction: t`Type "${confirmationValue}" to confirm.`,
  };
};
