import { sendHttpRequest } from './chatbot.http.js';
import { createInmemoryHistory } from './chatbot.history.in_memory.js';
import { createIndexeddbHistory } from './chatbot.history.indexeddb.js';

const DEFAULT_URL= 'v1/chat/completions';
const STREAM= true;

/**
 * @typedef {Object} Chatbot
 * @property {Array.<MessageObject>} messages
 * @property {History | undefined} history
 * @property {ChatDescriptor | undefined} desc
 * @property {ChatbotConfig} config
 * @property {(message: string, options?: Record<string, unknown>) => Promise<unknown>} send
 * @property {function(Observer): void} observe
 * @property {(messages?: Array.<MessageObject>, send?: boolean, desc?: ChatDescriptor) => void} reset
 * @property {() => Promise<Array.<Record<string, unknown>>>} getOptions
 * @property {(url: string,
 *             callback?: (data: unknown | undefined, done: boolean) => void,
 *             postData?: string,
 *             asStream?: boolean)
 *            => Promise<unknown>} sendHttpRequest - Helper function that can be used to create a custom {@link Connector}
 */

/**
 * @typedef {Array.<Record<string, unknown> & { h: string }>} References
 */

/**
 * @typedef {Record<string, unknown> & { role: string,
 *                                       content: string | undefined,
 *                                       contentWithRefs: string | undefined,
 *                                       refs: References | undefined,
 *                                       options: Record<string, unknown> | undefined }} MessageObject
 */

/**
 * @typedef {Object} ChatbotConfig
 * @property {string} [url]
 * @property {Record<string, unknown> | function | string} [baseRequestData]
 * @property {Connector} [connector]
 * @property {(message: string, chatbot: Chatbot,
 *             rawSendFn: ((message: string, options?: Record<string, unknown>) => Promise<unknown>),
 *             options?: Record<string, unknown>) => Promise<unknown>} [sendHook]
 * @property {Array.<Record<string, unknown>> | string | function} [options]
 * @property {'inmemory' | 'indexeddb' | History} [history]
 * @property {string} [refsBaseUrl]
 */

/**
 * @typedef {Object} Observer
 * @property {(changes: Array.<Change>) => void} update
 */

/**
 * @typedef {Object} Connector
 * @property {(callback: (delta: string, done?: boolean,
 *                        refs?: References, refsDelta?: string, refsDone?: boolean) => void,
 *              message: string|undefined, chatbot: Chatbot, options?: Record<string, unknown>) => Promise<void>} send
 * @property {function(): void} [reset]
 */

/**
 * @typedef {Record<string, unknown> &
 *           {action: 'add' | 'readyToSend' | 'update' | 'sent' | 'received' | 'reset' | 'sendError' | string,
 *            msgObj: MessageObject | undefined,
 *            property?: 'content' | 'role' | 'contentWithRefs' | string | undefined,
 *            value?: any | undefined,
 *            end?: boolean}} Change
 */

/**
 * @param {string | ChatbotConfig} urlOrConfig
 * @returns {Chatbot}
 */
export function chatbot(urlOrConfig) {

	/**
	 * @param {Chatbot} chatbot
	 * @param {string} [msg]
	 * @param {Record<string, unknown>} [options]
	 */
	function _send(chatbot, msg, options) {

		// Add user message
		if (typeof msg === 'string') {
			_apply(chatbot, msg, undefined, false, true, undefined, undefined, undefined, undefined, undefined, options);
		}

		// Add msgObj to receive content via callback
		let msgObj= undefined;
		if (!msg && chatbot.messages && chatbot.messages.length > 0
			&& chatbot.messages[chatbot.messages.length - 1].role === 'assistant'
			&& typeof chatbot.messages[chatbot.messages.length - 1].role === 'string') {
			const lastMsgObj= chatbot.messages[chatbot.messages.length - 1];

			// If the last message is from the assistant, use that instead
			msgObj= _apply(chatbot, undefined, lastMsgObj, true, undefined, undefined, undefined, undefined, undefined, true);

		} else {
			msgObj= _apply(chatbot, undefined, undefined, true);
		}

		/** @type {(err: Error) => Promise} */
		function onErrorFn(err) {
			asyncObserversUpdate( { action: 'sendError', msgObj: msgObj, value: err } );
			return Promise.resolve();
		}

		// ...
		/** @type {(text: string | undefined, done: boolean) => void} */
		function _receive(text, done) {
			_apply(chatbot, text, msgObj, true, done);
		}

		// Deligate to configured connector if any
		if (chatbot.config.connector && typeof chatbot.config.connector.send === 'function')
			return chatbot.config.connector.send((delta, done, refs, refsDelta, refsDone) =>
					_apply(chatbot, delta, msgObj, true, done, refs, refsDelta, refsDone),
				msg, chatbot, options).catch(onErrorFn);

		/** @type {(data: any, done: boolean) => void} */
		function callback(data, done) {

			// Not streaming
			if (!STREAM) {
				_receive(data.choices[0].message.content, true);
				return;
			}

			// Streaming...
			if (data && data.choices && data.choices.length > 0 && data.choices[0].delta) {
				_receive(data.choices[0].delta.content ? data.choices[0].delta.content : '', done);
			} else if (data && data.choices && data.choices.length > 0) {
				_receive(data.choices[0].text ? data.choices[0].text : '', done);
			} else if (done) {
				_receive('', true);
			}
			if (done) {
				_receive(undefined, true);
			}

		}
		const requestUrl= typeof chatbot.config.url === 'string' ? chatbot.config.url : DEFAULT_URL;
		const baseRequest= urlOrConfig !== null && typeof urlOrConfig === 'object' && urlOrConfig.baseRequestData
			? urlOrConfig.baseRequestData : {};
		const requestStr= _toRequestStr(chatbot, baseRequest, requestUrl, STREAM);
		return chatbot.sendHttpRequest(requestUrl, callback, requestStr, STREAM)
			.catch(onErrorFn);
	}

	/** @type {Array.<Observer>} */
	const _observers= [];

	/** @type {Map.<MessageObject, ChatDescriptor>} */
	const _chatDescByMsgObj= new Map();

	/** @type {Map.<ChatDescriptor, Array.<MessageObject>>} */
	const _messagesByDesc= new Map();

	/**
	 * @param {Chatbot} chatbot
	 * @param {string} [delta]
	 * @param {MessageObject | undefined} [msgObj]
	 * @param {boolean} [receive]
	 * @param {boolean} [done]
	 * @param {References} [refs]
	 * @param {string} [refsDelta]
	 * @param {boolean} [refsDone]
	 * @param {boolean} [reset]
	 * @param {boolean} [init]
	 * @param {Record<string, unknown>} [options]
	 * @returns {MessageObject}
	 */
	function _apply(chatbot, delta, msgObj, receive, done, refs, refsDelta, refsDone, reset, init, options) {
		/** @type {MessageObject} */ // @ts-ignore
		const target= msgObj === undefined ? { role: receive ? 'assistant' : 'user', content: delta } : msgObj;
		if (refs !== undefined) {
			target.refs= refs;
		}
		if (options !== undefined) {
			target.options= options;
		}

		/** @type {Array.<Change>} */
		const changes= [];

		if (msgObj === undefined || init) {
			if (!reset) {
				if (!init) {
					chatbot.messages.push(target);
					if (chatbot.desc) {
						_chatDescByMsgObj.set(target, chatbot.desc);
					}
				}
				changes.push({ action: 'add', msgObj: target, start: true, end: !!done });
			}
		} else {
			if (delta !== undefined) {
				msgObj.content= (msgObj.content === undefined ? '' : msgObj.content) + delta;
				changes.push({ action: 'updateProperty', msgObj: target, property: 'content', value: msgObj.content, end: !!done });
			}
			if (refsDelta !== undefined) {
				msgObj.contentWithRefs= (msgObj.contentWithRefs === undefined ? '' : msgObj.contentWithRefs) + refsDelta;
				changes.push({ action: 'updateProperty', msgObj: target, property: 'contentWithRefs', value: msgObj.contentWithRefs, end: !!refsDone });
			}
			if (refs !== undefined) {
				msgObj.refs= refs;
				changes.push({ action: 'updateProperty', msgObj: target, property: 'refs', value: msgObj.refs, end: true });
			}
		}

		if (receive && (done || (!done && !msgObj))) {
			changes.push({ action: 'readyToSend', msgObj: target, value: !!done });
		}

		if (reset) {
			changes.push({ action: 'reset', msgObj: undefined });
		}

		if (done) {
			changes.push({ action: receive ? 'received' : 'sent', msgObj: target, end: true });
		}

		if (chatbot.history) {
			if (chatbot.messages.length && !chatbot.desc) {
				chatbot.desc= {id: -1, name: '...'};
				chatbot.history.add(chatbot.messages, chatNameFromFirstMessage(chatbot.messages))
					.then((desc) => {
						chatbot.desc= desc;
						chatbot.messages.forEach((msgObj) => _chatDescByMsgObj.set(msgObj, desc));
					}).catch(error => asyncObserversUpdate({ action: 'historyAddError', msgObj: target, value: error }));
				changes.push({ action: 'history', msgObj: chatbot.messages[0] });
			}
			const desc= _chatDescByMsgObj.get(target);
			if (desc) {
				const messages= _messagesByDesc.get(desc);
				chatbot.history.update(desc, messages ? messages : chatbot.messages)
					.catch(error => asyncObserversUpdate({ action: 'historyUpdateError', msgObj: target, value: error }));
			}
		}

		_observers.forEach(observer => observer.update(changes));
		return target;
	}

	/**
	 * @param {Change} change
	 */
	function asyncObserversUpdate(change) {
		_observers.forEach(observer => observer.update([change]));
	}

	/**
	 * @param {Chatbot} chatbot
	 * @param {string | function | Record<string, unknown>} request - One of the following:
	 *                 * string - the request string itself
	 *                 * function - returns the request as string or JSON object to be stringified
	 *                 * Object - create request using the given JSON object as base to which the messages have to be added
	 * @param {string} url
	 * @param {boolean} asStream
	 *
	 */
	function _toRequestStr(chatbot, request, url, asStream) {
		const requestFnResult= typeof request === 'function' ? request(chatbot, url, asStream) : undefined;
		return typeof request === 'string' ? request :
			typeof request === 'function' ? (requestFnResult !== null && typeof requestFnResult === 'object' ?
				JSON.stringify(requestFnResult) :
				'' + requestFnResult) :
				JSON.stringify(_createRequest(chatbot, request === undefined ? {} : request, asStream));
	}

	/**
	 * @param {Chatbot} chatbot
	 * @param {Object} baseRequest
	 * @param {boolean} asStream
	 * @returns {Record<string, unknown>}
	 */
	function _createRequest(chatbot, baseRequest, asStream) {
		const request= JSON.parse(JSON.stringify(baseRequest));
		request.messages= [];
		chatbot.messages.forEach((msgObj) => {
			if (msgObj.content === undefined) return;
			request.messages.push({ role: msgObj.role, content: msgObj.content });
		});
		if (asStream) {
			request.stream= true;
		}
		return request;
	}

	/**
	 * @param {Chatbot} chatbot
	 * @param {Array.<MessageObject>} [messages]
	 * @param {boolean} [send]
	 * @param {ChatDescriptor} [desc]
	 */
	function _reset(chatbot, messages, send, desc) {
		if ((!messages || !messages.length) && !chatbot.messages.length) return;
		if (chatbot.history && chatbot.desc) {
			_messagesByDesc.set(chatbot.desc, chatbot.messages);
		}
		chatbot.desc= desc;
		chatbot.messages= messages ? messages : [];
		if (chatbot.config.connector && typeof chatbot.config.connector.reset === 'function') {
			chatbot.config.connector.reset();
		}
		_apply(chatbot, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true);
		if (messages) {
			for (const msgObj of messages) {
				if (!msgObj.content) continue;
				_apply(chatbot, undefined, msgObj, undefined, true, undefined, undefined, undefined, false, true);
			}
		}
		if (send) {
			_send(chatbot);
		}
	}

	/**
	 * @param {unknown} data
	 * @returns {Array.<Record<string, unknown>>}
	 */
	function toOptions(data) {
		if (!Array.isArray(data)) return [];
		const isValidArray = data.every(item =>
			item !== null && typeof item === 'object' && !Array.isArray(item)
		);
		return isValidArray ? data : [];
	}

	/**
	 * @returns {History | undefined}
	 */
	function getHistoryImpl() {
		if (typeof urlOrConfig !== 'object' || !urlOrConfig.history) return undefined;
		if (urlOrConfig.history === 'indexeddb') {
			const dbPrefixConfig= urlOrConfig['historyIndexeddbPrefix'];
			const dbPrefix= typeof dbPrefixConfig === 'string' ? dbPrefixConfig : '';
			return createIndexeddbHistory(dbPrefix);
		}
		if (urlOrConfig.history === 'inmemory') return createInmemoryHistory();
		if (typeof urlOrConfig.history === 'object') return urlOrConfig.history;
		return undefined;
	}

	return {

		messages: [],

		desc: undefined,

		history: getHistoryImpl(),

		config: typeof urlOrConfig === 'string' ? { url: urlOrConfig } :
			typeof urlOrConfig === 'object' ? urlOrConfig : {},

		async getOptions() {
			if (this.config.options !== null && typeof this.config.options === 'object') {
				return new Promise((resolve) => { resolve(toOptions(this.config.options)); });
			}
			if (typeof this.config.options === 'string') {
				const data = await sendHttpRequest(this.config.options);
				return toOptions(data);
			}
			if (typeof this.config.options === 'function') {
				const result = this.config.options(this);
				if (result instanceof Promise) {
					const resultData = await result;
					return toOptions(resultData);
				}
				return new Promise((resolve) => { resolve(toOptions(result)); });
			}
			return new Promise((resolve) => { resolve([]); });
		},

		send(msg, options) {
			if (this.config.sendHook !== undefined) {
				/** @type {(message: string, options?: Record<string, unknown>) => Promise<unknown>} */
				const rawSendFn= (function(chatbot) {
					return function(msg, options) {return _send(chatbot, msg, options)};
				})(this);
				return this.config.sendHook(msg, this, rawSendFn, options);
			}
			return _send(this, msg, options);
		},

		observe(observer) {
			_observers.push(observer);
			return this;
		},

		reset(messages, send, desc) {
			_reset(this, messages, send, desc);
			return this;
		},

		sendHttpRequest

	};
}

/** @type {(messages: Array.<MessageObject>) => string} */
function chatNameFromFirstMessage(messages) {
	if (!messages || !messages.length || !messages[0].content) return '';
	return messages[0].content.substring(0, 42) + (messages[0].content.length > 42 ? '...' : '');
}

/**
 * @typedef {Object} History
 * @property {() => Promise<Array.<ChatDescriptor>>} list
 * @property {(chat: ChatDescriptor) => Promise<Array.<MessageObject> | undefined>} get
 * @property {(messages: Array.<MessageObject>, name: string) => Promise<ChatDescriptor>} add
 * @property {(chat: ChatDescriptor, messages: Array.<MessageObject>) => Promise<boolean>} update
 * @property {(chat: ChatDescriptor) => Promise<boolean>} remove
 * @property {() => Promise<boolean>} removeAll
 */

/**
 * @typedef {Record<string, unknown> & {id: string | number, name: string, lastModified?: number}} ChatDescriptor
 */
