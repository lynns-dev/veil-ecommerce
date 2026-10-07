// Public Afterpay settings for the checkout button (lib/afterpay.js):
// whether it's on, and the order-total range Afterpay will finance.
import { afterpayConfig, getOrderLimits } from '../../../lib/afterpay';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!afterpayConfig().enabled) return res.status(200).json({ enabled: false });
  try {
    const { min, max } = await getOrderLimits();
    return res.status(200).json({ enabled: max > 0, min, max });
  } catch (err) {
    console.error('Afterpay config error:', err.message);
    return res.status(200).json({ enabled: false });
  }
}
