export const CLASS_PREFIX= '-c-';

/**
 * Creates and appends a new DOM element to a specified parent.
 *
 * @param {Element | undefined} parent - The parent DOM element to which the new element will be appended.
 * @param {string} [name='div'] - The name of the element to create.
 * @param {string} [className=''] - Space-separated list of class names without CLASS_PREFIX to assign with CLASS_PREFIX
 *								  to the new element.
 * @param {string} [text=''] - Optional text content to set for the new element.
 * @returns {Element}
 */
export function createElement(parent, name, className, text) {
	var element = document.createElement(name ? name : 'div');
	if (parent) {
		parent.appendChild(element);
	}
	if (className) {
		setClassName(element, className);
	}
	if (text) {
		element.appendChild(document.createTextNode(text));
	}
	return element;
}

/**
 * @param {Element} element
 * @param {string} value
 */
export function setClassName(element, value) {
	element.className = value == '' ? '' : CLASS_PREFIX + value.replace(/\s+/g, ' ' + CLASS_PREFIX);
	return element;
}

/**
 * @param {Element} element
 * @param {string} type
 * @param {Function} fn
 */
export function addEvent(element, type, fn) {
	if (element.addEventListener) {
		element.addEventListener(type, fn, false);
	} else if (element.attachEvent) {
		element['e' + type + fn] = fn;
		element[type + fn] = function() {
			element['e' + type + fn](window.event);
		}
		element.attachEvent('on' + type, element[type + fn]);
	}
}

export function preventDefault(e) {
	e = e || window.event;
	if (!e) return;
	try {
		if (e.preventDefault) e.preventDefault();
		e.returnValue = false;
	} catch(e) {}
}

export function stopPropagation(e) {
	e= e || window.event;
	if (!e) return;
	e.cancelBubble = true;
	if (e.stopPropagation) e.stopPropagation();
}

export function toMenu(master, items, data, chooseFn, applyFn, cancelFn, armFn) {
    //var isNotInputField = master.nodeName != 'INPUT';
    var cursorIndex = 0;
    var isInit = 0;
    master.onkeydown = function(e) {
        e = e || window.event;
        var key = e.keyCode || e.charCode;

        if (   cursorIndex > 0
            && getClassName(items[cursorIndex-1]) == items[cursorIndex-1].z) {
            cursorIndex = 0;
        }

        // RIGHT (key: 39) or TAB without SHIFT (key: 9) to apply
        if (applyFn && (key == 39 || (key == 9 && !e.shiftKey))) {
            if (applyFn(data, key)) preventDefault(e);
        }

        // ESC to cancel
        if (cancelFn && key == 27) {
            cancelFn();
            preventDefault(e);
            return;
        }

        // ENTER to choose
        if (key == 13 && cursorIndex > 0) {
            preventDefault(e);
            stopPropagation(e);
            setClassName(items[cursorIndex-1], items[cursorIndex-1].z);
            chooseFn(data[cursorIndex-1]);
            cursorIndex = 0;
			return;
        }

        // select by UP and DOWN
        if (key != 40 && key != 38) return;
        preventDefault(e);
        var isDown = key == 40;
        if (cursorIndex > 0) {
            setClassName(items[cursorIndex-1], items[cursorIndex-1].z);
        }
        cursorIndex = cursorIndex < 1
                      ? (isDown ? 1 : items.length)
                      : (cursorIndex + (isDown ? 1 : -1)) % (items.length + 1);
        if (cursorIndex > 0) {
           var item = items[cursorIndex-1];
           setClassName(item, item.z == '' ? 'active' : item.z + ' active');
           if (armFn) armFn(item, data[cursorIndex-1], 0);
        }
    }
    for (var i = 0; i < items.length; i++) {
        items[i].z = getClassName(items[i]);
        items[i].onmousedown = function() {setTimeout(function() {if (master && !master.hasFocus) master.focus()}, 42)};
        items[i].onmouseup = items[i].ontouchend = function(a, b) {return function(e) {preventDefault(e); if (!a.canceled) {chooseFn(b); setClassName(a, a.z); cursorIndex = 0}}}(items[i], data[i]);
        items[i].onmouseover = items[i].ontouchstart = function(a, b, c) {return function() {if (!isInit) return; if (cursorIndex > 0) setClassName(items[cursorIndex-1], items[cursorIndex-1].z); setClassName(a, a.z == '' ? 'active' : a.z + ' active'); cursorIndex = b; a.canceled = ''; if (armFn && b > 0) armFn(a, c, 1)}}(items[i], i+1, data[i]);
        items[i].onmouseout = function(a) {return function() {setClassName(a, a.z)}}(items[i]);
		addEvent(items[i], 'click', e => {preventDefault(e); return false;});
    }
    setTimeout(function() {isInit = 1; }, 142);
}

/**
 * @param {Element} element
 * @param {string} attribute
 * @param {string} value
 */
function setAttribute(element, attribute, value) {
	element.setAttribute(attribute, value);
	return element;
}

function getClassName(element) {
    return element.className;
}