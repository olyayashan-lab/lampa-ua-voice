(function () {
    'use strict';

    if (window.ua_voice_plugin) return;
    window.ua_voice_plugin = true;

    function startPlugin() {
        var manifst = {
            type: 'video',
            version: '0.3',
            name: 'UA Voice',
            description: 'Українська озвучка',
            component: 'ua_voice',
            onContextMenu: function(object) {
                return {
                    name: 'Українська',
                    description: ''
                };
            },
            onContextLauch: function(object) {
                Lampa.Noty.show('UA Voice працює');
            }
        };

        Lampa.Manifest.plugins = manifst;

        var button = [
            '<div class="full-start__button selector view--online ua-voice--button" data-subtitle="UA Voice v0.3">',
                '<svg viewBox="0 0 24 24" fill="currentColor">',
                    '<path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.06A4.5 4.5 0 0 0 16.5 12zm0-8.66v2.07A8 8 0 0 1 20 12a8 8 0 0 1-3.5 6.59v2.07A10 10 0 0 0 22 12a10 10 0 0 0-5.5-8.66z"/>',
                '</svg>',
                '<span>🇺🇦 Українська</span>',
            '</div>'
        ].join('');

        function addButton(e) {
            if (!e || !e.render || !e.render.length) return;

            var root = e.render.closest('.activity');
            if (root.length && root.find('.ua-voice--button').length) return;

            var btn = $(button);

            btn.on('hover:enter', function() {
                Lampa.Noty.show('UA Voice працює');
            });

            e.render.after(btn);
        }

        Lampa.Listener.follow('full', function(e) {
            if (e.type == 'complite') {
                addButton({
                    render: e.object.activity.render().find('.view--torrent'),
                    movie: e.data.movie
                });
            }
        });

        try {
            if (Lampa.Activity.active().component == 'full') {
                addButton({
                    render: Lampa.Activity.active().activity.render().find('.view--torrent'),
                    movie: Lampa.Activity.active().card
                });
            }
        } catch (e) {}

        console.log('[UA Voice] v0.3 loaded');
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') startPlugin();
        });
    }
})();
