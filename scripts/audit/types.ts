export type TestStatus = 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';

export interface TestResult {
  phase: string;
  category: string;
  testName: string;
  status: TestStatus;
  duration: number;
  details?: unknown;
  error?: string;
  recommendation?: string;
}

export interface PrerequisitesResult {
  env: boolean;
  bridge: boolean;
  devServer: boolean;
  websocket: boolean;
  issues: string[];
  details: Record<string, string>;
}

export interface AuditOptions {
  skipBacktest: boolean;
  skipGpt: boolean;
  liveTrade: boolean;
  requireDevServer: boolean;
  deep: boolean;
  symbol: string;
  devServerUrl: string;
  bridgeUrl: string;
}

export interface AuditReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  options: AuditOptions;
  prerequisites: PrerequisitesResult;
  results: TestResult[];
  summary: {
    pass: number;
    fail: number;
    warning: number;
    skip: number;
    total: number;
  };
  exitCode: number;
}

export class AuditCollector {
  results: TestResult[] = [];

  async runTest(
    phase: string,
    category: string,
    testName: string,
    fn: () => Promise<unknown>,
    opts?: { required?: boolean; warnOnFail?: boolean }
  ): Promise<TestResult> {
    const start = Date.now();
    const required = opts?.required !== false;
    const warnOnFail = opts?.warnOnFail === true;
    try {
      const details = await fn();
      const result: TestResult = {
        phase,
        category,
        testName,
        status: 'PASS',
        duration: Date.now() - start,
        details,
      };
      this.results.push(result);
      console.log(`  ✅ ${testName} (${result.duration}ms)`);
      return result;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      const status: TestStatus = !required ? 'SKIP' : warnOnFail ? 'WARNING' : 'FAIL';
      const result: TestResult = {
        phase,
        category,
        testName,
        status,
        duration: Date.now() - start,
        error,
      };
      this.results.push(result);
      const icon = status === 'FAIL' ? '❌' : status === 'WARNING' ? '⚠️' : '⏭️';
      console.log(`  ${icon} ${testName}: ${error}`);
      return result;
    }
  }

  skip(phase: string, category: string, testName: string, reason: string): void {
    this.results.push({
      phase,
      category,
      testName,
      status: 'SKIP',
      duration: 0,
      details: reason,
    });
    console.log(`  ⏭️ ${testName}: ${reason}`);
  }

  getSummary() {
    const pass = this.results.filter((r) => r.status === 'PASS').length;
    const fail = this.results.filter((r) => r.status === 'FAIL').length;
    const warning = this.results.filter((r) => r.status === 'WARNING').length;
    const skip = this.results.filter((r) => r.status === 'SKIP').length;
    return { pass, fail, warning, skip, total: this.results.length };
  }

  hasFailures(): boolean {
    return this.results.some((r) => r.status === 'FAIL');
  }
}
