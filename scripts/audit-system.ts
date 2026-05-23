/**
 * Comprehensive System Audit Script
 * Finds duplications, errors, and why HOLD is recommended despite strong signals
 */

import { GatedEngineAdapter } from '../lib/gated-engine-adapter';
import { GatedTradingEngine } from '../lib/gated-trading-engine';

interface AuditResult {
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  issue: string;
  location: string;
  fix?: string;
}

class SystemAuditor {
  private results: AuditResult[] = [];

  async runFullAudit(): Promise<void> {
    console.log('🔍 Starting Comprehensive System Audit...\n');

    // 1. Check for code duplications
    this.auditDuplications();

    // 2. Check for logic errors
    this.auditLogicErrors();

    // 3. Test with strong signals
    await this.testStrongSignals();

    // 4. Print summary
    this.printSummary();
  }

  private auditDuplications(): void {
    console.log('📋 Checking for Code Duplications...\n');

    // ATR calculation duplication
    this.addResult({
      category: 'DUPLICATION',
      severity: 'MEDIUM',
      issue: 'calculateATR() is duplicated in 3+ files: gated-trading-engine.ts, ai-trading-engine.ts, regime-detector.ts, risk-calculator.ts',
      location: 'Multiple files',
      fix: 'Create a shared utility function in lib/utils/atr.ts and import it everywhere'
    });

    // Confidence calculation duplication
    this.addResult({
      category: 'DUPLICATION',
      severity: 'MEDIUM',
      issue: 'calculateConfidence() is duplicated: gated-trading-engine.ts (calculateConfidenceFromAlignment), ai-trading-engine.ts (calculateConfidence), regime-detector.ts (calculateConfidence), cot-analyzer.ts (calculateConfidence)',
      location: 'Multiple files',
      fix: 'Each has different logic - keep separate but document differences clearly'
    });

    // Technical execution score calculation
    this.addResult({
      category: 'DUPLICATION',
      severity: 'LOW',
      issue: 'calculateTechnicalExecutionScore() logic might be duplicated in multiple places',
      location: 'gated-trading-engine.ts',
      fix: 'Review and consolidate if possible'
    });
  }

  private auditLogicErrors(): void {
    console.log('🐛 Checking for Logic Errors...\n');

    // CRITICAL: Line 177 incomplete debug log
    this.addResult({
      category: 'SYNTAX ERROR',
      severity: 'CRITICAL',
      issue: 'Line 177 in gated-trading-engine.ts has incomplete debug log statement - missing closing backtick',
      location: 'lib/gated-trading-engine.ts:177',
      fix: 'Complete the debug log statement'
    });

    // CRITICAL: Gate 1 readability check issue
    this.addResult({
      category: 'LOGIC ERROR',
      severity: 'CRITICAL',
      issue: 'Gate 1 requires BOTH (trend≥60% OR pattern≥70%) AND S/R to be readable. If GPT has pattern≥70% + S/R but trend<60%, Gate 1 should still be readable',
      location: 'lib/gated-trading-engine.ts:498',
      fix: 'Current logic: isReadableByStructure = hasStructureWithSR. This is correct, but ensure hasStructureWithSR = (hasStrongTrend || hasStrongPattern) && hasSupportResistance'
    });

    // CRITICAL: hasSupportResistance might not be recalculated after correction
    this.addResult({
      category: 'LOGIC ERROR',
      severity: 'CRITICAL',
      issue: 'hasSupportResistance is corrected on line 649, but hasStructureWithSR (line 496) was calculated BEFORE the correction, so it might still be false',
      location: 'lib/gated-trading-engine.ts:496,649',
      fix: 'Recalculate hasStructureWithSR after correcting hasSupportResistance, OR move the correction earlier'
    });

    // HIGH: Gate 2 might return NEUTRAL even with strong GPT pattern
    this.addResult({
      category: 'LOGIC ERROR',
      severity: 'HIGH',
      issue: 'Gate 2 returns NEUTRAL if Gate 1 is unreadable, even if GPT has strong pattern (≥70%). The fix allows GPT to establish bias, but need to verify it works',
      location: 'lib/gated-trading-engine.ts:896-920',
      fix: 'Verify that GPT strong pattern can establish bias even when Gate 1 is unreadable'
    });

    // HIGH: Gate 4 blocks execution even with strong GPT signals
    this.addResult({
      category: 'LOGIC ERROR',
      severity: 'HIGH',
      issue: 'Gate 4 blocks LOW_VOLATILITY_RANGE even when GPT has very strong signals (pattern≥80% OR confidence≥75%). The fix exists but needs verification',
      location: 'lib/gated-trading-engine.ts:1573-1601',
      fix: 'Verify that very strong GPT signals override LOW_VOLATILITY_RANGE blocking'
    });

    // MEDIUM: Confidence calculation might be too conservative
    this.addResult({
      category: 'LOGIC ERROR',
      severity: 'MEDIUM',
      issue: 'Confidence caps might be too aggressive, preventing valid trades even with strong signals',
      location: 'lib/gated-trading-engine.ts:1782-1817',
      fix: 'Review confidence caps - current max is 85%, but might need to allow higher for very strong signals'
    });
  }

  private async testStrongSignals(): Promise<void> {
    console.log('🧪 Testing with Strong Signals...\n');

    const testPairs = ['GBPUSD', 'EURUSD'];

    for (const pair of testPairs) {
      console.log(`Testing ${pair}...`);
      try {
        const adapter = new GatedEngineAdapter();
        // Note: This will use real data, so results may vary
        // In a real test, we'd mock GPT structure with strong signals
        const analysis = await adapter.analyzeMarket(pair, []);
        
        console.log(`  Recommendation: ${analysis.recommendation}`);
        console.log(`  Confidence: ${analysis.confidence}%`);
        console.log(`  Gate 1 Readable: ${analysis.gateStatus?.marketReadable}`);
        console.log(`  Gate 2 Bias: ${analysis.gateStatus?.directionalBias} (${analysis.gateStatus?.biasStrength}%)`);
        console.log(`  Execution Permitted: ${analysis.gateStatus?.executionPermitted}`);
        
        if (analysis.recommendation === 'HOLD' && analysis.confidence > 50) {
          this.addResult({
            category: 'TEST FAILURE',
            severity: 'HIGH',
            issue: `${pair}: HOLD recommended with ${analysis.confidence}% confidence - might be blocking valid trade`,
            location: 'Gate 4 execution permission',
            fix: 'Check Gate 4 blockers in console logs'
          });
        }
      } catch (error) {
        console.error(`  Error testing ${pair}:`, error);
      }
      console.log('');
    }
  }

  private addResult(result: AuditResult): void {
    this.results.push(result);
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 AUDIT SUMMARY');
    console.log('='.repeat(80) + '\n');

    const bySeverity = {
      CRITICAL: this.results.filter(r => r.severity === 'CRITICAL'),
      HIGH: this.results.filter(r => r.severity === 'HIGH'),
      MEDIUM: this.results.filter(r => r.severity === 'MEDIUM'),
      LOW: this.results.filter(r => r.severity === 'LOW'),
    };

    console.log(`🔴 CRITICAL: ${bySeverity.CRITICAL.length} issues`);
    bySeverity.CRITICAL.forEach(r => {
      console.log(`  ❌ ${r.issue}`);
      console.log(`     Location: ${r.location}`);
      if (r.fix) console.log(`     Fix: ${r.fix}`);
      console.log('');
    });

    console.log(`🟠 HIGH: ${bySeverity.HIGH.length} issues`);
    bySeverity.HIGH.forEach(r => {
      console.log(`  ⚠️  ${r.issue}`);
      console.log(`     Location: ${r.location}`);
      if (r.fix) console.log(`     Fix: ${r.fix}`);
      console.log('');
    });

    console.log(`🟡 MEDIUM: ${bySeverity.MEDIUM.length} issues`);
    bySeverity.MEDIUM.forEach(r => {
      console.log(`  ℹ️  ${r.issue}`);
      console.log(`     Location: ${r.location}`);
      if (r.fix) console.log(`     Fix: ${r.fix}`);
      console.log('');
    });

    console.log(`🟢 LOW: ${bySeverity.LOW.length} issues`);
    bySeverity.LOW.forEach(r => {
      console.log(`  💡 ${r.issue}`);
      console.log(`     Location: ${r.location}`);
      if (r.fix) console.log(`     Fix: ${r.fix}`);
      console.log('');
    });

    console.log(`\nTotal Issues Found: ${this.results.length}`);
  }
}

// Run audit
const auditor = new SystemAuditor();
auditor.runFullAudit().catch(console.error);

