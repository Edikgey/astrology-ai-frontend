import React from 'react';
import { useBilling } from '../context/BillingContext';
import { useUsage } from '../context/UsageContext';
import { canManageStripe } from '../utils/billingEligibility';
import { formatPeriodDate } from './UsageModal';
import { SupportEmail } from './ServiceDisclosures';
import './SubscriptionManagement.css';

export default function SubscriptionManagement({ usage }) {
  const billing = useBilling();
  const { refreshUsage } = useUsage();
  const premium = usage?.plan === 'premium';
  const stripe = canManageStripe(usage);
  const end = formatPeriodDate(usage?.scheduled_cancel_at || usage?.current_period_end);
  if (!premium && !usage?.can_cancel_subscription && !usage?.cancel_at_period_end) return null;
  return <section className="subscription-management" aria-label="Управление подпиской">
    {usage.cancel_at_period_end && <p role="status">{premium
      ? `Продление отключено. Premium сохраняется${end ? ` до ${end} (UTC)` : ' до конца оплаченного периода'}.`
      : 'Подписка завершена. Действуют лимиты бесплатного плана.'}</p>}
    {stripe && <>
      <button type="button" className="button-secondary" disabled={billing.busy} onClick={billing.manageSubscription}>Управление подпиской</button>
      <p>Портал Stripe: подписка, счета, способ оплаты и отмена продления. Откроется в новой вкладке.</p>
    </>}
    {usage.payment_provider === 'lava' && premium && <p>Подписка обслуживается через Lava.top.</p>}
    {usage.can_cancel_subscription && <button type="button" className="button-secondary" disabled={billing.busy}
      onClick={billing.cancelLavaSubscription}>Отключить продление Lava</button>}
    {premium && !stripe && usage.payment_provider !== 'lava' && <>
      <p>Для этого Premium-аккаунта не подтверждена действующая подписка Stripe. По вопросам продления или отмены: <SupportEmail />.</p>
      <button type="button" className="button-secondary" disabled={billing.busy} onClick={refreshUsage}>Обновить данные подписки</button>
    </>}
  </section>;
}
