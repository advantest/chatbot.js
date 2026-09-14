
/** Matches a single line break: CRLF, LF or CR */
const LINE_BREAK= /\r\n|\n|\r/;

/**
 * Sends an HTTP request that expects a JSON response, either as a single JSON document or as an event stream
 * (server-sent events) whose `data` fields each contain a JSON document.
 *
 * @param {string} url - URL to send the HTTP request to.
 * @param {(data: unknown, done: boolean) => void} [callback] - Optional callback function that will be called with
 *   the parsed JSON response data and a boolean indicating if the request is done.
 * @param {string} [postData] - Request body, sent via POST. Without it, the request is sent via GET.
 * @param {boolean} [asStream] - Whether to read the response as an event stream instead of a single JSON document.
 * @returns {Promise<unknown>} A promise fulfilled after the final callback call, with the parsed JSON response in
 *   non-streamed mode and with `undefined` in streamed mode.
 * @throws {Error} Rejects on network failure, on an HTTP error status (message `HTTP <status> <statusText>`), on a
 *   missing response body, on JSON that cannot be parsed, and, in streamed mode, if the stream contains no `data` line
 *   (message `Empty response`).
 *
 * @example
 * // Non-streamed request
 * const data= await sendHttpRequest('v1/chat/completions', undefined, JSON.stringify(requestData));
 *
 * @example
 * // Streamed request
 * await sendHttpRequest('v1/chat/completions', (data, done) => {
 *     if (!done) console.log(data);
 * }, JSON.stringify({ ...requestData, stream: true }), true);
 *
 * @see {@link https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation|Interpreting
 * an event stream}
 */
export function sendHttpRequest(url, callback, postData, asStream) {
	return new Promise((resolve, reject) => {

		/** @type {RequestInit} */
		const fetchOptions= {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			}
		}
		if (typeof postData === 'string') {
			fetchOptions.method= 'POST';
			fetchOptions.body= postData;
		}

		fetch(url, fetchOptions).then(response => {
			if (!response.ok) {
				const errorText= `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
				reject(new Error(errorText));
				return;
			}
			if (!response.body) {
				reject(new Error('Response body is missing'));
				return;
			}
			const reader = response.body.getReader();
			const decoder = new TextDecoder('utf-8');

			// Stream: false
			if (!asStream) {
				let dataStr= '';
				reader.read().then(function processWholeResponse({ done, value }) {
					if (done) {
						dataStr += decoder.decode();
						const dataObj= JSON.parse(dataStr);
						if (callback !== undefined) {
							callback(dataObj, true);
						}
						resolve(dataObj);
						return;
					}
					dataStr += decoder.decode(value, { stream: true });
					return reader.read().then(processWholeResponse);
				}).catch((err) => reject(err));
				return;
			}

			// Streaming...
			let buffer= '';
			let received= false; // did we see at least one "data: ..." chunk?
			return reader.read().then(function processChunk({ done, value }) {
				if (done) {
					if (!received) {
						reject(new Error('Empty response'));
						return;
					}
					if (callback) {
						callback(undefined, true);
					}
					resolve(undefined);
					return;
				}
				buffer += decoder.decode(value, { stream: true });
				let lineBreak= LINE_BREAK.exec(buffer);
				while (lineBreak) {
					const line = buffer.slice(0, lineBreak.index);
					buffer= buffer.slice(lineBreak.index + lineBreak[0].length);
					try {
						const colonIndex= line.indexOf(':');
						if (colonIndex > 0 && line.slice(0, colonIndex) === 'data') {
							const field= line.slice(colonIndex + 1);
							if (field.trim() === '[DONE]') {
								if (callback) {
									callback(undefined, true);
								}
								resolve(undefined);
								return reader.cancel();
							} else {
								received= true;
								if (callback) {
									callback(JSON.parse(field), done);
								}
							}
						}
					} catch (err) {
						reject(err);
						return reader.cancel().catch(() => undefined);
					}
					lineBreak= LINE_BREAK.exec(buffer);
				}
				return reader.read().then(processChunk);
			});
		}).catch((err) => reject(err));
	});

}