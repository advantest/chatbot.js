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
		const body= document.querySelector('body');
		const config= {title: 'Dummy Title', footerHtml: '<span class="dummy-footer">FOOOTER</span>'};
		ui.chatbotUi(bot, body, config);
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
				`Element not found: ${element} - body HTML: ${document.querySelector("body").innerHTML}`).not.toBeNull());
	});

	test('code copy button', async () => {
		document.body.innerHTML= '';
		const codeBot= chatbot.chatbot({connector: codeBlockConnector()});
		ui.chatbotUi(codeBot, document.querySelector('body'), {});
		await codeBot.send('hi');

		expectElement('.-c-code-block', 'code block wrapper').not.toBeNull();
		expectElement('.-c-code-header', 'code block header').not.toBeNull();
		expectElement('.-c-code-copy', 'copy button').not.toBeNull();
		expect(document.querySelectorAll('.-c-code-copy').length, 'one copy button per code block').toBe(1);
	});

	test('custom title and footer', async () => {
		const titleElement= document.querySelector('.-c-title');
		expectElement('.-c-title', 'Title element not found: .-c-title').not.toBeNull();
		expect(titleElement.textContent, 'No "Dummy Title"').toBe('Dummy Title');

		const footerElement= document.querySelector('.-c-footer');
		expectElement('.-c-footer', 'Title element not found: .-c-footer').not.toBeNull();
		expectElement('.dummy-footer', 'Custom footer element not found: .dummy-footer').not.toBeNull();
		expect(footerElement.innerHTML, '').toBe('<span class="dummy-footer">FOOOTER</span>');

		await bot.send('hi');
		expectElement('.-c-title', 'Title element not found: .-c-title').not.toBeNull();
		expectElement('.dummy-footer', 'Custom footer element not found: .dummy-footer').not.toBeNull();

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
					callback(msg.toUpperCase());
					resolve();
				}, 100);
			});
		}
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
		}
	};
}

/**
 * @param {string} selector
 * @param {string} message
 * @param {number} index
 */
function expectElement(selector, message, index) {
	const bodyHtml= ` - body HTML: ${document.querySelector("body").innerHTML}`
	const messageWithBodyHtml= message + bodyHtml;
	if (index == undefined) return expect(document.querySelector(selector), messageWithBodyHtml);
	const allElements= document.querySelectorAll(selector);
	const onFailMsg=
		`Element not found: there are ${allElements.length} "${selector}" elements, so none of index ${index}`;
	expect(allElements.length, onFailMsg + bodyHtml).toBeGreaterThan(index);
	return expect(allElements.item(index), messageWithBodyHtml)
}
