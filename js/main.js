/* ============================================================
   Code Cortex — Shared Interactions
   ============================================================ */
(function () {
    'use strict';

    /* Enable JS-gated animations (progressive enhancement) */
    document.documentElement.classList.add('js');

    /* Mobile menu toggle */
    var menuBtn = document.getElementById('menuBtn');
    var mobileMenu = document.getElementById('mobileMenu');
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', function () {
            mobileMenu.classList.toggle('hidden');
        });
        // Close on link click
        mobileMenu.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () {
                mobileMenu.classList.add('hidden');
            });
        });
    }

    /* Scroll reveal for .fade-up elements */
    var revealEls = document.querySelectorAll('.fade-up');
    if ('IntersectionObserver' in window && revealEls.length) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        revealEls.forEach(function (el) { observer.observe(el); });
    } else {
        revealEls.forEach(function (el) { el.classList.add('in'); });
    }

    /* Header shrink on scroll */
    var header = document.getElementById('siteHeader');
    var bar = null;
    if (header) {
        bar = document.createElement('div');
        bar.className = 'scroll-progress';
        header.appendChild(bar);
    }
    var toTop = document.createElement('button');
    toTop.className = 'to-top';
    toTop.setAttribute('aria-label', 'Back to top');
    toTop.innerHTML = '<span class="material-symbols-outlined">arrow_upward</span>';
    toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.body.appendChild(toTop);

    var ticking = false;
    function onScroll() {
        var y = window.scrollY;
        var max = document.documentElement.scrollHeight - window.innerHeight;
        if (header) { header.classList.toggle('scrolled', y > 24); }
        if (bar) { bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')'; }
        toTop.classList.toggle('show', y > 600);
        ticking = false;
    }
    window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();

    /* Animated stat counters (e.g. "30+", "99%", "24/7") */
    var nums = document.querySelectorAll('.footprint .num');
    if ('IntersectionObserver' in window && nums.length &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var countObs = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) { return; }
                countObs.unobserve(entry.target);
                var el = entry.target;
                var m = el.textContent.trim().match(/^(\d+)(.*)$/);
                if (!m || el.textContent.indexOf('/') !== -1) { return; }
                var end = parseInt(m[1], 10), suffix = m[2], t0 = null;
                function step(ts) {
                    if (t0 === null) { t0 = ts; }
                    var p = Math.min((ts - t0) / 1200, 1);
                    el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suffix;
                    if (p < 1) { requestAnimationFrame(step); }
                }
                requestAnimationFrame(step);
            });
        }, { threshold: 0.5 });
        nums.forEach(function (n) { countObs.observe(n); });
    }

    /* Card spotlight follows the cursor */
    document.querySelectorAll('.tech-card').forEach(function (card) {
        card.addEventListener('pointermove', function (e) {
            var r = card.getBoundingClientRect();
            card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
    });

    /* Mobile menu button state for assistive tech */
    if (menuBtn && mobileMenu) {
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.addEventListener('click', function () {
            menuBtn.setAttribute('aria-expanded', String(!mobileMenu.classList.contains('hidden')));
        });
    }

    /* Generic contact form (no backend) */
    var forms = document.querySelectorAll('form[data-demo]');
    forms.forEach(function (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var btn = form.querySelector('button[type="submit"]');
            if (btn) {
                var original = btn.textContent;
                btn.textContent = 'Message Sent ✓';
                btn.disabled = true;
                setTimeout(function () {
                    btn.textContent = original;
                    btn.disabled = false;
                    form.reset();
                }, 2600);
            }
        });
    });

    /* Project category filtering */
    var filterPills = document.querySelectorAll('.pill[data-filter]');
    var projectCards = document.querySelectorAll('[data-categories]');
    if (filterPills.length && projectCards.length) {
        filterPills.forEach(function (pill) {
            pill.addEventListener('click', function () {
                filterPills.forEach(function (p) { p.classList.remove('active'); });
                pill.classList.add('active');
                var f = pill.getAttribute('data-filter');
                projectCards.forEach(function (card) {
                    var cats = (card.getAttribute('data-categories') || '').split(' ');
                    var show = f === 'all' || cats.indexOf(f) !== -1;
                    card.style.display = show ? '' : 'none';
                    if (show) { card.style.opacity = '1'; }
                });
            });
        });
    }

    /* Featured projects carousel (home page) */
    var featuredTrack = document.getElementById('featuredTrack');
    if (featuredTrack) {
        var fPrev = document.getElementById('featuredPrev');
        var fNext = document.getElementById('featuredNext');
        var fStep = function () {
            var first = featuredTrack.firstElementChild;
            var w = first ? first.getBoundingClientRect().width + 24 : featuredTrack.clientWidth * 0.8;
            return w;
        };
        var fUpdate = function () {
            if (fPrev) { fPrev.style.opacity = featuredTrack.scrollLeft > 8 ? '1' : '.35'; }
            if (fNext) { fNext.style.opacity = (featuredTrack.scrollLeft + featuredTrack.clientWidth < featuredTrack.scrollWidth - 8) ? '1' : '.35'; }
        };
        if (fPrev) { fPrev.addEventListener('click', function () { featuredTrack.scrollBy({ left: -fStep(), behavior: 'smooth' }); }); }
        if (fNext) { fNext.addEventListener('click', function () { featuredTrack.scrollBy({ left: fStep(), behavior: 'smooth' }); }); }
        featuredTrack.addEventListener('scroll', fUpdate);
        fUpdate();
    }
})();
