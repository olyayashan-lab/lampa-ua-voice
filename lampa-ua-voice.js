(function () {
    'use strict';

    if (window.__LAMPA_UA_VOICE_201__) return;
    window.__LAMPA_UA_VOICE_201__ = true;

    var PLUGIN = 'ua_voice';
    var VERSION = '2.0.1';

    var STORE = {
        enabled: 'ua_voice_enabled',
        api: 'ua_voice_api'
    };

    var currentMovie = null;
    var observer = null;
    var injectTimer = null;

    function log() {
        try {
            var args = Array.prototype.slice.call(arguments);
            args.unshift('[UA Voice]');
            console.log.apply(console, args);
        } catch (e) {}
    }

    function noty(text) {
        try {
            if (window.Lampa && Lampa.Noty && Lampa.Noty.show) return Lampa.Noty.show(text);
        } catch (e) {}
        log(text);
    }

    function get(key, def) {
        try {
            if (Lampa.Storage && Lampa.Storage.get) return Lampa.Storage.get(key, def);
        } catch (e) {}
        return def;
    }

    function registerManifest() {
        try {
            if (!Lampa.Manifest) Lampa.Manifest = {};

            var manifest = {
                type: 'other',
                version: VERSION,
                name: 'UA Voice 🇺🇦',
                description: 'Українські озвучки для Lampa/CUB',
                component: PLUGIN
            };

            if (Array.isArray(Lampa.Manifest.plugins)) {
                var exists = Lampa.Manifest.plugins.some(function (p) {
                    return p && p.component === PLUGIN;
                });
                if (!exists) Lampa.Manifest.plugins.push(manifest);
            } else {
                if (!Lampa.Manifest.plugins || typeof Lampa.Manifest.plugins !== 'object') {
                    Lampa.Manifest.plugins = {};
                }
                Lampa.Manifest.plugins[PLUGIN] = manifest;
            }
        } catch (e) {
            log('manifest', e);
        }
    }

    function addStyle() {
        if (document.getElementById('ua-voice-style')) return;

        var style = document.createElement('style');
        style.id = 'ua-voice-style';
        style.textContent = [
            '.ua-voice--button{display:flex!important;align-items:center;justify-content:center;gap:.45em;}',
            '.ua-voice--button svg{width:1.25em;height:1.25em;flex:0 0 auto;}',
            '.ua-voice--fallback{margin-left:.5em;}',
            '.ua-voice--floating{position:fixed;left:4.2%;bottom:8%;z-index:9999;',
            'background:rgba(25,25,25,.88);color:#fff;border-radius:.6em;',
            'padding:.7em 1em;font-size:1.05em;display:flex;align-items:center;gap:.45em;}',
            '.ua-voice--floating.focus,.ua-voice--floating.selector:focus{outline:3px solid #fff;}'
        ].join('');
        document.head.appendChild(style);
    }

    function buildButton(className) {
        var el = document.createElement('div');
        el.className = (className || '') + ' selector ua-voice--button';
        el.setAttribute('data-ua-voice', '1');
        el.innerHTML =
            '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
            '<path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.06A4.5 4.5 0 0 0 16.5 12zm0-8.66v2.07A8 8 0 0 1 20 12a8 8 0 0 1-3.5 6.59v2.07A10 10 0 0 0 22 12a10 10 0 0 0-5.5-8.66z"/>' +
            '</svg><span>🇺🇦 Українська</span>';

        function action(e) {
            try { if (e) e.stopPropagation(); } catch (_) {}
            openUa(currentMovie);
        }

        el.addEventListener('click', action);
        el.addEventListener('hover:enter', action);
        return el;
    }

    function looksLikeFullCard() {
        var text = (document.body && document.body.innerText || '').toLowerCase();

        if (document.querySelector(
            '.full-start,.full-start-new,.full-card,.full__body,.full-screen,.full-page,.full'
        )) return true;

        // CUB fallback: visible movie card usually has source / trailer area
        return (
            text.indexOf('джерело') !== -1 ||
            text.indexOf('трейлер') !== -1 ||
            text.indexOf('детально') !== -1
        );
    }

    function findTarget() {
        var selectors = [
            '.full-start__buttons',
            '.full-start-new__buttons',
            '.full-start__actions',
            '.full__buttons',
            '.full-buttons',
            '.full-actions',
            '.full-card__buttons',
            '.full-card__actions',
            '.card-actions',
            '.movie-actions',
            '.buttons--container'
        ];

        for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (el && el.offsetParent !== null) return { el: el, mode: 'standard' };
        }

        // Find an existing horizontal row of selector buttons near the main movie card
        var candidates = Array.prototype.slice.call(document.querySelectorAll(
            '.full-start .selector, .full .selector, .full-card .selector, [class*="full"] .selector'
        )).filter(function (x) {
            return x.offsetParent !== null && !x.hasAttribute('data-ua-voice');
        });

        if (candidates.length) {
            var parentCounts = [];
            candidates.forEach(function (x) {
                if (!x.parentElement) return;
                var found = parentCounts.find(function (p) { return p.el === x.parentElement; });
                if (found) found.count++;
                else parentCounts.push({el:x.parentElement,count:1});
            });

            parentCounts.sort(function (a,b) { return b.count-a.count; });
            if (parentCounts[0] && parentCounts[0].count >= 2) {
                return { el: parentCounts[0].el, mode: 'row' };
            }
        }

        return null;
    }

    function removeFloatingIfNeeded() {
        var f = document.querySelector('.ua-voice--floating');
        if (f) f.remove();
    }

    function inject() {
        if (get(STORE.enabled, true) === false) return;
        if (!looksLikeFullCard()) {
            removeFloatingIfNeeded();
            return;
        }

        if (document.querySelector('[data-ua-voice="1"]')) return;

        var target = findTarget();

        if (target) {
            var btn = buildButton('ua-voice--fallback');
            target.el.appendChild(btn);
            log('button injected', target.mode);
            return;
        }

        // Last-resort visual fallback for CUB skins:
        // only shown while a full movie card is detected.
        var floating = buildButton('ua-voice--floating');
        document.body.appendChild(floating);
        log('floating fallback injected');
    }

    function normalize(text) {
        return String(text || '').trim().toLowerCase();
    }

    function isUa(item) {
        var s = normalize([
            item && item.language,
            item && item.lang,
            item && item.voice,
            item && item.translation,
            item && item.audio,
            item && item.label,
            item && item.name,
            item && item.title
        ].filter(Boolean).join(' '));

        return /\b(uk|ukr|ua)\b/i.test(s) ||
            s.indexOf('україн') !== -1 ||
            s.indexOf('украин') !== -1 ||
            s.indexOf('укр') !== -1 ||
            s.indexOf('дубляж') !== -1 ||
            s.indexOf('багатоголос') !== -1 ||
            s.indexOf('двоголос') !== -1 ||
            s.indexOf('одноголос') !== -1;
    }

    function movieInfo(movie) {
        movie = movie || {};
        return {
            tmdb: movie.id || movie.tmdb_id || '',
            imdb: movie.imdb_id || '',
            kp: movie.kp_id || movie.kinopoisk_id || '',
            type: movie.number_of_seasons || movie.first_air_date ? 'tv' : 'movie',
            title: movie.title || movie.name || '',
            original_title: movie.original_title || movie.original_name || '',
            year: movie.release_date ? String(movie.release_date).slice(0,4) :
                  movie.first_air_date ? String(movie.first_air_date).slice(0,4) : ''
        };
    }

    function apiUrl(movie) {
        var base = String(get(STORE.api, '') || '').trim();
        if (!base) return '';

        var m = movieInfo(movie);
        var sep = base.indexOf('?') === -1 ? '?' : '&';

        return base + sep +
            'tmdb=' + encodeURIComponent(m.tmdb) +
            '&imdb=' + encodeURIComponent(m.imdb) +
            '&kp=' + encodeURIComponent(m.kp) +
            '&type=' + encodeURIComponent(m.type) +
            '&title=' + encodeURIComponent(m.title) +
            '&original_title=' + encodeURIComponent(m.original_title) +
            '&year=' + encodeURIComponent(m.year);
    }

    function extract(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.results)) return data.results;
        if (Array.isArray(data.items)) return data.items;
        if (Array.isArray(data.sources)) return data.sources;
        if (Array.isArray(data.voices)) return data.voices;
        if (Array.isArray(data.data)) return data.data;
        if (data.data && Array.isArray(data.data.results)) return data.data.results;
        return [];
    }

    function request(url, ok, fail) {
        try {
            if (window.Lampa && Lampa.Reguest) {
                var req = new Lampa.Reguest();
                req.silent(url, ok, fail);
                return;
            }
        } catch (e) {}

        fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(ok)
            .catch(fail);
    }

    function sourceName(item, i) {
        var a = item.voice || item.translation || item.audio || item.label || item.name || item.title;
        var b = item.studio || item.provider || item.source || '';
        var c = item.quality || '';
        return [a || ('Українська озвучка ' + (i+1)), b, c].filter(Boolean).join(' · ');
    }

    function sourceUrl(item) {
        return item.url || item.stream || item.file || item.link || '';
    }

    function play(item, movie) {
        var url = sourceUrl(item);
        if (!url) return noty('Немає посилання на відео');

        try {
            if (Lampa.Player && Lampa.Player.play) {
                Lampa.Player.play({
                    url: url,
                    title: (movie && (movie.title || movie.name)) || 'Відео',
                    movie: movie
                });
                return;
            }
        } catch (e) {
            log('play error', e);
        }

        noty('Не вдалося запустити відео');
    }

    function showSources(items, movie) {
        var ua = items.filter(isUa);
        if (!ua.length) return noty('🇺🇦 Українських озвучок не знайдено');

        var list = ua.map(function (item, i) {
            return {
                title: '🇺🇦 ' + sourceName(item, i),
                source: item
            };
        });

        try {
            if (Lampa.Select && Lampa.Select.show) {
                Lampa.Select.show({
                    title: '🇺🇦 Українська озвучка',
                    items: list,
                    onSelect: function (x) { play(x.source, movie); }
                });
                return;
            }
        } catch (e) {}

        play(ua[0], movie);
    }

    function openUa(movie) {
        var url = apiUrl(movie);

        if (!url) {
            noty('Кнопка працює. Тепер треба вказати API у Налаштування → UA Voice 🇺🇦');
            return;
        }

        noty('Пошук українських озвучок…');
        request(url, function (data) {
            showSources(extract(data), movie);
        }, function (e) {
            log('API', e);
            noty('Помилка отримання озвучок');
        });
    }

    function addSettings() {
        try {
            if (!Lampa.SettingsApi) return;

            try {
                Lampa.SettingsApi.addComponent({
                    component: PLUGIN,
                    name: 'UA Voice 🇺🇦',
                    icon: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 10v4h4l5 5V5L7 10H3z"/></svg>'
                });
            } catch (e) {}

            try {
                Lampa.SettingsApi.addParam({
                    component: PLUGIN,
                    param: { name: STORE.enabled, type: 'trigger', default: true },
                    field: {
                        name: 'Увімкнути UA Voice',
                        description: 'Показувати кнопку української озвучки'
                    }
                });
            } catch (e) {}

            try {
                Lampa.SettingsApi.addParam({
                    component: PLUGIN,
                    param: { name: STORE.api, type: 'input', default: '' },
                    field: {
                        name: 'API джерел',
                        description: 'HTTPS адреса легального або власного API'
                    }
                });
            } catch (e) {}
        } catch (e) {
            log('settings', e);
        }
    }

    function hookLampa() {
        try {
            if (Lampa.Listener && Lampa.Listener.follow) {
                Lampa.Listener.follow('full', function (e) {
                    try {
                        if (e && e.data) currentMovie = e.data.movie || e.data.card || e.data;
                        else if (e && e.object) currentMovie = e.object.movie || e.object.card || currentMovie;
                    } catch (_) {}
                    setTimeout(inject, 60);
                    setTimeout(inject, 300);
                    setTimeout(inject, 900);
                });

                Lampa.Listener.follow('activity', function (e) {
                    try {
                        if (e && e.object) {
                            currentMovie = e.object.movie || e.object.card || currentMovie;
                        }
                    } catch (_) {}
                    setTimeout(inject, 150);
                });
            }
        } catch (e) {
            log('listener', e);
        }
    }

    function startObserver() {
        try {
            observer = new MutationObserver(function () {
                clearTimeout(injectTimer);
                injectTimer = setTimeout(inject, 80);
            });
            observer.observe(document.documentElement || document.body, {
                childList: true,
                subtree: true
            });
        } catch (e) {
            log('observer', e);
        }

        setInterval(inject, 1500);
    }

    function init() {
        registerManifest();
        addStyle();
        addSettings();
        hookLampa();
        startObserver();
        setTimeout(inject, 500);
        log('v' + VERSION + ' CUB fix loaded');
    }

    function wait() {
        if (window.Lampa && Lampa.SettingsApi) init();
        else setTimeout(wait, 300);
    }

    wait();

    window.LampaUAVoice = {
        version: VERSION,
        inject: inject,
        open: openUa
    };
})();
