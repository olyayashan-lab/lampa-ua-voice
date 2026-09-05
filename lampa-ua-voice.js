(function () {
    'use strict';

    if (window.__UA_VOICE_CUB_MIN__) return;
    window.__UA_VOICE_CUB_MIN__ = true;

    function log() {
        try {
            var args = Array.prototype.slice.call(arguments);
            args.unshift('[UA Voice MIN]');
            console.log.apply(console, args);
        } catch (e) {}
    }

    function notify(text) {
        try {
            if (window.Lampa && Lampa.Noty && Lampa.Noty.show) {
                Lampa.Noty.show(text);
                return;
            }
        } catch (e) {}
        log(text);
    }

    function makeButton() {
        var btn = document.createElement('div');
        btn.className = 'selector ua-voice-min-button';
        btn.setAttribute('data-ua-voice-min', '1');
        btn.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'gap:8px',
            'padding:10px 14px',
            'margin-left:8px',
            'border-radius:10px',
            'background:rgba(0,0,0,.55)',
            'color:#fff',
            'font-size:18px',
            'cursor:pointer'
        ].join(';');

        btn.innerHTML = '<span>🇺🇦</span><span>Українська</span>';

        function activate(e) {
            try { if (e) e.stopPropagation(); } catch (_) {}
            notify('UA Voice працює');
        }

        btn.addEventListener('click', activate);
        btn.addEventListener('hover:enter', activate);

        return btn;
    }

    function findTarget() {
        var selectors = [
            '.full-start__buttons',
            '.full-start__actions',
            '.full__buttons',
            '.full-buttons',
            '.full-actions',
            '[class*="full"][class*="button"]',
            '[class*="full"] .selector'
        ];

        for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (!el) continue;

            if (selectors[i].indexOf('.selector') !== -1) {
                if (el.parentElement) return el.parentElement;
            } else {
                return el;
            }
        }

        return null;
    }

    function inject() {
        if (document.querySelector('[data-ua-voice-min="1"]')) return;

        var target = findTarget();
        if (!target) return;

        target.appendChild(makeButton());
        log('button added');
    }

    function init() {
        log('init');

        try {
            if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) {
                Lampa.Listener.follow('full', function () {
                    setTimeout(inject, 100);
                    setTimeout(inject, 500);
                    setTimeout(inject, 1200);
                });

                Lampa.Listener.follow('activity', function () {
                    setTimeout(inject, 200);
                });
            }
        } catch (e) {
            log('listener error', e);
        }

        setInterval(inject, 1500);
    }

    function wait() {
        if (window.Lampa) {
            init();
        } else {
            setTimeout(wait, 500);
        }
    }

    wait();

    window.UAVoiceCubMin = {
        version: '0.1',
        inject: inject
    };
})();
