import type { RunContext } from './types'

/**
 * AI-driven parameter extraction from natural language prompts.
 * Interprets user intent and maps to scenario parameters.
 *
 * This is a placeholder for actual AI integration.
 * Implementations should replace this with actual LLM-based interpretation.
 */
export type ExtractedParams = Record<string, string>

/**
 * Extract parameters from natural language prompt using AI interpretation.
 * This is a placeholder for actual AI integration.
 *
 * Implementations should:
 * - Use an LLM to interpret the prompt
 * - Extract relevant parameters based on the scenario context
 * - Return extracted parameters as key-value pairs
 *
 * @param prompt - Natural language prompt from user
 * @param ctx - Current run context with existing parameters
 * @returns Extracted parameters to merge into context
 */
export function extractParamsFromPrompt(_prompt: string, _ctx: RunContext): ExtractedParams {
  // Placeholder: return empty object
  // Implementations should replace this with actual AI interpretation
  return {}
}

/**
 * Merge AI-extracted parameters with existing context.
 * Extracted params take precedence over defaults.
 *
 * @param ctx - Current run context
 * @param extracted - Parameters extracted from AI interpretation
 * @returns Merged context with extracted parameters
 */
export function mergeExtractedParams(ctx: RunContext, extracted: ExtractedParams): RunContext {
  return {
    ...ctx,
    ...extracted,
  }
}
