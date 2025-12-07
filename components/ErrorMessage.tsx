'use client';

import { useState, useEffect } from 'react';
import { enhanceErrorMessage, quickEnhanceError, type EnhancedError } from '@/lib/openai-error-enhancer';

interface ErrorMessageProps {
  title?: string;
  message: string;
  error?: Error | string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  type?: 'error' | 'warning' | 'info';
  className?: string;
  context?: {
    action?: string;
    component?: string;
    userAction?: string;
  };
  useGPTEnhancement?: boolean; // Enable GPT-5.1 enhancement
}

export function ErrorMessage({
  title: propTitle,
  message: propMessage,
  error,
  actions = [],
  type: propType = 'error',
  className = '',
  context,
  useGPTEnhancement = true,
}: ErrorMessageProps) {
  const [enhancedError, setEnhancedError] = useState<EnhancedError | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);

  useEffect(() => {
    if (useGPTEnhancement && error) {
      // Try quick pattern matching first
      const quickEnhanced = quickEnhanceError(error);
      if (quickEnhanced) {
        setEnhancedError(quickEnhanced);
        return;
      }

      // If no quick match, use GPT-5.1 (async)
      setIsEnhancing(true);
      enhanceErrorMessage(error, context)
        .then((enhanced) => {
          setEnhancedError(enhanced);
        })
        .catch(() => {
          // Fallback to original error
        })
        .finally(() => {
          setIsEnhancing(false);
        });
    }
  }, [error, context, useGPTEnhancement]);

  // Use enhanced error if available, otherwise use props
  const title = enhancedError?.title || propTitle || 'Error';
  const message = enhancedError?.message || propMessage;
  const type = enhancedError?.severity || propType;
  const actionableSteps = enhancedError?.actionableSteps || [];

  const styles = {
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      icon: '❌',
      titleColor: 'text-red-400',
      textColor: 'text-red-300/80',
    },
    warning: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      icon: '⚠️',
      titleColor: 'text-yellow-400',
      textColor: 'text-yellow-300/80',
    },
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      icon: 'ℹ️',
      titleColor: 'text-blue-400',
      textColor: 'text-blue-300/80',
    },
  };

  const style = styles[type];

  return (
    <div className={`${style.bg} ${style.border} border rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{style.icon}</span>
        <div className="flex-1">
          <h4 className={`${style.titleColor} font-bold mb-1`}>
            {title}
            {isEnhancing && (
              <span className="ml-2 text-xs opacity-60">(Enhancing with AI...)</span>
            )}
          </h4>
          <p className={`${style.textColor} text-sm mb-3`}>{message}</p>
          
          {/* Actionable Steps from GPT-5.1 */}
          {actionableSteps.length > 0 && (
            <div className="mb-3 space-y-1">
              <p className="text-xs text-gray-400 mb-1">💡 What you can do:</p>
              <ul className="text-xs text-gray-300 space-y-1 ml-4">
                {actionableSteps.map((step, index) => (
                  <li key={index} className="list-disc">{step}</li>
                ))}
              </ul>
            </div>
          )}
          
          {actions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    action.variant === 'primary'
                      ? `${style.titleColor.replace('400', '500')}/20 ${style.titleColor} hover:opacity-80`
                      : 'bg-[#1e2738] text-gray-400 hover:bg-[#2a3548]'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

