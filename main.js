/* Portfolio behaviour. Plain JS, no dependencies. Every feature checks its elements, so it is safe on any page.
   Without this file the page is still fully readable (progressive enhancement). */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var reduced = mq.matches;
  var hasIO = 'IntersectionObserver' in window;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };

  // main.js is alive: cancel the "show everything" safety timer set in <head>
  if (window.__rvT) clearTimeout(window.__rvT);

  /* ---------- theme toggle ---------- */
  var themeBtn = $('#theme-toggle');
  function currentTheme() { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function syncThemeUi() {
    var t = currentTheme();
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#f6f7f4' : '#070b14');
    if (themeBtn) themeBtn.setAttribute('aria-label', t === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  }
  syncThemeUi();
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) { /* storage may be blocked */ }
      syncThemeUi();
      doc.dispatchEvent(new Event('themechange'));
    });
  }

  /* ---------- header: scrolled state, progress bar, scroll-spy ---------- */
  var hdr = $('#site-header');
  var bar = $('#progress-bar');
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.pageYOffset || root.scrollTop || 0;
      var max = root.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, Math.max(0, y / max)).toFixed(4) : 0) + ')';
      if (hdr) hdr.classList.toggle('scrolled', y > 8);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  if (hasIO) {
    var spyLinks = {};
    $$('a[data-spy]').forEach(function (a) { spyLinks[a.getAttribute('data-spy')] = a; });
    var spyIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(spyLinks).forEach(function (k) {
          if (k === en.target.id) spyLinks[k].setAttribute('aria-current', 'true');
          else spyLinks[k].removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    Object.keys(spyLinks).forEach(function (k) { var s = doc.getElementById(k); if (s) spyIO.observe(s); });
    var topEl = $('#top');
    if (topEl) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) Object.keys(spyLinks).forEach(function (k) { spyLinks[k].removeAttribute('aria-current'); });
      }, { rootMargin: '-45% 0px -50% 0px' }).observe(topEl);
    }
  }

  /* ---------- mobile menu ---------- */
  var navBtn = $('#nav-toggle');
  var nav = $('#nav');
  function setNav(open) {
    if (!hdr || !navBtn) return;
    hdr.classList.toggle('nav-open', open);
    navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    navBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (navBtn && nav) {
    navBtn.addEventListener('click', function () { setNav(!hdr.classList.contains('nav-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && hdr.classList.contains('nav-open')) { setNav(false); navBtn.focus(); }
    });
  }

  /* ---------- reveal on scroll ---------- */
  var reveals = $$('.reveal');
  if (!hasIO || reduced) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var rvIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); rvIO.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    reveals.forEach(function (el) { rvIO.observe(el); });
  }

  /* ---------- lit-up sequences (case-study flows): play once when mostly visible ---------- */
  var lits = $$('.lit');
  if (!hasIO || reduced) {
    lits.forEach(function (el) { el.classList.add('in'); });
  } else {
    var litIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); litIO.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.3 });
    lits.forEach(function (el) { litIO.observe(el); });
  }

  var heroEl = $('#top');

  /* ---------- zero-trust network canvas ---------- */
  (function initNet() {
    var cv = $('#net');
    if (!cv || !cv.getContext || !heroEl) return;
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, nodes = [], pulse = null, nextPulse = 0, link = 140;
    var running = false, onScreen = true, last = 0, raf = 0, col = {};

    function readColors() {
      var cs = getComputedStyle(root);
      col.node = cs.getPropertyValue('--accent').trim() || '#2de2c4';
      col.line = cs.getPropertyValue('--accent-2').trim() || '#5b9bff';
      col.ok = cs.getPropertyValue('--ok').trim() || '#3ddc97';
      col.light = currentTheme() === 'light';
    }
    function resize() {
      var r = heroEl.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var small = W < 700;
      var n = small ? 26 : Math.max(40, Math.min(70, Math.round((W * H) / 19000)));
      link = small ? 110 : Math.min(165, W / 7.5);
      nodes = [];
      for (var i = 0; i < n; i++) {
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.34, vy: (Math.random() - 0.5) * 0.34,
          r: 1.4 + Math.random() * 1.4
        });
      }
      pulse = null;
      draw(performance.now());
    }
    function neighbours(a) {
      var out = [];
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j] === a) continue;
        var dx = nodes[j].x - a.x, dy = nodes[j].y - a.y;
        if (dx * dx + dy * dy < link * link) out.push(nodes[j]);
      }
      return out;
    }
    function startPulse(now) {
      for (var tries = 0; tries < 8; tries++) {
        var a = nodes[(Math.random() * nodes.length) | 0];
        var ns = neighbours(a);
        if (ns.length) { pulse = { a: a, b: ns[(Math.random() * ns.length) | 0], t0: now }; return; }
      }
      nextPulse = now + 1000;
    }
    function step() {
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      }
    }
    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      var l2 = link * link, i, j;
      ctx.strokeStyle = col.line;
      for (i = 0; i < nodes.length; i++) {
        for (j = i + 1; j < nodes.length; j++) {
          var dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, d2 = dx * dx + dy * dy;
          if (d2 < l2) {
            ctx.globalAlpha = (1 - Math.sqrt(d2) / link) * (col.light ? 0.42 : 0.34);
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
          }
        }
      }
      ctx.fillStyle = col.node;
      for (i = 0; i < nodes.length; i++) {
        ctx.globalAlpha = col.light ? 0.55 : 0.7;
        ctx.beginPath(); ctx.arc(nodes[i].x, nodes[i].y, nodes[i].r, 0, 6.2832); ctx.fill();
      }
      if (pulse) {
        var p = (now - pulse.t0) / 1500;
        if (p >= 1) { pulse = null; nextPulse = now + 2200 + Math.random() * 2400; }
        else {
          var a = pulse.a, b = pulse.b, e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          ctx.strokeStyle = col.ok; ctx.fillStyle = col.ok;
          ctx.globalAlpha = 0.85 * (1 - Math.max(0, p - 0.7) / 0.3);
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, 2.6, 0, 6.2832); ctx.fill();
          var ra = Math.min(1, p / 0.45), rb = Math.max(0, Math.min(1, (p - 0.45) / 0.45));
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.8 * (1 - ra); ctx.beginPath(); ctx.arc(a.x, a.y, 3 + ra * 16, 0, 6.2832); ctx.stroke();
          if (rb > 0) { ctx.globalAlpha = 0.8 * (1 - rb); ctx.beginPath(); ctx.arc(b.x, b.y, 3 + rb * 16, 0, 6.2832); ctx.stroke(); }
          ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(a.x, a.y, 2.4, 0, 6.2832); ctx.fill();
          if (rb > 0.2) { ctx.beginPath(); ctx.arc(b.x, b.y, 2.4, 0, 6.2832); ctx.fill(); }
        }
      }
      ctx.globalAlpha = 1;
    }
    function frame(ts) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (ts - last < 33) return;           // max ~30 fps
      last = ts;
      step();
      if (!pulse && ts > nextPulse) startPulse(ts);
      draw(ts);
    }
    function start() {
      if (running || reduced || !onScreen || doc.hidden) return;
      running = true; last = 0; nextPulse = performance.now() + 1500;
      raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }

    readColors();
    resize();
    if (!reduced) {
      if (hasIO) new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; if (onScreen) start(); else stop(); }).observe(heroEl);
      doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); else start(); });
      start();
    }
    var rt = 0;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
    doc.addEventListener('themechange', function () { readColors(); if (!running) draw(performance.now()); });
  })();

  /* ---------- lightbox (native dialog) ---------- */
  var dlg = $('#lightbox');
  if (dlg && typeof dlg.showModal === 'function') {
    var lbImg = $('#lb-img'), lbCap = $('#lb-cap'), lbCount = $('#lb-count');
    var lbPrev = $('#lb-prev'), lbNext = $('#lb-next'), lbClose = $('#lb-close');
    var items = [], idx = 0, opener = null;
    var show = function () {
      var a = items[idx];
      lbImg.src = a.getAttribute('href');
      lbImg.alt = a.getAttribute('data-alt') || '';
      lbCap.textContent = '';
      var t = a.getAttribute('data-title'), s = a.getAttribute('data-sub'), m = a.getAttribute('data-meta');
      if (t) { var st = doc.createElement('strong'); st.textContent = t; lbCap.appendChild(st); }
      if (s) { var ss = doc.createElement('span'); ss.textContent = s; lbCap.appendChild(ss); }
      if (m) { var sm = doc.createElement('span'); sm.className = 'm'; sm.textContent = m; lbCap.appendChild(sm); }
      lbCount.textContent = items.length > 1 ? (idx + 1) + ' / ' + items.length : '';
      lbPrev.hidden = lbNext.hidden = items.length < 2;
      [idx - 1, idx + 1].forEach(function (k) {
        if (k >= 0 && k < items.length) { var im = new Image(); im.src = items[k].getAttribute('href'); }
      });
    };
    var go = function (d) {
      if (items.length < 2) return;
      idx = (idx + d + items.length) % items.length;
      show();
    };
    doc.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a.lb') : null;
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      items = $$('a.lb[data-group="' + a.getAttribute('data-group') + '"]');
      idx = Math.max(0, items.indexOf(a));
      opener = a;
      show();
      root.classList.add('lb-open');
      dlg.showModal();
      lbClose.focus();
    });
    lbPrev.addEventListener('click', function () { go(-1); });
    lbNext.addEventListener('click', function () { go(1); });
    lbClose.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.classList.contains('lb-inner')) dlg.close();
    });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'Tab') {
        var f = [lbClose, lbPrev, lbNext].filter(function (b) { return !b.hidden; });
        var i = f.indexOf(doc.activeElement);
        if (i === -1) { e.preventDefault(); f[0].focus(); return; }
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    dlg.addEventListener('close', function () {
      root.classList.remove('lb-open');
      lbImg.removeAttribute('src');
      if (opener && opener.focus) opener.focus();
    });
  }

  /* ---------- email: click to reveal (address is assembled here, never in the HTML) ---------- */
  var revealBtn = $('#reveal-email');
  var emailOut = $('#email-out');
  if (revealBtn && emailOut) {
    revealBtn.addEventListener('click', function () {
      var addr;
      try { addr = atob(revealBtn.getAttribute('data-a')) + '@' + atob(revealBtn.getAttribute('data-b')); } catch (e) { return; }
      emailOut.textContent = '';
      var link = doc.createElement('a');
      link.className = 'addr';
      link.href = 'mailto:' + addr;
      link.textContent = addr;
      var copy = doc.createElement('button');
      copy.type = 'button';
      copy.className = 'btn btn-ghost btn-sm';
      copy.textContent = 'Copy address';
      copy.addEventListener('click', function () {
        var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy address'; }, 2000); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(addr).then(done, function () { selectText(link); });
        } else selectText(link);
      });
      function selectText(el) {
        var r = doc.createRange(); r.selectNodeContents(el);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        copy.textContent = 'Press Ctrl+C';
      }
      emailOut.appendChild(link);
      emailOut.appendChild(copy);
      revealBtn.hidden = true;
      link.focus();
    });
  }

  /* ---------- card spotlight follows the pointer ---------- */
  if (window.matchMedia && window.matchMedia('(hover: hover)').matches && !reduced) {
    doc.addEventListener('pointermove', function (e) {
      var c = e.target.closest ? e.target.closest('.card') : null;
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* ---------- reduced-motion changes at runtime: simplest safe behaviour is a reload-free note ---------- */
  if (mq.addEventListener) {
    mq.addEventListener('change', function (e) {
      reduced = e.matches;
      if (reduced) {
        reveals.forEach(function (el) { el.classList.add('in'); });
        lits.forEach(function (el) { el.classList.add('in'); });
      }
    });
  }

  onScroll();
})();
