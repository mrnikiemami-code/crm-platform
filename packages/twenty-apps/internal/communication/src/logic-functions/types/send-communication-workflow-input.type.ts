import { type InputJsonSchema } from 'twenty-sdk/logic-function';

// Input contract for the Workflow action. It mirrors the composer's user-intent
// fields and adds an optional Person context. Sender and workspace identity are
// deliberately absent: they come from the trusted execution context.
export type SendCommunicationWorkflowRequest = {
  channel?: unknown;
  providerId?: unknown;
  recipient?: unknown;
  body?: unknown;
  subject?: unknown;
  targetPersonId?: unknown;
};

// Output contract. `success` is true only for a completed send whose outcome
// was durably recorded; every other case is a failure with a classification.
export type SendCommunicationWorkflowResult = {
  success: boolean;
  status?: 'SENT' | 'DELIVERED' | 'FAILED';
  communicationId?: string;
  failureCode?: string;
  isOutcomeKnown?: boolean;
  message?: string;
  error?: string;
};

export const SEND_COMMUNICATION_WORKFLOW_INPUT_SCHEMA: InputJsonSchema = {
  type: 'object',
  properties: {
    channel: {
      type: 'string',
      enum: ['SMS'],
      label: 'Channel',
      description: 'Channel to send on. Only implemented channels are listed.',
    },
    providerId: {
      type: 'string',
      label: 'Provider',
      description:
        'Optional provider id. Leave empty to use the configured default provider.',
    },
    recipient: {
      type: 'string',
      label: 'Recipient',
      description: 'Destination the message is sent to, e.g. a phone number.',
    },
    body: {
      type: 'string',
      label: 'Message',
      multiline: true,
      description: 'The message text.',
    },
    subject: {
      type: 'string',
      label: 'Subject',
      description:
        'Optional. Only meaningful for channels that support a subject.',
    },
    targetPersonId: {
      type: 'string',
      label: 'Person',
      description:
        'Optional Person id. When set, access and recipient ownership are validated against that Person.',
    },
  },
  required: ['channel', 'recipient', 'body'],
  additionalProperties: false,
};
