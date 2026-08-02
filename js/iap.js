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
    if (isUnlocked()) document.dispatchEvent(new CustomEvent('ec-pro-status', { detail: { unlocked: true } }));
    if (!isInTWA()) return;
    try { _svc = await window.getDigitalGoodsService(PLAY_BILLING); await restorePurchases(); }
    catch (e) { console.warn('[IAP]', e); }
  }

  async function restorePurchases() {
    if (!_svc) return false;
    try {
      const purchases = await _svc.listPurchases();
      if (purchases.some(p => p.itemId === SKU)) { setUnlocked(true); return true; }
    } catch (e) { console.warn('[IAP] restore error', e); }
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
