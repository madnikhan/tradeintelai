/**
 * Provider-agnostic AI error message enhancer.
 */

import { isAIConfigured, callAITextChat } from './ai-service';
import { isGeminiKeyErrorMessage } from './gemini-api-errors';
import { isOpenAIKeyErrorMessage } from './openai-api-errors';

export interface EnhancedError {
  title: string;
  message: string;
  actionableSteps: string[];
  severity: 'error' | 'warning' | 'info';
}

function isAIRelatedError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    isGeminiKeyErrorMessage(message) ||
    isOpenAIKeyErrorMessage(message) ||
    lower.includes('gemini') ||
    lower.includes('openai') ||
    lower.includes('verify:gemini') ||
    lower.includes('verify:openai') ||
    lower.includes('quota')
  );
}

function basicError(error: Error | string): EnhancedError {
  const errorMessage = typeof error === 'string' ? error : error.message;
  return {
    title: 'Error',
    message: errorMessage,
    actionableSteps: [
      'Please try again',
      'Check your connection',
      'Contact support if the issue persists',
    ],
    severity: 'error',
  };
}

export async function enhanceErrorMessage(
  error: Error | string,
  context?: {
    action?: string;
    component?: string;
    userAction?: string;
  }
): Promise<EnhancedError> {
  const errorMessage = typeof error === 'string' ? error : error.message;

  if (isAIRelatedError(errorMessage)) {
    const isQuota = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429');
    return {
      title: isQuota ? 'AI Quota Exceeded' : 'AI Unavailable',
      message: errorMessage,
      actionableSteps: isQuota
        ? [
            'Settings → set AI Provider to Auto or OpenAI',
            'Run npm run verify:gemini and npm run verify:openai',
            'Wait for quota reset or use the other provider',
          ]
        : [
            'Run npm run verify:gemini and npm run verify:openai',
            'Update API keys in .env.local (no quotes)',
            'Restart npm run dev after saving',
          ],
      severity: isQuota ? 'warning' : 'error',
    };
  }

  if (typeof window === 'undefined' || !isAIConfigured()) {
    return basicError(error);
  }

  try {
    const errorStack = typeof error === 'object' && 'stack' in error ? error.stack : undefined;

    const prompt = `You are a helpful technical support assistant for a forex trading platform. A user encountered an error.

Error: ${errorMessage}
${errorStack ? `Stack: ${errorStack.substring(0, 500)}` : ''}
${context?.action ? `Action: ${context.action}` : ''}
${context?.component ? `Component: ${context.component}` : ''}
${context?.userAction ? `User was trying to: ${context.userAction}` : ''}

Provide a user-friendly error explanation with:
1. A clear, non-technical title (max 50 characters)
2. A simple explanation of what went wrong (max 200 characters)
3. 2-4 actionable steps the user can take to fix it (each max 100 characters)
4. Severity level (error/warning/info)

Respond in JSON format:
{
  "title": "Clear error title",
  "message": "Simple explanation",
  "actionableSteps": ["Step 1", "Step 2", "Step 3"],
  "severity": "error|warning|info"
}`;

    const text = await callAITextChat({
      mode: 'text',
      system:
        'You are a helpful technical support assistant. Provide clear, actionable error messages for users.',
      user: prompt,
      json: true,
    });

    if (!text) {
      throw new Error('AI error enhancement failed');
    }

    const enhanced = JSON.parse(text);

    return {
      title: enhanced.title || 'Error',
      message: enhanced.message || errorMessage,
      actionableSteps: Array.isArray(enhanced.actionableSteps)
        ? enhanced.actionableSteps
        : ['Please try again', 'Check your connection'],
      severity: ['error', 'warning', 'info'].includes(enhanced.severity)
        ? enhanced.severity
        : 'error',
    };
  } catch {
    return basicError(error);
  }
}

const commonErrorPatterns: Record<string, EnhancedError> = {
  timeout: {
    title: 'Request Timeout',
    message:
      'The request took too long to complete. This might be due to network issues or the server being busy.',
    actionableSteps: [
      'Check your internet connection',
      'Wait a few seconds and try again',
      'Restart the MT5 bridge if the issue persists',
    ],
    severity: 'warning',
  },
  network: {
    title: 'Network Error',
    message: 'Unable to connect to the server. Please check your internet connection.',
    actionableSteps: [
      'Check your internet connection',
      'Verify the bridge server is running',
      'Try refreshing the page',
    ],
    severity: 'error',
  },
  quota: {
    title: 'API Quota Exceeded',
    message: 'An AI provider quota has been exceeded. Auto mode will try the other provider.',
    actionableSteps: [
      'Settings → AI Provider → Auto (recommended)',
      'Run npm run verify:gemini and npm run verify:openai',
      'Wait a few minutes or switch provider in Settings',
    ],
    severity: 'warning',
  },
  balance: {
    title: 'Balance Not Loaded',
    message: 'Unable to load account balance. Please ensure MT5 is connected and the EA is running.',
    actionableSteps: [
      'Check MT5 is running',
      'Verify the EA is attached to a chart',
      'Ensure "Allow Algo Trading" is enabled',
    ],
    severity: 'warning',
  },
  'api key': {
    title: 'AI API Key Invalid',
    message: 'An AI provider rejected the API key. Update keys in .env.local.',
    actionableSteps: [
      'Run npm run verify:gemini and npm run verify:openai',
      'Update GEMINI_API_KEY and/or OPENAI_API_KEY in .env.local',
      'Restart npm run dev after updating .env.local',
    ],
    severity: 'error',
  },
};

export function quickEnhanceError(error: Error | string): EnhancedError | null {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const lowerMessage = errorMessage.toLowerCase();

  for (const [pattern, enhanced] of Object.entries(commonErrorPatterns)) {
    if (lowerMessage.includes(pattern)) {
      return enhanced;
    }
  }

  return null;
}
