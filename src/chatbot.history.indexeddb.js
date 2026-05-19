// @ts-check
/**
 * @typedef {import('./chatbot.core.js').History} History
 * @typedef {import('./chatbot.core.js').ChatDescriptor} ChatDescriptor
 * @typedef {import('./chatbot.core.js').MessageObject} MessageObject
 */

/**
 * @param {string} [dbPrefix]
 * @returns {History}
 */
export function createIndexeddbHistory(dbPrefix) {

	// @ts-ignore
	const INDEXED_DB= window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
	const DB_NAME= 'chat-history';
	const DB_VERSION= 1;
	const DB_STORE_DESCS= 'descs';
	const DB_STORE_DATA= 'messages';
	let dbPromise = null;

	function getDb() {
		if (!dbPromise) {
			dbPromise= new Promise((resolve, reject) => {
				const request = INDEXED_DB.open((dbPrefix ? dbPrefix : '') + DB_NAME, DB_VERSION);
				request.onerror = (event) => {
					// @ts-ignore
					reject(`Error opening database: ${event.target.error}`);
				};
				request.onsuccess = (event) => {
					// @ts-ignore
					resolve(event.target.result);
				};
				request.onupgradeneeded = (event) => {
					// @ts-ignore
					const db= event.target.result;
					if (!db.objectStoreNames.contains(DB_STORE_DESCS)) {
						db.createObjectStore(DB_STORE_DESCS, { keyPath: 'id', autoIncrement: true });
					}
					if (!db.objectStoreNames.contains(DB_STORE_DATA)) {
						db.createObjectStore(DB_STORE_DATA);
					}
				};
			});
		}
		return dbPromise;
	}

	/**
	 * @param {string} name
	 * @param {'readonly'|'readwrite'} mode
	 * @returns {Promise<IDBObjectStore>}
	 */
	async function getStore(name, mode) {
		const db= await getDb();
		return new Promise((resolve) => {
			const transaction= db.transaction(name, mode);
			resolve(transaction.objectStore(name));
		});
	}

	/** @type {() => Promise<Array.<ChatDescriptor>>} */
	async function list() {
		const store= await getStore(DB_STORE_DESCS, 'readonly');
		return new Promise((resolve, reject) => {
			const request= store.getAll();
			request.onerror= (event) => {
				// @ts-ignore
				reject(`Error getting items: ${event.target.error}`);
			};
			request.onsuccess= (event) => {
				// @ts-ignore
				resolve(event.target.result);
			};
		});
	}

	/** @type {(name: string) => Promise<ChatDescriptor>} */
	async function addDesc(name) {
		const descs= await getStore(DB_STORE_DESCS, 'readwrite');
		return new Promise((resolve, reject) => {
			const desc= { name: name };
			const request= descs.add(desc);
			request.onerror= (event) => {
				// @ts-ignore
				reject(`Error adding items: ${event.target.error}`);
			};
			request.onsuccess= (event) => {
				// @ts-ignore
				desc.id= event.target.result;
				// @ts-ignore
				resolve(desc);
			};
		});
	}

	/** @type {(messages: Array.<MessageObject>, name: string) => Promise<ChatDescriptor>} */
	async function add(messages, name) {
		const desc= await addDesc(name);
		const data= await getStore(DB_STORE_DATA, 'readwrite');
		return new Promise((resolve, reject) => {
			const request= data.add(messages, desc.id);
			request.onerror= (event) => {
				// @ts-ignore
				reject(`Error adding items: ${event.target.error}`);
			};
			request.onsuccess= () => {
				resolve(desc);
			};
		});
	}

	/** @type {(chat: ChatDescriptor) => Promise<Array.<MessageObject> | undefined>} */
	async function get(desc) {
		const data= await getStore(DB_STORE_DATA, 'readwrite');
		return new Promise((resolve, reject) => {
			const request= data.get(desc.id);
			request.onerror= (event) => {
				// @ts-ignore
				reject(`Error adding items: ${event.target.error}`);
			};
			request.onsuccess= (event) => {
				// @ts-ignore
				resolve(event.target.result);
			};
		});
	}

	/** @type {(chat: ChatDescriptor) => Promise<boolean>} */
	async function remove(desc) {
		const descs= await getStore(DB_STORE_DESCS, 'readwrite');
		await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
			const req= descs.delete(desc.id);
			req.onsuccess= () => resolve();
			// @ts-ignore
			req.onerror= (e) => reject(e.target.error);
		}));
		const data= await getStore(DB_STORE_DATA, 'readwrite');
		return new Promise((resolve, reject) => {
			const req= data.delete(desc.id);
			req.onsuccess= () => resolve(true);
			// @ts-ignore
			req.onerror= (e) => reject(e.target.error);
		});
	}


	/** @type {() => Promise<boolean>} */
	async function removeAll() {
		const descs= await getStore(DB_STORE_DESCS, 'readwrite');
		await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
			const req= descs.clear();
			req.onsuccess= () => resolve();
			// @ts-ignore
			req.onerror= (e) => reject(e.target.error);
		}));
		const data= await getStore(DB_STORE_DATA, 'readwrite');
		return new Promise((resolve, reject) => {
			const req= data.clear();
			req.onsuccess= () => resolve(true);
			// @ts-ignore
			req.onerror= (e) => reject(e.target.error);
		});
	}

	/** @type {(chat: ChatDescriptor, messages: Array.<MessageObject>) => Promise<boolean>} */
	async function update(desc, messages) {
		const data= await getStore(DB_STORE_DATA, 'readwrite');
		return new Promise((resolve, reject) => {
			if (!desc || !desc.id || desc.id == -1) {
				resolve(false);
				return;
			}
			const request= data.put(messages, desc.id);
			request.onerror= (event) => {
				// @ts-ignore
				reject(`Error adding items: ${event.target.error}`);
			};
			request.onsuccess= () => {
				resolve(true);
			};
		});
	}

	return {
		list: async () => {
			const descs= await list();
			return new Promise((resolve) => {
				resolve(Array.from(descs.values()));
			});
		},
		get: get,
		add: add,
		update: update,
		remove: remove,
		removeAll: removeAll
	};
}