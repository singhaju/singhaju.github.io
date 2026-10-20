/* Portfolio behaviour (v3 trial). Plain JS, no dependencies. Every feature checks its elements, so it is safe on any page.
   Without this file the page is still fully readable (progressive enhancement).
   v3 differences from the live main.js (pass 2): no generic scroll reveal; the hero terminal is back and keeps its lines
   as scrollback; added the sliding nav bar, one-time heading/figure reveals, timeline dots, the View Transitions theme
   switch, the access-decision demo (now inside the U-HAP panel), one-time count-ups, staggered entrances, the sticky
   work index and one cursor-lit border handler. */
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

  // CSS loops (the pulse dot) pause while the tab is hidden; the canvas, the decision panel and the slideshows check doc.hidden themselves
  doc.addEventListener('visibilitychange', function () { root.classList.toggle('tab-hidden', doc.hidden); });

  /* ---------- theme toggle: the new theme grows as a circle from the button (View Transitions API) ----------
     Without the API, or with reduced motion, the theme just switches. The choice is remembered as before. */
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
      var apply = function () {
        root.setAttribute('data-theme', next);
        syncThemeUi();
        doc.dispatchEvent(new Event('themechange'));
      };
      try { localStorage.setItem('theme', next); } catch (e) { /* storage may be blocked */ }
      if (!doc.startViewTransition || reduced || doc.hidden) { apply(); return; }
      var b = themeBtn.getBoundingClientRect();
      var x = b.left + b.width / 2, y = b.top + b.height / 2;
      var rad = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      var vt;
      try { vt = doc.startViewTransition(apply); } catch (e) { apply(); return; }
      vt.ready.then(function () {
        root.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + rad + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 450, easing: 'cubic-bezier(0.77,0,0.175,1)', pseudoElement: '::view-transition-new(root)' }
        );
      }, function () { /* transition skipped: the theme is already applied */ });
    });
  }

  /* ---------- header: scrolled state, progress bar, scroll-spy ----------
     Layout is never read outside a ResizeObserver callback (where layout is already clean) or a scroll
     event. "scrolled" comes from an IntersectionObserver on a 9px sentinel at the top of the page; the
     progress bar needs the scroll offset (scroll event), the page height and the viewport height (both
     cached from ResizeObserver callbacks; the viewport height comes from a fixed 100%-high probe, so no
     innerHeight read is needed); the rAF callback only writes. */
  var hdr = $('#site-header');
  var bar = $('#progress-bar');
  var ticking = false, scrollTop = 0, maxScroll = 0, vpH = 0;
  function paintProgress() {
    ticking = false;
    if (bar) bar.style.transform = 'scaleX(' + (maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)).toFixed(4) : 0) + ')';
  }
  function queuePaint() { if (!ticking) { ticking = true; requestAnimationFrame(paintProgress); } }
  function onScroll() {
    scrollTop = window.pageYOffset || 0;
    if (!hasIO && hdr) hdr.classList.toggle('scrolled', scrollTop > 8);
    queuePaint();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  if (hasIO && hdr && doc.body) {
    var sentinel = doc.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:9px;opacity:0;pointer-events:none';
    doc.body.insertBefore(sentinel, doc.body.firstChild);
    new IntersectionObserver(function (en) {
      hdr.classList.toggle('scrolled', !en[en.length - 1].isIntersecting);
    }).observe(sentinel);
  }
  if (window.ResizeObserver && doc.body) {
    var probe = doc.createElement('div');                 // viewport-high, invisible: its size is the viewport size
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:100%;visibility:hidden;pointer-events:none';
    doc.body.appendChild(probe);
    // the first callback arrives after the first layout; later ones after a page-height or window-height change
    var metricsRO = new ResizeObserver(function (es) {
      for (var i = 0; i < es.length; i++) if (es[i].target === probe) vpH = es[i].contentRect.height;   // reads: no layout needed
      scrollTop = window.pageYOffset || 0;
      maxScroll = root.scrollHeight - vpH;
      queuePaint();
    });
    metricsRO.observe(doc.body);
    metricsRO.observe(probe);
  } else {
    var measureOld = function () {                        // old browsers: one measurement on load and on resize
      vpH = window.innerHeight; scrollTop = window.pageYOffset || 0;
      maxScroll = root.scrollHeight - vpH; queuePaint();
    };
    window.addEventListener('load', measureOld);
    window.addEventListener('resize', measureOld, { passive: true });
  }

  /* sliding bar under the current nav link (desktop only; CSS hides it on phones). Nothing is current while the hero is in view. */
  var navEl = $('#nav');
  var navBar = navEl ? $('.nav-bar', navEl) : null;
  function placeBar(snap) {
    if (!navBar || !navEl) return;
    var a = $('a[aria-current="true"]', navEl);
    if (!a || !navEl.offsetWidth || !a.offsetWidth) { navBar.classList.remove('on'); return; }
    var n = navEl.getBoundingClientRect(), r = a.getBoundingClientRect();
    var inset = parseFloat(getComputedStyle(a).paddingLeft) || 0;
    var first = !navBar.classList.contains('on');
    if (snap || first) navBar.classList.add('snap');
    navBar.style.transform = 'translate(' + (r.left - n.left + inset).toFixed(1) + 'px,' + (r.bottom - n.top - 8).toFixed(1) + 'px) scaleX(' + Math.max(0, r.width - inset * 2).toFixed(1) + ')';
    if (snap || first) { void navBar.offsetWidth; navBar.classList.remove('snap'); }
    navBar.classList.add('on');
  }
  if (navBar && window.ResizeObserver) new ResizeObserver(function () { placeBar(true); }).observe(navEl);
  if (navBar && doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { placeBar(true); });

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
        placeBar(false);
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    Object.keys(spyLinks).forEach(function (k) { var s = doc.getElementById(k); if (s) spyIO.observe(s); });
    var topEl = $('#top');
    if (topEl) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { Object.keys(spyLinks).forEach(function (k) { spyLinks[k].removeAttribute('aria-current'); }); placeBar(false); }
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

  /* ---------- hero headline: one gradient across a highlighted run ----------
     While the words rise, each highlighted word paints its own gradient (see .hl-run in site.css). When the run sits on
     one line, give each word the slice of the run's width it covers so the pair still reads as one gradient. */
  var hlRuns = $$('.hl-run');
  function sizeRuns() {
    hlRuns.forEach(function (run) {
      var ws = $$('.wi', run), n = ws.length;
      if (n < 2) return;
      var first = ws[0], last = ws[n - 1];
      var one = Math.abs(first.offsetTop - last.offsetTop) < 3;
      ws.forEach(function (w) {
        if (!one) { w.style.removeProperty('--gw'); w.style.removeProperty('--gx'); return; }
        var total = last.offsetLeft + last.offsetWidth - first.offsetLeft;
        w.style.setProperty('--gw', total + 'px');
        w.style.setProperty('--gx', (first.offsetLeft - w.offsetLeft) + 'px');
      });
    });
  }
  if (hlRuns.length) {
    if (window.ResizeObserver) new ResizeObserver(sizeRuns).observe(hlRuns[0].parentNode);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(sizeRuns);
  }

  /* ---------- one-time reveals ----------
     Only two things wait for scrolling: the short line under each section heading (.rev-h) and the work / research
     figures (.rev-fig). CSS hides them only while html.js is on and motion is allowed (and not after the 4 s safety
     timer in <head>); everything else on the page is simply visible. */
  var once = $$('.rev-h, .rev-fig');
  var onReduce = [];                                          // things to finish when reduced motion is switched on at runtime
  if (!hasIO || reduced) {
    once.forEach(function (el) { el.classList.add('in'); });
  } else {
    /* An element that is clipped away by its own clip-path never counts as "visible" to the observer, so figures that
       carry the clip themselves (.m-fig, .gframe) are watched through their parent box instead. */
    var proxies = [];
    var onceIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!(en.isIntersecting || en.boundingClientRect.top < 0)) return;
        onceIO.unobserve(en.target);
        proxies.forEach(function (p) { if (p.t === en.target) p.el.classList.add('in'); });
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.15 });
    once.forEach(function (el) {
      var t = (el.classList.contains('m-fig') || el.classList.contains('gframe')) && el.parentElement ? el.parentElement : el;
      proxies.push({ el: el, t: t });
      onceIO.observe(t);
    });
  }

  /* ---------- staggered entrance (bento tiles, the 'what makes it new' cards, the work impact cards): the grid gets .in once, CSS staggers the children ---------- */
  var grids = $$('.bento, .wp-pts, .wp-impact');
  if (!hasIO || reduced) {
    grids.forEach(function (g) { g.classList.add('in'); });
  } else {
    var gridIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting || en.boundingClientRect.top < 0) { en.target.classList.add('in'); gridIO.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    grids.forEach(function (g) { gridIO.observe(g); });
  }
  onReduce.push(function () { grids.forEach(function (g) { g.classList.add('in'); }); });

  /* ---------- experience timeline: an entry's dot turns accent once its top passes the middle of the screen ---------- */
  var tlList = $('.tl');
  if (hasIO && tlList) {
    tlList.classList.add('tl-js');
    var tlIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('mid', !!en.rootBounds && en.boundingClientRect.top <= en.rootBounds.bottom); });
    }, { rootMargin: '0px 0px -50% 0px' });
    $$('.tl-i', tlList).forEach(function (li) { tlIO.observe(li); });
    /* the entry in view (a thin band across the middle of the screen) gets a faint background; opacity only */
    var curIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-cur', en.isIntersecting); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('.tl-i', tlList).forEach(function (li) { curIO.observe(li); });
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

  /* ---------- hero terminal: the live terminal, now with scrollback ----------
     The box takes the height of the About column (CSS), so "Longer" makes it taller. Every " · " item of an output is its
     own line. The lines follow the order of content.json. On load the finished lines are drawn at once (oldest first) until
     the body is about 75% full, then the next ones are typed. When the box grows, finished lines are added at once so it
     is never empty; when the body is full it scrolls so the newest line stays at the bottom. After the last line it types
     "clear", fades, and starts again with the same pre-fill. With reduced motion nothing types: it shows as many of the lines
     as fit. Without JavaScript the HTML already holds all lines and CSS clips them. */
  (function () {
    var term = $('#term');
    if (!term) return;
    var body = $('#term-body'), btn = $('#term-pause'), dataEl = $('#term-data');
    if (!body || !dataEl) return;
    var lines;
    try { lines = JSON.parse(dataEl.textContent); } catch (e) { return; }
    if (!lines || !lines.length) return;
    var CHAR_MS = 34, OUT_MS = 300, OL_MS = 70, HOLD_MS = 1800, CLEAR_MS = 220, FILL = 0.75, MAXFILL = 0.92;
    var timer = null, nextFn = null, userPaused = false, offscreen = false, hidden = !!doc.hidden;
    var cursor = doc.createElement('span');
    cursor.className = 'tm-cur';
    var pos = 0, cur = null, clearing = false, lastH = 0, liveOn = false;

    function active() { return !userPaused && !offscreen && !hidden; }
    function sched(fn, ms) {
      nextFn = fn;
      if (timer) { clearTimeout(timer); timer = null; }
      if (active()) timer = setTimeout(function () { timer = null; fn(); }, ms);
    }
    function refresh() {
      if (active()) {
        if (!timer && nextFn) { var f = nextFn; timer = setTimeout(function () { timer = null; f(); }, 0); }
      } else if (timer) { clearTimeout(timer); timer = null; }
    }
    function stopLive() {
      liveOn = false; nextFn = null; cur = null; clearing = false;
      if (timer) { clearTimeout(timer); timer = null; }
      if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
    }
    function bangkokNow() {
      try {
        var p = {};
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
          .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
        return p.weekday + ' ' + p.day + ' ' + p.month + ' ' + p.year + ' ' + p.hour + ':' + p.minute;
      } catch (e) { return ''; }
    }
    // the output of one line as an array of output lines (the date line is the Bangkok date and time plus '(UTC+7)', no place name)
    function outLines(d) {
      var a = Array.isArray(d.o) ? d.o.slice() : [String(d.o)];
      if (d.d === 'date') { var now = bangkokNow(); if (now) return [now + ' (UTC+7)']; }
      return a;
    }
    function el(tag, cls, text) {
      var n = doc.createElement(tag);
      if (cls) n.className = cls;
      if (text) n.textContent = text;
      return n;
    }
    // keep the newest line at the bottom: scrollTop follows the content (smooth unless reduced motion)
    function follow() {
      var h = body.scrollHeight;
      if (h === lastH) return;
      lastH = h;
      if (h > body.clientHeight + 1) body.scrollTo({ top: h, behavior: reduced ? 'auto' : 'smooth' });
    }
    // height of the printed content (scrollHeight is never below clientHeight, so measure from the last entry)
    function contentH() {
      var l = body.lastElementChild;
      if (!l) return 0;
      return l.getBoundingClientRect().bottom - body.getBoundingClientRect().top + body.scrollTop;
    }
    function newEnt(withCursor) {
      var ent = el('div', 'tm-ent'), cmd = el('div', 'tm-cmd');
      var tx = el('span', 'tm-text');
      cmd.appendChild(el('span', 'tm-prompt', '$'));
      cmd.appendChild(doc.createTextNode(' '));
      cmd.appendChild(tx);
      if (withCursor) cmd.appendChild(cursor);
      ent.appendChild(cmd);
      body.appendChild(ent);
      return { ent: ent, tx: tx };
    }
    function fillOut(out, items) {
      out.textContent = '';
      items.forEach(function (t) { out.appendChild(el('div', 'tm-o', t)); });
    }
    // a finished entry (command and all output lines), added at once
    function appendDone(i) {
      var e = newEnt(false), out = el('div', 'tm-out');
      e.tx.textContent = lines[i].c;
      fillOut(out, outLines(lines[i]));
      e.ent.appendChild(out);
      return e.ent;
    }
    // the cursor waits at the end of the newest line
    function placeCursor() {
      var last = body.lastElementChild;
      if (!last) return;
      var os = last.querySelectorAll('.tm-o');
      (os.length ? os[os.length - 1] : last.querySelector('.tm-cmd')).appendChild(cursor);
    }
    // add finished lines (file order) until the body is about frac full; never leave a half-hidden last line
    function fillTo(frac) {
      var cap = body.clientHeight * frac;
      while (pos < lines.length - 1 && contentH() < cap) { appendDone(pos); pos++; }
      if (body.children.length > 1 && contentH() > body.clientHeight * MAXFILL) { body.removeChild(body.lastElementChild); pos--; }
      placeCursor();
      lastH = body.scrollHeight;
      body.scrollTop = body.scrollHeight;
      body.classList.toggle('is-scrolled', body.scrollTop > 4);
    }
    // complete the line that is being typed at once
    function finishCur() {
      var c = cur;
      if (!c) return;
      cur = null;
      c.e.tx.textContent = c.d.c;
      if (!c.out) { c.out = el('div', 'tm-out'); c.e.ent.appendChild(c.out); }
      fillOut(c.out, c.items);
      placeCursor();
    }
    function typeText(tx, text, done) {
      var n = 0;
      function step() {
        n++;
        tx.textContent = text.slice(0, n);
        follow();
        if (n < text.length) sched(step, CHAR_MS + ((Math.random() * 12) | 0));
        else done();
      }
      sched(step, CHAR_MS);
    }
    function printItem(k) {
      var c = cur;
      if (!c) return;
      var row = el('div', 'tm-o', c.items[k]);
      c.out.appendChild(row);
      row.appendChild(cursor);
      follow();
      if (k + 1 < c.items.length) sched(function () { printItem(k + 1); }, OL_MS);
      else { cur = null; sched(typeLine, HOLD_MS); }
    }
    function typeLine() {
      if (!liveOn || clearing) return;
      if (pos >= lines.length) { typeClear(); return; }
      var i = pos++, d = lines[i], e = newEnt(true);
      var c = cur = { e: e, d: d, items: outLines(d), out: null };
      follow();
      typeText(e.tx, d.c, function () {
        sched(function () {
          if (cur !== c) return;
          c.out = el('div', 'tm-out');
          e.ent.appendChild(c.out);
          printItem(0);
        }, OUT_MS);
      });
    }
    // after the last line: type "clear", fade the body out, empty it and start the next round (with the same pre-fill)
    function typeClear() {
      clearing = true;
      var e = newEnt(true);
      follow();
      typeText(e.tx, 'clear', function () {
        sched(function () {
          body.classList.add('is-clearing');
          sched(function () {
            body.textContent = '';
            body.scrollTop = 0; lastH = 0; pos = 0; cur = null;
            body.classList.remove('is-scrolled');
            fillTo(FILL);
            body.classList.remove('is-clearing');
            clearing = false;
            sched(typeLine, 500);
          }, CLEAR_MS);
        }, OUT_MS + 200);
      });
    }
    // reduced motion: no typing; append whole entries while they fit (re-run when the box changes size)
    function fitStatic() {
      body.textContent = '';
      body.classList.remove('is-scrolled', 'is-clearing');
      for (var i = 0; i < lines.length; i++) {
        var ent = appendDone(i);
        if (i > 0 && body.scrollHeight > body.clientHeight + 1) { body.removeChild(ent); break; }
      }
      body.scrollTop = 0;
    }
    function startLive() {
      stopLive();
      body.textContent = '';
      body.scrollTop = 0; lastH = 0; pos = 0;
      body.classList.remove('is-scrolled', 'is-clearing');
      liveOn = true;
      fillTo(FILL);
      sched(typeLine, 900);
    }

    if (btn) {
      btn.addEventListener('click', function () {
        userPaused = !userPaused;
        btn.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
        btn.setAttribute('aria-label', btn.getAttribute(userPaused ? 'data-play' : 'data-pause') || '');
        refresh();
      });
    }
    doc.addEventListener('visibilitychange', function () { hidden = doc.hidden; refresh(); });
    if (hasIO) {
      new IntersectionObserver(function (es) {
        offscreen = !es[es.length - 1].isIntersecting; refresh();
      }, { threshold: 0.1 }).observe(term);
    }
    body.addEventListener('scroll', function () { body.classList.toggle('is-scrolled', body.scrollTop > 4); }, { passive: true });
    // the box height follows the About column ("Longer", window size): a taller box is filled at once with finished lines
    // (never an empty band), a shorter one keeps the newest line at the bottom
    var rzT = null;
    function onResize() {
      if (rzT) clearTimeout(rzT);
      rzT = setTimeout(function () {
        rzT = null;
        if (reduced) { fitStatic(); return; }
        if (liveOn && !clearing && pos < lines.length - 1 && contentH() < body.clientHeight * FILL) {
          finishCur();
          fillTo(FILL);
          sched(typeLine, 600);
        } else { lastH = 0; follow(); }
      }, 120);
    }
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(body);
    else window.addEventListener('resize', onResize);
    if (mq.addEventListener) {
      mq.addEventListener('change', function (e) {
        if (e.matches) { stopLive(); fitStatic(); } else startLive();
      });
    }
    if (reduced) fitStatic(); else startLive();
  })();

  /* ---------- access-decision demo (U-HAP panel, "Try it" card): four example requests that cycle ----------
     The HTML already holds example 3 (no JavaScript, reduced motion). Cycling runs only while it is playing, the
     panel is on screen and the tab is visible. "Next request" and Pause / Play are real buttons. */
  (function () {
    var dec = $('#dec');
    if (!dec) return;
    var ex;
    try { ex = JSON.parse(dec.getAttribute('data-ex')); } catch (e) { return; }
    if (!ex || !ex.length) return;
    var reqs = $$('#dec .dec-req span');
    var rules = $$('#dec .dec-rule');
    var word = $('#dec .dec-word'), why = $('#dec .dec-why');
    var nextBtn = $('#dec-next'), pauseBtn = $('#dec-pause');
    var HOLD = 3300;                                   // 2.6 s hold plus the ~0.7 s the lines need to arrive
    var idx = +dec.getAttribute('data-static') || 0;
    var playing = !mq.matches, vis = true, timer = 0, swapT = 0;

    function fill(i) {
      idx = i;
      var e = ex[i];
      reqs.forEach(function (sp, k) { sp.textContent = e.req[k] || ''; });
      rules.forEach(function (li, k) {
        var r = e.rules[k], c = li.children;
        c[0].textContent = r ? r[0] : '';
        c[1].textContent = r ? r[1] : '';
        c[2].textContent = r ? r[3] : '';
        c[2].className = 'dec-res' + (r ? ' ' + r[2] : '');
        li.classList.toggle('is-empty', !r);
        if (r) li.removeAttribute('aria-hidden'); else li.setAttribute('aria-hidden', 'true');
      });
      word.textContent = e.out;
      word.className = 'dec-word ' + (e.out === 'ALLOW' ? 'allow' : 'deny');
      why.textContent = e.why;
      dec.style.setProperty('--n', e.rules.length);
    }
    function play(first) {
      // on page load the panel waits for the hero fade-up (about 0.8 s); later swaps start at once
      if (first && !root.classList.contains('rv-off') && performance.now() < 1500) dec.style.setProperty('--base', '800ms');
      else dec.style.removeProperty('--base');
      dec.classList.remove('go', 'leave');
      void dec.offsetWidth;
      dec.classList.add('go');
    }
    function swap(i) {
      clearTimeout(swapT);
      if (mq.matches) { fill(i); return; }
      dec.classList.remove('go');
      dec.classList.add('leave');
      swapT = setTimeout(function () { fill(i); play(false); }, 150);
    }
    function tick() {
      clearTimeout(timer);
      if (!playing || !vis || doc.hidden) return;
      timer = setTimeout(function () { swap((idx + 1) % ex.length); tick(); }, HOLD);
    }
    function label() {
      if (!pauseBtn) return;
      pauseBtn.textContent = playing ? 'Pause' : 'Play';
      pauseBtn.setAttribute('aria-pressed', playing ? 'false' : 'true');
    }

    if (!mq.matches) fill(0);
    label();
    if (nextBtn) nextBtn.addEventListener('click', function () { swap((idx + 1) % ex.length); tick(); });
    if (pauseBtn) pauseBtn.addEventListener('click', function () { playing = !playing; label(); tick(); });
    // the card sits lower on the page: its first run starts when it is first seen
    var seenDec = false;
    function firstSeen() { if (!seenDec) { seenDec = true; if (!mq.matches) play(false); } }
    if (hasIO) new IntersectionObserver(function (es) { vis = es[es.length - 1].isIntersecting; if (vis) firstSeen(); tick(); }, { threshold: 0.25 }).observe(dec);
    else firstSeen();
    doc.addEventListener('visibilitychange', tick);
    tick();
  })();

  /* ---------- numbers count up once, when their row first scrolls into view ----------
     The final text is in the HTML. Under JavaScript with motion allowed the visible value starts at 0 and counts to the
     real number in 900 ms (ease-out); a screen reader gets the full text from a hidden copy, and CSS reserves the width
     (--w, tabular-nums) so nothing moves. Reduced motion, print and no IntersectionObserver show the final value. */
  (function () {
    var groups = $$('.wp-nums, .ld-stats').map(function (g) { return { box: g, vals: $$('.cnt-v[data-to]', g) }; })
      .filter(function (g) { return g.vals.length; });
    if (!groups.length) return;
    var all = [];
    groups.forEach(function (g) { all = all.concat(g.vals); });
    function fmt(v, dec, sep) {
      var s = v.toFixed(dec);
      if (sep) { var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep); s = p.join('.'); }
      return s;
    }
    function finishAll() { all.forEach(function (e) { if (e._final != null) e.textContent = e._final; }); }
    window.addEventListener('beforeprint', finishAll);
    onReduce.push(function () { all.forEach(function (e) { e._done = true; }); finishAll(); });
    if (!hasIO || reduced) return;
    all.forEach(function (e) {
      e._final = e.textContent;
      e._to = parseFloat(e.getAttribute('data-to'));
      e._dec = +e.getAttribute('data-dec') || 0;
      e._sep = e.getAttribute('data-sep') || '';
      var cnt = e.closest ? e.closest('.cnt') : null;
      if (cnt && cnt.parentNode) {
        var sr = doc.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = cnt.textContent;
        cnt.parentNode.insertBefore(sr, cnt);
        cnt.setAttribute('aria-hidden', 'true');
      }
      e.textContent = fmt(0, e._dec, e._sep);
    });
    function run(g) {
      var t0 = performance.now();
      function frame(now) {
        var p = Math.min(1, (now - t0) / 900), k = 1 - Math.pow(1 - p, 3);
        g.vals.forEach(function (e) {
          if (e._done) return;
          e.textContent = p >= 1 ? e._final : fmt(e._to * k, e._dec, e._sep);
        });
        if (p < 1 && !reduced) requestAnimationFrame(frame);
        else g.vals.forEach(function (e) { e.textContent = e._final; });
      }
      requestAnimationFrame(frame);
    }
    var cntIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        cntIO.unobserve(en.target);
        groups.forEach(function (g) { if (g.box === en.target) run(g); });
      });
    }, { threshold: 0.35 });
    groups.forEach(function (g) { cntIO.observe(g.box); });
  })();

  /* ---------- selected work: sticky index follows the panel in view ----------
     At 1100px and up the left index is sticky. The active panel is the one at the top third of the viewport (its top has
     passed the line at one third of the screen height; the height is capped at 1100px so a very tall window, such as a
     full-page capture, still gives a sensible answer). Before the first panel reaches that line nothing is active.
     The line fill runs from the first dot to the last. Panel boxes are cached and re-read on resize (no layout
     reads inside the scroll handler). Below 1100px the index is hidden by CSS and nothing runs. */
  (function () {
    var idx = $('.wk-idx');
    if (!idx) return;
    var links = $$('.wk-a', idx), fill = $('.wk-line i', idx);
    var panels = links.map(function (a) { return doc.getElementById((a.getAttribute('href') || '').slice(1)); });
    if (!links.length || panels.indexOf(null) !== -1) return;
    var tops = [], hs = [], active = -2, ticking = false;
    function measure() {
      var y = window.pageYOffset;
      tops = panels.map(function (p) { return p.getBoundingClientRect().top + y; });
      hs = panels.map(function (p) { return p.offsetHeight; });
      update();
    }
    function update() {
      ticking = false;
      if (!idx.offsetParent && getComputedStyle(idx).display === 'none') return;
      var n = panels.length, probe = window.pageYOffset + Math.min(window.innerHeight, 1100) / 3, a = -1, f = 0, p = 0, i;
      for (i = 0; i < n; i++) if (tops[i] <= probe) a = i;
      if (a >= 0) {
        if (a === n - 1 && probe > tops[a] + hs[a]) { p = 1; a = -1; }
        else { f = Math.max(0, Math.min(1, (probe - tops[a]) / (hs[a] || 1))); p = n > 1 ? Math.min(1, (a + f) / (n - 1)) : 1; }
      }
      if (fill) fill.style.transform = 'scaleY(' + p.toFixed(3) + ')';
      if (a !== active) {
        active = a;
        links.forEach(function (l, k) {
          l.classList.toggle('is-active', k === a);
          if (k === a) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
        });
      }
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(measure);
      panels.forEach(function (p) { ro.observe(p); });
      ro.observe(doc.body);
    }
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(measure);
    measure();
  })();

  /* ---------- zero-trust network canvas (decorative) ----------
     Starts only after the load event and an idle moment, so it can never compete with first paint.
     Skipped entirely on narrow screens (<= 760px), under prefers-reduced-motion and with Save-Data.
     Layout is not read here: the size comes from a ResizeObserver, colours are read once at start
     (layout is already clean by then) and again on a theme change, inside the next animation frame. */
  (function initNet() {
    var cv = $('#net');
    if (!cv || !cv.getContext || !heroEl) return;
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var narrow = window.matchMedia ? window.matchMedia('(max-width: 760px)') : { matches: false };

    function begin() {
      // decorative only: skipped for reduced motion, phones / narrow windows (<= 760px) and Save-Data
      if (reduced || narrow.matches || (conn && conn.saveData)) return;
      var ctx = cv.getContext('2d');
      if (!ctx) return;
      var W = 0, H = 0, nodes = [], pulse = null, nextPulse = 0, link = 140;
      var running = false, onScreen = true, last = 0, raf = 0, col = {}, colStale = true, rt = 0;

      function readColors() {
        var cs = getComputedStyle(root);
        col.node = cs.getPropertyValue('--accent').trim() || '#2de2c4';
        col.line = cs.getPropertyValue('--accent-2').trim() || '#5b9bff';
        col.ok = cs.getPropertyValue('--ok').trim() || '#3ddc97';
        col.light = currentTheme() === 'light';
        colStale = false;
      }
      function makeNode() {
        return {
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.34, vy: (Math.random() - 0.5) * 0.34,
          r: 1.4 + Math.random() * 1.4
        };
      }
      // w, h come from the ResizeObserver entry; the nodes keep their relative place when the box changes
      function resize(w, h) {
        if (colStale) readColors();                        // reads first (style is clean inside the ResizeObserver callback) ...
        var oldW = W, oldH = H;
        W = Math.max(1, Math.round(w));
        H = Math.max(1, Math.round(h));
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        cv.width = Math.round(W * dpr);                    // ... then the canvas writes
        cv.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var small = W < 700;
        var n = small ? 26 : Math.max(40, Math.min(70, Math.round((W * H) / 19000)));
        link = small ? 110 : Math.min(165, W / 7.5);
        var i;
        if (oldW && nodes.length) {
          for (i = 0; i < nodes.length; i++) { nodes[i].x *= W / oldW; nodes[i].y *= H / oldH; }
          if (nodes.length > n) nodes.length = n;
        }
        while (nodes.length < n) nodes.push(makeNode());
        pulse = null;
        if (!running) draw(performance.now());
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
        if (colStale) readColors();
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
        if (running || reduced || !onScreen || doc.hidden || !W) return;
        running = true; last = 0; nextPulse = performance.now() + 1500;
        raf = requestAnimationFrame(frame);
      }
      function stop() { running = false; cancelAnimationFrame(raf); }

      // size: the first ResizeObserver callback arrives after layout, so nothing is read here
      var first = true;
      function onBox(w, h) {
        if (first) { first = false; resize(w, h); start(); return; }
        clearTimeout(rt);
        rt = setTimeout(function () { resize(w, h); }, 120);
      }
      if (window.ResizeObserver) {
        new ResizeObserver(function (es) {
          var e = es[es.length - 1], b = e.borderBoxSize && e.borderBoxSize[0];
          onBox(b ? b.inlineSize : e.contentRect.width, b ? b.blockSize : e.contentRect.height);
        }).observe(heroEl);
      } else {
        // no ResizeObserver: one measurement now (the page is loaded and idle) and on window resize
        var measure = function () { onBox(heroEl.offsetWidth, heroEl.offsetHeight); };
        measure();
        window.addEventListener('resize', measure);
      }
      if (hasIO) new IntersectionObserver(function (en) { onScreen = en[en.length - 1].isIntersecting; if (onScreen) start(); else stop(); }).observe(heroEl);
      // the window became narrow (phone rotated, window shrunk): stop and clear; it does not restart until the next load
      var onNarrow = function (e) { if (e.matches) { stop(); ctx.clearRect(0, 0, W, H); } };
      if (narrow.addEventListener) narrow.addEventListener('change', onNarrow);
      doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); else start(); });
      doc.addEventListener('themechange', function () {
        colStale = true;
        if (!running && W) requestAnimationFrame(function () { draw(performance.now()); });
      });
      if (mq.addEventListener) mq.addEventListener('change', function (e) { if (e.matches) { stop(); ctx.clearRect(0, 0, W, H); } });
    }

    // after the load event, then when the browser is idle
    function whenIdle() {
      if (window.requestIdleCallback) window.requestIdleCallback(begin, { timeout: 4000 });
      else setTimeout(begin, 1500);
    }
    if (doc.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });
  })();

  /* ---------- links into folded <details> ----------
     A hash (on load, on hashchange) or a clicked in-page link that points at an element inside a closed
     <details> opens every closed ancestor first and then scrolls, so the target is never hidden.
     A link to the <details> itself opens it too. */
  function hashTarget(h) {
    if (!h || h.length < 2 || h.charAt(0) !== '#') return null;
    var id = h.slice(1);
    try { id = decodeURIComponent(id); } catch (e) { /* keep the raw id */ }
    return doc.getElementById(id);
  }
  function openFolds(el) {
    var opened = false, child = null;
    for (var n = el; n && n.nodeType === 1; child = n, n = n.parentElement) {
      // the <summary> row stays visible when the <details> is closed, so a target inside it needs no opening
      if (n.tagName === 'DETAILS' && !n.open && !(child && child.tagName === 'SUMMARY')) { n.open = true; opened = true; }
    }
    return opened;
  }
  function showHash(smooth) {
    var el = hashTarget(location.hash);
    if (!el || !openFolds(el)) return;
    // the page has reflowed: scroll again once the new layout is in place
    requestAnimationFrame(function () { el.scrollIntoView({ block: 'start', behavior: smooth ? 'auto' : 'instant' }); });
  }
  showHash(false);
  window.addEventListener('hashchange', function () { showHash(true); });
  doc.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var el = hashTarget(a.getAttribute('href'));
    if (el) openFolds(el);                                  // opened before the browser's own scroll-to-fragment runs
  });

  /* ---------- lightbox (native dialog) ---------- */
  var dlg = $('#lightbox');
  if (dlg && typeof dlg.showModal === 'function') {
    var lbImg = $('#lb-img'), lbCap = $('#lb-cap'), lbCount = $('#lb-count');
    var lbPrev = $('#lb-prev'), lbNext = $('#lb-next'), lbClose = $('#lb-close');
    var items = [], idx = 0, opener = null, lbClr = 0;
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
      clearTimeout(lbClr);
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
      clearTimeout(lbClr);
      lbClr = setTimeout(function () { lbImg.removeAttribute('src'); }, 260);   // after the 200 ms fade, so the picture does not vanish first
      if (opener && opener.focus) opener.focus();
    });
  }

  /* ---------- slideshows (phone / browser / figure / photo frames) ---------- */
  $$('[data-slideshow]').forEach(function (ss) {
    var tracks = $$('.ss-frame', ss).map(function (f) { return $$('.ss-slide', f); });
    var caps = $$('.ss-cap-t', ss), dots = $$('.ss-dot', ss);
    var prev = $('.ss-prev', ss), next = $('.ss-next', ss), pp = $('.ss-pp', ss);
    if (!tracks.length) return;
    var n = Math.max.apply(null, tracks.map(function (t) { return t.length; }));
    if (tracks[0]) n = tracks[0].length;
    var interval = parseInt(ss.getAttribute('data-interval'), 10) || 3500;
    var cur = 0, timer = 0, hovering = false, inside = false, seen = !hasIO, tabOn = !doc.hidden, paused = reduced;
    ss.classList.add('is-live');

    function warm(k) {
      tracks.forEach(function (sl) {
        var im = sl[k % sl.length] && sl[k % sl.length].querySelector('img');
        if (im && im.getAttribute('loading') === 'lazy') im.setAttribute('loading', 'eager');
      });
    }
    function show(i) {
      cur = (i + n) % n;
      tracks.forEach(function (sl, t) {
        var k = cur % sl.length;
        sl.forEach(function (a, j) {
          var on = j === k;
          a.classList.toggle('is-active', on);
          if (on) { a.removeAttribute('aria-hidden'); a.removeAttribute('tabindex'); }
          else { a.setAttribute('aria-hidden', 'true'); a.setAttribute('tabindex', '-1'); }
        });
        if (caps[t]) caps[t].textContent = sl[k].getAttribute('data-alt') || '';
      });
      dots.forEach(function (d, j) { if (j === cur) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
      if (seen) warm(cur + 1);                              // never pull in the next picture of a slideshow nobody has scrolled to
    }
    function canRun() { return !paused && !hovering && !inside && seen && tabOn && n > 1 && !root.classList.contains('lb-open'); }
    function sync() {
      if (timer) { clearInterval(timer); timer = 0; }
      ss.classList.toggle('is-paused', !canRun());
      if (canRun()) timer = setInterval(function () { show(cur + 1); }, interval);
    }
    function setPaused(p) {
      paused = p;
      if (pp) {
        pp.setAttribute('aria-pressed', p ? 'true' : 'false');
        pp.setAttribute('aria-label', pp.getAttribute(p ? 'data-play' : 'data-pause'));
        pp.classList.toggle('is-paused', p);
      }
      sync();
    }
    if (prev) prev.addEventListener('click', function () { show(cur - 1); sync(); });
    if (next) next.addEventListener('click', function () { show(cur + 1); sync(); });
    dots.forEach(function (d, j) { d.addEventListener('click', function () { show(j); sync(); }); });
    if (pp) pp.addEventListener('click', function () { setPaused(!paused); });
    ss.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { hovering = true; sync(); } });
    ss.addEventListener('pointerleave', function () { hovering = false; sync(); });
    ss.addEventListener('focusin', function () { inside = true; sync(); });
    ss.addEventListener('focusout', function (e) { if (!ss.contains(e.relatedTarget)) { inside = false; sync(); } });
    ss.addEventListener('click', function () { setTimeout(sync, 0); });
    ss.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('.ss-ctl')) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); }
      }
    });
    doc.addEventListener('visibilitychange', function () { tabOn = !doc.hidden; sync(); });
    doc.addEventListener('close', function () { sync(); }, true);
    if (hasIO) new IntersectionObserver(function (en) { seen = en[en.length - 1].isIntersecting; if (seen) warm(cur + 1); sync(); }, { threshold: 0.25 }).observe(ss);
    if (mq.addEventListener) mq.addEventListener('change', function (e) { if (e.matches) setPaused(true); });
    setPaused(paused);
    show(0);
  });

  /* ---------- skills: one button opens (or closes) every "+N more" group. It is hidden in the HTML, so without JavaScript only the per-group buttons exist ---------- */
  var skAll = $('[data-sk-all]');
  var skMore = $$('.sk-more');
  if (skAll && skMore.length) {
    var skLab = skAll.querySelector('.sk-all-t');
    var skSync = function () {
      var all = skMore.every(function (d) { return d.open; });
      skAll.setAttribute('aria-expanded', all ? 'true' : 'false');
      if (skLab) skLab.textContent = all ? 'Show fewer skills' : 'Show all skills';
    };
    skAll.hidden = false;
    skAll.addEventListener('click', function () {
      var open = skAll.getAttribute('aria-expanded') !== 'true';
      skMore.forEach(function (d) { d.open = open; });
      skSync();
    });
    skMore.forEach(function (d) { d.addEventListener('toggle', skSync); });
  }

  /* ---------- reference e-mail: assembled on click, shown as a mailto link ---------- */
  $$('button[data-reveal="inline"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var addr;
      try { addr = atob(btn.getAttribute('data-a')) + '@' + atob(btn.getAttribute('data-b')); } catch (e) { return; }
      var link = doc.createElement('a');
      link.className = 'ref-act ref-addr';
      link.href = 'mailto:' + addr;
      var ico = btn.querySelector('svg');
      if (ico) link.appendChild(ico);
      var sp = doc.createElement('span');
      sp.textContent = addr;
      link.appendChild(sp);
      btn.parentNode.replaceChild(link, btn);
      link.focus();
    });
  });

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

  /* ---------- card spotlight and cursor-lit borders follow the pointer (one handler, once per frame: read the box, then write) ----------
     .card uses --mx / --my for its inner glow; .lit-card (bento tiles, research cards, featured post) for the border ring. */
  if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
    var spot = null, spotQueued = false;
    var paintSpot = function () {
      spotQueued = false;
      if (!spot) return;
      var c = spot.card, r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (spot.x - r.left) + 'px');
      c.style.setProperty('--my', (spot.y - r.top) + 'px');
      spot = null;
    };
    doc.addEventListener('pointermove', function (e) {
      var c = e.target.closest ? e.target.closest('.card, .lit-card') : null;
      if (!c) return;
      spot = { card: c, x: e.clientX, y: e.clientY };
      if (!spotQueued) { spotQueued = true; requestAnimationFrame(paintSpot); }
    }, { passive: true });
  }

  /* ---------- reduced-motion changes at runtime: everything that waits for scrolling is shown at once ---------- */
  if (mq.addEventListener) {
    mq.addEventListener('change', function (e) {
      reduced = e.matches;
      if (reduced) {
        once.forEach(function (el) { el.classList.add('in'); });
        lits.forEach(function (el) { el.classList.add('in'); });
        onReduce.forEach(function (fn) { fn(); });
      }
    });
  }

})();
