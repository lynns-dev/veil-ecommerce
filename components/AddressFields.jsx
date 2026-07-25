import React from 'react';
import { T } from '../lib/theme';
import { fetchAddressSuggestions } from '../lib/addressAutocomplete';

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
  'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

// Shared shipping/billing address form used by checkout.jsx,
// checkout-qb.jsx, and offer3.jsx — previously duplicated near-
// identically in each file; pulled out here so the Address-field
// autocomplete below only needs to be built (and fixed, if it ever needs
// fixing) once.
//
// Autocomplete: typing 4+ characters into the Address field debounces a
// lookup (lib/addressAutocomplete.js, Mapbox's Geocoding API) and shows a dropdown of
// matching full addresses below the field; selecting one fills
// address/city/state/zip in one action. Manual typing always still works
// whether or not autocomplete returns anything (no key set, network
// failure, no matches) — this only ever adds a shortcut, never blocks the
// plain form fields underneath it.
//
// inputStyle: passed in by each page rather than imported from a shared
// constant, since each page's `input` style is defined locally (though
// currently identical in shape/values across all three) — keeps this
// component decoupled from any one page's style module.
// rowClass2/rowClass3: the CSS grid classes each page defines in its own
// <style jsx> block for the two-column (name) and three-column
// (city/state/zip) rows — named differently per page (offer3.jsx uses an
// "o3-" prefix to avoid colliding with its own other grids), so these are
// passed in rather than hardcoded.
export default function AddressFields({
  value, onChange, idPrefix, inputStyle,
  rowClass2 = 'row-2', rowClass3 = 'row-3',
}) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const section = idPrefix === 'bill' ? 'billing' : 'shipping';

  const [suggestions, setSuggestions] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const debounceRef = React.useRef(null);
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  React.useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleAddressChange = (e) => {
    const raw = e.target.value;
    onChange({ ...value, address: raw });
    clearTimeout(debounceRef.current);
    if (raw.trim().length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await fetchAddressSuggestions(raw);
      setSuggestions(results);
      setOpen(results.length > 0);
    }, 250);
  };

  const handleSelect = (suggestion) => {
    onChange({
      ...value,
      address: suggestion.address,
      city: suggestion.city,
      state: suggestion.state,
      zip: suggestion.zip,
    });
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <>
      <div className={rowClass2}>
        <input placeholder="First name" value={value.firstName} onChange={set('firstName')} style={inputStyle} autoComplete={`${section} given-name`} required />
        <input placeholder="Last name" value={value.lastName} onChange={set('lastName')} style={inputStyle} autoComplete={`${section} family-name`} required />
      </div>
      <div ref={wrapRef} style={{ position: 'relative', marginTop: 8 }}>
        <input
          placeholder="Address"
          value={value.address}
          onChange={handleAddressChange}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          style={inputStyle}
          autoComplete={`${section} address-line1`}
          required
        />
        {open && (
          <ul style={suggestionList}>
            {suggestions.map((s, i) => (
              <li key={`${s.label}-${i}`}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelect(s)} style={suggestionItem}>
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input placeholder="Apartment, suite, etc. (optional)" value={value.apt} onChange={set('apt')} style={{ ...inputStyle, marginTop: 8 }} autoComplete={`${section} address-line2`} />
      <div className={rowClass3} style={{ marginTop: 8 }}>
        <input placeholder="City" value={value.city} onChange={set('city')} style={inputStyle} autoComplete={`${section} address-level2`} required />
        <select value={value.state} onChange={set('state')} style={inputStyle} autoComplete={`${section} address-level1`} required>
          <option value="">State</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="ZIP code" value={value.zip} onChange={set('zip')} style={inputStyle} autoComplete={`${section} postal-code`} required />
      </div>
      <input
        placeholder="Phone (optional)"
        value={value.phone}
        onChange={set('phone')}
        style={{ ...inputStyle, marginTop: 8 }}
        autoComplete={`${section} tel`}
        id={idPrefix ? `${idPrefix}-phone` : undefined}
      />
    </>
  );
}

const suggestionList = {
  listStyle: 'none', margin: 0, padding: 4, position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
  background: T.white, border: `1px solid ${T.line}`, borderRadius: 4, boxShadow: '0 8px 20px rgba(22,20,15,0.12)',
  maxHeight: 220, overflowY: 'auto',
};
const suggestionItem = {
  display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none',
  cursor: 'pointer', fontFamily: T.sans, fontSize: 14, color: T.ink, borderRadius: 3,
};
