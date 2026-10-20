import { mdToHtml, renderMd } from './chatbot.ui.md.js';

describe('chatbot.ui.md.test.js', () => {

	// mdToHtml: raw, non-interactive HTML string (used e.g. for clipboard/export).
	test('mdToHtml - renders a code fence as a raw <pre> without interactive chrome', async () => {
		const html= mdToHtml('```python\nprint(1)\n```');

		expect(html.includes('<pre>'), 'pre element').toBe(true);
		expect(html.includes('-c-code-block'), 'no code-block wrapper').toBe(false);
		expect(html.includes('-c-code-header'), 'no code-block header').toBe(false);
		expect(html.includes('-c-code-copy'), 'no copy button').toBe(false);
	});

	const refs= [{h: 'a.html', t: 'A', i: 'img/a.png'}, {h: 'b.html', t: 'B'}];

	test('mdToHtml - resolves inline references with refsBaseUrl', () => {
	    const html= mdToHtml('foo[[1]] bar[[0]]', refs, 'https://html/', new Map());
	    expect(html).toContain('href="https://html/b.html"');
	});

	test('mdToHtml - works without refsMap', () => {
	    expect(() => mdToHtml('foo[[1]]', refs)).not.toThrow();
	});

	test('mdToHtml - renders basic Markdown to HTML', async () => {
		expect(mdToHtml('**bold**').includes('<strong>bold</strong>'), 'bold').toBe(true);
	});

	test('mdToHtml - keeps a code fence closed when a ref follows it', () => {
	    const html= mdToHtml('```js\nx\n```[[0]]\nafter', refs, 'https://html/');
	    expectHtmlToContain('<pre><code');
	    expectHtmlToContain('</code></pre>');
	    expectHtmlToContain('href="https://html/a.html"');
		expect(html.indexOf('</code></pre>')).toBeLessThan(html.indexOf('href="https://html/a.html'));

		/** @type {(substring: string) => void} */
		function expectHtmlToContain(substring) {
		    expect(`No "${substring}" in received HTML: ${html}`).toContain(substring);
		}
	});

	const refs20= Array.from({length: 21}, (_, i) => ({
		h: `${i}.html`,
		t: `Topic ${i}`
	}));

	test.each([
		['test[[11]]', 'test<11>'],
		['aaa[[12]]\t[[000]]  bbb ccc [[012]]', 'aaa<12>\t<0>  bbb ccc <12>'],
		['aaa[[3]] bbb[[2222222]] ccc[[1]]', 'aaa<3> bbb[[2222222]] ccc<1>'],
	])('mdToHtml - reverences: %j / %j', async (md, expected) => {
		const html= mdToHtml(md, refs20);
		const normalized= html
			.replace(/(<p>)|(<[/]p>\s*)/g, '')
			.replace(/<a[^>]*?href="(\d+)[^<]*<\/a>/g, '<$1>');
		expect(normalized, 'html: ' + html).toBe(expected);
	});

	test.each([
		'no reverences.',
		'test[[1]].',
		'aaa[[11]]   bbb[[0]]',
		'aaa[[11]]   bbb[[222222]][[13]]\t\tccc[[2]][[11]]',
		'AAA BBB[[14]]! See also[[2]]...'.repeat(20),
	])('mdToHtml - reverences property testing: %j', async (md) => {
		const html= mdToHtml(md, refs20);
		const reverted= html
			.replace(/(<p>)|(<[/]p>\s*)/g, '')
			.replace(/<a[^>]*?href="(\d+)[^<]*<\/a>/g, '[[$1]]');
		expect(reverted, 'html: ' + html).toBe(md);
	});

	test('mdToHtml - invalid links', async () => {
		expect(mdToHtml('[click me](javascript:alert%28"Hello!"%29)')).not.toContain('<a');
		const refs2= [{h: 'a.html', t: 'A', i: 'alert%28"Hello!"%29'}];
		expect(mdToHtml('[[0]]', refs2, 'javascript:')).not.toContain('href="javascript:');
	});

	// renderMd: renders into a DOM element including the interactive copy button.
	test('renderMd - adds a code-block wrapper, header and copy button', async () => {
		const element= document.createElement('div');
		renderMd(element, '```python\nprint(1)\n```');

		expect(element.querySelector('.-c-code-block'), 'code block wrapper').not.toBeNull();
		expect(element.querySelector('.-c-code-header'), 'code block header').not.toBeNull();
		expect(element.querySelector('.-c-code-copy'), 'copy button').not.toBeNull();
		expect(element.querySelector('pre'), 'pre element').not.toBeNull();
		expect(element.querySelectorAll('.-c-code-copy').length, 'one copy button per code block').toBe(1);
	});

	test('renderMd - re-rendering keeps exactly one copy button per code block', async () => {
		const element= document.createElement('div');
		renderMd(element, '```\na\n```');
		renderMd(element, '```\nb\n```'); // simulates a streaming update replacing the content

		expect(element.querySelectorAll('.-c-code-block').length, 'one code block').toBe(1);
		expect(element.querySelectorAll('.-c-code-copy').length, 'one copy button').toBe(1);
		expect(element.innerHTML.includes('b'), 'shows the latest content').toBe(true);
	});

	test('renderMd - text without code blocks has no copy button', async () => {
		const element= document.createElement('div');
		renderMd(element, 'just some **text**');

		expect(element.querySelector('.-c-code-copy'), 'no copy button').toBeNull();
		expect(element.innerHTML.includes('<strong>text</strong>'), 'rendered text').toBe(true);
	});

	test('renderMd - copying a code block strips the trailing newline', async () => {
		const element= document.createElement('div');
		renderMd(element, '```\nconsole.log(1);\n```');

		const originalClipboard= navigator.clipboard;
		let copied= null;
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText: /** @param {string} t */ function (t) { copied= t; return Promise.resolve(); } },
		});

		try {
			const copyBtn= element.querySelector('.-c-code-copy');
			expect(copyBtn, 'copy button exists').not.toBeNull();
			if (!copyBtn) return;
			copyBtn.dispatchEvent(new Event('click'));
			await Promise.resolve();

			expect(copied, 'copied text has no trailing newline').toBe('console.log(1);');
		} finally {
			Object.defineProperty(navigator, 'clipboard', {
				configurable: true,
				value: originalClipboard,
			});
		}
	});

});