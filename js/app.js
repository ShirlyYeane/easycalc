// ========== TalkCalc - Accessible Calculator PWA ==========

// Shared icon set, drawn as SVG rather than typed as Unicode characters.
// Glyphs like ← ↗ ⋯ have no single font on Android that contains them all, so each
// resolves through font fallback to a different font: mismatched stroke weights,
// sizes and baselines, and font-weight is ignored because those fallbacks ship no
// bold. These share one 24px grid and one 2px round-capped stroke, and inherit
// colour via currentColor so themes keep working.
// Defined here because app.js loads before the inline script in index.html, so both
// can read it — and so the arrow exists in exactly one place.
const TC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
window.TC_ICON = {
  back:  TC_SVG + '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
  // The three-node graph is the share affordance people recognise; ↗ meant nothing.
  share: TC_SVG + '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.6 13.4 6.9 4"/><path d="m15.5 6.6-6.9 4"/></svg>',
  more:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>'
};

const THEMES = {
  midnight: {
    name: "Midnight Blue", emoji: "🌙",
    bg: "#0B1929", displayBg: "#112240", displayText: "#64FFDA",
    btnBg: "#1A3A5C", btnText: "#E6F1FF", btnBorder: "#2D5986",
    operatorBg: "#2979FF", operatorText: "#FFFFFF",
    equalsBg: "#64FFDA", equalsText: "#0B1929",
    clearBg: "#FF5252", clearText: "#FFFFFF",
    activeBg: "#64FFDA", activeText: "#0B1929",
    headerBg: "#0D2137", headerText: "#E6F1FF",
    settingsBg: "#0B1929", accent: "#64FFDA",
    micActive: "#FF5252", micInactive: "#2979FF",
    inputBg: "#112240", inputBorder: "#2D5986", inputText: "#E6F1FF", inputPlaceholder: "#5C7DA8",
  },
  rosewood: {
    name: "Rosewood", emoji: "🌹",
    bg: "#1A0A14", displayBg: "#2A1222", displayText: "#FFB6C1",
    btnBg: "#3D1A2E", btnText: "#FFE0E6", btnBorder: "#6B3050",
    operatorBg: "#D4527B", operatorText: "#FFFFFF",
    equalsBg: "#FFB6C1", equalsText: "#1A0A14",
    clearBg: "#FF4757", clearText: "#FFFFFF",
    activeBg: "#FFB6C1", activeText: "#1A0A14",
    headerBg: "#1F0E19", headerText: "#FFE0E6",
    settingsBg: "#1A0A14", accent: "#FFB6C1",
    micActive: "#FF4757", micInactive: "#D4527B",
    inputBg: "#2A1222", inputBorder: "#6B3050", inputText: "#FFE0E6", inputPlaceholder: "#8B5070",
  },
  forest: {
    name: "Forest", emoji: "🌿",
    bg: "#0A1F12", displayBg: "#122B1A", displayText: "#90EE90",
    btnBg: "#1A3D24", btnText: "#D4F5D4", btnBorder: "#2D6B3F",
    operatorBg: "#2E8B57", operatorText: "#FFFFFF",
    equalsBg: "#90EE90", equalsText: "#0A1F12",
    clearBg: "#E74C3C", clearText: "#FFFFFF",
    activeBg: "#90EE90", activeText: "#0A1F12",
    headerBg: "#0D2415", headerText: "#D4F5D4",
    settingsBg: "#0A1F12", accent: "#90EE90",
    micActive: "#E74C3C", micInactive: "#2E8B57",
    inputBg: "#122B1A", inputBorder: "#2D6B3F", inputText: "#D4F5D4", inputPlaceholder: "#5A8B6A",
  },
  lavender: {
    name: "Lavender", emoji: "💜",
    bg: "#F5F0FF", displayBg: "#FFFFFF", displayText: "#5B3E96",
    btnBg: "#EDE5FF", btnText: "#3D2566", btnBorder: "#C9B8E8",
    operatorBg: "#7C5CBF", operatorText: "#FFFFFF",
    equalsBg: "#F0883E", equalsText: "#FFFFFF",
    clearBg: "#E74C5A", clearText: "#FFFFFF",
    activeBg: "#7C5CBF", activeText: "#FFFFFF",
    headerBg: "#EDE5FF", headerText: "#3D2566",
    settingsBg: "#F5F0FF", accent: "#7C5CBF",
    micActive: "#F0883E", micInactive: "#7C5CBF",
    inputBg: "#FFFFFF", inputBorder: "#C9B8E8", inputText: "#3D2566", inputPlaceholder: "#A090C0",
  },
  highContrast: {
    name: "High Contrast", emoji: "♿",
    bg: "#000000", displayBg: "#1a1a1a", displayText: "#FFFF00",
    btnBg: "#2a2a2a", btnText: "#FFFFFF", btnBorder: "#FFFFFF",
    operatorBg: "#0055CC", operatorText: "#FFFFFF",
    equalsBg: "#CC5500", equalsText: "#FFFFFF",
    clearBg: "#880000", clearText: "#FFFFFF",
    activeBg: "#FFFF00", activeText: "#000000",
    headerBg: "#1a1a1a", headerText: "#FFFFFF",
    settingsBg: "#111111", accent: "#FFFF00",
    micActive: "#FF4444", micInactive: "#0055CC",
    inputBg: "#1a1a1a", inputBorder: "#555555", inputText: "#FFFFFF", inputPlaceholder: "#888888",
  },
};

// ===== VOICE MAPS =====
const BUTTON_LABELS = {
  "+": "plus", "-": "minus", "×": "times", "÷": "divided by",
  "=": "equals", "C": "clear", "⌫": "backspace", ".": "point",
  "±": "plus minus", "%": "percent",
};

const VOICE_MAP = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16",
  seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20", thirty: "30", forty: "40", fifty: "50",
  sixty: "60", seventy: "70", eighty: "80", ninety: "90", hundred: "100", thousand: "1000",
  plus: "+", add: "+", and: "+", minus: "-", subtract: "-",
  times: "×", multiply: "×", multiplied: "×", divide: "÷", divided: "÷", over: "÷",
  equals: "=", equal: "=", result: "=", answer: "=", clear: "C", reset: "C", delete: "C",
  backspace: "⌫", back: "⌫", undo: "⌫", point: ".", dot: ".", decimal: ".",
  percent: "%", percentage: "%",
};

const COMPOUND_TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SINGLE_DIGITS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };

function parseTokens(raw) {
  // Normalize all possible operator characters to standard ones FIRST
  let processed = raw
    .replace(/[×✕✖⨉⨯]/g, "*")    // all multiplication symbols → *
    .replace(/[÷➗⁄∕]/g, "/")      // all division symbols → /
    .replace(/[−–—]/g, "-")        // all dash/minus variants → -
    .replace(/[＋]/g, "+")          // fullwidth plus → +
    .replace(/[＝]/g, "=")          // fullwidth equals → =
    .replace(/[％]/g, "%")          // fullwidth percent → %
    .toLowerCase().trim();

  // Insert spaces around operators so "8*2.6" becomes "8 * 2.6"
  processed = processed
    .replace(/([0-9.])([x+\-*/=])/g, "$1 $2 ")
    .replace(/([x+\-*/=])([0-9.])/g, " $1 $2")
    .replace(/(%)/g, " $1 ");

  const words = processed.split(/[\s,]+/).filter(w => w.length > 0);
  const tokens = [];
  for (let i = 0; i < words.length; i++) {
    let word = words[i].replace(/[^a-z0-9.+\-*/=%]/g, "");
    if (!word) continue;

    // Handle negative numbers: "-6" as a single token
    if (/^-\d+\.?\d*$/.test(word)) { tokens.push(word); continue; }

    if (word === "*") { tokens.push("×"); continue; }
    if (word === "/") { tokens.push("÷"); continue; }
    if (word === "=") { tokens.push("="); continue; }
    if (word === "%") { tokens.push("%"); continue; }

    // For + and -, check if it's a negative sign or an operator
    if (word === "-") {
      const lastToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;
      const isAfterOperator = lastToken && ["+", "-", "×", "÷"].includes(lastToken);
      const nextWord = i + 1 < words.length ? words[i + 1].replace(/[^a-z0-9.]/g, "") : "";
      const nextIsNumber = /^\d+\.?\d*$/.test(nextWord) || (VOICE_MAP[nextWord] && /^\d+$/.test(VOICE_MAP[nextWord]));
      if (isAfterOperator && nextIsNumber) {
        i++;
        const num = VOICE_MAP[nextWord] || nextWord;
        tokens.push("-" + num);
        continue;
      }
      tokens.push("-"); continue;
    }
    if (word === "+") { tokens.push("+"); continue; }

    if (word === "x" && tokens.length > 0) { tokens.push("×"); continue; }
    // Handle "per cent" as two words
    if (word === "per" && i + 1 < words.length) {
      const next = words[i + 1].replace(/[^a-z]/g, "");
      if (next === "cent" || next === "sent") { tokens.push("%"); i++; continue; }
    }
    // Handle "negative five" → "-5"
    if (word === "negative" && i + 1 < words.length) {
      const next = words[i + 1].replace(/[^a-z0-9.]/g, "");
      const num = VOICE_MAP[next] || (/^\d+\.?\d*$/.test(next) ? next : null);
      if (num) { tokens.push("-" + num); i++; continue; }
    }
    // Handle "minus" as negative when after an operator
    if (word === "minus" && i + 1 < words.length) {
      const lastToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;
      const isAfterOperator = lastToken && ["+", "-", "×", "÷"].includes(lastToken);
      const next = words[i + 1].replace(/[^a-z0-9.]/g, "");
      const num = VOICE_MAP[next] || (/^\d+\.?\d*$/.test(next) ? next : null);
      if (isAfterOperator && num) { tokens.push("-" + num); i++; continue; }
    }

    // Handle "point/dot/decimal" — merge with surrounding numbers: "3 point 5" → "3.5"
    if (word === "point" || word === "dot" || word === "decimal" || word === ".") {
      const lastToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;
      const lastIsNumber = lastToken && /^-?\d+$/.test(lastToken);
      // Peek ahead for the decimal part
      const nextWord = i + 1 < words.length ? words[i + 1].replace(/[^a-z0-9]/g, "") : "";
      const nextNum = VOICE_MAP[nextWord] || (/^\d+$/.test(nextWord) ? nextWord : null);

      if (lastIsNumber && nextNum) {
        // Merge: "3" + "." + "5" → "3.5"
        tokens[tokens.length - 1] = lastToken + "." + nextNum;
        i++;
        continue;
      } else if (lastIsNumber) {
        // "3 point" with no number after → just append dot
        tokens[tokens.length - 1] = lastToken + ".";
        continue;
      }
      // Standalone dot
      tokens.push(".");
      continue;
    }

    if (COMPOUND_TENS[word] && i + 1 < words.length) {
      const next = words[i + 1].replace(/[^a-z]/g, "");
      if (SINGLE_DIGITS[next]) { tokens.push(String(COMPOUND_TENS[word] + SINGLE_DIGITS[next])); i++; continue; }
    }
    if (/^\d+%$/.test(word)) { tokens.push(word.replace("%", "")); tokens.push("%"); continue; }
    if (["by", "the", "is", "what", "whats", "what's", "calculate", "please", "can", "you", "of", "off"].includes(word)) continue;
    if (VOICE_MAP[word]) { tokens.push(VOICE_MAP[word]); continue; }
    if (/^\d+\.?\d*$/.test(word)) { tokens.push(word); continue; }
  }
  return tokens;
}

// ===== STATE =====
let state = {
  display: "0",
  prevValue: null,
  operator: null,
  resetNext: false,
  history: "",
  fontSize: 2, // 0=normal, 1=large, 2=xl
  voiceEnabled: true,
  vibrationEnabled: true,
  themeKey: "midnight",
  showSettings: false,
  isListening: false,
  voiceStatus: "",
  micSupported: false,
  textInput: "",
  showInputHelp: false,
};

// Load saved preferences
try {
  const saved = JSON.parse(localStorage.getItem("easycalc_prefs"));
  if (saved) {
    state.fontSize = saved.fontSize ?? state.fontSize;
    state.voiceEnabled = saved.voiceEnabled ?? state.voiceEnabled;
    state.vibrationEnabled = saved.vibrationEnabled ?? state.vibrationEnabled;
    state.themeKey = saved.themeKey ?? state.themeKey;
  }
} catch (e) { }

function savePrefs() {
  try {
    localStorage.setItem("easycalc_prefs", JSON.stringify({
      fontSize: state.fontSize, voiceEnabled: state.voiceEnabled,
      vibrationEnabled: state.vibrationEnabled, themeKey: state.themeKey,
    }));
  } catch (e) { }
}

// ===== HELPERS =====
const FONT_SIZES = [
  { display: 2.2, btn: 1.4, label: "Normal" },
  { display: 3.0, btn: 1.8, label: "Large" },
  { display: 3.8, btn: 2.2, label: "Extra Large" },
];
const MIN_HEIGHTS = [54, 64, 74];

function getTheme() { return THEMES[state.themeKey]; }

function vibrate(ms = 30) {
  if (state.vibrationEnabled && navigator.vibrate) navigator.vibrate(ms);
}

function speak(text) {
  if (state.voiceEnabled && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9; u.volume = 1; u.lang = "en-US";
    window.speechSynthesis.speak(u);
  }
}

function speakNumber(numStr) {
  if (state.voiceEnabled && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const num = parseFloat(numStr);
    const spoken = isNaN(num) ? numStr : num.toLocaleString("en-US", { maximumFractionDigits: 10 });
    const u = new SpeechSynthesisUtterance(spoken);
    u.rate = 0.9; u.volume = 1; u.lang = "en-US";
    window.speechSynthesis.speak(u);
  }
}

function speakResult(resultStr) {
  if (state.voiceEnabled && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const u1 = new SpeechSynthesisUtterance("equals");
    u1.rate = 0.9; u1.volume = 1; u1.lang = "en-US";
    u1.onend = () => speakNumber(resultStr);
    window.speechSynthesis.speak(u1);
  }
}

function calculate(a, b, op) {
  const x = parseFloat(a), y = parseFloat(b);
  switch (op) {
    case "+": return x + y;
    case "-": return x - y;
    case "×": return x * y;
    case "÷": return y === 0 ? "Error" : x / y;
    default: return y;
  }
}

function formatResult(r) {
  return typeof r === "number" ? parseFloat(r.toFixed(10)).toString() : r;
}

// ===== CALCULATOR LOGIC =====
const MAX_DIGITS = 15;

function handleNumber(num) {
  vibrate();
  speak(num === "." ? "point" : num);
  if (state.resetNext) {
    state.resetNext = false;
    state.display = num === "." ? "0." : num;
  } else {
    if (state.display === "-0") state.display = "-" + num;
    else if (state.display === "0" && num !== ".") state.display = num;
    else if (num === "." && state.display.includes(".")) return;
    else {
      // Max digit limit
      const digits = state.display.replace(/[^0-9]/g, "").length;
      if (digits >= MAX_DIGITS && num !== ".") return;
      state.display += num;
    }
  }
  render();
}

function handleFullNumber(numStr) {
  vibrate();
  speakNumber(numStr);
  if (state.resetNext) {
    state.resetNext = false;
    state.display = numStr;
  } else {
    state.display = state.display === "0" ? numStr : state.display + numStr;
  }
  render();
}

function handleOperator(op) {
  vibrate(50);
  speak(BUTTON_LABELS[op] || op);
  if (state.prevValue !== null && !state.resetNext) {
    const r = formatResult(calculate(state.prevValue, state.display, state.operator));
    state.display = r; state.prevValue = r; state.history = `${r} ${op}`;
  } else {
    state.prevValue = state.display; state.history = `${state.display} ${op}`;
  }
  state.operator = op; state.resetNext = true;
  render();
}

function handleEquals() {
  vibrate(80);
  if (state.prevValue === null || state.operator === null) return;
  const r = formatResult(calculate(state.prevValue, state.display, state.operator));
  state.history = `${state.prevValue} ${state.operator} ${state.display} =`;
  state.display = r;
  speakResult(r);
  state.prevValue = null; state.operator = null; state.resetNext = true;
  render();
}

function handleClear() {
  vibrate(100); speak("cleared");
  state.display = "0"; state.prevValue = null; state.operator = null;
  state.resetNext = false; state.history = "";
  render();
}

function handleBackspace() {
  vibrate(); speak("delete");
  state.display = state.display.length > 1 ? state.display.slice(0, -1) : "0";
  render();
}

function handlePlusMinus() {
  vibrate();
  if (state.resetNext) {
    // After an operator, start fresh with negative zero
    state.resetNext = false;
    state.display = "-0";
  } else if (state.display === "-0") {
    state.display = "0";
  } else {
    state.display = state.display.startsWith("-") ? state.display.slice(1) : `-${state.display}`;
  }
  speak(state.display.startsWith("-") ? "negative" : "positive");
  render();
}

function handlePercent() {
  vibrate();
  state.display = formatResult(parseFloat(state.display) / 100);
  speakNumber(state.display);
  render();
}

function handlePress(label) {
  if ("0123456789.".includes(label)) handleNumber(label);
  else if (["+", "-", "×", "÷"].includes(label)) handleOperator(label);
  else if (label === "=") handleEquals();
  else if (label === "C") handleClear();
  else if (label === "⌫") handleBackspace();
  else if (label === "±") handlePlusMinus();
  else if (label === "%") handlePercent();
}

function processNaturalInput(raw) {
  const tokens = parseTokens(raw);
  if (tokens.length === 0) {
    speak("Didn't understand. Try: 25 plus 30");
    showStatus('Try: "25 plus 30" or "25 + 30"');
    return;
  }
  const hasOp = tokens.some(t => ["+", "-", "×", "÷"].includes(t));
  const last = tokens[tokens.length - 1];
  const endsWithNumber = /^-?\d+\.?\d*$/.test(last);
  const endsWithPercent = last === "%";
  if (hasOp && (endsWithNumber || endsWithPercent) && !tokens.includes("=")) tokens.push("=");

  const startsWithOp = ["+", "-", "×", "÷"].includes(tokens[0]);
  if (!startsWithOp) {
    state.display = "0"; state.prevValue = null; state.operator = null;
    state.resetNext = false; state.history = "";
  }

  showStatus(`Got it: ${tokens.join(" ")}`);

  for (const token of tokens) {
    if (/^-?\d+\.?\d*$/.test(token)) {
      const isNegSingleDigit = token.startsWith("-") && token.length === 2;
      const isSingleDigit = !token.startsWith("-") && token.length === 1;
      if (isSingleDigit) {
        if (state.resetNext) { state.resetNext = false; state.display = token === "." ? "0." : token; }
        else if (state.display === "0" && token !== ".") state.display = token;
        else if (token === "." && state.display.includes(".")) { }
        else state.display += token;
      } else {
        if (state.resetNext) { state.resetNext = false; state.display = token; }
        else state.display = state.display === "0" ? token : state.display + token;
      }
    }
    else if (["+", "-", "×", "÷"].includes(token)) {
      if (state.prevValue !== null && !state.resetNext) {
        const r = formatResult(calculate(state.prevValue, state.display, state.operator));
        state.display = r; state.prevValue = r; state.history = `${r} ${token}`;
      } else {
        state.prevValue = state.display; state.history = `${state.display} ${token}`;
      }
      state.operator = token; state.resetNext = true;
    }
    else if (token === "=") {
      if (state.prevValue !== null && state.operator !== null) {
        const r = formatResult(calculate(state.prevValue, state.display, state.operator));
        state.history = `${state.prevValue} ${state.operator} ${state.display} =`;
        state.display = r; state.prevValue = null; state.operator = null; state.resetNext = true;
        speakResult(r);
      }
    }
    else if (token === "C") { state.display = "0"; state.prevValue = null; state.operator = null; state.resetNext = false; state.history = ""; }
    else if (token === "⌫") { state.display = state.display.length > 1 ? state.display.slice(0, -1) : "0"; }
    else if (token === "%") { state.display = formatResult(parseFloat(state.display) / 100); }
    else if (token === ".") {
      if (state.resetNext) { state.resetNext = false; state.display = "0."; }
      else if (!state.display.includes(".")) state.display += ".";
    }
  }
  render();
}

function showStatus(msg) {
  state.voiceStatus = msg;
  render();
  setTimeout(() => { state.voiceStatus = ""; render(); }, 3000);
}

// ===== SPEECH RECOGNITION =====
let recognition = null;
function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { state.micSupported = false; return; }
  recognition = new SR();
  recognition.continuous = false; recognition.interimResults = false; recognition.lang = "en-US";
  recognition.onresult = (e) => {
    const t = e.results[0][0].transcript;
    state.textInput = t;
    processNaturalInput(t);
    state.textInput = "";
    render();
  };
  recognition.onerror = (e) => {
    if (e.error === "not-allowed") { showStatus("Mic blocked — type below"); state.micSupported = false; }
    else showStatus("Couldn't hear. Try again or type.");
    state.isListening = false; render();
  };
  recognition.onend = () => { state.isListening = false; render(); };
  state.micSupported = true;
}

function toggleListening() {
  if (!recognition) return;
  vibrate(50);
  if (state.isListening) {
    recognition.stop(); state.isListening = false; state.voiceStatus = "";
  } else {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    try { recognition.start(); state.isListening = true; state.voiceStatus = "Listening..."; }
    catch (e) { showStatus("Mic busy, type instead"); }
  }
  render();
}

// ===== RENDER =====
function render() {
  const t = getTheme();
  const fs = FONT_SIZES[state.fontSize];
  const mh = MIN_HEIGHTS[state.fontSize];
  const app = document.getElementById("app");

  // Update theme color meta
  document.querySelector('meta[name="theme-color"]').content = t.headerBg;

  if (state.showSettings) {
    app.innerHTML = renderSettings(t, fs);
    bindSettingsEvents();
  } else {
    app.innerHTML = renderCalc(t, fs, mh);
    bindCalcEvents();
    // Format display number with locale delimiter
    if (window._tcFormatDisplay) window._tcFormatDisplay();
  }
}

function renderCalc(t, fs, mh) {
  // Auto-scale font size based on digit count, with max 15 digits
  const len = state.display.length;
  let displayFs;
  if (len > 15) displayFs = fs.display * 0.4;
  else if (len > 12) displayFs = fs.display * 0.5;
  else if (len > 10) displayFs = fs.display * 0.6;
  else if (len > 8) displayFs = fs.display * 0.75;
  else displayFs = fs.display;
  const buttons = [["C", "±", "%", "÷"], ["7", "8", "9", "×"], ["4", "5", "6", "-"], ["1", "2", "3", "+"], ["⌫", "0", ".", "="]];

  let btnHtml = buttons.map(row =>
    `<div class="btn-row">${row.map(label => {
      let bg = t.btnBg, fg = t.btnText, border = t.btnBorder;
      if (label === "C") { bg = t.clearBg; fg = t.clearText; border = t.clearBg; }
      else if (["+", "-", "×", "÷"].includes(label)) { bg = t.operatorBg; fg = t.operatorText; border = t.operatorBg; }
      else if (label === "=") { bg = t.equalsBg; fg = t.equalsText; border = t.equalsBg; }
      return `<button class="calc-btn" data-label="${label}" aria-label="${BUTTON_LABELS[label] || label}"
        style="background:${bg};color:${fg};border-color:${border};font-size:${fs.btn}rem;min-height:${mh}px">${label}</button>`;
    }).join("")}</div>`
  ).join("");

  const micBtn = state.micSupported ? `
    <button class="mic-btn" id="micBtn" aria-label="${state.isListening ? 'Stop' : 'Voice input'}"
      style="background:${state.isListening ? '#00C853' : t.micInactive};border-color:${state.isListening ? '#00C853' : t.micInactive};
      ${state.isListening ? `box-shadow:0 0 0 6px rgba(0,200,83,0.3);animation:micPulse 1.5s infinite` : ''}">
      🎤
    </button>` : "";

  return `
    <div class="calc-main" style="background:${t.bg}">
      <div class="header" style="background:${t.headerBg};border-color:${t.btnBorder}">
        <h1 style="color:${t.headerText}">🎙️ TalkCalc</h1>
        <button id="settingsBtn" style="background:${t.btnBg};border-color:${t.btnBorder};color:${t.headerText}">⚙️</button>
      </div>
      <div class="display-wrap" style="background:${t.displayBg};border-color:${t.btnBorder}">
        <div class="history" style="color:${t.displayText};font-size:${fs.btn}rem">${state.history}</div>
        <div class="display-main" role="status" aria-live="polite" aria-label="Display: ${state.display}"
          style="color:${t.displayText};font-size:${displayFs}rem">${state.display}</div>
        ${state.voiceStatus ? `<div class="voice-status ${state.isListening ? 'listening' : ''}"
          style="color:${state.isListening ? t.micActive : t.accent}">${state.voiceStatus}</div>` : ""}
      </div>
      <div class="input-bar">
        <div class="input-wrap" style="background:${t.inputBg};border-color:${t.inputBorder}">
          <input type="text" id="textInput" value="${escHtml(state.textInput)}"
            placeholder='e.g. "234 times 39" or "234 * 39"'
            aria-label="Type a calculation"
            style="color:${t.inputText};font-size:${state.fontSize === 2 ? 1.1 : 1}rem">
          <button class="go-btn ${state.textInput ? 'show' : ''}" id="goBtn"
            style="background:${t.equalsBg};color:${t.equalsText}">GO</button>
        </div>
        ${micBtn}
      </div>
      <div class="help-toggle">
        <button id="helpToggle" style="color:${t.accent}">${state.showInputHelp ? 'Hide examples ▲' : 'Show examples ▼'}</button>
        <div class="help-box ${state.showInputHelp ? 'show' : ''}"
          style="background:${t.displayBg};border-color:${t.btnBorder};color:${t.btnText}">
          <span style="color:${t.accent};font-weight:700">25 plus 30</span> → 25 + 30<br>
          <span style="color:${t.accent};font-weight:700">twelve times 4 equals</span> → 12 × 4 =<br>
          <span style="color:${t.accent};font-weight:700">50 / 5 =</span> → 50 ÷ 5 =<br>
          <span style="color:${t.accent};font-weight:700">clear</span> → resets all
        </div>
      </div>
      <div class="btn-grid">${btnHtml}</div>
      <div class="footer" style="color:${t.headerText}">Voice, text, touch & keyboard supported</div>
    </div>`;
}

function renderSettings(t, fs) {
  // All themes are free for now
  const themeButtons = Object.entries(THEMES).map(([key, th]) => {
    const isSelected = state.themeKey === key;
    return `
    <button class="theme-btn" data-theme="${key}"
      style="border-color:${isSelected ? t.accent : t.btnBorder};
      background:${isSelected ? t.accent + '22' : 'transparent'};color:${t.btnText}">
      <div class="theme-preview" style="background:${th.bg};border-color:${th.accent}">${th.emoji}</div>
      ${th.name}${isSelected ? ' ✓' : ''}
    </button>`;
  }).join("");

  // Fixed font size for buttons so they stay equal size
  const sizeLabels = ["A", "A", "A"];
  const sizeFontSizes = ["1.0rem", "1.3rem", "1.6rem"];
  const sizeButtons = FONT_SIZES.map((s, i) => `
    <button class="size-btn" data-size="${i}"
      style="border-color:${state.fontSize === i ? t.accent : t.btnBorder};
      background:${state.fontSize === i ? t.accent : 'transparent'};
      color:${state.fontSize === i ? t.bg : t.btnText};
      font-size:${sizeFontSizes[i]};
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
      <span style="font-size:${sizeFontSizes[i]};font-weight:800">A</span>
      <span style="font-size:0.75rem;font-weight:600;opacity:0.8">${s.label}</span>
    </button>`).join("");

  return `
    <div class="settings show" style="background:${t.settingsBg};color:${t.headerText}">
      <div class="settings-header" style="background:${t.headerBg};border-color:${t.btnBorder}">
        <button id="backBtn" style="border-color:${t.btnBorder};color:${t.headerText}">${window.TC_ICON.back}<span>Back</span></button>
        <h1>⚙️ Settings</h1>
      </div>
      <div class="settings-body">
        <div class="settings-card" style="background:${t.btnBg};border-color:${t.btnBorder}">
          <div class="settings-row">
            <div>
              <div class="settings-label">🔊 Voice Output</div>
              <div class="settings-desc">Speak buttons & results</div>
            </div>
            <div class="toggle" id="toggleVoice" role="switch" aria-checked="${state.voiceEnabled}"
              style="background:${state.voiceEnabled ? t.accent : t.btnBg};border-color:${state.voiceEnabled ? t.accent : t.btnBorder}">
              <div class="toggle-knob" style="background:${state.voiceEnabled ? t.bg : t.btnText};left:${state.voiceEnabled ? '32px' : '2px'}"></div>
            </div>
          </div>
        </div>
        <div class="settings-card" style="background:${t.btnBg};border-color:${t.btnBorder}">
          <div class="settings-row">
            <div>
              <div class="settings-label">📳 Haptic Vibration</div>
              <div class="settings-desc">Vibrate on press</div>
            </div>
            <div class="toggle" id="toggleVibration" role="switch" aria-checked="${state.vibrationEnabled}"
              style="background:${state.vibrationEnabled ? t.accent : t.btnBg};border-color:${state.vibrationEnabled ? t.accent : t.btnBorder}">
              <div class="toggle-knob" style="background:${state.vibrationEnabled ? t.bg : t.btnText};left:${state.vibrationEnabled ? '32px' : '2px'}"></div>
            </div>
          </div>
        </div>
        <div class="settings-card" style="background:${t.btnBg};border-color:${t.btnBorder}">
          <div class="settings-label">🔤 Text Size</div>
          <div class="size-btns">${sizeButtons}</div>
        </div>
        <div class="settings-card" style="background:${t.btnBg};border-color:${t.btnBorder}">
          <div class="settings-label" style="margin-bottom:12px">🎨 Color Theme</div>
          <div style="display:flex;flex-direction:column;gap:8px">${themeButtons}</div>
        </div>
        <div class="settings-card" style="background:${t.btnBg};border-color:${t.btnBorder};font-size:0.95rem;line-height:1.7">
          <div class="settings-label" style="margin-bottom:8px">🎤 Voice & Text Commands</div>
          <div style="opacity:0.85">
            <b>Speak</b> or <b>type</b> naturally:<br><br>
            <span style="color:${t.accent};font-weight:700">"25 plus 30"</span> → 25 + 30<br>
            <span style="color:${t.accent};font-weight:700">"twelve times four equals"</span> → 12 × 4 =<br>
            <span style="color:${t.accent};font-weight:700">"fifty divided by five"</span> → 50 ÷ 5<br>
            <span style="color:${t.accent};font-weight:700">"clear"</span> → resets calculator<br><br>
            Or type math directly: <span style="color:${t.accent};font-weight:700">25 + 30 =</span>
          </div>
        </div>
        <div class="settings-card" style="background:${t.btnBg};border-color:${t.btnBorder};font-size:0.95rem;line-height:1.6">
          <div class="settings-label" style="margin-bottom:8px">✨ All Features</div>
          <div style="opacity:0.8">
            • Extra-large touch targets<br>
            • Voice input — speak calculations<br>
            • Text input — type naturally<br>
            • Voice output — hear every action<br>
            • Haptic vibration on press<br>
            • 5 beautiful color themes<br>
            • Full keyboard navigation<br>
            • Screen reader (ARIA) support<br>
            • Adjustable text sizes<br>
            • Works offline (PWA)<br>
            • No ads, no tracking
          </div>
        </div>
      </div>
    </div>`;
}

function escHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

// ===== EVENT BINDING =====
function bindCalcEvents() {
  document.getElementById("settingsBtn")?.addEventListener("click", () => {
    vibrate(); state.showSettings = true; render();
  });

  document.querySelectorAll(".calc-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const label = btn.dataset.label;
      const t = getTheme();
      btn.style.background = t.activeBg; btn.style.color = t.activeText;
      btn.style.transform = "scale(0.95)";
      setTimeout(() => { btn.style.background = ""; btn.style.color = ""; btn.style.transform = ""; }, 150);
      handlePress(label);
    });
  });

  const textInput = document.getElementById("textInput");
  if (textInput) {
    textInput.addEventListener("input", (e) => {
      state.textInput = e.target.value;
      const goBtn = document.getElementById("goBtn");
      if (goBtn) goBtn.classList.toggle("show", !!state.textInput);
    });
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submitTextInput(); }
    });
  }

  document.getElementById("goBtn")?.addEventListener("click", submitTextInput);
  document.getElementById("micBtn")?.addEventListener("click", toggleListening);
  document.getElementById("helpToggle")?.addEventListener("click", () => {
    state.showInputHelp = !state.showInputHelp; render();
  });
}

function submitTextInput() {
  if (!state.textInput.trim()) return;
  vibrate();
  processNaturalInput(state.textInput.trim());
  state.textInput = "";
  render();
  // Re-focus input
  setTimeout(() => document.getElementById("textInput")?.focus(), 50);
}

function bindSettingsEvents() {
  document.getElementById("backBtn")?.addEventListener("click", () => {
    vibrate(); state.showSettings = false; savePrefs(); render();
  });

  document.getElementById("toggleVoice")?.addEventListener("click", () => {
    vibrate(); state.voiceEnabled = !state.voiceEnabled; savePrefs(); render();
  });

  document.getElementById("toggleVibration")?.addEventListener("click", () => {
    vibrate(); state.vibrationEnabled = !state.vibrationEnabled; savePrefs(); render();
  });

  document.querySelectorAll(".size-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      vibrate(); state.fontSize = parseInt(btn.dataset.size); savePrefs(); render();
    });
  });

  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.theme;
      vibrate(); state.themeKey = key; savePrefs(); render();
    });
  });
}

// ===== KEYBOARD =====
document.addEventListener("keydown", (e) => {
  if (state.showSettings) return;
  const input = document.getElementById("textInput");
  if (document.activeElement === input) return;
  if (document.activeElement?.closest?.('.pro-panel')) return;
  const proIds = ['ec-panel-convert', 'ec-panel-pct', 'ec-panel-sci', 'ec-panel-notes'];
  if (proIds.some(id => document.getElementById(id)?.classList.contains('active'))) return;
  const map = { Enter: "=", "=": "=", Escape: "C", Delete: "C", Backspace: "⌫", "+": "+", "-": "-", "*": "×", "/": "÷" };
  if ("0123456789.".includes(e.key)) { e.preventDefault(); handlePress(e.key); }
  else if (map[e.key]) { e.preventDefault(); handlePress(map[e.key]); }
});

// ===== INIT =====
initSpeechRecognition();
render();

// Service worker disabled during development
// if ("serviceWorker" in navigator) {
//   navigator.serviceWorker.register("/sw.js").catch(() => { });
// }
