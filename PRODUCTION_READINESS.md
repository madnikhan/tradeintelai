# Production Readiness Checklist

Use this list before switching from **demo** to **live**. No step alone guarantees profitability.

## 1. Bridge and MT5

- [ ] TradeIntel Bridge running locally or via tunnel
- [ ] `GET /health?mt5=1` returns `mt5_connected: true`
- [ ] EA attached with Algo Trading enabled
- [ ] Dashboard connected (`bridge_url` points at your tunnel, not Vercel)

## 2. Automated validation

```bash
npm run validate:production
```

- [ ] Unit tests pass (`npm test`)
- [ ] Scan vs Trade engine comparison runs without fatal errors
- [ ] Backtest report generated under `reports/` (use `--offline` in CI without MT5 data)

## 3. Demo account metrics

Configured in `config/trading-rules.ts` and enforced in **Go Live**:

| Criterion | Default |
|-----------|---------|
| Min closed trades | 20 |
| Win rate | ≥ 60% |
| Max drawdown | ≤ 12% |
| Profit factor | ≥ 1.8 |
| Consecutive profitable weeks | 4 |
| Resolved gated analyses | ≥ 10 |

Dashboard **Demo Success Goals** shows live progress from your trade history.

## 4. Accuracy loop

- [ ] Gated analyses saved on each Trade-tab analysis
- [ ] `actionTaken` + outcome updated when positions close (Position Watch or broker)
- [ ] Accuracy dashboard shows gated-engine outcomes (last 30 days)

## 5. Position monitoring (browser)

- [ ] **Open Trade Monitor** enabled on Trade tab while testing
- [ ] Smart exit rules reviewed in panel toggles
- [ ] Understand: monitoring stops when the browser tab is closed

## 6. Paper / demo period

- [ ] Minimum **2–4 weeks** on demo with the criteria above tracked weekly
- [ ] Journal of overrides and bridge outages

## 7. Legal and risk

- [ ] You accept that signals are **not guaranteed**
- [ ] Position sizing and max daily loss limits configured in Settings
- [ ] Live switch uses override only if you explicitly accept bypassing demo gates

---

**Go / no-go:** All sections 1–3 green, section 4–5 understood, section 6 timebox met, section 7 acknowledged.
