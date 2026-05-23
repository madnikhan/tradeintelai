# Stripe setup ($50/month)

## 1. Create product in Stripe Dashboard

1. **Product** → TradeIntel AI Pro
2. **Price** → $50 USD / month recurring
3. Copy **Price ID** → `STRIPE_PRICE_ID`

## 2. API keys

- **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Secret key** → `STRIPE_SECRET_KEY` (server only)

## 3. Webhook (local)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy signing secret → `STRIPE_WEBHOOK_SECRET`

Events to enable:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## 4. Vercel

Add the same env vars in Project Settings → Environment Variables.

Webhook endpoint: `https://YOUR-DOMAIN/api/stripe/webhook`

## 5. Test card

`4242 4242 4242 4242` — any future expiry, any CVC.

## 6. Dev bypass

```bash
SUBSCRIPTION_SKIP_IN_DEV=true
SUBSCRIPTION_BYPASS_EMAILS=your@email.com
```
