import React from 'react';
export default function StripeTrackingSync() {
 const [busy,setBusy]=React.useState(false),[message,setMessage]=React.useState('');
 async function sync(){setBusy(true);setMessage('');try{const r=await fetch('/api/admin/orders/stripe-tracking',{method:'POST'});const d=await r.json();if(!r.ok)throw new Error(d.error || 'Could not sync tracking.');setMessage(`Stripe tracking: ${d.synced} synced / ${d.fulfilledStripeOrders} fulfilled orders; ${d.pending} queued for retry.`);}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 return <div style={{marginBottom:16}}><button type="button" onClick={sync} disabled={busy} style={{padding:'10px 16px',cursor:'pointer'}}>{busy?'Syncing Stripe…':'Sync Stripe tracking'}</button>{message&&<p role="status" style={{fontSize:13,marginTop:8}}>{message}</p>}</div>;
}
