// ==UserScript==
// @name         Google Tasks - Copiar link da tarefa
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Adiciona o item "Copiar link" ao menu de opções (três pontos) de cada tarefa no Google Tarefas embutido no Gmail.
// @author       luascfl
// @match        https://tasks.google.com/embed/list/*
// @icon         https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Google_Tasks_2021.svg/2159px-Google_Tasks_2021.svg.png
// @home         https://github.com/luascfl/google-tasks-copy-link
// @supportURL   https://github.com/luascfl/google-tasks-copy-link/issues
// @updateURL    https://raw.githubusercontent.com/luascfl/google-tasks-copy-link/main/google-tasks-copy-link.user.js
// @downloadURL  https://raw.githubusercontent.com/luascfl/google-tasks-copy-link/main/google-tasks-copy-link.user.js
// @grant        GM_setClipboard
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[tasks-copy-link]';
    const ITEM_MARK = 'data-gtcl-item';
    const ROW_SELECTOR = '[role="listitem"][data-id][data-type="0"]';
    const OPTIONS_BUTTON_SELECTOR = '[jsname="pzCKEc"]';
    const MENU_SELECTOR = '.JAPqpe';
    const MENU_ITEM_SELECTOR = '[role="menuitem"]';
    const SEPARATOR_SELECTOR = '[role="separator"]';
    const LABEL = 'Copiar link';
    const COPIED_LABEL = 'Link copiado';
    const TOAST_ID = 'gtcl-toast';
    const TOAST_MS = 2200;
    const LINK_ICON_PATH = 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z';

    // Menu -> tarefa e botão que o abriram. O Google cria um nó de menu novo a cada abertura.
    const menuTask = new WeakMap();
    const menuButton = new WeakMap();
    let pendingTaskId = null;
    let pendingButton = null;

    const taskLink = id => `https://tasks.google.com/task/${encodeURIComponent(id)}`;

    // --- Quem abriu o menu? ---------------------------------------------------
    function rememberTask(event) {
        const target = event.target instanceof Element ? event.target : null;
        const button = target && target.closest(OPTIONS_BUTTON_SELECTOR);
        const row = target && target.closest(ROW_SELECTOR);
        if (button || event.type === 'contextmenu') {
            // Botão "Opções" ou botão direito: abre o menu da tarefa. Botão sem linha (menu da lista) zera.
            pendingTaskId = row ? row.dataset.id : null;
            pendingButton = row ? button : null;
        } else if (event.isTrusted) {
            // Clique real em outro lugar invalida a seleção; cliques sintéticos do próprio Google não.
            pendingTaskId = null;
            pendingButton = null;
        }
    }
    document.addEventListener('click', rememberTask, true);
    document.addEventListener('contextmenu', rememberTask, true);

    // --- Toast ----------------------------------------------------------------
    function toast(text) {
        let el = document.getElementById(TOAST_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = TOAST_ID;
            el.setAttribute('role', 'status');
            el.style.cssText = [
                'position:fixed', 'left:16px', 'bottom:16px', 'z-index:2147483647',
                'padding:10px 16px', 'border-radius:4px', 'background:#323232', 'color:#fff',
                'font:14px/20px "Google Sans",Roboto,Arial,sans-serif',
                'box-shadow:0 3px 5px -1px rgba(0,0,0,.2),0 6px 10px rgba(0,0,0,.14)',
                'pointer-events:none', 'transition:opacity .15s', 'opacity:0'
            ].join(';');
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.style.opacity = '1';
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => { el.style.opacity = '0'; }, TOAST_MS);
    }

    // --- Cópia ----------------------------------------------------------------
    async function copyText(text) {
        try {
            GM_setClipboard(text, 'text');
            return true;
        } catch (err) {
            console.warn(LOG, 'GM_setClipboard falhou, tentando navigator.clipboard', err);
        }
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error(LOG, 'não foi possível copiar', err);
            return false;
        }
    }

    // --- Menu -----------------------------------------------------------------
    function closeMenu(menu, button) {
        // Alterna o botão de opções (mesmo caminho do usuário); Escape como alternativa.
        if (button && button.isConnected && button.getAttribute('aria-expanded') === 'true') {
            button.click();
            return;
        }
        menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    }

    function buildItem(template) {
        const item = template.cloneNode(true);
        // Sem jsaction/jsname/jslog o framework do Google ignora o nó; o comportamento é nosso.
        for (const el of [item, ...item.querySelectorAll('*')]) {
            for (const attr of ['jsaction', 'jsname', 'jslog', 'jscontroller', 'data-has-deadline']) el.removeAttribute(attr);
        }
        item.setAttribute(ITEM_MARK, '1');
        item.setAttribute('aria-label', LABEL);
        item.setAttribute('role', 'menuitem');
        item.setAttribute('tabindex', '-1');
        const svg = item.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', '20');
            svg.setAttribute('height', '20');
            svg.setAttribute('viewBox', '0 0 24 24');
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', LINK_ICON_PATH);
            svg.appendChild(path);
        }
        const text = item.querySelector('.jO7h3c');
        if (text) text.textContent = LABEL;
        return item;
    }

    async function activate(item, menu) {
        const id = menuTask.get(menu);
        const button = menuButton.get(menu);
        if (!id) {
            console.warn(LOG, 'menu sem tarefa associada');
            return;
        }
        const link = taskLink(id);
        const ok = await copyText(link);
        console.log(LOG, ok ? 'copiado' : 'falhou', link);
        toast(ok ? COPIED_LABEL : 'Não foi possível copiar o link');
        closeMenu(menu, button);
    }

    function enhance(menu) {
        if (menu.querySelector(`[${ITEM_MARK}]`)) return;
        if (!menuTask.has(menu)) {
            if (!pendingTaskId) return; // menu que não é de tarefa (ex.: opções da lista)
            if (!menu.querySelector(MENU_ITEM_SELECTOR)) return; // conteúdo ainda não renderizado
            menuTask.set(menu, pendingTaskId);
            menuButton.set(menu, pendingButton);
        }
        const items = [...menu.querySelectorAll(MENU_ITEM_SELECTOR)];
        if (!items.length) return;
        const separator = menu.querySelector(SEPARATOR_SELECTOR);
        // Antes de "Excluir" (último item antes do separador); sem separador, no fim.
        const before = separator ? separator.previousElementSibling : null;
        const template = (before && before.matches(MENU_ITEM_SELECTOR) ? before.previousElementSibling : null) || items[0];
        const item = buildItem(template.matches(MENU_ITEM_SELECTOR) ? template : items[0]);
        item.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); activate(item, menu); });
        item.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); activate(item, menu); }
        });
        if (before && before.matches(MENU_ITEM_SELECTOR)) before.before(item);
        else menu.appendChild(item);
        console.log(LOG, 'item inserido para tarefa', menuTask.get(menu));
    }

    function scan() {
        document.querySelectorAll(MENU_SELECTOR).forEach(enhance);
    }

    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    scan();
    console.log(LOG, 'ativo');
})();
