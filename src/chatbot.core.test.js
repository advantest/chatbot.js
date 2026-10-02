import * as chatbot from './chatbot.core.js';

describe('chatbot.core.test.js', () => {

	test('hi', async () => {

		const chat= chatbot.chatbot({connector: toUpperCaseConnector});
		await chat.send('hi');
		expect(chat.messages.length).toBeGreaterThan(0);
		expect(chat.messages[0].content).toBe('hi');
		expect(chat.messages.length).toBe(2);
		expect(chat.messages[1].content).toBe('HI');
	});

	/** @type {Array<{name: string, content: chatbot.Content}>} */
	const contentCases= [
		{ name: 'a string', content: 'Describe this image' },
		{ name: 'text parts', content: [{ type: 'text', text: 'Describe this image' }] },
		{ name: 'image parts', content: [{ type: 'image_url', image_url: { url: 'https://example.com/image.png' } }] },
		{ name: 'text and image parts', content: [
			{ type: 'text', text: 'Describe this image' },
			{ type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
		] },
		{ name: 'image and multiple text parts', content: [
			{ type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
			{ type: 'text', text: 'Describe this image' },
			{ type: 'text', text: 'Include the colors' }
		] }
	];

	test.each(contentCases)('send content containing $name', async ({ content }) => {
		const originalContent= JSON.parse(JSON.stringify(content));
		const sent= [];
		const chat= chatbot.chatbot({
			connector: async (callback, message) => {
				sent.push(message);
				callback('reply', true);
			}
		});

		await chat.send(content);

		expect(sent).toEqual([originalContent]);
		expect(content).toEqual(originalContent);
		expect(chat.messages).toEqual([
			{ role: 'user', content: originalContent },
			{ role: 'assistant', content: 'reply' }
		]);
	});

	test.each(['!', ''])('streaming with final delta \'%s\'', async (finalDelta) => {
		const chat= chatbot.chatbot({
			connector: async (callback) => {
				for (const delta of ['HE', 'L', 'LO']) {
					await Promise.resolve();
					callback(delta, false);
				}
				await Promise.resolve();
				callback(finalDelta, true);
			}
		});
		/** @type {Array<chatbot.Change>} */
		const log= [];
		chat.observe({ update: changes => log.push(...changes) });

		await chat.send('hello');

		const reply= chat.messages[1];
		expect(chat.messages).toEqual([
			{ role: 'user', content: 'hello' },
			{ role: 'assistant', content: 'HELLO' + finalDelta }
		]);
		expect(log.map(change => change.action)).toEqual([
			'add', 'sent', 'add', 'readyToSend',
			'updateProperty', 'updateProperty', 'updateProperty', 'updateProperty',
			'readyToSend', 'received'
		]);
		const updates= log.filter(change => change.action === 'updateProperty');
		expect(updates.map(change => change.value)).toEqual(['HE', 'HEL', 'HELLO', 'HELLO' + finalDelta]);
		expect(updates.map(change => change.end)).toEqual([false, false, false, true]);
		expect(updates.every(change => change.property === 'content' && change.msgObj === reply)).toBe(true);
		expect(log.filter(change => change.action === 'readyToSend').map(change => change.value)).toEqual([false, true]);
		expect(log[log.length - 1]).toEqual({ action: 'received', msgObj: reply, end: true });
	});

	/** @type {Array<{name: string, content: chatbot.ContentArray}>} */
	const arrayReplyCases= [
		{ name: 'text before an image', content: [
			{ type: 'text', text: 'Hello' },
			{ type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
			{ type: 'text', text: 'Leave this text unchanged' }
		] },
		{ name: 'text after an image', content: [
			{ type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
			{ type: 'text', text: 'Hello' },
			{ type: 'text', text: 'Leave this text unchanged' }
		] },
		{ name: 'an image without text', content: [
			{ type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
		] }
	];

	test.each(arrayReplyCases)('resume streaming array content containing $name', async ({ content }) => {
		const chat= chatbot.chatbot({
			connector: async (callback) => {
				callback(' world', false);
				await Promise.resolve();
				callback('!', true);
			}
		});
		const reply= { role: 'assistant', content };
		chat.reset([reply]);
		const originalContent= JSON.parse(JSON.stringify(content));
		const textIndex= content.findIndex(part => part.type === 'text');
		const updates= [];
		chat.observe({ update: changes => {
			for (const change of changes) {
				if (change.action === 'updateProperty' && change.property === 'content') {
					updates.push({ content: JSON.parse(JSON.stringify(change.value)), end: change.end });
				}
			}
		} });

		// @ts-ignore The implementation accepts undefined to resume the last assistant message.
		await chat.send(undefined);

		const partialContent= JSON.parse(JSON.stringify(originalContent));
		if (textIndex < 0) {
			partialContent.push({ type: 'text', text: ' world' });
		} else {
			partialContent[textIndex].text+= ' world';
		}
		const finalContent= JSON.parse(JSON.stringify(partialContent));
		finalContent[textIndex < 0 ? finalContent.length - 1 : textIndex].text+= '!';
		expect(updates).toEqual([
			{ content: partialContent, end: false },
			{ content: finalContent, end: true }
		]);
		expect(chat.messages).toEqual([{ role: 'assistant', content: finalContent }]);
		expect(chat.messages[0]).toBe(reply);
	});

	test('observe', async () => {
		const chat= chatbot.chatbot({connector: toUpperCaseConnector});
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

	test('connector failing on send', async () => {
		const chat= chatbot.chatbot({
			connector: () => new Promise(() => { throw new Error('expected failed connector') })
		});
		const log= [];
		const observer= {
			/** @type {(changes: Array.<chatbot.Change>) => void} */
			update: function(changes) {
				log.push(changes);
			}
		}
		chat.observe(observer);
		await chat.send('msg');
		expect(log.length).toBeGreaterThanOrEqual(1);
		const loggedError= log[log.length - 1][0];
		expect(loggedError.action).toBe('sendError');
		expect(loggedError.value).toBeInstanceOf(Error);
	});

	/**
	 * @type {chatbot.Connector}
	 */
	function toUpperCaseConnector(callback, msg) {
		return new Promise((resolve) => {
			// @ts-ignore
			callback(msg.toUpperCase(), true);
			resolve();
		});
	}

});