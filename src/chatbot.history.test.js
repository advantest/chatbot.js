// @ts-check
import 'core-js/stable/structured-clone';
import 'fake-indexeddb/auto';
import { createInmemoryHistory } from './chatbot.history.in_memory.js';
import { createIndexeddbHistory } from './chatbot.history.indexeddb.js';
import * as chatbot from './chatbot.core.js';

/**
 * @typedef {import('./chatbot.core.js').History} History
 * @typedef {import('./chatbot.core.js').ChatDescriptor} ChatDescriptor
 */

describe('chatbot.history.indexeddb.test.js', () => {

	test('indexeddb impl', async () => await testHistoryImpl(createIndexeddbHistory('test-impl-')));
	test('indexeddb integration', async () => await testHistoryIntegration('indexeddb'));
	test('inmemory impl', async () => await testHistoryImpl(createInmemoryHistory()));
	test('inmemory integration', async () => await testHistoryIntegration('inmemory'));

});

/**
 * @param {History} db
 */
async function testHistoryImpl(db) {
	await list(db, 0);

	// add chat
	await db.add([{ role: 'user', content: 'msg1'}], 'chat 1');
	let descs= await list(db, 1);
	const desc= descs[0];
	expect(desc.name).toBe('chat 1');

	// add another chat
	await db.add([{ role: 'user', content: 'msg2'}], 'chat 2');
	descs= await list(db, 2);

	// get messages of first chat
	let messagesChat1= await db.get(desc);
	expect(messagesChat1?.length).toBe(1);
	expect(messagesChat1?.[0]?.content).toBe('msg1');

	// update
	// @ts-ignore
	messagesChat1[0]= { role: 'user', content: 'msg1b'};
	// @ts-ignore
	await db.update(desc, messagesChat1);
	messagesChat1= await db.get(desc);
	expect(messagesChat1?.length).toBe(1);
	expect(messagesChat1?.[0]?.content).toBe('msg1b');

	// delete first chat
	await db.remove(desc);
	await list(db, 1);

	// delete all
	await db.removeAll();
	await list(db, 0);
}

/**
 * @param {'indexeddb' | 'inmemory'} history
 */
async function testHistoryIntegration(history) {
	const chat= chatbot.chatbot({history: history, connector: okConnector()});
	let chats= await chat.history?.list();
	expect(chats?.length).toBe(0);

	// send 'hi'
	await chat.send('hi');
	chats= await chat.history?.list();
	expect(chats?.length).toBe(1);
	expect(chat.messages.length).toBe(2);

	// reset
	chat.reset();
	chats= await chat.history?.list();
	expect(chats?.length).toBe(1);
	expect(chat.messages.length).toBe(0);

	// go back to chat from history
	if (chat.history === undefined || chats === undefined) fail();
	let messages= await chat.history.get(chats[0]);
	chat.reset(messages, undefined, chats?.[0]);
	chats= await chat.history?.list();
	expect(chats?.length).toBe(1);
	expect(chat.messages.length).toBe(2);

}

/**
 * @param {History} db
 * @param {number} expectedLength
 * @returns {Promise<Array.<ChatDescriptor>>}
 */
async function list(db, expectedLength) {
	const descs= await db.list();
	expect(descs.length).toBe(expectedLength);
	return descs;
}

/**
 * @returns {chatbot.Connector}
 */
function okConnector() {
	// @ts-ignore
	return {
		send(callback) {
			return new Promise((resolve) => {
				// @ts-ignore
				callback('ok', true);
				resolve();
			});
		}
	};
}