(function () {
    'use strict';

    if (window.__UA_VOICE_CUB_TEST_02__) return;
    window.__UA_VOICE_CUB_TEST_02__ = true;

    var button = [
        '<div class="full-start__button selector view--online ua-voice--button" data-subtitle="UA Voice v0.2">',
            '<svg viewBox="0 0 24 24" fill="currentColor">',
                '<path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.06A4.5 4.5 0 0 0 16.5 12zm0-8.66v2.07A8 8 0 0 1 20 12a8 8 0 0 1-3.5 6.59v2.07A10 10 0 0 0 22 12a10 10 0 0 0-5.5-8.66z"/>',
            '</svg>',
            '<span>🇺🇦 Українська</span>',
        '</div>'
    ].join('');

    function addButton(e) {
        if (!e || !e.render || !e.render.length) return;

        var activity = e.render.closest('.activity');
        if (activity.find('.ua-voice--button').length) return;

        var btn = $(button);

        btn.on('hover:enter', function () {
            Lampa.Noty.show('UA Voice працює');
        });

        e.render.after(btn);
    }

    Lampa.Listener.follow('full', function (e) {
        if (e.type == 'complite') {
            addButton({
                render: e.object.activity.render().find('.view--torrent'),
                movie: e.data.movie
            });
        }
    });

    console.log('[UA Voice] CUB TEST v0.2 loaded');
})();
