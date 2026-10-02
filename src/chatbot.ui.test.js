import * as chatbot from './chatbot.core.js';
import * as ui from './chatbot.ui.js';
import { jest } from '@jest/globals';

/**
 * @jest-environment jsdom
 */
describe('chatbot.ui.test.js', () => {

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
		const codeBot= chatbot.chatbot({connector: codeBlockConnector});
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

});

/**
 * @jest-environment jsdom
 */
describe('question navigation rail', () => {

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
describe('attaching images', () => {

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
		expectElement('.-c-form .-c-attach', 'attach button').not.toBeNull();
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

	['file chooser', 'paste'].forEach(source => {
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
			} else {
				paste(clipboardWithItem(file));
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

	test('no duplicates via file chooser and paste', async () => {
		newUi({ attach: true });
		await choose([imageFile('a'), imageFile('a')], 1);
		await choose([imageFile('a')], 1);
		paste(clipboardWithItem(imageFile('a')));
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

	test('pasting an image is ignored without \'attach: true\'', async () => {
		newUi();
		const event= paste(clipboardWithItem(imageFile('a')));
		expect(event.defaultPrevented).toBe(false);
		expect(document.querySelector('.-c-form .-c-thumb'), 'nothing attached').toBeNull();
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

		test.each(['file chooser', 'paste'])('waits for all images via %s and prevents duplicate sends', async source => {
			newUi({ attach: true });
			if (source == 'file chooser') {
				selectFiles([imageFile('a'), imageFile('b')]);
			} else {
				paste({ items: [], files: [imageFile('a'), imageFile('b')] });
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
	 */
	function newUi(config) {
		document.body.innerHTML= '';
		sentMessages= [];
		const bot= chatbot.chatbot({ connector: (callback, msg, chatbot, options) => {
			sentMessages.push(msg);
			return toUpperCaseConnector(callback, msg, chatbot, options);
		}});
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

/**
 * @type {chatbot.Connector}
 */
function toUpperCaseConnector(callback, msg) {
	return new Promise((resolve) => {
		setTimeout(() => {
			callback((typeof msg === 'string' ? msg : '').toUpperCase());
			resolve();
		}, 100);
	});
}

/**
 * @type {chatbot.Connector}
 */
function codeBlockConnector(callback) {
	return new Promise((resolve) => {
		setTimeout(() => {
			callback('```\nconsole.log("hello");\n```');
			resolve();
		}, 100);
	});
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
