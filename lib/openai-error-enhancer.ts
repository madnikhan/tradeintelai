/**
 * OpenAI Error Message Enhancer
 * Uses GPT-5.1 to generate user-friendly, actionable error messages
 */

import { isOpenAIConfigured, getOpenAIKey } from './openai-service';

export interface EnhancedError {
  title: string;
  message: string;
  actionableSteps: string[];
  severity: 'error' | 'warning' | 'info';
}

/**
 * Enhance error message with GPT-5.1 for better user experience
 */
export async function enhanceErrorMessage(
  error: Error | string,
  context?: {
    action?: string;
    component?: string;
    userAction?: string;
  }
): Promise<EnhancedError> {
  // If GPT-5.1 is not configured, return basic error
  if (!isOpenAIConfigured() || typeof window === 'undefined') {
    const errorMessage = typeof error === 'string' ? error : error.message;
    return {
      title: 'Error',
      message: errorMessage,
      actionableSteps: ['Please try again', 'Check your connection', 'Contact support if the issue persists'],
      severity: 'error',
    };
  }

  try {
    const errorMessage = typeof error === 'string' ? error : error.message;
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

    const response = await fetch('/api/openai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful technical support assistant. Provide clear, actionable error messages for users.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_completion_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error('GPT-5.1 error enhancement failed');
    }

    const data = await response.json();
    const jsonText = data.choices[0]?.message?.content || '{}';
    const enhanced = JSON.parse(jsonText);

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
  } catch (error) {
    // Fallback to basic error if GPT-5.1 fails
    const errorMessage = typeof error === 'string' ? error : (error instanceof Error ? error.message : 'Unknown error');
    return {
      title: 'Error',
      message: errorMessage,
      actionableSteps: ['Please try again', 'Check your connection', 'Contact support if the issue persists'],
      severity: 'error',
    };
  }
}

/**
 * Get common error patterns and their enhanced messages (cached)
 */
const commonErrorPatterns: Record<string, EnhancedError> = {
  'timeout': {
    title: 'Request Timeout',
    message: 'The request took too long to complete. This might be due to network issues or the server being busy.',
    actionableSteps: [
      'Check your internet connection',
      'Wait a few seconds and try again',
      'Restart the MT5 bridge if the issue persists',
    ],
    severity: 'warning',
  },
  'network': {
    title: 'Network Error',
    message: 'Unable to connect to the server. Please check your internet connection.',
    actionableSteps: [
      'Check your internet connection',
      'Verify the bridge server is running',
      'Try refreshing the page',
    ],
    severity: 'error',
  },
  'quota': {
    title: 'API Quota Exceeded',
    message: 'The OpenAI API quota has been exceeded. Please add credits to continue using AI features.',
    actionableSteps: [
      'Go to OpenAI Billing',
      'Add payment method or credits',
      'Wait a few minutes for activation',
    ],
    severity: 'warning',
  },
  'balance': {
    title: 'Balance Not Loaded',
    message: 'Unable to load account balance. Please ensure MT5 is connected and the EA is running.',
    actionableSteps: [
      'Check MT5 is running',
      'Verify the EA is attached to a chart',
      'Ensure "Allow Algo Trading" is enabled',
    ],
    severity: 'warning',
  },
};

/**
 * Quick error enhancement using pattern matching (faster than GPT-5.1)
 */
export function quickEnhanceError(error: Error | string): EnhancedError | null {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const lowerMessage = errorMessage.toLowerCase();

  // Check for common patterns
  for (const [pattern, enhanced] of Object.entries(commonErrorPatterns)) {
    if (lowerMessage.includes(pattern)) {
      return enhanced;
    }
  }

  return null;
}

