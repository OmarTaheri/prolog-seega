/* Slide engine: renders SLIDES (from slides.js), keyboard / click navigation,
   a tiny black-and-white syntax highlighter, and step line-highlighting. */
(function () {
  'use strict';

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ---------------- highlighter ---------------- */
  const LANGS = {
    prolog: {
      re: /(%[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*")|(0'.)|('(?:\\.|[^'\\\n])*')|(\d+(?:\.\d+)?)|([A-Z_][A-Za-z0-9_]*)|([a-z][A-Za-z0-9_]*(?=\())|([a-z][A-Za-z0-9_]*)|(:-|-->|->|\\\+|=\.\.|>>|=:=|\\==|==|>=|=<|!|;)|(\s+)|([\s\S])/g,
      cls: ['k-com', 'k-com', 'k-str', 'k-num', 'k-atom', 'k-num', 'k-var', 'k-fn', 'k-atom', 'k-op', '', 'k-p'],
    },
    python: {
      re: /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?''')|([rfb]?"(?:\\.|[^"\\\n])*"|[rfb]?'(?:\\.|[^'\\\n])*')|(@[\w.]+)|(\b(?:def|class|return|import|from|if|else|elif|with|try|except|as|not|in|is|raise|global|None|True|False|for|while|and|or|lambda)\b)|(\d+)|([A-Za-z_]\w*(?=\())|([A-Za-z_]\w*)|(\s+)|([\s\S])/g,
      cls: ['k-com', 'k-str', 'k-str', 'k-fn', 'k-kw', 'k-num', 'k-fn', 'k-atom', '', 'k-p'],
    },
    plain: {
      re: /(#[^\n]*|%[^\n]*)|("(?:\\.|[^"\\\n])*")|(\b(?:true|false|null)\b)|(\b[A-Z]{2,}\b)|(-?\d+)|([A-Za-z_][\w-]*(?=\())|(\s+)|([\s\S])/g,
      cls: ['k-com', 'k-str', 'k-kw', 'k-kw', 'k-num', 'k-fn', '', 'k-atom'],
    },
  };

  function highlight(src, lang) {
    const L = LANGS[lang] || LANGS.prolog;
    const lines = [[]];
    L.re.lastIndex = 0;
    let m;
    while ((m = L.re.exec(src)) !== null) {
      if (m[0] === '') { L.re.lastIndex++; continue; }
      let g = 1;
      while (m[g] === undefined) g++;
      const cls = L.cls[g - 1];
      const parts = m[0].split('\n');
      parts.forEach((p, j) => {
        if (j > 0) lines.push([]);
        if (p) lines[lines.length - 1].push(cls ? `<span class="${cls}">${esc(p)}</span>` : esc(p));
      });
    }
    return lines.map((l) => l.join(''));
  }

  function parseRange(h) {
    const set = new Set();
    if (h == null || h === '') return set;
    String(h).split(',').forEach((part) => {
      const [a, b] = part.split('-').map((x) => parseInt(x, 10));
      for (let i = a; i <= (b || a); i++) set.add(i);
    });
    return set;
  }

  function clean(src) {
    return String(src).replace(/^\n/, '').replace(/\s+$/, '');
  }

  function codeBox(src, lang, h, size, label, flex) {
    const lines = highlight(clean(src), lang);
    const hs = parseRange(h);
    const body = lines.map((l, i) => {
      const n = i + 1;
      const cls = hs.size ? (hs.has(n) ? 'hl' : 'dim') : '';
      return `<div class="ln ${cls}"><span class="no">${n}</span><span class="tx">${l || ' '}</span></div>`;
    }).join('');
    return `<div class="codebox" style="font-size:${size || 24}px${flex ? `;flex:${flex}` : ''}">` +
      (label ? `<div class="lbl">${label}</div>` : '') + body + '</div>';
  }

  function exBox(s) {
    const lines = highlight(clean(s.ex), s.exLang || 'prolog');
    const body = lines.map((l) => `<div class="ln"><span class="tx">${l || ' '}</span></div>`).join('');
    return `<div class="exbox nolines" style="font-size:${s.exSize || 24}px"><div class="lbl">${s.exLabel || 'example'}</div>${body}</div>`;
  }

  /* ---------------- slide rendering ---------------- */
  function head(s) {
    let h = `<div class="head"><h1>${s.title}</h1>`;
    if (s.stepAll) {
      h += '<div class="pills">' + s.stepAll.map((t, j) =>
        `<span class="${j === s.stepIndex ? 'on' : j < s.stepIndex ? 'done' : ''}">${t}</span>`).join('') + '</div>';
    } else if (s.sub) {
      h += `<div class="pills"><span class="on">${s.sub}</span></div>`;
    }
    return h + '</div>';
  }

  function renderSlide(s) {
    if (s.type === 'title') {
      return `<div class="t-title"><div class="stones"><i class="w"></i><i class="b"></i><i class="w"></i><i class="b"></i></div>` +
        `<h1>${s.title}</h1><p>${s.sub || ''}</p></div>`;
    }
    if (s.type === 'section') {
      return `<div class="t-section"><div class="snum">${s.num || ''}</div><h1>${s.title}</h1><p>${s.sub || ''}</p></div>`;
    }
    const code = s.code ? codeBox(s.code, s.lang, s.h, s.size, s.codeLabel, s.codeFlex) : '';
    const ex = s.ex ? exBox(s) : '';
    let body = '';
    if (s.type === 'code') {
      body = `<div class="body code">${code}${ex}</div>`;
    } else if (s.type === 'split') {
      const lf = s.ratio ? ` style="flex:${s.ratio}"` : '';
      body = `<div class="body split"><div class="left"${lf}>${code}${s.exRight ? '' : ex}</div>` +
        `<div class="right"><div class="dia">${s.diagram || ''}${s.exRight ? ex : ''}</div></div></div>`;
    } else if (s.type === 'stack') {
      body = `<div class="body stack"><div class="stackrow">${code}${ex}</div><div class="dia">${s.diagram || ''}</div></div>`;
    } else {
      body = `<div class="body diagram"><div class="dia">${s.diagram || ''}</div></div>`;
    }
    return head(s) + body + (s.note ? `<div class="note">${s.note}</div>` : '');
  }

  /* ---------------- navigation ---------------- */
  const slides = window.SLIDES;
  const $slide = document.getElementById('slide');
  const $section = document.getElementById('section');
  const $counter = document.getElementById('counter');
  const $bar = document.getElementById('bar');
  let cur = 0;

  function show(i) {
    cur = Math.max(0, Math.min(slides.length - 1, i));
    const s = slides[cur];
    $slide.innerHTML = renderSlide(s);
    $section.textContent = s.section || '';
    $counter.textContent = `${cur + 1} / ${slides.length}`;
    $bar.style.width = `${((cur + 1) / slides.length) * 100}%`;
    if (location.hash !== `#${cur + 1}`) history.replaceState(null, '', `#${cur + 1}`);
  }

  function fromHash() {
    const n = parseInt(location.hash.slice(1), 10);
    return Number.isFinite(n) ? n - 1 : 0;
  }

  function fit() {
    const k = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    document.getElementById('stage').style.transform = `scale(${k})`;
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); show(cur + 1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); show(cur - 1); }
    else if (k === 'Home') show(0);
    else if (k === 'End') show(slides.length - 1);
    else if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    if (e.clientX > window.innerWidth / 3) show(cur + 1); else show(cur - 1);
  });
  window.addEventListener('hashchange', () => { if (fromHash() !== cur) show(fromHash()); });
  window.addEventListener('resize', fit);

  setTimeout(() => { document.getElementById('help').style.opacity = 0; }, 4000);
  fit();
  show(fromHash());
})();
