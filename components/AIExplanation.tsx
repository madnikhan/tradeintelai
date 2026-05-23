'use client';

/**
 * AI Explanation Component
 * Displays Gemini AI-generated explanations for market analysis
 */

import { useState, useEffect } from 'react';
import { MarketAnalysis } from '@/lib/ai-trading-engine';
import { generateAnalysisExplanation, isAIConfigured, getActiveAIProviderLabel } from '@/lib/ai-service';

interface AIExplanationProps {
  analysis: MarketAnalysis;
  symbol: string;
  onRegenerate?: () => void;
}

interface GPTExplanation {
  summary: string;
  keyPoints: string[];
  riskFactors: string[];
  recommendation: string;
}

export function AIExplanation({ analysis, symbol, onRegenerate }: AIExplanationProps) {
  const [explanation, setExplanation] = useState<GPTExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const [providerLabel, setProviderLabel] = useState('AI');

  const isConfigured = isAIConfigured();

  // Generate explanation when analysis changes
  useEffect(() => {
    if (!isConfigured) {
      return; // Don't try to generate if not configured
    }

    const fetchExplanation = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await generateAnalysisExplanation(analysis, symbol);
        if (result) {
          setExplanation(result.explanation);
          setProviderLabel(getActiveAIProviderLabel());
        } else {
          setError('Failed to generate explanation');
        }
      } catch (err: any) {
        console.error('Error generating explanation:', err);
        const errorMessage = err?.message || 'Error generating AI explanation';
        setError(errorMessage.includes('API error') ? errorMessage : `Error: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    fetchExplanation();
  }, [analysis, symbol, isConfigured]);

  const handleRegenerate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await generateAnalysisExplanation(analysis, symbol);
      if (result) {
        setExplanation(result.explanation);
        setProviderLabel(getActiveAIProviderLabel());
        if (onRegenerate) {
          onRegenerate();
        }
      } else {
        setError('Failed to regenerate explanation');
      }
    } catch (err: any) {
      console.error('Error regenerating explanation:', err);
      const errorMessage = err?.message || 'Error regenerating AI explanation';
      setError(errorMessage.includes('API error') ? errorMessage : `Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!explanation) return;

    const textToCopy = [
      explanation.summary,
      '',
      'Key Points:',
      ...explanation.keyPoints.map(p => `• ${p}`),
      '',
      'Risk Factors:',
      ...explanation.riskFactors.map(r => `• ${r}`),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Don't render if Gemini is not configured
  if (!isConfigured) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-cyan-50/10 to-blue-50/10 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl border border-cyan-200/30 dark:border-cyan-800/30 p-5 sm:p-6 mb-4 sm:mb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
          {/* OpenAI Logo */}
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#10A37F"/>
            <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="#10A37F"/>
            <circle cx="12" cy="12" r="2" fill="#10A37F"/>
          </svg>
          {/* GPT-5.1 Logo */}
          <img 
            src="/gpt-5.1.png" 
            alt="GPT-5.1" 
            className="w-5 h-5 flex-shrink-0 rounded"
          />
          <span>AI-Powered Analysis</span>
          <span className="text-xs font-normal text-gray-400">Powered by {providerLabel}</span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!explanation || loading}
            className="p-1.5 sm:p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Copy explanation"
          >
            {copied ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 sm:p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg 
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-3 py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400"></div>
              <p className="text-sm text-gray-400">Generating AI insights...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-sm text-red-400 mb-2">{error}</p>
              {error.includes('quota') || error.includes('billing') ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-red-300">
                    💡 To fix this:
                  </p>
                  <ol className="text-xs text-red-300 list-decimal list-inside space-y-1 ml-2">
                    <li>Get a key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></li>
                    <li>Add payment method or credits</li>
                    <li>Wait a few minutes for activation</li>
                    <li>Try again</li>
                  </ol>
                </div>
              ) : (
                <button
                  onClick={handleRegenerate}
                  className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                >
                  Try again
                </button>
              )}
            </div>
          ) : explanation ? (
            <>
              {/* Summary */}
              <div>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  {explanation.summary}
                </p>
              </div>

              {/* Key Points */}
              {explanation.keyPoints.length > 0 && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                    <span>🎯</span> Key Insights
                  </h4>
                  <ul className="space-y-1.5">
                    {explanation.keyPoints.map((point, index) => (
                      <li key={index} className="text-xs sm:text-sm text-gray-400 flex items-start gap-2">
                        <span className="text-cyan-400 mt-0.5">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risk Factors */}
              {explanation.riskFactors.length > 0 && (
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
                    <span>⚠️</span> Risk Considerations
                  </h4>
                  <ul className="space-y-1.5">
                    {explanation.riskFactors.map((risk, index) => (
                      <li key={index} className="text-xs sm:text-sm text-gray-400 flex items-start gap-2">
                        <span className="text-amber-400 mt-0.5">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-cyan-500/20">
                <button
                  onClick={handleRegenerate}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs sm:text-sm bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </button>
                {copied && (
                  <span className="px-3 py-1.5 text-xs text-emerald-400 flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">No explanation available</p>
          )}
        </div>
      )}
    </div>
  );
}

