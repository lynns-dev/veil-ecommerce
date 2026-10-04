// "Subscribe & Save" — single-jar fragrances only (not the trio set, not
// the puff accessory), recurring every 60 days at 15% off the plain
// catalog price.
export const SUBSCRIPTION_PRODUCT_IDS = ['original', 'citron', 'grand-jar', 'violette'];
export const SUBSCRIPTION_DISCOUNT_PERCENT = 15;
export const SUBSCRIPTION_CADENCE_DAYS = 60;

export function subscriptionPrice(price) {
  return Math.round(price * (1 - SUBSCRIPTION_DISCOUNT_PERCENT / 100) * 100) / 100;
}

// One ingredient list for every scented powder, shared by the product page,
// homepage, and shop so they can't drift apart.
export const INGREDIENTS = 'Arrowroot powder, kaolin clay, rice bran powder, skin-safe mica, clean fragrance.';

// Copy rules for every field below (see the site brief):
//   - Notes come only from that product's own `notes` — never borrowed from
//     another scent.
//   - `description` leads with what the product is, in plain words.
//   - `smellsLike` / `chooseIf` exist to make choosing between scents easy;
//     they paraphrase the notes and add no new claims.
//   - No longevity, "full bottle", or skin-safety claims until they're
//     substantiated.
export const PRODUCTS = [
  {
    id: 'original',
    name: 'Original Scented Fragrance Powder',
    price: 45,
    size: '4 oz',
    images: ['/images/veil-original-scent.png', '/images/veil-original-scent-2.png', '/images/veil-puff-model-white-robe.png'],
    video: '/videos/veil-how-to-use.mp4',
    category: 'fragrance',
    badge: 'Bestseller',
    tagline: 'jasmine · hinoki · vanilla',
    description: 'Perfume in powder form. Jasmine and soft florals over hinoki, santal, and warm vanilla, opening with a little bergamot. Sweep it onto skin with the puff.',
    longDescription: 'It opens bright, with bergamot and a little citrus zest. Then jasmine comes through, soft and floral. It settles into hinoki, santal, and warm vanilla — the part that stays on your skin. A warm, soft floral, finely milled and talc-free, worn close.',
    smellsLike: 'Warm and softly floral — jasmine resting on creamy woods and vanilla.',
    chooseIf: 'You love jasmine, vanilla, and fragrances that feel warm rather than sharp.',
    notes: {
      top: 'Bergamot · Citrus zest',
      middle: 'Jasmine · Soft floral petals',
      base: 'Hinoki · Santal · Warm vanilla',
    },
    wear: 'The wear of a full perfume bottle',
    finish: 'Melts in — holds all day with a soft-focus finish',
  },
  {
    id: 'citron',
    name: 'Citron Lumineaux',
    price: 45,
    size: '4 oz',
    images: ['/images/citron-main.png', '/images/veil-citron-two.png', '/images/citron-scent.png', '/images/veil-puff-model-white-robe.png'],
    video: '/videos/veil-how-to-use.mp4',
    category: 'fragrance',
    badge: '',
    tagline: 'bergamot · neroli · cedar',
    description: 'Perfume in powder form. Bergamot and grapefruit, then neroli and white florals, over cedar and white woods. Sweep it onto skin with the puff.',
    longDescription: 'It opens with bergamot and grapefruit, crisp and clean. Neroli, petitgrain, and white florals follow, light and green. Cedar and white woods hold it close to the skin. The brightest of the three — fresh where the Original is warm.',
    smellsLike: 'Bright and fresh — clean citrus over soft, pale woods.',
    chooseIf: 'You reach for citrus, neroli, or fresh, clean scents.',
    notes: {
      top: 'Bergamot · Grapefruit',
      middle: 'Neroli · Petitgrain · White florals',
      base: 'Cedar · White woods',
    },
    wear: 'The wear of a full perfume bottle',
    finish: 'Soft-focus, close-to-skin scent',
  },
  {
    id: 'grand-jar',
    name: 'Grand Jar',
    price: 64,
    size: '8 oz',
    images: ['/images/veil-grand-jar.png', '/images/veil-grand-jar-2.png', '/images/veil-puff-model-white-robe.png'],
    video: '/videos/veil-how-to-use.mp4',
    category: 'fragrance',
    badge: '',
    tagline: 'original · extended wear',
    description: 'The Original scent, in an 8 oz jar — twice the 4 oz size. Jasmine and soft florals over hinoki, santal, and warm vanilla.',
    longDescription: 'The same Original powder, in a larger jar. Bergamot and citrus zest at the opening, jasmine at the heart, hinoki, santal, and warm vanilla underneath. For anyone who already knows the Original is theirs.',
    smellsLike: 'The Original — warm jasmine, creamy woods, and vanilla.',
    chooseIf: 'The Original is already your scent and you want the larger jar.',
    notes: {
      top: 'Bergamot · Citrus zest',
      middle: 'Jasmine · Soft floral petals',
      base: 'Hinoki · Santal · Warm vanilla',
    },
    wear: 'Multiple wears — the extended-wear option',
    finish: 'Melts in — holds all day with a soft-focus finish',
  },
  {
    id: 'violette',
    name: 'Violette Ambrée',
    price: 45,
    size: '4 oz',
    images: ['/images/violette-scent-1.png', '/images/veil-puff-model-white-robe.png'],
    video: '/videos/veil-how-to-use.mp4',
    category: 'fragrance',
    badge: 'New',
    tagline: 'pear · lily of the valley · amber',
    description: 'Perfume in powder form. Pear and plum, then lily of the valley and violet, over amber and warm woods. Sweep it onto skin with the puff.',
    longDescription: 'It opens with crisp pear and dark plum. Lily of the valley and violet sit at the heart, delicate and floral. Amber and warm woods settle underneath. Our newest scent — fruit and flowers, softer and more romantic than the Original.',
    smellsLike: 'Soft fruit and flowers — pear and violet, warmed by amber.',
    chooseIf: 'You like fruity florals, violet, or something gentler and romantic.',
    notes: {
      top: 'Pear · Plum',
      middle: 'Lily of the Valley · Violet',
      base: 'Amber · Warm Woods',
    },
    wear: 'The wear of a full perfume bottle',
    finish: 'Soft, romantic, close-to-skin',
  },
  {
    id: 'scent-trio',
    name: 'The Scent Trio',
    price: 115,
    size: '3 × 4 oz',
    images: ['/images/scent-sampler.png', '/images/veil-puff-model-white-robe.png'],
    category: 'set',
    badge: 'Save $20',
    tagline: 'original · citron · violette',
    description: 'All three scents, one 4 oz jar of each: Original, Citron Lumineaux, and Violette Ambrée.',
    longDescription: 'One jar of each: the Original (warm jasmine and vanilla), Citron Lumineaux (bright citrus and white woods), and Violette Ambrée (pear, violet, and amber). For when you can\'t choose — or would rather not.',
    notes: null,
    wear: 'The wear of three full perfume bottles',
    finish: 'A scent for every mood',
  },
  {
    id: 'puff',
    name: 'The Grand Puff',
    price: 10,
    size: 'oversized',
    images: ['/images/large-puff.png', '/images/veil-puff-model-white-robe.png'],
    category: 'accessory',
    badge: '',
    tagline: 'oversized · reusable',
    description: 'An oversized puff for applying Veil powder. Soft, reusable, and oversized.',
    longDescription: 'The puff is how Veil goes on: press it into the powder, then sweep it across your skin. The Grand Puff is our oversized version — a spare, an upgrade, or one to keep by the bath.',
    notes: null,
    wear: 'Essential application tool',
    finish: 'Soft, durable, reusable',
  },
];

// A checkout-only free-gift offer — deliberately not part of PRODUCTS so it
// never shows up in the shop grid or search; it's only ever added via the
// timed offer on the checkout page.
export const TASSEL_GIFT = {
  id: 'tassel',
  name: 'Veil Scented Tassel',
  price: 15,
  size: 'one size',
  images: ['/images/veil-scented-tassel.png'],
  category: 'gift',
};

export const getProductById = (id) => PRODUCTS.find((p) => p.id === id);
export const getProductsByCategory = (category) => PRODUCTS.filter((p) => p.category === category);
export const getFeaturedProducts = () => PRODUCTS.filter((p) => ['original', 'citron', 'grand-jar', 'violette'].includes(p.id));
