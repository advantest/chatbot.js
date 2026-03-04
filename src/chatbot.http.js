// @ts-check

/**
 * @param {string} url
 * @param {(data: Record<string, unknown>|undefined, done: boolean) => void} [callback]
 * @param {string} [postData]
 * @param {boolean} [asStream]
 * @returns {Promise<unknown>}
 */
export function sendHttpRequest(url, callback, postData, asStream) {
	return new Promise(function(resolve /*, reject - TODO: error handling*/) {
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
			if (!response.body) return;
			const reader = response.body.getReader();
			const decoder = new TextDecoder('utf-8');

			// Stream: false
			if (!asStream) {
				var dataStr= '';
				reader.read().then(function(data) {
					dataStr += decoder.decode(data.value);
					const dataObj= JSON.parse(dataStr);
					if (callback !== undefined) {
						callback(dataObj, true);
					}
					resolve(dataObj);
				});
				return;
			}

			// Streaming...
			let buffer = '';
			return reader.read().then(function processChunk({ done, value }) {
				if (done) {
					if (callback !== undefined) {
						callback(undefined, true);
					}
					resolve(undefined);
					return;
				}
				buffer += decoder.decode(value, { stream: true });
				let boundary = buffer.indexOf('\n');
				while (boundary !== -1) {
					const line = buffer.slice(0, boundary);
					buffer = buffer.slice(boundary + 1);
					try {
						if (line.indexOf('data:') == 0 && line != 'data: [DONE]' && callback !== undefined) {
							callback(JSON.parse(line.substring('data:'.length)), done);
						}
					} catch (e) {
						break;
					}
					boundary= buffer.indexOf('\n');
				}
				return reader.read().then(processChunk);
			});
		});

	});
}