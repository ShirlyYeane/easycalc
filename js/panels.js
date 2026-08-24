(function () {
      'use strict';

      // ── Languages ──
      // ── Multi-language: parked for a future version ────────────────────────
      // Everything below still works — the vocabulary tables, number localisation and
      // the mic language are all intact and tested. Only the picker is hidden, and the
      // app is pinned to English, because spoken output also depends on the user having
      // that language's voice data installed on the phone, which the web layer cannot
      // check or install. To turn the feature back on, set this to true. Nothing else
      // needs changing.
      const LANG_PICKER_ENABLED = false;

      const LANGS = [
        { code: 'en', label: '🇬🇧 English', lang: 'en-US' },
        { code: 'auto', label: '🌐 Follow phone', lang: null },
        { code: 'es', label: '🇪🇸 Spanish', lang: 'es-ES' },
        { code: 'uk', label: '🇺🇦 Ukrainian', lang: 'uk-UA' },
        { code: 'id', label: '🇮🇩 Indonesian', lang: 'id-ID' },
        { code: 'fr', label: '🇫🇷 French', lang: 'fr-FR' },
        { code: 'de', label: '🇩🇪 German', lang: 'de-DE' },
      ];
      let selLang = LANG_PICKER_ENABLED ? (localStorage.getItem('talkcalc_lang') || 'auto') : 'en';
      // A language removed from the list could still be sitting in storage from an
      // earlier version, leaving no row selectable. Fall back to following the phone.
      if (LANG_PICKER_ENABLED && !LANGS.some(l => l.code === selLang)) {
        selLang = 'auto';
        try { localStorage.setItem('talkcalc_lang', selLang); } catch (e) { }
      }
      function getSpeechLang() {
        if (selLang === 'auto') return navigator.language || 'en-US';
        return LANGS.find(l => l.code === selLang)?.lang || 'en-US';
      }

      // ── Locale formatting ──
      const LOCALE_MAP = { 'en': 'en-US', 'auto': null, 'es': 'es-ES', 'uk': 'uk-UA', 'id': 'id-ID', 'fr': 'fr-FR', 'de': 'de-DE' };
      function getDisplayLocale() {
        if (selLang === 'auto') return navigator.language || 'en-US';
        return LOCALE_MAP[selLang] || 'en-US';
      }
      function formatDisplayNumber(raw) {
        if (!raw) return raw;
        const str = String(raw).trim();
        if (/[+\-×÷*/]/.test(str)) return str;
        if (str.endsWith('.')) return str;
        const num = parseFloat(str);
        if (isNaN(num)) return str;
        const decimalIdx = str.indexOf('.');
        const decimalDigits = decimalIdx >= 0 ? str.length - decimalIdx - 1 : 0;
        try {
          return num.toLocaleString(getDisplayLocale(), {
            minimumFractionDigits: decimalDigits,
            maximumFractionDigits: Math.max(decimalDigits, 10),
          });
        } catch (e) { return str; }
      }

      // ── Expose formatter for app.js hook ──
      window._tcFormatDisplay = function () {
        const disp = document.querySelector('.display-main');
        if (!disp) return;
        const raw = disp.textContent.trim();
        const formatted = formatDisplayNumber(raw);
        if (formatted && formatted !== raw) disp.textContent = formatted;

        // app.js picks the font size from the UNformatted string; separators add characters,
        // so re-scale against what is actually on screen or long results wrap onto a second
        // line and force the display box open.
        const shown = disp.textContent.trim();
        const cur = parseFloat(disp.style.fontSize);
        if (cur) {
          const step = n => n > 15 ? 0.4 : n > 12 ? 0.5 : n > 10 ? 0.6 : n > 8 ? 0.75 : 1;
          const base = cur / step(raw.length);          // undo app.js's scaling
          disp.style.fontSize = +(base * step(shown.length)).toFixed(3) + 'rem';
        }
        // Keep the secondary history line subordinate to the result. Capped rather than
        // fixed, so Normal/Large still follow the user's accessibility setting.
        const hist = document.querySelector('.history');
        const hf = hist && parseFloat(hist.style.fontSize);
        if (hf) hist.style.fontSize = Math.min(hf, 1.5) + 'rem';
      };

      // ── Conversions ──
      const CONV = {
        length: { units: ['km', 'm', 'cm', 'mm', 'miles', 'yards', 'feet', 'inches'], base: { km: 1000, m: 1, cm: 0.01, mm: 0.001, miles: 1609.344, yards: 0.9144, feet: 0.3048, inches: 0.0254 } },
        weight: { units: ['kg', 'g', 'mg', 'lb', 'oz', 'ton'], base: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495, ton: 1000 } },
      };
      function convertUnit(val, from, to, type) {
        return (parseFloat(val) * CONV[type].base[from]) / CONV[type].base[to];
      }
      // fmtConv: format a conversion result number with locale delimiter
      // Does NOT call formatDisplayNumber to avoid double-parsing issues
      function fmtConv(n) {
        if (Math.abs(n) >= 1e15) return n.toExponential(4);
        // Round to 6 significant decimal places to avoid float noise
        const rounded = parseFloat(n.toFixed(6));
        // Format with locale
        const decimalStr = rounded.toString();
        const decimalIdx = decimalStr.indexOf('.');
        const decimalDigits = decimalIdx >= 0 ? Math.min(decimalStr.length - decimalIdx - 1, 6) : 0;
        try {
          return rounded.toLocaleString(getDisplayLocale(), {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimalDigits,
          });
        } catch (e) { return decimalStr; }
      }

      // ── Currency ──
      // These 31 are the "Common" group pinned to the top of the dropdown, and they
      // double as the offline fallback: on a cold first run there are no rates yet,
      // so deriving the list purely from the API would leave the picker empty.
      const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF', 'CNY', 'IDR', 'INR', 'MYR', 'SGD', 'KRW', 'BRL', 'MXN', 'AED', 'SAR', 'TRY', 'ZAR', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'THB', 'PHP', 'VND', 'PKR', 'BDT'];
      let fxRates = null;

      // Every code we can actually convert right now (~161 once rates land).
      function fxAll() {
        if (!fxRates) return CURRENCIES.slice();
        const codes = Object.keys(fxRates).filter(c => /^[A-Z]{3}$/.test(c));
        return codes.length ? codes : CURRENCIES.slice();
      }
      // Intl.DisplayNames gives localised currency names for free — no 160-entry blob
      // to ship or maintain. Cached because building one per lookup is expensive.
      let _fxNamer, _fxNames = {};
      function fxName(code) {
        if (code in _fxNames) return _fxNames[code];
        let n = '';
        try {
          if (_fxNamer === undefined) _fxNamer = new Intl.DisplayNames([getDisplayLocale()], { type: 'currency' });
          if (_fxNamer) { n = _fxNamer.of(code) || ''; if (n === code) n = ''; }
        } catch (e) { _fxNamer = null; }
        _fxNames[code] = n;
        return n;
      }
      function fxOptionsHTML() {
        const all = fxAll(), set = new Set(all);
        const pinned = CURRENCIES.filter(c => set.has(c));
        const rest = all.filter(c => CURRENCIES.indexOf(c) === -1).sort();
        // Codes only, so the select stays narrow next to the amount field. Full names
        // are surfaced through the search box instead.
        const opt = c => '<option value="' + c + '">' + c + '</option>';
        let h = '<optgroup label="Common">' + pinned.map(opt).join('') + '</optgroup>';
        if (rest.length) h += '<optgroup label="All currencies">' + rest.map(opt).join('') + '</optgroup>';
        return h;
      }
      function updateFxCount() {
        const el = document.getElementById('pw-fx-count');
        if (el) el.textContent = fxAll().length;
      }
      async function loadFX() {
        const cached = localStorage.getItem('tc_fx'), ts = localStorage.getItem('tc_fx_ts');
        if (cached && ts && Date.now() - +ts < 3600000) { fxRates = JSON.parse(cached); updateFxNote('Rates from cache'); return; }
        try {
          const d = await (await fetch('https://open.er-api.com/v6/latest/USD')).json();
          if (d.rates) { fxRates = d.rates; localStorage.setItem('tc_fx', JSON.stringify(fxRates)); localStorage.setItem('tc_fx_ts', Date.now() + ''); updateFxNote('Live rates — ' + new Date().toLocaleDateString()); }
        } catch (e) { if (cached) { fxRates = JSON.parse(cached); updateFxNote('Offline — cached rates'); } else updateFxNote('Could not load rates'); }
      }
      function updateFxNote(msg) { const el = document.getElementById('fx-note'); if (el) el.textContent = msg; }
      function convertFX(val, from, to) {
        if (!fxRates) return null;
        if (from === to) return parseFloat(val);
        // An unknown code used to fall through as undefined and yield NaN, which the
        // formatter then rendered as a plausible-looking number. Fail loudly instead.
        if (!fxRates[from] || !fxRates[to]) return null;
        return parseFloat(val) / fxRates[from] * fxRates[to];
      }
      function fmtFX(n) {
        if (n === null || n === undefined) return null;
        const rounded = parseFloat(n.toFixed(4));
        try {
          return rounded.toLocaleString(getDisplayLocale(), { minimumFractionDigits: 0, maximumFractionDigits: 4 });
        } catch (e) { return String(rounded); }
      }

      // ── History & Notes ──
      const HK = 'tc_history';
      function getHist() { try { return JSON.parse(localStorage.getItem(HK)) || []; } catch { return []; } }
      function saveHist(a) { try { localStorage.setItem(HK, JSON.stringify(a.slice(0, 50))); } catch { } }
      function addHist(expr, result) {
        if (!result || result === '0' || result === 'Error') return;
        expr = (expr || '').trim(); result = (result || '').trim();
        if (!expr || !result) return;
        const a = getHist();
        if (a.length > 0 && a[0].expr === expr && a[0].result === result) return;
        a.unshift({ expr, result, ts: Date.now() }); saveHist(a);
      }

      // ── Scientific state ──
      // stack  — parked {prev,op} frames, one per open "("
      // tokens — history-line pieces for the expression being built
      // valTok — sci.val is already represented at the tail of tokens (came from ")" or a function)
      // opJust — a binary operator was the last key, so another one just swaps it
      let sci = {
        val: '0', hist: '', prev: null, op: null, isRad: true, inv: false,
        _reset: false, stack: [], tokens: [], valTok: false, opJust: false
      };
      function factorial(n) {
        if (n < 0 || !Number.isInteger(n)) return NaN;
        if (n === 0 || n === 1) return 1; if (n > 170) return Infinity;
        let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
      }

      // ── Build once ──
      let built = false, dataLoaded = false;
      function tryBuild() {
        const app = document.getElementById('app');
        if (!app || !app.querySelector('.calc-main')) { if (!built) setTimeout(tryBuild, 120); return; }
        if (built) return; built = true;
        // Storage is read once, not on every rebuild — buildUI now runs on each render.
        if (!dataLoaded) { dataLoaded = true; loadLists(); loadSaved(); }
        buildUI(app);
      }

      // The "All Features" card lives in app.js and only lists the free calculator.
      // Rewritten here so app.js stays untouched, and so the Pro section reflects
      // whether Pro is actually unlocked.
      const FEAT_FREE = [
        'Extra-large touch targets',
        'Voice input \u2014 speak calculations',
        'Text input \u2014 type naturally',
        'Voice output \u2014 hear every action',
        'Haptic vibration on press',
        '5 beautiful color themes',
        'Full keyboard navigation',
        'Screen reader (ARIA) support',
        'Adjustable text sizes',
        'Works offline (PWA)',
        'No ads, no tracking'
      ];
      const FEAT_PRO = [
        'Unit & currency converter (' + (typeof fxAll === 'function' ? fxAll().length + '' : '160+') + ' currencies)',
        'Percentage helper \u2014 tip, tax, markup',
        'Full scientific calculator',
        'Lists \u2014 groceries, rent, bill split',
        'Running totals with per-person split',
        'Add items by voice',
        'Save results from any tab',
        'Share a list as text'
      ];

      function patchFeatureList() {
        const isPro = typeof EasyCalcIAP !== 'undefined' && EasyCalcIAP.isUnlocked();
        const stamp = isPro ? 'pro' : 'free';
        const t = window.getTheme ? window.getTheme() : {};

        document.querySelectorAll('.settings-card').forEach(card => {
          const lab = card.querySelector('.settings-label');
          if (!lab || lab.textContent.indexOf('All Features') === -1) return;
          if (card.dataset.ecFeat === stamp) return;   // already correct for this state
          card.dataset.ecFeat = stamp;

          const body = lab.nextElementSibling;
          if (!body) return;
          body.textContent = '';

          const line = (text, dim) => {
            const d = document.createElement('div');
            d.textContent = '\u2022 ' + text;
            if (dim) d.style.opacity = '0.55';
            return d;
          };
          FEAT_FREE.forEach(f => body.appendChild(line(f, false)));

          const head = document.createElement('div');
          head.style.cssText = 'margin:10px 0 4px;font-weight:800;opacity:1;color:' + (t.accent || 'inherit');
          head.textContent = isPro ? '\u2B50 Pro \u2014 unlocked' : '\u2B50 Pro \u2014 locked';
          body.appendChild(head);

          FEAT_PRO.forEach(f => body.appendChild(line(f, !isPro)));

          if (!isPro) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = 'Unlock Pro';
            btn.style.cssText = 'margin-top:10px;border-radius:12px;border:2px solid ' + (t.accent || '#888') +
              ';background:transparent;color:' + (t.accent || 'inherit') +
              ';font-family:inherit;font-weight:800;font-size:0.9rem;padding:9px 14px;cursor:pointer;min-height:42px';
            btn.addEventListener('click', () => { try { showPaywall(); } catch (e) { } });
            body.appendChild(btn);
          }
        });
      }

      const _origRender = window.render;
      window.render = function () {
        _origRender && _origRender.apply(this, arguments);
        // Synchronously, before the browser paints. app.js's render() replaces the whole
        // of #app, which destroys the tab bar, every pro panel and the Save button.
        // Rebuilding them from a deferred callback meant one painted frame without any
        // of it — the flicker on every calculator keypress.
        try {
          if (!document.getElementById('ec-tabs')) { built = false; tryBuild(); }
          else { applyTheme(); }
          injectSaveButtons();
          patchFeatureList();
          updateTrialBars();
        } catch (e) {
          // Never let the pro layer break the calculator itself; retry on the next tick.
          setTimeout(() => {
            if (!document.getElementById('ec-tabs')) { built = false; tryBuild(); } else { applyTheme(); }
          }, 0);
        }
      };

      setTimeout(tryBuild, 250);

      function buildUI(app) {
        const calcMain = app.querySelector('.calc-main'); if (!calcMain) return;
        const isPro = typeof EasyCalcIAP !== 'undefined' && EasyCalcIAP.isUnlocked();

        const tabs = document.createElement('div');
        tabs.className = 'top-tabs'; tabs.id = 'ec-tabs';
        tabs.innerHTML = tabsHTML(isPro);
        const header = calcMain.querySelector('.header');
        if (header?.nextSibling) calcMain.insertBefore(tabs, header.nextSibling);
        else calcMain.appendChild(tabs);

        const calcPanel = document.createElement('div');
        calcPanel.id = 'ec-panel-calc';
        calcPanel.style.cssText = 'display:flex;flex-direction:column;flex:1;overflow:hidden;';
        Array.from(calcMain.children).filter(el => el !== header && el !== tabs).forEach(el => calcPanel.appendChild(el));
        calcMain.appendChild(calcPanel);

        [['convert', converterHTML()], ['pct', percentHTML()], ['sci', sciHTML()], ['notes', notesHTML()]].forEach(([id, inner]) => {
          const p = document.createElement('div');
          p.id = 'ec-panel-' + id; p.className = 'pro-panel';
          p.innerHTML = inner; calcMain.appendChild(p);
        });

        document.addEventListener('click', e => {
          if (e.target && e.target.id === 'settingsBtn') setTimeout(injectLangSettings, 200);
        }, true);

        patchVoice();
        patchHistoryCapture();
        bindListEvents();
        wireConverter(); loadFX(); wirePct();
        ecTab('calc');
        applyTheme();
        observeTheme();

        document.addEventListener('ec-pro-status', e => { updateProTabs(e.detail.unlocked); applyTheme(); });
      }

      function tabsHTML(isPro) {
        const lock = isPro ? '' : '🔒 ';
        return `
        <button class="top-tab" id="tab-calc"    onclick="ecTab('calc')">&#x1F522; Calc</button>
        <button class="top-tab" id="tab-convert" onclick="ecTab('convert')">${lock}📐 Convert</button>
        <button class="top-tab" id="tab-pct"     onclick="ecTab('pct')">${lock}% Percent</button>
        <button class="top-tab" id="tab-sci"     onclick="ecTab('sci')">${lock}🔬 Science</button>
        <button class="top-tab" id="tab-notes"   onclick="ecTab('notes')">${lock}🗂 Notes</button>`;
      }

      // ══ Free trial ═════════════════════════════════════════════════════════
      // Nobody pays for a feature they have only seen a screenshot of. Free users get
      // five real openings of the Pro tabs before the wall goes up.
      // Five tries PER TAB rather than five shared: exploring the converter shouldn't
      // eat the tries someone needs to give the shopping list a fair go.
      const TRIAL_LIMIT = 5, TRIAL_KEY = 'tc_trials';
      const PRO_TABS = ['convert', 'pct', 'sci', 'notes'];
      let trials = {};
      const trialGranted = new Set();   // per page load, so re-entering a tab is free
      try {
        const raw = JSON.parse(localStorage.getItem(TRIAL_KEY) || '{}');
        PRO_TABS.forEach(tb => {
          trials[tb] = Math.max(0, Math.min(TRIAL_LIMIT, parseInt(raw && raw[tb], 10) || 0));
        });
      } catch (e) { PRO_TABS.forEach(tb => { trials[tb] = 0; }); }
      function trialsLeft(tab) { return Math.max(0, TRIAL_LIMIT - (trials[tab] || 0)); }

      // While Play is being asked whether this account already owns Pro, and after that
      // lookup fails, the Pro tabs must not look like a plain paywall to someone who
      // has already paid — a reinstall wipes local storage, not the entitlement.
      let proChecking = false, proCheckFailed = false;
      document.addEventListener('ec-pro-checking', () => { proChecking = true; proCheckFailed = false; updateTrialBars(); });
      document.addEventListener('ec-pro-checked', () => { proChecking = false; proCheckFailed = false; updateTrialBars(); });
      document.addEventListener('ec-pro-check-failed', () => { proChecking = false; proCheckFailed = true; updateTrialBars(); });
      function isProNow() { return typeof EasyCalcIAP !== 'undefined' && EasyCalcIAP.isUnlocked(); }

      // Looking is free. Opening a tab costs nothing — a try is only spent the first
      // time you actually DO something there (type a number, press a key, add an item).
      function trialCanOpen(tab) { return trialGranted.has(tab) || trialsLeft(tab) > 0; }
      function trialUse(tab) {
        if (isProNow()) return;
        if (trialGranted.has(tab)) return;             // already counted this session
        if ((trials[tab] || 0) >= TRIAL_LIMIT) return;
        trials[tab] = (trials[tab] || 0) + 1;
        trialGranted.add(tab);
        try { localStorage.setItem(TRIAL_KEY, JSON.stringify(trials)); } catch (e) { }
        const left = trialsLeft(tab);
        showToast(left === 0 ? 'Last free try for this tab'
          : left + (left === 1 ? ' free try left here' : ' free tries left here'));
        updateTrialBars();
      }

      window.ecTab = function (tab) {
        const isPro = typeof EasyCalcIAP !== 'undefined' && EasyCalcIAP.isUnlocked();
        if (PRO_TABS.includes(tab) && !isPro && !trialCanOpen(tab)) { showPaywall(); return; }
        ['calc', 'convert', 'pct', 'sci', 'notes'].forEach(t => {
          const panel = document.getElementById('ec-panel-' + t);
          const btn = document.getElementById('tab-' + t);
          if (!panel || !btn) return;
          const active = t === tab;
          if (t === 'calc') { panel.style.display = active ? 'flex' : 'none'; panel.style.flexDirection = 'column'; panel.style.flex = '1'; panel.style.overflow = 'hidden'; }
          else { panel.classList.toggle('active', active); }
          styleTab(btn, active);
        });
        if (tab === 'sci') { setTimeout(renderSciGrid, 30); setTimeout(() => { const d = document.getElementById('sci-disp'); if (d) d.focus(); }, 60); }
        if (tab === 'notes') renderNotes();
        updateTrialBars();
      };

      // A thin strip at the top of each Pro panel, so the trial is visible while it is
      // being spent rather than only when it runs out.
      function updateTrialBars() {
        const isPro = typeof EasyCalcIAP !== 'undefined' && EasyCalcIAP.isUnlocked();
        const t = window.getTheme ? window.getTheme() : {};
        PRO_TABS.forEach(tab => {
          const panel = document.getElementById('ec-panel-' + (tab === 'pct' ? 'pct' : tab));
          if (!panel) return;
          let bar = panel.querySelector('.trial-bar');
          if (isPro) { if (bar) bar.remove(); return; }
          if (!bar) {
            bar = document.createElement('div');
            bar.className = 'trial-bar';
            const msg = document.createElement('span'); msg.className = 'msg';
            const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'go';
            btn.textContent = 'Unlock Pro';
            btn.addEventListener('click', () => {
              try { proCheckFailed ? ecRestorePurchase() : showPaywall(); } catch (e) { }
            });
            bar.appendChild(msg); bar.appendChild(btn);
            panel.insertBefore(bar, panel.firstChild);
          }
          const msgEl = bar.querySelector('.msg'), goEl = bar.querySelector('.go');
          if (proChecking) {
            msgEl.textContent = 'Checking your purchase\u2026';
            goEl.style.display = 'none';
          } else if (proCheckFailed) {
            msgEl.textContent = 'Couldn\u2019t reach Google Play. Already bought Pro?';
            goEl.textContent = 'Restore';
            goEl.style.display = '';
          } else {
            const left = trialsLeft(tab);
            msgEl.textContent =
              left > 0 ? 'Free trial \u00B7 ' + left + ' of ' + TRIAL_LIMIT + ' left on this tab'
                : 'Free trial finished for this tab';
            goEl.textContent = 'Unlock Pro';
            goEl.style.display = '';
          }
          bar.style.background = t.accent + '18';
          bar.style.borderColor = t.accent + '55';
          bar.style.color = t.btnText;
          bar.querySelector('.go').style.color = t.displayText || t.accent;
        });
      }

      function styleTab(btn, active) {
        btn.style.opacity = active ? '1' : '0.52';
        btn.style.background = active ? 'rgba(255,255,255,0.13)' : 'transparent';
      }

      function updateProTabs(isPro) {
        const lock = isPro ? '' : '🔒 ';
        const map = { 'tab-convert': `${lock}📐 Convert`, 'tab-pct': `${lock}% Percent`, 'tab-sci': `${lock}🔬 Science`, 'tab-notes': `${lock}🗂 Notes` };
        Object.entries(map).forEach(([id, label]) => { const el = document.getElementById(id); if (el) el.textContent = label; });
      }

      // ── Paywall ──
      function showPaywall() {
        const overlay = document.getElementById('ec-paywall');
        const sheet = document.getElementById('pw-sheet');
        const feats = document.getElementById('pw-features');
        const buyBtn = document.getElementById('pw-buy-btn');
        const t = window.getTheme ? window.getTheme() : {};
        if (sheet) { sheet.style.background = t.bg || '#0B1929'; sheet.style.color = t.btnText || '#E6F1FF'; }
        if (feats) feats.style.borderColor = t.btnBorder || '#2D5986';
        if (buyBtn) { buyBtn.style.background = t.equalsBg || '#64FFDA'; buyBtn.style.color = t.equalsText || '#0B1929'; }
        document.querySelectorAll('.pw-close,.pw-restore').forEach(el => el.style.color = t.btnText || '#E6F1FF');
        overlay?.classList.add('show');
      }
      window.ecClosePaywall = function () { document.getElementById('ec-paywall')?.classList.remove('show'); };
      window.ecStartPurchase = async function () {
        const btn = document.getElementById('pw-buy-btn');
        if (btn) { btn.textContent = 'Processing\u2026'; btn.disabled = true; }
        const ok = await EasyCalcIAP.purchase();
        if (ok) ecClosePaywall();
        else if (btn) { btn.textContent = 'Unlock Pro \u2014 $2.99'; btn.disabled = false; }
      };
      window.ecRestorePurchase = async function () {
        const btn = document.querySelector('.pw-restore');
        const reset = msg => {
          if (!btn) return;
          btn.textContent = msg;
          setTimeout(() => { if (btn) { btn.textContent = 'Restore previous purchase'; btn.disabled = false; } }, 3000);
        };
        if (btn) { btn.textContent = 'Checking\u2026'; btn.disabled = true; }
        let ok = false;
        try {
          ok = await EasyCalcIAP.restorePurchases();
        } catch (e) {
          // Offline or Play unavailable. "No purchase found" would be a lie here, and
          // the worst possible thing to tell someone who has already paid.
          proCheckFailed = true; updateTrialBars();
          reset('Couldn\u2019t reach Google Play');
          return;
        }
        if (ok) { proCheckFailed = false; ecClosePaywall(); }
        else reset('No purchase found');
      };

      // ── Converter ──
      function converterHTML() {
        return `
        <div class="conv-type-row">
          <button class="conv-type-btn" id="cbt-length"   onclick="ecConvType('length')">📏 Length</button>
          <button class="conv-type-btn" id="cbt-weight"   onclick="ecConvType('weight')">⚖️ Weight</button>
          <button class="conv-type-btn" id="cbt-currency" onclick="ecConvType('currency')">💱 Currency</button>
        </div>
        <div class="converter-box" id="conv-box">
          <div id="curr-search-wrap" style="display:none">
            <input class="currency-search" id="curr-search" placeholder="Search (USD, EUR, NZD\u2026)" oninput="ecFxFilter()" autocapitalize="characters" autocomplete="off" spellcheck="false"/>
            <div class="curr-search-msg" id="curr-search-msg" role="status" aria-live="polite" style="display:none"></div>
          </div>
          <div class="conv-input-wrap"><input type="text" inputmode="decimal" id="conv-a" placeholder="0" oninput="ecConvCalc()"/></div>
          <select class="conv-unit-select" id="conv-a-unit" onchange="ecConvCalc()"></select>
          <button type="button" class="conv-swap" id="conv-swap" onclick="ecConvSwap()"
                  aria-label="Swap the two units" title="Swap units">\u21C5</button>
          <div class="conv-input-wrap"><input type="text" inputmode="decimal" id="conv-b" placeholder="0" oninput="ecConvCalcRev()"/></div>
          <select class="conv-unit-select" id="conv-b-unit" onchange="ecConvCalc()"></select>
        </div>
        <div class="fx-note" id="fx-note">Loading rates…</div>
        <div style="display:flex;align-items:center;gap:8px;justify-content:center">
          <span id="conv-hint" style="opacity:0.4;font-size:0.78rem">Type in either field</span>
          <button class="save-res" id="conv-save">\u2606 Save</button>
        </div>`;
      }

      let convType = 'length';
      window.ecConvType = function (type) {
        convType = type;
        ['length', 'weight', 'currency'].forEach(t => { const b = document.getElementById('cbt-' + t); if (b) styleTab(b, t === type); });
        const csw = document.getElementById('curr-search-wrap');
        if (csw) csw.style.display = type === 'currency' ? 'block' : 'none';
        // Save only makes sense for money. A length or weight result dropped into a
        // list would be totalled and given a currency symbol, which is meaningless.
        const sv = document.getElementById('conv-save');
        if (sv) sv.style.display = type === 'currency' ? '' : 'none';
        const hint = document.getElementById('conv-hint');
        if (hint) hint.textContent = type === 'currency'
          ? 'Type in either field \u00B7 save to use in a list'
          : 'Type in either field';
        populateConvUnits(type);
        ecConvCalc();
        // The picker is first built from the 31-code fallback; once rates land the full
        // ~161 are available, so rebuild it (populateConvUnits keeps the selection).
        if (type === 'currency') loadFX().then(() => {
          if (convType !== 'currency') return;
          populateConvUnits('currency');
          ecFxFilter();
          ecConvCalc();
        });
      };
      function populateConvUnits(type) {
        if (type === 'currency') {
          const all = fxAll();
          ['conv-a-unit', 'conv-b-unit'].forEach((id, i) => {
            const sel = document.getElementById(id); if (!sel) return;
            const keep = sel.value;                       // survive the rates-arrived rebuild
            sel.innerHTML = fxOptionsHTML();
            sel.value = all.indexOf(keep) !== -1 ? keep : (i === 0 ? 'USD' : 'IDR');
          });
          updateFxCount();
          return;
        }
        const units = CONV[type].units;
        ['conv-a-unit', 'conv-b-unit'].forEach((id, i) => {
          const sel = document.getElementById(id); if (!sel) return;
          sel.innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join('');
          sel.value = i === 0 ? units[0] : units[1];
        });
      }
      function wireConverter() {
        // Keep the advertised count honest — it was hardcoded to 30 and drifted the
        // moment a currency was added. Reads 31 offline, ~161 once rates load.
        updateFxCount();
        ecConvType('length');
      }

      // ── Converter input grouping ──
      // Detect the active locale's separators rather than assuming "," and "."
      function localeSeps(loc) {
        const s = (1234.5).toLocaleString(loc || getDisplayLocale());
        const nonDigits = s.replace(/\d/g, '');
        return { group: nonDigits.slice(0, -1) || '', decimal: nonDigits.slice(-1) || '.' };
      }
      // Parse a grouped, locale-formatted string back to a number.
      // The old code stripped everything except [0-9.-], which silently turned the
      // Indonesian/German "3.000" into 3 instead of 3000.
      function parseLocaleNum(str, loc) {
        const { group, decimal } = localeSeps(loc);
        let s = String(str == null ? '' : str).trim();
        if (group) s = s.split(group).join('');
        s = s.replace(/[\s\u00A0\u202F]/g, '');
        if (decimal !== '.') s = s.split(decimal).join('.');
        return parseFloat(s.replace(/[^0-9.\-]/g, ''));
      }
      // Regroup an input's text in place, keeping the caret where the user left it
      function groupConvInput(el, loc) {
        if (!el) return;
        const { group, decimal } = localeSeps(loc);
        const old = el.value;
        const isSig = ch => (ch >= '0' && ch <= '9') || ch === '-' || ch === decimal || ch === '.';
        const caret = el.selectionStart == null ? old.length : el.selectionStart;
        let before = 0;
        for (let i = 0; i < caret; i++) if (isSig(old[i])) before++;

        let raw = old;
        if (group) raw = raw.split(group).join('');
        raw = raw.replace(/[\s\u00A0\u202F]/g, '');
        if (decimal !== '.') raw = raw.split(decimal).join('.');
        raw = raw.replace(/[^0-9.\-]/g, '');
        const neg = raw.startsWith('-');
        raw = raw.replace(/-/g, '');
        const bits = raw.split('.');
        const intPart = bits.shift();
        const decPart = bits.length ? bits.join('') : null;   // ignore stray extra dots
        // Group by hand (not Number()) so 16+ digit entries keep every digit
        const grouped = intPart.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, group || '');
        const out = (neg ? '-' : '') + grouped + (decPart !== null ? decimal + decPart : '');
        if (out === old) return;
        el.value = out;

        if (document.activeElement === el && el.setSelectionRange) {
          let count = 0, pos = out.length;
          if (before === 0) pos = 0;
          else for (let i = 0; i < out.length; i++) {
            if (isSig(out[i])) count++;
            if (count >= before) { pos = i + 1; break; }
          }
          try { el.setSelectionRange(pos, pos); } catch (e) { }
        }
      }

      window.ecConvCalc = function () {
        const inEl = document.getElementById('conv-a');
        if (inEl && inEl.value.trim()) trialUse('convert');
        groupConvInput(inEl);
        const cleanVal = parseLocaleNum(inEl?.value);
        const from = document.getElementById('conv-a-unit')?.value;
        const to = document.getElementById('conv-b-unit')?.value;
        const out = document.getElementById('conv-b');
        if (!from || !to || !out || isNaN(cleanVal)) { if (out) out.value = ''; return; }
        if (convType === 'currency') {
          const r = convertFX(cleanVal, from, to);
          out.value = r !== null ? fmtFX(r) : '\u2026';
        } else {
          out.value = fmtConv(convertUnit(cleanVal, from, to, convType));
        }
      };

      // Swap both the units and the amounts, so CAD 5 -> IDR 55,000 becomes
      // IDR 55,000 -> CAD 5 rather than silently re-converting the wrong number.
      let _swapFlip = false;
      window.ecConvSwap = function () {
        const aU = document.getElementById('conv-a-unit'), bU = document.getElementById('conv-b-unit');
        const aV = document.getElementById('conv-a'), bV = document.getElementById('conv-b');
        if (!aU || !bU || !aV || !bV) return;

        const u = aU.value; aU.value = bU.value; bU.value = u;
        // "…" is the placeholder shown when a rate is missing, not a number — moving it
        // into the editable field would leave unparseable text the user has to delete.
        const clean = s => (s === '\u2026' ? '' : s);
        const v = clean(aV.value); aV.value = clean(bV.value); bV.value = v;

        // The search box writes into the TOP slot. Leaving "cad" in it after a swap
        // would mislabel the row and snap CAD back on the next keystroke.
        const box = document.getElementById('curr-search');
        if (box && box.value) { box.value = ''; ecFxFilter(); }

        const btn = document.getElementById('conv-swap');
        if (btn) { _swapFlip = !_swapFlip; btn.classList.toggle('swapped', _swapFlip); }

        ecConvCalc();
      };

      window.ecConvCalcRev = function () {
        const inEl = document.getElementById('conv-b');
        if (inEl && inEl.value.trim()) trialUse('convert');
        groupConvInput(inEl);
        const cleanVal = parseLocaleNum(inEl?.value);
        const from = document.getElementById('conv-b-unit')?.value;
        const to = document.getElementById('conv-a-unit')?.value;
        const out = document.getElementById('conv-a');
        if (!from || !to || !out || isNaN(cleanVal)) { if (out) out.value = ''; return; }
        if (convType === 'currency') {
          const r = convertFX(cleanVal, from, to);
          out.value = r !== null ? fmtFX(r) : '\u2026';
        } else {
          out.value = fmtConv(convertUnit(cleanVal, from, to, convType));
        }
      };

      // The search box SELECTS rather than filters. Filtering both dropdowns had two
      // failure modes: a miss emptied them completely (leaving a stale result on screen
      // that looked valid), and an exact single match left both lists holding only that
      // one code, so the only possible conversion was X to X.
      // With ~161 codes it also matches names, so "kiwi"-style browsing works: typing
      // "new zealand" finds NZD without knowing the code.
      window.ecFxFilter = function () {
        const box = document.getElementById('curr-search');
        const msg = document.getElementById('curr-search-msg');
        const q = (box ? box.value : '').toUpperCase().trim();
        const selA = document.getElementById('conv-a-unit');
        const all = fxAll();

        const show = (text, bad) => {
          if (!msg) return;
          msg.textContent = text || '';
          msg.style.display = text ? '' : 'none';
          const t = window.getTheme ? window.getTheme() : {};
          msg.style.color = bad ? (t.clearBg || '#e05a5a') : (t.displayText || 'inherit');
        };
        const label = c => { const n = fxName(c); return n ? c + ' \u2014 ' + n : c; };

        if (!q) { show(''); return; }

        const exact = all.indexOf(q) !== -1 ? q : null;
        const byCode = all.filter(c => c.indexOf(q) === 0);
        // Name matching only kicks in at 3 chars — below that nearly every currency
        // name contains the letter, so "N" would report 143 matches instead of 6 codes.
        const byName = q.length >= 3 ? all.filter(c => fxName(c).toUpperCase().indexOf(q) !== -1) : [];
        const matches = [];
        byCode.concat(byName).forEach(c => { if (matches.indexOf(c) === -1) matches.push(c); });
        const hit = exact || (matches.length === 1 ? matches[0] : null);

        if (hit) {
          if (selA && selA.value !== hit) { selA.value = hit; ecConvCalc(); }
          show(label(hit) + ' \u2713', false);
        } else if (matches.length > 1) {
          const head = matches.slice(0, 6).join(', ');
          show(head + (matches.length > 6 ? ' \u2026 (' + matches.length + ' matches)' : ''), false);
        } else {
          show('No currency matches \u201C' + q + '\u201D. TalkCalc supports '
            + all.length + ' currencies \u2014 tap a dropdown to see them all.', true);
        }
      };

      // ── Percent ──
      function percentHTML() {
        return `
        <div class="pct-card">
          <div class="pct-card-title">What is X% of Y?</div>
          <div class="pct-input-row">
            <div class="pct-input-wrap"><input type="number" id="p1x" placeholder="15" oninput="ecP1()"/></div>
            <span class="pct-label">% of</span>
            <div class="pct-input-wrap"><input type="number" id="p1y" placeholder="200" oninput="ecP1()"/></div>
          </div>
          <div class="pct-result-row">
            <button type="button" class="pct-clear" id="p1c" onclick="ecPctClear(1)" aria-label="Clear this calculation">Clear</button>
            <button type="button" class="save-res pct-save" id="p1s" aria-label="Save this result">☆ Save</button>
            <div class="pct-result" id="p1r">—</div>
          </div>
        </div>
        <div class="pct-card">
          <div class="pct-card-title">Add % (tip / tax / markup)</div>
          <div class="pct-input-row">
            <div class="pct-input-wrap"><input type="number" id="p2b" placeholder="85.00" oninput="ecP2()"/></div>
            <span class="pct-label">+</span>
            <div class="pct-input-wrap"><input type="number" id="p2p" placeholder="15" oninput="ecP2()"/></div>
            <span class="pct-label">%</span>
          </div>
          <div class="pct-result-row">
            <button type="button" class="pct-clear" id="p2c" onclick="ecPctClear(2)" aria-label="Clear this calculation">Clear</button>
            <button type="button" class="save-res pct-save" id="p2s" aria-label="Save this result">☆ Save</button>
            <div class="pct-result" id="p2r">—</div>
          </div>
        </div>
        <div class="pct-card">
          <div class="pct-card-title">X is what % of Y?</div>
          <div class="pct-input-row">
            <div class="pct-input-wrap"><input type="number" id="p3x" placeholder="30" oninput="ecP3()"/></div>
            <span class="pct-label">of</span>
            <div class="pct-input-wrap"><input type="number" id="p3y" placeholder="200" oninput="ecP3()"/></div>
          </div>
          <div class="pct-result-row">
            <button type="button" class="pct-clear" id="p3c" onclick="ecPctClear(3)" aria-label="Clear this calculation">Clear</button>
            <button type="button" class="save-res pct-save" id="p3s" aria-label="Save this result">☆ Save</button>
            <div class="pct-result" id="p3r">—</div>
          </div>
        </div>`;
      }
      // Blank input must stay blank: +'' is 0, so the old code showed "= 0" for an empty card
      function pctVal(id) {
        const v = (document.getElementById(id)?.value || '').trim();
        if (v === '') return null;
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      }
      function fmtPct(n) { return fmtConv(+n.toFixed(4)); }
      const PCT_FIELDS = { 1: ['p1x', 'p1y'], 2: ['p2b', 'p2p'], 3: ['p3x', 'p3y'] };
      // Show Clear once there is anything to clear, and Save once there is a real result
      // to save. Both toggle the same way so the row never holds a hole where a hidden
      // button used to be.
      function pctToggleClear(n) {
        const clr = document.getElementById('p' + n + 'c');
        const sv = document.getElementById('p' + n + 's');
        const any = PCT_FIELDS[n].some(id => ((document.getElementById(id) || {}).value || '') !== '');
        if (clr) clr.classList.toggle('show', any);
        if (sv) sv.classList.toggle('show', !!pctSaveInfo(n));
      }
      // Run once at build time: these only ever fired from oninput, so on a fresh panel
      // Save defaulted to visible with an empty Clear slot beside it.
      function wirePct() { [1, 2, 3].forEach(pctToggleClear); }
      window.ecPctClear = function (n) {
        PCT_FIELDS[n].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        ({ 1: ecP1, 2: ecP2, 3: ecP3 })[n]();
        document.getElementById(PCT_FIELDS[n][0])?.focus();
      };
      window.ecP1 = function () {
        const x = pctVal('p1x'), y = pctVal('p1y'), el = document.getElementById('p1r');
        if (el) el.textContent = (x === null || y === null) ? '\u2014' : `= ${fmtPct(x / 100 * y)}`;
        if (PCT_FIELDS[1].some(id => ((document.getElementById(id) || {}).value || '').trim())) trialUse('pct');
        pctToggleClear(1);
      };
      window.ecP2 = function () {
        const b = pctVal('p2b'), p = pctVal('p2p'), el = document.getElementById('p2r');
        if (el) {
          if (b === null || p === null) el.textContent = '\u2014';
          else { const a = b * p / 100; el.textContent = `= ${fmtPct(b + a)}  (+${fmtPct(a)})`; }
        }
        if (PCT_FIELDS[2].some(id => ((document.getElementById(id) || {}).value || '').trim())) trialUse('pct');
        pctToggleClear(2);
      };
      window.ecP3 = function () {
        const x = pctVal('p3x'), y = pctVal('p3y'), el = document.getElementById('p3r');
        if (el) el.textContent = (x === null || y === null || y === 0) ? '\u2014' : `= ${fmtPct(x / y * 100)}%`;
        if (PCT_FIELDS[3].some(id => ((document.getElementById(id) || {}).value || '').trim())) trialUse('pct');
        pctToggleClear(3);
      };

      // ── Scientific ──
      function sciHTML() {
        return `
        <div class="sci-top-row">
          <div class="sci-mode-seg" role="group" aria-label="Angle unit">
            <button class="sci-mode-btn" id="sci-rad" onclick="sciMode(true)" aria-pressed="true">RAD</button>
            <button class="sci-mode-btn" id="sci-deg" onclick="sciMode(false)" aria-pressed="false">DEG</button>
          </div>
          <button class="sci-mode-btn sci-inv-btn" id="sci-inv" onclick="sciInv()" aria-pressed="false">INV</button>
        </div>
        <div class="sci-display" id="sci-disp" tabindex="0">
          <div class="sci-flags" id="sci-flags"></div>
          <div class="sci-hist-line" id="sci-hl"></div>
          <div class="sci-val" id="sci-vl">0</div>
        </div>
        <div class="sci-grid" id="sci-grid"></div>`;
      }
      window.sciMode = function (rad) { sci.isRad = rad; renderSciGrid(); };
      window.sciInv = function () { sci.inv = !sci.inv; renderSciGrid(); };

      function renderSciGrid() {
        const grid = document.getElementById('sci-grid'); if (!grid) return;
        // Wire keyboard input to sci calculator
        const sciDispEl = document.getElementById('sci-disp');
        if (sciDispEl && !sciDispEl._keyBound) {
          sciDispEl._keyBound = true;
          sciDispEl.addEventListener('keydown', function (e) {
            e.stopImmediatePropagation();
            const map = {
              '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
              '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
              '.': '.', 'Enter': '=', 'Backspace': '\u232B',
              'Escape': 'C', '+': '+', '-': '-',
              '*': '\u00D7', '/': '\u00F7', '%': '%',
              '(': '(', ')': ')', '=': '^'
            };
            const key = map[e.key];
            if (key) { e.preventDefault(); sciPress(key); }
          });
        }
        const t = window.getTheme ? window.getTheme() : {};
        const inv = sci.inv;
        // Each INV key is the true inverse of the key in the same slot below.
        // x! is the one exception — factorials have no elementary inverse, so it stays put.
        const rows = inv ? [
          ['sin\u207B\u00B9', 'cos\u207B\u00B9', 'tan\u207B\u00B9', '10\u02E3', 'e\u02E3'],
          ['ln', 'x!', 'x\u00B2', '\u221Ax', '\u207F\u221Ax'],
          ['\u03C0', 'e', '(', ')', 'C'],
          ['7', '8', '9', '\u00F7', '\u232B'],
          ['4', '5', '6', '\u00D7', '%'],
          ['1', '2', '3', '-', '1/x'],
          ['\u00B1', '0', '.', '+', '='],
        ] : [
          ['sin', 'cos', 'tan', 'log', 'ln'],
          ['e\u02E3', 'x!', '\u221Ax', 'x\u00B2', 'x\u207F'],
          ['\u03C0', 'e', '(', ')', 'C'],
          ['7', '8', '9', '\u00F7', '\u232B'],
          ['4', '5', '6', '\u00D7', '%'],
          ['1', '2', '3', '-', '1/x'],
          ['\u00B1', '0', '.', '+', '='],
        ];
        const opSet = new Set(['\u00F7', '\u00D7', '+', '-']);
        const fnSet = new Set(['sin', 'cos', 'tan', 'log', 'ln', 'sin\u207B\u00B9', 'cos\u207B\u00B9', 'tan\u207B\u00B9', 'log\u2082', '10\u02E3', 'e\u02E3', 'x!', '\u221Ax', '\u207F\u221Ax', 'x\u00B2', 'x\u207F', '\u03C0', 'e', '(', ')', '+/-', '1/x', '%']);
        grid.innerHTML = rows.map(row => `<div class="sci-row">${row.map(lb => {
          let bg = t.btnBg, fg = t.btnText, br = t.btnBorder;
          if (lb === '=') { bg = t.equalsBg; fg = t.equalsText; br = t.equalsBg; }
          else if (lb === 'C' || lb === '\u232B') { bg = t.clearBg; fg = t.clearText; br = t.clearBg; }
          else if (opSet.has(lb)) { bg = t.operatorBg; fg = t.operatorText; br = t.operatorBg; }
          else if (fnSet.has(lb)) { bg = t.displayBg; fg = t.displayText; br = t.btnBorder; }
          const esc = String(lb).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<button type="button" class="sci-btn" data-key="${esc}" style="background:${bg};color:${fg};border-color:${br}">${esc}</button>`;
        }).join('')}</div>`).join('');
        if (!grid._clickBound) {
          grid._clickBound = true;
          grid.addEventListener('click', function (e) {
            const btn = e.target.closest('.sci-btn');
            if (btn && grid.contains(btn)) sciPress(btn.dataset.key);
          });
        }
        const radB = document.getElementById('sci-rad'), degB = document.getElementById('sci-deg'), invB = document.getElementById('sci-inv');
        if (radB) { radB.style.background = sci.isRad ? t.operatorBg : t.btnBg; radB.style.color = sci.isRad ? t.operatorText : t.btnText; radB.style.borderColor = sci.isRad ? t.operatorBg : t.btnBorder; radB.setAttribute('aria-pressed', String(sci.isRad)); }
        if (degB) { degB.style.background = !sci.isRad ? t.operatorBg : t.btnBg; degB.style.color = !sci.isRad ? t.operatorText : t.btnText; degB.style.borderColor = !sci.isRad ? t.operatorBg : t.btnBorder; degB.setAttribute('aria-pressed', String(!sci.isRad)); }
        if (invB) { invB.style.background = sci.inv ? t.equalsBg : t.btnBg; invB.style.color = sci.inv ? t.equalsText : t.btnText; invB.style.borderColor = sci.inv ? t.equalsBg : t.btnBorder; invB.setAttribute('aria-pressed', String(sci.inv)); }
        if (sciDispEl) { sciDispEl.style.background = t.displayBg; sciDispEl.style.borderColor = t.btnBorder; }
        const vl = document.getElementById('sci-vl'); if (vl) vl.style.color = t.displayText;
        const fl = document.getElementById('sci-flags'); if (fl) fl.style.color = t.displayText;
        window.sciRefreshFlags();
      }

      // Format the science display without touching sci.val (which must stay raw for parseFloat)
      function fmtSci(raw) {
        const s = String(raw);
        if (!s || s === 'Error') return s;
        if (s.includes('(') || s.includes(')')) return s;   // partial expression — leave as typed
        const neg = s.startsWith('-');
        const body = neg ? s.slice(1) : s;
        if (!/^\d*\.?\d*$/.test(body)) return s;            // exponential form etc. — leave alone
        // Mid-typing "1234." — group the integer part and keep the dangling separator
        if (body.endsWith('.')) {
          const int = formatDisplayNumber(body.slice(0, -1));
          const dec = (1.1).toLocaleString(getDisplayLocale()).charAt(1) || '.';
          return (neg ? '-' : '') + int + dec;
        }
        const out = formatDisplayNumber(body);
        return neg ? '-' + out : out;
      }
      function fmtSciHist(h) {
        return String(h || '').replace(/-?\d+\.?\d*/g, m => fmtSci(m));
      }
      // Angle unit, inverse state and unclosed-paren depth, so none of it is invisible.
      // Independent flags, drawn as separate pills — "DEG" and "INV" are two unrelated
      // switches, not one compound mode, and joining them with a separator hid that.
      window.sciRefreshFlags = function () {
        const fl = document.getElementById('sci-flags'); if (!fl) return;
        fl.textContent = '';
        const add = (txt, label) => {
          const s = document.createElement('span');
          s.className = 'sci-flag'; s.textContent = txt;
          if (label) s.setAttribute('aria-label', label);
          fl.appendChild(s);
        };
        add(sci.isRad ? 'RAD' : 'DEG', sci.isRad ? 'Angle unit: radians' : 'Angle unit: degrees');
        if (sci.inv) add('INV', 'Inverse functions on');
        if (sci.stack.length) add('('.repeat(sci.stack.length), sci.stack.length + ' unclosed bracket(s)');
      };
      window.sciRefreshDisplay = function () {
        const vl = document.getElementById('sci-vl'), hl = document.getElementById('sci-hl');
        if (vl) vl.textContent = fmtSci(sci.val);
        if (hl) hl.textContent = fmtSciHist(sci.hist);
        window.sciRefreshFlags();
      };

      // ── Evaluation helpers ────────────────────────────────────────────────
      // sci.val is ALWAYS a bare number string ("12.5", "-3", "Error"). Parens are
      // never written into it — "(" parks the pending {prev,op} on a stack and ")"
      // folds the frame back down to a single number. That is what makes the parens
      // actually affect the result, and it also makes "0(" impossible to display.
      const SCI_BINOPS = ['\u00F7', '\u00D7', '+', '-', '^', '\u221A'];
      // Button labels that behave as binary operators, mapped to their internal op.
      const SCI_OPKEY = { 'x\u207F': '^', '\u207F\u221Ax': '\u221A' };
      // How an internal op is drawn on the history line.
      const SCI_OPTOK = { '\u221A': '\u207F\u221A' };
      function sciOpTok(op) { return SCI_OPTOK[op] || op; }
      function sciApply(op, a, b) {
        switch (op) {
          case '+': return a + b;
          case '-': return a - b;
          case '\u00D7': return a * b;
          case '\u00F7': return b === 0 ? NaN : a / b;
          case '^': return Math.pow(a, b);
          case '\u221A': return b === 0 ? NaN : Math.pow(a, 1 / b);  // b-th root of a
          default: return b;
        }
      }
      // Collapse the pending "prev op _" of the current frame against cur.
      function sciFold(cur) { return (sci.op && sci.prev !== null) ? sciApply(sci.op, sci.prev, cur) : cur; }
      // Infinity is as unusable as NaN on a display, so both surface as Error.
      function sciNum(x) { return (x === null || !isFinite(x)) ? 'Error' : String(+Number(x).toFixed(10)); }

      // ── History-line tokens ──
      function sciExpr(tk) { return tk.join(' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')'); }
      function sciPushOperand() {
        if (sci.valTok) { sci.valTok = false; return; }  // already at the tail of tokens
        sci.tokens.push(sci.val);
      }
      // Pull the trailing operand back off the token list so a function can wrap it.
      function sciTakeOperand() {
        if (!sci.valTok) return sci.val;
        sci.valTok = false;
        if (sci.tokens[sci.tokens.length - 1] !== ')') return sci.tokens.pop() || sci.val;
        let depth = 0; const out = [];
        while (sci.tokens.length) {
          const tk = sci.tokens.pop(); out.unshift(tk);
          if (tk === ')') depth++;
          else if (tk === '(') { depth--; if (depth === 0) break; }
        }
        // The caller re-brackets, so hand back the bare inside: √(4 + 5), not √((4 + 5)).
        if (out[0] === '(' && out[out.length - 1] === ')') out.splice(0, 1), out.pop();
        return sciExpr(out);
      }
      // Record a function application, e.g. sin(30), so the history line stays truthful.
      function sciNote(wrap) { sci.tokens.push(wrap(sciTakeOperand())); sci.valTok = true; }
      function sciHistLine() {
        if (!sci.tokens.length) return '';                 // nothing in progress yet
        const tk = sci.tokens.slice();
        if (!sci.valTok && !sci._reset) tk.push(sci.val);  // the operand still being typed
        return sciExpr(tk);
      }

      window.sciPress = function (lb) {
        trialUse('sci');
        const toRad = v => sci.isRad ? v : v * Math.PI / 180;
        const fromRad = v => sci.isRad ? v : v * 180 / Math.PI;
        const n = parseFloat(sci.val);
        let result = null, histLocked = false, wasOpJust = sci.opJust;
        sci.opJust = false;

        if (lb.length === 1 && lb >= '0' && lb <= '9') {
          if (sci._reset) { sci.val = lb; sci._reset = false; sci.valTok = false; }
          else sci.val = sci.val === '0' ? lb : sci.val + lb;
        }
        else if (lb === '.') {
          if (sci._reset) { sci.val = '0.'; sci._reset = false; sci.valTok = false; }
          else if (!sci.val.includes('.')) sci.val += '.';
        }
        else if (lb === '\u232B') {
          // A result or a closed group isn't editable digit-by-digit — clear it instead.
          if (sci._reset || sci.valTok) { sci.val = '0'; sci._reset = false; sci.valTok = false; }
          else sci.val = sci.val.length > 1 ? sci.val.slice(0, -1) : '0';
        }
        else if (lb === 'C') {
          sci.val = '0'; sci.hist = ''; sci.prev = null; sci.op = null; sci._reset = false;
          sci.stack = []; sci.tokens = []; sci.valTok = false; histLocked = true;
        }
        else if (lb === '\u00B1') {
          sci.val = sci.val.startsWith('-') ? sci.val.slice(1) : '-' + sci.val;
          if (sci.valTok) { sci.tokens[sci.tokens.length - 1] = sci.val; }
        }

        // "(" opens a frame. Whatever operator was pending waits on the stack.
        else if (lb === '(') {
          sci.stack.push({ prev: sci.prev, op: sci.op });
          sci.prev = null; sci.op = null; sci.val = '0'; sci._reset = true; sci.valTok = false;
          sci.tokens.push('(');
        }
        // ")" folds the frame to one number, so sci.val stays purely numeric.
        else if (lb === ')') {
          if (sci.stack.length) {
            sciPushOperand(); sci.tokens.push(')');
            const inner = sciFold(n);
            const f = sci.stack.pop();
            sci.prev = f.prev; sci.op = f.op;
            sci.val = sciNum(inner); sci._reset = true; sci.valTok = true;
          }
          // No matching "(" — ignore the key rather than corrupt the display.
        }

        else if (SCI_BINOPS.includes(lb) || SCI_OPKEY[lb]) {
          const op = SCI_OPKEY[lb] || lb;
          if (wasOpJust) { sci.tokens[sci.tokens.length - 1] = sciOpTok(op); sci.op = op; }   // operator swap
          else {
            sciPushOperand(); sci.tokens.push(sciOpTok(op));
            if (sci.op && sci.prev !== null) { sci.prev = sciApply(sci.op, sci.prev, n); sci.val = sciNum(sci.prev); }
            else sci.prev = n;
            sci.op = op;
          }
          sci._reset = true; sci.valTok = false; sci.opJust = true;
        }

        else if (lb === '=') {
          sciPushOperand();
          let cur = sciFold(n);
          while (sci.stack.length) {                 // auto-close anything left open
            sci.tokens.push(')');
            const f = sci.stack.pop();
            sci.prev = f.prev; sci.op = f.op;
            cur = sciFold(cur);
          }
          const expr = sciExpr(sci.tokens);
          sci.val = sciNum(cur);
          sci.hist = expr + ' ='; histLocked = true;
          sci.tokens = []; sci.prev = null; sci.op = null; sci._reset = true; sci.valTok = false;
          if (expr) addHist(expr, sci.val);
        }

        else if (lb === '%') { sciNote(a => '(' + a + ')%'); result = n / 100; }
        else if (lb === '1/x') { sciNote(a => '1/(' + a + ')'); result = n === 0 ? NaN : 1 / n; }
        else if (lb === 'x\u00B2') { sciNote(a => '(' + a + ')\u00B2'); result = n * n; }
        else if (lb === '\u221Ax') { sciNote(a => '\u221A(' + a + ')'); result = Math.sqrt(n); }
        else if (lb === 'x!') { sciNote(a => '(' + a + ')!'); result = factorial(n); }
        else if (lb === '\u03C0') { sci.tokens.push('\u03C0'); sci.valTok = true; result = Math.PI; }
        else if (lb === 'e') { sci.tokens.push('e'); sci.valTok = true; result = Math.E; }
        else if (lb === 'e\u02E3') { sciNote(a => 'e^(' + a + ')'); result = Math.exp(n); }
        else if (lb === '10\u02E3') { sciNote(a => '10^(' + a + ')'); result = Math.pow(10, n); }
        else if (lb === 'log') { sciNote(a => 'log(' + a + ')'); result = Math.log10(n); }
        else if (lb === 'ln') { sciNote(a => 'ln(' + a + ')'); result = Math.log(n); }
        else if (lb === 'log\u2082') { sciNote(a => 'log\u2082(' + a + ')'); result = Math.log2(n); }
        else if (lb === 'sin') { sciNote(a => 'sin(' + a + ')'); result = Math.sin(toRad(n)); }
        else if (lb === 'cos') { sciNote(a => 'cos(' + a + ')'); result = Math.cos(toRad(n)); }
        else if (lb === 'tan') { sciNote(a => 'tan(' + a + ')'); result = Math.tan(toRad(n)); }
        else if (lb === 'sin\u207B\u00B9') { sciNote(a => 'asin(' + a + ')'); result = fromRad(Math.asin(n)); }
        else if (lb === 'cos\u207B\u00B9') { sciNote(a => 'acos(' + a + ')'); result = fromRad(Math.acos(n)); }
        else if (lb === 'tan\u207B\u00B9') { sciNote(a => 'atan(' + a + ')'); result = fromRad(Math.atan(n)); }

        if (result !== null) {
          sci.val = sciNum(result); sci._reset = true;
          if (sci.val === 'Error') { sci.tokens = []; sci.stack = []; sci.prev = null; sci.op = null; sci.valTok = false; }
        }
        if (!histLocked) sci.hist = sciHistLine();
        window.sciRefreshDisplay();
      };

      // ── Notes & History ──
      // ══ Bottom sheets ══════════════════════════════════════════════════════
      // Replaces prompt()/confirm(). Those render a browser dialog stamped with the
      // origin, and Android WebView hosts commonly suppress them outright unless
      // onJsPrompt is implemented — which would make these actions silently do nothing.
      let sheetEl = null, sheetPrevFocus = null;

      let sheetPushed = false;
      // keepHistory: we're swapping one sheet for another (options -> rename), so the
      // pushed entry is handed to the incoming sheet. Unwinding here would fire popstate
      // asynchronously and close the sheet that just opened.
      function closeSheet(fromPop, keepHistory) {
        if (!sheetEl) return;
        sheetEl.remove(); sheetEl = null;
        window.__ecSheetKey = null;
        if (sheetPrevFocus && sheetPrevFocus.isConnected) { try { sheetPrevFocus.focus(); } catch { } }
        sheetPrevFocus = null;
        // Android Back arrives as popstate; when we close any other way, unwind the
        // history entry we pushed so Back doesn't need two presses.
        if (sheetPushed && !keepHistory) { sheetPushed = false; if (!fromPop) { try { history.back(); } catch { } } }
      }
      window.addEventListener('popstate', function () { if (sheetEl) closeSheet(true); });
      function sheetKeys(e) {
        if (!sheetEl) return;
        if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
        if (e.key !== 'Tab') return;
        const f = sheetEl.querySelectorAll('button, input');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }

      // spec: { title, sub, fields:[{key,label,value,inputmode}], rows:[{icon,text,danger,onPick}],
      //         confirm:{text,danger,onConfirm(values)}, cancel:'Cancel' }
      function openSheet(spec) {
        closeSheet(false, true);
        const t = window.getTheme ? window.getTheme() : {};
        sheetPrevFocus = document.activeElement;

        const ov = document.createElement('div'); ov.className = 'ec-sheet-ov';
        const sh = document.createElement('div'); sh.className = 'ec-sheet';
        sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
        sh.style.background = t.bg; sh.style.color = t.btnText;

        const h = document.createElement('h3'); h.textContent = spec.title; sh.appendChild(h);
        if (spec.sub) { const p = document.createElement('div'); p.className = 'sub'; p.textContent = spec.sub; sh.appendChild(p); }

        const inputs = {};
        (spec.fields || []).forEach(f => {
          const w = document.createElement('div'); w.className = 'ec-fld';
          const lb = document.createElement('label'); lb.textContent = f.label;
          lb.htmlFor = 'ecf-' + f.key;
          const inp = document.createElement('input');
          inp.id = 'ecf-' + f.key; inp.type = 'text';
          if (f.inputmode) inp.inputMode = f.inputmode;
          inp.value = f.value == null ? '' : f.value;
          inp.style.borderColor = t.btnBorder; inp.style.color = t.inputText || t.btnText;
          inp.style.background = t.displayBg;
          inp.style.setProperty('--ec-ph', t.inputPlaceholder || t.btnText);
          if (f.group) inp.addEventListener('input', () => groupConvInput(inp, f.loc || deviceLocale()));
          inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(); } });
          inputs[f.key] = inp;
          w.appendChild(lb); w.appendChild(inp); sh.appendChild(w);
        });

        (spec.rows || []).forEach(r => {
          const b = document.createElement('button'); b.className = 'ec-row'; b.type = 'button';
          b.style.borderColor = r.danger ? t.clearBg : t.btnBorder;
          b.style.color = r.danger ? t.clearBg : t.btnText;
          const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = r.icon;
          const tx = document.createElement('span'); tx.textContent = r.text;
          b.appendChild(ic); b.appendChild(tx);
          b.addEventListener('click', () => {
            const pick = r.onPick;
            closeSheet(false, true);          // hand the history entry to the next sheet
            pick();
            // If the action didn't open a follow-up sheet, unwind the entry now.
            if (!sheetEl && sheetPushed) { sheetPushed = false; try { history.back(); } catch { } }
          });
          sh.appendChild(b);
        });

        if (spec.stepper) {
          let n = spec.stepper.value;
          const wrap = document.createElement('div'); wrap.className = 'ec-stepper';
          const mk = (txt, d, lab) => {
            const b = document.createElement('button'); b.type = 'button'; b.textContent = txt;
            b.setAttribute('aria-label', lab);
            b.style.borderColor = t.btnBorder; b.style.color = t.btnText;
            b.addEventListener('click', () => {
              n = Math.max(spec.stepper.min, Math.min(spec.stepper.max, n + d));
              num.textContent = n; inputs.__step = n;
            });
            return b;
          };
          const num = document.createElement('span'); num.className = 'n';
          num.textContent = n; num.style.color = t.displayText;
          num.setAttribute('aria-live', 'polite');
          wrap.appendChild(mk('\u2212', -1, 'Fewer')); wrap.appendChild(num); wrap.appendChild(mk('+', 1, 'More'));
          sh.appendChild(wrap);
          inputs.__step = n;
        }

        function done() {
          const vals = {};
          Object.keys(inputs).forEach(k => { vals[k] = k === '__step' ? inputs[k] : inputs[k].value; });
          closeSheet();
          spec.confirm && spec.confirm.onConfirm(vals);
        }

        if (spec.confirm) {
          const btns = document.createElement('div'); btns.className = 'ec-sheet-btns';
          const cancel = document.createElement('button'); cancel.type = 'button';
          cancel.textContent = spec.cancel || 'Cancel';
          cancel.style.borderColor = t.btnBorder; cancel.style.color = t.btnText;
          cancel.addEventListener('click', () => closeSheet());
          const ok = document.createElement('button'); ok.type = 'button';
          ok.textContent = spec.confirm.text;
          const bg = spec.confirm.danger ? t.clearBg : t.accent;
          ok.style.background = bg; ok.style.borderColor = bg; ok.style.color = t.bg;
          ok.addEventListener('click', done);
          btns.appendChild(cancel); btns.appendChild(ok); sh.appendChild(btns);
        } else {
          const cancel = document.createElement('button'); cancel.type = 'button';
          cancel.className = 'ec-row'; cancel.style.borderColor = t.btnBorder;
          cancel.style.color = t.btnText; cancel.style.justifyContent = 'center';
          cancel.textContent = spec.cancel || 'Cancel';
          cancel.addEventListener('click', () => closeSheet());
          sh.appendChild(cancel);
        }

        ov.appendChild(sh);
        ov.addEventListener('click', e => { if (e.target === ov) closeSheet(); });
        document.body.appendChild(ov);
        sheetEl = ov;
        requestAnimationFrame(() => ov.classList.add('show'));
        // Not addEventListener: a window-capture guard above calls
        // stopImmediatePropagation whenever a pro panel is visible, so no later
        // listener would ever run. That guard calls this hook first instead.
        window.__ecSheetKey = sheetKeys;
        if (!sheetPushed) { try { history.pushState({ ecSheet: 1 }, ''); sheetPushed = true; } catch { } }
        const focusFirst = sh.querySelector('input') || sh.querySelector('button');
        setTimeout(() => { try { focusFirst && focusFirst.focus(); } catch { } }, 60);
      }

      // ══ Saved results ══════════════════════════════════════════════════════
      // Explicit saves only. Nothing lands here unless the person taps Save, which
      // is the whole point: the auto-captured history was mostly throwaway sums.
      const SVK = 'tc_saved';
      let saved = [], savedSeq = 0;
      function loadSaved() {
        try { const r = JSON.parse(localStorage.getItem(SVK) || '[]'); saved = Array.isArray(r) ? r : []; }
        catch { saved = []; }
        saved.forEach(s => { savedSeq = Math.max(savedSeq, +s.id || 0); });
      }
      function persistSaved() { try { localStorage.setItem(SVK, JSON.stringify(saved.slice(0, 40))); } catch { } }

      // Label is derived from context, so saving stays a single tap with no dialog.
      window.ecSaveResult = function (label, value, cur) {
        const n = typeof value === 'number' ? value : parseLocaleNum(value);
        if (n === null || isNaN(n)) { showToast('Nothing to save yet'); return; }
        const lab = String(label || '').trim().slice(0, 60) || 'Result';
        saved.unshift({ id: ++savedSeq, label: lab, amt: n, cur: cur || null });
        persistSaved();
        if (document.getElementById('lst-cards')) renderNotes();
        showToast('Saved \u2014 pick it up in Notes');
      };

      // Save buttons: the label is derived from context so saving is one tap.
      // The calc bar is rebuilt by app.js on every render, so its button is
      // re-injected (and re-themed) each time rather than bound once.
      function injectSaveButtons() {
        const t = window.getTheme ? window.getTheme() : {};
        const bar = document.querySelector('.input-bar');
        if (bar && !bar.querySelector('#calc-save')) {
          const b = document.createElement('button');
          b.className = 'save-res'; b.id = 'calc-save';
          b.textContent = '\u2606'; b.setAttribute('aria-label', 'Save this result');
          b.style.padding = '0 12px';
          bar.appendChild(b);
        }
        document.querySelectorAll('.save-res').forEach(b => {
          b.style.borderColor = t.btnBorder; b.style.color = t.btnText;
        });
      }

      function pctSaveInfo(n) {
        if (n === 1) {
          const x = pctVal('p1x'), y = pctVal('p1y');
          if (x === null || y === null) return null;
          return { label: fmtPct(x) + '% of ' + fmtPct(y), amt: x / 100 * y };
        }
        if (n === 2) {
          const b = pctVal('p2b'), p = pctVal('p2p');
          if (b === null || p === null) return null;
          return { label: fmtPct(b) + ' + ' + fmtPct(p) + '%', amt: b + b * p / 100 };
        }
        const x = pctVal('p3x'), y = pctVal('p3y');
        if (x === null || y === null || y === 0) return null;
        return { label: fmtPct(x) + ' of ' + fmtPct(y), amt: x / y * 100 };
      }

      document.addEventListener('click', e => {
        const btn = e.target.closest('.save-res'); if (!btn) return;

        if (btn.id === 'calc-save') {
          const disp = document.querySelector('.display-main');
          const hist = document.querySelector('.history');
          const expr = (hist?.textContent || '').replace(/=\s*$/, '').trim();
          ecSaveResult(expr || 'Calc result', disp?.textContent);
          return;
        }
        if (btn.id === 'conv-save') {
          const a = document.getElementById('conv-a')?.value;
          const b = document.getElementById('conv-b')?.value;
          const fu = document.getElementById('conv-a-unit')?.value;
          const tu = document.getElementById('conv-b-unit')?.value;
          if (!b) { showToast('Nothing to save yet'); return; }
          ecSaveResult(a + ' ' + fu + ' \u2192 ' + tu, b, convType === 'currency' ? tu : null);
          return;
        }
        const m = btn.id.match(/^p([123])s$/);
        if (m) {
          const info = pctSaveInfo(+m[1]);
          if (!info) { showToast('Nothing to save yet'); return; }
          ecSaveResult(info.label, +info.amt.toFixed(4));
        }
      });

      // ══ Lists (labelled line items with a live total) ══════════════════════
      const LK = 'tc_lists';
      let lists = [], openList = null, listSeq = 0;

      function loadLists() {
        try {
          const raw = JSON.parse(localStorage.getItem(LK) || '[]');
          lists = Array.isArray(raw) ? raw : [];
        } catch { lists = []; }
        lists.forEach(l => {
          l.split = Math.max(1, Math.min(50, +l.split || 1));
          if (!l.cur) l.cur = appCurrency;      // lists saved before currencies existed
          l.items = Array.isArray(l.items) ? l.items : [];
          listSeq = Math.max(listSeq, +l.id || 0);
          l.items.forEach(it => { listSeq = Math.max(listSeq, +it.id || 0); });
        });
      }
      function saveLists() { try { localStorage.setItem(LK, JSON.stringify(lists)); } catch { } }
      function listById(id) { return lists.find(l => l.id === id) || null; }
      function listSum(l) { return l.items.reduce((a, it) => a + (+it.amt || 0), 0); }
      // ── Currency ───────────────────────────────────────────────────────────
      // Money follows the phone's REGION, not the app language: "en" alone says
      // nothing about which country you are in, and the UI language is pinned to
      // English. en-ID means English interface, Indonesian money.
      const REGION_CUR = {
        ID: 'IDR', US: 'USD', GB: 'GBP', AU: 'AUD', CA: 'CAD', NZ: 'NZD', SG: 'SGD', MY: 'MYR',
        TH: 'THB', PH: 'PHP', VN: 'VND', IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR', JP: 'JPY',
        CN: 'CNY', HK: 'HKD', TW: 'TWD', KR: 'KRW', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK',
        PL: 'PLN', CZ: 'CZK', HU: 'HUF', TR: 'TRY', RU: 'RUB', UA: 'UAH', ZA: 'ZAR', NG: 'NGN',
        EG: 'EGP', AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', IL: 'ILS', BR: 'BRL', MX: 'MXN',
        AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR',
        NL: 'EUR', BE: 'EUR', PT: 'EUR', IE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR'
      };
      function deviceLocale() { return navigator.language || 'en-US'; }
      // Separators belong to the currency, not the phone. A Rupiah amount is written
      // Rp 18.038 wherever you are; showing "Rp 18,038" on an en-US device mixes the
      // symbol of one convention with the grouping of another.
      const CUR_LOCALE = {
        USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', JPY: 'ja-JP', AUD: 'en-AU', CAD: 'en-CA',
        CHF: 'de-CH', CNY: 'zh-CN', IDR: 'id-ID', INR: 'en-IN', MYR: 'ms-MY', SGD: 'en-SG',
        KRW: 'ko-KR', BRL: 'pt-BR', MXN: 'es-MX', TRY: 'tr-TR', ZAR: 'en-ZA', SEK: 'sv-SE',
        NOK: 'nb-NO', DKK: 'da-DK', PLN: 'pl-PL', CZK: 'cs-CZ', HUF: 'hu-HU', THB: 'th-TH',
        PHP: 'en-PH', VND: 'vi-VN', PKR: 'en-PK', BDT: 'bn-BD', NZD: 'en-NZ', HKD: 'zh-HK',
        TWD: 'zh-TW', RUB: 'ru-RU', UAH: 'uk-UA', NGN: 'en-NG', ILS: 'he-IL', ARS: 'es-AR',
        CLP: 'es-CL', COP: 'es-CO', PEN: 'es-PE', LKR: 'si-LK',
        // Latin digits for Arabic locales: an Arabic-Indic numeral set is unreadable
        // to most users of this app and depends on device font support.
        AED: 'ar-AE-u-nu-latn', SAR: 'ar-SA-u-nu-latn', QAR: 'ar-QA-u-nu-latn',
        KWD: 'ar-KW-u-nu-latn', EGP: 'ar-EG-u-nu-latn'
      };
      function moneyLocale(cur) { return CUR_LOCALE[cur || appCurrency] || deviceLocale(); }
      function openListLocale() {
        const l = typeof openList !== 'undefined' ? listById(openList) : null;
        return moneyLocale(l && l.cur);
      }
      function detectCurrency() {
        const tags = [navigator.language].concat(navigator.languages || []);
        for (const tag of tags) {
          if (!tag) continue;
          // Intl.Locale handles every shape correctly, including zh-Hant-TW
          try {
            const r = new Intl.Locale(tag).region;
            if (r && REGION_CUR[r.toUpperCase()]) return REGION_CUR[r.toUpperCase()];
          } catch (e) { /* older WebView: fall through */ }
          // Fallback: take the LAST 2-letter subtag. Splitting rather than matching,
          // because a regex like /(?:^|-)([A-Z]{2})(?:-|$)/g eats the separator and
          // then only ever sees the language — en-ID would read as "EN", not "ID".
          const parts = String(tag).split(/[-_]/);
          for (let i = parts.length - 1; i >= 0; i--) {
            const r = parts[i].toUpperCase();
            if (r.length === 2 && REGION_CUR[r]) return REGION_CUR[r];
          }
        }
        return 'USD';
      }
      // New lists use the currency you last worked in, falling back to the device
      // region for the very first list. Detection is a starting guess, not a rule:
      // if every list you make is Rupiah, the next one should be too.
      const LASTCUR_KEY = 'tc_last_cur';
      let appCurrency = detectCurrency();
      try {
        const remembered = localStorage.getItem(LASTCUR_KEY);
        // Validate the shape, not membership of the common list. Checking against
        // CURRENCIES meant picking anything outside those 31 was silently forgotten
        // on the next launch.
        if (remembered && /^[A-Z]{3}$/.test(remembered)) appCurrency = remembered;
      } catch (e) { }

      // Most-recently-picked currencies, newest first. People transact in one or two,
      // so this is what keeps the picker short no matter how many exist.
      const CURHIST_KEY = 'tc_cur_hist';
      let curHistory = [];
      try {
        const raw = JSON.parse(localStorage.getItem(CURHIST_KEY) || '[]');
        if (Array.isArray(raw)) curHistory = raw.filter(c => /^[A-Z]{3}$/.test(c)).slice(0, 6);
      } catch (e) { }

      function rememberCurrency(code) {
        if (!code) return;
        appCurrency = code;
        curHistory = [code].concat(curHistory.filter(c => c !== code)).slice(0, 6);
        try {
          localStorage.setItem(LASTCUR_KEY, code);
          localStorage.setItem(CURHIST_KEY, JSON.stringify(curHistory));
        } catch (e) { }
      }

      function fmtMoney(n, cur) {
        const code = cur || appCurrency;
        const v = Math.round(n * 100) / 100;
        try {
          return new Intl.NumberFormat(moneyLocale(code), {
            style: 'currency', currency: code,
            currencyDisplay: 'narrowSymbol',
            maximumFractionDigits: NO_DECIMAL_CUR[code] ? 0 : 2
          }).format(v);
        } catch (e) {
          try {   // narrowSymbol is unsupported on some older WebViews
            return new Intl.NumberFormat(moneyLocale(code), { style: 'currency', currency: code }).format(v);
          } catch (e2) {
            const neg = v < 0;
            return (neg ? '-' : '') + code + ' ' + Math.abs(v).toLocaleString(moneyLocale(code), { maximumFractionDigits: 2 });
          }
        }
      }
      // Saved results can be any kind of number (a length conversion, a percentage),
      // so chips and input fields use a plain grouped number with no currency symbol.
      function fmtPlain(n) {
        return (Math.round(n * 100) / 100).toLocaleString(deviceLocale(), { maximumFractionDigits: 2 });
      }
      // Currencies normally written without decimal places
      const NO_DECIMAL_CUR = { IDR: 1, JPY: 1, KRW: 1, VND: 1, CLP: 1, ISK: 1, HUF: 1 };

      // Icons come from window.TC_ICON in app.js so the back arrow here and the one in
      // the settings header stay identical. Read defensively: this is a cache-first PWA,
      // so a stale service-worker entry can pair a new index.html with an old app.js.
      // Without the fallback that mismatch throws at the top level of this script and
      // takes the entire app down, rather than just degrading one icon.
      const _ICONS = window.TC_ICON || {};
      const ICO_BACK = _ICONS.back || '\u2190';
      const ICO_SHARE = _ICONS.share || '\u2197';
      const ICO_MORE = _ICONS.more || '\u22EF';

      function notesHTML() {
        return `
        <div id="lst-overview" style="display:flex;flex-direction:column;flex:1;min-height:0;gap:8px">
          <div class="notes-subtabs">
            <button class="lst-new-btn" id="lst-new" aria-label="Create a new list"><span class="plus">+</span> New list</button>
          </div>
          <div class="notes-list" id="lst-cards"></div>
        </div>
        <div id="lst-detail" style="display:none;flex-direction:column;flex:1;min-height:0">
          <div class="lst-bar">
            <button class="lst-ico" id="lst-back" aria-label="Back to lists">${ICO_BACK}</button>
            <div class="ttl" id="lst-title">List</div>
            <div class="lst-actions">
              <button class="lst-ico" id="lst-share" aria-label="Share this list">${ICO_SHARE}</button>
              <button class="lst-ico" id="lst-more" aria-label="List options">${ICO_MORE}</button>
            </div>
          </div>
          <div class="notes-list" id="lst-items"></div>
          <div class="recent" id="lst-recent"></div>
          <div class="lst-foot" id="lst-foot">
            <div class="lst-split" id="lst-split">
              <span>Split between</span>
              <div class="stp">
                <button id="lst-minus" aria-label="Fewer people">\u2212</button>
                <span id="lst-n">2</span>
                <button id="lst-plus" aria-label="More people">+</button>
              </div>
              <span class="each" id="lst-each">0</span>
            </div>
            <div class="lst-total-line"><span class="k">Total</span><span class="v" id="lst-total">0</span></div>
            <div class="lst-add">
              <div class="wrap" id="lst-wrap">
                <input id="li-label" type="text" placeholder="Item" aria-label="Item name"/>
                <input id="li-amt" type="text" inputmode="decimal" placeholder="0" aria-label="Amount"/>
              </div>
              <button class="lst-mic" id="li-mic" aria-label="Add item by voice">\u{1F3A4}</button>
              <button class="go" id="li-add" aria-label="Add item">+</button>
            </div>
          </div>
        </div>`;
      }

      // Everything below writes user text with textContent / dataset only, and binds
      // events by delegation. No user string is ever interpolated into markup.
      window.renderNotes = function () {
        const t = window.getTheme ? window.getTheme() : {};
        const ov = document.getElementById('lst-overview'), dt = document.getElementById('lst-detail');
        if (!ov || !dt) return;
        const inDetail = openList !== null && listById(openList);
        ov.style.display = inDetail ? 'none' : 'flex';
        dt.style.display = inDetail ? 'flex' : 'none';
        if (inDetail) renderListDetail(t); else renderListCards(t);
        themeLists(t);
        wireListInputs();
      };

      function themeLists(t) {
        const nb = document.getElementById('lst-new');
        if (nb) {
          // Accent as tint and outline, not a fill: readable on every theme and much
          // quieter than a saturated bar across the top of the panel.
          nb.style.background = t.accent + '18';
          nb.style.borderColor = t.accent + '66';
          nb.style.color = t.displayText || t.btnText;
        }
        document.querySelectorAll('.lst-ico, .stp button, .recent .chip, .lst-mic')
          .forEach(el => { el.style.borderColor = t.btnBorder; el.style.color = t.btnText; });
        const foot = document.getElementById('lst-foot'); if (foot) foot.style.borderColor = t.btnBorder;
        const wrap = document.getElementById('lst-wrap');
        if (wrap) { wrap.style.borderColor = t.btnBorder; wrap.style.background = t.displayBg; }
        ['li-label', 'li-amt'].forEach(id => { const e = document.getElementById(id); if (e) e.style.color = t.inputText || t.btnText; });
        const amt = document.getElementById('li-amt'); if (amt) amt.style.borderLeftColor = t.btnBorder;
        const go = document.getElementById('li-add');
        if (go) { go.style.background = t.accent; go.style.color = t.bg; go.style.borderColor = t.accent; }
        const ttl = document.getElementById('lst-title'); if (ttl) ttl.style.color = t.btnText;
        const tv = document.getElementById('lst-total'); if (tv) tv.style.color = t.displayText;
        const ea = document.getElementById('lst-each'); if (ea) ea.style.color = t.displayText;
        const sp = document.getElementById('lst-split'); if (sp) sp.style.color = t.btnText;
      }

      function emptyMsg(box, head, body) {
        box.textContent = '';
        const d = document.createElement('div'); d.className = 'empty-msg';
        const s = document.createElement('strong'); s.textContent = head; d.appendChild(s);
        d.appendChild(document.createTextNode(body));
        box.appendChild(d);
      }

      function renderListCards(t) {
        const box = document.getElementById('lst-cards'); if (!box) return;
        if (!lists.length) {
          emptyMsg(box, 'Start a list', 'Groceries, a bill to split, this month\u2019s rent \u2014 anything you add up more than once.');
          return;
        }
        box.textContent = '';
        lists.forEach(l => {
          const card = document.createElement('button');
          card.className = 'lst-card'; card.dataset.open = l.id;
          card.style.borderColor = t.btnBorder; card.style.background = t.btnBg;
          const grow = document.createElement('div'); grow.className = 'grow';
          const nm = document.createElement('div'); nm.className = 'lst-name';
          nm.style.color = t.btnText; nm.textContent = l.name;
          const meta = document.createElement('div'); meta.className = 'lst-meta';
          meta.style.color = t.btnText;
          meta.textContent = l.items.length + (l.items.length === 1 ? ' item' : ' items') +
            (l.split > 1 ? ' \u00B7 split ' + l.split + ' ways' : '');
          grow.appendChild(nm); grow.appendChild(meta);
          const tot = document.createElement('div'); tot.className = 'lst-total';
          tot.style.color = t.displayText; tot.textContent = fmtMoney(listSum(l), l.cur);
          card.appendChild(grow); card.appendChild(tot);
          box.appendChild(card);
        });
      }

      function renderListDetail(t) {
        const l = listById(openList); if (!l) return;
        document.getElementById('lst-title').textContent = l.name;

        const box = document.getElementById('lst-items');
        if (!l.items.length) {
          emptyMsg(box, 'Nothing added yet', 'Add an item below, or tap a recent result. Use a minus sign for money going out.');
        } else {
          box.textContent = '';
          l.items.forEach(it => {
            const row = document.createElement('div'); row.className = 'itm';
            row.style.borderColor = t.btnBorder; row.style.background = t.btnBg;
            const lb = document.createElement('button'); lb.className = 'lb';
            lb.style.color = t.btnText; lb.textContent = it.label;
            lb.dataset.edit = it.id;
            lb.setAttribute('aria-label', 'Edit ' + it.label);
            const am = document.createElement('button'); am.className = 'am';
            am.style.color = it.amt < 0 ? t.clearBg : t.displayText; am.textContent = fmtMoney(it.amt, l.cur);
            am.dataset.edit = it.id;
            am.setAttribute('aria-label', 'Edit amount ' + fmtMoney(it.amt, l.cur));
            const x = document.createElement('button'); x.className = 'x';
            x.textContent = '\u00D7'; x.dataset.del = it.id;
            x.style.color = t.btnText; x.setAttribute('aria-label', 'Remove ' + it.label);
            row.appendChild(lb); row.appendChild(am); row.appendChild(x);
            box.appendChild(row);
          });
        }

        // Saved results, tap to add as a line item, x to discard
        const rec = document.getElementById('lst-recent');
        rec.textContent = '';
        saved.forEach(sv => {
          const chip = document.createElement('span'); chip.className = 'chip';
          chip.style.borderColor = t.btnBorder; chip.style.color = t.btnText;

          const use = document.createElement('button'); use.className = 'chip-use';
          use.dataset.add = sv.id;
          use.style.color = t.btnText;
          use.setAttribute('aria-label', 'Add ' + sv.label + ', ' + (sv.cur ? fmtMoney(sv.amt, sv.cur) : fmtPlain(sv.amt)) + ', to this list');
          const nm = document.createElement('span'); nm.className = 'chip-nm'; nm.textContent = sv.label;
          const vl = document.createElement('span'); vl.className = 'chip-vl';
          vl.style.color = t.displayText;
          vl.textContent = sv.cur ? fmtMoney(sv.amt, sv.cur) : fmtPlain(sv.amt);
          use.appendChild(nm); use.appendChild(vl);

          const x = document.createElement('button'); x.className = 'chip-x';
          x.textContent = '\u00D7'; x.dataset.unsave = sv.id; x.style.color = t.btnText;
          x.setAttribute('aria-label', 'Discard saved result ' + sv.label);

          chip.appendChild(use); chip.appendChild(x);
          rec.appendChild(chip);
        });
        rec.style.display = rec.children.length ? 'flex' : 'none';

        const sum = listSum(l);
        document.getElementById('lst-total').textContent = fmtMoney(sum, l.cur);
        document.getElementById('lst-n').textContent = l.split;
        document.getElementById('lst-each').textContent = fmtMoney(sum / l.split, l.cur) + ' each';
        document.getElementById('lst-split').style.display = l.split > 1 ? 'flex' : 'none';
      }

      function addListItem(label, amt) {
        const l = listById(openList); if (!l) return false;
        trialUse('notes');
        if (amt === null || isNaN(amt)) return false;
        l.items.push({ id: ++listSeq, label: (label || '').trim() || 'Item ' + (l.items.length + 1), amt: amt });
        saveLists(); renderNotes(); return true;
      }

      window.ecListAdd = function () {
        const lb = document.getElementById('li-label'), am = document.getElementById('li-amt');
        const v = parseLocaleNum(am.value, openListLocale());
        if (v === null || isNaN(v)) { am.focus(); showToast('Enter an amount'); return; }
        addListItem(lb.value, v);
        lb.value = ''; am.value = ''; lb.focus();
      };

      // Two tiers rather than one flat list. The converter needs the long tail because
      // you convert *from* whatever you happen to encounter; a list's currency is the
      // one you actually transact in, so a short relevant set is right almost always —
      // but "almost" was doing too much work when the other 130 were unreachable.
      // Tier 1 is this list's currency, then recent picks, then the common set.
      // Tier 2 is everything, alphabetical, one tap away.
      function openCurrencySheet(l, showAll) {
        const all = fxAll();
        let codes;
        if (showAll) {
          codes = all.slice().sort();
        } else {
          codes = [];
          const push = c => { if (c && codes.indexOf(c) === -1) codes.push(c); };
          push(l.cur); push(appCurrency); curHistory.forEach(push); CURRENCIES.forEach(push);
        }
        const rows = codes.map(c => {
          const nm = fxName(c);
          return {
            icon: c === l.cur ? '\u2713' : ' ',
            // The sample amount stays: it shows the actual formatting, which differs a
            // lot (JPY has no decimals, EUR puts the symbol last, CHF groups with ').
            text: c + '  ' + fmtMoney(1000, c) + (nm ? '  \u00B7  ' + nm : ''),
            onPick: () => { l.cur = c; rememberCurrency(c); saveLists(); renderNotes(); }
          };
        });
        if (!showAll && all.length > codes.length) {
          rows.push({
            icon: '\u{1F50D}',
            text: 'Show all ' + all.length + ' currencies\u2026',
            onPick: () => openCurrencySheet(l, true)
          });
        }
        openSheet({
          title: 'Currency',
          sub: showAll ? 'Applies to this list only.'
            : 'Applies to this list only. Your recent picks come first.',
          rows: rows
        });
      }

      function shareList() {
        const l = listById(openList); if (!l) return;

        const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
        const cur = l.cur || appCurrency;
        const dec = NO_DECIMAL_CUR[cur] ? 0 : 2;
        const loc = moneyLocale(cur);
        const fmtNum = n => (Math.round(n * 100) / 100).toLocaleString(
          loc, { minimumFractionDigits: dec, maximumFractionDigits: dec }
        );

        const sum = listSum(l);
        const rows = l.items.map(it => [cap(it.label), fmtNum(+it.amt || 0)]);
        const total = fmtMoney(sum, l.cur);
        rows.push(['TOTAL', total]);
        if (l.split > 1) rows.push(['Each (' + l.split + ')', fmtMoney(sum / l.split, l.cur)]);

        const n = l.items.length;
        const head = new Date().toLocaleDateString(loc, {
          day: 'numeric', month: 'short', year: 'numeric'
        }) + ' \u00B7 ' + n + ' item' + (n === 1 ? '' : 's');

        // Width must clear the header too, or the divider ends up shorter than it.
        const labelW = Math.max(...rows.map(r => r[0].length));
        const amtW = Math.max(...rows.map(r => r[1].length));
        const width = Math.min(Math.max(labelW + 2 + amtW, head.length), 34);

        const line = ([label, amt]) =>
          label + ' '.repeat(Math.max(1, width - label.length - amt.length)) + amt;

        const body = [head, ''];
        rows.forEach(r => {
          if (r[0] === 'TOTAL') body.push('\u2500'.repeat(width));
          body.push(line(r));
        });

        // Footer lives inside the block so it renders at mono size, right-aligned
        // to the same column as the amounts.
        const credit = 'Made with TalkCalc';
        body.push('', ' '.repeat(Math.max(0, width - credit.length)) + credit);

        const text = '*' + l.name + '*\n```' + body.join('\n') + '```';

        if (navigator.share) navigator.share({ text }).catch(() => { });
        else if (navigator.clipboard) navigator.clipboard.writeText(text)
          .then(() => showToast('Copied to clipboard'), () => showToast('Could not copy'));
        else showToast('Sharing not available');
      }

      // Delegated listeners on `document`, bound once. They can't live on the panel:
      // app.js's render() wipes #app and buildUI recreates every panel, which would
      // silently drop any listener attached to the panel element.
      let listBound = false;
      function bindListEvents() {
        if (listBound) return;
        listBound = true;
        const panel = () => document.getElementById('ec-panel-notes');
        const inPanel = el => { const p = panel(); return p && el && p.contains(el); };

        document.addEventListener('click', e => {
          if (!inPanel(e.target)) return;
          const card = e.target.closest('[data-open]');
          if (card) { openList = +card.dataset.open; renderNotes(); return; }

          const del = e.target.closest('[data-del]');
          if (del) {
            const l = listById(openList); if (!l) return;
            const id = +del.dataset.del;
            l.items = l.items.filter(it => it.id !== id);
            saveLists(); renderNotes(); return;
          }

          const chip = e.target.closest('[data-add]');
          if (chip) {
            const sv = saved.find(s => s.id === +chip.dataset.add);
            if (sv) {
              const l = listById(openList);
              if (sv.cur && l) {
                if (!l.items.length && l.cur !== sv.cur) {
                  // An empty list has no committed currency, so the first money added
                  // sets it. Otherwise a converted Rupiah value lands in a list that
                  // defaulted to USD and gets silently relabelled as dollars.
                  l.cur = sv.cur; rememberCurrency(sv.cur); saveLists();
                  showToast('List currency set to ' + sv.cur);
                } else if (l.cur && sv.cur !== l.cur) {
                  // The number is stored raw, so adding a USD result to a Rupiah list
                  // would misstate it. Say so rather than converting behind your back.
                  showToast('Added as ' + l.cur + ' \u2014 saved in ' + sv.cur);
                }
              }
              addListItem(sv.label, sv.amt);
            }
            return;
          }

          const unsave = e.target.closest('[data-unsave]');
          if (unsave) {
            saved = saved.filter(s => s.id !== +unsave.dataset.unsave);
            persistSaved(); renderNotes(); return;
          }

          const edit = e.target.closest('[data-edit]');
          if (edit) { ecListEditItem(+edit.dataset.edit); return; }

          // Resolve to the enclosing button. These controls now contain an <svg>, so a
          // tap lands on the <path> or <circle> child, whose id is empty — reading
          // e.target.id directly silently broke Back, Share and every other button here.
          const hitBtn = e.target.closest('button');
          const id = hitBtn ? hitBtn.id : e.target.id;
          if (id === 'lst-back') { openList = null; renderNotes(); }
          else if (id === 'lst-new') { ecListNew(); }
          else if (id === 'li-add') { ecListAdd(); }
          else if (id === 'lst-share') { shareList(); }
          else if (id === 'lst-more') { ecListOptions(); }
          else if (id === 'lst-plus') { const l = listById(openList); if (l && l.split < 50) { l.split++; saveLists(); renderNotes(); } }
          else if (id === 'lst-minus') { const l = listById(openList); if (l && l.split > 1) { l.split--; saveLists(); renderNotes(); } }
          else if (id === 'li-mic') { listVoice(); }
        });

      }

      // `input` does not reliably reach a delegated listener on document, so the two
      // entry fields are wired directly. The _wired flag dies with the element, so
      // this re-wires correctly whenever buildUI recreates the panel.
      function wireListInputs() {
        const lb = document.getElementById('li-label'), am = document.getElementById('li-amt');
        if (am && !am._wired) {
          am._wired = true;
          am.addEventListener('input', () => groupConvInput(am, openListLocale()));
          am.addEventListener('keydown', e => { if (e.key === 'Enter') { ecListAdd(); e.preventDefault(); } });
        }
        if (lb && !lb._wired) {
          lb._wired = true;
          lb.addEventListener('keydown', e => {
            if (e.key === 'Enter') { document.getElementById('li-amt')?.focus(); e.preventDefault(); }
          });
        }
      }

      window.ecListEditItem = function (itemId) {
        const l = listById(openList); if (!l) return;
        const it = l.items.find(x => x.id === itemId); if (!it) return;
        openSheet({
          title: 'Edit item',
          fields: [
            { key: 'name', label: 'Name', value: it.label },
            { key: 'amt', label: 'Amount', value: it.amt.toLocaleString(moneyLocale(l.cur), { maximumFractionDigits: 2 }), inputmode: 'decimal', group: true, loc: moneyLocale(l.cur) }
          ],
          confirm: {
            text: 'Save', onConfirm: v => {
              const n = parseLocaleNum(v.amt, moneyLocale(l.cur));
              if (n === null || isNaN(n)) { showToast('Amount not recognised'); return; }
              it.label = (v.name || '').trim() || it.label;
              it.amt = n;
              saveLists(); renderNotes();
            }
          }
        });
      };

      window.ecListNew = function () {
        openSheet({
          title: 'New list',
          sub: 'Groceries, a bill to split, this month\u2019s rent \u2014 anything you add up more than once.\nCurrency: ' + appCurrency + ' (change any time in list options)',
          fields: [{ key: 'name', label: 'List name', value: '' }],
          confirm: {
            text: 'Create', onConfirm: v => {
              const name = (v.name || '').trim();
              if (!name) { showToast('Give the list a name'); return; }
              trialUse('notes');
              const l = { id: ++listSeq, name, split: 1, cur: appCurrency, items: [] };
              lists.unshift(l); openList = l.id; saveLists(); renderNotes();
              document.getElementById('li-label')?.focus();
            }
          }
        });
      };

      window.ecListOptions = function () {
        const l = listById(openList); if (!l) return;
        openSheet({
          title: l.name,
          sub: l.items.length + (l.items.length === 1 ? ' item' : ' items') +
            (l.split > 1 ? ' \u00B7 split ' + l.split + ' ways' : ''),
          rows: [
            {
              icon: '\u270E', text: 'Rename list', onPick: () => openSheet({
                title: 'Rename list',
                fields: [{ key: 'name', label: 'List name', value: l.name }],
                confirm: {
                  text: 'Save', onConfirm: v => {
                    const n = (v.name || '').trim();
                    if (!n) { showToast('Give the list a name'); return; }
                    l.name = n; saveLists(); renderNotes();
                  }
                }
              })
            },
            { icon: '\u{1F4B1}', text: 'Currency \u00B7 ' + l.cur, onPick: () => openCurrencySheet(l, false) },
            {
              icon: '\u{1F465}', text: 'Split between people', onPick: () => openSheet({
                title: 'Split between',
                sub: 'The total is divided evenly and shown per person.',
                stepper: { value: l.split, min: 1, max: 50 },
                confirm: {
                  text: 'Done', onConfirm: v => {
                    l.split = v.__step; saveLists(); renderNotes();
                  }
                }
              })
            },
            {
              icon: '\u{1F5D1}', text: 'Delete list', danger: true, onPick: () => openSheet({
                title: 'Delete this list?',
                sub: '\u201C' + l.name + '\u201D and its ' + l.items.length +
                  (l.items.length === 1 ? ' item' : ' items') + ' will be removed. This can\u2019t be undone.',
                confirm: {
                  text: 'Delete', danger: true, onConfirm: () => {
                    lists = lists.filter(x => x.id !== l.id);
                    openList = null; saveLists(); renderNotes();
                    showToast('List deleted');
                  }
                }
              })
            }
          ]
        });
      };

      // ── Spoken line items: "kopi seratus lima puluh ribu" ──
      const NUMW = {
        zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
        eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
        nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
        satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, nol: 0
      };
      const NUMS = { hundred: 100, thousand: 1000, million: 1000000, k: 1000, ratus: 100, puluh: 10, ribu: 1000, juta: 1000000 };
      const NUMSE = {
        sepuluh: 'satu puluh', sebelas: 'satu belas', seratus: 'satu ratus',
        seribu: 'satu ribu', sejuta: 'satu juta', rb: 'ribu', jt: 'juta'
      };
      // Dropped before parsing. Currency words sit AFTER the number ("lima ribu rupiah"),
      // and the amount scan walks backwards from the end — so an unstripped "rupiah"
      // stopped the scan immediately and the whole utterance became the label.
      const NUMTRAIL = ['rupiah', 'rupiahs', 'rp', 'idr', 'perak', 'dollar', 'dollars', 'usd',
        'euro', 'euros', 'cent', 'cents', 'sen', 'only', 'saja', 'aja'];
      // Leading command words, so "add snack 5000" isn't labelled "add snack".
      const NUMLEAD = ['add', 'tambah', 'tambahkan', 'catat', 'masukkan', 'plus', 'item', 'entry', 'beli', 'new'];

      // `digit` stays separate from `run` because a multiplier binds only to the digit
      // before it: "seratus lima puluh" is 100 + (5x10), not (100+5)x10.
      function parseSpokenItem(text) {
        let toks = [];
        String(text).toLowerCase().replace(/[^a-z0-9.\s]/g, ' ').split(/\s+/).filter(Boolean)
          .forEach(w => { if (NUMSE[w]) NUMSE[w].split(' ').forEach(x => toks.push(x)); else toks.push(w); });
        while (toks.length && NUMLEAD.includes(toks[0])) toks.shift();
        while (toks.length && NUMTRAIL.includes(toks[toks.length - 1])) toks.pop();
        const isNum = w => NUMS[w] !== undefined || NUMW[w] !== undefined || w === 'belas' || /^\d+(\.\d+)?$/.test(w);
        let start = toks.length;
        while (start > 0 && isNum(toks[start - 1])) start--;
        if (start === toks.length) return null;
        let total = 0, run = 0, digit = 0;
        for (let i = start; i < toks.length; i++) {
          const w = toks[i];
          if (w === 'belas') digit += 10;
          else if (NUMW[w] !== undefined) digit += NUMW[w];
          else if (/^\d+(\.\d+)?$/.test(w)) digit += parseFloat(w);
          else if (NUMS[w] < 1000) { run += (digit || 1) * NUMS[w]; digit = 0; }
          else { total += ((run + digit) || 1) * NUMS[w]; run = 0; digit = 0; }
        }
        return { label: toks.slice(0, start).join(' '), amt: total + run + digit };
      }

      let listRec = null;
      function listVoice() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { showToast('Voice needs Chrome or Safari'); return; }
        if (listRec) { try { listRec.stop(); } catch { } listRec = null; return; }
        const mic = document.getElementById('li-mic');
        const t = window.getTheme ? window.getTheme() : {};
        const r = new SR();
        // Language is NOT set here on purpose: patchVoice() replaces SpeechRecognition
        // with a wrapper whose `lang` setter is a no-op, so any assignment is discarded.
        // getSpeechLang() is the single source of truth for both mics.
        r.interimResults = false;
        r.onstart = () => { listRec = r; if (mic) mic.style.background = t.micActive; };
        r.onend = () => { listRec = null; if (mic) mic.style.background = 'transparent'; };
        r.onerror = () => { listRec = null; if (mic) mic.style.background = 'transparent'; showToast('Mic unavailable'); };
        r.onresult = ev => {
          const said = ev.results[0][0].transcript;
          const lb = document.getElementById('li-label');
          const am = document.getElementById('li-amt');
          const p = parseSpokenItem(said);

          // Name and amount together: "snack lima ribu" -> straight into the list
          if (p && p.label) { addListItem(p.label, p.amt); return; }

          // Amount only, and a name is already waiting: finish that row
          if (p && !p.label && lb && lb.value.trim()) { addListItem(lb.value, p.amt); lb.value = ''; return; }

          // Amount only with no name yet: park it and ask for the name
          if (p && !p.label) {
            if (am) { am.value = p.amt.toLocaleString(openListLocale(), { maximumFractionDigits: 2 }); }
            if (lb) lb.focus();
            showToast('Now say or type the name');
            return;
          }

          // No number heard: treat it as the name and move on to the amount
          if (lb) lb.value = said.trim();
          if (am) am.focus();
          showToast('Now say or type the amount');
        };
        try { r.start(); } catch { showToast('Mic busy'); }
      }

      // ── History capture ──
      function patchHistoryCapture() {
        const orig = window.handleEquals; if (!orig) return;
        let _saving = false;
        window.handleEquals = function () {
          orig.apply(this, arguments);
          if (_saving) return; _saving = true;
          setTimeout(() => {
            const disp = document.querySelector('.display-main'), hist = document.querySelector('.history');
            if (disp && hist) addHist(hist.textContent, disp.textContent);
            _saving = false;
          }, 80);
        };
      }

      // ── Voice language ──
      // app.js speaks fixed English words ("clear", "plus", "equals"). Setting the
      // utterance language only changes the voice, so an Indonesian voice was reading
      // English words aloud. These translate the text itself. Languages without a
      // table keep the English wording rather than guessing at a translation.
      const SPOKEN = {
        es: {
          'plus': 'm\u00e1s', 'minus': 'menos', 'times': 'por', 'divided by': 'dividido entre',
          'equals': 'igual a', 'clear': 'borrar', 'cleared': 'borrado',
          'backspace': 'borrar uno', 'delete': 'borrar uno', 'point': 'coma',
          'plus minus': 'cambiar signo', 'percent': 'por ciento',
          'negative': 'negativo', 'positive': 'positivo',
          "didn't understand. try: 25 plus 30": 'No entend\u00ed. Prueba: 25 m\u00e1s 30'
        },
        uk: {
          'plus': '\u043f\u043b\u044e\u0441', 'minus': '\u043c\u0456\u043d\u0443\u0441', 'times': '\u043f\u043e\u043c\u043d\u043e\u0436\u0438\u0442\u0438 \u043d\u0430', 'divided by': '\u043f\u043e\u0434\u0456\u043b\u0438\u0442\u0438 \u043d\u0430',
          'equals': '\u0434\u043e\u0440\u0456\u0432\u043d\u044e\u0454', 'clear': '\u043e\u0447\u0438\u0441\u0442\u0438\u0442\u0438', 'cleared': '\u043e\u0447\u0438\u0449\u0435\u043d\u043e',
          'backspace': '\u0432\u0438\u0434\u0430\u043b\u0438\u0442\u0438 \u043e\u0434\u0438\u043d', 'delete': '\u0432\u0438\u0434\u0430\u043b\u0438\u0442\u0438 \u043e\u0434\u0438\u043d', 'point': '\u043a\u043e\u043c\u0430',
          'plus minus': '\u0437\u043c\u0456\u043d\u0438\u0442\u0438 \u0437\u043d\u0430\u043a', 'percent': '\u0432\u0456\u0434\u0441\u043e\u0442\u043e\u043a',
          'negative': "\u0432\u0456\u0434'\u0454\u043c\u043d\u0435", 'positive': '\u0434\u043e\u0434\u0430\u0442\u043d\u0435',
          "didn't understand. try: 25 plus 30": '\u041d\u0435 \u0437\u0440\u043e\u0437\u0443\u043c\u0456\u043b\u043e. \u0421\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435: 25 \u043f\u043b\u044e\u0441 30'
        },
        id: {
          'plus': 'tambah', 'minus': 'kurang', 'times': 'kali', 'divided by': 'bagi',
          'equals': 'sama dengan', 'clear': 'hapus', 'cleared': 'sudah dihapus',
          'backspace': 'hapus satu', 'delete': 'hapus satu', 'point': 'koma',
          'plus minus': 'ganti tanda', 'percent': 'persen',
          'negative': 'negatif', 'positive': 'positif',
          "didn't understand. try: 25 plus 30": 'Tidak mengerti. Coba: 25 tambah 30'
        },
        fr: {
          'plus': 'plus', 'minus': 'moins', 'times': 'fois', 'divided by': 'divis\u00e9 par',
          'equals': '\u00e9gale', 'clear': 'effacer', 'cleared': 'effac\u00e9',
          'backspace': 'effacer un', 'delete': 'effacer un', 'point': 'virgule',
          'plus minus': 'changer de signe', 'percent': 'pour cent',
          'negative': 'n\u00e9gatif', 'positive': 'positif',
          "didn't understand. try: 25 plus 30": "Je n'ai pas compris. Essayez : 25 plus 30"
        },
        de: {
          'plus': 'plus', 'minus': 'minus', 'times': 'mal', 'divided by': 'geteilt durch',
          'equals': 'gleich', 'clear': 'l\u00f6schen', 'cleared': 'gel\u00f6scht',
          'backspace': 'eins l\u00f6schen', 'delete': 'eins l\u00f6schen', 'point': 'Komma',
          'plus minus': 'Vorzeichen wechseln', 'percent': 'Prozent',
          'negative': 'negativ', 'positive': 'positiv',
          "didn't understand. try: 25 plus 30": 'Nicht verstanden. Versuche: 25 plus 30'
        }
      };
      function speakPhrase(text) {
        const raw = String(text == null ? '' : text);
        const trimmed = raw.trim();

        // app.js builds spoken numbers with toLocaleString("en-US"), so 1234.5 arrives
        // as "1,234.5" no matter which voice is speaking. In Indonesian, German, Spanish
        // and others the comma IS the decimal mark, so that string can be read back as a
        // completely different number. Re-format it for the voice's own locale.
        if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed) || /^-?\d+(\.\d+)?$/.test(trimmed)) {
          const n = parseFloat(trimmed.replace(/,/g, ''));
          if (!isNaN(n)) {
            try { return n.toLocaleString(getSpeechLang(), { maximumFractionDigits: 10 }); }
            catch (e) { return raw; }
          }
        }

        const code = selLang === 'auto' ? String(navigator.language || '').slice(0, 2).toLowerCase() : selLang;
        const map = SPOKEN[code];
        if (!map) return text;
        const key = trimmed.toLowerCase();
        return map[key] !== undefined ? map[key] : text;
      }

      let voicePatched = false;
      function patchVoice() {
        if (voicePatched) return;      // wrapping the wrapper breaks the mic
        voicePatched = true;
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
          function PatchedSR() {
            const inst = new SR();
            Object.defineProperty(inst, 'lang', { get: () => getSpeechLang(), set: () => { }, configurable: true });
            return inst;
          }
          PatchedSR.prototype = SR.prototype;
          window.SpeechRecognition = PatchedSR;
          window.webkitSpeechRecognition = PatchedSR;
        }
        document.addEventListener('click', function (e) {
          if (!e.target.closest('.mic-btn')) return;
          if (window.recognition) {
            try { window.recognition.lang = getSpeechLang(); } catch (err) {
              try { Object.defineProperty(window.recognition, 'lang', { get: () => getSpeechLang(), set: () => { }, configurable: true }); } catch (e2) { }
            }
          }
        }, true);
        if (window.SpeechSynthesisUtterance) {
          const _Utt = window.SpeechSynthesisUtterance;
          window.SpeechSynthesisUtterance = function (text) {
            const utt = new _Utt(speakPhrase(text));
            Object.defineProperty(utt, 'lang', { get: () => getSpeechLang(), set: () => { }, configurable: true });
            return utt;
          };
          window.SpeechSynthesisUtterance.prototype = _Utt.prototype;
        }
      }

      // ── Language settings ──
      function escHtmlLang(v) {
        return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      }
      function injectLangSettings() {
        if (!LANG_PICKER_ENABLED) return;
        if (document.getElementById('lang-card')) return;
        const body = document.querySelector('.settings-body'); if (!body) return;
        const t = window.getTheme ? window.getTheme() : {};
        const card = document.createElement('div');
        card.id = 'lang-card'; card.className = 'settings-card';
        card.style.cssText = `background:${t.btnBg};border-color:${t.btnBorder}`;
        // The phone's language used to sit in its own accent-coloured banner, which was
        // styled identically to a selected button — so it always looked like a second
        // active choice. It is now folded into the "Follow phone" option it describes,
        // leaving exactly one highlighted row.
        const dev = navigator.language || 'en-US';
        const ordered = LANGS.slice().sort((a, b) => (a.code === 'auto' ? -1 : b.code === 'auto' ? 1 : 0));
        card.innerHTML = `
        <div class="settings-label" style="color:${t.btnText}">\u{1F30D} Voice Language</div>
        <div class="settings-desc"  style="color:${t.btnText};opacity:0.7;margin-bottom:6px">Language the mic listens for</div>
        <div id="lang-live" style="color:${t.btnText};opacity:0.85;font-size:0.8rem;font-weight:700;margin-bottom:10px">Mic will listen in: ${escHtmlLang(getSpeechLang())}</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${ordered.map(l => {
          const on = selLang === l.code;
          const label = l.code === 'auto' ? `${l.label} (${escHtmlLang(dev)})` : l.label;
          return `
            <button class="lang-btn" id="lb-${l.code}" onclick="ecSetLang('${l.code}')"
              aria-pressed="${on}"
              style="border-color:${on ? t.accent : t.btnBorder};color:${t.btnText};background:${on ? t.accent + '22' : 'transparent'}">
              <span style="flex:1">${label}</span>
              <span id="lc-${l.code}" style="color:${t.accent};display:${on ? 'inline' : 'none'}">\u2713</span>
            </button>`;
        }).join('')}
        </div>`;
        body.appendChild(card);
      }

      window.ecSetLang = function (code) {
        if (!LANG_PICKER_ENABLED) return;
        selLang = code; localStorage.setItem('talkcalc_lang', code);
        const t = window.getTheme ? window.getTheme() : {};
        LANGS.forEach(l => {
          const btn = document.getElementById('lb-' + l.code), chk = document.getElementById('lc-' + l.code);
          if (btn) { btn.style.borderColor = l.code === code ? t.accent : t.btnBorder; btn.style.background = l.code === code ? t.accent + '22' : 'transparent'; }
          if (chk) chk.style.display = l.code === code ? 'inline' : 'none';
        });
        // patchVoice() is NOT called again here. It installs getters that read
        // getSpeechLang() at the moment the mic starts, so one patch covers every
        // later change. Re-running it wrapped SpeechRecognition and
        // SpeechSynthesisUtterance inside themselves and added another document
        // click listener on every single tap.
        const live = document.getElementById('lang-live');
        if (live) live.textContent = 'Mic will listen in: ' + getSpeechLang();
        if (window.sciRefreshDisplay) window.sciRefreshDisplay();
        showToast(LANGS.find(l => l.code === code)?.label + ' selected');
      };

      function showToast(msg) {
        const t = window.getTheme ? window.getTheme() : {};
        const el = document.createElement('div'); el.textContent = msg;
        el.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:${t.accent || '#64FFDA'};color:${t.bg || '#0B1929'};padding:9px 18px;border-radius:18px;font-family:inherit;font-weight:700;font-size:0.88rem;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.25);white-space:nowrap`;
        document.body.appendChild(el); setTimeout(() => el.remove(), 2000);
      }

      function applyTheme() {
        const t = window.getTheme ? window.getTheme() : null; if (!t) return;
        const tabs = document.getElementById('ec-tabs');
        if (tabs) { tabs.style.borderColor = t.btnBorder; tabs.style.background = t.bg; tabs.querySelectorAll('.top-tab').forEach(b => { b.style.color = t.btnText; b.style.borderColor = t.btnBorder; }); }
        document.querySelectorAll('.pro-panel').forEach(p => { p.style.background = t.bg; p.style.color = t.btnText; });
        document.querySelectorAll('.conv-type-btn,.conv-unit-select,.converter-box,.conv-input-wrap,.currency-search').forEach(el => {
          el.style.borderColor = t.btnBorder; el.style.color = t.btnText;
          el.style.background = el.classList.contains('converter-box') || el.classList.contains('conv-input-wrap') ? t.displayBg : 'transparent';
        });
        const swapBtn = document.getElementById('conv-swap');
        if (swapBtn) swapBtn.style.color = t.btnText;
        // Set colour on the inputs, not just their wrappers: an <input> does not
        // inherit colour by default, so on dark themes the text stayed browser-black.
        document.querySelectorAll('.conv-input-wrap input,.pct-input-wrap input,.currency-search,.lst-add input')
          .forEach(el => { el.style.color = t.inputText || t.btnText; el.style.setProperty('--ec-ph', t.inputPlaceholder || t.btnText); });
        document.querySelectorAll('.pct-card,.pct-input-wrap').forEach(el => el.style.borderColor = t.btnBorder);
        document.querySelectorAll('.pct-result').forEach(el => el.style.color = t.displayText);
        injectSaveButtons();
        document.querySelectorAll('.pct-clear').forEach(el => { el.style.color = t.btnText; el.style.borderColor = t.btnBorder; });
        if (document.getElementById('sci-grid')?.children.length) renderSciGrid();
        const sd = document.getElementById('sci-disp'); if (sd) { sd.style.background = t.displayBg; sd.style.borderColor = t.btnBorder; }
        if (document.getElementById('lst-cards')) renderNotes();
        ['length', 'weight', 'currency'].forEach(type => { const b = document.getElementById('cbt-' + type); if (b) styleTab(b, type === convType); });
      }

      function observeTheme() {
        const app = document.getElementById('app'); if (!app) return;
        new MutationObserver(() => setTimeout(applyTheme, 10)).observe(app, { childList: true, subtree: false });
      }

    })();
