// Public Amazon Pay button settings — just whether it's on and the two
// non-secret ids checkout.js needs to render the button (lib/amazonPay.js).
import { amazonPayConfig } from '../../../lib/amazonPay';

export default function handler(req, res) {
  const { enabled, merchantId, publicKeyId } = amazonPayConfig();
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(enabled ? { enabled, merchantId, publicKeyId } : { enabled: false });
}
