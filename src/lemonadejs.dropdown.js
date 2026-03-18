import { lemonade } from './lemonadejs.js';
import { Modal } from './lemonadejs.modal.js';
// https://cdn.jsdelivr.net/npm/@lemonadejs/dropdown/dist/index.js

///**
// * Implement page up and down navigation
// * Implement color attribute for items
// */
//
//if (!lemonade && typeof (require) === 'function') {
//    var lemonade = require('lemonadejs');
//}
//
//if (!Modal && typeof (require) === 'function') {
//    var Modal = require('@lemonadejs/modal');
//}
//
//; (function (global, factory) {
//    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
//    typeof define === 'function' && define.amd ? define(factory) :
//    global.Dropdown = factory();
//}(this, (function () {
export const Dropdown= (function () {

    class CustomEvents extends Event {
        constructor(type, props, options) {
            super(type, {
                bubbles: true,
                composed: true,
                ...options,
            });

            if (props) {
                for (const key in props) {
                    // Avoid assigning if property already exists anywhere on `this`
                    if (! (key in this)) {
                        this[key] = props[key];
                    }
                }
            }
        }
    }

    // Dispatcher
    const Dispatch = function(method, type, options) {
        // Try calling the method directly if provided
        if (typeof method === 'function') {
            let a = Object.values(options);
            return method(...a);
        } else if (this.tagName) {
            return this.dispatchEvent(new CustomEvents(type, options));
        }
    }

    // Default row height
    let defaultRowHeight = 24;

    // Translations
    const T = function(t) {
        if (typeof(document) !== "undefined" && document.dictionary) {
            return document.dictionary[t] || t;
        } else {
            return t;
        }
    }

    const isEmpty = function(v) {
        return v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0);
    }

    /**
     * Compare two values (arrays, strings, numbers, etc.)
     * Returns true if both are equal or empty
     * @param {*} a1
     * @param {*} a2
     */
    const compareValues = function(a1, a2) {
        if (a1 === a2 || (isEmpty(a1) && isEmpty(a2))) {
            return true;
        }

        if (!a1 || !a2) {
            return false;
        }

        if (Array.isArray(a1) && Array.isArray(a2)) {
            if (a1.length !== a2.length) {
                return false;
            }
            for (let i = 0; i < a1.length; i++) {
                if (a1[i] !== a2[i]) {
                    return false;
                }
            }
            return true;
        }

        return a1 === a2;
    }

    const lazyLoading = function (self) {
        /**
         * Get the position from top of a row by its index
         * @param item
         * @returns {number}
         */
        const getRowPosition = function (item) {
            // Position from top
            let top = 0;
            if (item) {
                let items = self.rows;
                if (items && items.length) {
                    let index = self.rows.indexOf(item);
                    // Go through the items
                    for (let j = 0; j < index; j++) {
                        top += items[j].height || defaultRowHeight;
                    }
                }
            }
            return top;
        }

        const updateScroll = function () {
            let items = self.rows;
            if (items) {
                // Before control
                let before = true;
                // Total of items in the container
                let numOfItems = items.length;
                // Position from top
                let height = 0;
                // Size of the adjustment
                let size = 0;
                // Go through the items
                for (let j = 0; j < numOfItems; j++) {
                    let h = items[j].height || defaultRowHeight;
                    // Height
                    height += h;
                    // Start tracking all items as before
                    if (items[j] === self.result[0]) {
                        before = false;
                    }
                    // Adjustment
                    if (before) {
                        size += h;
                    }
                }
                // Update height
                scroll.style.height = height + 'px';
                // Adjust scroll position
                return size;
            }
            return false;
        }

        const getVisibleRows = function (reset) {
            let items = self.rows;
            if (items) {
                let adjust;
                // Total of items in the container
                let numOfItems = items.length;
                // Get the position from top
                let y = el.scrollTop;
                // Get the height
                let h = null;
                if (self.type === 'searchbar' || self.type === 'picker') {
                    // Priority should be the size used on the viewport
                    h = y + (el.offsetHeight || self.height);
                } else {
                    // Priority is the height define during initialization
                    h = y + (self.height || el.offsetHeight);
                }
                // Go through the items
                let rows = [];
                // Height
                let height = 0;
                // Go through all items
                for (let j = 0; j < numOfItems; j++) {
                    if (items[j].visible !== false) {
                        // Height
                        let rowHeight = items[j].height || defaultRowHeight;
                        // Return on partial width
                        if (height + rowHeight > y && height < h) {
                            rows.push(items[j]);
                        }
                        height += rowHeight;
                    }
                }

                // Update visible rows
                if (reset || !compareValues(rows, self.result)) {
                    // Render the items
                    self.result = rows;
                    // Adjust scroll height
                    let adjustScroll = reset;
                    // Adjust scrolling
                    for (let i = 0; i < rows.length; i++) {
                        // Item
                        let item = rows[i];
                        // Item height
                        let h = item.el.offsetHeight;
                        // Update row height
                        if (!item.height || h !== item.height) {
                            // Keep item height
                            item.height = h;
                            // Adjust total height
                            adjustScroll = true;
                        }
                    }

                    // Update scroll if the height of one element has been changed
                    if (adjustScroll) {
                        // Adjust the scroll height
                        adjust = updateScroll();
                    }
                }

                // Adjust position of the first element
                let position = getRowPosition(self.result[0]);
                let diff = position - el.scrollTop;
                if (diff > 0) {
                    diff = 0;
                }
                self.container.style.top = diff + 'px';

                return adjust;
            }
        }

        /**
         * Move the position to the top and re-render based on the scroll
         * @param reset
         */
        const render = function (reset) {
            // Move scroll to the top
            el.scrollTop = 0;
            // Reset scroll
            updateScroll();
            // Append first batch
            getVisibleRows(reset);
        }

        /**
         * Will adjust the items based on the scroll position offset
         */
        self.adjustPosition = function (item) {
            if (item.el) {
                let h = item.el.offsetHeight;
                let calc = item.el.offsetTop + h;
                if (calc > el.offsetHeight) {
                    let size = calc - el.offsetHeight;
                    if (size < h) {
                        size = h;
                    }
                    el.scrollTop -= -1 * size;
                }
            }
        }

        // Controls
        const scrollControls = function () {
            getVisibleRows(false);
        }

        // Element for scrolling
        let el = self.container.parentNode;
        el.classList.add('lm-lazy');
        // Div to represent the height of the content
        const scroll = document.createElement('div');
        scroll.classList.add('lm-lazy-scroll');
        // Force the height and add scrolling
        el.appendChild(scroll);
        el.addEventListener('scroll', scrollControls, { passive: true });
        el.addEventListener('wheel', scrollControls, { passive: true });
        self.container.classList.add('lm-lazy-items');

        self.goto = function (item) {
            el.scrollTop = getRowPosition(item);
            let adjust = getVisibleRows(false);
            if (adjust) {
                el.scrollTop = adjust;
                // Last adjust on the visible rows
                getVisibleRows(false);
            }
        }

        return (prop) => {
            if (prop === 'rows') {
                render(true);
            }
        }
    }

    const getAttributeName = function(prop) {
        if (prop.substring(0,1) === ':') {
            prop = prop.substring(1);
        } else if (prop.substring(0,3) === 'lm-') {
            prop = prop.substring(3);
        }
        return prop.toLowerCase();
    }

    const extractFromHtml =  function(element) {
        let data = [];
        // Content
        for (let i = 0; i < element.children.length; i++) {
            let e = element.children[i];
            let item = {
                text: e.textContent || e.getAttribute('title'),
                value: e.getAttribute('value'),
            }
            if (item.value == null) {
                item.value = item.text;
            }
            data.push(item);
        }

        return data;
    }

    const extract = function(children) {
        let data = [];

        if (this.tagName) {
            data = extractFromHtml(this);
            // Remove all elements
            this.textContent = '';
        } else {
            // Get data
            if (typeof(children) === 'string') {
                // Version 4
                let d = document.createElement('div');
                d.innerHTML = children;
                data = extractFromHtml(d);
            } else if (children && children.length) {
                // Version 5
                children.forEach((v) => {
                    let item = {}
                    v.props.forEach((prop) => {
                        item[getAttributeName(prop.name)] = prop.value;
                    });
                    if (! item.text) {
                        item.text = v.children[0]?.props[0]?.value || '';
                    }
                    data.push(item);
                });
                // Block children
                children.length = 0;
            }
        }

        return data;
    }

    const isDOM = function(o) {
        return (o instanceof Element || o instanceof HTMLDocument || o instanceof DocumentFragment);
    }

    const Dropdown = function (children, { onchange, onload }) {
        let self = this;
        // Data
        let data = [];
        // Internal value controllers
        let value = [];
        // Cursor
        let cursor = null;
        // Control events
        let ignoreEvents = false;
        // Lazy loading global instance
        let lazyloading = null;
        // Tracking changes
        let changesDetected = false;
        // Debounce timer for search
        let searchTimeout = null;

        // Data
        if (! Array.isArray(self.data)) {
            self.data = [];
        }

        let d = extract.call(this, children);
        if (d) {
            d.forEach((v) => {
                self.data.push(v)
            })
        }

        // Decide the type based on the size of the screen
        let autoType = self.type === 'auto';

        // Custom events defined by the user
        let load = self.onload;
        self.onload = null;
        let change = self.onchange;
        self.onchange = null;

        // Compatibility
        if (typeof self.newOptions !== 'undefined') {
            self.insert = self.newOptions;
        }

        // Cursor controllers
        const setCursor = function (index, force) {
            let item = self.rows[index];
            if (typeof (item) !== 'undefined') {
                // Set the cursor number
                cursor = index;
                // Set visual indication
                item.cursor = true;
                // Go to the item on the scroll in case the item is not on the viewport
                if (!(item.el && item.el.parentNode) || force === true) {
                    // Goto method
                    self.goto(item);
                }
                // Adjust cursor position
                setTimeout(function () {
                    self.adjustPosition(item);
                });
            }
        }

        const removeCursor = function (reset) {
            if (cursor !== null) {
                if (typeof (self.rows[cursor]) !== 'undefined') {
                    self.rows[cursor].cursor = false;
                }
                if (reset) {
                    // Cursor is null
                    cursor = null;
                }
            }
        }

        const moveCursor = function (direction, jump) {
            // Remove cursor
            removeCursor();
            // Last item
            let last = self.rows.length - 1;
            if (jump) {
                if (direction < 0) {
                    cursor = 0;
                } else {
                    cursor = last;
                }
            } else {
                // Position
                if (cursor === null) {
                    cursor = 0;
                } else {
                    // Move previous
                    cursor = cursor + direction;
                }
                // Reach the boundaries
                if (direction < 0) {
                    // Back to the last one
                    if (cursor < 0) {
                        cursor = last;
                    }
                } else {
                    // Back to the first one
                    if (cursor > last) {
                        cursor = 0;
                    }
                }
            }
            // Add cursor
            setCursor(cursor);
        }

        const adjustDimensions = function(data) {
            // Estimate width
            let width = self.width ?? 0;
            // Adjust the width
            let w = getInput().offsetWidth;
            if (width < w) {
                width = w;
            }
            // Width && values
            data.map(function (s) {
                // Estimated width of the element
                if (s.text) {
                    let w = Math.max(width, s.text.length * 7.5);
                    if (width < w) {
                        width = w;
                    }
                }
            });
            // Min width for the container
            self.container.parentNode.style.width = (width - 2) + 'px';
        }

        const setData = function () {
            // Data
            data = JSON.parse(JSON.stringify(self.data));
            // Re-order to make sure groups are in sequence
            if (data && data.length) {
                // Adjust width and height
                adjustDimensions(data);
                // Groups
                data.sort((a, b) => {
                    // Compare groups
                    if (a.group && b.group) {
                        return a.group.localeCompare(b.group);
                    }
                    return 0;
                });
                let group = '';
                // Define group headers
                data.map((v) => {
                    // Compare groups
                    if (v && v.group && v.group !== group) {
                        v.header = v.group;
                        group = v.group;
                    }
                });
            }
            // Data to be listed
            self.rows = data;
        }

        const updateLabel = function () {
            if (value && value.length) {
                getInput().textContent = value.filter(v => v.selected).map(i => i.text).join('; ');
            } else {
                getInput().textContent = '';
            }
        }

        const setValue = function (v, ignoreEvent) {
            // Values
            let newValue;
            if (! Array.isArray(v)) {
                if (typeof(v) === 'string') {
                    newValue = v.split(self.divisor ?? ';');
                } else {
                    newValue = [v];
                }
            } else {
                newValue = v;
            }

            // Width && values
            value = [];

            if (Array.isArray(data)) {
                data.map(function (s) {
                    s.selected = newValue.some(v => {
                        // Use strict equality when either value is empty string to avoid '' == 0 being true
                        if (v === '' || s.value === '') {
                            return v === s.value;
                        }
                        return v == s.value;
                    });
                    if (s.selected) {
                        value.push(s);
                    }
                });
            }

            // Update label
            if (self.isClosed()) {
                updateLabel();
            }

            // Component onchange
            if (! ignoreEvent) {
                Dispatch.call(self, change, 'change', {
                    instance: self,
                    value: getValue(),
                });
            }
        }

        const getValue = function () {
            if (self.multiple) {
                if (value && value.length) {
                    return value.filter(v => v.selected).map(i => i.value);
                }
            } else {
                if (value && value.length) {
                    return value[0].value;
                }
            }

            return null;
        }

        const getText = function () {
            if (self.multiple) {
                if (value && value.length) {
                    return value.filter(v => v.selected).map(i => i.text);
                }
            } else {
                if (value && value.length) {
                    return value[0].text;
                }
            }

            return null;
        }

        const onopen = function () {
            self.state = true;
            // Value
            let v = value[value.length - 1];
            // Make sure goes back to the top of the scroll
            if (self.container.parentNode.scrollTop > 0) {
                self.container.parentNode.scrollTop = 0;
            }
            // Move to the correct position
            if (v) {
                // Mark the position of the cursor to the same element
                setCursor(self.rows.indexOf(v), true);
            }
            // Prepare search field
            if (self.autocomplete) {
                // Get the input
                let input = getInput();
                // Editable
                input.setAttribute('contenteditable', true);
                // Clear input
                input.textContent = '';
                // Focus on the item
                input.focus();
            }
            // Adjust width and height
            adjustDimensions(self.data);
            // Open event
            Dispatch.call(self, self.onopen, 'open', {
                instance: self
            });
        }

        const onclose = function (options, origin) {
            // Cursor
            removeCursor(true);
            // Reset search
            if (self.autocomplete) {
                // Go to begin of the data
                self.rows = data;
                // Get the input
                let input = getInput();
                if (input) {
                    // Remove editable attribute
                    input.removeAttribute('contenteditable');
                    // Clear input
                    input.textContent = '';
                }
            }

            if (origin === 'escape') {
                // Cancel operation and keep the same previous value
                setValue(self.value, true);
            } else {
                // Current value
                let newValue = getValue();

                // If that is different from the component value
                if (changesDetected === true && ! compareValues(newValue, self.value)) {
                    self.value = newValue;
                } else {
                    // Update label
                    updateLabel();
                }
            }

            // Identify the new state of the dropdown
            self.state = false;

            // Close event
            Dispatch.call(self, self.onclose, 'close', {
                instance: self,
                ...options
            });
        }

        const normalizeData = function(result) {
            if (result && result.length) {
                return result.map((v) => {
                    if (typeof v === 'string' || typeof v === 'number') {
                        return { value: v, text: v };
                    } else if (typeof v === 'object' && v.hasOwnProperty('name')) {
                        return { value: v.id, text: v.name };
                    } else {
                        return v;
                    }
                });
            }
        }

        const loadData = function(result) {
            result = normalizeData(result);
            // Loading controls
            lazyloading = lazyLoading(self);
            // Loading new data from a remote source
            if (result) {
                result.forEach((v) => {
                    self.data.push(v);
                });
            }
            // Process the data
            setData();
            // Set value
            if (typeof(self.value) !== 'undefined') {
                setValue(self.value, true);
            }
            // Onload method
            Dispatch.call(self, load, 'load', {
                instance: self
            });
            // Remove loading spin
            self.input.classList.remove('lm-dropdown-loading');
        }

        const resetData = function(result) {
            result = normalizeData(result);
            // Reset cursor
            removeCursor(true);
            let r = data.filter(item => {
                return item.selected === true;
            });
            // Loading new data from a remote source
            if (result) {
                result.forEach((v) => {
                    r.push(v);
                });
            }
            self.rows = r;
            // Remove loading spin
            self.input.classList.remove('lm-dropdown-loading');

            // Event
            Dispatch.call(self, self.onsearch, 'search', {
                instance: self,
                result: result,
            });
        }

        const getInput = function() {
            return self.input;
        }

        const search = function(query) {
            if (! self.isClosed() && self.autocomplete) {

                // Remote or normal search
                if (self.remote === true && self.url) {
                    // Clear existing timeout
                    if (searchTimeout) {
                        clearTimeout(searchTimeout);
                    }
                    // Loading spin
                    self.input.classList.add('lm-dropdown-loading');
                    // Headers
                    let http = {
                        headers: {
                            'Content-Type': 'text/json',
                        }
                    }
                    let ret = Dispatch.call(self, self.onbeforesearch, 'beforesearch', {
                        instance: self,
                        http: http,
                        query: query,
                    });

                    if (ret === false) {
                        return;
                    }

                    // Debounce the search with 300ms delay
                    searchTimeout = setTimeout(() => {
                        let url = self.url;
                        url += url.indexOf('?') === -1 ? '?' : '&';
                        url += `q=${query}`;

                        fetch(url, http).then(r => r.json()).then(resetData).catch((error) => {
                            resetData([]);
                        });
                    }, 300);
                } else {
                    // Filter options
                    let temp;

                    const find = (prop) => {
                        if (prop) {
                            if (Array.isArray(prop)) {
                                // match if ANY element contains the query (case-insensitive)
                                return prop.some(v => v != null && v.toString().toLowerCase().includes(query));
                            }
                            // handle strings/numbers/others
                            return prop.toString().toLowerCase().includes(query);
                        }
                        return false;
                    };

                    if (! query) {
                        temp = data;
                    } else {
                        temp = data.filter(item => {
                            return item.selected === true || find(item.text) || find(item.group) || find(item.keywords) || find(item.synonym);
                        });
                    }

                    // Cursor
                    removeCursor(true);
                    // Update the data from the dropdown
                    self.rows = temp;
                }
            }
        }

        const events = {
            focusout: (e) => {
                if (self.modal) {
                    if (! (e.relatedTarget && self.el.contains(e.relatedTarget))) {
                        if (! self.isClosed()) {
                            self.close({ origin: 'focusout '});
                        }
                    }
                }
            },
            keydown: (e) => {
                if (! self.isClosed()) {
                    let prevent = false;
                    if (e.code === 'ArrowUp') {
                        moveCursor(-1);
                        prevent = true;
                    } else if (e.code === 'ArrowDown') {
                        moveCursor(1);
                        prevent = true;
                    } else if (e.code === 'Home') {
                        moveCursor(-1, true);
                        if (!self.autocomplete) {
                            prevent = true;
                        }
                    } else if (e.code === 'End') {
                        moveCursor(1, true);
                        if (!self.autocomplete) {
                            prevent = true;
                        }
                    } else if (e.code === 'Enter') {
                        if (e.target.tagName === 'BUTTON') {
                            e.target.click();
                            let input = getInput();
                            input.focus();
                        } else {
                            select(e, self.rows[cursor]);
                        }
                        prevent = true;
                    } else if (e.code === 'Escape') {
                        self.close({ origin: 'escape'});
                        prevent = true;
                    } else {
                        if (e.keyCode === 32 && !self.autocomplete) {
                            select(e, self.rows[cursor]);
                        }
                    }

                    if (prevent) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                    }
                } else {
                    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'Enter') {
                        self.open();
                        e.preventDefault();
                        e.stopImmediatePropagation();
                    }
                }
            },
            mousedown: (e) => {
                if (e.target.classList.contains('lm-dropdown-input')) {
                    if (self.autocomplete) {
                        let x;
                        if (e.changedTouches && e.changedTouches[0]) {
                            x = e.changedTouches[0].clientX;
                        } else {
                            x = e.clientX;
                        }
                        if (e.target.offsetWidth - (x - e.target.offsetLeft) < 20) {
                            toggle();
                        } else {
                            self.open();
                        }
                    } else {
                        toggle();
                    }
                }
            },
            paste: (e) => {
                if (e.target.classList.contains('lm-dropdown-input')) {
                    let text;
                    if (e.clipboardData || e.originalEvent.clipboardData) {
                        text = (e.originalEvent || e).clipboardData.getData('text/plain');
                    } else if (window.clipboardData) {
                        text = window.clipboardData.getData('Text');
                    }
                    text = text.replace(/(\r\n|\n|\r)/gm, "");
                    document.execCommand('insertText', false, text)
                    e.preventDefault();
                }
            },
            input: (e) => {
                if (e.target.classList.contains('lm-dropdown-input')) {
                    search(e.target.textContent.toLowerCase());
                }
            },
        }

        const selectItem = function(s) {
            if (self.remote === true) {
                if (data.indexOf(s) === -1) {
                    self.data.push(s);
                    data.push(s);
                }
            }

            if (self.multiple === true) {
                let position = value.indexOf(s);
                if (position === -1) {
                    value.push(s);
                    s.selected = true;
                } else {
                    value.splice(position, 1);
                    s.selected = false;
                }
            } else {
                if (value[0] === s) {
                    if (self.allowEmpty === false) {
                        s.selected = true;
                    } else {
                        s.selected = !s.selected;
                    }
                } else {
                    if (value[0]) {
                        value[0].selected = false;
                    }
                    s.selected = true;
                }
                if (s.selected) {
                    value = [s];
                } else {
                    value = [];
                }
            }

            changesDetected = true;
        }

        const add = async function (e) {
            let input = getInput();
            let text = input.textContent;
            if (! text) {
                return false;
            }

            // New item
            let s = {
                text: text,
                value: text,
            }

            self.add(s);

            e.preventDefault();
        }

        const select = function (e, s) {
            if (s && s.disabled !== true) {
                selectItem(s);
                // Close the modal
                if (self.multiple !== true) {
                    self.close({ origin: 'button' });
                }
            }
        }

        const toggle = function () {
            if (self.modal) {
                if (self.isClosed()) {
                    self.open();
                } else {
                    self.close({ origin: 'button' });
                }
            }
        }

        self.add = async function (newItem) {
            // Event
            if (typeof(self.onbeforeinsert) === 'function') {
                self.input.classList.add('lm-dropdown-loading');
                let ret = await self.onbeforeinsert(self, newItem);
                self.input.classList.remove('lm-dropdown-loading');
                if (ret === false) {
                    return;
                } else if (ret) {
                    newItem = ret;
                }
            }
            // Process the data
            data.push(newItem);
            self.data.push(newItem);
            // Refresh screen
            self.result.unshift(newItem);
            self.rows.unshift(newItem);
            self.refresh('result');

            Dispatch.call(self, self.oninsert, 'insert', {
                instance: self,
                item: newItem,
            });
        }

        self.open = function () {
            if (self.modal && ! self.disabled) {
                if (self.isClosed()) {
                    if (autoType) {
                        self.type = window.innerWidth > 640 ? self.type = 'default' : (self.autocomplete ? 'searchbar' : 'picker');
                    }
                    // Track
                    changesDetected = false;
                    // Open the modal
                    self.modal.open();
                }
            }
        }

        self.close = function (options) {
            if (self.modal) {
                if (options?.origin) {
                    self.modal.close(options)
                } else {
                    self.modal.close({ origin: 'button' })
                }
            }
        }

        self.isClosed = function() {
            if (self.modal) {
                return self.modal.isClosed();
            }
        }

        self.setData = function(data) {
            self.data = data;
        }

        self.getData = function() {
            return self.data;
        }

        self.getValue = function() {
            return self.value;
        }

        self.getText = function() {
            return getText();
        }

        self.setValue = function(v) {
            self.value = v;
        }

        self.reset = function() {
            self.value = null;
            self.close({ origin: 'button' });
        }

        self.onevent = function(e) {
            if (events[e.type]) {
                events[e.type](e);
            }
        }

        // Init with a
        let input = self.input;

        onload(() => {
            if (self.type === "inline") {
                // For inline dropdown
                self.el.setAttribute('tabindex', 0);
                // Remove search
                self.input.remove();
            } else {
                // Create modal instance
                self.modal = {
                    closed: true,
                    focus: false,
                    onopen: onopen,
                    onclose: onclose,
                    position: 'absolute',
                    'auto-adjust': true,
                    'auto-close': false,
                };
                // Generate modal
                Modal(self.el.children[1], self.modal);
            }

            if (self.remote === 'true') {
                self.remote = true;
            }

            if (self.autocomplete === 'true') {
                self.autocomplete = true;
            }

            if (self.multiple === 'true') {
                self.multiple = true;
            }

            if (self.insert === 'true') {
                self.insert = true;
            }

            // Autocomplete will be forced to be true when insert action is active
            if ((self.insert === true || self.type === 'searchbar' || self.remote === true) && ! self.autocomplete) {
                self.autocomplete = true;
            }

            if (typeof(input) !== 'undefined') {
                // Remove the native element
                if (isDOM(input)) {
                    input.classList.add('lm-dropdown-input');
                }
                // Remove search
                self.input.remove();
                // New input
                self.input = input;
            } else {
                self.el.children[0].style.position = 'relative';
            }

            // Default width
            if (self.width) {
                // Dropdown
                self.el.style.width = self.width + 'px';
            }

            // Height
            self.height = 400;

            // Animation for mobile
            if (document.documentElement.clientWidth < 800) {
                self.animation = true;
            }

            // Events
            self.el.addEventListener('focusout', events.focusout);
            self.el.addEventListener('keydown', events.keydown);
            self.el.addEventListener('mousedown', events.mousedown);
            self.el.addEventListener('paste', events.paste);
            self.el.addEventListener('input', events.input);

            // Load remote data
            if (self.url) {
                if (self.remote === true) {
                    loadData();
                } else {
                    // Loading spin
                    self.input.classList.add('lm-dropdown-loading');
                    // Load remote data
                    fetch(self.url, {
                        headers: {
                            'Content-Type': 'text/json',
                        }
                    }).then(r => r.json()).then(loadData).catch(() => {
                        loadData();
                    });
                }
            } else {
                loadData();
            }
        });

        onchange(prop => {
            if (prop === 'value') {
                setValue(self.value);
            } else if (prop === 'data') {
                // Store current value before resetting data
                let currentValue = self.value;
                setData();

                // Only reset value if it's not in the new data
                if (currentValue !== null && currentValue !== undefined && currentValue !== '') {
                    let valuesToCheck = Array.isArray(currentValue) ? currentValue : [currentValue];

                    // Filter to keep only values that exist in the new data
                    let validValues = valuesToCheck.filter(v => {
                        return self.data.some(item => {
                            if (v === '' || item.value === '') {
                                return v === item.value;
                            }
                            return v == item.value;
                        });
                    });

                    if (validValues.length === 0) {
                        // No valid values remain, reset to null
                        self.value = null;
                    } else if (self.multiple) {
                        // Multi-select: keep only valid values
                        self.value = validValues;
                    } else {
                        // Single select: re-apply the value
                        self.value = validValues[0];
                    }
                }
            }

            if (typeof (lazyloading) === 'function') {
                lazyloading(prop);
            }
        });

        return render => render`<div class="lm-dropdown" data-state="{{self.state}}" data-insert="{{self.insert}}" data-type="{{self.type}}" data-disabled="{{self.disabled}}" :value="self.value" :data="self.data">
            <div class="lm-dropdown-header">
                <div class="lm-dropdown-input" placeholder="{{self.placeholder}}" :ref="self.input" tabindex="0"></div>
                <button class="lm-dropdown-add" onclick="${add}" tabindex="0"></button>
                <div class="lm-dropdown-header-controls">
                    <button onclick="self.reset" class="lm-dropdown-done">${T('Reset')}</button>
                    <button onclick="self.close" class="lm-dropdown-done">${T('Done')}</button>
                </div>
            </div>
            <div class="lm-dropdown-content">
                <div>
                    <div :loop="self.result" :ref="self.container" :rows="self.rows">
                        <div class="lm-dropdown-item" onclick="${select}" data-cursor="{{self.cursor}}" data-disabled="{{self.disabled}}" data-selected="{{self.selected}}" data-group="{{self.header}}">
                            <div><img :src="self.image" /> <div>{{self.text}}</div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    lemonade.setComponents({ Dropdown: Dropdown });

    lemonade.createWebComponent('dropdown', Dropdown);

    return function (root, options) {
        if (typeof (root) === 'object') {
            lemonade.render(Dropdown, root, options)
            return options;
        } else {
            return Dropdown.call(this, root)
        }
    }
//})));
})();
