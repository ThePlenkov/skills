/**
 * SARIF 2.1.0 types — only the subset we actually produce.
 *
 * Spec: https://docs.oasis-open.org/sarif/sarif/v2.1.0/
 */
export interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: SarifRun[];
}

export interface SarifRun {
  tool: {
    driver: SarifDriver;
  };
  originalUriBaseIds?: Record<string, { uri: string }>;
  results: SarifResult[];
}

export interface SarifDriver {
  name: string;
  version?: string;
  informationUri?: string;
  rules: SarifRule[];
}

export interface SarifRule {
  id: string;
  name?: string;
  shortDescription?: { text: string };
  fullDescription?: { text: string };
  help?: { text: string; markdown?: string };
  properties?: Record<string, unknown>;
}

export interface SarifResult {
  ruleId: string;
  ruleIndex?: number;
  level: 'none' | 'note' | 'warning' | 'error';
  message: { text: string };
  locations?: Array<{
    physicalLocation?: {
      artifactLocation: { uri: string };
      region?: {
        startLine?: number;
        startColumn?: number;
        endLine?: number;
        endColumn?: number;
      };
    };
  }>;
  properties?: Record<string, unknown>;
}

export const SARIF_SCHEMA_URL =
  'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json';

export const SEVERITY_TO_LEVEL: Record<string, SarifResult['level']> = {
  HIGH: 'error',
  CRITICAL: 'error',
  MEDIUM: 'warning',
  WARNING: 'warning',
  LOW: 'note',
  INFO: 'note',
  NOTE: 'note',
  NONE: 'none',
};