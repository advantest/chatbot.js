// @ts-check
import { resolve, toHtml } from './chatbot.ui.md.js';

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
			const resolved= resolve(tuple[0], tuple[1], refs, {});
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
			const resolved= resolve(withoutRefs, withRefs, refs, {});
			const reverted= resolved.replace(/\[\[(\d+)\]\]/g, '[[missed: $1]]').replace(/<a[^>]*?href="(\d+)[^<]*<\/a>/g, '[[$1]]');
			expect(reverted).toBe(withRefs);
		});
	});

});