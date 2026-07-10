import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '../../components/Header';
import CartDrawer from '../../components/CartDrawer';
import ProductVisual from '../../components/ProductVisual';
import Marquee from '../../components/Marquee';
import Footer from '../../components/Footer';
import { PRODUCTS, getProductById } from '../../lib/products';
import { useCart } from '../../lib/useCart';
import { T, S } from '../../lib/theme';

const INGREDIENTS = 'Arrowroot powder, kaolin clay, rice bran powder, skin-safe mica, clean fragrance.';

const HOW_TO_USE = [
  ['After the bath', 'Press the puff into the powder. Scent lives best on warm, clean skin.'],
  ['Sweep where you’re noticed', 'Collarbones, shoulders, the backs of the knees. A veil, not a coat.'],
  ['Carry it through the day', 'Wear alone, or layer over perfume to extend it.'],
];

const BENEFITS = [
  ['Featherlight, all-day wear', 'Pressed into skin rather than sprayed — it holds all day without fading.'],
  ['Intimate, close-to-skin', 'Noticed only by those who lean in close, never the whole room.'],
  ['One jar, a full bottle’s wear', 'Each jar carries the wear of a full perfume bottle, for a fraction of the cost.'],
  ['Clean, simple ingredients', 'Arrowroot, kaolin clay, rice bran and mica — nothing else.'],
  ['A tactile ritual', 'Applied with a satin-ribbon puff, not a spray — slower, softer, more deliberate.'],
  ['Vegan-friendly formula', 'Cruelty-free, made without animal-derived ingredients.'],
];

// Drop video files into public/videos and add entries here (or per-product,
// if you'd rather curate which reels show on which page) to populate the
// reel carousel and story thumbnails below. Sections hide while empty.
const REEL_VIDEOS = [
  { src: '/videos/A_woman_in_her_early_40s_in_a__Seedance_20_58180.mp4' },
  { src: '/videos/Heres_the_clean_copy-paste_ver_Seedance_20_Fast_24635.mp4' },
  { src: '/videos/RAW_IPHONE_FOOTAGE_vertical_91_Seedance_20_Fast_48648.mp4' },
  { src: '/videos/Raw_iPhone_vertical_916_multip_Seedance_20_Fast_48184.mp4' },
  { src: '/videos/VEIL_ADS_In_a_direct-to-consumer_style_a_woman_with_dark_b2adepH-.mp4' },
];

const FAQS = [
  ['Will it stain clothing?', 'No — the featherlight powder presses into skin and brushes off fabric easily.'],
  ['How long does one jar last?', 'Most wearers get 150–200 uses per jar with daily application.'],
  ['Can I wear it with perfume?', 'Yes. Many wear it alone; others layer it over perfume to extend the scent.'],
  ['Is it safe for sensitive skin?', 'Yes. The formula is fragrance-forward but gentle enough for daily use.'],
  ['Is it vegan and cruelty-free?', 'Yes — every VEIL formula is vegan-friendly and never tested on animals.'],
  ['How do I apply it?', 'Press the puff into the powder, then sweep over collarbones, shoulders and the backs of knees.'],
];

export async function getStaticPaths() {
  return { paths: PRODUCTS.map((p) => ({ params: { id: p.id } })), fallback: false };
}
export async function getStaticProps({ params }) {
  return { props: { product: getProductById(params.id) || null } };
}

function AccordionRow({ title, open, onToggle, children }) {
  return (
    <div style={accordionRow}>
      <button onClick={onToggle} style={accordionHeader} aria-expanded={open}>
        <span>{title}</span>
        <span style={accordionIcon}>{open ? '−' : '+'}</span>
      </button>
      <div style={{ ...accordionBody, maxHeight: open ? 600 : 0, opacity: open ? 1 : 0, paddingBottom: open ? 24 : 0 }}>
        {children}
      </div>
    </div>
  );
}

export default function ProductPage({ product }) {
  const c = useCart();
  const router = useRouter();
  const [quantity, setQuantity] = React.useState(1);
  const [openSection, setOpenSection] = React.useState('scent-story');
  const [openFaq, setOpenFaq] = React.useState(null);
  const [openStory, setOpenStory] = React.useState(null);
  const images = React.useMemo(() => product?.images || [], [product]);
  const [activeImage, setActiveImage] = React.useState(images[0] || '');
  const [reviewData, setReviewData] = React.useState({ reviews: [], average: 0, count: 0 });
  const [reviewForm, setReviewForm] = React.useState({ rating: 5, text: '', author: '' });
  const [reviewSubmitting, setReviewSubmitting] = React.useState(false);
  const [reviewError, setReviewError] = React.useState('');
  const [reviewSubmitted, setReviewSubmitted] = React.useState(false);

  React.useEffect(() => {
    setActiveImage(images[0] || '');
  }, [images]);

  React.useEffect(() => {
    if (!product) return;
    fetch(`/api/reviews?productId=${product.id}`)
      .then((r) => r.json())
      .then((data) => setReviewData(data))
      .catch(() => {});
  }, [product]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError('');
    setReviewSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, ...reviewForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit review.');
      setReviewData((prev) => ({ reviews: [...prev.reviews, data.review], average: data.average, count: data.count }));
      setReviewForm({ rating: 5, text: '', author: '' });
      setReviewSubmitted(true);
    } catch (err) {
      setReviewError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (router.isFallback || !product) return null;

  const related = PRODUCTS.filter((p) => p.id !== product.id && p.id !== 'scent-trio').slice(0, 4);
  const trio = getProductById('scent-trio');
  const toggleSection = (key) => setOpenSection((cur) => (cur === key ? null : key));
  const toggleFaq = (i) => setOpenFaq((cur) => (cur === i ? null : i));

  const unitPrice = product.price;
  const lineTotal = (unitPrice * quantity).toFixed(2);

  const handleAdd = () => {
    c.add({ ...product, price: unitPrice }, quantity);
    setQuantity(1);
  };

  const handleAddTrio = () => trio && c.add(trio, 1);

  return (
    <div style={{ paddingBottom: 76 }}>
      <Header cartCount={c.count} onCartClick={() => c.setOpen(true)} />

      <section style={{ maxWidth: T.maxw, margin: '0 auto', padding: '22px 40px 0' }}>
        <Link href="/shop" style={{ ...S.label, display: 'inline-block', marginBottom: 30 }}>← Back to shop</Link>
      </section>

      {/* MAIN */}
      <section style={{ maxWidth: T.maxw, margin: '0 auto', padding: '0 40px 60px' }}>
        <div className="pdp-grid" style={grid}>
          <div className="pdp-gallery" style={gallery}>
            <div style={imgSide}>
              {product.badge && <span style={imageBadge}>{product.badge}</span>}
              {activeImage ? (
                <img src={activeImage} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <ProductVisual id={product.id} width={230} />
              )}
            </div>
            {images.length > 1 && (
              <div className="thumb-col" style={thumbCol}>
                {images.map((src, i) => (
                  <button
                    key={src}
                    onClick={() => setActiveImage(src)}
                    style={{ ...thumbBtn, borderColor: activeImage === src ? T.ink : T.line }}
                    aria-label={`Show image ${i + 1}`}
                    aria-current={activeImage === src}
                  >
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={infoCol}>
            <a href="#reviews" style={pdpRating}>
              {reviewData.count > 0 ? (
                <>
                  <span style={{ color: T.ink, letterSpacing: '2px' }}>{'★'.repeat(Math.round(reviewData.average))}{'☆'.repeat(5 - Math.round(reviewData.average))}</span>
                  {' '}{reviewData.average.toFixed(1)} · {reviewData.count} review{reviewData.count === 1 ? '' : 's'}
                </>
              ) : (
                'Be the first to review'
              )}
            </a>
            <h1 style={pdpTitle}>{product.name}</h1>
            <div style={pdpTagline}>{product.tagline}</div>
            <p style={pdpDesc}>{product.description}</p>

            {REEL_VIDEOS.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={storyRowCompact}>
                  {REEL_VIDEOS.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => setOpenStory((cur) => (cur === i ? null : i))}
                      style={{ ...storyThumb, borderColor: openStory === i ? T.ink : T.line }}
                      aria-label={`Open story ${i + 1}`}
                    >
                      <video src={v.src} muted preload="metadata" style={storyThumbVideo} />
                    </button>
                  ))}
                </div>
                {openStory !== null && (
                  <div style={storyViewerInline}>
                    <video
                      key={REEL_VIDEOS[openStory].src}
                      src={REEL_VIDEOS[openStory].src}
                      style={storyViewerVideo}
                      autoPlay
                      muted
                      loop
                      playsInline
                      controls
                    />
                    <button onClick={() => setOpenStory(null)} style={storyCloseBtn} aria-label="Close story">×</button>
                  </div>
                )}
              </div>
            )}

            <div style={pdpPrice}>${unitPrice} <span style={{ fontSize: 14, color: T.soft }}>· {product.size}</span></div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={qtyWrap}>
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} style={qtyBtn} aria-label="Decrease quantity">−</button>
                <span style={qtyValue}>{quantity}</span>
                <button onClick={() => setQuantity((q) => q + 1)} style={qtyBtn} aria-label="Increase quantity">+</button>
              </div>
              <button style={{ ...S.btnFill, flex: 1, justifyContent: 'center' }} onClick={handleAdd}>Add to cart — ${lineTotal}</button>
            </div>

            <div style={badgeRow}>Ships in 2–4 days · Vegan-friendly · Cruelty-free</div>

            {trio && product.id !== 'scent-trio' && (
              <div style={trioCard}>
                <div style={trioVisual}><ProductVisual id="scent-trio" images={trio.images} alt={trio.name} width={54} /></div>
                <div style={{ flex: 1 }}>
                  <div style={S.label}>Save with sets</div>
                  <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 18, marginTop: 4 }}>{trio.name}</div>
                  <div style={{ fontSize: 12, color: T.soft, marginTop: 2, textTransform: 'capitalize' }}>{trio.tagline}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: T.serif, fontSize: 17, marginBottom: 8 }}>${trio.price}</div>
                  <button onClick={handleAddTrio} style={trioAddBtn}>Add</button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              {product.notes && (
                <AccordionRow title="Scent story" open={openSection === 'scent-story'} onToggle={() => toggleSection('scent-story')}>
                  {Object.entries(product.notes).map(([k, v]) => (
                    <div key={k} style={noteRow}>
                      <span style={noteKey}>{k}</span>
                      <span style={noteVal}>{v}</span>
                    </div>
                  ))}
                </AccordionRow>
              )}
              <AccordionRow title="How to use" open={openSection === 'how-to-use'} onToggle={() => toggleSection('how-to-use')}>
                {HOW_TO_USE.map(([h, p], i) => (
                  <div key={i} style={{ marginBottom: i < HOW_TO_USE.length - 1 ? 18 : 0 }}>
                    <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 17, marginBottom: 4 }}>{h}</div>
                    <p style={{ fontSize: 13, color: T.soft, margin: 0 }}>{p}</p>
                  </div>
                ))}
              </AccordionRow>
              <AccordionRow title="Ingredients" open={openSection === 'ingredients'} onToggle={() => toggleSection('ingredients')}>
                <p style={{ fontSize: 14, color: T.soft, margin: 0 }}>{INGREDIENTS}</p>
              </AccordionRow>
            </div>
          </div>
        </div>
      </section>

      {/* NARRATIVE — dark pull quote */}
      <section style={{ ...narrowBand, background: T.ink, borderTop: `1px solid ${T.line}` }}>
        <div style={narrowWrap}>
          <p style={{ ...S.label, color: 'rgba(252,251,247,0.6)' }}>The scent, in full</p>
          <p style={{ ...narrative, color: T.white }}>{product.longDescription}</p>
        </div>
      </section>

      {/* REEL */}
      {REEL_VIDEOS.length > 0 && (
        <section style={{ ...band, borderTop: `1px solid ${T.line}` }}>
          <div style={{ ...S.wrap, textAlign: 'center' }}>
            <p style={S.label}>As worn</p>
            <h2 style={{ ...S.h2, marginTop: 12 }}>Real women, <span style={S.it}>smelling incredible.</span></h2>
            <div className="reel-track" style={reelTrack}>
              {REEL_VIDEOS.map((v, i) => (
                <video
                  key={i}
                  className="reel-item"
                  style={reelItem}
                  src={v.src}
                  poster={v.poster}
                  muted
                  loop
                  playsInline
                  autoPlay
                  controls
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* BENEFITS */}
      <section style={{ ...narrowBand, background: T.paper, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
        <div style={narrowWrap}>
          <p style={S.label}>Why you’ll love it</p>
          {BENEFITS.map(([h, p], i) => (
            <div key={i} style={benefitRow}>
              <span style={benefitNum}>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 19, marginBottom: 6 }}>{h}</div>
                <p style={{ fontSize: 14, color: T.ink, margin: 0, maxWidth: '52ch' }}>{p}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* REVIEWS */}
      <section id="reviews" style={narrowBand}>
        <div style={{ ...narrowWrap, textAlign: 'center' }}>
          <p style={S.label}>The verdict</p>
          <h2 style={{ ...S.h2, marginTop: 12, fontSize: 'clamp(26px,3vw,36px)' }}>Worn close, <span style={S.it}>adored quietly.</span></h2>
          {reviewData.count > 0 && (
            <div style={{ marginTop: 20, fontSize: 12, color: T.soft, letterSpacing: '0.04em' }}>
              <span style={{ color: T.ink, letterSpacing: '1.5px' }}>{'★'.repeat(Math.round(reviewData.average))}{'☆'.repeat(5 - Math.round(reviewData.average))}</span>
              {' '}{reviewData.average.toFixed(1)} average · {reviewData.count} review{reviewData.count === 1 ? '' : 's'}
            </div>
          )}
          <div style={{ marginTop: 30 }}>
            {reviewData.count === 0 && (
              <p style={{ color: T.soft, fontSize: 14, padding: '20px 0' }}>No reviews yet — be the first.</p>
            )}
            {reviewData.reviews.slice().reverse().map((r, i) => (
              <div key={r.id} style={{ ...reviewRow, borderTop: i === 0 ? 'none' : `1px solid ${T.line}` }}>
                <div style={{ color: T.ink, letterSpacing: '1.5px', fontSize: 12, marginBottom: 10 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                <p style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 18, lineHeight: 1.4, marginBottom: 10 }}>“{r.text}”</p>
                <cite style={{ fontStyle: 'normal', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.soft }}>{r.author}</cite>
              </div>
            ))}
          </div>

          <div style={reviewFormWrap}>
            <p style={{ ...S.label, marginBottom: 16 }}>Write a review</p>
            {reviewSubmitted ? (
              <p style={{ color: T.ink, fontSize: 14 }}>Thank you — your review is live.</p>
            ) : (
              <form onSubmit={handleReviewSubmit} style={{ textAlign: 'left', maxWidth: 420, margin: '0 auto' }}>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewForm({ ...reviewForm, rating: n })}
                      style={starBtn}
                      aria-label={`${n} star${n === 1 ? '' : 's'}`}
                    >
                      {n <= reviewForm.rating ? '★' : '☆'}
                    </button>
                  ))}
                </div>
                <textarea
                  placeholder="Share your experience with this scent…"
                  value={reviewForm.text}
                  onChange={(e) => setReviewForm({ ...reviewForm, text: e.target.value })}
                  style={reviewTextarea}
                  required
                />
                <input
                  placeholder="Your name"
                  value={reviewForm.author}
                  onChange={(e) => setReviewForm({ ...reviewForm, author: e.target.value })}
                  style={{ ...reviewInput, marginTop: 12 }}
                />
                {reviewError && <p style={{ color: '#a13d2b', fontSize: 13, marginTop: 12 }}>{reviewError}</p>}
                <button type="submit" disabled={reviewSubmitting} style={{ ...S.btnFill, width: '100%', justifyContent: 'center', marginTop: 16, opacity: reviewSubmitting ? 0.6 : 1 }}>
                  {reviewSubmitting ? 'Submitting…' : 'Submit review'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={narrowBand}>
        <div style={narrowWrap}>
          <p style={S.label}>Questions</p>
          <h2 style={{ ...S.h2, marginTop: 12, fontSize: 'clamp(26px,3vw,36px)' }}>Before you order.</h2>
          <div style={{ marginTop: 30 }}>
            {FAQS.map(([q, a], i) => (
              <AccordionRow key={i} title={q} open={openFaq === i} onToggle={() => toggleFaq(i)}>
                <p style={{ fontSize: 14, color: T.soft, margin: 0 }}>{a}</p>
              </AccordionRow>
            ))}
          </div>
        </div>
      </section>

      {/* RELATED */}
      {related.length > 0 && (
        <section style={{ ...band, borderTop: `1px solid ${T.line}` }}>
          <div style={{ ...S.wrap, textAlign: 'center' }}>
            <p style={S.label}>Shop the full collection</p>
            <h2 style={{ ...S.h2, marginTop: 12 }}>More to <span style={S.it}>discover.</span></h2>
            <div className="related-grid" style={relatedGrid}>
              {related.map((p) => (
                <Link key={p.id} href={`/product/${p.id}`} className="related-item" style={relatedCard}>
                  <div style={relatedImg}><ProductVisual id={p.id} images={p.images} alt={p.name} width={104} /></div>
                  <div style={relatedText}>
                    <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 18 }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: T.soft, marginTop: 4 }}>${p.price}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Marquee />
      <Footer />

      <CartDrawer {...c} onClose={() => c.setOpen(false)} />

      {/* Floating add-to-cart bar */}
      <div style={stickyBar}>
        <div style={stickyBarInner}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 18, color: T.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
            <div style={{ fontSize: 13, color: 'rgba(252,251,247,0.7)', marginTop: 2 }}>${unitPrice}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={stickyQtyWrap}>
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} style={stickyQtyBtn} aria-label="Decrease quantity">−</button>
              <span style={{ ...qtyValue, color: T.white }}>{quantity}</span>
              <button onClick={() => setQuantity((q) => q + 1)} style={stickyQtyBtn} aria-label="Increase quantity">+</button>
            </div>
            <button onClick={handleAdd} style={stickyAddBtn}>Add to bag</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .pdp-grid { grid-template-columns: 1fr 1fr; }
        .related-grid { grid-template-columns: repeat(4, 1fr); }
        .related-item:nth-child(n + 2) { border-left: 1px solid ${T.line}; }
        .reel-track { scroll-snap-type: x mandatory; }
        .reel-item { scroll-snap-align: start; flex: 0 0 22%; }
        .thumb-col { flex-direction: column; }
        @media (max-width: 860px) {
          .reel-item { flex: 0 0 calc((100% - 40px) / 3); }
        }
        @media (max-width: 680px) {
          .pdp-grid { grid-template-columns: 1fr; }
          .pdp-gallery { flex-direction: column; }
          .thumb-col { flex-direction: row; }
          .related-grid { grid-template-columns: 1fr; }
          .related-item { border-left: none; }
          .related-item:nth-child(n + 2) { border-left: none; border-top: 1px solid ${T.line}; }
        }
      `}</style>
    </div>
  );
}

const grid = { display: 'grid', gap: 60, alignItems: 'start' };
const gallery = { display: 'flex', gap: 14 };
const imgSide = { position: 'relative', background: T.paper, aspectRatio: '4/5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.line}`, overflow: 'hidden', flex: 1, minWidth: 0 };
const imageBadge = {
  position: 'absolute', top: 14, right: 14, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: T.ink, background: 'rgba(252,251,247,0.92)', padding: '6px 10px', zIndex: 1, fontFamily: T.sans,
};
const thumbCol = { display: 'flex', gap: 10, flexShrink: 0 };
const thumbBtn = { width: 64, height: 64, padding: 0, border: '1px solid', cursor: 'pointer', overflow: 'hidden', background: 'none', flexShrink: 0 };
const infoCol = { position: 'sticky', top: 110 };
const pdpRating = {
  display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: T.soft, marginBottom: 14,
  fontFamily: T.sans, width: 'fit-content', borderBottom: `1px solid ${T.line}`, paddingBottom: 2,
};
const pdpTitle = { fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(34px,4.4vw,54px)', lineHeight: 1.02, marginBottom: 10 };
const pdpTagline = { fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft, marginBottom: 14 };
const pdpDesc = { fontSize: 15, color: '#4a453c', maxWidth: '46ch', marginBottom: 22, lineHeight: 1.6 };
const pdpPrice = { fontFamily: T.serif, fontWeight: 300, fontSize: 28, marginBottom: 22 };
const qtyWrap = { display: 'flex', alignItems: 'center', border: `1px solid ${T.line}`, height: 48 };
const qtyBtn = { width: 40, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, color: T.ink };
const qtyValue = { width: 30, textAlign: 'center', fontSize: 13 };
const badgeRow = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.soft, marginTop: 4 };

const trioCard = {
  display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${T.line}`,
  padding: '16px', marginTop: 24,
};
const trioVisual = { width: 54, height: 54, flexShrink: 0, overflow: 'hidden', background: T.paper };
const trioAddBtn = {
  fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', border: 'none', background: 'none',
  borderBottom: `1px solid ${T.ink}`, padding: '0 0 4px', cursor: 'pointer', fontFamily: T.sans,
};

const band = { padding: '64px 0' };
const narrowBand = { padding: '48px 0' };
const narrowWrap = { maxWidth: 720, margin: '0 auto', padding: '0 40px' };
const narrative = { fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(20px,2.4vw,26px)', lineHeight: 1.5, marginTop: 16 };

const accordionRow = { borderBottom: `1px solid ${T.line}` };
const accordionHeader = { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.sans, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink, textAlign: 'left' };
const accordionIcon = { fontSize: 16, color: T.soft, fontFamily: T.serif };
const accordionBody = { overflow: 'hidden', transition: 'max-height 0.35s ease, opacity 0.3s ease, padding-bottom 0.35s ease' };

const noteRow = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.line}` };
const noteKey = { fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.soft };
const noteVal = { fontFamily: T.serif, fontWeight: 300, fontSize: 16 };

const storyRowCompact = { display: 'flex', gap: 12, flexWrap: 'wrap' };
const storyThumb = {
  width: 56, height: 56, borderRadius: '50%', border: '2px solid', padding: 3, cursor: 'pointer',
  background: 'none', overflow: 'hidden', flexShrink: 0,
};
const storyThumbVideo = { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' };
const storyViewerInline = {
  position: 'relative', width: 200, marginTop: 16, paddingTop: 16, paddingBottom: 16,
  borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`,
};
const storyViewerVideo = { width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block', border: `1px solid ${T.line}` };
const storyCloseBtn = {
  position: 'absolute', top: -14, right: -14, width: 30, height: 30, borderRadius: '50%', background: T.ink,
  color: T.white, border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1,
};

const benefitRow = { display: 'flex', gap: 24, padding: '28px 0', borderTop: `1px solid ${T.line}` };
const benefitNum = { fontFamily: T.serif, fontStyle: 'italic', fontWeight: 300, fontSize: 20, color: T.soft, flex: '0 0 40px' };

const reviewRow = { padding: '26px 0', textAlign: 'left' };
const reviewFormWrap = { marginTop: 40, paddingTop: 40, borderTop: `1px solid ${T.line}` };
const starBtn = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 26, color: T.ink, lineHeight: 1, padding: 4 };
const reviewInput = {
  width: '100%', height: 46, padding: '0 14px', border: `1px solid ${T.line}`, background: T.white,
  fontFamily: T.sans, fontSize: 14, color: T.ink, outline: 'none', boxSizing: 'border-box',
};
const reviewTextarea = {
  width: '100%', minHeight: 100, padding: '12px 14px', border: `1px solid ${T.line}`, background: T.white,
  fontFamily: T.sans, fontSize: 14, color: T.ink, outline: 'none', boxSizing: 'border-box', resize: 'vertical',
};

const relatedGrid = { display: 'grid', marginTop: 50, border: `1px solid ${T.line}` };
const relatedCard = { textAlign: 'center', display: 'block', textDecoration: 'none', color: 'inherit' };
const relatedImg = { aspectRatio: '1/1', display: 'block', width: '100%', overflow: 'hidden' };
const relatedText = { padding: '16px 20px 40px' };

const reelTrack = { display: 'flex', gap: 20, overflowX: 'auto', marginTop: 44, paddingBottom: 6 };
const reelItem = { aspectRatio: '9/16', objectFit: 'cover', background: T.paper, border: `1px solid ${T.line}`, minWidth: 0, borderRadius: 10 };

const stickyBar = {
  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 150,
  background: T.ink, borderTop: `1px solid ${T.ink}`, boxShadow: '0 -1px 0 rgba(0,0,0,0.6)',
  padding: '14px 0',
};
const stickyBarInner = {
  maxWidth: T.maxw, margin: '0 auto', padding: '0 40px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
};
const stickyQtyWrap = { display: 'flex', alignItems: 'center', border: `1px solid ${T.dline}`, height: 40 };
const stickyQtyBtn = { width: 32, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: T.white };
const stickyAddBtn = {
  ...S.btnFill, background: T.white, color: T.ink, height: 40, padding: '0 22px',
};
