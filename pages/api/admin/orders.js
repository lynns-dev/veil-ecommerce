import { getRecentOrders } from '../../../lib/analyticsStore';
import { describeAdPlacement } from '../../../lib/attribution';
import { resolveAdObjectNames } from '../../../lib/metaAdsResolver';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const orders = await getRecentOrders(30, 200);

    // Some ads' URL tags carry Meta's id-based macro ({{adset.id}}/
    // {{ad.id}}) instead of the name-based one, so what actually got
    // captured at click time is a bare numeric id rather than something
    // readable — resolve those to real names here, server-side, since it
    // needs the Marketing API token (lib/metaAdsResolver.js), which must
    // never reach the browser. Resolved once per distinct id across the
    // whole batch rather than once per order — the same ad set is
    // typically behind many orders.
    const placements = orders.map((o) => describeAdPlacement(o.attribution));
    const idsToResolve = placements.flatMap((p) => [p.adset, p.ad]);
    const resolvedNames = await resolveAdObjectNames(idsToResolve);

    const ordersWithResolvedAds = orders.map((o, i) => {
      const { adset, ad } = placements[i];
      return {
        ...o,
        // Raw captured values (o.attribution) are untouched — these are
        // display-only additions admin's attributionSource() prefers when
        // present, falling back to the raw id if resolution ever failed
        // or isn't configured (see lib/metaAdsResolver.js's no-token path).
        resolvedAdset: adset ? resolvedNames.get(adset) ?? adset : null,
        resolvedAd: ad ? resolvedNames.get(ad) ?? ad : null,
      };
    });

    return res.status(200).json({ orders: ordersWithResolvedAds });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
