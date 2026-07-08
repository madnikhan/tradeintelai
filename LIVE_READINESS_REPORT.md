# Live Production Readiness Report

Generated: 2026-07-08T02:13:15.262Z

## Executive verdict

| Tier | Status |
|------|--------|
| Infrastructure | Infrastructure APPROVED |
| Demo manual testing | CONDITIONALLY APPROVED — complete MANUAL items in report |
| Live manual (0.01 lot) | NOT APPROVED — complete 2–4 week demo track first |
| Live autotrading | NOT APPROVED — semi-manual system; requires human Execute + open browser for Position Watch |

## Section results

| Section | Status | Notes |
|---------|--------|-------|
| Automated audit (audit:quick) | PASS | exit 0 |
| validate:production | PASS | exit 0 |
| Trade/Scan engine parity (EURUSD) | PASS | Scan vs Trade comparison |
| Trade tab — Gates 1-4 UI render | MANUAL | Analyze EURUSD in browser with chart visible |
| Trade tab — demo execute 0.01 lot | MANUAL | Execute from Trade/Scan if executable; confirm MT5 order |
| Position Watch SL/TP tracking | MANUAL | Keep dashboard tab open after execute |
| Scan major pairs (6 forex/metals) | PASS | 0/6 executable — verify badges in Scan tab UI |
| Demo → Live readiness | FAIL | 4 Profitable Weeks; Min 20 closed trades |
|   Goal: 4 Profitable Weeks | FAIL | 0 / 4 (target 4) |
|   Goal: Win Rate ≥ 60% | FAIL | 0.0% (target 60%) |
|   Goal: Max Drawdown < 12% | PASS | 0.0% (target < 12%) |
|   Goal: Profit Factor > 1.8 | FAIL | 0.00 (target 1.8) |
|   Goal: Min 20 closed trades | FAIL | 0 (target 20) |
| HealthCheck — MT5 bridge | PASS | HTTP 200 |
| HealthCheck — Gemini proxy | PASS | Rate limited but reachable |
| HealthCheck — OpenAI proxy | PASS | HTTP 200 |
| Telegram bot token | PASS | Configured locally |
| Scalping panel UI toggle | MANUAL | Settings → Scalping — verify toggle on demo only |
| Islamic panel swap window | MANUAL | Settings → Islamic — verify countdown |
| Telegram trade-executed on execute | MANUAL | Execute demo trade → check DM + channel |
| Mobile approve deep link | MANUAL | Open ?approve=1&symbol=EURUSD&tab=trade on dashboard |
| Backtest signal sampling (Gate 1-4 on EURUSD) | WARN | All samples HOLD/blocked — expected without chart/GPT |
| 30-day backtest report | PASS | See reports/backtest-report.md — 0 trades = strict gates, not infra failure |
| Production /api/gemini/health | PASS | https://tradeintelai.vercel.app HTTP 429 |
| Production /api/openai/health | PASS | HTTP 200 |
| Production Telegram webhook route | PASS | HTTP 405 (405/403 expected without POST body) |
| Production tunnel bridge URL | MANUAL | Dashboard bridge_url must point to cloudflared/ngrok, not localhost |
| Stripe subscription flow | MANUAL | Test checkout on production with test card |

## Manual checklist (browser required)

| # | Action | Result |
|---|--------|--------|
| 1 | Sign in — dashboard loads | _user to confirm_ |
| 2 | SystemStatus — all header dots green | _user to confirm_ |
| 3 | Trade tab — Gates 1–4 render for EURUSD | _user to confirm_ |
| 4 | Execute 0.01 demo lot — MT5 confirms order | _user to confirm_ |
| 5 | Position Watch — tracks SL/TP with tab open | _user to confirm_ |
| 6 | Scan tab — executable badges match Gate 4 | _user to confirm_ |
| 7 | Performance — Demo Success Goals visible | _user to confirm_ |
| 8 | Settings — Scalping/Islamic/Telegram panels | _user to confirm_ |

## Live gate review

**Live manual test: NOT APPROVED** until Demo Success Goals are met (see Performance tab).

Required before live:
- 20+ closed demo trades
- 60%+ win rate
- Profit factor > 1.8
- Max drawdown < 12%
- 4 consecutive profitable weeks
- 10+ resolved gated analyses

**Live autotrading: NOT APPROVED** — system requires dashboard Execute; do not enable Scalping on live until 2+ stable demo weeks.