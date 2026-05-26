'use client';

import { useState } from 'react';

interface ScoreData {
  symbol: string;
  overallScore: number;
  technicalScore: number;
  fundamentalScore: number;
  sentimentScore: number;
  aiScore: number;
  riskScore: number;
  timingScore: number;
  recommendation: string;
  confidence: number;
  signals: {
    bullish: string[];
    bearish: string[];
    neutral: string[];
  };
}

interface SmartScoreCardProps {
  analysis: any;
  symbol: string;
  compact?: boolean;
}

export function SmartScoreCard({ analysis, symbol, compact = false }: SmartScoreCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!analysis) {
    return (
      <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-[#1e2738] rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-[#1e2738] rounded"></div>
        </div>
      </div>
    );
  }

  // Calculate derived scores
  const technicalScore = analysis.technicalScore || 50;
  const fundamentalScore = analysis.fundamentalScore || 50;
  const sentimentScore = analysis.sentimentScore || 50;
  const overallScore = analysis.overallScore || 50;
  const confidence = analysis.confidence || 0;
  
  // Calculate AI Score (weighted combination)
  const aiScore = Math.round((technicalScore * 0.4 + fundamentalScore * 0.3 + sentimentScore * 0.3));
  
  // Risk Score (inverse - lower risk = higher score)
  const riskScore = analysis.riskLevel === 'LOW' ? 85 : analysis.riskLevel === 'MEDIUM' ? 60 : 35;
  
  // Timing Score based on trading hours
  const timingScore = analysis.tradingHours?.quality === 'PRIME' ? 95 :
                      analysis.tradingHours?.quality === 'GOOD' ? 75 :
                      analysis.tradingHours?.quality === 'AVERAGE' ? 50 : 25;

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-rose-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-rose-500';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 70) return 'from-emerald-500 to-green-400';
    if (score >= 50) return 'from-yellow-500 to-amber-400';
    return 'from-rose-500 to-red-400';
  };

  // Get recommendation badge
  const getRecommendationBadge = () => {
    const rec = analysis.recommendation || 'HOLD';
    if (rec.includes('STRONG_BUY')) return { text: 'STRONG BUY', color: 'bg-emerald-500', icon: '🚀' };
    if (rec.includes('BUY')) return { text: 'BUY', color: 'bg-green-500', icon: '📈' };
    if (rec.includes('STRONG_SELL')) return { text: 'STRONG SELL', color: 'bg-rose-500', icon: '🔻' };
    if (rec.includes('SELL')) return { text: 'SELL', color: 'bg-red-500', icon: '📉' };
    return { text: 'HOLD', color: 'bg-yellow-500', icon: '⏸️' };
  };

  const badge = getRecommendationBadge();

  // Collect signals
  const signals = {
    bullish: [] as string[],
    bearish: [] as string[],
    neutral: [] as string[],
  };

  // Parse reasoning into signals
  if (analysis.reasoning) {
    analysis.reasoning.forEach((reason: string) => {
      const lower = reason.toLowerCase();
      if (lower.includes('bullish') || lower.includes('buy') || lower.includes('uptrend') || lower.includes('support')) {
        signals.bullish.push(reason);
      } else if (lower.includes('bearish') || lower.includes('sell') || lower.includes('downtrend') || lower.includes('resistance') || lower.includes('overbought')) {
        signals.bearish.push(reason);
      } else {
        signals.neutral.push(reason);
      }
    });
  }

  // Add COT signals
  // 🔒 EXPLANATION-SOURCE INTEGRITY: Forbid BUY/SELL wording when non-actionable
  if (analysis.cotAnalysis) {
    const cot = analysis.cotAnalysis;
    const isBiasNonActionable = analysis.gateStatus?.directionalBias === 'NEUTRAL';
    const isExecutionBlocked = !analysis.gateStatus?.executionPermitted;
    const shouldSanitize = isBiasNonActionable || isExecutionBlocked;
    
    if (shouldSanitize) {
      // Downgrade to "context-only / non-actionable"
      const cotDirection = cot.recommendation?.includes('BUY') ? 'BULLISH' :
                          cot.recommendation?.includes('SELL') ? 'BEARISH' : 'NEUTRAL';
      signals.neutral.push(`COT: ${cotDirection} positioning (Context-Only / Non-Actionable)`);
    } else {
      // Normal COT signal when actionable
      if (cot.recommendation?.includes('BUY')) signals.bullish.push(`COT: ${cot.sentiment} sentiment`);
      else if (cot.recommendation?.includes('SELL')) signals.bearish.push(`COT: ${cot.sentiment} sentiment`);
      else signals.neutral.push(`COT: ${cot.sentiment} sentiment`);
    }
  }

  // Add regime signals
  if (analysis.regimeAnalysis) {
    const regime = analysis.regimeAnalysis;
    if (regime.regime === 'TRENDING_UP') signals.bullish.push(`Market trending UP (${regime.confidence}% confidence)`);
    else if (regime.regime === 'TRENDING_DOWN') signals.bearish.push(`Market trending DOWN (${regime.confidence}% confidence)`);
    else signals.neutral.push(`Market ${regime.regime?.replace('_', ' ')}`);
  }

  // Score Ring Component
  const ScoreRing = ({ score, size = 'lg', label }: { score: number; size?: 'sm' | 'md' | 'lg'; label?: string }) => {
    const sizes = {
      sm: { ring: 60, stroke: 4, text: 'text-lg', label: 'text-[10px]' },
      md: { ring: 80, stroke: 5, text: 'text-2xl', label: 'text-xs' },
      lg: { ring: 120, stroke: 6, text: 'text-4xl', label: 'text-sm' },
    };
    const s = sizes[size];
    const radius = (s.ring - s.stroke) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    return (
      <div className="relative flex flex-col items-center">
        <svg width={s.ring} height={s.ring} className="transform -rotate-90">
          <circle
            cx={s.ring / 2}
            cy={s.ring / 2}
            r={radius}
            stroke="#1e2738"
            strokeWidth={s.stroke}
            fill="none"
          />
          <circle
            cx={s.ring / 2}
            cy={s.ring / 2}
            r={radius}
            stroke={score >= 70 ? '#10b981' : score >= 50 ? '#eab308' : '#f43f5e'}
            strokeWidth={s.stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${s.text} ${getScoreColor(score)}`}>{score}</span>
          {label && <span className={`text-gray-500 ${s.label}`}>{label}</span>}
        </div>
      </div>
    );
  };

  // Score Bar Component
  const ScoreBar = ({ label, score, icon }: { label: string; score: number; icon: string }) => (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <span>{icon}</span> {label}
        </span>
        <span className={`text-sm font-bold font-mono ${getScoreColor(score)}`}>{score}</span>
      </div>
      <div className="h-1.5 bg-[#1e2738] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getScoreGradient(score)} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );

  // Trade Decision Score
  const tradeDecisionScore = Math.round(
    (overallScore * 0.3) + 
    (confidence * 0.25) + 
    (timingScore * 0.2) + 
    (riskScore * 0.15) +
    (aiScore * 0.1)
  );

  const executionPermitted = analysis.gateStatus?.executionPermitted ?? false;
  const executionBlockedBy: string[] = analysis.gateStatus?.executionBlockedBy ?? [];
  const shouldTrade =
    executionPermitted &&
    tradeDecisionScore >= 65 &&
    confidence >= 60 &&
    !badge.text.includes('HOLD');

  if (compact) {
    return (
      <div className="space-y-3">
        <p className="hint">
          <strong className="text-secondary">Engine score</strong> — weighted technical, fundamental, and sentiment inputs.
          <strong className="text-secondary block mt-1">Trade decision score</strong> — timing and risk adjusted for whether to act now.
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-[#141c2b] rounded-lg p-3 border border-[#1e2738]">
            <p className="label">Engine</p>
            <p className={`value ${getScoreColor(overallScore)}`}>{overallScore}/100</p>
          </div>
          <div className="bg-[#141c2b] rounded-lg p-3 border border-[#1e2738]">
            <p className="label">Decision</p>
            <p className={`value ${getScoreColor(tradeDecisionScore)}`}>{tradeDecisionScore}/100</p>
          </div>
        </div>
        <p className="text-xs text-secondary">
          {shouldTrade
            ? 'Scores support trading — Gate 4 passed.'
            : !executionPermitted
              ? 'Execution blocked by Gate 4 — alignment score does not mean you should trade.'
              : 'Scores suggest caution — check gate status above.'}
        </p>
        {!executionPermitted && executionBlockedBy.length > 0 && (
          <ul className="text-xs text-amber-400/90 list-disc list-inside space-y-0.5">
            {executionBlockedBy.slice(0, 2).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1e2738] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold">
            📊
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Smart Score Analysis</h3>
            <p className="text-xs text-gray-500">{symbol} • Danelfin-style scoring</p>
          </div>
        </div>
        <div className={`px-4 py-2 rounded-lg ${badge.color} text-white font-bold flex items-center gap-2`}>
          <span>{badge.icon}</span>
          <span>{badge.text}</span>
        </div>
      </div>

      {/* Main Score Section */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Main Score */}
          <div className="flex flex-col items-center justify-center">
            <ScoreRing score={tradeDecisionScore} size="lg" label="Trade Score" />
            <div className={`mt-4 px-4 py-2 rounded-lg text-sm font-bold ${
              shouldTrade ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
              'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            }`}>
              {shouldTrade ? '✓ Executable' : executionPermitted ? '⏸ Wait for Better Setup' : '⏸ Execution blocked'}
            </div>
            {!executionPermitted && executionBlockedBy.length > 0 && (
              <p className="mt-3 text-xs text-amber-400/90 text-center max-w-xs">
                {executionBlockedBy[0]}
              </p>
            )}
          </div>

          {/* Center - Score Breakdown */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-400 mb-3">Score Breakdown</h4>
            <ScoreBar label="Technical" score={technicalScore} icon="📈" />
            <ScoreBar label="Fundamental" score={fundamentalScore} icon="📰" />
            <ScoreBar label="Sentiment" score={sentimentScore} icon="💭" />
            <ScoreBar label={executionPermitted ? 'Alignment' : 'Analysis alignment'} score={confidence} icon="🤖" />
            <ScoreBar label="Timing" score={timingScore} icon="⏰" />
            <ScoreBar label="Risk Profile" score={riskScore} icon="🛡️" />
          </div>

          {/* Right - Mini Scores */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center">
              <ScoreRing score={technicalScore} size="sm" />
              <span className="text-[10px] text-gray-500 mt-1">Technical</span>
            </div>
            <div className="flex flex-col items-center">
              <ScoreRing score={fundamentalScore} size="sm" />
              <span className="text-[10px] text-gray-500 mt-1">Fundamental</span>
            </div>
            <div className="flex flex-col items-center">
              <ScoreRing score={sentimentScore} size="sm" />
              <span className="text-[10px] text-gray-500 mt-1">Sentiment</span>
            </div>
            <div className="flex flex-col items-center">
              <ScoreRing score={confidence} size="sm" />
              <span className="text-[10px] text-gray-500 mt-1">Confidence</span>
            </div>
            <div className="flex flex-col items-center">
              <ScoreRing score={timingScore} size="sm" />
              <span className="text-[10px] text-gray-500 mt-1">Timing</span>
            </div>
            <div className="flex flex-col items-center">
              <ScoreRing score={riskScore} size="sm" />
              <span className="text-[10px] text-gray-500 mt-1">Risk</span>
            </div>
          </div>
        </div>

        {/* Signals Section */}
        <div className="mt-6 pt-6 border-t border-[#1e2738]">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between text-sm text-gray-400 hover:text-white transition-colors"
          >
            <span className="font-medium">Signal Details ({signals.bullish.length + signals.bearish.length + signals.neutral.length} signals)</span>
            <span>{showDetails ? '▲' : '▼'}</span>
          </button>

          {showDetails && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Bullish Signals */}
              <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/20">
                <h5 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">
                  <span>📈</span> Bullish ({signals.bullish.length})
                </h5>
                <ul className="space-y-1">
                  {signals.bullish.length > 0 ? signals.bullish.map((s, i) => (
                    <li key={i} className="text-xs text-emerald-300/80">• {s}</li>
                  )) : (
                    <li className="text-xs text-gray-500">No bullish signals</li>
                  )}
                </ul>
              </div>

              {/* Bearish Signals */}
              <div className="bg-rose-500/10 rounded-lg p-4 border border-rose-500/20">
                <h5 className="text-sm font-bold text-rose-400 mb-2 flex items-center gap-2">
                  <span>📉</span> Bearish ({signals.bearish.length})
                </h5>
                <ul className="space-y-1">
                  {signals.bearish.length > 0 ? signals.bearish.map((s, i) => (
                    <li key={i} className="text-xs text-rose-300/80">• {s}</li>
                  )) : (
                    <li className="text-xs text-gray-500">No bearish signals</li>
                  )}
                </ul>
              </div>

              {/* Neutral Signals */}
              <div className="bg-gray-500/10 rounded-lg p-4 border border-gray-500/20">
                <h5 className="text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
                  <span>➖</span> Neutral ({signals.neutral.length})
                </h5>
                <ul className="space-y-1">
                  {signals.neutral.length > 0 ? signals.neutral.map((s, i) => (
                    <li key={i} className="text-xs text-gray-400/80">• {s}</li>
                  )) : (
                    <li className="text-xs text-gray-500">No neutral signals</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Trade Checklist */}
        <div className="mt-6 pt-6 border-t border-[#1e2738]">
          <h4 className="text-sm font-bold text-gray-400 mb-3">Trade Checklist</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`p-3 rounded-lg ${confidence >= 60 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}>
              <span className="text-lg">{confidence >= 60 ? '✓' : '✗'}</span>
              <p className="text-xs text-gray-400 mt-1">Confidence ≥ 60%</p>
              <p className={`text-sm font-bold ${confidence >= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>{confidence}%</p>
            </div>
            <div className={`p-3 rounded-lg ${overallScore >= 65 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}>
              <span className="text-lg">{overallScore >= 65 ? '✓' : '✗'}</span>
              <p className="text-xs text-gray-400 mt-1">Score ≥ 65</p>
              <p className={`text-sm font-bold ${overallScore >= 65 ? 'text-emerald-400' : 'text-rose-400'}`}>{overallScore}/100</p>
            </div>
            <div className={`p-3 rounded-lg ${timingScore >= 70 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
              <span className="text-lg">{timingScore >= 70 ? '✓' : '⚠'}</span>
              <p className="text-xs text-gray-400 mt-1">Good Timing</p>
              <p className={`text-sm font-bold ${timingScore >= 70 ? 'text-emerald-400' : 'text-yellow-400'}`}>{analysis.tradingHours?.quality || 'N/A'}</p>
            </div>
            <div className={`p-3 rounded-lg ${!badge.text.includes('HOLD') ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}>
              <span className="text-lg">{!badge.text.includes('HOLD') ? '✓' : '✗'}</span>
              <p className="text-xs text-gray-400 mt-1">Clear Direction</p>
              <p className={`text-sm font-bold ${!badge.text.includes('HOLD') ? 'text-emerald-400' : 'text-rose-400'}`}>{badge.text}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

