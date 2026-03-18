import { lemonade } from './lemonadejs.js';
// https://cdn.jsdelivr.net/npm/@lemonadejs/modal/dist/index.js

///**
// * pin the modal to the left panel
// */
//if (!lemonade && typeof (require) === 'function') {
//    var lemonade = require('lemonadejs');
//}
//
//;(function (global, factory) {
//    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
//    typeof define === 'function' && define.amd ? define(factory) :
//    global.Modal = factory();
//}(this, (function () {
export const Modal= (function () {

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
            this.dispatchEvent(new CustomEvents(type, options));
        }
    }

    // References
    const modals = [];
    // State of the resize and move modal
    let state = {};
    // Internal controls of the action of resize and move
    let controls = {};
    // Width of the border
    let cornerSize = 10;
    // Container with minimized modals
    const minimizedModals = [];
    // Default z-index for the modals
    const defaultZIndex = 20;

    /**
     * Send the modal to the front
     * @param container
     */
    const sendToFront = function(container) {
        let highestXIndex = defaultZIndex;
        for (let i = 0; i < modals.length; i++) {
            const zIndex = parseInt(modals[i].el.style.zIndex);
            if (zIndex > highestXIndex) {
                highestXIndex = zIndex;
            }
        }
        container.style.zIndex = highestXIndex + 1;
    }

    /**
     * Send modal to the back
     * @param container
     */
    const sendToBack = function(container) {
        container.style.zIndex = defaultZIndex;
    }

    // Get the coordinates of the action
    const getCoords = function(e) {
        let x;
        let y;

        if (e.changedTouches && e.changedTouches[0]) {
            x = e.changedTouches[0].clientX;
            y = e.changedTouches[0].clientY;
        } else {
            x = e.clientX;
            y = e.clientY;
        }

        return [x,y];
    }

    // Get the button status
    const getButton = function(e) {
        e = e || window.event;
        if (e.buttons) {
            return e.buttons;
        } else if (e.button) {
            return e.button;
        } else {
            return e.which;
        }
    }

    // Finalize any potential action
    const mouseUp = function(e) {
        // Finalize all actions
        if (typeof(controls.action) === 'function') {
            controls.action();
        }
        setTimeout(function() {
            // Remove cursor
            if (controls.e) {
                controls.e.style.cursor = '';
            }
            // Reset controls
            controls = {};
            // Reset state controls
            state = {
                x: null,
                y: null,
            }
        }, 0)
    }

    const mouseMove = function(e) {
        if (! getButton(e)) {
            return false;
        }
        // Get mouse coordinates
        let [x,y] = getCoords(e);

        // Move modal
        if (controls.type === 'move') {
            if (state && state.x == null && state.y == null) {
                state.x = x;
                state.y = y;
            }

            let dx = x - state.x;
            let dy = y - state.y;
            let top = controls.e.offsetTop + dy;
            let left = controls.e.offsetLeft + dx;

            // Update position
            controls.top = top;
            controls.left = left;
            controls.e.style.top = top + 'px';
            controls.e.style.left = left + 'px';

            state.x = x;
            state.y = y;
            state.top = top;
            state.left = left;
        } else if (controls.type === 'resize') {
            let top = null;
            let left = null;
            let width = null;
            let height = null;

            if (controls.d === 'e-resize' || controls.d === 'ne-resize' || controls.d === 'se-resize') {
                width = controls.w + (x - controls.x);

                if (e.shiftKey) {
                    height = controls.h + (x - controls.x) * (controls.h / controls.w);
                }
            } else if (controls.d === 'w-resize' || controls.d === 'nw-resize'|| controls.d === 'sw-resize') {
                left = controls.l + (x - controls.x);
                // Do not move further
                if (left >= controls.l) {
                    left = controls.l;
                }
                // Update width
                width = controls.l + controls.w - left;
                // Consider shift to update height
                if (e.shiftKey) {
                    height = controls.h - (x - controls.x) * (controls.h / controls.w);
                }
            }

            if (controls.d === 's-resize' || controls.d === 'se-resize' || controls.d === 'sw-resize') {
                if (! height) {
                    height = controls.h + (y - controls.y);
                }
            } else if (controls.d === 'n-resize' || controls.d === 'ne-resize' || controls.d === 'nw-resize') {
                top = controls.t + (y - controls.y);
                // Do not move further
                if (top >= controls.t) {
                    top = controls.t;
                }
                // Update height
                height = controls.t + controls.h - top;
            }

            if (top) {
                controls.e.style.top = top + 'px';
            }
            if (left) {
                controls.e.style.left = left + 'px';
            }
            if (width) {
                controls.e.style.width = width + 'px';
            }
            if (height) {
                controls.e.style.height = height + 'px';
            }
        }
    }

    if (typeof(document) !== "undefined") {
        document.addEventListener('mouseup', mouseUp);
        document.addEventListener('mousemove', mouseMove);
    }

    const isTrue = function(e) {
        return e === true || e === 1 || e === 'true';
    }

    const refreshMinimized = function() {
        let items = minimizedModals;
        let numOfItems = items.length;
        let width = 10;
        let height = 55;
        let offsetWidth = window.innerWidth;
        let offsetHeight = window.innerHeight;
        for (let i = 0; i < numOfItems; i++) {
            let item = items[i];
            item.el.style.left = width + 'px';
            item.el.style.top = offsetHeight - height + 'px';
            width += 205;

            if (offsetWidth - width < 205) {
                width = 10;
                height += 50;
            }
        }
    }

    const delayAction = function(self, action) {
        // Make sure to remove the transformation before minimize to preserve the animation
        if (self.el.style.marginLeft || self.el.style.marginTop) {
            // Make sure no animation during this process
            self.el.classList.add('action');
            // Remove adjustment
            removeMargin(self);
            // Make sure to continue with minimize
            setTimeout(function() {
                // Remove class
                self.el.classList.remove('action');
                // Call action
                action(self);
            },0)

            return true;
        }
    }

    const setMini = function(self) {
        if (delayAction(self, setMini)) {
            return;
        }

        // Minimize modals
        minimizedModals.push(self);

        self.el.top = self.el.offsetTop;
        self.el.left = self.el.offsetLeft;

        if (! self.el.style.top) {
            self.el.style.top = self.el.top + 'px';
        }
        if (! self.el.style.left) {
            self.el.style.left = self.el.left + 'px';
        }

        self.el.translateY = 0;
        self.el.translateX = 0;

        // Refresh positions
        setTimeout(function() {
            refreshMinimized();
            self.minimized = true;
        },10)
    }

    const removeMini = function(self) {
        minimizedModals.splice(minimizedModals.indexOf(self), 1);
        self.minimized = false;
        self.el.style.top = self.el.top + 'px';
        self.el.style.left = self.el.left + 'px';
        // Refresh positions
        setTimeout(() => {
            refreshMinimized();
        }, 10);
        // Refresh positions
        setTimeout(() => {
            if (self.top === '') {
                self.el.style.top = '';
            }
            if (self.left === '') {
                self.el.style.left = '';
            }
        }, 400);
    }

    const removeMargin = function(self) {
        if (self.el.style.marginLeft) {
            let y = self.el.offsetLeft;
            self.el.style.marginLeft = '';
            self.left = y;
        }

        if (self.el.style.marginTop) {
            let x = self.el.offsetTop;
            self.el.style.marginTop = '';
            self.top = x;
        }
    }

    const adjustHorizontal = function(self) {
        if (! isTrue(self['auto-adjust'])) {
            return false;
        }

        self.el.style.marginLeft = '';
        let viewportWidth = window.innerWidth;
        let margin = 10;

        if (self.position) {
            if (self.position === 'absolute') {
                let w = document.documentElement.offsetWidth;
                if (w > viewportWidth) {
                    //viewportWidth = w;
                }
            } else if (self.position !== 'center') {
                margin = 0;
            }
        }

        let el = self.el.getBoundingClientRect();

        let rightEdgeDistance = viewportWidth - (el.left + el.width);
        let transformX = 0;

        if (self.position === 'absolute') {
            if (rightEdgeDistance < 0) {
                transformX = rightEdgeDistance - margin - 10; // 10 is the scroll width
            }
        } else {
            if (rightEdgeDistance < 0) {
                transformX = rightEdgeDistance - margin;
            }
        }

        if (el.left < 0) {
            transformX = margin - el.left;
        }
        if (transformX !== 0) {
            self.el.style.marginLeft = transformX + 'px';
        }
    }

    const adjustVertical = function(self) {
        if (! isTrue(self['auto-adjust'])) {
            return false;
        }

        self.el.style.marginTop = '';
        let viewportHeight = window.innerHeight;
        let margin = 10;

        if (self.position) {
            if (self.position === 'absolute') {
                let h = document.documentElement.offsetHeight;
                if (h > viewportHeight) {
                    //viewportHeight = h;
                }
            } else if (self.position !== 'center') {
                margin = 0;
            }
        }

        let el = self.el.getBoundingClientRect();

        let bottomEdgeDistance = viewportHeight - (el.top + el.height);
        let transformY = 0;

        if (self.position === 'absolute') {
            if (bottomEdgeDistance < 5) {
                transformY = (-1 * el.height) - margin - 12;
                if (el.top + transformY < 0) {
                    transformY = -el.top + 10;
                }
            }
        } else {
            if (bottomEdgeDistance < 0) {
                transformY = bottomEdgeDistance - margin;
            }
        }

        if (el.top < 0) {
            transformY = margin - el.top;
        }
        if (transformY !== 0) {
            self.el.style.marginTop = transformY + 'px';
        }
    }

    const removeElements = function(root) {
        // Keep the DOM elements
        let elements = [];
        if (root) {
            while (root.firstChild) {
                elements.push(root.firstChild);
                root.firstChild.remove();
            }
        }
        return elements;
    }

    const appendElements = function(root, elements) {
        if (elements && elements.length) {
            while (elements[0]) {
                root.appendChild(elements.shift());
            }
        }
    }

    const Modal = function (template, { onchange, onload, track }) {
        let self = this;
        let backdrop = null;
        let elements = null;

        if (this.tagName) {
            // Remove elements from the DOM
            elements = removeElements(this);

            this.addEventListener('dragstart', (e) => {
                e.preventDefault();
            });
        }

        // Make sure keep the state as boolean
        self.closed = !! self.closed;

        // Keep all modals references
        modals.push(self);

        // External onload remove from the lifecycle
        let change = self.onchange;
        self.onchange = null;

        let load = self.onload;
        self.onload = null;

        let ignoreEvents = false;

        const click = function(e) {
            if (e.target.classList.contains('lm-modal-close')) {
                self.close({ origin: 'button' });
            }

            if (e.target.classList.contains('lm-modal-minimize')) {
                // Handles minimized modal positioning
                if (self.minimized === true) {
                    removeMini(self);
                } else {
                    setMini(self);
                }
            }
        }

        const mousemove = function(e) {
            if (getButton(e)) {
                return;
            }

            // Get mouse coordinates
            let [x,y] = getCoords(e);
            // Root element of the component
            let item = self.el;
            // Get the position and dimensions
            let rect = item.getBoundingClientRect();

            controls.type = null;
            controls.d = null;
            controls.e = item;
            controls.w = rect.width;
            controls.h = rect.height;
            controls.t = rect.top;
            controls.l = rect.left;

            // When resizable
            if (isTrue(self.resizable)) {
                if (e.clientY - rect.top < cornerSize) {
                    if (rect.width - (e.clientX - rect.left) < cornerSize) {
                        item.style.cursor = 'ne-resize';
                    } else if (e.clientX - rect.left < cornerSize) {
                        item.style.cursor = 'nw-resize';
                    } else {
                        item.style.cursor = 'n-resize';
                    }
                } else if (rect.height - (e.clientY - rect.top) < cornerSize) {
                    if (rect.width - (e.clientX - rect.left) < cornerSize) {
                        item.style.cursor = 'se-resize';
                    } else if (e.clientX - rect.left < cornerSize) {
                        item.style.cursor = 'sw-resize';
                    } else {
                        item.style.cursor = 's-resize';
                    }
                } else if (rect.width - (e.clientX - rect.left) < cornerSize) {
                    item.style.cursor = 'e-resize';
                } else if (e.clientX - rect.left < cornerSize) {
                    item.style.cursor = 'w-resize';
                } else {
                    item.style.cursor = '';
                }

                if (item.style.cursor) {
                    controls.type = 'resize';
                    controls.d = item.style.cursor;
                } else {
                    controls.type = null;
                    controls.d = null;
                }
            }

            if (controls.type == null && isTrue(self.draggable)) {
                if (y - rect.top < 40) {
                    item.style.cursor = 'move';
                } else {
                    item.style.cursor = '';
                }

                if (item.style.cursor) {
                    controls.type = 'move';
                    controls.d = item.style.cursor;
                } else {
                    controls.type = null;
                    controls.d = null;
                }
            }
        }

        const mousedown = function(e) {
            if (! self.minimized) {
                // Get mouse coordinates
                let [x,y] = getCoords(e);
                controls.x = x;
                controls.y = y;
                // Root element of the component
                let item = self.el;
                // Get the position and dimensions
                let rect = item.getBoundingClientRect();
                controls.e = item;
                controls.w = rect.width;
                controls.h = rect.height;
                controls.t = rect.top;
                controls.l = rect.left;
                // If is not minimized
                if (controls.type === 'resize') {
                    // Make sure the width and height is defined for the modal
                    if (! item.style.width) {
                        item.style.width = controls.w + 'px';
                    }
                    if (! item.style.height) {
                        item.style.height = controls.h + 'px';
                    }
                    // This will be the callback when finalize the resize
                    controls.action = function () {
                        self.width = parseInt(item.style.width);
                        self.height = parseInt(item.style.height);
                        controls.e.classList.remove('action');
                        // Event
                        Dispatch.call(self, self.onresize, 'resize', {
                            instance: self,
                            width: self.width,
                            height: self.height,
                        });
                    }
                    controls.e.classList.add('action');
                } else if (isTrue(self.draggable) && y - rect.top < 40) {
                    // Callback
                    controls.action = function () {
                        self.top = parseInt(item.style.top);
                        self.left = parseInt(item.style.left);
                        controls.e.classList.remove('action');
                        // Open event
                        Dispatch.call(self, self.onmove, 'move', {
                            instance: self,
                            top: self.top,
                            left: self.left,
                        });
                    }
                    controls.e.classList.add('action');
                    // Remove transform
                    removeMargin(self);
                }
            }
        }

        self.back = function() {
            sendToBack(self.el);
        }

        self.front = function() {
            sendToFront(self.el);
        }

        self.open = function() {
            if (self.closed === true) {
                self.closed = false;
                // Close event
                Dispatch.call(self, self.onopen, 'open', {
                    instance: self
                });
            }
        }

        self.close = function(options) {
            if (self.closed === false) {
                self.closed = true;
                // Close event
                Dispatch.call(self, self.onclose, 'close', {
                    instance: self,
                    ...options
                });
            }
        }

        self.isClosed = function() {
            return self.closed;
        }

        if (! template || typeof(template) !== 'string') {
            template = '';
        }

        // Custom Root Configuration
        self.settings = {
            getRoot: function() {
                return self.root;
            }
        }

        // Native lemonade
        onload(() => {
            // Dimensions
            if (self.width) {
                self.el.style.width = self.width + 'px';
            }
            if (self.height) {
                self.el.style.height = self.height + 'px';
            }
            // Position
            if (self.top) {
                self.el.style.top = self.top + 'px';
            }
            if (self.left) {
                self.el.style.left = self.left + 'px';
            }

            if (self.position === 'absolute' || self.position === 'right' || self.position === 'bottom' || self.position === 'left') {

            } else {
                if (!self.width && self.el.offsetWidth) {
                    self.width = self.el.offsetWidth;
                }
                if (!self.height && self.el.offsetHeight) {
                    self.height = self.el.offsetHeight;
                }

                // Initial centralize
                if (self.position === 'center' || !self.top) {
                    self.top = (window.innerHeight - self.height) / 2;
                }
                if (self.position === 'center' || !self.left) {
                    self.left = (window.innerWidth - self.width) / 2;
                }

                // Responsive
                if (document.documentElement.clientWidth < 800) {
                    // Full screen
                    if (self.height > 300) {
                        self.el.classList.add('fullscreen');
                    }
                }
            }

            // Auto adjust
            adjustHorizontal(self);
            adjustVertical(self);

            // Backdrop
            if (self.backdrop === true) {
                backdrop = document.createElement('div');
                backdrop.classList.add('lm-modal-backdrop');
                backdrop.addEventListener('click', () => {
                    self.close({ origin: 'backdrop' });
                });

                if (self.closed === false) {
                    self.el.parentNode.insertBefore(backdrop, self.el);
                }
            }

            // Import content from DOM
            if (self.content) {
                if (typeof(self.content) === 'string') {
                    template = self.content;
                } else if (typeof(self.content) === 'object' && self.content.tagName) {
                    self.root.appendChild(self.content);
                }
            }

            // Focus out of the component
            self.el.addEventListener('focusout', function(e) {
                if (! self.el.contains(e.relatedTarget)) {
                    if (isTrue(self['auto-close'])) {
                        self.close({ origin: 'focusout' });
                    }
                    // Remove focus
                    self.el.classList.remove('lm-modal-focus');
                }
            });

            // Focus out of the component
            self.el.addEventListener('focusin', function(e) {
                self.el.classList.add('lm-modal-focus');
            });

            // Close and stop propagation
            self.el.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    if (self.closed === false) {
                        self.close({ origin: 'escape' });
                        e.preventDefault();
                        e.stopImmediatePropagation();
                    }
                } else if (e.key === 'Enter') {
                    click(e);
                }
            });

            // Append elements to the container
            appendElements(self.el.children[1], elements);

            if (self.url) {
                fetch(self.url)
                    .then(response => response.clone().body)
                    .then(body => {
                        let reader = body.getReader();
                        reader.read().then(({ done, value }) => {
                            // Add HTML to the modal
                            self.root.innerHTML = new TextDecoder().decode(value.buffer);
                            // Call onload event
                            Dispatch.call(self, load, 'load', {
                                instance: self
                            });
                        });
                    });
            } else {
                // Call onload event
                Dispatch.call(self, load, 'load', {
                    instance: self
                });
            }
        });

        onchange((property) => {
            if (ignoreEvents) {
                return false;
            }

            if (property === 'closed') {
                if (self.closed === false) {
                    // Focus on the modal
                    if (self.focus !== false) {
                        self.el.focus();
                    }
                    // Show backdrop
                    if (backdrop) {
                        self.el.parentNode.insertBefore(backdrop, self.el);
                    }

                    // Auto adjust
                    queueMicrotask(() => {
                        adjustHorizontal(self);
                        adjustVertical(self);
                    });
                } else {
                    // Hide backdrop
                    if (backdrop) {
                        backdrop.remove();
                    }
                }
            } else if (property === 'top' || property === 'left' || property === 'width' || property === 'height') {
                if (self[property] !== '') {
                    self.el.style[property] = self[property] + 'px';
                } else {
                    self.el.style[property] = '';
                }

                if (self.closed === false) {
                    queueMicrotask(() => {
                        if (property === 'top') {
                            adjustVertical(self);
                        }
                        if (property === 'left') {
                            adjustHorizontal(self);
                        }
                    });
                }
            } else if (property === 'position') {
                if (self.position) {
                    if (self.position === 'center') {
                        self.top = (window.innerHeight - self.el.offsetHeight) / 2;
                        self.left = (window.innerWidth - self.el.offsetWidth) / 2;
                    } else {
                        self.top = '';
                        self.left = '';
                    }
                } else {
                    if (! self.top) {
                        self.top = (window.innerHeight - self.el.offsetHeight) / 2;
                    }
                    if (! self.left) {
                        self.left = (window.innerWidth - self.el.offsetWidth) / 2;
                    }
                }
            }
        });

        track('top');
        track('left');
        track('width');
        track('height');

        return render => render`<div class="lm-modal" animation="{{self.animation}}" position="{{self.position}}" closed="{{self.closed}}" closable="{{self.closable}}" minimizable="{{self.minimizable}}" minimized="{{self.minimized}}" overflow="{{self.overflow}}" tabindex="-1" role="modal" onmousedown="${mousedown}" onmousemove="${mousemove}" onclick="${click}">
            <div class="lm-modal-title" data-title="{{self.title}}" data-icon="{{self.icon}}"><div class="lm-modal-icon">{{self.icon}}</div><div>{{self.title}}</div><div class="lm-modal-icon lm-modal-minimize" tabindex="0"></div><div class="lm-modal-icon lm-modal-close" tabindex="0"></div></div>
            <div :ref="self.root">${template}</div>
        </div>`
    }

    const Component = function (root, options) {
        if (typeof(root) === 'object') {
            // Remove elements from the DOM
            let elements = removeElements(root);
            // Create the modal
            let e = lemonade.render(Modal, root, options);
            // Add elements to the container
            appendElements(e.children[1], elements);

            return options;
        } else {
            return Modal.call(this);
        }
    }

    // Create LemonadeJS Component
    lemonade.setComponents({ Modal: Modal });
    // Create Web Component
    lemonade.createWebComponent('modal', Modal)

    return Component;
//})));
})();