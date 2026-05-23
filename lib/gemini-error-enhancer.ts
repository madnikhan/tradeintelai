/**
 * Gemini Error Message Enhancer
 * Uses Gemini to generate user-friendly, actionable error messages
 */

import { isGeminiConfigured } from './gemini-service';
import { isGeminiKeyErrorMessage } from './gemini-api-errors';
import { ensureGeminiAvailable } from './gemini-circuit-breaker';

export interface EnhancedError {
  title: string;
  message: string;
  actionableSteps: string[];
  severity: 'error' | 'warning' | 'info';
}

function isGeminiRelatedError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    isGeminiKeyErrorMessage(message) ||
    lower.includes('gemini') ||
    lower.includes('verify:gemini')
  );
}

function basicError(error: Error | string): EnhancedError {
  const errorMessage = typeof error === 'string' ? error : error.message;
  return {
    title: 'Error',
    message: errorMessage,
    actionableSteps: ['Please try again', 'Check your connection', 'Contact support if the issue persists'],
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

  if (isGeminiRelatedError(errorMessage)) {
    return {
      title: 'Gemini Unavailable',
      message: errorMessage,
      actionableSteps: [
        'Run npm run verify:gemini in the project folder',
        'Update GEMINI_API_KEY in .env.local (no quotes)',
        'Restart npm run dev after saving',
      ],
      severity: 'error',
    };
  }

  if (typeof window === 'undefined' || !isGeminiConfigured()) {
    return basicError(error);
  }

  if (!(await ensureGeminiAvailable())) {
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

    const response = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'text',
        system:
          'You are a helpful technical support assistant. Provide clear, actionable error messages for users.',
        user: prompt,
        json: true,
      }),
    });

    if (!response.ok) {
      throw new Error('Gemini error enhancement failed');
    }

    const data = await response.json();
    const enhanced = JSON.parse(data.text || '{}');

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
    message: 'The request took too long to complete. This might be due to network issues or the server being busy.',
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
    message: 'The Gemini API quota has been exceeded. Please wait or enable billing.',
    actionableSteps: [
      'Go to Google AI Studio',
      'Wait a few minutes and retry',
      'Enable billing for higher limits',
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
    title: 'Gemini API Key Invalid',
    message: 'Gemini rejected the API key. Update GEMINI_API_KEY in .env.local.',
    actionableSteps: [
      'Run npm run verify:gemini',
      'Create a new key at aistudio.google.com/apikey',
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
