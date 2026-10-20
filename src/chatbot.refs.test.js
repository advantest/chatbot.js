import { mergeRefs, removeRefs } from './chatbot.refs.js';

describe('chatbot.refs.test.js', () => {

	test.each([
		['Lorem ipsum dolor', 'Lorem ipsum[[1]]', 'Lorem ipsum[[1]] dolor'],
		['Lorem ipsum dolor', 'Lorem! \n ipsum[[1]]', 'Lorem ipsum[[1]] dolor'],
	])('mergeRefs - JSDoc exmples: %j / %j', (base, withRefs, expected) => {
		expect(mergeRefs(base, withRefs)).toBe(expected);
	});

	test.each([
		['', '', ''],
		['aaa', '', 'aaa'],
		['aaa', 'aaa[[123]]', 'aaa[[123]]'],
		['aaa bbb', 'aaa[[42]]', 'aaa[[42]] bbb'],
		['aaa bbb ccc', 'aaa[[0]] bbb[[1]] ccc[[2]]', 'aaa[[0]] bbb[[1]] ccc[[2]]'],
		['aaa bbb', 'aa[[1]]', 'aa[[1]]a bbb'],
		['aaa bbb', 'aaa[[1]] b', 'aaa[[1]] bbb'],
		['', '[[0]]', '[[0]]'],
		['aaa', '[[0]]', '[[0]]aaa'],
		['aaa', '[[0]]aaa[[1]]', '[[0]]aaa[[1]]'],
		['aaa bbb', 'aaa[[0]][[12]][[0003]] bbb[[9999999999999999]]', 'aaa[[0]][[12]][[0003]] bbb[[9999999999999999]]'],
	])('mergeRefs - exact matching with additional references: %j / %j', (base, withRefs, expected) => {
		expect(mergeRefs(base, withRefs)).toBe(expected);
	});

	test.each([
		['aaa[[1]] bbb ccc', 'aaa[[1]] bbb[[2]]', 'aaa[[1]] bbb[[2]] ccc'],
		['[[0]]aaa bbb', '[[0]]aaa[[1]]', '[[0]]aaa[[1]] bbb'],
		['a[[x]]b tail', 'a[[x]][[0]]b[[1]]', 'a[[x]][[0]]b[[1]] tail'],
		['aaa] bbb', 'aaa[[1]]][[2]] bbb[[3]]', 'aaa[[1]]][[2]] bbb[[3]]'],
		['aaa[[1]][[2]] bbb', 'aaa[[1]][[2]]', 'aaa[[1]][[2]] bbb'],
		['aaa[[2]] bbb', 'aaa[[1]][[2]]', 'aaa[[1]][[2]] bbb'],
		['aaa[[1]] bbb', 'aaa[[1]][[2]]', 'aaa[[1]][[2]] bbb'],
		['aaa[[0]][[1]] bbb', 'aaa[[1]] bbb[[2]]', 'aaa[[0]][[1]] bbb[[2]]'],
		['aaa[[0]] bbb', 'aaa bbb[[1]]', 'aaa[[0]] bbb[[1]]'],
		['aaa[[0]] bbb', 'aaa[[1]]', 'aaa[[1]][[0]] bbb'],
		['aaa [[2]] bbb', 'aaa[[1]] [[2]]', 'aaa[[1]] [[2]] bbb'],
	])('mergeRefs - exact matching with existing and additional references: %j / %j', (base, withRefs, expected) => {
		expect(mergeRefs(base, withRefs)).toBe(expected);
	});

	test.each([
		['aaa', 'unrelated text', 'aaa'],
		['aaa bbb', 'unrelated[[1]]', 'aaa bbb'],
		['aaa bbb', 'aaa changed[[1]]', 'aaa bbb'],
		['aaa', 'aaa[[-1]]', 'aaa'],
		['aaa', 'aaa[[1.5]]', 'aaa'],
		['aaa', 'aaa[[x]]', 'aaa'],
		['aaa', 'aaa[1]', 'aaa'],
		['aaa', 'aaa[[[1]]]', 'aaa'],
		['aaa', 'aaa[[1]', 'aaa'],
		['aaa', 'aaa[1]]', 'aaa'],
		['', 'aaa[[1]]', ''],
		['aaa', 'aaaa[[1]]', 'aaa'],
		['aaa', 'AAA[[1]]', 'aaa'],
		['aaa', 'aaa[[-1]][[2]]', 'aaa'],
		['aaa', 'aaa[[[1]]][[2]]', 'aaa'],
	])('mergeRefs - no matching references: %j / %j', (base, withRefs, expected) => {
		expect(mergeRefs(base, withRefs, true)).toBe(expected);
	});

	test.each([
		['aaa bbb', 'aaa[[1]] changed[[2]]', 'aaa[[1]] bbb'],
		['aaa', 'aaa[[1]] bbb[[2]]', 'aaa[[1]]'],
		['aaa bbb', 'aaa[[1]] bbb[[', 'aaa[[1]] bbb'],
		['aaa bbb', '[[0]]xxx[[1]]', '[[0]]aaa bbb'],
	])('mergeRefs - partially matching references: %j / %j', (base, withRefs, expected) => {
		expect(mergeRefs(base, withRefs)).toBe(expected);
	});

	test.each([
		['aaa bbb', 'aaa [[1]]bbb', 'aaa [[1]]bbb'],
		['aaa bbb', 'aaa [[1]]', 'aaa [[1]]bbb'],
		['aaa     bbb', 'aaa   [[1]]', 'aaa   [[1]]  bbb'],
		['aaa \t\n bbb', 'aaa \n[[1]]', 'aaa [[1]]\t\n bbb'],
		['aaa \tbbb\n', 'aaa \t[[1]]bbb\n[[2]]', 'aaa \t[[1]]bbb\n[[2]]'],
		[' \taaa', ' \t[[0]]aaa[[1]]', ' \t[[0]]aaa[[1]]'],
		['aaa ', 'aaa [[1]]', 'aaa [[1]]'],
		['aaa\r\nbbb', 'aaa\r\n[[1]]bbb', 'aaa\r\n[[1]]bbb'],
		['aaa[[1]] bbb', 'aaa[[1]] [[2]]bbb', 'aaa[[1]] [[2]]bbb'],
		['aaa\u00a0bbb', 'aaa\u00a0[[1]]bbb', 'aaa\u00a0[[1]]bbb'],
		['aaa \tbbb', 'aaa [[1]]\tbbb', 'aaa [[1]]\tbbb'],
	])('mergeRefs - keeps exact positions around whitespace: %j / %j', (base, withRefs, expected) => {
		expect(mergeRefs(base, withRefs, true, true)).toBe(expected);
		expect(mergeRefs(base, withRefs, false, true)).toBe(expected);
	});

	test.each([
		['aaa bbb', 'aaa [[1]] bbb', 'aaa [[1]]bbb'],
		['aaa bbb', 'aaa [[1]] bbb[[2]]', 'aaa [[1]]bbb'],
		['aaa bbb', 'aaa[[0]] [[1]] bbb', 'aaa[[0]] [[1]]bbb'],
		['aaa bbb', 'aaa [[1]]\tbbb', 'aaa [[1]]bbb'],
		['aaa  bbb', 'aaa [[1]]bbb', 'aaa [[1]] bbb'],
		['aaa ', 'aaa [[1]] ', 'aaa [[1]]'],
		['aaa bbb', 'aaa[[1]]bbb', 'aaa[[1]] bbb'],
		['aaa bbb', 'aaa  bbb[[1]]', 'aaa bbb'],
		['aaa  bbb', 'aaa bbb[[1]]', 'aaa  bbb'],
		['aaa\tbbb', 'aaa bbb[[1]]', 'aaa\tbbb'],
		['aaa\r\nbbb', 'aaa\nbbb[[1]]', 'aaa\r\nbbb'],
		['aaa', 'aaa [[1]]', 'aaa'],
		['aaa bbb', 'aaa[[1]]  bbb[[2]]', 'aaa[[1]] bbb'],
		['aaa\nbbb', 'aaa[[1]]\tbbb[[2]]', 'aaa[[1]]\nbbb'],
		['aaa[[1]]  bbb', 'aaa[[1]] bbb[[2]]', 'aaa[[1]]  bbb'],
		['aaa bbb', 'aaa [[1]][[2]] bbb', 'aaa [[1]][[2]]bbb'],
		['aaa\u00a0bbb', 'aaa [[1]]bbb', 'aaa\u00a0bbb'],
	])('mergeRefs - stops at a whitespace mismatch: %j / %j', (base, withRefs, expected) => {
		expect(mergeRefs(base, withRefs, true, true)).toBe(expected);
		expect(mergeRefs(base, withRefs, false, true)).toBe(expected);
	});

	test.each([
		['aaa bbb', 'aaa [[1]] bbb', 'aaa [[1]]bbb'],
		['aaa bbb', 'aaa[[1]]bbb', 'aaa[[1]] bbb'],
		['aaa bbb', 'aaa[[1]]\nbbb [[2]]', 'aaa[[1]] bbb[[2]]'],
		['aaa bbb', 'aaa [[1]]bbb', 'aaa [[1]]bbb'],
		['aaa bbb', 'aaa [[1]]', 'aaa [[1]]bbb'],
		['aaa bbb', 'aaa  bbb[[1]]', 'aaa bbb[[1]]'],
		['aaa  bbb', 'aaa bbb[[1]]', 'aaa  bbb[[1]]'],
		['aaa\tbbb', 'aaa bbb[[1]]', 'aaa\tbbb[[1]]'],
		['aaa\r\nbbb', 'aaa\nbbb[[1]]', 'aaa\r\nbbb[[1]]'],
		['aaa\nbbb', 'aaa[[1]]\tbbb[[2]]', 'aaa[[1]]\nbbb[[2]]'],
		['aaa \tbbb\n', 'aaa \t[[1]]bbb\n[[2]]', 'aaa \t[[1]]bbb[[2]]\n'],
		[' \taaa', ' \t[[0]]aaa[[1]]', ' \t[[0]]aaa[[1]]'],
		['aaa ', 'aaa [[1]]', 'aaa [[1]]'],
		['aaa', 'aaa \t[[1]]\n[[2]]', 'aaa[[1]][[2]]'],
		['', ' \t[[0]]\n[[1]]', '[[0]][[1]]'],
		[' \t', '\n[[1]]', '[[1]] \t'],
		[' \taaa ', 'aaa', ' \taaa '],
		['Hello, World!!11eleven', 'Hello ,World ! ! 11eleven [[1]]', 'Hello, World!!11eleven[[1]]'],
		['äö23 áß 123. ? e', 'äö23\táß\n123 .?e [[1]]', 'äö23 áß 123. ? e[[1]]'],
		['𐐀𐐁 𝟙𝟚', '𐐀𐐁\t𝟙𝟚 [[1]]', '𐐀𐐁 𝟙𝟚[[1]]'],
		['a_b', 'a _ b[[1]]', 'a_b[[1]]'],
		['.?!', ' . \n?\t! [[1]]', '.?![[1]]'],
		['aaa\u00a0bbb\u2003', 'aaa\tbbb \n[[1]]', 'aaa\u00a0bbb[[1]]\u2003'],
		['aaa bbb', 'aaa \n[[1]] \t[[2]]bbb', 'aaa [[1]][[2]]bbb'],
		['aaa bbb', 'aa[[0]]a\tbbb [[1]]', 'aa[[0]]a bbb[[1]]'],
		['😀!?', '😀 ! ? [[1]]', '😀!?[[1]]'],
	])('mergeRefs - ignores whitespace between tokens: %j / %j', (base, withRefs, expected) => {
		expect(mergeRefs(base, withRefs)).toBe(expected);
		expect(mergeRefs(base, withRefs, true)).toBe(expected);
		expect(mergeRefs(base, withRefs, false, false)).toBe(expected);
	});

	test.each([
		['aaa bbb', 'aaabbb[[1]]', 'aaa bbb'],
		['aaabbb', 'aaa bbb[[1]]', 'aaabbb'],
		['äö23', 'äö 23[[1]]', 'äö23'],
		['äö 23', 'äö23[[1]]', 'äö 23'],
		['123', '1 23[[1]]', '123'],
		['11eleven', '11 eleven[[1]]', '11eleven'],
		['aaa 123', 'aaa123[[1]]', 'aaa 123'],
		['𐐀𐐁', '𐐀 𐐁[[1]]', '𐐀𐐁'],
		['aaa bbb', 'aaa[[1]] b bb[[2]]', 'aaa[[1]] bbb'],
		['aaa bbb', 'aaa [[1]] changed [[2]]', 'aaa [[1]]bbb'],
		['Hello, World!', 'Hello x World![[1]]', 'Hello, World!'],
		['𐐀𐐁', '𐐀\t𐐁[[1]]', '𐐀𐐁'],
		['𐐀 𐐁', '𐐀𐐁[[1]]', '𐐀 𐐁'],
		['aaa[[0]]bbb', 'aaa bbb[[1]]', 'aaa[[0]]bbb'],
		['aaa[[0]] bbb', 'aaabbb[[1]]', 'aaa[[0]] bbb'],
	])('mergeRefs - does not change tokens: %j / %j', (base, withRefs, expected) => {
		expect(mergeRefs(base, withRefs)).toBe(expected);
		expect(mergeRefs(base, withRefs, true)).toBe(expected);
		expect(mergeRefs(base, withRefs, false, false)).toBe(expected);
	});

	test.each([
		['aaa [[1]] bbb', 'aaa[[1]]\nbbb [[2]]', 'aaa [[1]] bbb[[2]]'],
		['aaa \t[[0]]\n[[1]] bbb', 'aaa [[1]][[2]]bbb [[3]]', 'aaa \t[[0]]\n[[1]][[2]] bbb[[3]]'],
		['aaa [[0]] bbb', 'aaa bbb [[1]]', 'aaa [[0]] bbb[[1]]'],
		['aaa[[0]]bbb', 'aaabbb [[1]]', 'aaa[[0]]bbb[[1]]'],
		['aaa[[1]]  bbb', 'aaa[[1]] bbb[[2]]', 'aaa[[1]]  bbb[[2]]'],
		['aaa[[1]] bbb', 'aaa [[1]] bbb [[2]]', 'aaa[[1]] bbb[[2]]'],
		['aaa [[0]] \t[[1]] bbb', 'aaa [[0]]\n[[1]]\n[[2]] bbb [[3]]', 'aaa [[0]] \t[[1]][[2]] bbb[[3]]'],
	])('mergeRefs - ignores whitespace around existing references: %j / %j', (base, withRefs, expected) => {
		expect(mergeRefs(base, withRefs)).toBe(expected);
		expect(mergeRefs(base, withRefs, true)).toBe(expected);
		expect(mergeRefs(base, withRefs, false, false)).toBe(expected);
	});

	test('mergeRefs - handles a long exact response with many references', () => {
		const count= 10;
		const base= 'alpha beta gamma.\n'.repeat(count);
		const withRefs= 'alpha beta gamma.[[0]]\n'.repeat(count);
		expect(mergeRefs(base, withRefs)).toBe(withRefs);
	});

	test('mergeRefs - handles repeated whitespace fallbacks and existing references', () => {
		const count= 10;
		const base= 'alpha \t[[0]]\n[[1]] beta. \n'.repeat(count);
		const withRefs= 'alpha \t[[0]]\r\n[[1]]\t[[2]]beta .\t[[3]]\n'.repeat(count);
		const expected= 'alpha \t[[0]]\n[[1]][[2]] beta.[[3]] \n'.repeat(count);
		expect(mergeRefs(base, withRefs)).toBe(expected);
	});

	test.each([
		['Lorem ipsum dolor', 'Lorem! ipsum[[1]]', 'Lorem ipsum[[1]] dolor'],
		['Lorem ipsum dolor', 'Lorem ipsum.[[1]]', 'Lorem ipsum[[1]] dolor'],
		['Hello, world', 'Hello; world[[1]]', 'Hello, world[[1]]'],
		['a1, b2, ...\nNext p\n...', 'a1, b2, ..[[2]]\nNext p[[1]]', 'a1, b2, ..[[2]].\nNext p[[1]]\n...'],
		['a1, b2, ...\nNext p\n...', 'a1, b2, ....[[2]]\nNext p[[1]]', 'a1, b2, ...[[2]]\nNext p[[1]]\n...'],
		['a1, "b2", c3, d4', 'a1, "b2[[42]]," c3[[7]]', 'a1, "b2[[42]]", c3[[7]], d4'],
		['a1, "b2", c3, d4', 'a1, "b2,[[42]]" c3[[7]]', 'a1, "b2",[[42]] c3[[7]], d4'],
		['a1, "b2", c3, d4', 'a1, "b2,"[[42]] c3[[7]]', 'a1, "b2",[[42]] c3[[7]], d4'],
	])('mergeRefs - not exact punctuation: %j / %j', (base, withRefs, expected) => {
		expect(mergeRefs(base, withRefs, false, false)).toBe(expected);
		expect(mergeRefs(base, withRefs, false, true)).toBe(expected);
	});

	// TODO fix know inconstency
	test.each([
		['aaa bbb ccc', 'aaa bbb [[2]]ccc', 'aaa bbb [[2]]ccc'], // [[2]] after the space
		['aaa bbb ccc', 'aaa [[1]]bbb [[2]]ccc', 'aaa [[1]]bbb[[2]] ccc'], // [[2]] before the space
	])('mergeRefs - know inconstency: %j / %j', (base, withRefs, expected) => {
		expect(mergeRefs(base, withRefs)).toBe(expected);
	});

	test.each([
		['Lorem ipsum[[1]] dolor[[012]]', 'Lorem ipsum dolor'], // JSDoc example
		['', ''],
		['aaa', 'aaa'],
		['aaa bbb', 'aaa bbb'],
		['[[0]]', ''],
		['[[0]][[1]][[2]]', ''],
		['aaa[[0]]', 'aaa'],
		['[[0]]aaa', 'aaa'],
		['aaa[[1]] bbb', 'aaa bbb'],
		['aaa [[1]]bbb', 'aaa bbb'],
		['aaa [[1]] bbb', 'aaa  bbb'],
		['aaa[[0]] bbb[[12]] ccc[[012]]', 'aaa bbb ccc'],
		['aaa[[999999999]]', 'aaa'],
		['aaa[[9999999999999999999999]]', 'aaa'],
		['aaa[[00]][[0003]]', 'aaa'],
		['a[[1]]a[[2]]a', 'aaa'],
		['aaa\n[[1]]\tbbb\r\n[[2]]', 'aaa\n\tbbb\r\n'],
		['äö[[1]] 𐐀𐐁[[2]] 😀[[3]]', 'äö 𐐀𐐁 😀'],
		['alpha beta gamma.[[0]]\n'.repeat(10), 'alpha beta gamma.\n'.repeat(10)],
	])('removeRefs - removes references: %j', (text, expected) => {
		expect(removeRefs(text)).toBe(expected);
	});

	test.each([
		['aaa[[-1]]'],
		['aaa[[1.5]]'],
		['aaa[[x]]'],
		['aaa[[]]'],
		['aaa[[ 1]]'],
		['aaa[[1 ]]'],
		['aaa[[+1]]'],
		['aaa[[1e3]]'],
		['aaa[[١]]'],
		['aaa[1]'],
		['aaa[[1]'],
		['aaa[1]]'],
		['aaa[ [1]]'],
		['aaa[[1] ]'],
	])('removeRefs - keeps non-references: %j', (text) => {
		expect(removeRefs(text)).toBe(text);
	});

	test.each([
		['aaa[[[1]]]', 'aaa[]'],
		['aaa[[[[1]]]]', 'aaa[[]]'],
		['aaa[[x]][[1]]', 'aaa[[x]]'],
		['aaa[[-1]][[2]]', 'aaa[[-1]]'],
		['aaa[[1]][[1]', 'aaa[[1]'],
		['[[[[1]]1]]', '[[1]]'],
	])('removeRefs - removes only valid references: %j', (text, expected) => {
		expect(removeRefs(text)).toBe(expected);
	});

});