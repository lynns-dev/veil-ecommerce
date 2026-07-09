// QuickBooks Payments client-side card tokenization.
//
// This loads Intuit's Web Payments SDK and converts raw card details into a
// one-time-use token in the browser, so the card number never touches our
// server (keeps the site out of full PCI card-data scope). The token is then
// sent to /api/qb-checkout, which charges it server-side via the QuickBooks
// Payments Charges API.
//
// IMPORTANT: the exact tokenize() call below follows Intuit's documented
// Web Payments SDK shape, but Intuit has changed this SDK's method names
// across versions. Once your app is approved for Payments in the Intuit
// Developer Dashboard, confirm this against the copy-paste snippet shown
// there (Payments > Web Payments SDK) before taking real charges, and
// adjust the loadScript URL / tokenize() call to match if it differs.

const SDK_URL = 'https://js.appcenter.intuit.com/Content/IPP/intuitpayments.js';

let scriptPromise = null;

function loadScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.intuit) return resolve(window.intuit);
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve(window.intuit);
    script.onerror = () => reject(new Error('Failed to load QuickBooks Payments SDK'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// card: { number, expMonth, expYear, cvc, name, postalCode }
// Resolves to a single-use card token string.
export async function tokenizeCard(card) {
  const intuit = await loadScript();
  if (!intuit || !intuit.ipp || !intuit.ipp.payments) {
    throw new Error('QuickBooks Payments SDK did not initialize as expected — verify lib/qbPayments.js against Intuit’s current Web Payments SDK docs.');
  }

  return new Promise((resolve, reject) => {
    intuit.ipp.payments.createToken(
      {
        card: {
          number: card.number.replace(/\s+/g, ''),
          expMonth: card.expMonth,
          expYear: card.expYear,
          cvc: card.cvc,
          name: card.name,
          address: { postalCode: card.postalCode },
        },
      },
      (response) => {
        if (response && response.token) resolve(response.token);
        else reject(new Error((response && response.error) || 'Card tokenization failed'));
      }
    );
  });
}
