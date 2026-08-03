/* =====================================================
   TalkCalc IAP — Digital Goods API for TWA
   SKU: 'talkcalc_pro' — create in Play Console
===================================================== */
const EasyCalcIAP = (() => {
  'use strict';
  const SKU = 'talkcalc_pro';
  const PLAY_BILLING = 'https://play.google.com/billing';
  const KEY = 'talkcalc_pro_unlocked';

  let _svc = null;

  function isUnlocked() { return localStorage.getItem(KEY) === 'true'; }

  function setUnlocked(val) {
    localStorage.setItem(KEY, val ? 'true' : 'false');
    document.dispatchEvent(new CustomEvent('ec-pro-status', { detail: { unlocked: val } }));
  }

  function isInTWA() { return 'getDigitalGoodsService' in window; }

  async function init() {
    const already = isUnlocked();
    if (already) document.dispatchEvent(new CustomEvent('ec-pro-status', { detail: { unlocked: true } }));
    if (!isInTWA()) return;
    // Only announce the check when Pro is NOT already known locally — that is the
    // case that matters: a fresh install where a paying customer would otherwise
    // stare at padlocks while the Play round-trip is still in flight.
    if (!already) document.dispatchEvent(new CustomEvent('ec-pro-checking'));
    try {
      _svc = await window.getDigitalGoodsService(PLAY_BILLING);
      const owns = await restorePurchases();
      if (!already) document.dispatchEvent(new CustomEvent('ec-pro-checked', { detail: { owns } }));
    } catch (e) {
      console.warn('[IAP]', e);
      // Play unreachable (offline, service down). Never silently show a paywall to
      // someone who may have already paid — say so and offer Restore.
      if (!already) document.dispatchEvent(new CustomEvent('ec-pro-check-failed'));
    }
  }

  async function restorePurchases() {
    if (!_svc) return false;
    const purchases = await _svc.listPurchases();   // let errors reach the caller
    if (purchases.some(p => p.itemId === SKU)) { setUnlocked(true); return true; }
    return false;
  }

  async function purchase() {
    if (!isInTWA()) { toast('Purchases only available in the Android app.'); return false; }
    if (!_svc) {
      try { _svc = await window.getDigitalGoodsService(PLAY_BILLING); }
      catch (e) { toast('Google Play Billing not available.'); return false; }
    }
    const req = new PaymentRequest(
      [{ supportedMethods: PLAY_BILLING, data: { sku: SKU } }],
      { total: { label: 'TalkCalc Pro', amount: { currency: 'USD', value: '2.99' } } }
    );
    try {
      const res = await req.show();
      await _svc.acknowledge(res.details.purchaseToken, 'onetime');
      await res.complete('success');
      setUnlocked(true); return true;
    } catch (e) {
      if (e.name !== 'AbortError') toast('Purchase failed. Please try again.');
      return false;
    }
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#c0392b;color:#fff;padding:12px 24px;border-radius:12px;font-family:inherit;font-weight:700;font-size:0.95rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.3);white-space:nowrap';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  return { init, purchase, restorePurchases, isUnlocked, isInTWA };
})();

document.addEventListener('DOMContentLoaded', () => EasyCalcIAP.init());
