import * as chatbot from './chatbot.core.js';
import * as ui from './chatbot.ui.js';
import { jest } from '@jest/globals';

/**
 * @jest-environment jsdom
 */
describe('chatbot.ui.test.js - basics', () => {

	var bot;

	beforeEach(() => {
		document.body.innerHTML= '';
		bot= chatbot.chatbot({connector: toUpperCaseConnector});
		const config= {title: 'Dummy Title', footerHtml: '<span class="dummy-footer">FOOOTER</span>'};
		ui.chatbotUi(bot, queryExpectedElement('body'), config);
	});

	test('start', async () => {

		// elements that should exist at start
		['.-c-widget', '.-c-widget', '.-c-form', '.-c-footer'].
			forEach(element => expectElement(element, `Element not found: ${element}`).not.toBeNull());

		// elements that must not exist at start
		['.-c-msg', '-c-role-user', '-c-role-assistant'].
			forEach(element => expectElement(element, `Element exists, but shouldn't: ${element}`).toBeNull());

	});

	test('hi', async () => {
		await bot.send('hi');

		// elements that should exist at start
		['.-c-widget', '.-c-widget', '.-c-form', '.-c-footer', '.-c-msg', '.-c-role-user', '.-c-role-assistant'].
			forEach(element => expectElement(element,
				`Element not found: ${element} - body HTML: ${queryExpectedElement('body').innerHTML}`).not.toBeNull());
	});

	test('code copy button', async () => {
		document.body.innerHTML= '';
		const codeBot= chatbot.chatbot({connector: createConnector('```\nconsole.log("hello");\n```')});
		ui.chatbotUi(codeBot, queryExpectedElement('body'), {});
		await codeBot.send('hi');

		expectElement('.-c-code-block', 'code block wrapper').not.toBeNull();
		expectElement('.-c-code-header', 'code block header').not.toBeNull();
		expectElement('.-c-code-copy', 'copy button').not.toBeNull();
		expect(document.querySelectorAll('.-c-code-copy').length, 'one copy button per code block').toBe(1);
	});

	test('custom title and footer', async () => {
		const titleElement= queryExpectedElement('.-c-title');
		expectElement('.-c-title', 'Title element not found: .-c-title').not.toBeNull();
		expect(titleElement.textContent, 'No "Dummy Title"').toBe('Dummy Title');

		const footerElement= queryExpectedElement('.-c-footer');
		expectElement('.-c-footer', 'Title element not found: .-c-footer').not.toBeNull();
		expectElement('.dummy-footer', 'Custom footer element not found: .dummy-footer').not.toBeNull();
		expect(footerElement.innerHTML, '').toBe('<span class="dummy-footer">FOOOTER</span>');

		await bot.send('hi');
		expectElement('.-c-title', 'Title element not found: .-c-title').not.toBeNull();
		expectElement('.dummy-footer', 'Custom footer element not found: .dummy-footer').not.toBeNull();

	});

	test.each([
		['This is an image: ![](image0.jpg) ...', undefined, 'one.jpg', undefined],
		['... ![my alt text](image1.jpg) ...', undefined, 'path/to/i2.jpg', 'my alt text'],
		['![<hello>, \\[image\\]!!!](image1.jpg)', undefined, 'path/to/i2.jpg', '<hello>, [image]!!!'],
		['![](image0.jpg)', 'https://example.com/assets/', 'https://example.com/assets/one.jpg', undefined],
		['![alt text](image1.jpg)', 'https://example.com/img/', 'https://example.com/img/path/to/i2.jpg', 'alt text'],
		['![foo](img1.jpg)', undefined, 'img1.jpg', 'foo'], // Do not resolve images that do not match "image<n>.<ext>"
	])('response containing an image: %j', async (md, imagesBaseUrl, expectedSrc, expectedAlt) => {
		document.body.innerHTML= '';
		const refs= [ {h: 'target1.html', i: 'one.jpg'}, {h: 'target2.html', i: 'path/to/i2.jpg'} ];
		const config= {connector: createConnector(md, refs)};
		if (imagesBaseUrl) {
			config.imagesBaseUrl= imagesBaseUrl;
		}
		const bot= chatbot.chatbot(config);
		ui.chatbotUi(bot, queryExpectedElement('body'), {});
		await bot.send('hi');
		/** @type {HTMLImageElement} */ // @ts-ignore
		const img= queryExpectedElement('.-c-role-assistant .-c-msg.-c-md img');
		expect(img.getAttribute('src')).toBe(expectedSrc);
		if (expectedAlt) {
			expect(img.getAttribute('alt')).toBe(expectedAlt);
		} else {
			// in markdown-it `![](...)` becomes `<img src="..." alt>`,
			// but `<img src="...">` or `<img src="..." alt="">` would also be okay
			expect(!img.hasAttribute('alt') || !img.getAttribute('alt') || img.getAttribute('alt') === '').toBe(true);
		}
	});

	test.each([
		'Just a link: [just a link](image0.jpg)',
		'[just a link](image0.jpg)',
		'This is not an image: \\![just a link](image0.jpg)',
		'Code phrase: `![](image0.jpg)` ...',
		'Code block:\n\n```\n![](image0.jpg)\n```',
	])('response should not contain an image: %j', async (md) => {
		document.body.innerHTML= '';
		const refs= [ {h: 'target.html', i: 'path/to/image.jpg'}, {h: 'target2.html', i: 'path/to/i2.jpg'} ];
		const bot= chatbot.chatbot( {connector: createConnector(md, refs)} );
		ui.chatbotUi(bot, queryExpectedElement('body'), {});
		await bot.send('hi');
		expect(document.querySelector('.-c-role-assistant .-c-msg.-c-md img'),
			'image in response, where it should not').toBeNull();
	});

	[false, true].forEach(afterReset => {
		test('sources button and sidebar' + (afterReset ? ' after reset' : ''), async () => {
			document.body.innerHTML= '';
			const refs= [ {h: 't1.html', t: 'Title 1'}, {h: 't2.html', t: 'Title 2'}, {h: 't3.html', t: 'Title 3'} ];
			const bot= chatbot.chatbot( {connector: afterReset ? createConnector('.')
				: createConnector('This[[1]]', refs)} );
			ui.chatbotUi(bot, queryExpectedElement('body'), {});
			if (afterReset) {
				bot.reset([
					{role: 'user', content: 'Hi'},
					{role: 'assistant', content: 'This[[1]]', refs: refs},
				]);
				await bot.send('follow-up question');
			} else {
				await bot.send('hi');
			}
			expect(document.querySelector('.-c-sources'), '"Sources" sidebar closed').toBeNull();
			/** @type {HTMLImageElement} */ // @ts-ignore
			const sourcesBtn= queryExpectedElement('.-c-role-assistant .-c-tbar .-c-btn-sources');
			sourcesBtn.click();
			expect(document.querySelector('.-c-sources'), '"Sources" sidebar opened').not.toBeNull();
			expect(document.querySelectorAll('.-c-sources .-c-ref-').length).toBe(1);
			expect(document.querySelectorAll('.-c-sources .-c-more li').length).toBe(2);
		});
	});

});

/**
 * @jest-environment jsdom
 */
describe('chatbot.ui.test.js - error handling', () => {
	beforeEach(() => {
		document.body.innerHTML= '';
	});

	const ERROR_BTN_DEFAULTS= {retry: true, newChat: false, revert: false};
	const ERROR_413_BTN_DEFAULTS= {retry: false, newChat: true, revert: false};
	test.each([

		// Defaults
		[{}, undefined, 'Something went wrong.', ERROR_BTN_DEFAULTS],
		[{}, 403, 'Something went wrong.', ERROR_BTN_DEFAULTS],
		[{}, 413, 'Request is too large.', ERROR_413_BTN_DEFAULTS],

		// Custom error messages - strings
		[{ errorMsg: 'Oops' }, 404, 'Oops', ERROR_BTN_DEFAULTS],
		[{ error404Msg: 'Not found.' }, 404, 'Not found.', ERROR_BTN_DEFAULTS],
		[{ error404Msg: 'Not found.' }, 403, 'Something went wrong.', ERROR_BTN_DEFAULTS],
		[{ errorMsg: 'Oops' }, 413, 'Request is too large.', ERROR_413_BTN_DEFAULTS],
		[{ errorMsg: 'Oops', error41xMsg: '41x!', error413Msg: '413!' }, 413, '413!', ERROR_413_BTN_DEFAULTS],
		[{ errorMsg: 'Oops', error41xMsg: '41x!', error403Msg: '403!' }, 413, '41x!', ERROR_413_BTN_DEFAULTS],
		[{ errorMsg: 'Oops', error4xxMsg: '4xx!', error414Msg: '414!' }, 413, '4xx!', ERROR_413_BTN_DEFAULTS],

		// Custom error messages - HTML
		[{ errorMsg: {text: '<Oops>'} }, 403, '&lt;Oops&gt;', ERROR_BTN_DEFAULTS],
		[{ errorMsg: {html: '<b>Oops</b>'}, error413Msg: '413!' }, 403, '<b>Oops</b>', ERROR_BTN_DEFAULTS],
		[{ errorMsg: {html: '<b>Oops</b>'}, error413Msg: '413!' }, 413, '413!', ERROR_413_BTN_DEFAULTS],
		[{ errorMsg: ':(', error413Msg: {text: '<Oops>'} }, 413, '&lt;Oops&gt;', ERROR_BTN_DEFAULTS],
		[{ errorMsg: ':(', error413Msg: {text: '...', html: '<b>Oops</b>'} }, 413, '<b>Oops</b>', ERROR_BTN_DEFAULTS],

		// Custom error messages - buttons
		[{ errorMsg: '.', error413Msg: {text: '.', retryBtn: false} }, 403, '.', ERROR_BTN_DEFAULTS],
		[{ errorMsg: '.', error413Msg: {text: '.', retryBtn: false} }, 413, '.', {retry: false, newChat: false, revert: false}],
		[{ errorMsg: {text: '.', revertBtn: true} }, 403, '.', {retry: true, newChat: false, revert: true}],
		[{ errorMsg: {text: '.', retryBtn: false, newChatBtn: true} }, 403, '.', {retry: false, newChat: true, revert: false}],
		[{ errorMsg: {text: '.', newChatBtn: true, revertBtn: true} }, 403, '.', {retry: true, newChat: true, revert: true}],
		[{ error413Msg: {text: '.', newChatBtn: true, revertBtn: true} }, 413, '.', {retry: true, newChat: true, revert: true}],

	])('error message for config %O and status %s should be: %s - expected buttons: %O',
			async (config, status, expectedMsgHtml, expectedBtns) => {
		const error= status === undefined ? new Error('Error without HTTP status') : httpError(status);
		const bot= chatbot.chatbot({ connector: () => Promise.reject(error) });
		ui.chatbotUi(bot, document.body, config);
		await bot.send('hi');
		expect(queryExpectedElement('.-c-error p').innerHTML).toBe(expectedMsgHtml);
		/** @type {Array<[btnExists: boolean, btnSelector: string, btnDesc: string]>} */
		([
			[expectedBtns.retry, '.-c-errorRetry', '"Retry" button in error panel'],
			[expectedBtns.newChat, '.-c-errorNewChat', '"New Chat" button in error panel'],
			[expectedBtns.revert, '.-c-errorRevert', '"Revert Last Message" button in error panel'],
		]).forEach(([btnExists, btnSelector, btnDesc]) => {
			const expectBtn= expectElement(btnSelector, btnDesc);
			if (btnExists) {
				expectBtn.not.toBeNull();
			} else {
				expectBtn.toBeNull();
			}
		});
	});

	test('on error, "Retry" resends the failed request', async () => {
		let attempts= 0;
		/** @type {chatbot.Connector} */
		const connector= (callback) => {
			attempts++;
			if (attempts === 1) return Promise.reject(httpError(413));
			callback('success', true);
			return Promise.resolve();
		};
		const bot= chatbot.chatbot({ connector: connector });
		ui.chatbotUi(bot, document.body, { error413Msg: { text: 'try again', retry: true } });

		// First attempt => fail
		await bot.send('hi');
		expect(attempts).toBe(1);
		expectElement('.-c-error', 'error panel').not.toBeNull();

		// Retry => success
		queryExpectedElement('.-c-errorRetry').click();
		expect(bot.messages?.length).toBe(2);
		expect(attempts).toBe(2);
		expectElement('.-c-error', 'error panel').toBeNull();
		expect(queryExpectedElement('.-c-role-assistant .-c-msg').textContent?.trim()).toBe('success');
	});

	test('on error, "New Chat" starts a new chat', async () => {
		const bot= chatbot.chatbot({ connector: failingConnector([2], 413) });
		ui.chatbotUi(bot, document.body, {});

		// First question => success; second question => fail
		await bot.send('question 1');
		expectElement('.-c-error', 'error panel').toBeNull();
		await bot.send('question 2');
		expectElement('.-c-error', 'error panel').not.toBeNull();
		expect(document.querySelectorAll('.-c-msg-p.-c-role-user').length, 'two user messages').toBe(2);

		// "New Chat" => empty chat
		queryExpectedElement('.-c-errorNewChat').click();
		expectElement('.-c-error', 'error panel').toBeNull();
		expectElement('.-c-msg', 'any message').toBeNull();
		expect(bot.messages, 'no messages').toEqual([]);
		expect(queryExpectedElement('.-c-widget').classList.contains('-c-splash'), 'splash screen').toBe(true);

		// New chat works
		await bot.send('new question');
		expectElement('.-c-msg-p.-c-role-user', 'user message').not.toBeNull();
		expectElement('.-c-msg-p.-c-role-assistant', 'response message').not.toBeNull();
		expect(document.querySelectorAll('.-c-msg-p').length, 'one user messages and one response').toBe(2);
		expect(queryExpectedElement('.-c-role-assistant .-c-msg').textContent?.trim()).toBe('answer 3');
		// @ts-ignore
		expect(queryExpectedElement('.-c-input').value).toBe('');
	});

	test('on error, "Revert Last Message" reverts the last user message and the failed response to it', async () => {
		const bot= chatbot.chatbot({ connector: failingConnector([2], 500) });
		ui.chatbotUi(bot, document.body, { errorMsg: { text: 'Oops', revertBtn: true } });

		// First question => success; second question => fail
		await bot.send('question 1');
		expectElement('.-c-error', 'error panel').toBeNull();
		await bot.send('question 2');
		expectElement('.-c-error', 'error panel').not.toBeNull();
		expect(document.querySelectorAll('.-c-msg-p.-c-role-user').length, 'two user messages').toBe(2);

		// "Revert Last Message" => only first question and its answer remain; reverted question in input field
		queryExpectedElement('.-c-errorRevert').click();
		expectElement('.-c-error', 'error panel').toBeNull();
		expect(bot.messages.map(msgObj => [msgObj.role, msgObj.content]))
			.toEqual([['user', 'question 1'], ['assistant', 'answer 1']]);
		expect(Array.from(document.querySelectorAll('.-c-role-user .-c-msg')).map(el => el.textContent))
			.toEqual(['question 1']);
		expect(Array.from(document.querySelectorAll('.-c-role-assistant .-c-msg')).map(el => el.textContent?.trim()))
			.toEqual(['answer 1']);
		/** @type {HTMLTextAreaElement} */ // @ts-ignore
		const input= queryExpectedElement('.-c-form .-c-input');
		expect(input.value, 'reverted question in input field').toBe('question 2');
		/** @type {HTMLButtonElement} */ // @ts-ignore
		const sendBtn= queryExpectedElement('.-c-form .-c-send');
		expect(sendBtn.disabled, 'send button enabled').toBe(false);

		// Resending works
		await bot.send(input.value);
		expect(Array.from(document.querySelectorAll('.-c-role-assistant .-c-msg')).map(el => el.textContent?.trim()))
			.toEqual(['answer 1', 'answer 3']);
	});

	/**
	 * @param {Array<number>} failingAttempts - 1-based numbers of the attempts that fail
	 * @param {number} status - HTTP status of the failing attempts
	 * @returns {chatbot.Connector} connector answering with "answer <attempt>" unless the attempt fails
	 */
	function failingConnector(failingAttempts, status) {
		let attempts= 0;
		return (callback) => {
			attempts++;
			if (failingAttempts.includes(attempts)) return Promise.reject(httpError(status));
			callback('answer ' + attempts, true);
			return Promise.resolve();
		};
	}

	/** @type {(status: number) => Error} */
	function httpError(status) {
		const error= new Error('request failed');
		error['http']= status;
		return error;
	}

});

/**
 * @jest-environment jsdom
 */
describe('chatbot.ui.test.js - question navigation rail', () => {

	async function ask(bot, n) {
		for (let i= 1; i <= n; i++) {
			await bot.send('question ' + i);
		}
	}

	function newUi(config) {
		document.body.innerHTML= '';
		const bot= chatbot.chatbot({ connector: toUpperCaseConnector });
		ui.chatbotUi(bot, queryExpectedElement('body'), config || {});
		return bot;
	}

	test('rail exists but is hidden below the threshold', async () => {
		const bot= newUi();
		await ask(bot, 3);
		const rail= queryExpectedElement('.-c-qnav');
		expect(rail, 'rail element should exist').not.toBeNull();
		expect(rail.hidden, 'rail hidden with 3 questions (default threshold 4)').toBe(true);
	});

	test('rail becomes visible at the threshold with one anchor per user question', async () => {
		const bot= newUi();
		await ask(bot, 4);
		const rail= queryExpectedElement('.-c-qnav');
		expect(rail.hidden, 'rail visible at 4 questions').toBe(false);
		expect(document.querySelectorAll('.-c-qnav-item').length,
			'one anchor per user question, assistant replies excluded').toBe(4);
	});

	test('anchor label matches the user question text', async () => {
		const bot= newUi();
		await ask(bot, 4);
		const labels= Array.from(document.querySelectorAll('.-c-qnav-label')).map(el => el.textContent);
		expect(labels, 'labels in order').toEqual(['question 1', 'question 2', 'question 3', 'question 4']);
	});

	test('questionNavThreshold config lowers the trigger', async () => {
		const bot= newUi({ questionNavThreshold: 2 });
		await ask(bot, 2);
		expect(queryExpectedElement('.-c-qnav').hidden, 'visible after 2 with threshold 2').toBe(false);
	});

	test('questionNav:false disables the feature entirely', async () => {
		const bot= newUi({ questionNav: false });
		await ask(bot, 5);
		expect(document.querySelector('.-c-qnav'), 'no rail when disabled').toBeNull();
	});

	test('clicking an anchor marks exactly one item active', async () => {
		const bot= newUi();
		await ask(bot, 4);
		const items= document.querySelectorAll('.-c-qnav-item');
		// @ts-ignore
		items.item(1).click();
		const active= document.querySelectorAll('.-c-qnav-item.-c-active');
		expect(active.length, 'exactly one active anchor').toBe(1);
		expect(active.item(0), 'clicked anchor is active').toBe(items.item(1));
	});

	test('reset clears the rail', async () => {
		const bot= newUi();
		await ask(bot, 4);
		bot.reset();
		const rail= queryExpectedElement('.-c-qnav');
		expect(rail.hidden, 'rail hidden after reset').toBe(true);
		expect(document.querySelectorAll('.-c-qnav-item').length, 'no anchors after reset').toBe(0);
	});

});

/**
 * @jest-environment jsdom
 */
describe('chatbot.ui.test.js - attaching images', () => {

	/** @type {Array<chatbot.Content | undefined>} */
	let sentMessages;

	test('no attach controls without \'attach: true\'', () => {
		newUi();
		expect(document.querySelector('.-c-form .-c-attach'), 'no attach button').toBeNull();
		expect(document.querySelector('.-c-form input.-c-file'), 'no file picker').toBeNull();
		expect(document.querySelector('.-c-form .-c-thumbs'), 'no attached area').toBeNull();
	});

	test('attach controls with \'attach: true\'', () => {
		newUi({ attach: true });
		expectElement('.-c-form .-c-attach', 'attach button');
		expect(picker().hidden, 'file picker hidden').toBe(true);
		expect(picker().multiple, 'multiple files selectable without attachMax').toBe(true);
		expect(picker().accept, 'default accept').toBe('image/*');
		expect(attachedArea().hidden, 'attached area hidden while empty').toBe(true);
		expect(attachedUrls(), 'nothing attached').toEqual([]);
	});

	test('\'attachAccept\' config sets the accept attribute of the file picker', () => {
		newUi({ attach: true, attachAccept: '.png,.jpg' });
		expect(picker().accept).toBe('.png,.jpg');
	});

	['file chooser', 'paste', 'drop'].forEach(source => {
		test.each([
			['image/png,image/jpeg', 'image/png', 'picture.bin', true],
			['image/png,image/jpeg', 'image/jpeg', 'picture.bin', true],
			['image/png,image/jpeg', 'image/gif', 'picture.png', false],
			['.png,.jpg', 'image/png', 'PICTURE.PNG', true],
			['.png,.jpg', 'image/jpeg', 'picture.jpg', true],
			['.png,.jpg', 'image/png', 'picture.png.bak', false],
			[' , IMAGE/JPEG , .PNG , ', 'image/jpeg', 'picture.bin', true],
			[' , IMAGE/JPEG , .PNG , ', 'image/png', 'picture.png', true],
			['.png, IMAGE/* ', 'image/gif', 'picture.gif', true],
			['image/*', 'text/plain', 'picture.png', false],
			['.png,text/plain', 'text/plain', 'picture.png', false],
			['.png', '', 'picture.png', false],
			['', 'image/png', 'picture.png', false],
			[' , text/plain, png, ', 'image/png', 'picture.png', false],
		])('\'attachAccept: %s\' with %s named \'%s\': expected %s via ' + source, async (accept, type, name, accepted) => {
			newUi({ attach: true, attachAccept: accept });
			const file= new File(['a'], name, { type: type });
			const expectedCount= accepted ? 1 : 0;
			if (source == 'file chooser') {
				await choose([file], expectedCount);
			} else if (source == 'paste') {
				paste(clipboardWithItem(file));
				await waitForAttachedCount(expectedCount);
			} else {
				drop({ items: [], files: [file] });
				await waitForAttachedCount(expectedCount);
			}
			expect(attachedUrls()).toEqual(accepted ? [dataUrl('a', type)] : []);
			expect(attachedArea().hidden).toBe(!accepted);
		});
	});

	test('attach button opens the file chooser', () => {
		newUi({ attach: true });
		let clicked= 0;
		picker().click= () => { clicked++; };
		// @ts-ignore
		queryExpectedElement('.-c-form .-c-attach').click();
		expect(clicked, 'file chooser opened once').toBe(1);
	});

	test('without \'attachMax\': attach multiple images via file chooser', async () => {
		newUi({ attach: true });
		await choose([imageFile('a'), imageFile('b'), imageFile('c')], 3);
		expect(attachedArea().hidden, 'attached area visible').toBe(false);
		expect(attachedUrls().sort()).toEqual([dataUrl('a'), dataUrl('b'), dataUrl('c')]);
		await choose([imageFile('d')], 4);
		expect(attachedUrls().sort()).toEqual([dataUrl('a'), dataUrl('b'), dataUrl('c'), dataUrl('d')]);
	});

	test('no duplicates via file chooser, paste, and drop', async () => {
		newUi({ attach: true });
		await choose([imageFile('a'), imageFile('a')], 1);
		await choose([imageFile('a')], 1);
		paste(clipboardWithItem(imageFile('a')));
		await waitForAttachedCount(1);
		drop({ items: [], files: [imageFile('a')] });
		await waitForAttachedCount(1);
		expect(attachedUrls()).toEqual([dataUrl('a')]);
		await choose([imageFile('b'), imageFile('a')], 2);
		expect(attachedUrls().sort()).toEqual([dataUrl('a'), dataUrl('b')]);
	});

	test('attach image via paste', async () => {
		newUi({ attach: true });

		// as clipboard item
		const event= paste(clipboardWithItem(imageFile('a')));
		expect(event.defaultPrevented, 'pasting an image prevents the default').toBe(true);
		await waitForAttachedCount(1);
		expect(attachedUrls()).toEqual([dataUrl('a')]);

		// as clipboard file (e.g. copied in a file manager)
		paste({ items: [], files: [imageFile('b', 'image/jpeg')] });
		await waitForAttachedCount(2);
		expect(attachedUrls()).toEqual([dataUrl('a'), dataUrl('b', 'image/jpeg')]);
	});

	test.each(['items', 'files', 'items and files', 'partial items'])('paste all images via clipboard %s', async source => {
		newUi({ attach: true });
		const files= [imageFile('a'), new File(['x'], 'x.txt', { type: 'text/plain' }),
			imageFile('b', 'image/jpeg'), imageFile('c')];
		const items= files.map(file => clipboardWithItem(file).items[0]);
		const event= paste({
			items: source == 'files' ? [] : (source == 'partial items' ? items.slice(0, 1) : items),
			files: source == 'items' ? [] : files
		});
		expect(event.defaultPrevented, 'pasting images prevents the default').toBe(true);
		await waitForAttachedCount(3);
		expect(attachedArea().hidden).toBe(false);
		expect(attachedUrls(), 'all images attached once in clipboard order; non-images skipped')
			.toEqual([dataUrl('a'), dataUrl('b', 'image/jpeg'), dataUrl('c')]);
	});

	test('pasting multiple images respects attachAccept, duplicates and attachMax', async () => {
		newUi({ attach: true, attachAccept: 'image/png', attachMax: 2 });
		const files= [imageFile('a'), imageFile('rejected', 'image/jpeg'),
			imageFile('b'), imageFile('b'), imageFile('c')];
		paste({ items: clipboardWithItem(files[0]).items, files: files });
		await waitFor(() => attachedUrls()[1] === dataUrl('c'), () => `Unexpected: ${attachedUrls()}`);
		await waitForAttachedCount(2);
		expect(attachedUrls(), 'only the last two distinct accepted images remain').toEqual([dataUrl('b'), dataUrl('c')]);
	});

	test('unavailable clipboard items are skipped when pasting multiple images', async () => {
		newUi({ attach: true });
		paste({ items: [
			{ kind: 'file', type: 'image/png', getAsFile: () => null },
			...clipboardWithItem(imageFile('a')).items,
			...clipboardWithItem(imageFile('b')).items
		], files: [] });
		await waitForAttachedCount(2);
		expect(attachedUrls()).toEqual([dataUrl('a'), dataUrl('b')]);
	});

	test('pasting non-images does not attach anything', async () => {
		newUi({ attach: true });
		const textItem= { kind: 'string', type: 'text/plain', getAsFile: () => null };
		const event= paste({ items: [textItem], files: [new File(['x'], 'x.txt', { type: 'text/plain' })] });
		expect(event.defaultPrevented, 'default paste behavior is kept').toBe(false);
		expect(attachedUrls()).toEqual([]);
		expect(attachedArea().hidden).toBe(true);
	});

	test('pasting a rejected image leaves accompanying text to the browser', async () => {
		newUi({ attach: true, attachAccept: 'image/png' });
		const event= paste({
			types: ['Files', 'text/plain'],
			items: [{ kind: 'string', type: 'text/plain' }],
			files: [imageFile('rejected', 'image/jpeg')]
		});
		expect(event.defaultPrevented).toBe(false);
		await waitForAttachedCount(0);
		expect(attachedUrls()).toEqual([]);
	});

	test.each(['paste', 'drop'])('%s uses the actual file type when an item omits its MIME type', async source => {
		newUi({ attach: true });
		const transfer= {
			items: [
				{ kind: 'file', type: '', getAsFile: () => imageFile('a') },
				{ kind: 'file', type: 'image/png', getAsFile: () => new File(['x'], 'x.png', { type: 'text/plain' }) }
			],
			files: []
		};
		const event= source == 'paste' ? paste(transfer) : drop(transfer);
		expect(event.defaultPrevented).toBe(true);
		await waitForAttachedCount(1);
		expect(attachedUrls()).toEqual([dataUrl('a')]);
	});

	test('pasting an image is ignored without \'attach: true\'', async () => {
		newUi();
		const event= paste(clipboardWithItem(imageFile('a')));
		expect(event.defaultPrevented).toBe(false);
		expect(document.querySelector('.-c-form .-c-thumb'), 'nothing attached').toBeNull();
	});

	test('attach image via drop onto main area and its child elements', async () => {
		newUi({ attach: true });

		// directly onto main area
		const e1= drop({ items: [], files: [imageFile('a')] }, dropTarget());
		expect(e1.defaultPrevented, 'dropping an image prevents the default').toBe(true);
		await waitForAttachedCount(1);
		expect(attachedUrls()).toEqual([dataUrl('a')]);

		// onto chat area via DataTransferItem
		const e2= drop(clipboardWithItem(imageFile('b', 'image/jpeg')), queryExpectedElement('.-c-chat'));
		expect(e2.defaultPrevented).toBe(true);
		await waitForAttachedCount(2);

		// onto input field
		const e3= drop({ items: [], files: [imageFile('c')] }, input());
		expect(e3.defaultPrevented).toBe(true);
		await waitForAttachedCount(3);
		expect(attachedUrls()).toEqual([dataUrl('a'), dataUrl('b', 'image/jpeg'), dataUrl('c')]);
	});

	test('dropping files on widget outside drop target prevents navigation without attaching', async () => {
		newUi({ attach: true }, { history: 'inmemory' });
		for (const outside of [queryExpectedElement('.-c-widget'), queryExpectedElement('.-c-history')]) {
			const transfer= { types: ['Files'], items: [{ kind: 'file', type: 'image/png' }], files: [], dropEffect: '' };
			drag('dragenter', transfer);
			expect(dropTarget().hasAttribute('data-dragover')).toBe(true);
			const enter= drag('dragenter', transfer, outside);
			const over= drag('dragover', transfer, outside);
			expect(dropTarget().hasAttribute('data-dragover'), 'moving outside clears the highlight before drop').toBe(false);
			const dropEvt= drop({ items: [], files: [imageFile('a')] }, outside);
			expect(enter.defaultPrevented, 'dragenter outside drop target not intercepted').toBe(false);
			expect(over.defaultPrevented, 'dragover prevented on widget so browser does not open file').toBe(true);
			expect(transfer.dropEffect, 'dropEffect set to none outside drop target').toBe('none');
			expect(dropEvt.defaultPrevented, 'drop prevented on widget so browser does not open file').toBe(true);
		}
		expect(dropTarget().hasAttribute('data-dragover')).toBe(false);
		await waitForAttachedCount(0);
		expect(attachedUrls()).toEqual([]);

		// Events outside the widget (on body/window) are not intercepted
		const outsideTransfer= { types: ['Files'], items: [{ kind: 'file', type: 'image/png' }], files: [] };
		expect(drag('dragover', outsideTransfer, document.body).defaultPrevented).toBe(false);
		expect(drop({ items: [], files: [imageFile('a')] }, document.body).defaultPrevented).toBe(false);
	});

	test('a child can handle the file drop without also attaching it to chat', async () => {
		newUi({ attach: true });
		const chat= queryExpectedElement('.-c-chat');
		const transfer= { files: [imageFile('a')], dropEffect: 'link' };
		drag('dragenter', transfer);
		chat.addEventListener('dragover', e => e.preventDefault(), { once: true });
		chat.addEventListener('drop', e => e.preventDefault(), { once: true });

		drag('dragover', transfer, chat);
		expect(transfer.dropEffect).toBe('link');
		expect(dropTarget().hasAttribute('data-dragover')).toBe(false);
		expect(drop(transfer, chat).defaultPrevented).toBe(true);
		await waitForAttachedCount(0);
		expect(attachedUrls()).toEqual([]);
	});

	test.each(['items', 'files', 'items and files', 'partial items'])('drop all images via dataTransfer %s', async source => {
		newUi({ attach: true });
		const files= [imageFile('a'), new File(['x'], 'x.txt', { type: 'text/plain' }),
			imageFile('b', 'image/jpeg'), imageFile('c')];
		const items= files.map(file => clipboardWithItem(file).items[0]);
		const event= drop({
			items: source == 'files' ? [] : (source == 'partial items' ? items.slice(0, 1) : items),
			files: source == 'items' ? [] : files
		});
		expect(event.defaultPrevented, 'dropping images prevents the default').toBe(true);
		await waitForAttachedCount(3);
		expect(attachedArea().hidden).toBe(false);
		expect(attachedUrls(), 'all images attached once in order; non-images skipped')
			.toEqual([dataUrl('a'), dataUrl('b', 'image/jpeg'), dataUrl('c')]);
	});

	test('dropping multiple images respects attachAccept, duplicates and attachMax', async () => {
		newUi({ attach: true, attachAccept: 'image/png', attachMax: 2 });
		const files= [imageFile('a'), imageFile('rejected', 'image/jpeg'),
			imageFile('b'), imageFile('b'), imageFile('c')];
		drop({ items: clipboardWithItem(files[0]).items, files: files });
		await waitFor(() => attachedUrls()[1] === dataUrl('c'), () => `Unexpected: ${attachedUrls()}`);
		await waitForAttachedCount(2);
		expect(attachedUrls(), 'only the last two distinct accepted images remain').toEqual([dataUrl('b'), dataUrl('c')]);
	});

	test('unavailable dataTransfer items are skipped when dropping multiple images', async () => {
		newUi({ attach: true });
		drop({ items: [
			{ kind: 'file', type: 'image/png', getAsFile: () => null },
			...clipboardWithItem(imageFile('a')).items,
			...clipboardWithItem(imageFile('b')).items
		], files: [] });
		await waitForAttachedCount(2);
		expect(attachedUrls()).toEqual([dataUrl('a'), dataUrl('b')]);
	});

	test('dropping non-image files prevents default without attaching anything', async () => {
		newUi({ attach: true });
		const event= drop({ items: [], files: [new File(['x'], 'x.txt', { type: 'text/plain' })] });
		expect(event.defaultPrevented, 'prevents browser from navigating to the file').toBe(true);
		await waitForAttachedCount(0);
		expect(attachedUrls()).toEqual([]);
		expect(attachedArea().hidden).toBe(true);
	});

	test('dragging and dropping plain text is not intercepted', () => {
		newUi({ attach: true });
		const textTransfer= {
			types: ['text/plain'],
			items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }],
			files: []
		};
		const enter= drag('dragenter', textTransfer);
		const over= drag('dragover', textTransfer);
		const dropEvt= drop(textTransfer, input());
		expect(enter.defaultPrevented, 'dragenter not intercepted').toBe(false);
		expect(over.defaultPrevented, 'dragover not intercepted').toBe(false);
		expect(dropEvt.defaultPrevented, 'drop not intercepted').toBe(false);
		expect(dropTarget().hasAttribute('data-dragover'), 'no data-dragover attribute').toBe(false);
		expect(attachedUrls()).toEqual([]);
	});

	test('dragging and dropping an image is ignored without \'attach: true\'', () => {
		newUi();
		const transfer= { types: ['Files'], items: [{ kind: 'file', type: 'image/png' }], files: [] };
		const enter= drag('dragenter', transfer);
		const over= drag('dragover', transfer);
		const dropEvt= drop(clipboardWithItem(imageFile('a')));
		expect(enter.defaultPrevented).toBe(false);
		expect(over.defaultPrevented).toBe(false);
		expect(dropEvt.defaultPrevented).toBe(false);
		expect(dropTarget().hasAttribute('data-dragover')).toBe(false);
		expect(document.querySelector('.-c-form .-c-thumb'), 'nothing attached').toBeNull();
	});

	test('drag-over highlight tracks entering, nested children, leaving, and dropping', async () => {
		newUi({ attach: true });
		const dragData= { types: ['Files'], items: [{ kind: 'file', type: 'image/png' }], files: [], dropEffect: '' };
		const enterMain= drag('dragenter', dragData, dropTarget());
		expect(enterMain.defaultPrevented).toBe(true);
		expect(dropTarget().hasAttribute('data-dragover'), 'highlighted on dragenter').toBe(true);

		const overChat= drag('dragover', dragData, queryExpectedElement('.-c-chat'));
		expect(overChat.defaultPrevented).toBe(true);
		expect(dragData.dropEffect).toBe('copy');
		expect(dropTarget().hasAttribute('data-dragover')).toBe(true);

		// Moving into a nested child fires dragenter on child and dragleave on parent with relatedTarget = child
		drag('dragenter', dragData, input());
		drag('dragleave', dragData, dropTarget(), input());
		expect(dropTarget().hasAttribute('data-dragover'), 'still highlighted while over nested child').toBe(true);

		// Leaving drop target completely removes the highlight
		drag('dragleave', dragData, input());
		expect(dropTarget().hasAttribute('data-dragover'), 'highlight removed on dragleave').toBe(false);

		// Dropping clears the highlight and attaches the image
		drag('dragenter', dragData, dropTarget());
		expect(dropTarget().hasAttribute('data-dragover')).toBe(true);
		drop({ items: [], files: [imageFile('a')] }, dropTarget());
		expect(dropTarget().hasAttribute('data-dragover'), 'highlight removed on drop').toBe(false);
		await waitForAttachedCount(1);
		expect(attachedUrls()).toEqual([dataUrl('a')]);
	});

	test('drag-over highlight is shown when browser omits MIME type during drag', () => {
		newUi({ attach: true });

		// types only (e.g. Safari during dragover)
		const typesOnly= { types: ['Files'], items: [], files: [], dropEffect: '' };
		drag('dragenter', typesOnly);
		expect(dropTarget().hasAttribute('data-dragover'), 'highlighted for Files type').toBe(true);
		drag('dragover', typesOnly);
		expect(typesOnly.dropEffect).toBe('copy');
		drag('dragleave', typesOnly);
		expect(dropTarget().hasAttribute('data-dragover')).toBe(false);

		// file item with empty MIME type
		const unknownType= { types: ['Files'], items: [{ kind: 'file', type: '' }], files: [], dropEffect: '' };
		drag('dragenter', unknownType);
		expect(dropTarget().hasAttribute('data-dragover'), 'highlighted for unknown MIME type').toBe(true);
		drag('dragover', unknownType);
		expect(unknownType.dropEffect).toBe('copy');
		drag('dragleave', unknownType);
		expect(dropTarget().hasAttribute('data-dragover')).toBe(false);
	});
	
	test('drag-over highlight is not shown for non-image or unaccepted file types', () => {
		newUi({ attach: true, attachAccept: 'image/png' });

		// non-image file
		const txtDrag= { types: ['Files'], items: [{ kind: 'file', type: 'text/plain' }], files: [], dropEffect: '' };
		drag('dragenter', txtDrag);
		expect(dropTarget().hasAttribute('data-dragover'), 'no highlight for text file').toBe(false);
		const txtOver= drag('dragover', txtDrag);
		expect(txtOver.defaultPrevented, 'dragover prevented so browser does not navigate').toBe(true);
		expect(txtDrag.dropEffect).toBe('none');
		expect(dropTarget().hasAttribute('data-dragover')).toBe(false);

		// unaccepted image MIME type
		const jpgDrag= { types: ['Files'], items: [{ kind: 'file', type: 'image/jpeg' }], files: [], dropEffect: '' };
		drag('dragenter', jpgDrag);
		expect(dropTarget().hasAttribute('data-dragover'), 'no highlight for rejected image type').toBe(false);
		const jpgOver= drag('dragover', jpgDrag);
		expect(jpgOver.defaultPrevented).toBe(true);
		expect(jpgDrag.dropEffect).toBe('none');
	});

	test('drag-over highlight is cleared when more precise data rules out the file', () => {
		newUi({ attach: true, attachAccept: '.png' });
		const transfer= { types: ['Files'], items: [{ kind: 'file', type: 'image/png' }], files: [], dropEffect: '' };
		drag('dragenter', transfer);
		expect(dropTarget().hasAttribute('data-dragover')).toBe(true);

		const withFiles= { ...transfer, files: [new File(['a'], 'picture.bin', { type: 'image/png' })] };
		expect(drag('dragover', withFiles).defaultPrevented).toBe(true);
		expect(withFiles.dropEffect).toBe('none');
		expect(dropTarget().hasAttribute('data-dragover')).toBe(false);
	});

	test('drag-over highlight is preserved across reset during drag', () => {
		const bot= newUi({ attach: true });
		const dragData= { types: ['Files'], items: [{ kind: 'file', type: 'image/png' }], files: [] };
		drag('dragenter', dragData);
		expect(dropTarget().hasAttribute('data-dragover')).toBe(true);
		bot.reset();
		expect(dropTarget().hasAttribute('data-dragover'), 'highlight preserved after reset').toBe(true);
		drag('dragleave', dragData);
		expect(dropTarget().hasAttribute('data-dragover'), 'highlight still removable').toBe(false);
	});

	test('drag-over highlight is removed when leaving drop target or canceling the drag', () => {
		newUi({ attach: true }, { history: 'inmemory' });
		const dragData= { types: ['Files'], items: [{ kind: 'file', type: 'image/png' }], files: [] };

		function enterWithUnbalancedDepth() {
			// Simulate browsers firing extra dragenter events (e.g. over textarea shadow DOM)
			drag('dragenter', dragData, dropTarget());
			drag('dragenter', dragData, input());
			drag('dragenter', dragData, input());
			expect(dropTarget().hasAttribute('data-dragover')).toBe(true);
		}

		// Moving to a child inside drop target (relatedTarget inside) keeps the highlight
		enterWithUnbalancedDepth();
		drag('dragleave', dragData, dropTarget(), input());
		expect(dropTarget().hasAttribute('data-dragover'), 'kept when relatedTarget is inside').toBe(true);

		// Moving to an element outside drop target removes the highlight immediately
		drag('dragleave', dragData, input(), queryExpectedElement('.-c-history'));
		expect(dropTarget().hasAttribute('data-dragover'), 'removed when relatedTarget is outside').toBe(false);

		// Leaving the browser window or canceling (relatedTarget === null) removes the highlight immediately
		enterWithUnbalancedDepth();
		drag('dragleave', dragData, input());
		expect(dropTarget().hasAttribute('data-dragover'), 'removed when relatedTarget is null').toBe(false);

		// Dropping on widget outside drop target removes the highlight
		enterWithUnbalancedDepth();
		drop(dragData, queryExpectedElement('.-c-history'));
		expect(dropTarget().hasAttribute('data-dragover'), 'removed on drop outside drop target').toBe(false);
	});

	test('\'attachMax: 1\': keeps only the latest image', async () => {
		newUi({ attach: true, attachMax: 1 });
		expect(picker().multiple, 'only a single file selectable').toBe(false);
		await choose([imageFile('a')], 1);
		expect(attachedUrls()).toEqual([dataUrl('a')]);
		await choose([imageFile('b')], 1);
		expect(attachedUrls()).toEqual([dataUrl('b')]);
		paste(clipboardWithItem(imageFile('c')));
		await waitFor(() => attachedUrls()[0] === dataUrl('c'), () => `Unexpected: ${attachedUrls()}`);
		expect(attachedUrls()).toEqual([dataUrl('c')]);
		paste(clipboardWithItem(imageFile('c')));
		await waitForAttachedCount(1);
		expect(attachedUrls(), 'no duplicate').toEqual([dataUrl('c')]);
		drop({ items: [], files: [imageFile('d')] });
		await waitFor(() => attachedUrls()[0] === dataUrl('d'), () => `Unexpected: ${attachedUrls()}`);
		expect(attachedUrls()).toEqual([dataUrl('d')]);
	});

	test('\'attachMax: 3\': keep the last three images; removes older ones', async () => {
		newUi({ attach: true, attachMax: 3 });
		expect(picker().multiple, 'multiple files selectable').toBe(true);
		await choose([imageFile('a')], 1);
		await choose([imageFile('b')], 2);
		paste(clipboardWithItem(imageFile('c')));
		await waitForAttachedCount(3);
		expect(attachedUrls()).toEqual([dataUrl('a'), dataUrl('b'), dataUrl('c')]);
		await choose([imageFile('b')], 3);
		expect(attachedUrls(), 'no duplicate').toEqual([dataUrl('a'), dataUrl('b'), dataUrl('c')]);
		await choose([imageFile('d')], 3);
		expect(attachedUrls(), 'oldest removed').toEqual([dataUrl('b'), dataUrl('c'), dataUrl('d')]);
		paste(clipboardWithItem(imageFile('e')));
		await waitFor(() => attachedUrls()[2] === dataUrl('e'), () => `Unexpected: ${attachedUrls()}`);
		expect(attachedUrls(), 'oldest removed').toEqual([dataUrl('c'), dataUrl('d'), dataUrl('e')]);
	});

	test('removing an attached image', async () => {
		newUi({ attach: true });
		await choose([imageFile('a')], 1);
		await choose([imageFile('b')], 2);
		/** @type {HTMLButtonElement} */ // @ts-ignore
		const removeFirst= attachedArea().querySelector('.-c-form .-c-thumb .-c-attachDel');
		removeFirst.click();
		expect(attachedUrls()).toEqual([dataUrl('b')]);
		expect(attachedArea().hidden).toBe(false);
		/** @type {HTMLButtonElement} */ // @ts-ignore
		const removeSecond= attachedArea().querySelector('.-c-form .-c-thumb .-c-attachDel');
		removeSecond.click();
		expect(attachedUrls()).toEqual([]);
		expect(attachedArea().hidden, 'attached area hidden when empty again').toBe(true);

		// Re-attaching a removed image is possible
		await choose([imageFile('a')], 1);
		expect(attachedUrls()).toEqual([dataUrl('a')]);
	});

	[
		{desc: 'without \'attachOnlyRequest\' (defaults to true)', config: { attach: true }},
		{desc: '\'attachOnlyRequest: true\'', config: { attach: true, attachOnlyRequest: true }},
	].forEach((data) => {
		test(data.desc + ': images only are enough to send', async () => {
			newUi(data.config);
			expect(sendBtn().disabled, 'disabled initially').toBe(true);
			await choose([imageFile('a')], 1);
			expect(sendBtn().disabled, 'enabled with attached image only').toBe(false);
			// @ts-ignore
			attachedArea().querySelector('.-c-attachDel').click();
			expect(sendBtn().disabled, 'disabled after removing the image').toBe(true);
			type('hi');
			expect(sendBtn().disabled, 'enabled with text').toBe(false);
		});
	});

	test('\'attachOnlyRequest: false\': text is required to send', async () => {
		newUi({ attach: true, attachOnlyRequest: false });
		expect(sendBtn().disabled, 'disabled initially').toBe(true);
		await choose([imageFile('a')], 1);
		expect(sendBtn().disabled, 'disabled with attached image only').toBe(true);
		type('   ');
		expect(sendBtn().disabled, 'disabled with whitespace text').toBe(true);
		type('describe this');
		expect(sendBtn().disabled, 'enabled with image and text').toBe(false);
		type('');
		expect(sendBtn().disabled, 'disabled after clearing the text').toBe(true);
	});

	test('sending sends attached images with text and clears the attached area', async () => {
		newUi({ attach: true });
		await choose([imageFile('a')], 1);
		await choose([imageFile('b')], 2);
		type('describe');
		sendBtn().click();

		await waitFor(() => sentMessages.length === 1, () => `Sent: ${JSON.stringify(sentMessages)}`);
		expect(attachedUrls(), 'attached area cleared').toEqual([]);
		expect(attachedArea().hidden, 'attached area hidden').toBe(true);
		expect(input().value, 'input cleared').toBe('');

		expect(sentMessages[0]).toEqual([
			{ type: 'image_url', image_url: { url: dataUrl('a') } },
			{ type: 'image_url', image_url: { url: dataUrl('b') } },
			{ type: 'text', text: 'describe' }
		]);

		// Images and text shown in the user message
		const userMsg= queryExpectedElement('.-c-role-user .-c-msg');
		expect(Array.from(userMsg.querySelectorAll('.-c-thumb img')).map(img => img.getAttribute('src')))
			.toEqual([dataUrl('a'), dataUrl('b')]);
		expect(userMsg.textContent).toBe('describe');
	});

	test('sending images only (attachOnlyRequest default)', async () => {
		newUi({ attach: true });
		await choose([imageFile('a')], 1);
		sendBtn().click();
		await waitFor(() => sentMessages.length === 1, () => `Sent: ${JSON.stringify(sentMessages)}`);
		expect(sentMessages[0]).toEqual([{ type: 'image_url', image_url: { url: dataUrl('a') } }]);
		expect(attachedUrls(), 'attached area cleared').toEqual([]);
	});

	test('sending without attachment support remains synchronous', () => {
		newUi();
		type('hi');
		sendBtn().click();
		expect(sentMessages).toEqual(['hi']);
		expect(input().value).toBe('');
	});

	describe('sending while attachments are queued', () => {
		/** @type {Array<FileReader>} */
		let readers;
		let readAsDataURL;

		beforeEach(() => {
			readers= [];
			readAsDataURL= jest.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(/** @this {FileReader} */ function() {
				readers.push(this);
			});
		});

		afterEach(() => readAsDataURL.mockRestore());

		test.each(['file chooser', 'paste', 'drop'])('waits for all images via %s and prevents duplicate sends', async source => {
			newUi({ attach: true });
			if (source == 'file chooser') {
				selectFiles([imageFile('a'), imageFile('b')]);
			} else if (source == 'paste') {
				paste({ items: [], files: [imageFile('a'), imageFile('b')] });
			} else {
				drop({ items: [], files: [imageFile('a'), imageFile('b')] });
			}
			type('describe');
			const click= new MouseEvent('click', { bubbles: true, cancelable: true });
			sendBtn().dispatchEvent(click);
			expect(click.defaultPrevented, 'default prevented before waiting').toBe(true);
			expect(sendBtn().disabled, 'disabled while waiting').toBe(true);
			const enter= new KeyboardEvent('keypress', { bubbles: true, cancelable: true, keyCode: 13 });
			input().dispatchEvent(enter);
			expect(enter.defaultPrevented).toBe(true);
			expect(sentMessages).toEqual([]);

			await waitFor(() => readers.length === 1, () => 'First read not started');
			finishRead(readers[0], 'a');
			await waitFor(() => readers.length === 2, () => 'Second read not started');
			expect(sendBtn().disabled, 'still disabled after first image').toBe(true);
			expect(sentMessages).toEqual([]);
			finishRead(readers[1], 'b');
			await waitFor(() => sentMessages.length === 1, () => `Sent: ${JSON.stringify(sentMessages)}`);
			expect(sentMessages).toEqual([[
				{ type: 'image_url', image_url: { url: dataUrl('a') } },
				{ type: 'image_url', image_url: { url: dataUrl('b') } },
				{ type: 'text', text: 'describe' }
			]]);
			expect(attachedUrls()).toEqual([]);
			expect(input().value).toBe('');
		});

		test('also waits for images added while sending is pending', async () => {
			newUi({ attach: true });
			paste(clipboardWithItem(imageFile('a')));
			type('describe');
			sendBtn().click();
			await waitFor(() => readers.length === 1, () => 'First read not started');
			paste(clipboardWithItem(imageFile('b')));
			finishRead(readers[0], 'a');
			await waitFor(() => readers.length === 2, () => 'Second read not started');
			expect(sentMessages).toEqual([]);
			finishRead(readers[1], 'b');
			await waitFor(() => sentMessages.length === 1, () => `Sent: ${JSON.stringify(sentMessages)}`);
			expect(sentMessages[0]).toEqual([
				{ type: 'image_url', image_url: { url: dataUrl('a') } },
				{ type: 'image_url', image_url: { url: dataUrl('b') } },
				{ type: 'text', text: 'describe' }
			]);
		});

		test('unreadable images do not block sending the remaining images', async () => {
			newUi({ attach: true });
			selectFiles([imageFile('a'), imageFile('b')]);
			type('describe');
			sendBtn().click();
			await waitFor(() => readers.length === 1, () => 'First read not started');
			readers[0].dispatchEvent(new ProgressEvent('error'));
			await waitFor(() => readers.length === 2, () => 'Second read not started');
			finishRead(readers[1], 'b');
			await waitFor(() => sentMessages.length === 1, () => `Sent: ${JSON.stringify(sentMessages)}`);
			expect(sentMessages[0]).toEqual([
				{ type: 'image_url', image_url: { url: dataUrl('b') } },
				{ type: 'text', text: 'describe' }
			]);
		});

		test('rechecks required text after waiting and allows another send', async () => {
			newUi({ attach: true, attachOnlyRequest: false });
			paste(clipboardWithItem(imageFile('a')));
			type('describe');
			sendBtn().click();
			type('');
			await waitFor(() => readers.length === 1, () => 'Read not started');
			finishRead(readers[0], 'a');
			await waitForAttachedCount(1);
			expect(sentMessages).toEqual([]);
			expect(sendBtn().disabled).toBe(true);
			type('hi');
			expect(sendBtn().disabled, 'pending send guard released').toBe(false);
			sendBtn().click();
			await waitFor(() => sentMessages.length === 1, () => `Sent: ${JSON.stringify(sentMessages)}`);
			expect(sentMessages[0]).toEqual([
				{ type: 'image_url', image_url: { url: dataUrl('a') } },
				{ type: 'text', text: 'hi' }
			]);
		});

		/**
		 * @param {FileReader} reader
		 * @param {string} content
		 */
		function finishRead(reader, content) {
			Object.defineProperty(reader, 'result', { value: dataUrl(content) });
			reader.dispatchEvent(new ProgressEvent('load'));
		}
	});

	/**
	 * @param {Object} [config]
	 * @param {Object} [botConfig]
	 */
	function newUi(config, botConfig) {
		document.body.innerHTML= '';
		sentMessages= [];
		const bot= chatbot.chatbot({ connector: (callback, msg, chatbot, options) => {
			sentMessages.push(msg);
			return toUpperCaseConnector(callback, msg, chatbot, options);
		}, ...botConfig });
		ui.chatbotUi(bot, queryExpectedElement('body'), config || {});
		return bot;
	}

	/**
	 * Simulates selecting files via the file chooser.
	 * @param {Array<File>} files
	 * @param {number} expectedCount - number of attached images to wait for
	 */
	async function choose(files, expectedCount) {
		selectFiles(files);
		await waitForAttachedCount(expectedCount);
	}

	/** @param {Array<File>} files */
	function selectFiles(files) {
		const filePicker= picker();
		Object.defineProperty(filePicker, 'files', { value: files, configurable: true });
		filePicker.dispatchEvent(new Event('change', { bubbles: true }));
	}

	/**
	 * Simulates pasting via Ctrl+V.
	 * @param {Object} clipboardData
	 * @returns {Event} the dispatched paste event
	 */
	function paste(clipboardData) {
		const event= new Event('paste', { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'clipboardData', { value: clipboardData });
		input().dispatchEvent(event);
		return event;
	}

	/**
	 * Simulates a drag event onto the drop target or a specified element.
	 * @param {'dragenter' | 'dragover' | 'dragleave' | 'drop'} type
	 * @param {Object} dataTransfer
	 * @param {Element} [target]
	 * @param {Element} [relatedTarget]
	 * @returns {Event} the dispatched drag event
	 */
	function drag(type, dataTransfer, target, relatedTarget) {
		const event= new Event(type, { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
		if (relatedTarget !== undefined) {
			Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
		}
		(target || dropTarget()).dispatchEvent(event);
		return event;
	}

	/**
	 * Simulates dropping files onto the drop target or a specified element.
	 * @param {Object} dataTransfer
	 * @param {Element} [target]
	 * @returns {Event} the dispatched drop event
	 */
	function drop(dataTransfer, target) {
		return drag('drop', dataTransfer, target);
	}

	/**
	 * @param {string} text
	 */
	function type(text) {
		input().value= text;
		input().dispatchEvent(new Event('input', { bubbles: true }));
	}

	/**
	 * @param {File} file
	 */
	function clipboardWithItem(file) {
		return { items: [{ kind: 'file', type: file.type, getAsFile: () => file }], files: [] };
	}

	/**
	 * @param {string} content
	 * @param {string} [type]
	 */
	function imageFile(content, type) {
		return new File([content], content + '.png', { type: type || 'image/png' });
	}

	/**
	 * @param {string} content
	 * @param {string} [type]
	 */
	function dataUrl(content, type) {
		return 'data:' + (type || 'image/png') + ';base64,' + btoa(content);
	}

	function dropTarget() {
		return queryExpectedElement('.-c-root');
	}

	/** @returns {HTMLInputElement} */
	function picker() {
		// @ts-ignore
		return queryExpectedElement('.-c-form input.-c-file');
	}

	/** @returns {HTMLButtonElement} */
	function sendBtn() {
		// @ts-ignore
		return queryExpectedElement('.-c-form .-c-send');
	}

	/** @returns {HTMLTextAreaElement} */
	function input() {
		// @ts-ignore
		return queryExpectedElement('.-c-form .-c-input');
	}

	function attachedArea() {
		return queryExpectedElement('.-c-form > .-c-thumbs');
	}

	/** @returns {Array<string | null>} */
	function attachedUrls() {
		return Array.from(attachedArea().querySelectorAll('.-c-thumb img')).map(img => img.getAttribute('src'));
	}

	/**
	 * @param {number} count
	 */
	async function waitForAttachedCount(count) {
		await waitFor(() => attachedUrls().length === count,
			() => `Expected ${count} attached images, but found ${attachedUrls().length}: ${attachedUrls()}`);
		// Give any further (unexpected) file reads the chance to complete
		await sleep(50);
	}

	/**
	 * Waits until the condition is met or fails after the timeout.
	 * @param {() => boolean} condition
	 * @param {() => string} failMessage
	 */
	async function waitFor(condition, failMessage) {
		const timeout= 100; // ms
		const end= Date.now() + timeout;
		while (!condition()) {
			if (Date.now() > end) throw new Error(`Timeout of ${timeout} ms reached: ${failMessage()}`);
			await sleep(10);
		}
	}

	/**
	 * @param {number} ms
	 */
	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

});

/** @type {chatbot.Connector} */
function toUpperCaseConnector(callback, msg) {
	return new Promise((resolve) => {
		setTimeout(() => {
			callback((typeof msg === 'string' ? msg : '').toUpperCase());
			resolve();
		}, 10);
	});
}

/** @type {(response: string, refs?: chatbot.References) => chatbot.Connector} */
function createConnector(response, refs) {
	return (callback) => {
		return new Promise((resolve) => {
			if (refs) {
				setTimeout(() => callback(undefined, undefined, refs), 10);
			}
			setTimeout(() => {
				callback(response);
				resolve();
			}, refs ? 20 : 10);
		});
	}
}

/**
 * @param {string} selector
 * @param {string} message
 * @param {number} [index]
 */
function expectElement(selector, message, index) {
	const bodyHtml= ` - body HTML: ${queryExpectedElement('body').innerHTML}`
	const messageWithBodyHtml= message + bodyHtml;
	if (index == undefined) return expect(document.querySelector(selector), messageWithBodyHtml);
	const allElements= document.querySelectorAll(selector);
	const onFailMsg=
		`Element not found: there are ${allElements.length} "${selector}" elements, so none of index ${index}`;
	expect(allElements.length, onFailMsg + bodyHtml).toBeGreaterThan(index);
	return expect(allElements.item(index), messageWithBodyHtml)
}

/**
 * @param {string} selector
 * @returns {HTMLElement} A non-null HTMLElement; if no element is found, the test will fail
 */
function queryExpectedElement(selector) {
	const element= document.querySelector(selector);
	if (element === null) {
		throw new Error(`document.querySelector('${selector}') not found`);
	}
	// @ts-ignore
	return element;
}
