import { resolve, mdToHtml, renderMd } from './chatbot.ui.md.js';

describe('chatbot.ui.md.test.js', () => {

	test('resolve - basic', async () => {
		const toTest= [

			// Simple
			['test.', 'test.', 'test.'],

			// Whitespace from answer without references
			['    test', 'test[[11]]', '    test<11>'],
			['  aaa\nbbb\nccc ', '  aaa[[12]] [[0]]\n\nbbb\nccc [[12]] ', '  aaa<12><0>\nbbb\nccc<12> '],
			['    aaa\tbbb', ' aaa [[11]] [[2]] bbb  ', '    aaa<11><2>\tbbb'],

			// No or not complete matching references
			[' aaa bbb ccc ', ' aaa[[3]] bbb[[2]] FAIL ccc[[1]] ', ' aaa<3> bbb<2> ccc '],

			// Non existing reference
			[' aaa bbb ccc ', ' aaa[[3]] bbb[[2222222]] ccc[[1]] ', ' aaa<3> bbb ccc<1> '],

		];
		const refs= [];
		for (let i = 0; i <= 20; i++) {
		    refs.push({h: i + '.html', t: 'Topic ' + i});
		}
		toTest.forEach(tuple => {
			const resolved= resolve(tuple[0], tuple[1], refs, new Map());
			const normalized= resolved.replace(/<a[^>]*?href="(\d+)[^<]*<\/a>/g, '<$1>');
			expect(normalized).toBe(tuple[2]);
		});
	});

	test('resolve - basic property testing', async () => {
		const toTest= [
			'test.',
			'test[[1]].',
			' aaa[[11]]   bbb[[0]]  ',
			'\n \naaa[[1]] \n \n bbb[[2]] \n \n ',
			' aaa[[11]]   bbb[[2]][[13]]  ccc[[2]][[11]] ',
			'AAA\nBBB[[14]]!\n\nSee also[[2]]. ...',
		];
		const refs= [];
		for (let i = 0; i <= 20; i++) {
		    refs.push({h: i + '.html', t: 'Topic ' + i});
		}
		toTest.forEach(withRefs => {
			const withoutRefs= withRefs.replace(/\[\[(\d+)\]\]/g, '');
			const resolved= resolve(withoutRefs, withRefs, refs, new Map());
			const reverted= resolved.replace(/\[\[(\d+)\]\]/g, '[[missed: $1]]').replace(/<a[^>]*?href="(\d+)[^<]*<\/a>/g, '[[$1]]');
			expect(reverted).toBe(withRefs);
		});
	});

	// mdToHtml: raw, non-interactive HTML string (used e.g. for clipboard/export).
	test('mdToHtml - renders a code fence as a raw <pre> without interactive chrome', async () => {
		const html= mdToHtml('```python\nprint(1)\n```');

		expect(html.includes('<pre>'), 'pre element').toBe(true);
		expect(html.includes('-c-code-block'), 'no code-block wrapper').toBe(false);
		expect(html.includes('-c-code-header'), 'no code-block header').toBe(false);
		expect(html.includes('-c-code-copy'), 'no copy button').toBe(false);
	});

	test('mdToHtml - renders basic Markdown to HTML', async () => {
		expect(mdToHtml('**bold**').includes('<strong>bold</strong>'), 'bold').toBe(true);
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