// ==UserScript==
// @name         白龍 WhiteDragon
// @namespace    https://github.com/vvv017/WhiteDragon
// @version      4.5.1
// @description  Custom expression avatars for ChatGPT with AI setup helpers, robust streaming markers, Project profiles, sticky positioning, and UI personalization.
// @homepageURL  https://github.com/vvv017/WhiteDragon
// @supportURL   https://github.com/vvv017/WhiteDragon/issues
// @downloadURL  https://raw.githubusercontent.com/vvv017/WhiteDragon/main/whitedragon.user.js
// @updateURL    https://raw.githubusercontent.com/vvv017/WhiteDragon/main/whitedragon.user.js
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const CFG = {
        version: '4.5.1',
        dbName: 'white_dragon_avatar_db',
        dbVersion: 1,
        storeName: 'avatars',
        defaultProfile: 'default',
        brandingKey: 'wda3_branding_settings_v1',
        layoutKey: 'wda3_avatar_layout_v1',
        importSize: 1536,
        scanDelay: 120,
        defaultLayout: { size: 64, gap: 14, topOffset: 0, stickyTop: 92 },
        expressions: [
            'neutral', 'smile', 'laugh', 'confused', 'annoyed',
            'serious', 'surprised', 'sad', 'smug', 'thinking'
        ]
    };

    const AI_SETUP = {
        instructions: [
            'Use the exact WhiteDragon marker format [[avatar:expression]] naturally throughout replies.',
            'Available expressions: neutral, smile, laugh, confused, annoyed, serious, surprised, sad, smug, thinking.',
            'Choose expressions from the tone of the reply and switch when the mood meaningfully changes.',
            'Do not rename, translate, abbreviate, or replace the marker format: use [[avatar:smile]], not [WhiteDragon:smile] or [avatar:smile].',
            'Put markers on their own line, never inside code blocks, and do not explain them unless asked.'
        ].join('\n'),

        testPrompt: [
            'Test WhiteDragon expression switching in one short reply.',
            'Use the exact marker syntax [[avatar:expression]]; do not rename, translate, abbreviate, or substitute the format.',
            'Use these exact markers in this order, each on its own line near the matching mood change:',
            '[[avatar:neutral]], [[avatar:thinking]], [[avatar:surprised]], [[avatar:smile]], [[avatar:laugh]].',
            'Do not use forms like [WhiteDragon:neutral], [avatar:neutral], or plain text labels.',
            'Keep the reply short and make the text between markers naturally match each expression.'
        ].join(' '),

        avatarGenerationPrompt: [
            'Use the character reference image I provide to create a consistent WhiteDragon expression avatar set.',
            '',
            'Create 10 separate square avatar images of the same character:',
            'neutral, smile, laugh, confused, annoyed, serious, surprised, sad, smug, thinking.',
            '',
            'Keep the character identity, hairstyle, clothing, accessories, colors, art style, camera angle, framing, scale, and lighting consistent across all images.',
            'Only change the facial expression and small natural pose details needed to communicate the emotion.',
            '',
            'Use a clean transparent background if possible.',
            'Do not add text, labels, borders, speech bubbles, or extra characters.',
            'Keep the face clearly readable at small avatar sizes and avoid large composition changes between expressions.',
            '',
            'Output each expression as an individual image suitable for these filenames:',
            'neutral.png, smile.png, laugh.png, confused.png, annoyed.png, serious.png, surprised.png, sad.png, smug.png, thinking.png.'
        ].join('\n')
    };

    const ID = { style: 'wda4-style', button: 'wda4-button', modal: 'wda4-modal' };
    const CL = {
        turn: 'wda4-turn', active: 'wda4-active', rail: 'wda4-rail', avatar: 'wda4-avatar',
        changing: 'wda4-changing', backdrop: 'wda4-backdrop', modal: 'wda4-panel',
        drag: 'wda4-drag', hint: 'wda4-hint', section: 'wda4-section', form: 'wda4-form',
        field: 'wda4-field', color: 'wda4-color', preview: 'wda4-preview', slider: 'wda4-slider',
        value: 'wda4-value', profile: 'wda4-profile', grid: 'wda4-grid', card: 'wda4-card',
        actions: 'wda4-actions', danger: 'wda4-danger', note: 'wda4-note', code: 'wda4-code'
    };
    const SEL = {
        turns: '[data-testid^="conversation-turn-"]',
        assistant: '[data-message-author-role="assistant"]',
        user: '[data-message-author-role="user"]',
        messages: '[data-message-author-role="assistant"], [data-message-author-role="user"]'
    };

    const S = {
        defaultPack: new Map(),
        projectPacks: new Map(),
        loaded: new Set(),
        loading: new Map(),
        observed: new Set(),
        visible: new Set(),
        activeTurn: null,
        intersection: null,
        scanTimer: null,
        layoutRaf: null,
        modalOffset: { x: 0, y: 0 },
        brandNames: new Set(['ChatGPT'])
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const uniq = values => [...new Set(values)];
    const txt = value => String(value || '').replace(/\s+/g, ' ').trim();
    const validRect = rect => Boolean(rect && rect.width > 1 && rect.height > 1 && Number.isFinite(rect.left));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const esc = value => String(value)
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    const textNodes = root => {
        if (!root) return [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let node;
        while ((node = walker.nextNode())) nodes.push(node);
        return nodes;
    };
    const readJson = (key, fallback = {}) => {
        try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
        catch (_) { return fallback; }
    };

    // ------------------------------------------------------------------
    // Interface branding
    // ------------------------------------------------------------------

    const Brand = {
        defaults: { name: 'ChatGPT', fontFamily: '', useColor: false, color: '#c4b5fd' },
        value: null,
        previous: 'ChatGPT',

        normalize(input = {}) {
            const name = String(input.name ?? 'ChatGPT')
                .replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'ChatGPT';
            const fontFamily = String(input.fontFamily ?? '')
                .replace(/[\r\n\t]+/g, ' ').trim().slice(0, 160);
            const color = /^#[0-9a-f]{6}$/i.test(String(input.color || ''))
                ? String(input.color) : Brand.defaults.color;
            return { name, fontFamily, useColor: Boolean(input.useColor), color };
        },

        load() {
            Brand.value = Brand.normalize(readJson(CFG.brandingKey));
            Brand.previous = Brand.value.name;
            S.brandNames.add(Brand.value.name);
            return Brand.value;
        },

        get() { return Brand.value || Brand.load(); },

        save(input) {
            const oldName = Brand.get().name;
            Brand.previous = oldName;
            Brand.value = Brand.normalize(input);
            S.brandNames.add(oldName);
            S.brandNames.add(Brand.value.name);
            localStorage.setItem(CFG.brandingKey, JSON.stringify(Brand.value));
            Brand.apply();
            return Brand.value;
        },

        reset() { return Brand.save(Brand.defaults); },

        names() {
            return uniq(['ChatGPT', Brand.previous, Brand.get().name, ...S.brandNames])
                .filter(Boolean).sort((a, b) => b.length - a.length);
        },

        match(value) {
            const valueText = txt(value);
            for (const name of Brand.names()) {
                if (valueText === name) return { name, suffix: '' };
                if (!valueText.startsWith(`${name} `)) continue;
                const suffix = valueText.slice(name.length).trim();
                if (/^(Pro|Plus|Team|Business|Enterprise|Free)$/i.test(suffix)) return { name, suffix };
            }
            return null;
        },

        titleCandidate(node, preferred = false) {
            const parent = node?.parentElement;
            const match = Brand.match(node?.nodeValue);
            if (!parent || !match || parent.closest(`#${ID.modal}, ${SEL.messages}, form, textarea, input`)) return null;

            const rect = parent.getBoundingClientRect();
            if (!validRect(rect) || rect.bottom <= 0 || rect.top < -16 || rect.top > 130 || rect.width > 360 || rect.height > 80) return null;

            const container = parent.closest('button, [role="button"], a, header, [role="banner"]') || parent;
            const containerText = txt(container.innerText || container.textContent);
            if (!containerText || containerText.length > 90) return null;

            const plan = /\b(Pro|Plus|Team|Business|Enterprise|Free)\b/i.test(containerText);
            const model = Boolean(
                container.matches?.('[data-testid*="model"], [aria-label*="model" i]') ||
                container.querySelector?.('[data-testid*="model"], [aria-label*="model" i]')
            );
            const sidebar = Boolean(parent.closest('aside, [data-testid*="sidebar"]'));
            const score = rect.top * 3 + Math.min(rect.left, 1400) / 12
                - (preferred ? 2200 : 0) - (model ? 2600 : 0) - (plan ? 1800 : 0) + (sidebar ? 600 : 0);
            return { node, parent, match, score };
        },

        findTitle() {
            const found = [];
            const seen = new Set();
            const preferred = $$([
                'button[data-testid*="model"]', '[role="button"][data-testid*="model"]',
                'button[aria-label*="model" i]', 'header button', 'header [role="button"]',
                '[role="banner"] button', '[role="banner"] [role="button"]'
            ].join(','));

            for (const root of preferred) {
                for (const node of textNodes(root)) {
                    if (seen.has(node)) continue;
                    seen.add(node);
                    const candidate = Brand.titleCandidate(node, true);
                    if (candidate) found.push(candidate);
                }
            }
            for (const node of textNodes(document.body)) {
                if (seen.has(node)) continue;
                const candidate = Brand.titleCandidate(node, false);
                if (candidate) found.push(candidate);
            }
            return found.sort((a, b) => a.score - b.score)[0] || null;
        },

        replaceNode(node, match) {
            const raw = String(node.nodeValue || '');
            const leading = raw.match(/^\s*/)?.[0] || '';
            const trailing = raw.match(/\s*$/)?.[0] || '';
            const replacement = match.suffix ? `${Brand.get().name} ${match.suffix}` : Brand.get().name;
            if (txt(raw) !== replacement) node.nodeValue = `${leading}${replacement}${trailing}`;
        },

        styleTitle(element) {
            const settings = Brand.get();
            element.dataset.wda4Title = '1';
            settings.fontFamily
                ? element.style.setProperty('font-family', settings.fontFamily, 'important')
                : element.style.removeProperty('font-family');
            settings.useColor
                ? element.style.setProperty('color', settings.color, 'important')
                : element.style.removeProperty('color');
        },

        applyTitle() {
            let live = false;
            for (const element of $$('[data-wda4-title="1"]')) {
                const rect = element.getBoundingClientRect();
                if (!document.contains(element) || !validRect(rect) || rect.bottom <= 0 || rect.top >= 130) continue;
                const node = textNodes(element).find(item => Brand.match(item.nodeValue));
                if (node) Brand.replaceNode(node, Brand.match(node.nodeValue));
                Brand.styleTitle(element);
                live = true;
            }
            if (live) return;
            const target = Brand.findTitle();
            if (!target) return;
            Brand.replaceNode(target.node, target.match);
            Brand.styleTitle(target.parent);
        },

        apply() { Brand.applyTitle(); }
    };

    // ------------------------------------------------------------------
    // Avatar layout
    // ------------------------------------------------------------------

    const Layout = {
        saved: null,
        previewValue: null,

        normalize(input = {}) {
            const number = (key, min, max) => {
                const parsed = Number(input[key]);
                const fallback = CFG.defaultLayout[key];
                return clamp(Number.isFinite(parsed) ? Math.round(parsed) : fallback, min, max);
            };
            return {
                size: number('size', 32, 128),
                gap: number('gap', -40, 100),
                topOffset: number('topOffset', -80, 120),
                stickyTop: number('stickyTop', 0, 240)
            };
        },

        load() {
            Layout.saved = Layout.normalize(readJson(CFG.layoutKey));
            Layout.previewValue = null;
            Layout.applyVars(Layout.saved);
            return Layout.saved;
        },

        get() { return Layout.previewValue || Layout.saved || Layout.load(); },

        applyVars(value = Layout.get()) {
            document.documentElement.style.setProperty('--wda4-size', `${value.size}px`);
            document.documentElement.style.setProperty('--wda4-sticky', `${value.stickyTop}px`);
        },

        preview(input) {
            Layout.previewValue = Layout.normalize(input);
            Layout.applyVars(Layout.previewValue);
            return Layout.previewValue;
        },

        save(input) {
            Layout.saved = Layout.normalize(input);
            Layout.previewValue = null;
            localStorage.setItem(CFG.layoutKey, JSON.stringify(Layout.saved));
            Layout.applyVars(Layout.saved);
            App.refresh();
            return Layout.saved;
        },

        reset() { return Layout.save(CFG.defaultLayout); }
    };

    // ------------------------------------------------------------------
    // IndexedDB and image packs
    // ------------------------------------------------------------------

    const DB = {
        promise: null,

        open() {
            if (DB.promise) return DB.promise;
            DB.promise = new Promise((resolve, reject) => {
                const request = indexedDB.open(CFG.dbName, CFG.dbVersion);
                request.onupgradeneeded = () => {
                    if (!request.result.objectStoreNames.contains(CFG.storeName)) {
                        request.result.createObjectStore(CFG.storeName);
                    }
                };
                request.onsuccess = () => {
                    request.result.onversionchange = () => {
                        request.result.close();
                        DB.promise = null;
                    };
                    resolve(request.result);
                };
                request.onerror = () => { DB.promise = null; reject(request.error); };
            });
            return DB.promise;
        },

        async run(mode, work) {
            const db = await DB.open();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(CFG.storeName, mode);
                let result;
                try { result = work(transaction.objectStore(CFG.storeName)); }
                catch (error) { transaction.abort(); reject(error); return; }
                transaction.oncomplete = () => resolve(result);
                transaction.onerror = () => reject(transaction.error);
                transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted.'));
            });
        },

        read(keys) {
            return DB.run('readonly', store => {
                const output = new Map();
                for (const key of keys) {
                    const request = store.get(key);
                    request.onsuccess = () => output.set(key, request.result ?? null);
                }
                return output;
            });
        },
        put(entries) { return DB.run('readwrite', store => entries.forEach(([key, value]) => store.put(value, key))); },
        remove(keys) { return DB.run('readwrite', store => keys.forEach(key => store.delete(key))); },
        clear() { return DB.run('readwrite', store => store.clear()); }
    };

    const ImageTools = {
        placeholder(expression) {
            const label = esc(expression.slice(0, 2).toUpperCase());
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f2ff"/><stop offset="1" stop-color="#ddd0ff"/></linearGradient></defs><circle cx="48" cy="48" r="46" fill="url(#g)" stroke="#b6a2e8" stroke-width="2"/><text x="48" y="56" text-anchor="middle" font-size="24" fill="#644ea8" font-family="Arial">${label}</text></svg>`;
            return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
        },

        readDataUrl(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(
                    reader.error || new Error(`Could not read ${file.name}`)
                );
                reader.readAsDataURL(file);
            });
        },

        async optimize(file) {
            const url = URL.createObjectURL(file);
            const image = new Image();

            try {
                await new Promise((resolve, reject) => {
                    image.onload = resolve;
                    image.onerror = () => reject(
                        new Error(`Could not load ${file.name}`)
                    );
                    image.src = url;
                });
            } finally {
                URL.revokeObjectURL(url);
            }

            const width = image.naturalWidth || image.width;
            const height = image.naturalHeight || image.height;
            const longestSide = Math.max(width, height);

            // Preserve the user's original bytes whenever the image is already
            // a reasonable size. This avoids the old 256px WebP re-encoding
            // and keeps transparency/detail intact.
            if (longestSide <= CFG.importSize) {
                return ImageTools.readDataUrl(file);
            }

            // Only unusually large images are resized, using a high-quality
            // lossless PNG output.
            const scale = CFG.importSize / longestSide;
            const drawWidth = Math.max(1, Math.round(width * scale));
            const drawHeight = Math.max(1, Math.round(height * scale));

            const canvas = document.createElement('canvas');
            canvas.width = drawWidth;
            canvas.height = drawHeight;

            const ctx = canvas.getContext('2d', { alpha: true });
            if (!ctx) {
                throw new Error('Could not create a canvas context.');
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.clearRect(0, 0, drawWidth, drawHeight);
            ctx.drawImage(image, 0, 0, drawWidth, drawHeight);

            return canvas.toDataURL('image/png');
        }
    };

    const Profiles = {
        current() {
            const match = location.pathname.match(/\/g\/(g-p-([0-9a-f]+)(?:-[^/]+)?)(?:\/|$)/i);
            if (!match) return { key: CFG.defaultProfile, routeId: null, label: 'Default / outside Projects', isProject: false };
            return {
                key: `g-p-${match[2].toLowerCase()}`,
                routeId: match[1],
                label: Profiles.label(match[1]),
                isProject: true
            };
        },

        label(routeId) {
            try {
                for (const link of $$(`a[href*="/g/${routeId}/project"], a[href*="/g/${routeId}/"]`)) {
                    const value = txt(link.innerText || link.textContent);
                    if (value.length >= 2 && value.length <= 120) return value;
                }
            } catch (_) {}
            const slug = routeId.match(/^g-p-[0-9a-f]+-(.+)$/i)?.[1];
            if (!slug) return 'ChatGPT Project';
            try { return decodeURIComponent(slug).replace(/[-_]+/g, ' ').trim() || 'ChatGPT Project'; }
            catch (_) { return slug.replace(/[-_]+/g, ' ').trim() || 'ChatGPT Project'; }
        },

        key(profileKey, expression) {
            return profileKey === CFG.defaultProfile ? expression : `project-avatar::${profileKey}::${expression}`;
        },

        pack(profileKey) {
            if (profileKey === CFG.defaultProfile) return S.defaultPack;
            if (!S.projectPacks.has(profileKey)) S.projectPacks.set(profileKey, new Map());
            return S.projectPacks.get(profileKey);
        },

        own(profileKey, expression) { return Profiles.pack(profileKey).get(expression) || null; },
        source(profileKey, expression) {
            return Profiles.own(profileKey, expression) || S.defaultPack.get(expression) || ImageTools.placeholder(expression);
        },

        async load(profile) {
            if (S.loaded.has(profile.key)) return false;
            if (S.loading.has(profile.key)) return S.loading.get(profile.key);

            const promise = (async () => {
                const keys = CFG.expressions.map(expression => Profiles.key(profile.key, expression));
                const values = await DB.read(keys);
                const pack = Profiles.pack(profile.key);
                CFG.expressions.forEach(expression => {
                    const value = values.get(Profiles.key(profile.key, expression));
                    if (value) pack.set(expression, value);
                });
                S.loaded.add(profile.key);
                return true;
            })();

            S.loading.set(profile.key, promise);
            try { return await promise; }
            finally { S.loading.delete(profile.key); }
        },

        requestCurrent() {
            const profile = Profiles.current();
            if (S.loaded.has(profile.key) || S.loading.has(profile.key)) return;
            Profiles.load(profile).then(loaded => {
                if (!loaded) return;
                App.schedule(0);
                if ($(`#${ID.modal}`)) UI.render();
            }).catch(error => console.warn('[WhiteDragon] Profile load failed:', error));
        },

        async import(files, profile) {
            const valid = [], ignored = [], failed = [];
            for (const file of files) {
                const index = file.name.lastIndexOf('.');
                const expression = (index >= 0 ? file.name.slice(0, index) : file.name).trim().toLowerCase();
                if (!CFG.expressions.includes(expression)) { ignored.push(file.name); continue; }
                try { valid.push([expression, await ImageTools.optimize(file)]); }
                catch (error) { console.error(error); failed.push(file.name); }
            }

            if (valid.length) {
                await DB.put(valid.map(([expression, value]) => [Profiles.key(profile.key, expression), value]));
                const pack = Profiles.pack(profile.key);
                valid.forEach(([expression, value]) => pack.set(expression, value));
                S.loaded.add(profile.key);
            }

            App.refresh();
            await UI.render();
            let message = `Imported ${valid.length} avatar file(s) into:\n${profile.label}`;
            if (ignored.length) message += `\nIgnored: ${ignored.join(', ')}`;
            if (failed.length) message += `\nFailed: ${failed.join(', ')}`;
            alert(message);
        },

        async clear(profile) {
            await DB.remove(CFG.expressions.map(expression => Profiles.key(profile.key, expression)));
            Profiles.pack(profile.key).clear();
            S.loaded.add(profile.key);
            App.refresh();
            await UI.render();
        },

        async clearAll() {
            await DB.clear();
            S.defaultPack.clear();
            S.projectPacks.clear();
            S.loaded.clear();
            S.loading.clear();
            App.refresh();
            await UI.render();
        }
    };

    // ------------------------------------------------------------------
    // Expressions and ChatGPT DOM
    // ------------------------------------------------------------------

    const Expression = {
        marker: /\[\[avatar:([a-zA-Z0-9_-]+)\]\]/g,
        exact: /^\[\[avatar:[a-zA-Z0-9_-]+\]\]$/,
        rules: [
            ['sad', /抱歉|可惜|遺憾|遗憾|難過|难过|unfortunately|sorry|regret/i],
            ['laugh', /哈哈|笑死|www|lol|lmao|xd|😂|🤣/i],
            ['surprised', /驚|惊|真的假的|居然|竟然|哇|wow|what\?!|unexpected/i],
            ['confused', /蛤|啥|什麼|什么|不懂|看不懂|huh|\?{2,}/i],
            ['thinking', /想一下|想想|思考|分析一下|let me think|hmm|thinking/i],
            ['annoyed', /吐槽|嫌棄|嫌弃|離譜|离谱|無語|无语|annoy|seriously\?/i],
            ['smug', /得意|哼哼|這不就|这不就|輕鬆|轻松|ez|smug/i],
            ['smile', /好耶|太好了|沒問題|没问题|可以呀|nice|great|awesome|happy/i]
        ],

        /*
         * Return the newest valid marker currently present in the reply.
         *
         * The message DOM is scanned in text-node order, including markers
         * that were visually hidden earlier. Code/pre blocks are ignored so
         * a marker shown as an example does not change the real avatar.
         */
        latest(root, fallbackText = '') {
            let source = String(fallbackText || '');

            if (root) {
                const parts = [];
                const walker = document.createTreeWalker(
                    root,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode(node) {
                            const parent = node.parentElement;

                            return parent?.closest('pre, code')
                                ? NodeFilter.FILTER_REJECT
                                : NodeFilter.FILTER_ACCEPT;
                        }
                    }
                );

                while (walker.nextNode()) {
                    parts.push(walker.currentNode.nodeValue || '');
                }

                source = parts.join('\n');
            }

            let latest = null;
            let match;

            Expression.marker.lastIndex = 0;

            while ((match = Expression.marker.exec(source)) !== null) {
                const candidate = match[1].toLowerCase();

                if (CFG.expressions.includes(candidate)) {
                    latest = candidate;
                }
            }

            Expression.marker.lastIndex = 0;
            return latest;
        },

        infer(text, message, turn) {
            const marker = Expression.latest(message || turn, text);

            if (CFG.expressions.includes(marker)) {
                // Every newly-streamed marker replaces the previous one.
                turn.dataset.wda4Expression = marker;
                return marker;
            }

            const remembered = turn.dataset.wda4Expression;
            if (CFG.expressions.includes(remembered)) return remembered;
            if (!message) return 'thinking';

            for (const [expression, pattern] of Expression.rules) {
                if (pattern.test(text)) return expression;
            }

            return message.querySelector('pre, code') ||
                message.querySelectorAll('li').length >= 3 ||
                /首先|其次|結論|结论|總結|总结|步驟|步骤|分析|建議|建议/i.test(text)
                ? 'serious'
                : 'neutral';
        },

        /*
         * Remove avatar markers without deleting the surrounding paragraph.
         * This also works when ChatGPT splits one marker across several
         * nested span/text nodes.
         */
        strip(element) {
            if (!element || element.closest('pre, code')) return false;

            const nodes = textNodes(element).filter(node =>
                !node.parentElement?.closest('pre, code')
            );

            if (!nodes.length) return false;

            const spans = [];
            let source = '';

            for (const node of nodes) {
                const value = String(node.nodeValue || '');
                spans.push({
                    node,
                    start: source.length,
                    end: source.length + value.length
                });
                source += value;
            }

            Expression.marker.lastIndex = 0;
            const matches = [];
            let match;

            while ((match = Expression.marker.exec(source)) !== null) {
                const candidate = match[1].toLowerCase();

                if (CFG.expressions.includes(candidate)) {
                    matches.push({
                        start: match.index,
                        end: match.index + match[0].length
                    });
                }
            }

            Expression.marker.lastIndex = 0;
            if (!matches.length) return false;

            // Work from the end so earlier offsets remain valid.
            for (const range of matches.reverse()) {
                for (const span of spans) {
                    if (
                        span.end <= range.start ||
                        span.start >= range.end
                    ) {
                        continue;
                    }

                    const value = String(span.node.nodeValue || '');
                    const localStart = Math.max(
                        0,
                        range.start - span.start
                    );
                    const localEnd = Math.min(
                        value.length,
                        range.end - span.start
                    );

                    span.node.nodeValue =
                        value.slice(0, localStart) +
                        value.slice(localEnd);
                }
            }

            if (!txt(element.textContent || '')) {
                element.style.display = 'none';
            }

            element.dataset.wda4Marker = 'hidden';
            return true;
        },

        hide(root) {
            if (!root) return;

            const blocks = $$(
                'p, li, blockquote, h1, h2, h3, h4, h5, h6',
                root
            );

            for (const block of blocks) {
                if (
                    !block.closest('pre, code') &&
                    String(block.textContent || '').includes('[[avatar:')
                ) {
                    Expression.strip(block);
                }
            }
        }
    };

    const Chat = {
        turns() {
            const fallback = $$(SEL.messages).map(message =>
                message.closest('article') || message.closest('[data-testid*="conversation-turn"]') || message.parentElement
            ).filter(Boolean);
            return uniq([...$$(SEL.turns), ...fallback]);
        },

        message(turn) { return $(SEL.assistant, turn); },

        isAssistant(turn) {
            if ($(SEL.user, turn)) return false;
            if (Chat.message(turn)) return true;

            /*
             * Pro thinking and long tool runs can remain inside one
             * conversation-turn before the final assistant message exists.
             * Keep that real non-user turn classified as assistant regardless
             * of trace length, so its avatar does not disappear midway.
             */
            if (!turn.matches?.(SEL.turns)) return false;
            return Boolean(txt(turn.innerText || turn.textContent));
        },

        statusAnchor(turn) {
            const turnRect = turn.getBoundingClientRect();
            let nodes = $$('[aria-live], p, span, button, [role="button"]', turn);
            if (!nodes.length) nodes = $$('div', turn);
            const candidates = [];

            for (const element of nodes) {
                if (element.closest(`.${CL.rail}`)) continue;
                const value = txt(element.innerText || element.textContent);
                if (!value || value.length > 220) continue;
                const rect = element.getBoundingClientRect();
                if (!validRect(rect) || (turnRect.width && rect.width > turnRect.width * 0.92)) continue;

                const left = rect.left - turnRect.left;
                const top = rect.top - turnRect.top;
                const control = element.matches('button, [role="button"]');
                const action = /^(answer now|skip|stop|cancel|continue|respond now)$/i.test(value);
                const right = turnRect.width > 0 && left > turnRect.width * 0.62;
                candidates.push({ element, rect, left, top, control, action, right });
            }

            if (!candidates.length) return null;
            const preferred = candidates.filter(item => !item.control && !item.action && !item.right);
            const leftSide = candidates.filter(item => !item.right);
            const pool = preferred.length ? preferred : (leftSide.length ? leftSide : candidates);
            return pool.sort((a, b) => {
                const score = item => Math.max(0, item.left) * 3 + Math.abs(item.top) +
                    Math.min(1800, item.rect.width * item.rect.height / 900) +
                    (item.control ? 4000 : 0) + (item.action ? 8000 : 0) + (item.right ? 6000 : 0);
                return score(a) - score(b);
            })[0].element;
        },

        anchor(turn, message) { return message || Chat.statusAnchor(turn); },

        messageFromNode(node) {
            const element = node?.nodeType === Node.TEXT_NODE
                ? node.parentElement
                : node;

            if (!element) return null;

            if (element.matches?.(SEL.assistant)) {
                return element;
            }

            return element.closest?.(SEL.assistant) || null;
        },

        turnFromMessage(message) {
            return message?.closest(SEL.turns) ||
                message?.closest('article') ||
                message?.closest('[data-testid*="conversation-turn"]') ||
                message?.parentElement ||
                null;
        },

        turnFromNode(node) {
            const element = node?.nodeType === Node.TEXT_NODE
                ? node.parentElement
                : node;

            if (!element) return null;

            return element.closest?.(SEL.turns) ||
                element.closest?.('article') ||
                element.closest?.('[data-testid*="conversation-turn"]') ||
                Chat.turnFromMessage(Chat.messageFromNode(node)) ||
                null;
        }
    };

    // ------------------------------------------------------------------
    // Avatar placement and one-avatar visibility
    // ------------------------------------------------------------------

    const Avatar = {
        ensure(turn) {
            turn.classList.add(CL.turn);
            let rail = $(`:scope > .${CL.rail}`, turn);
            if (!rail) {
                rail = document.createElement('div');
                rail.className = CL.rail;
                turn.prepend(rail);
            }
            let image = $(`:scope > .${CL.avatar}`, rail);
            if (!image) {
                image = document.createElement('img');
                image.className = CL.avatar;
                image.alt = '';
                image.draggable = false;
                rail.appendChild(image);
            }
            return { rail, image };
        },

        source(parts, profile, expression) {
            const value = Profiles.source(profile.key, expression);
            const image = parts.image;
            if (image.dataset.expression === expression && image.dataset.profile === profile.key && image.getAttribute('src') === value) return;
            image.classList.add(CL.changing);
            image.src = value;
            image.dataset.expression = expression;
            image.dataset.profile = profile.key;
            requestAnimationFrame(() => image.classList.remove(CL.changing));
        },

        position(turn, parts, anchor) {
            if (!anchor) { parts.rail.style.display = 'none'; return; }
            const turnRect = turn.getBoundingClientRect();
            const anchorRect = anchor.getBoundingClientRect();
            if (!validRect(turnRect) || !validRect(anchorRect)) { parts.rail.style.display = 'none'; return; }

            const layout = Layout.get();
            let left = anchorRect.left - turnRect.left - layout.size - layout.gap;
            let top = anchorRect.top - turnRect.top + layout.topOffset;
            if (turnRect.left + left < 6) {
                left = Math.max(6 - turnRect.left, anchorRect.left - turnRect.left);
                top = Math.max(0, anchorRect.top - turnRect.top);
            }
            Object.assign(parts.rail.style, { display: '', left: `${Math.round(left)}px`, top: `${Math.round(top)}px` });
        },

        remove(turn) {
            $(`:scope > .${CL.rail}`, turn)?.remove();
            turn.classList.remove(CL.turn, CL.active);
            S.visible.delete(turn);
        },

        process(turn, profile) {
            if (!Chat.isAssistant(turn)) { Avatar.remove(turn); return; }
            const message = Chat.message(turn);
            const content = message?.textContent || turn.textContent || '';
            const expression = Expression.infer(content, message, turn);
            const parts = Avatar.ensure(turn);
            Avatar.source(parts, profile, expression);
            Avatar.position(turn, parts, Chat.anchor(turn, message));
            if (message) Expression.hide(message);
        }
    };

    const Visibility = {
        active(turn) {
            if (S.activeTurn === turn) return;
            S.activeTurn?.classList.remove(CL.active);
            S.activeTurn = turn || null;
            S.activeTurn?.classList.add(CL.active);
        },

        choose(turns = Chat.turns()) {
            let chosen = null;
            for (const turn of turns) if (S.visible.has(turn) && Chat.isAssistant(turn)) chosen = turn;
            if (!chosen) {
                for (const turn of turns) {
                    if (!Chat.isAssistant(turn)) continue;
                    const rect = turn.getBoundingClientRect();
                    if (rect.bottom > 0 && rect.top < innerHeight) chosen = turn;
                }
            }
            Visibility.active(chosen);
        },

        observer() {
            if (S.intersection) return S.intersection;
            S.intersection = new IntersectionObserver(entries => {
                entries.forEach(entry => entry.isIntersecting && entry.intersectionRatio > 0
                    ? S.visible.add(entry.target) : S.visible.delete(entry.target));
                Visibility.choose();
            }, { threshold: [0, 0.01] });
            return S.intersection;
        },

        sync(turns) {
            const observer = Visibility.observer();
            const assistants = new Set(turns.filter(Chat.isAssistant));
            for (const turn of [...S.observed]) {
                if (assistants.has(turn) && document.contains(turn)) continue;
                observer.unobserve(turn);
                S.observed.delete(turn);
                S.visible.delete(turn);
                turn.classList.remove(CL.active);
                if (S.activeTurn === turn) S.activeTurn = null;
            }
            for (const turn of assistants) {
                if (S.observed.has(turn)) continue;
                S.observed.add(turn);
                observer.observe(turn);
            }
            Visibility.choose(turns);
        }
    };

    // ------------------------------------------------------------------
    // Settings UI
    // ------------------------------------------------------------------

    const UI = {
        css() {
            return `
.${CL.turn}{position:relative!important;overflow:visible!important}
.${CL.turn}:not(.${CL.active})>.${CL.rail}{visibility:hidden}
.${CL.turn}.${CL.active}>.${CL.rail}{visibility:visible}
.${CL.rail}{position:absolute;bottom:0;width:var(--wda4-size,64px);overflow:visible;pointer-events:none;z-index:50}
.${CL.avatar}{position:sticky;top:var(--wda4-sticky,92px);display:block;width:var(--wda4-size,64px);height:var(--wda4-size,64px);object-fit:contain;image-rendering:auto;border-radius:50%;pointer-events:none;user-select:none;background:transparent;box-shadow:0 2px 10px #0002;opacity:1;transform:none;transition:opacity .15s,transform .15s}
.${CL.avatar}.${CL.changing}{opacity:.58;transform:scale(.95)}
#${ID.button}{position:fixed;right:18px;bottom:18px;width:44px;height:44px;border:0;border-radius:50%;background:linear-gradient(135deg,#f5f0ff,#ddd0ff);color:#6f4aa8;font-size:24px;line-height:1;cursor:pointer;box-shadow:0 6px 18px #0002;z-index:2147483001}
.${CL.backdrop}{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;background:#0007;z-index:2147483002}
.${CL.modal}{position:relative;width:min(720px,100%);max-height:min(88vh,920px);overflow:auto;padding:20px;border-radius:16px;background:#fff;color:#222;box-shadow:0 16px 40px #0004;font-family:Arial,sans-serif;will-change:transform}
.${CL.drag}{position:sticky;top:-20px;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:-20px -20px 14px;padding:14px 20px;border-bottom:1px solid #ece7f5;background:#fffffff7;backdrop-filter:blur(8px);cursor:grab;user-select:none;touch-action:none}
.${CL.drag}:active{cursor:grabbing}.${CL.drag} h2{margin:0;font-size:22px;pointer-events:none}.${CL.hint}{color:#7a7188;font-size:12px;font-weight:600;white-space:nowrap;pointer-events:none}
.${CL.modal} p{margin:8px 0;line-height:1.5}.${CL.section}{margin:16px 0;padding:14px;border:1px solid #dfd4fb;border-radius:12px;background:#faf8ff}.${CL.section} h3{margin:0 0 6px;font-size:17px}
.${CL.form}{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.${CL.field}{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:#40345f}.${CL.field} input[type=text]{box-sizing:border-box;width:100%;padding:9px 10px;border:1px solid #d8d0e9;border-radius:8px;background:#fff;color:#222;font:14px Arial}
.${CL.color}{min-height:38px;display:flex;align-items:center;gap:10px}.${CL.color} input[type=color]{width:48px;height:34px;padding:2px;border:1px solid #d8d0e9;border-radius:8px;background:#fff;cursor:pointer}.${CL.color} label{display:flex;align-items:center;gap:6px;font-weight:500;color:#555}
.${CL.preview}{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:12px;padding:10px 12px;border-radius:9px;background:#242424;color:#fff}.${CL.preview} small{color:#aaa}
.${CL.slider}{display:grid;grid-template-columns:minmax(120px,1fr) minmax(180px,2fr) 58px;align-items:center;gap:10px;margin-top:10px}.${CL.slider}>label{font-size:13px;font-weight:700;color:#40345f}.${CL.slider} input{width:100%;accent-color:#7c5cc4}.${CL.value}{text-align:right;font:12px ui-monospace,monospace;color:#5e5e6d}
.${CL.profile}{margin:12px 0;padding:10px 12px;border:1px solid #dfd4fb;border-radius:10px;background:#f4efff;color:#4d3a78;line-height:1.45}.${CL.grid}{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin:14px 0 18px}.${CL.card}{padding:10px;border:1px solid #e5e0f4;border-radius:12px;background:#faf8ff}.${CL.card} img{display:block;width:64px;height:64px;margin-bottom:8px;border:1px solid #ebe5fb;border-radius:50%;object-fit:contain;image-rendering:auto}.${CL.card} b{display:block;margin-bottom:4px;font-size:14px}.${CL.card} small{color:#666}.${CL.card} small[data-kind=project]{color:#6547a8;font-weight:700}
.${CL.actions}{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}.${CL.actions} button,.${CL.actions} label{padding:10px 14px;border:0;border-radius:10px;background:#ece5ff;color:#432f7f;cursor:pointer;font-size:14px;font-weight:700}.${CL.actions} .${CL.danger}{background:#ffe8e8;color:#8b3f3f}.${CL.actions} input{display:none}.${CL.note}{color:#5e5e6d;font-size:13px}.${CL.code}{margin-top:10px;padding:12px;border-radius:10px;background:#f6f6f8;white-space:pre-wrap;word-break:break-word;font:13px ui-monospace,monospace}
@media(max-width:900px){.${CL.form}{grid-template-columns:1fr}.${CL.slider}{grid-template-columns:1fr;gap:5px}.${CL.value}{text-align:left}#${ID.button}{right:12px;bottom:12px}}
`;
        },

        install() {
            let style = $(`#${ID.style}`);
            if (!style) {
                style = document.createElement('style');
                style.id = ID.style;
                document.head.appendChild(style);
            }
            style.textContent = UI.css();
            UI.button();
        },

        button() {
            if ($(`#${ID.button}`)) return;
            const button = document.createElement('button');
            button.id = ID.button;
            button.type = 'button';
            button.title = 'Configure avatars and interface';
            button.textContent = '♥';
            button.addEventListener('click', UI.open);
            document.body.appendChild(button);
        },

        close() { $(`#${ID.modal}`)?.remove(); },
        offset(panel) { if (panel) panel.style.transform = `translate3d(${S.modalOffset.x}px,${S.modalOffset.y}px,0)`; },
        center(panel) { S.modalOffset = { x: 0, y: 0 }; UI.offset(panel); },

        drag(panel) {
            const handle = $(`.${CL.drag}`, panel);
            if (!handle || handle.dataset.ready) return;
            handle.dataset.ready = '1';
            UI.offset(panel);
            let active = false, pointer = null, startX = 0, startY = 0, originX = 0, originY = 0, rect = null;

            const finish = event => {
                if (!active) return;
                active = false;
                try { if (pointer !== null && handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer); }
                catch (_) {}
                pointer = null;
                event?.preventDefault?.();
            };

            handle.addEventListener('pointerdown', event => {
                if (event.button !== 0) return;
                active = true;
                pointer = event.pointerId;
                startX = event.clientX;
                startY = event.clientY;
                originX = S.modalOffset.x;
                originY = S.modalOffset.y;
                rect = panel.getBoundingClientRect();
                try { handle.setPointerCapture(pointer); } catch (_) {}
                event.preventDefault();
            });
            handle.addEventListener('pointermove', event => {
                if (!active || event.pointerId !== pointer || !rect) return;
                const dx = clamp(event.clientX - startX, 90 - rect.right, innerWidth - 90 - rect.left);
                const dy = clamp(event.clientY - startY, -rect.top, innerHeight - 48 - rect.top);
                S.modalOffset = { x: Math.round(originX + dx), y: Math.round(originY + dy) };
                UI.offset(panel);
                event.preventDefault();
            });
            handle.addEventListener('pointerup', finish);
            handle.addEventListener('pointercancel', finish);
            handle.addEventListener('dblclick', event => { UI.center(panel); event.preventDefault(); });
        },

        async open() {
            UI.close();
            const backdrop = document.createElement('div');
            backdrop.id = ID.modal;
            backdrop.className = CL.backdrop;
            backdrop.addEventListener('click', event => { if (event.target === backdrop) UI.close(); });
            const panel = document.createElement('div');
            panel.className = CL.modal;
            backdrop.appendChild(panel);
            document.body.appendChild(backdrop);
            UI.offset(panel);
            await UI.render();
        },

        slider(id, label, min, max, value) {
            return `<div class="${CL.slider}"><label for="${id}">${label}</label><input id="${id}" type="range" min="${min}" max="${max}" step="1" value="${value}"><span id="${id}-value" class="${CL.value}">${value}px</span></div>`;
        },

        async copyText(value, button, successLabel = 'Copied ✓') {
            const original = button?.textContent || '';

            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(value);
                } else {
                    const area = document.createElement('textarea');
                    area.value = value;
                    area.setAttribute('readonly', '');
                    Object.assign(area.style, {
                        position: 'fixed',
                        left: '-9999px',
                        top: '0',
                        opacity: '0'
                    });
                    document.body.appendChild(area);
                    area.select();

                    if (!document.execCommand('copy')) {
                        throw new Error('Clipboard copy was rejected.');
                    }

                    area.remove();
                }

                if (button) {
                    button.textContent = successLabel;
                    button.disabled = true;
                    setTimeout(() => {
                        if (!document.contains(button)) return;
                        button.textContent = original;
                        button.disabled = false;
                    }, 1400);
                }
            } catch (error) {
                console.error('[WhiteDragon] Clipboard copy failed:', error);
                alert('Could not copy automatically. Please copy the instructions from CUSTOM_INSTRUCTIONS.md in the WhiteDragon repository.');
            }
        },

        async render() {
            const panel = $(`.${CL.modal}`, $(`#${ID.modal}`));
            if (!panel) return;
            const profile = Profiles.current();
            await Profiles.load(profile);
            const brand = Brand.get();
            const layout = Layout.get();

            const cards = CFG.expressions.map(expression => {
                const own = Profiles.own(profile.key, expression);
                const fallback = S.defaultPack.get(expression);
                const status = own ? (profile.isProject ? 'Project image' : 'Default image')
                    : (profile.isProject && fallback ? 'Default fallback' : 'Missing');
                const kind = own && profile.isProject ? 'project' : '';
                return `<div class="${CL.card}"><img src="${Profiles.source(profile.key, expression)}" alt="${esc(expression)}"><b>${esc(expression)}</b><small data-kind="${kind}">${esc(status)}</small></div>`;
            }).join('');

            const title = profile.isProject ? `Project: ${profile.label}` : 'Default avatar pack';
            const importLabel = profile.isProject ? 'Import for this Project' : 'Import default images';
            const clearLabel = profile.isProject ? 'Clear this Project pack' : 'Clear default pack';

            panel.innerHTML = `
<div class="${CL.drag}" title="Drag to move · Double-click to center"><h2>White Dragon Avatar V4.5.1</h2><span class="${CL.hint}">⋮⋮ Drag · double-click to center</span></div>
<p>Expression avatars, Project profiles, header naming, layout controls, and high-quality image importing.</p>
<section class="${CL.section}">
<h3>AI expression control</h3>
<p><strong>Manual setup required.</strong> WhiteDragon runs in your browser, so ChatGPT cannot see the userscript by itself.</p>
<p class="${CL.note}">Copy the expression instructions below into ChatGPT Custom Instructions for all chats, or into a Project's instructions for just that Project. WhiteDragon never injects these instructions into your prompts automatically.</p>
<p class="${CL.note}"><strong>Usage note:</strong> Each expression change adds a short <code>[[avatar:...]]</code> marker to the model's reply. This uses a small amount of additional output/context tokens, roughly comparable to a few short words. More frequent switching adds slightly more marker text, but the impact is usually negligible.</p>
<div class="${CL.actions}">
<button id="wda4-copy-ai-instructions">Copy expression instructions</button>
<button id="wda4-copy-test-prompt">Copy test prompt</button>
</div>
<div class="${CL.code}">AI control status: instructions must be added to ChatGPT manually.</div>
</section>
<section class="${CL.section}"><h3>Header name and title style</h3><p class="${CL.note}">“ChatGPT Pro” becomes “${esc(brand.name)} Pro”. The composer placeholder is intentionally left unchanged for stability.</p>
<div class="${CL.form}"><label class="${CL.field}"><span>Header name</span><input id="wda4-brand-name" type="text" maxlength="40" value="${esc(brand.name)}" placeholder="Alice"></label><label class="${CL.field}"><span>Header font family</span><input id="wda4-brand-font" type="text" list="wda4-fonts" value="${esc(brand.fontFamily)}" placeholder='"Segoe UI", sans-serif'></label><div class="${CL.field}"><span>Header text color</span><div class="${CL.color}"><input id="wda4-brand-color" type="color" value="${esc(brand.color)}" ${brand.useColor ? '' : 'disabled'}><label><input id="wda4-brand-use-color" type="checkbox" ${brand.useColor ? 'checked' : ''}>Use custom color</label></div></div></div>
<datalist id="wda4-fonts"><option value='"Segoe UI", sans-serif'><option value='Arial, sans-serif'><option value='Verdana, sans-serif'><option value='Georgia, serif'><option value='"Times New Roman", serif'><option value='"Courier New", monospace'><option value='"Comic Sans MS", cursive'></datalist>
<div class="${CL.preview}"><div><strong id="wda4-brand-preview-name"></strong> <small>Pro</small></div></div><div class="${CL.actions}"><button id="wda4-brand-save">Apply interface style</button><button id="wda4-brand-reset">Reset to ChatGPT</button></div></section>
<section class="${CL.section}"><h3>Avatar size and position</h3><p class="${CL.note}">All controls preview immediately; Save only makes them survive reload.</p>${UI.slider('wda4-size','Avatar size',32,128,layout.size)}${UI.slider('wda4-gap','Horizontal position',-40,100,layout.gap)}${UI.slider('wda4-top','Vertical offset',-80,120,layout.topOffset)}${UI.slider('wda4-sticky','Sticky screen height',0,240,layout.stickyTop)}<p class="${CL.note}">Larger horizontal values move the avatar left; positive vertical values move it down.</p><div class="${CL.actions}"><button id="wda4-layout-save">Save avatar layout</button><button id="wda4-layout-reset">Reset avatar layout</button></div></section>
<div class="${CL.profile}">Current profile: <strong>${esc(title)}</strong>${profile.isProject ? `<br><small>${esc(profile.key)}</small>` : ''}</div><p class="${CL.note}">${profile.isProject ? 'Missing Project expressions use the default pack.' : 'This pack is the fallback outside and inside Projects.'} WhiteDragon detects markers even when ChatGPT splits one visible marker line across several streaming DOM nodes, and inline markers are stripped without deleting the surrounding text. Image quality up to 1536px remains preserved.</p><div class="${CL.grid}">${cards}</div>
<div class="${CL.actions}">
<label>${esc(importLabel)}<input id="wda4-import" type="file" accept="image/*" multiple></label>
<button id="wda4-copy-avatar-prompt">Copy avatar generation prompt</button>
<button id="wda4-clear-profile" class="${CL.danger}">${esc(clearLabel)}</button>
<button id="wda4-clear-all" class="${CL.danger}">Clear ALL avatar packs</button>
<button id="wda4-close">Close</button>
</div>
<p class="${CL.note}">Need an avatar set? Copy the generation prompt and use it with your own character reference image to create the 10 WhiteDragon expressions.</p>
<p>Assistant marker format:</p><div class="${CL.code}">${CFG.expressions.map(expression => `[[avatar:${expression}]]`).join('\n')}</div><p class="${CL.note}">Markers may appear several times in one reply. Each completed marker switches immediately during streaming, even when the renderer splits the marker across nested spans/text nodes.</p>`;

            UI.drag(panel);

            const brandPreview = () => {
                const name = txt($('#wda4-brand-name', panel)?.value) || 'ChatGPT';
                const font = $('#wda4-brand-font', panel)?.value.trim() || '';
                const useColor = $('#wda4-brand-use-color', panel)?.checked;
                const colorInput = $('#wda4-brand-color', panel);
                colorInput.disabled = !useColor;
                const namePreview = $('#wda4-brand-preview-name', panel);
                namePreview.textContent = name;
                namePreview.style.fontFamily = font;
                namePreview.style.color = useColor ? colorInput.value : '';
            };

            const layoutInput = () => ({
                size: $('#wda4-size', panel).value,
                gap: $('#wda4-gap', panel).value,
                topOffset: $('#wda4-top', panel).value,
                stickyTop: $('#wda4-sticky', panel).value
            });
            const layoutLabels = value => {
                $('#wda4-size-value', panel).textContent = `${value.size}px`;
                $('#wda4-gap-value', panel).textContent = `${value.gap}px`;
                $('#wda4-top-value', panel).textContent = `${value.topOffset}px`;
                $('#wda4-sticky-value', panel).textContent = `${value.stickyTop}px`;
            };
            const layoutPreview = () => {
                layoutLabels(Layout.preview(layoutInput()));
                if (S.layoutRaf !== null) return;
                S.layoutRaf = requestAnimationFrame(() => { S.layoutRaf = null; App.refresh(); });
            };

            panel.oninput = event => {
                if (event.target.id.startsWith('wda4-brand-')) brandPreview();
                if (['wda4-size','wda4-gap','wda4-top','wda4-sticky'].includes(event.target.id)) layoutPreview();
            };
            panel.onchange = async event => {
                if (event.target.id !== 'wda4-import') return;
                const files = [...(event.target.files || [])];
                if (!files.length) return;
                event.target.disabled = true;
                try { await Profiles.import(files, profile); }
                catch (error) { console.error(error); alert(`Import failed: ${error?.message || error}`); }
                finally { event.target.disabled = false; event.target.value = ''; }
            };
            panel.onclick = async event => {
                const button = event.target.closest('button');
                if (!button) return;
                try {
                    if (button.id === 'wda4-copy-ai-instructions') {
                        await UI.copyText(
                            AI_SETUP.instructions,
                            button,
                            'Instructions copied ✓'
                        );
                    } else if (button.id === 'wda4-copy-test-prompt') {
                        await UI.copyText(
                            AI_SETUP.testPrompt,
                            button,
                            'Test prompt copied ✓'
                        );
                    } else if (button.id === 'wda4-copy-avatar-prompt') {
                        await UI.copyText(
                            AI_SETUP.avatarGenerationPrompt,
                            button,
                            'Avatar prompt copied ✓'
                        );
                    } else if (button.id === 'wda4-brand-save') {
                        const saved = Brand.save({
                            name: $('#wda4-brand-name', panel).value,
                            fontFamily: $('#wda4-brand-font', panel).value,
                            useColor: $('#wda4-brand-use-color', panel).checked,
                            color: $('#wda4-brand-color', panel).value
                        });
                        $('#wda4-brand-name', panel).value = saved.name;
                        $('#wda4-brand-font', panel).value = saved.fontFamily;
                        $('#wda4-brand-use-color', panel).checked = saved.useColor;
                        $('#wda4-brand-color', panel).value = saved.color;
                        brandPreview();
                    } else if (button.id === 'wda4-brand-reset') {
                        Brand.reset(); await UI.render();
                    } else if (button.id === 'wda4-layout-save') {
                        const saved = Layout.save(layoutInput());
                        layoutLabels(saved);
                    } else if (button.id === 'wda4-layout-reset') {
                        Layout.reset(); await UI.render();
                    } else if (button.id === 'wda4-clear-profile') {
                        if (confirm(`Clear avatar overrides for:\n${title}?`)) await Profiles.clear(profile);
                    } else if (button.id === 'wda4-clear-all') {
                        if (confirm('Clear EVERY default and Project-specific avatar pack?')) await Profiles.clearAll();
                    } else if (button.id === 'wda4-close') UI.close();
                } catch (error) {
                    console.error(error);
                    alert(`Operation failed: ${error?.message || error}`);
                }
            };

            brandPreview();
            layoutLabels(layout);
        }
    };

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    const App = {
        cleanup() {
            try { localStorage.removeItem('chatgpt_white_dragon_avatar_pack_v1'); } catch (_) {}
            $$([
                '.white-dragon-avatar', '.white-dragon-avatar-v2', '.white-dragon-avatar-v21',
                '.white-dragon-avatar-v22', '.white-dragon-avatar-v23', '.white-dragon-avatar-rail-v23',
                '.wda3-rail', '.wda3-avatar'
            ].join(',')).forEach(element => element.remove());
            $$('.white-dragon-turn-anchor, .white-dragon-active-turn, .wda3-turn, .wda3-active')
                .forEach(element => element.classList.remove('white-dragon-turn-anchor','white-dragon-active-turn','wda3-turn','wda3-active'));
            $$('style[id^="white-dragon-avatar-"], #wda3-style').forEach(element => element.remove());
            ['white-dragon-avatar-overlay-layer','white-dragon-avatar-config-button','white-dragon-avatar-modal','wda3-config-button','wda3-modal']
                .forEach(id => document.getElementById(id)?.remove());
        },

        refresh() {
            UI.button();
            Brand.apply();
            Profiles.requestCurrent();
            const profile = Profiles.current();
            const turns = Chat.turns();
            turns.forEach(turn => Avatar.process(turn, profile));
            Visibility.sync(turns);
        },

        /*
         * Fast path for expression markers during streaming.
         *
         * The normal page refresh is deliberately debounced so ChatGPT can
         * stream lots of tokens without making the userscript expensive.
         * That also meant V4.2 did not run until streaming paused/finished,
         * so several marker lines appeared first and only the final marker
         * became visible afterward.
         *
         * V4.3 watches only mutations that actually contain "[[avatar:".
         * When one appears, just that assistant turn is updated immediately.
         * Ordinary streaming tokens still use the cheap debounced path.
         */
        streamMarkers(mutations) {
            const profile = Profiles.current();
            const updates = new Map();

            /*
             * ChatGPT's markdown renderer does not always stream a marker as
             * one text node. For example, the visible line
             *
             *   [[avatar:smile]]
             *
             * can temporarily be split across several text/span nodes. V4.3
             * checked only the mutated node for the literal "[[avatar:" and
             * therefore missed those cases.
             *
             * V4.4 instead climbs from every mutation to its small enclosing
             * rendered block (p/span/div/etc.). This is cheap, but sees the
             * complete visual line even when React split the text internally.
             */
            const inspectNode = node => {
                let element = node?.nodeType === Node.TEXT_NODE
                    ? node.parentElement
                    : node;

                if (!element || element.closest?.('pre, code')) return;

                const turn = Chat.turnFromNode(element);
                if (!turn || !Chat.isAssistant(turn)) return;

                const message = Chat.message(turn);
                const root = message || turn;
                let current = element;
                let marker = null;
                let markerElement = null;

                // Inspect only a handful of ancestors. A marker is emitted as
                // a short standalone line, so there is no reason to scan the
                // whole reply for every streamed token.
                for (let depth = 0; current && depth < 8; depth += 1) {
                    if (current.closest?.('pre, code')) return;

                    /*
                     * Do not require the marker's paragraph to be shorter than
                     * an arbitrary character limit. A marker appended to the
                     * end of a normal paragraph must switch expressions too.
                     *
                     * We intentionally do not inspect the whole message root
                     * here, so long replies still avoid an O(full reply)
                     * scan on every streamed token.
                     */
                    if (current !== root) {
                        const value = String(
                            current.textContent || ''
                        ).trim();

                        if (value.includes('[[avatar:')) {
                            Expression.marker.lastIndex = 0;
                            let match;

                            while (
                                (match = Expression.marker.exec(value)) !== null
                            ) {
                                const candidate =
                                    match[1].toLowerCase();

                                if (
                                    CFG.expressions.includes(candidate)
                                ) {
                                    marker = candidate;
                                }
                            }

                            Expression.marker.lastIndex = 0;

                            if (marker) {
                                markerElement = current;
                                break;
                            }
                        }
                    }

                    if (current === root) break;
                    current = current.parentElement;
                    if (current && !root.contains(current) && current !== root) break;
                }

                if (!marker) return;

                updates.set(turn, {
                    message,
                    marker,
                    markerElement
                });
            };

            for (const mutation of mutations) {
                inspectNode(mutation.target);

                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes || []) inspectNode(node);
                }
            }

            for (const [turn, update] of updates) {
                const { message, marker, markerElement } = update;

                turn.dataset.wda4Expression = marker;

                const parts = Avatar.ensure(turn);
                Avatar.source(parts, profile, marker);
                Avatar.position(
                    turn,
                    parts,
                    Chat.anchor(turn, message)
                );

                if (
                    markerElement &&
                    !markerElement.closest('pre, code')
                ) {
                    Expression.strip(markerElement);
                }

                if (message) Expression.hide(message);
            }
        },

        schedule(delay = CFG.scanDelay) {
            clearTimeout(S.scanTimer);
            S.scanTimer = setTimeout(App.refresh, delay);
        },

        relevant(mutation) {
            const nodes = [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])];
            if (mutation.type === 'childList' && nodes.length && nodes.every(node =>
                node.nodeType === Node.ELEMENT_NODE && (node.matches?.(`.${CL.rail}`) || node.closest?.(`#${ID.modal}`))
            )) return false;
            const target = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
            return !target?.closest?.(`#${ID.modal}, .${CL.rail}`);
        },

        async boot() {
            App.cleanup();
            Brand.load();
            Layout.load();
            UI.install();
            await Profiles.load({ key: CFG.defaultProfile, routeId: null, label: 'Default / outside Projects', isProject: false });
            App.refresh();

            new MutationObserver(mutations => {
                App.streamMarkers(mutations);

                if (mutations.some(App.relevant)) {
                    App.schedule();
                }
            }).observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });

            addEventListener('resize', () => {
                App.schedule(50);
                const panel = $(`.${CL.modal}`, $(`#${ID.modal}`));
                if (!panel) return;
                const rect = panel.getBoundingClientRect();
                if (rect.right < 60 || rect.left > innerWidth - 60 || rect.bottom < 40 || rect.top > innerHeight - 40) UI.center(panel);
            }, { passive: true });
            addEventListener('popstate', () => App.schedule(100));

            window.WhiteDragonAvatar = Object.freeze({
                version: CFG.version,
                refresh: App.refresh,
                openSettings: UI.open,
                currentProfile: Profiles.current,
                branding: Brand.get,
                applyBranding: Brand.save,
                applyHeaderBranding: Brand.save,
                layout: Layout.get,
                applyLayout: Layout.save
            });
            console.info(`[WhiteDragon] ${CFG.version} loaded.`);
        }
    };

    App.boot().catch(error => console.error('[WhiteDragon] Boot failed:', error));
})();
