import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util';
import { sendHttpRequest } from './chatbot.http.js';

// @ts-ignore
if (typeof globalThis.TextEncoder === 'undefined') globalThis.TextEncoder= NodeTextEncoder;
// @ts-ignore
if (typeof globalThis.TextDecoder === 'undefined') globalThis.TextDecoder= NodeTextDecoder;

const URL= 'v1/chat/completions';

describe('chatbot.http.test.js', () => {

	afterEach(() => {
		// @ts-ignore
		delete globalThis.fetch;
	});

	test('simple request', async () => {
		mockFetch(['{"a": 1}']);
		const received= [];
		const result= await sendHttpRequest(URL, receiveFn(received));
		expect(result).toEqual({ a: 1 });
		expect(received).toEqual([[{ a: 1 }, true]]);
	});

	test('simple request of multiple chunks', async () => {
		mockFetch(['{"a":', ' 1}']);
		const received= [];
		const result= await sendHttpRequest(URL, receiveFn(received));
		expect(result).toEqual({ a: 1 });
		expect(received).toEqual([[{ a: 1 }, true]]);
	});

	test('simple request with broken JSON response', async () => {
		mockFetch(['{', '   ', '{broken JSON]]']);
		const received= [];
		await expect(sendHttpRequest(URL, receiveFn(received), undefined, false)).rejects.toThrow(Error);
		expect(received).toEqual([]);
	});

	test('streamed request', async () => {
		mockFetch(['data: {"i":1}\ndata: {"i"', ':2}\n', 'data: [DONE]\n']);
		const received= [];
		const result= await sendHttpRequest(URL,  receiveFn(received), '{}', true);
		expect(result).toBe(undefined);
		expect(received).toEqual([[{ i: 1 }, false], [{ i: 2 }, false], [undefined, true]]);
	});

	test('streamed request without [DONE] at the end', async () => {
		mockFetch(['data: {"i":1}\ndata: {"i"', ':2}\n']);
		const received= [];
		const result= await sendHttpRequest(URL,  receiveFn(received), '{}', true);
		expect(result).toBe(undefined);
		expect(received).toEqual([[{ i: 1 }, false], [{ i: 2 }, false], [undefined, true]]);
	});

	test('streamed request with broken JSON stream event', async () => {
		mockFetch(['data: {"i1":1}\ndata: {"i2"', '\n', 'data: {"i3":3}\n', 'data: [DONE]\n']);
		const received= [];
		await expect(sendHttpRequest(URL, receiveFn(received), undefined, true)).rejects.toThrow(Error);
		expect(received).toEqual([[{ i1: 1 }, false]]);
	});

	test('streamed request without a space after "data:"', async () => {
		mockFetch(['data:{"i":1}\ndata:{"i":2}\n', 'data:[DONE]\n']);
		const received= [];
		const result= await sendHttpRequest(URL, receiveFn(received), '{}', true);
		expect(result).toBe(undefined);
		expect(received).toEqual([[{ i: 1 }, false], [{ i: 2 }, false], [undefined, true]]);
	});

	test('streamed request with mixed line endings, CRLF, LF and CR', async () => {
		mockFetch(['data: {"i":1}\n\rdata: {"i":2}\r', '\ndata: {"i":3}\n', 'data: [DONE]\r']);
		const received= [];
		const result= await sendHttpRequest(URL, receiveFn(received), '{}', true);
		expect(result).toBe(undefined);
		expect(received).toEqual([[{ i: 1 }, false], [{ i: 2 }, false], [{ i: 3 }, false], [undefined, true]]);
	});

	test('streamed request with comment lines and other fields', async () => {
		mockFetch([': keep-alive\n', 'event: message\nid: 42\nretry: 1000\n', 'data: {"i":1}\n', 'data: [DONE]\n']);
		const received= [];
		const result= await sendHttpRequest(URL, receiveFn(received), '{}', true);
		expect(result).toBe(undefined);
		expect(received).toEqual([[{ i: 1 }, false], [undefined, true]]);
	});

	test('connection error', async () => {
		const errorMessage= `Failed to fetch from $URL`;
		globalThis.fetch= () => Promise.reject(new TypeError(errorMessage));
		const received= [];
		/** @type {Error|any} */
		const err= await sendHttpRequest(URL, receiveFn(received), undefined, true).catch(e => e);
		expect(err).toBeInstanceOf(TypeError);
		expect(err.message).toBe(errorMessage);
	});

	test('HTTP error', async () => {
		mockFetch([], { ok: false, status: 404, statusText: 'Not Found' });
		/** @type {Error|any} */
		const err= await sendHttpRequest(URL, receiveFn([]), '{}', true).catch(e => e);
		expect(err.message).toContain('404');
		expect(err.message).toContain('Not Found');
	});

	for (const streamed of [false, true]) {
		test(`${streamed ? 'streamed ' : ''}response without a body`, async () => {
			mockFetch([], { ok: true, status: 200, statusText: 'OK', body: null });
			await expect(sendHttpRequest(URL, undefined, undefined, streamed)).rejects.toThrow();
		});
	}

	test('streamed request with response.body containing only whitespace', async () => {
			mockFetch(['  ', ' \n  ', '\t\t\n', ' \n ', '\n\n' ]);
			const received= [];
			await expect(sendHttpRequest(URL, receiveFn(received), '{}', true)).rejects.toThrow(Error);
			expect(received.length).toBe(0);
		});

	test('failing callback', async () => {
		mockFetch(['data: {"i":1}\ndata: {"i":2}\ndata: [DONE]\n']);
		const received= [];

		/** @type {(data: any, done: boolean) => void} */
		const failingCallback= (data, done) => {
			received.push([data, done]);
			throw new Error('rendering failed');
		}

		await expect(sendHttpRequest(URL, failingCallback, '{}', true)).rejects.toThrow();

		// Stopped after the first (failing) chunk
		expect(received).toEqual([[{ i: 1 }, false]]);
	});

	test('failing callback should cancel the reading immediately', async () => {
		const controls=
			mockFetch(['data: {"i":1}\n', 'data: {"i":2}\n', 'data: {"i":3}\n', 'data: {"i":4}\n', 'data: [DONE]\n']);
		const received= [];

		/** @type {(data: any, done: boolean) => void} */
		const failingCallback= (data, done) => {
			if (data.i == 3) throw new Error('rendering failed');
			received.push([data, done]);
		};

		await expect(sendHttpRequest(URL, failingCallback, '{}', true)).rejects.toThrow();
		expect(received).toEqual([[{ i: 1 }, false], [{ i: 2 }, false]]);

		// Expected to be cancelled immediately on reading the i3
		expect(controls.readCalls).toBe(3);
		expect(controls.cancelCalls).toBe(1);
	});

    /**
     * Mocks `fetch` with a response whose body consists of the given chunks; a chunk that is an `Error` is thrown
     * while reading the body.
	 *
     * @param {Array.<string|Error>} chunks
     * @param {Record<string, unknown>} [init]
     */
	function mockFetch(chunks, init) {
		const encoder= new TextEncoder();
		let i= 0;
		let readCalls= 0;
		let cancelCalls= 0;
		// @ts-ignore
		globalThis.fetch= () => Promise.resolve({
			ok: init && init.ok !== undefined ? init.ok : true,
			status: init && init.status !== undefined ? init.status : 200,
			statusText: init && init.statusText !== undefined ? init.statusText : 'OK',
			text: () => Promise.resolve(init && init.text !== undefined ? init.text : ''),
			body: init && init.body === null ? null : {
				getReader: () => ({
					read: () => {
						readCalls += 1;
						if (i >= chunks.length) return Promise.resolve({ done: true, value: undefined });
						const chunk= chunks[i++];
						if (chunk instanceof Error) return Promise.reject(chunk);
						return Promise.resolve({ done: false, value: encoder.encode(chunk) });
					},
					cancel: () => {
						cancelCalls += 1;
						return Promise.resolve();
					}
				})
			}
		});
		return {
			get readCalls() { return readCalls; },
			get cancelCalls() { return cancelCalls; }
		};
	}

	/** @type {(received: Array.<any>) => ((data: any, done: boolean) => void)} */
	function receiveFn(received) {
		return (data, done) => received.push([data, done]);
	}

});