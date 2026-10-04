# Site copy: open claims and conflicts

Raised during the October 2026 copy rewrite (homepage, shop intro, product
descriptions, application steps, FAQs). Each item needs a decision or
evidence before it goes back on the site, or stays.

The live site (veilpuff.com) couldn't be reached from the environment the
rewrite was done in, so every fact was taken from this repo. Spot-check the
deployed product pages against `lib/products.js` before publishing.

## Removed from the rewritten pages (restore only with evidence)

| Claim | Where it was | Why it's flagged |
|---|---|---|
| "Lingers / holds all day", "without fading" | Homepage hero, default SEO description, product "Why you'll love it" | No wear test on record. |
| "One jar carries the wear of a full perfume bottle" | Homepage "honest math", product benefits | Unmeasured comparison. |
| Luxury perfume "$150–300 … fades by afternoon … scents the whole room" | Homepage "honest math" (section removed) | Unsupported comparison with other products. |
| "Most wearers get 150–200 uses per jar" | Product FAQ | No usage data on record. |
| "Is it safe for sensitive skin? Yes." | Product FAQ | Skin-safety claim. Now shows the ingredient list and suggests a patch test. |
| Grand Puff "kind to even sensitive skin", "hand-selected" | `lib/products.js` | Same as above; "hand-selected" unverifiable. |
| "Will it stain clothing? No." | Product FAQ | Untested; the formula contains mica. Now says to let it settle before dressing. |
| "Layer over perfume to extend it" | Application steps | Extension effect unverified. Layering itself is still suggested. |
| "Arrowroot, kaolin clay, rice bran and mica — nothing else" | Product benefits | Contradicted the ingredient list, which includes fragrance. |
| "Real women, smelling incredible." | Product page video heading | The video filenames (`…Seedance…`) suggest AI-generated footage. If so, don't present them as real customers, and consider labelling them. |

## Conflicts in product facts (please confirm)

- **Original scent structure.** The old long description said the scent
  "opens with hinoki", but the notes table lists bergamot and citrus zest as
  top notes and hinoki in the base. The rewrite follows the notes table.
  Confirm it's right.
- **Is a puff included?** Product pages say every jar "comes with the Veil
  Luxury Puff", but the cart offers every shopper the $10 Grand Puff. If the
  included puff is a different, standard puff, say so on the product page.
- **Shipping time.** Product pages said "Ships in 2–4 days"; the shipping
  policy says orders ship within 1 business day and arrive in 3–5 business
  days. The product page and `/scent` now follow the policy.
- **Newsletter form.** The homepage sign-up promises 15% off the first
  order but doesn't submit anywhere. Its `onSubmit` only prevents the
  default. Wire it up or remove the offer.

## Still on the site, outside this rewrite (review separately)

- `components/ScentComparisonGraphic.jsx` (shown on every scent's product
  page): a chart of spray perfume fading against Veil holding, plus "Spray
  perfume evaporates in minutes — can dry skin". Unsupported comparison.
- `pages/offer.jsx`: written as a first-person customer story ("The math is
  what actually sold me", "It held through a full day"). If this isn't a
  real customer's account, it's a fabricated testimonial. Also repeats the
  $150–300, full-bottle, all-day and "four ingredients, nothing else" claims.
- `pages/offer2.jsx`, `pages/switch-to-veil.jsx`, `pages/scent.jsx`: the
  same all-day, fades-by-afternoon and full-bottle claims.
- `components/Marquee.jsx`: "Made in Los Angeles". Confirm.
- `lib/products.js` `wear` / `finish` fields still say "The wear of a full
  perfume bottle" and "holds all day". They aren't displayed on the
  storefront today, but anything that starts rendering them will repeat the
  claims.

## Kept, but worth having evidence on file

- Talc-free, vegan, cruelty-free (stated sitewide).
- "Worn close / noticed by the people near you": a description of the
  scent's character, not a measured claim.
- "Many of you have told us about a mother or grandmother who wore body
  powder": based on comments on the brand's posts. Keep it only while that
  stays true.
