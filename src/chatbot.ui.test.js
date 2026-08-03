// @ts-check
import * as chatbot from './chatbot.core.js';
import * as ui from './chatbot.ui.js';

/**
 * @jest-environment jsdom
 */
describe('chatbot.ui.test.js', () => {

	var bot;

	beforeEach(() => {
		document.body.innerHTML= '';
		bot= chatbot.chatbot({connector: toUpperCaseConnector()});
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
		const codeBot= chatbot.chatbot({connector: codeBlockConnector()});
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
		const bot= chatbot.chatbot({ connector: toUpperCaseConnector() });
		ui.chatbotUi(bot, document.querySelector('body'), config || {});
		return bot;
	}

	test('rail exists but is hidden below the threshold', async () => {
		const bot= newUi();
		await ask(bot, 3);
		const rail= document.querySelector('.-c-qnav');
		expect(rail, 'rail element should exist').not.toBeNull();
		expect(rail.hidden, 'rail hidden with 3 questions (default threshold 4)').toBe(true);
	});

	test('rail becomes visible at the threshold with one anchor per user question', async () => {
		const bot= newUi();
		await ask(bot, 4);
		const rail= document.querySelector('.-c-qnav');
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
		expect(document.querySelector('.-c-qnav').hidden, 'visible after 2 with threshold 2').toBe(false);
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
		items.item(1).click();
		const active= document.querySelectorAll('.-c-qnav-item.-c-active');
		expect(active.length, 'exactly one active anchor').toBe(1);
		expect(active.item(0), 'clicked anchor is active').toBe(items.item(1));
	});

	test('reset clears the rail', async () => {
		const bot= newUi();
		await ask(bot, 4);
		bot.reset();
		const rail= document.querySelector('.-c-qnav');
		expect(rail.hidden, 'rail hidden after reset').toBe(true);
		expect(document.querySelectorAll('.-c-qnav-item').length, 'no anchors after reset').toBe(0);
	});

});

/**
 * @returns {chatbot.Connector}
 */
function toUpperCaseConnector() {
	return {
		send: function(callback, msg) {
			return new Promise((resolve) => {
				setTimeout(() => {
					callback((msg ? msg : '').toUpperCase());
					resolve();
				}, 100);
			});
		},
		reset: function() {}
	};
}

/**
 * @returns {chatbot.Connector}
 */
function codeBlockConnector() {
	return {
		send: function(callback) {
			return new Promise((resolve) => {
				setTimeout(() => {
					callback('```\nconsole.log("hello");\n```');
					resolve();
				}, 100);
			});
		},
		reset: function() {}
	};
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
		fail(`document.querySelector('${selector}') not found`);
	}
	// @ts-ignore
	return element;
}
