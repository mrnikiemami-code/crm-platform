import { type FieldMetadataType } from '@/types';
import { type LeafType, type NodeType } from '@/workflow';

export type RecordSchemaType = 'record' | 'records';

export type InputSchemaPropertyType =
  | LeafType
  | NodeType
  | RecordSchemaType
  | FieldMetadataType;

/**
 * A value the builder takes from the workflow TRIGGER instead of asking the
 * author for it.
 *
 * This exists because a logic function cannot read workflow state: the executor
 * passes only the step input, and `LogicFunctionExecutionContext` carries no
 * trigger. A trigger value therefore has to be delivered as a property value,
 * which is what these markers let the builder fill in.
 */
export type TriggerDerivedValue =
  | 'recordId'
  | 'eventId'
  | 'watchedField'
  | 'beforeValue'
  | 'afterValue'
  | 'objectName'
  | 'workflowId';

export type InputSchemaProperty = {
  type: InputSchemaPropertyType;
  enum?: string[];
  items?: InputSchemaProperty;
  properties?: Properties;
  multiline?: boolean;
  label?: string;
  objectUniversalIdentifier?: string;
  /**
   * Not rendered in the builder. For a property the platform supplies, so the
   * author has nothing meaningful to type. It stays DECLARED, because a property
   * absent from the schema never reaches the function at all
   * (`mergeDefaultFunctionInputAndFunctionInput` only keeps declared keys).
   */
  isHidden?: boolean;
  /**
   * Marks a property whose value the builder derives from the trigger. When the
   * trigger cannot supply it, the value is left EMPTY — never fabricated — and
   * the function refuses the call.
   */
  derivedFromTrigger?: TriggerDerivedValue;
};

type Properties = {
  [name: string]: InputSchemaProperty;
};

export type InputSchema = InputSchemaProperty[];
