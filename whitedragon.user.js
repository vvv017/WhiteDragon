// ==UserScript==
// @name         白龍 WhiteDragon
// @namespace    https://github.com/vvv017/WhiteDragon
// @version      4.4.2
// @description  Custom expression avatars for ChatGPT with robust inline streaming markers, long-turn support, Project profiles, sticky positioning, and header customization.
// @homepageURL  https://github.com/vvv017/WhiteDragon
// @supportURL   https://github.com/vvv017/WhiteDragon/issues
// @downloadURL  https://raw.githubusercontent.com/vvv017/WhiteDragon/main/whitedragon.user.js
// @updateURL    https://raw.githubusercontent.com/vvv017/WhiteDragon/main/whitedragon.user.js
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @connect      raw.githubusercontent.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(async () => {
    'use strict';

    const VERSION = '4.4.2';
    const CACHE_KEY = `whitedragon:source:${VERSION}`;
    const BASE = 'https://raw.githubusercontent.com/vvv017/WhiteDragon/main/src/parts';
    const urls = Array.from(
        { length: 12 },
        (_, index) => `${BASE}/part-${String(index).padStart(2, '0')}.part`
    );

    const requestText = url => new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            timeout: 15000,
            onload(response) {
                if (response.status >= 200 && response.status < 300) {
                    resolve(response.responseText);
                } else {
                    reject(new Error(`HTTP ${response.status}: ${url}`));
                }
            },
            onerror: () => reject(new Error(`Network error: ${url}`)),
            ontimeout: () => reject(new Error(`Timeout: ${url}`))
        });
    });

    try {
        let source = localStorage.getItem(CACHE_KEY);

        if (!source) {
            source = (await Promise.all(urls.map(requestText))).join('');
            localStorage.setItem(CACHE_KEY, source);
        }

        new Function(source)();
    } catch (error) {
        console.error('[WhiteDragon] Failed to load userscript source:', error);
    }
})();
