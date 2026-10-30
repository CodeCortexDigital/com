/* ============================================================
   Code Cortex — home hero: neural-network canvas + product console
   ============================================================ */
(function () {
    'use strict';
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- Neural canvas ---------- */
    [].slice.call(document.querySelectorAll('canvas.neuro')).forEach(function (canvas) {
    if (canvas.getContext) {
        var ctx = canvas.getContext('2d');
        var hero = canvas.parentElement;
        var COLORS = ['47,232,208', '242,24,74', '139,123,255'];   /* logo teal, logo crimson, brand purple */
        var nodes = [], pulses = [], W = 0, H = 0, dpr = 1, running = false, raf = 0;
        var mouse = { x: -9999, y: -9999, on: false };

        function resize() {
            var r = hero.getBoundingClientRect();
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            W = r.width; H = r.height;
            canvas.width = W * dpr; canvas.height = H * dpr;
            canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            var count = Math.max(28, Math.min(80, Math.round(W * H / 17000)));
            nodes = [];
            for (var i = 0; i < count; i++) {
                nodes.push({
                    x: Math.random() * W, y: Math.random() * H,
                    vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28,
                    r: Math.random() * 1.6 + .9, c: COLORS[i % 3 === 0 ? 0 : (i % 3 === 1 ? 2 : (i % 7 === 0 ? 1 : 0))]
                });
            }
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            var link = W < 700 ? 95 : 135, i, j, a, b, dx, dy, d, al;
            for (i = 0; i < nodes.length; i++) {
                a = nodes[i];
                if (!reduce) {
                    a.x += a.vx; a.y += a.vy;
                    if (a.x < -20) a.x = W + 20; else if (a.x > W + 20) a.x = -20;
                    if (a.y < -20) a.y = H + 20; else if (a.y > H + 20) a.y = -20;
                    if (mouse.on) {            /* nodes lean toward the pointer */
                        dx = mouse.x - a.x; dy = mouse.y - a.y; d = Math.sqrt(dx * dx + dy * dy);
                        if (d < 190 && d > 1) { a.x += dx / d * .55; a.y += dy / d * .55; }
                    }
                }
                for (j = i + 1; j < nodes.length; j++) {
                    b = nodes[j]; dx = a.x - b.x; dy = a.y - b.y; d = Math.sqrt(dx * dx + dy * dy);
                    if (d < link) {
                        al = (1 - d / link) * .38;
                        ctx.strokeStyle = 'rgba(' + a.c + ',' + al.toFixed(3) + ')';
                        ctx.lineWidth = .8;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                        if (!reduce && pulses.length < 7 && Math.random() < .0009) pulses.push({ a: a, b: b, t: 0, c: a.c });
                    }
                }
                if (mouse.on) {
                    dx = mouse.x - a.x; dy = mouse.y - a.y; d = Math.sqrt(dx * dx + dy * dy);
                    if (d < 170) {
                        al = (1 - d / 170) * .6;
                        ctx.strokeStyle = 'rgba(255,255,255,' + al.toFixed(3) + ')';
                        ctx.lineWidth = .9;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
                    }
                }
            }
            for (i = 0; i < nodes.length; i++) {
                a = nodes[i];
                ctx.fillStyle = 'rgba(' + a.c + ',.9)';
                ctx.shadowColor = 'rgba(' + a.c + ',.9)'; ctx.shadowBlur = 8;
                ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
            }
            ctx.shadowBlur = 0;
            /* signals travelling along links, like neurons firing */
            for (i = pulses.length - 1; i >= 0; i--) {
                var p = pulses[i]; p.t += .02;
                if (p.t >= 1) { pulses.splice(i, 1); continue; }
                var px = p.a.x + (p.b.x - p.a.x) * p.t, py = p.a.y + (p.b.y - p.a.y) * p.t;
                ctx.fillStyle = 'rgba(' + p.c + ',1)'; ctx.shadowColor = 'rgba(' + p.c + ',1)'; ctx.shadowBlur = 16;
                ctx.beginPath(); ctx.arc(px, py, 2.4, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0;
            }
        }

        function loop() { draw(); raf = running ? requestAnimationFrame(loop) : 0; }
        function start() { if (!running && !reduce) { running = true; raf = requestAnimationFrame(loop); } }
        function stop() { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } }

        resize(); draw();
        var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { resize(); draw(); }, 150); });
        hero.addEventListener('pointermove', function (e) {
            var r = hero.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
        }, { passive: true });
        hero.addEventListener('pointerleave', function () { mouse.on = false; });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (en) { en[0].isIntersecting ? start() : stop(); }, { threshold: 0 }).observe(hero);
        } else { start(); }
        document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    }
    });

    /* ---------- Product console ---------- */
    var cons = document.getElementById('cortexConsole');
    if (cons) {
        var tabs = [].slice.call(cons.querySelectorAll('.ctab'));
        var panels = [].slice.call(cons.querySelectorAll('.cpanel'));
        var bar = cons.querySelector('.console-progress span');
        var cur = 0, timer = null, DUR = 6000, paused = false;

        function show(n, user) {
            cur = (n + tabs.length) % tabs.length;
            tabs.forEach(function (t, i) { t.classList.toggle('on', i === cur); t.setAttribute('aria-selected', i === cur ? 'true' : 'false'); t.tabIndex = i === cur ? 0 : -1; });
            panels.forEach(function (p, i) {
                var on = i === cur; p.hidden = !on; p.classList.remove('on');
                if (on) { void p.offsetWidth; p.classList.add('on'); }
            });
            restartBar();
            if (user) { clearTimeout(timer); schedule(); }
        }
        function restartBar() {
            if (!bar) return;
            bar.style.animation = 'none'; void bar.offsetWidth;
            bar.style.animation = (reduce || paused) ? 'none' : 'cbar ' + DUR + 'ms linear forwards';
            bar.style.width = (reduce || paused) ? '0' : '';
        }
        function schedule() {
            clearTimeout(timer);
            if (reduce || paused) return;
            timer = setTimeout(function () { show(cur + 1); schedule(); }, DUR);
        }
        tabs.forEach(function (t, i) {
            t.addEventListener('click', function () { show(i, true); });
            t.addEventListener('keydown', function (e) {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault(); var n = cur + (e.key === 'ArrowRight' ? 1 : -1); show(n, true); tabs[(n + tabs.length) % tabs.length].focus();
                }
            });
        });
        cons.addEventListener('pointerenter', function () { paused = true; clearTimeout(timer); restartBar(); });
        cons.addEventListener('pointerleave', function () { paused = false; restartBar(); schedule(); });
        cons.addEventListener('focusin', function () { paused = true; clearTimeout(timer); restartBar(); });
        cons.addEventListener('focusout', function () { paused = false; restartBar(); schedule(); });
        show(0); schedule();
    }
})();
