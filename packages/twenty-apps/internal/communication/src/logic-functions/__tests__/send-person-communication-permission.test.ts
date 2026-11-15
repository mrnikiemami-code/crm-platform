import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkSendMessagePermission = vi.fn();

vi.mock('src/settings/settings-permission', () => ({
  checkSendMessagePermission,
}));

const sendPersonCommunicationHandler = vi.fn();

vi.mock('src/logic-functions/handlers/send-person-communication-handler', () => ({
  sendPersonCommunicationHandler,
}));

// The route is reachable by anyone holding a token, so the guard has to live in
// the handler itself: a caller that calls the function directly must be refused
// before any provider is touched. That is what these cases pin.
describe('communication-send-message route authorization', () => {
  beforeEach(() => {
    checkSendMessagePermission.mockReset();
    sendPersonCommunicationHandler.mockReset();
  });

  const loadHandler = async () => {
    const routeModule = await import(
      'src/logic-functions/send-person-communication'
    );

    return (routeModule as unknown as { handler: Function }).handler;
  };

  const event = {
    body: {
      personId: 'person-1',
      channel: 'SMS',
      recipient: '+989120000000',
      body: 'سلام',
    },
  };

  it('refuses and never dispatches when the caller may not send', async () => {
    checkSendMessagePermission.mockResolvedValue({
      allowed: false,
      reason: 'NOT_PERMITTED',
    });

    const handler = await loadHandler();
    const result = await handler(event, { workspaceMemberId: 'member-1' });

    expect(result).toEqual({
      success: false,
      failureCode: 'NOT_PERMITTED',
      error: 'You do not have permission to send messages.',
    });
    expect(sendPersonCommunicationHandler).not.toHaveBeenCalled();
  });

  it('refuses an application context with no user, without dispatching', async () => {
    checkSendMessagePermission.mockResolvedValue({
      allowed: false,
      reason: 'NO_USER_CONTEXT',
    });

    const handler = await loadHandler();
    const result = await handler(event);

    expect(result.success).toBe(false);
    expect(sendPersonCommunicationHandler).not.toHaveBeenCalled();
  });

  it('does not disclose which reason applied', async () => {
    checkSendMessagePermission.mockResolvedValue({
      allowed: false,
      reason: 'CHECK_FAILED',
    });

    const handler = await loadHandler();
    const result = await handler(event);

    expect(result.error).toBe('You do not have permission to send messages.');
    expect(JSON.stringify(result)).not.toContain('CHECK_FAILED');
  });

  it('proceeds to the handler when the caller is allowed', async () => {
    checkSendMessagePermission.mockResolvedValue({ allowed: true });
    sendPersonCommunicationHandler.mockResolvedValue({ success: true });

    const handler = await loadHandler();
    const result = await handler(event, { workspaceMemberId: 'member-1' });

    expect(sendPersonCommunicationHandler).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true });
  });
});
