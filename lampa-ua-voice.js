(function () {
    'use strict';

    var MANIFEST = {
        type: 'other',
        version: '1.0.1',
        name: 'UA Voice 🇺🇦',
        description: 'Українські аудіодоріжки для Lampa',
        component: 'ua_voice'
    };

    function registerManifest() {
        try {
            if (!window.Lampa) return false;
            if (!Lampa.Manifest) Lampa.Manifest = {};

            if (Array.isArray(Lampa.Manifest.plugins)) {
                var exists = Lampa.Manifest.plugins.some(function (item) {
                    return item && item.component === MANIFEST.component;
                });
                if (!exists) Lampa.Manifest.plugins.push(MANIFEST);
            } else if (Lampa.Manifest.plugins && typeof Lampa.Manifest.plugins === 'object') {
                Lampa.Manifest.plugins[MANIFEST.component] = MANIFEST;
            } else {
                var plugins = {};
                plugins[MANIFEST.component] = MANIFEST;
                Lampa.Manifest.plugins = plugins;
            }

            return true;
        } catch (e) {
            try { console.log('[UA Voice] manifest error', e); } catch (_) {}
            return false;
        }
    }


    if (window.__LAMPA_UA_VOICE_LOADING__) return;
    window.__LAMPA_UA_VOICE_LOADING__ = true;

    var PLUGIN = 'ua_voice';
    var STORE_ENABLED = 'ua_voice_enabled';
    var STORE_AUTO = 'ua_voice_auto_select';
    var STORE_LAST = 'ua_voice_last_name';

    var UA_WORDS = [
        'uk', 'ukr', 'ukrainian', 'україн', 'украин',
        'ua', 'укр', 'україна', 'украина',
        'дубляж', 'дубльований', 'дубльована',
        'багатоголос', 'двоголос', 'одноголос'
    ];

    var STUDIO_HINTS = [
        'le doyen', 'ledoyen',
        'postmodern', 'post modern',
        'так треба', 'так треба продакшн',
        '1+1', 'ictv', 'новий канал', 'стб',
        'megogo', 'sweet.tv', 'sweet tv',
        'netflix', 'disney', 'uaflix'
    ];

    function log() {
        try {
            var args = Array.prototype.slice.call(arguments);
            args.unshift('[UA Voice]');
            console.log.apply(console, args);
        } catch (e) {}
    }

    function storageGet(key, def) {
        try {
            if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') {
                return Lampa.Storage.get(key, def);
            }
        } catch (e) {}
        try {
            var val = localStorage.getItem(key);
            return val === null ? def : JSON.parse(val);
        } catch (e2) {
            return def;
        }
    }

    function storageSet(key, val) {
        try {
            if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') {
                Lampa.Storage.set(key, val);
                return;
            }
        } catch (e) {}
        try {
            localStorage.setItem(key, JSON.stringify(val));
        } catch (e2) {}
    }

    function notify(text) {
        try {
            if (window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function') {
                Lampa.Noty.show(text);
                return;
            }
        } catch (e) {}
        log(text);
    }

    function normalizeText(track) {
        var values = [];
        if (!track) return '';

        ['name', 'label', 'language', 'lang', 'title', 'groupId', 'id'].forEach(function (k) {
            if (track[k] !== undefined && track[k] !== null) values.push(String(track[k]));
        });

        if (track.attrs) {
            ['NAME', 'LANGUAGE', 'GROUP-ID'].forEach(function (k) {
                if (track.attrs[k]) values.push(String(track.attrs[k]));
            });
        }

        return values.join(' ').toLowerCase();
    }

    function isUkrainian(track) {
        var txt = normalizeText(track);
        if (!txt) return false;

        if (/\b(uk|ukr|ua)\b/i.test(txt)) return true;

        return UA_WORDS.some(function (word) {
            return txt.indexOf(word) !== -1;
        });
    }

    function displayName(track, index) {
        var name =
            track && (track.name || track.label || track.title ||
            (track.attrs && track.attrs.NAME)) || ('Українська доріжка ' + (index + 1));

        var txt = String(name);
        var low = normalizeText(track);

        STUDIO_HINTS.forEach(function (studio) {
            if (low.indexOf(studio) !== -1 && txt.toLowerCase().indexOf(studio) === -1) {
                txt += ' · ' + studio;
            }
        });

        return txt;
    }

    function uniqueTracks(tracks) {
        var seen = {};
        return (tracks || []).filter(function (track, index) {
            var key = normalizeText(track) || ('idx:' + index);
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }

    function getHlsObjects() {
        var found = [];

        function add(obj) {
            if (!obj || found.indexOf(obj) !== -1) return;
            if (Array.isArray(obj.audioTracks) && obj.audioTracks.length) found.push(obj);
        }

        try {
            if (window.Lampa && Lampa.Player) {
                add(Lampa.Player.hls);
                add(Lampa.Player._hls);
                add(Lampa.Player.player && Lampa.Player.player.hls);
            }
        } catch (e) {}

        try {
            Object.keys(window).forEach(function (key) {
                var obj;
                try { obj = window[key]; } catch (e) { return; }
                if (!obj || typeof obj !== 'object') return;
                if (obj.audioTracks && Array.isArray(obj.audioTracks) &&
                    typeof obj.audioTrack !== 'undefined') {
                    add(obj);
                }
            });
        } catch (e2) {}

        return found;
    }

    function getNativeTracks() {
        var result = [];
        try {
            var video = document.querySelector('video');
            if (!video || !video.audioTracks) return result;

            for (var i = 0; i < video.audioTracks.length; i++) {
                var t = video.audioTracks[i];
                result.push({
                    __native: true,
                    __index: i,
                    id: t.id,
                    language: t.language,
                    label: t.label,
                    enabled: t.enabled,
                    _ref: t
                });
            }
        } catch (e) {}
        return result;
    }

    function collectTracks() {
        var result = [];

        getHlsObjects().forEach(function (hls) {
            hls.audioTracks.forEach(function (track, i) {
                var copy = {};
                try {
                    Object.keys(track).forEach(function (k) { copy[k] = track[k]; });
                } catch (e) {}
                copy.__hls = hls;
                copy.__index = i;
                result.push(copy);
            });
        });

        result = result.concat(getNativeTracks());
        return uniqueTracks(result);
    }

    function chooseTrack(track) {
        if (!track) return false;

        try {
            if (track.__hls) {
                track.__hls.audioTrack = track.__index;
                storageSet(STORE_LAST, displayName(track, track.__index));
                notify('🇺🇦 Обрано: ' + displayName(track, track.__index));
                return true;
            }
        } catch (e) {
            log('HLS select error', e);
        }

        try {
            if (track.__native && track._ref) {
                var all = getNativeTracks();
                all.forEach(function (x) {
                    try { x._ref.enabled = x.__index === track.__index; } catch (e) {}
                });
                storageSet(STORE_LAST, displayName(track, track.__index));
                notify('🇺🇦 Обрано: ' + displayName(track, track.__index));
                return true;
            }
        } catch (e2) {
            log('Native select error', e2);
        }

        return false;
    }

    function ukrainianTracks() {
        return collectTracks().filter(isUkrainian);
    }

    function autoSelect() {
        if (storageGet(STORE_ENABLED, true) !== true) return;
        if (storageGet(STORE_AUTO, true) !== true) return;

        var tracks = ukrainianTracks();
        if (!tracks.length) return;

        var last = String(storageGet(STORE_LAST, '') || '').toLowerCase();
        var selected = null;

        if (last) {
            selected = tracks.find(function (t, i) {
                return displayName(t, i).toLowerCase() === last;
            });
        }

        chooseTrack(selected || tracks[0]);
    }

    function openPicker() {
        var tracks = ukrainianTracks();

        if (!tracks.length) {
            notify('🇺🇦 Українських аудіодоріжок у цьому потоці не знайдено');
            return;
        }

        var items = tracks.map(function (track, index) {
            return {
                title: '🇺🇦 ' + displayName(track, index),
                subtitle: track.language || track.lang || '',
                track: track
            };
        });

        try {
            if (window.Lampa && Lampa.Select && typeof Lampa.Select.show === 'function') {
                Lampa.Select.show({
                    title: 'Українська озвучка',
                    items: items,
                    onSelect: function (item) {
                        chooseTrack(item.track);
                    },
                    onBack: function () {
                        if (Lampa.Controller && Lampa.Controller.toggle) {
                            Lampa.Controller.toggle('player');
                        }
                    }
                });
                return;
            }
        } catch (e) {
            log('Select API unavailable', e);
        }

        chooseTrack(tracks[0]);
    }

    function addSettings() {
        try {
            if (!window.Lampa || !Lampa.SettingsApi || !Lampa.SettingsApi.addParam) return;

            try {
                Lampa.SettingsApi.addComponent({
                    component: PLUGIN,
                    name: 'UA Voice 🇺🇦',
                    icon: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Zm0 2a7 7 0 0 1 6.93 6H5.07A7 7 0 0 1 12 5Zm0 14a7 7 0 0 1-6.93-6h13.86A7 7 0 0 1 12 19Z"/></svg>'
                });
            } catch (e) {}

            Lampa.SettingsApi.addParam({
                component: PLUGIN,
                param: {
                    name: STORE_ENABLED,
                    type: 'trigger',
                    default: true
                },
                field: {
                    name: 'Лише українські доріжки',
                    description: 'Плагін шукає українську аудіодоріжку у поточному відеопотоці'
                }
            });

            Lampa.SettingsApi.addParam({
                component: PLUGIN,
                param: {
                    name: STORE_AUTO,
                    type: 'trigger',
                    default: true
                },
                field: {
                    name: 'Автовибір української',
                    description: 'Автоматично перемикатися на українську озвучку, якщо вона є'
                }
            });

            Lampa.SettingsApi.addParam({
                component: PLUGIN,
                param: {
                    name: 'ua_voice_pick',
                    type: 'button'
                },
                field: {
                    name: 'Обрати українську озвучку',
                    description: 'Показати всі знайдені українські аудіодоріжки'
                },
                onChange: function () {
                    openPicker();
                }
            });

        } catch (e) {
            log('Settings error', e);
        }
    }

    function addPlayerButton() {
        try {
            if (!window.Lampa || !Lampa.Player || !Lampa.Player.listener) return;

            Lampa.Player.listener.follow('create', function () {
                var tries = 0;
                var timer = setInterval(function () {
                    tries++;
                    var tracks = ukrainianTracks();

                    if (tracks.length && storageGet(STORE_AUTO, true) === true) {
                        clearInterval(timer);
                        autoSelect();
                    }

                    if (tries >= 15) clearInterval(timer);
                }, 800);
            });
        } catch (e) {
            log('Player listener error', e);
        }
    }

    function keyboardShortcut() {
        document.addEventListener('keydown', function (e) {
            if (!e) return;
            if (e.altKey && (e.key === 'u' || e.key === 'U' || e.key === 'г' || e.key === 'Г')) {
                openPicker();
            }
        });
    }

    function startPlugin() {
        if (window.__LAMPA_UA_VOICE_STARTED__) return;
        if (!window.Lampa) return;

        registerManifest();

        try { addSettings(); } catch (e) { log('settings init error', e); }
        try { addPlayerButton(); } catch (e) { log('player init error', e); }
        try { keyboardShortcut(); } catch (e) { log('keyboard init error', e); }

        window.__LAMPA_UA_VOICE_STARTED__ = true;
        window.__LAMPA_UA_VOICE_LOADING__ = false;

        log('v1.0.1 loaded');
    }

    function init() {
        var tries = 0;

        function ready() {
            tries++;

            if (window.Lampa &&
                Lampa.Storage &&
                Lampa.SettingsApi &&
                Lampa.Manifest) {
                startPlugin();
                return;
            }

            if (tries < 120) {
                setTimeout(ready, 250);
            } else {
                window.__LAMPA_UA_VOICE_LOADING__ = false;
                log('Lampa API was not ready');
            }
        }

        ready();
    }

    init();

    window.LampaUAVoice = {
        open: openPicker,
        tracks: ukrainianTracks,
        allTracks: collectTracks,
        auto: autoSelect
    };
})();
