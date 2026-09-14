/**
 * @typedef {import('./chatbot.core.js').History} History
 * @typedef {import('./chatbot.core.js').ChatDescriptor} ChatDescriptor
 */

/**
 * @returns {History}
 */
export function createInmemoryHistory() {
	let i= 1;

	/** @type {Map<number | string, ChatDescriptor>} */
	const descs= new Map();
	const data= new Map();
	return {
		list: () => {
			return new Promise((resolve) => {
				resolve(Array.from(descs.values()));
			});
		},
		get: (desc) => {
			return new Promise((resolve) => {
				resolve(data.get(desc.id));
			});
		},
		add: (messages, name) => {
			return new Promise((resolve) => {
				const desc= {
					id: i++,
					name: name
				}
				descs.set(desc.id, desc);
				data.set(desc.id, messages);
				resolve(desc);
			});
		},
		update: () => { // nothing to persist, since in memory
			return new Promise((resolve) => {
				resolve(true);
			});
		},
		remove: (desc) => {
			descs.delete(desc.id);
			data.delete(desc.id);
			return new Promise((resolve) => {
				resolve(true);
			});
		},
		removeAll: () => {
			descs.clear();
			data.clear();
			return new Promise((resolve) => {
				resolve(true);
			});
		}
	};
}