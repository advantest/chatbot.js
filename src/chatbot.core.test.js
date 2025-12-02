// @ts-check
import * as chatbot from './chatbot.core.js';

describe('chatbot.core.test.js', () => {

	test('hi', async () => {

		const chat= chatbot.chatbot({connector: toUpperCaseConnector()});
		await chat.send('hi');
		expect(chat.messages.length).toBeGreaterThan(0);
		expect(chat.messages[0].content).toBe('hi');
		expect(chat.messages.length).toBe(2);
		expect(chat.messages[1].content).toBe('HI');
	});

	test('observe', async () => {
		const chat= chatbot.chatbot({connector: toUpperCaseConnector()});
		const log= [];
		const observer= {
			/** @type {(changes: Array.<chatbot.Change>) => void} */
			update: function(changes) {
				log.push(changes);
			}
		}
		chat.observe(observer);
		expect(log.length).toBe(0);
		expect(chat.messages.length).toBe(0);

		await chat.send('msg1');
		expect(log.length).toBe(3);
		expect(log[0].length).toBe(2);
		expect(log[0][0].action).toBe('add');
		expect(log[0][0].msgObj.content).toBe('msg1');
		expect(log[0][1].action).toBe('sent');
		expect(log[1][0].action).toBe('add');
		expect(log[1][0].msgObj.content).toBe('MSG1');

		await chat.send('msg2');
		expect(log.length).toBe(6);
		expect(log[3].length).toBe(2);
		expect(log[3][0].action).toBe('add');
		expect(log[3][0].msgObj.content).toBe('msg2');
		expect(log[3][1].action).toBe('sent');
		expect(log[4][0].action).toBe('add');
		expect(log[4][0].msgObj.content).toBe('MSG2');
	});

	/**
	 * @returns {chatbot.Connector}
	 */
	function toUpperCaseConnector() {
		return {
			send(callback, msg) {
				return new Promise((resolve) => {
					callback(msg.toUpperCase(), true);
					resolve();
				});
			}
		};
	}

});