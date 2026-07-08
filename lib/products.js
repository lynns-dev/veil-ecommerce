export const PRODUCTS = [
  {
    id: 'citron',
    name: 'Citron Lumineaux',
    price: 45,
    image: 'https://cdn.shopify.com/s/files/1/0614/1234/5678/products/citron.jpg',
    category: 'fragrance',
    description: 'A bright citrus-forward fragrance that opens with luminous notes of bergamot and grapefruit, settling into a delicate base of white woods and amber.',
    longDescription: 'Citron Lumineaux captures the essence of sunlit afternoons — crisp, fresh, and entirely close to the skin. This featherlight powder infuses your body with a gentle citrus veil that lasts all day without projecting. Perfect for those who prefer their fragrance as an intimate secret.',
    notes: {
      top: 'Bergamot, Grapefruit, Lemon',
      middle: 'Neroli, Petitgrain, White Florals',
      base: 'Amber, Cedarwood, White Woods'
    },
    wear: 'The wear of a full perfume bottle',
    finish: 'Soft-focus, intimate scent noticed only by those who lean in close',
  },
  {
    id: 'original',
    name: 'Veil Original Scent',
    price: 45,
    image: 'https://cdn.shopify.com/s/files/1/0614/1234/5678/products/original.jpg',
    category: 'fragrance',
    description: 'The signature VEIL blend — a warm, refined fragrance that layers seamlessly into skin.',
    longDescription: 'The original scent that started it all. A masterfully balanced composition of florals, amber, and woods that feels both classic and modern. This is the fragrance that redefined what intimate perfume can be — pressed into the skin rather than projected into the air, it lasts all day with a soft-focus finish that draws people closer.',
    notes: {
      top: 'Mandarin, Bergamot, Black Currant',
      middle: 'Violet, Iris, Jasmine Sambac',
      base: 'Amber, Musk, Sandalwood'
    },
    wear: 'The wear of a full perfume bottle',
    finish: 'Melts in — holds all day with soft-focus finish',
  },
  {
    id: 'violette',
    name: 'Violette Ambrée',
    price: 45,
    image: 'https://cdn.shopify.com/s/files/1/0614/1234/5678/products/violette.jpg',
    category: 'fragrance',
    description: 'Notes of pear, plum, lily of the valley, violet, amber, and warm woods.',
    longDescription: 'A sophisticated floral fragrance with soft fruity undertones. Violette Ambrée opens with juicy pear and plum, unfolding into a lush garden of lily of the valley and violet, grounded by the warmth of amber and sandalwood. Designed for those who appreciate a more delicate, romantic scent.',
    notes: {
      top: 'Pear, Plum, Aldehydes',
      middle: 'Lily of the Valley, Violet, Iris',
      base: 'Amber, Warm Woods, Sandalwood'
    },
    wear: 'The wear of a full perfume bottle',
    finish: 'Delicate, close-to-skin fragrance',
  },
  {
    id: 'puff',
    name: 'Extra Large Luxury Body Puff',
    price: 10,
    image: 'https://cdn.shopify.com/s/files/1/0614/1234/5678/products/puff.jpg',
    category: 'accessory',
    description: 'Our signature soft applicator puff — perfect for applying VEIL fragrance powders.',
    longDescription: 'Hand-selected for softness and durability, our luxury body puff makes applying VEIL a tactile ritual. The extra-large size ensures even distribution across the body, and the gentle texture won\'t irritate even the most sensitive skin.',
    notes: null,
    wear: 'Essential application tool',
    finish: 'Soft, durable, reusable',
  },
  {
    id: 'jar',
    name: 'Veil Original Fragrance in Grand Jar',
    price: 64,
    image: 'https://cdn.shopify.com/s/files/1/0614/1234/5678/products/jar.jpg',
    category: 'fragrance',
    description: 'The signature VEIL Original Scent in our larger Grand Jar — more wear, same intimate finish.',
    longDescription: 'For those who love the Original Scent, the Grand Jar offers extended wear with the same meticulous formula. A larger format means more applications, more days of soft, intimate fragrance. This is the perfume that lasts like a full bottle, without the projection.',
    notes: {
      top: 'Mandarin, Bergamot, Black Currant',
      middle: 'Violet, Iris, Jasmine Sambac',
      base: 'Amber, Musk, Sandalwood'
    },
    wear: 'Multiple wears — the extended-wear option',
    finish: 'Melts in — holds all day with soft-focus finish',
  },
];

export const getProductById = (id) => PRODUCTS.find((p) => p.id === id);

export const getProductsByCategory = (category) => PRODUCTS.filter((p) => p.category === category);

export const getFeaturedProducts = () => PRODUCTS.slice(0, 3);
