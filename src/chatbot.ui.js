import * as chatbot from './chatbot.core.js';
import { createElement, addEvent, preventDefault, setClassName, toMenu, CLASS_PREFIX } from './chatbot.ui.utility.js';
import { resolve, toHtml } from './chatbot.ui.md.js';
import { SVG_SEND, SVG_NEW, SVG_CLOSE, SVG_COPY, SVG_DONE } from './chatbot.ui.icons.js';


const MAX_HEIGHT_OF_WIDGET_PERCENTAGE= 0.61;
const UI_THROTTLE_DELAY= 100; // in milliseconds
const DONE_DELAY= 2000; // in milliseconds; time of showing that an action like copy to clipboar has been done


/**
 * @typedef {Object} ChatbotUi
 * @property {chatbot.Observer} ...
 * @property {(str: string, smart?: boolean) => ChatbotUi} enter - Sets the input field value; with the `smart` option,
 *   the behavior depends on the state:
 *   - If the chat is empty, the value is send as user message instead.
 *   - If the chat contains an equal user message or the input field value ends with it, nothing happens.
 *   - Otherwise, it will be entered into the input field or - when the input field is not empty - added as new line
 * @property {function(boolean): ChatbotUi} typeEverywhere - Sets the type everywhere feature. When enabled, the input
 *   does not require to have the focus; disabled by default.
 * @property {function(('off'|'top'|'bottom')='top'): ChatbotUi} autoScrollType - Auto-scroll behavior:
 *   - 'off': Disables auto-scrolling.
 *   - 'top': Scrolls to the top.
 *   - 'bottom': Scrolls to the bottom.
 */

/**
 * @param {chatbot.Chatbot} chatbot
 * @param {Element} parent
 * @param {Object} config
 * @returns {ChatbotUi}
 */
export function chatbotUi(chatbot, parent, config) {

	/**
	 * @param {string} prop
	 */
	function getConfigString(prop, defaultValue) {
		return config && typeof config[prop] === 'string' ? config[prop] : (defaultValue ? defaultValue : '');
	}

	/**
	 * @param {Element} parent
	 * @param {string} id
	 * @param {string} defaultSvg
	 * @param {string} [defaultHover]
	 * @returns {Element}
	 */
	function createBtn(parent, id, defaultSvg, defaultHover) {
		const btn= createElement(parent, 'button', 'btn ' + id);
		btn.innerHTML= getConfigString(id + 'Btn', defaultSvg);
		if (defaultHover) {
			const hover= getConfigString(id + 'Hover', defaultHover);
			btn.alt= getConfigString(id + 'Alt', hover);
			btn.title= getConfigString(id + 'Title', hover);
		}
		return btn;
	}

	let _isSplash= true;
	let _isReadyToSend= true;
	let _isTypeEverywhere= false;
	let _autoScrollType= 'top';
	const _widget= createElement(parent, 'div', 'widget splash');
	if (!config || config.closeBtn || config.newBtn !== false) {
		const mbar= createElement(_widget, 'div', 'mbar');
		const mbarStart= createElement(mbar, 'div', 'start');
		createElement(mbar, 'div', 'center');
		const mbarEnd= createElement(mbar, 'div', 'end');
		if (!config || config.newBtn !== false) {
			const newBtn= createBtn(mbarStart, 'new', SVG_NEW, 'New chat');
			addEvent(newBtn, 'click', () => chatbot.reset());
		}
		if (config && config.closeBtn) {
			const closeBtn= createBtn(mbarEnd, 'close', SVG_CLOSE, 'Close chatbot');
			if (config && typeof config.closeFn === 'function') {
				addEvent(closeBtn, 'click', config.closeFn);
			}
		}
	}
	const main= createElement(_widget, 'div', 'main');
	const scroll= createElement(main, 'div', 'scroll');
	const sticky= createElement(main, 'div', 'sticky');
	const title= createElement(scroll, 'h1', 'title', getConfigString('title'));
	const _msgArea= createElement(createElement(scroll, 'div', 'chat-area'), 'div', 'chat');
	const options= chatbot.getOptions();
	const selected= {};
	const form= createElement(createElement(sticky, 'div', 'form-area'), 'form', 'form' + (options.length ? ' o' : ''));
	const _input= createElement(form, 'textarea', 'input');

	const _map= new Map();
	function getElementOfLastMessage() {
		for (let i= chatbot.messages.length - 1; i >= 0; i--) {
			const element= _map.get(chatbot.messages[i]);
			if (element) return element;
		}
		return undefined;
	}

	// Resize and auto-scroll as throttled function: will be invoked only once or twice every
	// THROTTLE_DELAY_MSEC: immediately and - if it has been called more than once - after THROTTLE_DELAY_MSEC
	// since the first call.
	/** @type {(callback: Function)
	 *          => (doResize: boolean, doScroll: boolean, doResizeAndScrollNext: boolean, element: Element, isScrollToElement: boolean) => void} */
	const _resizeAndScroll= ((callback) => {
		let isWaiting= false;
		let redoResize= false;
		let redoScroll= false;
		let resizeAndScrollNext= false;
		let scrollToElement= undefined;
		let redoScrollToElement= false;
		const scrollProgressHolder= {element: undefined, completed: true};

		/** @type {(doResize: boolean, doScroll: boolean, doResizeAndScrollNext: boolean, element: Element, isScrollToElement: boolean) => void} */
		return function(doResize, doScroll, doResizeAndScrollNext, element, isScrollToElement) {
			if (isScrollToElement && element) {
				scrollToElement= element;
				scrollProgressHolder.element= element;
				scrollProgressHolder.completed= false;
			}
			if (isWaiting) {
				redoResize= redoResize || doResize || doResizeAndScrollNext;
				redoScroll= redoScroll || doScroll || doResizeAndScrollNext;
				resizeAndScrollNext= false;
				redoScrollToElement= redoScrollToElement || (redoScroll && element && isScrollToElement);
				return;
			} else if (doResizeAndScrollNext) {
				resizeAndScrollNext= doResizeAndScrollNext;
				return;
			}
			isWaiting= true;
			const doBoth= resizeAndScrollNext;
			resizeAndScrollNext= false;
			callback(doResize || doBoth, doScroll || doBoth, isScrollToElement, scrollToElement, scrollProgressHolder);
			setTimeout(function() {
				while (redoResize || redoScroll) {
					const tempResize= redoResize;
					const tempScroll= redoScroll;
					const tempScrollToElement= redoScrollToElement;
					redoResize= false;
					redoScroll= false;
					redoScrollToElement= false;
					callback(tempResize, tempScroll, tempScrollToElement, scrollToElement, scrollProgressHolder);
				}
				isWaiting= false;
			}, UI_THROTTLE_DELAY);
		};

	})(function(doResize, doScroll, doScrollToElement, scrollToElement, scrollProgressHolder) {

		// First do resize, since scrolling might depend on it
		if (doResize) {

			// Temporarily remove height contrains to allow scrollHeight to be calculated correctly
			_input.style.maxHeight= 'none';
			_input.style.height= 'auto';

			// Comput and set height
			const maxHeight= parseInt((_widget.offsetHeight - title.offsetHeight) * MAX_HEIGHT_OF_WIDGET_PERCENTAGE);
			const neededHeight= _input.scrollHeight + 1;
			_input.style.height= `${Math.min(neededHeight, maxHeight)}px`;

			// Restore temporarily remove height contrains
			_input.style.maxHeight= '';

		}

		if (doScroll) {
			if (_autoScrollType == 'off') return;
			if (scrollToElement && typeof scrollToElement.scrollIntoView === 'function') {
				const bottomElement= getElementOfLastMessage();
				if (_autoScrollType == 'bottom') {
					scrollToElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
				} else if (scroll && bottomElement) {
					const availableSpace= _widget.clientHeight - sticky.getBoundingClientRect().height;
					const gapWithoutBottomMargin= bottomElement.parentNode.getBoundingClientRect().bottom - scrollToElement.getBoundingClientRect().top;
					const extraBottomMargin= availableSpace - gapWithoutBottomMargin;
					scroll.style.marginBottom= extraBottomMargin > 0 ? `${extraBottomMargin}px` : 0;
					if (doScrollToElement) {
						scrollToElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}
					if (extraBottomMargin <= 0 && scrollToElement && scrollToElement === scrollProgressHolder.element) {
						scrollProgressHolder.completed= true;
					}
				}
			}

		}

	});
	const optionsElements= [];
	const chatScopeOptions= [];
	if (options.length) {
		const optionsArea= createElement(form, 'div', 'options')
		for (const opt of options) {
			const select= createElement(optionsArea, 'div', 'select');
			let label;
			for (const item of opt.values) {
				if (!label || item.default) {
					label= item.label ? item.label : item.value;
					if (item.default) break;
				}
			}
			const button= createElement(select, 'button', 'btn ' + opt.id, label);
			if (typeof opt.description === 'string') {
				button.alt= opt.description;
				button.title= opt.description;
			}
			const dropdown= createElement(select, 'div', 'items');
			const itemElements= [];
			for (const item of opt.values) {
				itemElements.push(createElement(dropdown, 'button', undefined, item.label ? item.label : item.value));
			}
			dropdown.style.display= 'none';
			function openDropdown(state) {
				dropdown.style.display= state ? 'block' : 'none';
				setClassName(select, 'select' + (state ? ' o' : ''));
			}
			function toggleDropdown(e) {
				openDropdown(dropdown.style.display == 'none');
				preventDefault(e);
				return false;
			}
			addEvent(button, 'click', toggleDropdown);
			function chooseFn(value, silent) {
				selected[opt.id]= value.value;
				button.textContent= value.label ? value.label : value.value;
				if (!silent) {
					openDropdown();
				}
			}
			toMenu(button, itemElements, opt.values, chooseFn);
			optionsElements.push({
				reset: (function(id, values) {
					return function(options) {
						var newValue= options ? options[id] : undefined;
						for (var j= 0; j < values.length; j++) {
						var newValue= options ? options[id] : undefined;
							if (newValue == values[j].value || (newValue === undefined && values[j].default)) {
								chooseFn(values[j], true);
								return;
							}
						}
					};
				})(opt.id, opt.values)
			});
			if (opt.scope == 'chat') {
				chatScopeOptions.push(button);
			}
		}
	}
	const sendButton= createBtn(form, 'send', SVG_SEND);
	sendButton.name= 'send';
	sendButton.setAttribute('disabled', '');
	function _updateSendButtonEnablement() {
		if (_input.value.trim() === '' || !_isReadyToSend) {
			sendButton.setAttribute('disabled', '');
		} else {
			sendButton.removeAttribute('disabled');
		}
	}
	function sendAction(e) {
		if (_isReadyToSend) {
			const value= _input.value;
			_input.value= '';
			_updateSendButtonEnablement();
			_resizeAndScroll(false, false, true);
			chatbot.send(value, selected);
			if (_isTypeEverywhere) {
				_input.focus();
			}
		}
		preventDefault(e);
		return false;
	}
	addEvent(sendButton, 'click', sendAction);
	function inputKeyHandler(e) {
		return e.keyCode == 13 && !e.shiftKey ? sendAction(e) : true;
	};
	addEvent(_input, 'keypress', inputKeyHandler);
	addEvent(_input, 'input', () => {
		_updateSendButtonEnablement();
		_resizeAndScroll(true);
	});
	addEvent(window, 'resize', () => _resizeAndScroll(true));
	_input.rows= 1;
	_input.inputmode= 'text';
	_input.autocomplete= 'off';
	_input.placeholder= getConfigString('placeholder', 'Ask anything');
	_input.setAttribute('autofocus', '');
	const footer= createElement(sticky, 'footer', 'footer');
	footer.innerHTML= getConfigString('footerHtml');
	_resizeAndScroll(true);
	_input.focus();

	// Type everywhere feature support
	document.addEventListener('keydown', function(event) {
		if (!_isTypeEverywhere || event.ctrlKey || document.activeElement === _input) return;
		if (event.keyCode == 13) {
			if (event.shiftKey) {
				_input.value+= '\n';
				_resizeAndScroll(true);
				_input.scrollTop= _input.scrollHeight;
			} else {
				inputKeyHandler(event);
			}
			return;
		}
		let char= event.key;
		if (char === 'Backspace') {
			const currentValue= _input.value;
			_input.value= currentValue.slice(0, -1);
		} else if (char === 'Delete') {
			const currentValue= _input.value;
			_input.value= currentValue.substring(0, currentValue.length - 1);
		} else if (char.length === 1) {
			_input.value+= char;
		}
		_updateSendButtonEnablement();
	});

	/** @type {(changes: Array.<chatbot.Change>) => void} */
	function update(changes) {
		changes.forEach(change => {
			if (change.action == 'reset') {
				scroll.style.marginBottom= 0;
				_msgArea.innerHTML= '';
				_isReadyToSend= true;
				if (_input && getConfigString('placeholderFollowup')) {
					_input.placeholder= getConfigString('placeholder', 'Ask anything');
				}
				_isSplash= true;
				setClassName(_widget, 'widget splash');
			} else if (change.action == 'add') {
				let skip= false;
				if (_isSplash) {
					_isSplash= false;
					setClassName(_widget, 'widget');
					const followupPlaceholder= getConfigString('placeholderFollowup');
					if (_input && followupPlaceholder) {
						_input.placeholder= followupPlaceholder;
					}
					if (config && config.hideFirstMessage) {
						skip= true;
					}
				}
				if (!skip) {
					const role= change.msgObj.role;
					const message= change.msgObj.content;
					const msgContainer=
						createElement(_msgArea, 'div', 'msg-p role-' + role + (change.end ? ' done' : ''));
					msgContainer.setAttribute('tabindex', '-1'); // with that it can be activated by clicking on it (CSS selector: ...:focus-within)
					const plainText= role == 'user' ? message : undefined;
					const msgElement= createElement(msgContainer, 'div', 'msg' + (role == 'user' ? '' : ' md'), plainText);
					_map.set(change.msgObj, msgElement);
					if (message === undefined) {
						createElement(msgElement, 'p', 'wait');
					} else if (role != 'user') {
						let messageMd= message;
						if (change.msgObj.contentWithRefs && change.msgObj.refs) {
							messageMd= resolve(message, change.msgObj.contentWithRefs, change.msgObj.refs, {}, chatbot.config.refsBaseUrl);
						}
						msgElement.innerHTML= toHtml(messageMd);
					}
					const toolbar= createElement(msgContainer, 'div', 'tbar');
					const copyButton= createBtn(toolbar, 'copy', SVG_COPY, 'Copy');
					const copyButtonDefaultInner= copyButton.innerHTML;
					addEvent(copyButton, 'click', () => {
						navigator.clipboard.write([
							new ClipboardItem(
								role == 'user'
								? { 'text/plain': new Blob([change.msgObj.content], { type: 'text/plain' }) }
								: { 'text/plain': new Blob([change.msgObj.content], { type: 'text/plain' }),
									'text/html': new Blob([toHtml(change.msgObj.content)], { type: 'text/html' }) }
						)
						]).then(() => {
							copyButton.innerHTML= getConfigString('doneBtn', SVG_DONE);
							setTimeout(() => copyButton.innerHTML= copyButtonDefaultInner, DONE_DELAY);
						}).catch(() => {
							// TODO Error handling when failed to copy; maybe hide copy button
						});
					});
					if (config && typeof config.customizeMsgFn === 'function') {
						config.customizeMsgFn(toolbar, msgElement, role == 'user', change.msgObj);
					}
					_resizeAndScroll(false, true, false, msgElement, role == 'user');
				}
			} else if (change.action == 'readyToSend' && change.value !== undefined) {
				_isReadyToSend= change.value;
				_updateSendButtonEnablement();
			} else if (change.action == 'updateProperty' && change.property == 'content' && change.msgObj) {
				const streamElement= _map.get(change.msgObj);
				if (!streamElement || change.msgObj.content === undefined) return;
				if (streamElement._a != change.msgObj.content) {
					streamElement._a= change.msgObj.content;
					streamElement.innerHTML= toHtml(change.msgObj.content);
				}
				if (change.end) {
					streamElement.parentNode.className+= ' ' + CLASS_PREFIX + 'done';
				}
				_resizeAndScroll(false, true, false, streamElement, false);
			} else if (change.action == 'updateProperty' && change.property == 'contentWithRefs' && change.msgObj) {
				const streamElement= _map.get(change.msgObj);
				if (!streamElement || change.msgObj.content === undefined || change.msgObj.contentWithRefs === undefined || change.msgObj.refs === undefined) return;
				const groundedAnswer= resolve(change.msgObj.content, change.msgObj.contentWithRefs, change.msgObj.refs, {}, chatbot.config.refsBaseUrl);
				if (streamElement._a != groundedAnswer) {
					streamElement._a= groundedAnswer;
					streamElement.innerHTML= toHtml(groundedAnswer);
				}
				if (change.end) {
					streamElement.parentNode.className+= ' ' + CLASS_PREFIX + 'ref-done';
				}
				_resizeAndScroll(false, true, false, streamElement, false);
			} else if (change.action == 'sent') {
				if (change.msgObj) {
					optionsElements.forEach(element => element.reset(change.msgObj.options));
				}
			}
		});
		for (optionElement of chatScopeOptions) {
			if (_isSplash) {
				optionElement.removeAttribute('disabled');
			} else {
				optionElement.setAttribute('disabled', '');
			}
		}
	}

	/** @type {(str: string, smart?: boolean) => void} */
	function _enter(str, smart) {
		if (typeof str !== 'string') return;
		if (!smart) {
			_input.value= str;
		} else {
			const trimmed= str.trim();
			if (_input.value.trim().endsWith(trimmed)) return;
			for (const msgObj of chatbot.messages) {
			    if (msgObj.role === 'user' && typeof msgObj.content === 'string' && trimmed == msgObj.content.trim())
					return;
			}

			// Send?
			if (chatbot.messages.length === 0) {
				chatbot.send(str);
				return;
			}

			// Enter or append it to the input field
			if (_input.value.trim() == '') {
				_input.value= trimmed;
			} else {
				_input.value+= '\n' + trimmed;
			}
		}
		_updateSendButtonEnablement();
		_resizeAndScroll(true);
	}

	const ui= {
		update,
		enter: function(str, smart) {
			_enter(str, smart);
			return this;
		},
		focus: function() {
			_input.focus();
			return this;
		},
		autoScroll: function(autoScrollType) {
			_autoScrollType= autoScrollType;
			return this;
		},
		typeEverywhere: function(enbalement) {
			_isTypeEverywhere= enbalement;
			return this;
		}
	};
	chatbot.observe(ui);
	return ui;
}