/**
 * Type definitions for FIXio
 * Provides strong typing for FIX protocol messages and related functionality
 */

import { keyvals } from './resources/fixSchema';

// ============================================================================
// FIX Message Types
// ============================================================================

/**
 * FIX tag - can be a number (standard FIX tag) or string (custom tag)
 */
export type FIXTag = number | string;

/**
 * FIX field value - supports all FIX data types
 */
export type FIXValue = string | number | boolean;

/**
 * FIX message - a record of tags mapped to values
 * Values can be primitives, arrays (for repeating groups), or nested messages
 */
export type FIXMessage = Record<FIXTag, FIXValue | FIXValue[] | FIXMessage[]>;

/**
 * FIX key-value pair tuple used in message parsing
 */
export type FIXKeyValuePair = [FIXTag, FIXValue];

/**
 * Numeric FIX message format (tags as numbers)
 */
export type FIXNumericMessage = Record<number, FIXValue | FIXValue[] | FIXNumericMessage[]>;

// ============================================================================
// FIX Schema Types
// ============================================================================

/**
 * FIX keyvals enum type - maps field names to tag numbers
 */
export type FIXKeyvals = typeof keyvals;

/**
 * Repeating groups definition - maps group tag to member field tags
 */
export type RepeatingGroups = Record<string, string[]>;

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session identifier combining company IDs
 */
export interface SessionIdentifier {
  readonly senderCompID: string;
  readonly targetCompID: string;
  readonly senderSubID?: string;
  readonly targetSubID?: string;
}

/**
 * Session state maintained across connections
 */
export interface Session {
  incomingSeqNum: number;
  outgoingSeqNum: number;
  isLoggedIn?: boolean;
}

// ============================================================================
// Message Conversion Types
// ============================================================================

/**
 * Options for FIX message conversion
 */
export interface FIXConversionOptions {
  readonly senderSubID?: string;
  readonly targetSubID?: string;
  readonly senderLocationID?: string;
  readonly appVerID?: string;
}

/**
 * Repeating group parsing result
 */
export interface RepeatingGroupResult {
  readonly length: number;
  readonly repeatingGroup: Array<FIXMessage | FIXNumericMessage>;
}

// ============================================================================
// XML Schema Types
// ============================================================================

/**
 * XML field definition from QuickFIX dictionary
 */
export interface XMLField {
  $: {
    name: string;
    number: string;
    type: string;
    [key: string]: string;
  };
}

/**
 * XML group definition from QuickFIX dictionary
 */
export interface XMLGroup {
  $: {
    name: string;
    required?: string;
  };
  field?: XMLField[];
  component?: XMLComponent[];
  group?: XMLGroup[];
}

/**
 * XML component definition from QuickFIX dictionary
 */
export interface XMLComponent {
  $: {
    name: string;
  };
  field?: XMLField[];
  component?: XMLComponent[];
  group?: XMLGroup[];
}

/**
 * XML message definition from QuickFIX dictionary
 */
export interface XMLMessage {
  $: {
    name: string;
    msgtype: string;
    msgcat: string;
  };
  field?: XMLField[];
  component?: XMLComponent[];
  group?: XMLGroup[];
}

/**
 * Parsed FIX XML dictionary result
 */
export interface ParsedFIXDictionary {
  fix?: {
    header?: Array<{ field?: XMLField[]; component?: XMLComponent[] }>;
    trailer?: Array<{ field?: XMLField[]; component?: XMLComponent[] }>;
    messages?: Array<{ message?: XMLMessage[] }>;
    components?: Array<{ component?: XMLComponent[] }>;
    fields?: Array<{ field?: XMLField[] }>;
  };
}
