import * as chatbot from './chatbot.core.js';
import { createElement, addEvent, preventDefault, setClassName, UNDEFINED, CLASS_PREFIX } from './chatbot.ui.utility.js';
import { resolve, mdToHtml, renderMd } from './chatbot.ui.md.js';
import { SVG_SEND, SVG_NEW, SVG_CLOSE, SVG_COPY, SVG_DONE, SVG_SIDEBAR, SVG_FOLD, SVG_TRY_AGAIN, SVG_ATTACH, SVG_REMOVE } from './chatbot.ui.icons.js';
import { Dropdown } from './lemonadejs.dropdown.js';

const MAX_HEIGHT_OF_WIDGET_PERCENTAGE= 0.61;
const UI_THROTTLE_DELAY= 100; // in milliseconds
const DONE_DELAY= 2000; // in milliseconds; time of showing that an action like copy to clipboar has been done
const ERROR_MESSAGE_DEFAULT= 'Something went wrong.';
const ERROR_RETRY_BUTTON_TEXT_DEFAULT= 'Retry';
const HISTORY_FOOTER_DEFAULT= 'Your chats are saved locally in your browser\'s IndexedDB.';
const QUESTION_NAV_THRESHOLD_DEFAULT= 4; // number of user questions before the navigation rail appears
const ANIMATION_DELAY_DEFAULT= 16; // in milliseconds; 60hz ~ 16.67ms

/**
 * @typedef {Object} ChatbotUi
 * @property {(str: string, smart?: boolean) => ChatbotUi} enter - Sets the input field value; with the `smart` option,
 *   the behavior depends on the state:
 *   - If the chat is empty, the value is send as user message instead.
 *   - If the chat contains an equal user message or the input field value ends with it, nothing happens.
 *   - Otherwise, it will be entered into the input field or - when the input field is not empty - added as new line
 * @property {(isTypeEverywhere: boolean) => ChatbotUi} typeEverywhere - Sets the type everywhere feature.
 *   When enabled, the input does not require to have the focus; disabled by default.
 * @property {(autoScrollType: 'top' | 'bottom' | 'off') => ChatbotUi} autoScroll - Auto-scroll behavior:
 *   - 'top' (default): Scrolls to the top.
 *   - 'bottom': Scrolls to the bottom.
 *   - 'off': Disables auto-scrolling.
 * @property {() => ChatbotUi} focus
 */

/**
 * @param {chatbot.Chatbot} chatbot
 * @param {Element} parent
 * @param {Object} config
 * @returns {ChatbotUi}
 */
export function chatbotUi(chatbot, parent, config) {
	let _isSplash= true;
	let _isReadyToSend= true;
	let _isWaitingToSend= false;
	let _isTypeEverywhere= false;
	let _autoScrollType= 'top';
	let _refsMapByMsgObj= new Map();
	let _toolbarByMsgObj= new Map();
	let _sourcesBtnByMsgObj= new Map();
	let _sourcesSidebar;
	let _sourcesSidebarcloseBtn;
	let _sourcesSidebarContent;
	let _sourcesSidebarMsgObj;
	let _sourcesSidebarState;

	// Question navigation rail (clickable anchors for user questions)
	let _qnavRail;
	let _qnavList;
	let _qnavItems= [];
	let _qnavActiveTicking= false;

	// Floating tooltip (added to the body to escape the constraints of overflow: hidden)
	let _tooltipTarget= null;
	const _tooltip= document.createElement('div');
	_tooltip.className= CLASS_PREFIX + 'tooltip';
	_tooltip.hidden= true;
	document.body.appendChild(_tooltip);
	function showFloatingTooltip(btn) {
		const text= btn.getAttribute('data-tooltip');
		if (!text) return;
		_tooltipTarget= btn;
		_tooltip.textContent= text;
		const rect= btn.getBoundingClientRect();
		_tooltip.style.top= (rect.bottom + 5) + 'px';
		_tooltip.style.left= rect.right + 'px';
		_tooltip.hidden= false;
	}
	function hideFloatingTooltip() {
		_tooltipTarget= null;
		_tooltip.hidden= true;
	}
	function attachFloatingTooltip(btn) {
		addEvent(btn, 'mouseenter', () => showFloatingTooltip(btn));
		addEvent(btn, 'mouseleave', () => hideFloatingTooltip());
	}

	const _widget= createElement(parent, 'div', 'widget splash');
	const newBtnToAdd= !config || config.newBtn !== false;
	function addNewBtn(newBtnParent) {
		const newBtn= createBtn(newBtnParent, 'new', SVG_NEW, 'New chat');
		addEvent(newBtn, 'click', () => chatbot.reset());
	}
	let _historySidebar;
	let _historyInitExpand= false;
	function expandHistorySidebar(expand) {
		if (!_historySidebar) return;
		const newState = expand || (expand === undefined && _historySidebar.getAttribute('aria-expanded') !== 'true');
		_historyInitExpand||= newState;
		_historySidebar.setAttribute('aria-expanded', newState);
	}
	function updateHistorySidebar() {
		if (!_historySidebar || !chatbot.history) return;
		_historySidebar.innerHTML= '';
		const buttonsDiv= createElement(_historySidebar, 'div', 'hbtns');
		const sidebarBtn= createBtn(buttonsDiv, 'sidebar', SVG_SIDEBAR, 'Open sidebar');
		addEvent(sidebarBtn, 'click', () => {
			expandHistorySidebar();
		});
		if (newBtnToAdd) {
			addNewBtn(buttonsDiv);
		}
		const historyList= createElement(_historySidebar, 'div', 'hlist');
		const note= getConfigString('historyFooter', HISTORY_FOOTER_DEFAULT);
		if (note) {
			createElement(_historySidebar, 'div', 'hfooter', note);
		}
		/** @type {HTMLButtonElement} */ // @ts-ignore
		const deleteAllBtn= createElement(
			createElement(_historySidebar, 'div', 'hdelall'), 'button', 'btn', 'Delete All');
		deleteAllBtn.title= 'Delete all chats';
		addEvent(deleteAllBtn, 'click', () => {
			chatbot.history?.removeAll().then(() => updateHistorySidebar());
		});
		deleteAllBtn.disabled= true;
		chatbot.history.list().then((descs) => {
			for (let i= descs.length; i > 0; i--) {
				const historyItem= createElement(historyList, 'div', 'hitm');
				const desc= descs[i - 1];
				const btn= createElement(historyItem, 'button', 'btn hname', desc.name);
				if (desc.name) {
					btn.title= desc.name;
				}
				addEvent(btn, 'click', () => {
					chatbot.history?.get(desc).then((messages) => {
						chatbot.reset(messages, false, desc);
					}).catch(_ => {}); // TODO: Show error message (currently, nothing happens)
				});
				const delBtn= createElement(historyItem, 'button', 'btn hdel', 'x');
				if (desc.name) {
					delBtn.title= 'Delete: ' + desc.name;
				}
				addEvent(delBtn, 'click', () => {
					chatbot.history?.remove(desc).then(() => updateHistorySidebar());
				});
			}
			if (descs.length) {
				deleteAllBtn.disabled= false;
			}
		});
	}
	if (chatbot.history) {
		_historySidebar= createElement(_widget, 'aside', 'history');
		expandHistorySidebar(false);
		updateHistorySidebar();
	}
	const _mainP= createElement(_widget, 'div', 'root');
	if (!config || config.closeBtn || (newBtnToAdd && !_historySidebar)) {
		const mbar= createElement(_mainP, 'div', 'mbar');
		const mbarStart= createElement(mbar, 'div', 'start');
		createElement(mbar, 'div', 'center');
		const mbarEnd= createElement(mbar, 'div', 'end');
		if (newBtnToAdd && !_historySidebar) {
			addNewBtn(mbarStart);
		}
		if (config && config.closeBtn) {
			const closeBtn= createBtn(mbarEnd, 'close', SVG_CLOSE, 'Close chatbot');
			if (config && typeof config.closeFn === 'function') {
				addEvent(closeBtn, 'click', config.closeFn);
			}
		}
	}
	const main= createElement(_mainP, 'div', 'main');

	const scroll= createElement(main, 'div', 'scroll');
	const sticky= createElement(main, 'div', 'sticky');
	const title= createElement(scroll, 'h1', 'title', getConfigString('title'));
	const titleHtml= getConfigString('titleHtml');
	if (titleHtml) {
		title.innerHTML= titleHtml;
	}
	const _msgArea= createElement(scroll, 'div', 'chat');
	const form= createElement(createElement(sticky, 'div', 'form-area'), 'form', 'form');
	if (getConfigBoolean('questionNav', true)) {
		_qnavRail= createElement(_mainP, 'nav', 'qnav');
		_qnavRail.setAttribute('aria-label', 'Chat questions');
		_qnavRail.hidden= true;
		_qnavList= createElement(_qnavRail, 'div', 'qnav-list');
		addEvent(main, 'scroll', scheduleQuestionNavActiveUpdate);
	}

	// Attaching/uploading
	const _attachSupported= getConfigBoolean('attach');
	const _attachAccept= getConfigString('attachAccept', 'image/*');
	const _attachMax= getConfigNumber('attachMax', -1);
	const _attachOnlyRequest= getConfigBoolean('attachOnlyRequest', true);
	/** @type {chatbot.ContentArray} */
	const _attached= [];
	let _attachQueue= Promise.resolve();
	const _attachedArea= _attachSupported ? createElement(form, 'div', 'thumbs') : UNDEFINED;
	if (_attachedArea) {
		const button= createBtn(form, 'attach', SVG_ATTACH, 'Attach an image');
		/** @type {HTMLInputElement} */ // @ts-ignore
		const picker= createElement(form, 'input', 'file');
		picker.type= 'file';
		picker.hidden= true;
		if (_attachMax < 0 || _attachMax > 1) {
			picker.multiple= true;
		}
		if (_attachAccept) {
			picker.accept= _attachAccept;
		}
		addEvent(button, 'click', (/** @type {Event} */ e) => { preventDefault(e); picker.click(); });
		addEvent(picker, 'change', () => {
			if (!picker.files) return;
			for (const file of picker.files) {
				attachImageFile(file);
			}
			picker.value= '';
		});
		clearAttached();

		// Paste images via Ctrl+V
		addEvent(_widget, 'paste', (/** @type {ClipboardEvent} */ e) => {
			const files= getImagesFromClipboard(e.clipboardData);
			if (!files.length) return;
			preventDefault(e);
			for (const file of files) {
				attachImageFile(file);
			}
		});

	}
	function clearAttached() {
		_attached.splice(0);
		if (_attachedArea) {
			_attachedArea.innerHTML= '';
			_attachedArea.hidden= true;
		}
	}

	/** @type {Record<string, unknown>} */
	const selected= {};

	/** @type {HTMLTextAreaElement} */ // @ts-ignore
	const _input= createElement(form, 'textarea', 'input');

	const _map= new Map();
	const _errorObj= {};

	function getElementOfLastMessage() {
		for (let i= chatbot.messages.length - 1; i >= 0; i--) {
			const element= _map.get(chatbot.messages[i]);
			if (element) return element;
		}
		return undefined;
	}

	function prefersReducedMotion() {
		return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/**
	 * Adds a clickable anchor for a user question to the navigation rail.
	 * @param {chatbot.MessageObject} msgObj
	 * @param {Element} container - the message container to scroll to
	 * @param {string} text - the question text shown on hover
	 */
	function addQuestionNavItem(msgObj, container, text) {
		if (!_qnavList) return;
		const label= typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : '';
		/** @type {HTMLButtonElement} */ // @ts-ignore
		const item= createElement(_qnavList, 'button', 'qnav-item');
		item.type= 'button';
		item.setAttribute('aria-label', label);
		createElement(item, 'span', 'qnav-dash');
		createElement(item, 'span', 'qnav-label', label);
		addEvent(item, 'click', () => {
			setActiveQuestionNavItem(item);
			if (typeof container.scrollIntoView === 'function') {
				container.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
			}
		});
		_qnavItems.push({ msgObj: msgObj, container: container, item: item });
	}

	function updateQuestionNavVisibility() {
		if (!_qnavRail) return;
		const threshold= getConfigNumber('questionNavThreshold', QUESTION_NAV_THRESHOLD_DEFAULT);
		const visible= _qnavItems.length >= threshold;
		_qnavRail.hidden= !visible;
	}

	function clearQuestionNav() {
		if (!_qnavRail) return;
		_qnavItems= [];
		_qnavList.innerHTML= '';
		_qnavRail.hidden= true;
	}

	/**
	 * @param {HTMLElement} activeItem
	 */
	function setActiveQuestionNavItem(activeItem) {
		const activeClass= CLASS_PREFIX + 'active';
		for (const entry of _qnavItems) {
			if (entry.item === activeItem) {
				entry.item.classList.add(activeClass);
				entry.item.setAttribute('aria-current', 'true');
			} else {
				entry.item.classList.remove(activeClass);
				entry.item.removeAttribute('aria-current');
			}
		}
	}

	// Highlights the rail anchor of the question currently at/above the top of the viewport.
	function updateQuestionNavActive() {
		if (!_qnavRail || _qnavRail.hidden || !_qnavItems.length) return;
		const boundary= main.getBoundingClientRect().top + 8;
		let active= _qnavItems[0].item;
		for (const entry of _qnavItems) {
			if (entry.container.getBoundingClientRect().top - boundary <= 1) {
				active= entry.item;
			} else {
				break;
			}
		}
		setActiveQuestionNavItem(active);
	}

	function scheduleQuestionNavActiveUpdate() {
		if (_qnavActiveTicking) return;
		_qnavActiveTicking= true;
		const run= () => { _qnavActiveTicking= false; updateQuestionNavActive(); };
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(run);
		} else {
			setTimeout(run, ANIMATION_DELAY_DEFAULT);
		}
	}

	/**
	 * Resize and auto-scroll as throttled function: will be invoked only once or twice every THROTTLE_DELAY_MSEC:
	 * immediately and - if it has been called more than once - after THROTTLE_DELAY_MSEC since the first call.
	 *
	 * @type {(doResize: boolean, doScroll?: boolean, doResizeAndScrollNext?: boolean,
	 *         element?: Element, isScrollToElement?: boolean) => void}
	 */
	const _resizeAndScroll= ((callback) => {
		let isWaiting= false;
		let resizeAndScrollNext= false;
		let scrollToElement= undefined;
		/** @type {boolean | undefined} */ let redoResize= false;
		/** @type {boolean | undefined} */ let redoScroll= false;
		/** @type {boolean | undefined} */ let redoScrollToElement= false;

		/** @type {{ element: Element | undefined, completed: boolean }} */
		const scrollProgressHolder= {element: undefined, completed: true};
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

	})( /** @type {(doResize: boolean | undefined, doScroll: boolean | undefined, doScrollToElement: boolean | undefined,
		 *          scrollToElement: any,
		 *          scrollProgressHolder: { element: Element | undefined, completed: boolean }) => void} */
		function(doResize, doScroll, doScrollToElement, scrollToElement, scrollProgressHolder) {

		// First do resize, since scrolling might depend on it
		if (doResize) {

			// Temporarily remove height contrains to allow scrollHeight to be calculated correctly
			_input.style.maxHeight= 'none';
			_input.style.height= 'auto';

			// Comput and set height
			const maxHeight= (_widget.offsetHeight - title.offsetHeight) * MAX_HEIGHT_OF_WIDGET_PERCENTAGE;
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
					scroll.style.marginBottom= extraBottomMargin > 0 ? `${extraBottomMargin}px` : '0';
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
	const sendButton= createBtn(form, 'send', SVG_SEND);
	sendButton.name= 'send';
	sendButton.setAttribute('disabled', '');

	const optionsElements= [];
	const chatScopeOptions= [];
	addOptionsControl(form, sendButton, chatbot.getOptions(), selected, optionsElements, chatScopeOptions);
	function _hasContentToSend() {
		return _input.value.trim() !== '' || (_attachOnlyRequest && !!_attached.length);
	}
	function _updateSendButtonEnablement() {
		if (_isReadyToSend && !_isWaitingToSend && _hasContentToSend()) {
			sendButton.removeAttribute('disabled');
		} else {
			sendButton.setAttribute('disabled', '');
		}
	}

	function sendAction(/** @type {Event} */ e) {
		preventDefault(e);
		if (_isReadyToSend && !_isWaitingToSend && _hasContentToSend()) {
			_isWaitingToSend= true;
			_updateSendButtonEnablement();
			sendContent();
		}
		return false;
	}
	async function sendContent() {
		try {
			if (_attachSupported) {
				let queue;
				do {
					queue= _attachQueue;
					await queue;
				} while (queue !== _attachQueue);
			}
			if (!_isReadyToSend || !_hasContentToSend()) return;
			/** @type {chatbot.Content} */
			let content= _input.value;
			if (_attachSupported) {
				if (_attached.length) {
					content= _attached.splice(0);
					if (_input.value.trim()) {
						content.push({ type: 'text', text: _input.value });
					}
					clearAttached();
				}
			}
			_input.value= '';
			_updateSendButtonEnablement();
			_resizeAndScroll(false, false, true);
			chatbot.send(content, selected);
			if (_isTypeEverywhere) {
				_input.focus();
			}
		} finally {
			_isWaitingToSend= false;
			_updateSendButtonEnablement();
		}
	}
	addEvent(sendButton, 'click', sendAction);
	function inputKeyHandler(/** @type {KeyboardEvent} */ e) {
		return e.keyCode == 13 && !e.shiftKey ? sendAction(e) : true;
	};
	addEvent(_input, 'keypress', inputKeyHandler);
	addEvent(_input, 'input', () => {
		_updateSendButtonEnablement();
		_resizeAndScroll(true);
	});
	addEvent(window, 'resize', () => { _resizeAndScroll(true); scheduleQuestionNavActiveUpdate(); });
	_input.rows= 1;
	_input.inputMode= 'text';
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
				scroll.style.marginBottom= '0';
				_msgArea.innerHTML= '';
				_isReadyToSend= true;
				if (_input && getConfigString('placeholderFollowup')) {
					_input.placeholder= getConfigString('placeholder', 'Ask anything');
				}
				_isSplash= true;
				_refsMapByMsgObj= new Map();
				_toolbarByMsgObj= new Map();
				_sourcesBtnByMsgObj= new Map();
				clearQuestionNav();
				showSourcesSidebar(false);
				setClassName(_widget, 'widget splash');
			} else if (change.action == 'add' && change.msgObj) {
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
					const msgObj= change.msgObj;
					const role= change.msgObj.role;
					const message= getContentStr(change.msgObj.content);
					const msgContainer=
						createElement(_msgArea, 'div', 'msg-p role-' + role + (change.end ? ' done' : ''));
					msgContainer.setAttribute('tabindex', '-1'); // with that it can be activated by clicking on it (CSS selector: ...:focus-within)
					const msgElement= createElement(msgContainer, 'div', 'msg' + (role == 'user' ? '' : ' md'));
					_map.set(change.msgObj, msgElement);

					// Attached images
					if (msgObj.content && typeof msgObj.content !== 'string') {
						const attachedImages= [];
						for (const contentPart of msgObj.content) {
							if ('image_url' == contentPart.type && typeof contentPart.image_url?.url === 'string') {
								attachedImages.push(contentPart.image_url.url);
							}
						}
						if (attachedImages.length) {
							const thumbs= createElement(msgElement, 'div', 'thumbs');
							for (const imageSource of attachedImages) {
								/** @type {HTMLImageElement} */ // @ts-ignore
								const img= createElement(createElement(thumbs, 'div', 'thumb'), 'img', 'thumb');
								img.src= imageSource;
								img.alt= '';
							}
						}
					}

					// Content text
					if (role == 'user') {
						msgElement.appendChild(document.createTextNode(message));
					} else if (!message) {
						createElement(msgElement, 'p', 'wait');
					} else {
						let messageMd= message;
						if (change.msgObj.contentWithRefs && change.msgObj.refs) {
							const refsMap= new Map();
							messageMd= resolve(message, change.msgObj.contentWithRefs, change.msgObj.refs, refsMap, chatbot.config.refsBaseUrl);
							_refsMapByMsgObj.set(change.msgObj, refsMap);
						}
						renderMd(msgElement, messageMd);
					}

					// Toolbar
					const toolbar= createElement(msgContainer, 'div', 'tbar');
					_toolbarByMsgObj.set(change.msgObj, toolbar);
					const copyButton= createBtn(toolbar, 'copy', SVG_COPY, 'Copy');
					copyButton.title= ''; // Disable the native tooltip
					copyButton.setAttribute('data-tooltip', getConfigString('copyHover', 'Copy'));
					attachFloatingTooltip(copyButton);
					const copyButtonDefaultInner= copyButton.innerHTML;
					addEvent(copyButton, 'click', () => {
						if (!change.msgObj || !change.msgObj.content) return;
						const contentStr= getContentStr(change.msgObj.content);
						navigator.clipboard.write([
								new ClipboardItem(
									role == 'user'
									? { 'text/plain': new Blob([contentStr], { type: 'text/plain' }) }
									: { 'text/plain': new Blob([contentStr], { type: 'text/plain' }),
										'text/html': new Blob([mdToHtml(contentStr)], { type: 'text/html' }) }
							)
						]).then(() => {
							copyButton.innerHTML= getConfigString('doneBtn', SVG_DONE);
							copyButton.setAttribute('data-tooltip', 'Copied!');
							copyButton.setAttribute('data-copied', 'true');
							if (_tooltipTarget === copyButton) showFloatingTooltip(copyButton);
							setTimeout(() => {
								copyButton.innerHTML= copyButtonDefaultInner;
								copyButton.setAttribute('data-tooltip', getConfigString('copyHover', 'Copy'));
								copyButton.removeAttribute('data-copied');
								if (_tooltipTarget === copyButton) showFloatingTooltip(copyButton);
							}, DONE_DELAY);
						}).catch(() => {
							// TODO Error handling when failed to copy; maybe hide copy button
						});
					});
					if (config && typeof config.customizeMsgFn === 'function') {
						config.customizeMsgFn(toolbar, msgElement, role == 'user', change.msgObj);
					}

					// Update UI
					if (role == 'user') {
						addQuestionNavItem(change.msgObj, msgContainer, message ? message : '');
						updateQuestionNavVisibility();
						scheduleQuestionNavActiveUpdate();
					}
					_resizeAndScroll(false, true, false, msgElement, role == 'user');
				}
			} else if (change.action == 'readyToSend' && change.value !== undefined) {
				_isReadyToSend= change.value;
				_updateSendButtonEnablement();
			} else if (change.action == 'updateProperty' && change.msgObj &&
				(change.property == 'content' || change.property == 'contentWithRefs' || change.property == 'refs')) {
				const msgObj= change.msgObj;
				const streamElement= _map.get(msgObj);
				if (!streamElement || !msgObj.content) return;
				let answer= getContentStr(msgObj.content);
				let sourcesMightHaveChanged= false;
				if (msgObj.contentWithRefs && msgObj.refs) {
					const refsMap= new Map();
					answer= resolve(getContentStr(msgObj.content), msgObj.contentWithRefs, msgObj.refs, refsMap,
						chatbot.config.refsBaseUrl);
					_refsMapByMsgObj.set(msgObj, refsMap);
					sourcesMightHaveChanged= true;
				}
				if (streamElement._a != answer) {
					streamElement._a= answer;
					renderMd(streamElement, answer);
				}
				if (change.end && (change.property == 'content' || change.property == 'contentWithRefs')) {
					streamElement.parentNode.className+=
						' ' + CLASS_PREFIX + (change.property == 'content' ? '' : 'ref-') + 'done';
				}
				if (sourcesMightHaveChanged) {
					updateSourcesSidebar(change);
				}
				_resizeAndScroll(false, true, false, streamElement, false);
			} else if (change.action == 'sent') {
				if (change.msgObj) {
					const options= change.msgObj.options;
					optionsElements.forEach(element => element.reset(options));
				}
			}
			if (change.action == 'sendError') {
				_map.get(change.msgObj)?.parentNode.remove();
				_map.delete(change.msgObj);

				// Show error panel
				const errorPanel= createElement(_msgArea, 'div', 'error');

				// Error message
				const errorLabelText= getConfigString('errorMsg', ERROR_MESSAGE_DEFAULT);
				const errorLabel= createElement(errorPanel, 'p', UNDEFINED, errorLabelText);
				const errorLabelHtml= getConfigString('errorMsgHtml');
				if (errorLabelHtml) {
					errorLabel.innerHTML= errorLabelHtml;
				}

				// Retry button
				const retryBtn=
					createBtn(errorPanel, 'errorRetry', SVG_TRY_AGAIN, UNDEFINED, ERROR_RETRY_BUTTON_TEXT_DEFAULT);
				addEvent(retryBtn, 'click', () => {
					errorPanel.remove();
					if (chatbot.messages[chatbot.messages.length - 1]?.role != 'user') {
						chatbot.messages.pop();
					}
					chatbot.reset(chatbot.messages, true, chatbot.desc);
				});

				_map.set(_errorObj, retryBtn);
				_resizeAndScroll(false, true, false, retryBtn);
			}
			if (change.action == 'add' || (change.action == 'updateProperty' && change.property == 'refs')) {
				sourcesButton(change);
			}
			if (change.action == 'history') {
				updateHistorySidebar();
				if (!_historyInitExpand) {
					expandHistorySidebar(true);
				}
			}
			// TODO: Display an error message to the user if adding or updating the history fails.
			// if (change.action == 'historyAddError' || change.action == 'historyUpdateError' ) { ... }

		});
		for (const optionElement of chatScopeOptions) {
			optionElement.disabled= !_isSplash;
		}
	}

	function sourcesButton(change) {
		if (change.msgObj.role === 'user' || !change.msgObj.refs || _sourcesBtnByMsgObj.get(change.msgObj)
			|| !getConfigBoolean('sourcesSidebar', true)) return;
		const toolbar= _toolbarByMsgObj.get(change.msgObj);
		if (!toolbar) return;
		const sourcesCount= withoutDuplicates(change.msgObj.refs).length;
		const sourcesLabel= sourcesCount + ' source' + (sourcesCount > 1 ? 's' : '');
		const sourcesButton= createBtn(toolbar, 'btn-sources', sourcesLabel, 'Sources');
		function sourcesFn() {
			_sourcesSidebarMsgObj= change.msgObj;
			updateSourcesSidebar(change);
		}
		_sourcesBtnByMsgObj.set(change.msgObj, sourcesButton);
		addEvent(sourcesButton, 'click', () => {
			if (_sourcesSidebarMsgObj === change.msgObj) {
				showSourcesSidebar(false);
			} else {
				showSourcesSidebar(true);
				sourcesFn();
			}
		});
	}

	function showSourcesSidebar(enablement) {
		if (!_sourcesSidebar) {
			if (!enablement) return;
			_sourcesSidebar= createElement(_widget, 'aside', 'sources');
			_sourcesSidebar.style.width= '0';
			_sourcesSidebar.style.padding= '0';
			const mbar= createElement(_sourcesSidebar, 'div', 'mbar');
			_sourcesSidebarcloseBtn= createBtn(mbar, 'close', SVG_CLOSE, 'Close');
			addEvent(_sourcesSidebarcloseBtn, 'click', () => {
				showSourcesSidebar(false);
			});
			_sourcesSidebarContent= createElement(_sourcesSidebar, 'div');
		}
		if (enablement) {
			_sourcesSidebarcloseBtn.style.display= '';
			_sourcesSidebar.style.overflowY= '';
			setTimeout(() => { _sourcesSidebar.style.width= ''; _sourcesSidebar.style.padding= ''}, 0);
		} else {
			_sourcesSidebarMsgObj= undefined;
			_sourcesSidebarcloseBtn.style.display= 'none';
			_sourcesSidebar.style.overflowY= 'hidden';
			setTimeout(() => { _sourcesSidebar.style.width= 0; _sourcesSidebar.style.padding= 0}, 0);
		}
	}

	/** @param {chatbot.Change} change */
	function updateSourcesSidebar(change) {
		if (_sourcesSidebarMsgObj !== change.msgObj) return;
		const refsMap= _refsMapByMsgObj.get(_sourcesSidebarMsgObj);
		const state= JSON.stringify(_sourcesSidebarMsgObj.refs) + mapToString(refsMap);
		if (state == _sourcesSidebarState) return;
		_sourcesSidebarState= state;
		_sourcesSidebarContent.innerHTML= '';
		createElement(_sourcesSidebarContent, 'div', 'h', 'Sources');
		const listElement= createElement(_sourcesSidebarContent, 'ol');
		const refsWithoutDuplicates= withoutDuplicates(_sourcesSidebarMsgObj.refs);
		const done= new Set();
		if (refsMap) {
			const refsValues= [];
			for (const value of refsMap.values()) {
				refsValues.push(value);
			}
			refsValues.sort((a, b) => a - b);
			for (const refN of refsValues) {
				let href;
				for (const [key, value] of refsMap) {
					if (value == refN) {
						href= key;
					}
				}
				if (!href) continue;
				for (const ref of refsWithoutDuplicates) {
					if (ref.h != href) continue;
					done.add(ref.h);
					/** @type {HTMLAnchorElement} */ // @ts-ignore
					const a= createElement(createElement(listElement, 'li'), 'a');
					a.href= (chatbot.config.refsBaseUrl === undefined ? '' : chatbot.config.refsBaseUrl) + ref.h;
					a.target= '_blank';
					if (ref.b) {
						a.title= ref.b;
					}
					createElement(a, 'span', 'ref-', refN);
					createElement(a, 'span', undefined, ref.t);
					break;
				}
			}
		}
		const uncitedRefs= [];
		for (const ref of refsWithoutDuplicates) {
			if (done.has(ref.h)) continue;
			uncitedRefs.push(ref);
		}
		if (uncitedRefs.length) {
			let moreList= listElement;
			if (done.size) {
				const li= createElement(listElement, 'li', 'more-li closed');
				const moreOpener= createElement(li, 'span', 'more-h');
				const handle= createElement(moreOpener, 'span', 'more-');
				handle.innerHTML= SVG_FOLD;
				createElement(moreOpener, 'span', 'more--', 'More');
				moreList= createElement(li, 'ol', 'more');
				addEvent(moreOpener, 'click', () => {
					setClassName(li, 'more-li' + (li.className.indexOf('closed') < 0 ? ' closed' : ''));
				});
			}
			for (const ref of uncitedRefs) {
				/** @type {HTMLAnchorElement} */ // @ts-ignore
				const a= createElement(createElement(moreList, 'li'), 'a', 0, ref.t);
				a.href= (chatbot.config.refsBaseUrl === undefined ? '' : chatbot.config.refsBaseUrl) + ref.h;
				a.target= '_blank';
				if (ref.b) {
					a.title= ref.b;
				}
			}
		}
	}

	function mapToString(map) {
		try {
			return JSON.stringify(Array.from(map));
		} catch {
			return '';
		}
	}

	function withoutDuplicates(refs) {
		const result= [];
		const hrefsDone= new Set();
		for (const ref of refs) {
			if (hrefsDone.has(ref.h)) continue;
			hrefsDone.add(ref.h);
			result.push(ref);
		}
		return result;
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
				if (msgObj.role === 'user' && trimmed == getContentStr(msgObj.content).trim()) return;
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

	/**
	 * @param {string} prop - Name of the UI configuration property.
	 * @param {string|0} [defaultValue] - Value to return if the property is not set to a string.
	 * @returns {string} The configured string, or else the default value (empty string if no default is given).
	 */
	function getConfigString(prop, defaultValue) {
		return config !== undefined && typeof config[prop] === 'string' ? config[prop] : (defaultValue ? defaultValue : '');
	}

	/**
	 * @param {string} prop - Name of the UI configuration property.
	 * @param {boolean} [defaultValue=false] - Value to return if the property is not set to a boolean.
	 * @returns {boolean} The configured boolean, or else the default value (`false` if no default is given).
	 */
	function getConfigBoolean(prop, defaultValue) {
		return config !== undefined && typeof config[prop] === 'boolean' ? config[prop] : (defaultValue ? defaultValue : false);
	}

	/**
	 * @param {string} prop
	 * @param {number} defaultValue
	 * @returns {number}
	 */
	function getConfigNumber(prop, defaultValue) {
		return config !== undefined && typeof config[prop] === 'number' && isFinite(config[prop]) ? config[prop] : defaultValue;
	}

	/**
	 * @param {Element} parent
	 * @param {string} id
	 * @param {string} defaultSvg
	 * @param {string|0} [defaultTitle]
	 * @param {string} [defaultText]
	 * @returns {HTMLButtonElement}
	 */
	function createBtn(parent, id, defaultSvg, defaultTitle, defaultText) {
		/** @type {HTMLButtonElement} */ // @ts-ignore
		const btn= createElement(parent, 'button', 'btn ' + id);
		btn.type= 'button';
		btn.innerHTML= getConfigString(id + 'Btn', defaultSvg);
		const text= getConfigString(id + 'BtnText', defaultText);
		if (text && text != '') {
			createElement(btn, 'span', UNDEFINED, text);
		}
		btn.title= getConfigString(id + 'Hover', defaultTitle);
		return btn;
	}

	/**
	 * @param {File} file
	 */
	function attachImageFile(file) {
		if (!isImageFileAcceptable(file)) return;
		_attachQueue= _attachQueue
			.then(() => {
				return new Promise((resolve, reject) => {
					const reader= new FileReader();
					reader.onload= () => resolve(reader.result);
					reader.onerror= () => reject(reader.error);
					reader.readAsDataURL(file);
				});
			})
			.then((/** @type {string} */ url) => {
				if (typeof url !== 'string') return;

				// Duplicate?
				for (const alreadyAttached of _attached) {
					if (alreadyAttached.type != 'image_url') continue;
					if (url == alreadyAttached.image_url.url) return;
				}

				/** @type {chatbot.ContentArrayItem} */
				const imageObj= { type: 'image_url', image_url: { url: url} };
				_attached.push(imageObj);
				if (_attachedArea) {
					_attachedArea.hidden= !_attached.length;
					const thumb= createElement(_attachedArea, 'div', 'thumb');
					/** @type {HTMLImageElement} */ // @ts-ignore
					const img= createElement(thumb, 'img');
					img.src= url;
					const removeBtn= createBtn(thumb, 'attachDel', SVG_REMOVE, 'Remove image');
					addEvent(removeBtn, 'click', (/** @type {Event} */ e) => {
						preventDefault(e);
						const i = _attached.indexOf(imageObj);
						if (i !== -1) _attached.splice(i, 1);
						thumb.remove();
						if (!_attached.length) {
							clearAttached();
						}
						_updateSendButtonEnablement();
						_resizeAndScroll(true);
					});
				}

				// Too many attachments?
				if (_attachMax > 0 && _attached.length > _attachMax) {
					const n= _attached.length - _attachMax;
					_attached.splice(0, n);
					if (_attachedArea) {
						Array.from(_attachedArea.children).slice(0, n).forEach(thumb => thumb.remove());
					}
				}

				_updateSendButtonEnablement();
				_resizeAndScroll(true);
			})
			.catch(() => {}); // skip unreadable files without blocking the queue
	}

	/**
	 * @param {File} file
	 * @returns {boolean}
	 */
	function isImageFileAcceptable(file) {
		if (!file) return false;
		const type= file.type.toLowerCase();
		if (!type.startsWith('image/')) return false;
		const name= file.name.toLowerCase();
		for (const item of _attachAccept.split(',')) {
			const accept= item.trim().toLowerCase();
			if (accept == 'image/*'
				|| (accept.startsWith('image/') && accept == type)
				|| (accept.startsWith('.') && name.endsWith(accept))) return true;
		}
		return false;
	}

	/** @type {ChatbotUi & chatbot.Observer} */
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
		/** @export */
		typeEverywhere: function(isTypeEverywhere) {
			_isTypeEverywhere= isTypeEverywhere;
			return this;
		}
	};
	chatbot.observe(ui);
	_resizeAndScroll(true);
	return ui;
}

/**
 * @param {DataTransfer | null} clipboardData
 * @returns {Array<File>}
 */
function getImagesFromClipboard(clipboardData) {
	const images= [];
	if (!clipboardData) return images;
	for (const file of clipboardData.files || []) {
		if (file.type.indexOf('image/') != 0) continue;
		images.push(file);
	}
	if (images.length) return images;
	for (const item of clipboardData.items || []) {
		if (item.kind != 'file' || item.type.indexOf('image/') != 0) continue;
		const file= item.getAsFile();
		if (!file) continue;
		images.push(file);
	}
	return images;
}

/**
 * @param {chatbot.Content | undefined} content
 * @returns {string}
 */
function getContentStr(content) {
	if (typeof content === 'string') return content;
	if (!content) return '';
	for (const contentPart of content) {
		if ('text' == contentPart.type && typeof contentPart.text === 'string') return contentPart.text;
	}
	return '';
}

async function addOptionsControl(form, beforeChild, optionsPromis, selected, optionsElements, chatScopeOptions) {
	const options = await optionsPromis;
	var optionsArea;
	for (const opt of options) {
		if (optionsArea === undefined) {
			optionsArea= createElement(UNDEFINED, 'div', 'options');
			form.insertBefore(optionsArea, beforeChild);
			setClassName(form, 'form o');
		}
		let data= [];
		var value;
		for (const item of opt.values) {
			if (item.default) value= item.value;
			data.push({ text: item.label !== undefined ? item.label : item.value, value: item.value });
		}
		let dropdown= Dropdown(optionsArea, {
			data: data,
			value: value,
			onchange: (prop) => selected[opt.id]= prop.getValue(),
			allowEmpty: false
		});
		optionsElements.push({
			reset: (function(id, values, dropdown) {
				return function(options) {
					var newValue= options ? options[id] : undefined;
					for (var j= 0; j < values.length; j++) {
						if (newValue == values[j].value || (newValue === undefined && values[j].default)) {
							dropdown.setValue(values[j].value);
							return;
						}
					}
				};
			})(opt.id, opt.values, dropdown)
		});
		if (opt.scope == 'chat') {
			chatScopeOptions.push(dropdown);
		}
	}
}
