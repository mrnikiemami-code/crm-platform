// The object names this app acts on. They are the workspace's own custom
// objects, NOT objects this app defines: nothing here creates or alters them.
export const EVENT_LEAD_OBJECT_NAME = 'eventLead';
export const SALES_INTERACTION_OBJECT_NAME = 'salesInteraction';
export const EVENT_REGISTRATION_OBJECT_NAME = 'eventRegistration';
export const REGISTRATION_PAYMENT_OBJECT_NAME = 'registrationPayment';

/**
 * The relation that ties a record to the lead a registration belongs to.
 * A lead IS the target; an interaction reaches it through `eventLead`.
 */
export const LEAD_RELATION_BY_SOURCE_OBJECT: Record<string, string | null> = {
  [EVENT_LEAD_OBJECT_NAME]: null,
  [SALES_INTERACTION_OBJECT_NAME]: 'eventLead',
};

export const isSupportedSourceObject = (objectNameSingular: string): boolean =>
  Object.prototype.hasOwnProperty.call(
    LEAD_RELATION_BY_SOURCE_OBJECT,
    objectNameSingular,
  );
