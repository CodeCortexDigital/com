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
    var nums = document.querySelectorAll('.stat-bar .num, .footprint .num');
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

    /* Bento: feature grid gets a wide first card only when the rows stay full (3-col) */
    document.querySelectorAll('.feature-grid').forEach(function (g) {
        if ((g.children.length + 1) % 3 === 0) { g.classList.add('bento-feat'); }
    });

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* Kinetic headline: split hero title into words that rise in */
    var heroTitle = document.querySelector('.hero-v2 h1');
    if (heroTitle && !reduce) {
        var wi = 0;
        var splitNode = function (node) {
            Array.prototype.slice.call(node.childNodes).forEach(function (child) {
                if (child.nodeType === 3) {
                    var frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach(function (part) {
                        if (!part) { return; }
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        var outer = document.createElement('span');
                        outer.className = 'kw';
                        var inner = document.createElement('span');
                        inner.style.setProperty('--i', wi++);
                        inner.textContent = part;
                        outer.appendChild(inner);
                        frag.appendChild(outer);
                    });
                    node.replaceChild(frag, child);
                } else if (child.nodeType === 1 && child.tagName !== 'BR') {
                    splitNode(child);
                }
            });
        };
        splitNode(heroTitle);
    }

    if (finePointer && !reduce) {
        /* Cursor aura */
        var aura = document.createElement('div');
        aura.className = 'cursor-aura';
        document.body.appendChild(aura);
        var ax = 0, ay = 0, tx = 0, ty = 0, raf = null;
        var loop = function () {
            ax += (tx - ax) * 0.12; ay += (ty - ay) * 0.12;
            aura.style.transform = 'translate(' + ax + 'px,' + ay + 'px)';
            raf = (Math.abs(tx - ax) + Math.abs(ty - ay) > 0.5) ? requestAnimationFrame(loop) : null;
        };
        window.addEventListener('pointermove', function (e) {
            tx = e.clientX; ty = e.clientY; aura.classList.add('on');
            if (!raf) { raf = requestAnimationFrame(loop); }
        }, { passive: true });

        /* 3D tilt on lift cards and featured project cards */
        document.querySelectorAll('.tech-card.lift, #featuredTrack .tech-card').forEach(function (card) {
            card.classList.add('tilt');
            card.addEventListener('pointermove', function (e) {
                var r = card.getBoundingClientRect();
                var px = (e.clientX - r.left) / r.width - 0.5;
                var py = (e.clientY - r.top) / r.height - 0.5;
                card.style.setProperty('--ry', (px * 8).toFixed(2) + 'deg');
                card.style.setProperty('--rx', (-py * 8).toFixed(2) + 'deg');
            });
            card.addEventListener('pointerleave', function () {
                card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
            });
        });

        /* Magnetic primary buttons */
        document.querySelectorAll('.btn-primary').forEach(function (btn) {
            btn.classList.add('magnetic');
            btn.addEventListener('pointermove', function (e) {
                var r = btn.getBoundingClientRect();
                btn.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1) + 'px)';
            });
            btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
        });
    }

    /* Film grain overlay */
    if (!reduce) {
        var grain = document.createElement('div');
        grain.className = 'grain';
        document.body.appendChild(grain);
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
