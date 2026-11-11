// Only public server-owned eligibility fields; provider identifiers stay on the server.
export function canManageStripe(usage) {
  return Boolean(usage?.plan === 'premium' && usage.payment_provider === 'stripe'
    && usage.can_manage_subscription === true
    && ['active', 'past_due'].includes(usage.subscription_status));
}
