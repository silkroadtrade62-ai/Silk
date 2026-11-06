(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const exprEl = $("expr");
  const resultEl = $("result");
  const keysEl = $("keys");
  const historyEl = $("history");
  const historyList = $("historyList");
  const historyEmpty = $("historyEmpty");

  const OPS = "+-*/";
  let expr = "";        // ichki ifoda: 0-9 . + - * / ( ) %
  let justEvaluated = false;
  let lastAnswer = "";
  let history = load("calc-history", []);

  // ---------- Xavfsiz ifoda tahlilchisi (eval ishlatilmaydi) ----------
  function evaluate(src) {
    let i = 0;
    const peek = () => src[i];
    const fail = () => { throw new Error("syntax"); };

    function parseExpr() {
      let v = parseTerm();
      while (peek() === "+" || peek() === "-") {
        const op = src[i++];
        const r = parseTerm();
        v = op === "+" ? v + r : v - r;
      }
      return v;
    }
    function parseTerm() {
      let v = parseFactor();
      while (peek() === "*" || peek() === "/") {
        const op = src[i++];
        const r = parseFactor();
        if (op === "/") {
          if (r === 0) throw new Error("div0");
          v /= r;
        } else v *= r;
      }
      return v;
    }
    function parseFactor() {
      if (peek() === "-") { i++; return -parseFactor(); }
      if (peek() === "+") { i++; return parseFactor(); }
      let v = parsePrimary();
      while (peek() === "%") { i++; v /= 100; }
      return v;
    }
    function parsePrimary() {
      if (peek() === "(") {
        i++;
        const v = parseExpr();
        if (peek() !== ")") fail();
        i++;
        return v;
      }
      const start = i;
      while (i < src.length && /[0-9.]/.test(src[i])) i++;
      if (start === i) fail();
      const n = Number(src.slice(start, i));
      if (Number.isNaN(n)) fail();
      return n;
    }

    const v = parseExpr();
    if (i !== src.length) fail();
    if (!Number.isFinite(v)) throw new Error("overflow");
    return parseFloat(v.toPrecision(12));
  }

  // Yopilmagan qavslarni avtomatik yopib, oxiridagi operatorni olib tashlab hisoblash
  function tryPreview(src) {
    let s = src.replace(/[+\-*/(.]+$/, "");
    if (!s) return null;
    const open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
    s += ")".repeat(Math.max(0, open));
    try { return evaluate(s); } catch { return null; }
  }

  // ---------- Formatlash ----------
  function formatNumber(n) {
    if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-9 && n !== 0)) {
      return n.toExponential(6).replace(".", ",").replace("e+", "e");
    }
    const [int, dec] = String(n).split(".");
    const sign = int.startsWith("-") ? "−" : "";
    const grouped = int.replace("-", "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return sign + grouped + (dec ? "," + dec : "");
  }

  function prettyExpr(s) {
    return s
      .replace(/\d+(\.\d*)?/g, (m) => {
        const [a, b] = m.split(".");
        return a.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (b !== undefined ? "," + b : "");
      })
      .replace(/\*/g, " × ")
      .replace(/\//g, " ÷ ")
      .replace(/\+/g, " + ")
      .replace(/-/g, " − ");
  }

  function setResult(text, isError = false) {
    resultEl.textContent = text;
    resultEl.classList.toggle("error", isError);
    resultEl.classList.toggle("small", !isError && text.length > 9 && text.length <= 13);
    resultEl.classList.toggle("tiny", !isError && text.length > 13);
  }

  function render() {
    exprEl.textContent = prettyExpr(expr);
    if (!expr) { setResult("0"); return; }
    const v = tryPreview(expr);
    if (v !== null) setResult(formatNumber(v));
  }

  // ---------- Kiritish mantig'i ----------
  const last = () => expr.slice(-1);
  const isDigit = (c) => /[0-9]/.test(c);
  const currentNumber = () => (expr.match(/[0-9.]*$/) || [""])[0];

  function inputDigit(d) {
    if (justEvaluated) { expr = ""; justEvaluated = false; }
    if (last() === ")" || last() === "%") expr += "*";
    const num = currentNumber();
    if (num === "0" && d !== ".") expr = expr.slice(0, -1);
    expr += d;
    render();
  }

  function inputDot() {
    if (justEvaluated) { expr = ""; justEvaluated = false; }
    if (currentNumber().includes(".")) return;
    if (last() === ")" || last() === "%") expr += "*";
    if (!isDigit(last())) expr += "0";
    expr += ".";
    render();
  }

  function inputOp(op) {
    if (justEvaluated) { expr = lastAnswer; justEvaluated = false; }
    if (!expr) {
      if (op === "-") expr = "-";
      else if (lastAnswer) expr = lastAnswer + op;
      render();
      return;
    }
    const l = last();
    if (l === "(") { if (op === "-") expr += "-"; render(); return; }
    if (OPS.includes(l)) {
      // "*-" yoki "/-" kabi unar minusga ruxsat
      if (op === "-" && (l === "*" || l === "/")) { expr += "-"; render(); return; }
      expr = expr.replace(/[+\-*/]+$/, "");
      if (!expr || last() === "(") { if (op === "-") expr += "-"; render(); return; }
    }
    if (l === ".") expr += "0";
    expr += op;
    render();
  }

  function inputParen() {
    if (justEvaluated) { justEvaluated = false; expr = lastAnswer; }
    const open = (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length;
    const l = last();
    if (open > 0 && (isDigit(l) || l === ")" || l === "%")) {
      expr += ")";
    } else {
      if (isDigit(l) || l === ")" || l === "%" || l === ".") expr += "*";
      expr += "(";
    }
    render();
  }

  function inputPercent() {
    if (justEvaluated) { justEvaluated = false; expr = lastAnswer; }
    const l = last();
    if (isDigit(l) || l === ")") { expr += "%"; render(); }
  }

  function backspace() {
    if (justEvaluated) { clearAll(); return; }
    expr = expr.slice(0, -1);
    render();
  }

  function clearAll() {
    expr = "";
    justEvaluated = false;
    render();
  }

  function equals() {
    if (!expr || justEvaluated) return;
    let s = expr.replace(/[+\-*/(]+$/, "");
    const open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
    s += ")".repeat(Math.max(0, open));
    try {
      const v = evaluate(s);
      exprEl.textContent = prettyExpr(s) + " =";
      setResult(formatNumber(v));
      lastAnswer = String(v);
      addHistory(s, v);
      expr = lastAnswer;
      justEvaluated = true;
      resultEl.animate(
        [{ transform: "translateY(8px)", opacity: 0.4 }, { transform: "none", opacity: 1 }],
        { duration: 220, easing: "ease-out" }
      );
    } catch (e) {
      const msg = e.message === "div0" ? "Nolga bo'lib bo'lmaydi"
        : e.message === "overflow" ? "Juda katta son" : "Xato ifoda";
      setResult(msg, true);
      expr = "";
      justEvaluated = false;
    }
  }

  // ---------- Tarix ----------
  function addHistory(e, v) {
    history.unshift({ e, v });
    history = history.slice(0, 30);
    save("calc-history", history);
    renderHistory();
  }

  function renderHistory() {
    historyList.innerHTML = "";
    historyEmpty.style.display = history.length ? "none" : "block";
    for (const item of history) {
      const li = document.createElement("li");
      const a = document.createElement("div");
      a.className = "h-expr";
      a.textContent = prettyExpr(item.e) + " =";
      const b = document.createElement("div");
      b.className = "h-res";
      b.textContent = formatNumber(item.v);
      li.append(a, b);
      li.addEventListener("click", () => {
        expr = String(item.v);
        lastAnswer = expr;
        justEvaluated = true;
        exprEl.textContent = prettyExpr(item.e) + " =";
        setResult(formatNumber(item.v));
        toggleHistory(false);
      });
      historyList.append(li);
    }
  }

  function toggleHistory(force) {
    const open = force ?? !historyEl.classList.contains("open");
    historyEl.classList.toggle("open", open);
    historyEl.setAttribute("aria-hidden", String(!open));
  }

  // ---------- Mavzu ----------
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
  }
  const savedTheme = load("calc-theme", null);
  applyTheme(savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

  // ---------- localStorage yordamchilari ----------
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* e'tiborsiz */ }
  }

  // ---------- Hodisalar ----------
  function handle(action, value) {
    if (value !== undefined) {
      if (isDigit(value)) inputDigit(value);
      else if (value === ".") inputDot();
      else if (OPS.includes(value)) inputOp(value);
      return;
    }
    ({ clear: clearAll, back: backspace, percent: inputPercent, paren: inputParen, equals })[action]?.();
  }

  keysEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".k");
    if (!btn) return;
    handle(btn.dataset.action, btn.dataset.value);
  });

  function flash(selector) {
    const btn = keysEl.querySelector(selector);
    if (!btn) return;
    btn.classList.add("pressed");
    setTimeout(() => btn.classList.remove("pressed"), 120);
  }

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let k = e.key;
    if (k === ",") k = ".";
    if (/^[0-9.+\-*/]$/.test(k)) {
      handle(undefined, k);
      flash(`[data-value="${k}"]`);
    } else if (k === "Enter" || k === "=") {
      e.preventDefault(); handle("equals"); flash('[data-action="equals"]');
    } else if (k === "Backspace") {
      handle("back"); flash('[data-action="back"]');
    } else if (k === "Escape" || k === "Delete") {
      handle("clear"); flash('[data-action="clear"]');
    } else if (k === "%") {
      handle("percent"); flash('[data-action="percent"]');
    } else if (k === "(" || k === ")") {
      if (justEvaluated) { justEvaluated = false; expr = lastAnswer; }
      if (k === ")") {
        const open = (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length;
        if (open > 0 && /[0-9)%]$/.test(expr)) expr += ")";
      } else {
        if (/[0-9)%.]$/.test(expr)) expr += "*";
        expr += "(";
      }
      render(); flash('[data-action="paren"]');
    } else return;
    if (e.key === "/") e.preventDefault();
  });

  $("themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    save("calc-theme", next);
  });
  $("historyToggle").addEventListener("click", () => toggleHistory());
  $("clearHistory").addEventListener("click", () => {
    history = [];
    save("calc-history", history);
    renderHistory();
  });

  renderHistory();
  render();
})();
