(function () {
    'use strict';

    if (window.__LAMPA_UA_VOICE_V2__) return;
    window.__LAMPA_UA_VOICE_V2__ = true;

    var PLUGIN = 'ua_voice';
    var VERSION = '2.0.0';

    var STORE = {
        enabled: 'ua_voice_enabled',
        api: 'ua_voice_api',
        auto: 'ua_voice_auto_select',
        last: 'ua_voice_last_name'
    };

    var MANIFEST = {
        type: 'other',
        version: VERSION,
        name: 'UA Voice 🇺🇦',
        description: 'Українські озвучки для Lampa',
        component: PLUGIN
    };

    function log() {
        try {
            var a = Array.prototype.slice.call(arguments);
            a.unshift('[UA Voice]');
            console.log.apply(console, a);
        } catch (e) {}
    }

    function noty(text) {
        try {
            if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
            else log(text);
        } catch (e) { log(text); }
    }

    function get(key, def) {
        try {
            if (Lampa.Storage && Lampa.Storage.get) return Lampa.Storage.get(key, def);
        } catch (e) {}
        return def;
    }

    function set(key, val) {
        try {
            if (Lampa.Storage && Lampa.Storage.set) Lampa.Storage.set(key, val);
        } catch (e) {}
    }

    function registerManifest() {
        try {
            if (!Lampa.Manifest) Lampa.Manifest = {};

            if (Array.isArray(Lampa.Manifest.plugins)) {
                var exists = Lampa.Manifest.plugins.some(function (p) {
                    return p && p.component === PLUGIN;
                });
                if (!exists) Lampa.Manifest.plugins.push(MANIFEST);
            } else if (Lampa.Manifest.plugins && typeof Lampa.Manifest.plugins === 'object') {
                Lampa.Manifest.plugins[PLUGIN] = MANIFEST;
            } else {
                Lampa.Manifest.plugins = {};
                Lampa.Manifest.plugins[PLUGIN] = MANIFEST;
            }
        } catch (e) {
            log('manifest error', e);
        }
    }

    function normalize(text) {
        return String(text || '').trim().toLowerCase();
    }

    function isUa(item) {
        var s = normalize([
            item && item.language,
            item && item.lang,
            item && item.audio,
            item && item.voice,
            item && item.translation,
            item && item.title,
            item && item.name,
            item && item.label
        ].filter(Boolean).join(' '));

        return (
            /\b(uk|ukr|ua)\b/i.test(s) ||
            s.indexOf('україн') !== -1 ||
            s.indexOf('украин') !== -1 ||
            s.indexOf('укр') !== -1 ||
            s.indexOf('дубляж') !== -1 ||
            s.indexOf('багатоголос') !== -1 ||
            s.indexOf('двоголос') !== -1 ||
            s.indexOf('одноголос') !== -1
        );
    }

    function movieIds(movie) {
        movie = movie || {};

        return {
            tmdb: movie.id || movie.tmdb_id || '',
            imdb: movie.imdb_id || '',
            kp: movie.kp_id || movie.kinopoisk_id || '',
            title: movie.title || movie.name || '',
            original_title: movie.original_title || movie.original_name || '',
            year: movie.release_date ? String(movie.release_date).slice(0, 4) :
                  movie.first_air_date ? String(movie.first_air_date).slice(0, 4) : '',
            type: movie.number_of_seasons || movie.first_air_date ? 'tv' : 'movie'
        };
    }

    function buildApiUrl(movie) {
        var base = String(get(STORE.api, '') || '').trim();
        if (!base) return '';

        var ids = movieIds(movie);
        var sep = base.indexOf('?') === -1 ? '?' : '&';

        return base + sep +
            'tmdb=' + encodeURIComponent(ids.tmdb) +
            '&imdb=' + encodeURIComponent(ids.imdb) +
            '&kp=' + encodeURIComponent(ids.kp) +
            '&type=' + encodeURIComponent(ids.type) +
            '&title=' + encodeURIComponent(ids.title) +
            '&original_title=' + encodeURIComponent(ids.original_title) +
            '&year=' + encodeURIComponent(ids.year);
    }

    function requestJson(url, onSuccess, onError) {
        try {
            if (Lampa.Network) {
                var network = new Lampa.Reguest();
                network.silent(url, function (data) {
                    onSuccess(data);
                }, function (err) {
                    onError(err);
                });
                return;
            }
        } catch (e) {}

        fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(onSuccess)
            .catch(onError);
    }

    function extractItems(data) {
        if (!data) return [];

        var items = [];

        if (Array.isArray(data)) items = data;
        else if (Array.isArray(data.results)) items = data.results;
        else if (Array.isArray(data.items)) items = data.items;
        else if (Array.isArray(data.sources)) items = data.sources;
        else if (Array.isArray(data.voices)) items = data.voices;
        else if (data.data && Array.isArray(data.data)) items = data.data;
        else if (data.data && Array.isArray(data.data.results)) items = data.data.results;

        return items.filter(function (x) {
            return x && (x.url || x.stream || x.file || x.link);
        });
    }

    function sourceUrl(item) {
        return item.url || item.stream || item.file || item.link || '';
    }

    function sourceName(item, index) {
        var voice = item.voice || item.translation || item.audio || item.label || item.name || item.title;
        var studio = item.studio || item.provider || item.source || '';
        var quality = item.quality || '';

        var parts = [];
        if (voice) parts.push(String(voice));
        if (studio && normalize(studio) !== normalize(voice)) parts.push(String(studio));
        if (quality) parts.push(String(quality));

        return parts.length ? parts.join(' · ') : ('Українська озвучка ' + (index + 1));
    }

    function playSource(item, movie) {
        var url = sourceUrl(item);
        if (!url) {
            noty('Не вдалося отримати посилання на відео');
            return;
        }

        set(STORE.last, sourceName(item, 0));

        var title = (movie && (movie.title || movie.name)) || 'Відео';

        try {
            if (Lampa.Player && Lampa.Player.play) {
                Lampa.Player.play({
                    url: url,
                    title: title,
                    movie: movie,
                    quality: item.quality || '',
                    subtitles: item.subtitles || []
                });

                if (Lampa.Player.playlist) {
                    Lampa.Player.playlist([{
                        url: url,
                        title: title,
                        movie: movie
                    }]);
                }

                return;
            }
        } catch (e) {
            log('Player.play error', e);
        }

        noty('Плеєр Lampa не прийняв це джерело');
    }

    function showSources(items, movie) {
        var ua = items.filter(isUa);

        if (!ua.length) {
            noty('🇺🇦 Українських озвучок для цього відео не знайдено');
            return;
        }

        var list = ua.map(function (item, i) {
            return {
                title: '🇺🇦 ' + sourceName(item, i),
                subtitle: [item.language || item.lang || '', item.quality || '']
                    .filter(Boolean).join(' · '),
                source: item
            };
        });

        try {
            if (Lampa.Select && Lampa.Select.show) {
                Lampa.Select.show({
                    title: '🇺🇦 Українська озвучка',
                    items: list,
                    onSelect: function (selected) {
                        playSource(selected.source, movie);
                    },
                    onBack: function () {
                        try { Lampa.Controller.toggle('content'); } catch (e) {}
                    }
                });
                return;
            }
        } catch (e) {
            log('Select error', e);
        }

        playSource(ua[0], movie);
    }

    function loadSources(movie) {
        if (get(STORE.enabled, true) === false) return;

        var api = buildApiUrl(movie);

        if (!api) {
            noty('Вкажіть API джерел у Налаштування → UA Voice 🇺🇦');
            return;
        }

        noty('Пошук українських озвучок…');

        requestJson(api, function (data) {
            var items = extractItems(data);
            showSources(items, movie);
        }, function (err) {
            log('API error', err);
            noty('Не вдалося отримати список озвучок');
        });
    }

    function buttonHtml() {
        return $(
            '<div class="full-start__button selector ua-voice--button">' +
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">' +
                    '<path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.06A4.5 4.5 0 0 0 16.5 12zm0-8.66v2.07A8 8 0 0 1 20 12a8 8 0 0 1-3.5 6.59v2.07A10 10 0 0 0 22 12a10 10 0 0 0-5.5-8.66z"/>' +
                '</svg>' +
                '<span>🇺🇦 Українська</span>' +
            '</div>'
        );
    }

    function addButton(movie, root) {
        try {
            if (!root || !root.length) return;
            if (root.find('.ua-voice--button').length) return;

            var buttons = root.find('.full-start__buttons');
            if (!buttons.length) return;

            var btn = buttonHtml();

            btn.on('hover:enter click', function () {
                loadSources(movie);
            });

            buttons.append(btn);
        } catch (e) {
            log('button error', e);
        }
    }

    function observeFull() {
        try {
            Lampa.Listener.follow('full', function (e) {
                if (e.type !== 'complite') return;

                var movie = e.data && e.data.movie ? e.data.movie : e.data;
                var root = e.object && e.object.activity && e.object.activity.render
                    ? e.object.activity.render()
                    : $('.full-start');

                setTimeout(function () {
                    addButton(movie, root);
                }, 50);
            });
        } catch (e) {
            log('full listener error', e);
        }

        try {
            Lampa.Listener.follow('activity', function (e) {
                if (e.type !== 'start') return;
                if (e.component !== 'full' && e.component !== 'showy') return;

                setTimeout(function () {
                    var movie = e.object && (e.object.card || e.object.movie);
                    var root = e.object && e.object.activity && e.object.activity.render
                        ? e.object.activity.render()
                        : $('.full-start');
                    addButton(movie, root);
                }, 250);
            });
        } catch (e) {}
    }

    function addSettings() {
        try {
            if (!Lampa.SettingsApi) return;

            try {
                Lampa.SettingsApi.addComponent({
                    component: PLUGIN,
                    name: 'UA Voice 🇺🇦',
                    icon: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.06A4.5 4.5 0 0 0 16.5 12z"/></svg>'
                });
            } catch (e) {}

            Lampa.SettingsApi.addParam({
                component: PLUGIN,
                param: {
                    name: STORE.enabled,
                    type: 'trigger',
                    default: true
                },
                field: {
                    name: 'Увімкнути UA Voice',
                    description: 'Показувати кнопку українських озвучок у картці фільму'
                }
            });

            Lampa.SettingsApi.addParam({
                component: PLUGIN,
                param: {
                    name: STORE.api,
                    type: 'input',
                    default: ''
                },
                field: {
                    name: 'API джерел',
                    description: 'HTTPS-адреса твого легального або власного API українських відеоджерел'
                }
            });
        } catch (e) {
            log('settings error', e);
        }
    }

    function init() {
        registerManifest();
        addSettings();
        observeFull();

        log('v' + VERSION + ' loaded');
    }

    function wait() {
        if (window.appready && window.Lampa) {
            init();
            return;
        }

        if (window.Lampa && Lampa.Listener) {
            var done = false;

            Lampa.Listener.follow('app', function (e) {
                if (!done && e.type === 'ready') {
                    done = true;
                    init();
                }
            });

            setTimeout(function () {
                if (!done && window.Lampa && Lampa.SettingsApi) {
                    done = true;
                    init();
                }
            }, 1500);

            return;
        }

        setTimeout(wait, 300);
    }

    wait();

    window.LampaUAVoice = {
        version: VERSION,
        open: loadSources,
        isUa: isUa
    };
})();
