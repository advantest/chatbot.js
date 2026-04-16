// @ts-check
import markdownit from 'markdown-it';
import { katex } from '@mdit/plugin-katex';
import { createElement } from './chatbot.ui.utility.js';

const mdit= markdownit({html: true}).use(katex).use(function (md) {
	const tagsRegExp= new RegExp('^\\s*<[/]?t(able|head|body|foot|r|h|d)\\b(\\s+(colspan|rowspan)\\s*=\\s*[\'"]\\d+[\'"])*\\s*>\\s*$', 'i');
	const refsRegExp= new RegExp('^\\s*<[/]?(br|sub|sup|(a\\b(\\s+((class="[^"]*")|(href="[^"]+")|(target="[^"]*")|(title="[^"]*")|(ref="[^"]*")))*))\\s*>\\s*$', 'i');
	md.core.ruler.push('sec', function(state) {
		const tokens= state.tokens;
		for (let i= 0; i < tokens.length; i++) {

			// allow table elements (needed to be surrounded by '\n\n...\n\n': see below)
			if (!tokens[i].children && tokens[i].type != 'html_block') continue;
			if (tokens[i].type == 'html_block' && tagsRegExp.test(tokens[i].content)) {
				tokens[i].content= tokens[i].content.trim();
				continue;
			}

			/** @type {any} */
			const childTokens= tokens[i].children ? tokens[i].children : [tokens[i]];
			for (let j= 0; j < childTokens.length; j++) {
				if (childTokens[j].type == 'html_inline' || childTokens[j].type == 'html_block') {
					if (refsRegExp.test(childTokens[j].content)) continue;
					childTokens[j].content=
						  '<' + (tokens[i].children ? 'span' : 'div') + ' style="color:#900">'
						+ childTokens[j].content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
						+ '</' + (tokens[i].children ? 'span' : 'div') + '>';
				}
			}
		}
	});
});

/**
 * @param {string} markdown
 */
export function toHtml(markdown) {

	// surround table tags with '\n\n...\n\n' so they become 'html_block', not 'html_inline' tokens
	// TODO: surrounding needs to be reverted in code phrases and blocks
	return mdit.render(markdown.replace(/<[/]?t(able|head|body|foot|r|h|d)\b[^>]*>/gi, '\n\n$&\n\n'))

				// workaround for references in a code block/fence
				.replace(/(&lt;a\b(?:\s+(?:href|target|title|ref)\s*=\s*(?:"|&quot;)(?:(?!&quot;)[^"])*(?:"|&quot;))*)\s+class\s*=\s*&quot;((?:(?!&quot;)[^"])*)&quot;((?:\s+(?:href|target|title|ref)\s*=\s*(?:"|&quot;)(?:(?!&quot;)[^"])*(?:"|&quot;))*)\s*((?:>|&gt;)\s*&lt;\/a\s*(?:>|&gt;))(?=[^<]*<\/code\b)/g,
						'$1 class="$2"$3$4')
				.replace(/(&lt;a\b(?:\s+(?:class|target|title|ref)\s*=\s*(?:"|&quot;)(?:(?!&quot;)[^"])*(?:"|&quot;))*)\s+href\s*=\s*&quot;((?:(?!&quot;)[^"])*)&quot;((?:\s+(?:class|target|title|ref)\s*=\s*(?:"|&quot;)(?:(?!&quot;)[^"])*(?:"|&quot;))*)\s*((?:>|&gt;)\s*&lt;\/a\s*(?:>|&gt;))(?=[^<]*<\/code\b)/g,
						'$1 href="$2"$3$4')
				.replace(/(&lt;a\b(?:\s+(?:class|href|title|ref)\s*=\s*(?:"|&quot;)(?:(?!&quot;)[^"])*(?:"|&quot;))*)\s+target\s*=\s*&quot;((?:(?!&quot;)[^"])*)&quot;((?:\s+(?:class|href|title|ref)\s*=\s*(?:"|&quot;)(?:(?!&quot;)[^"])*(?:"|&quot;))*)\s*((?:>|&gt;)\s*&lt;\/a\s*(?:>|&gt;))(?=[^<]*<\/code\b)/g,
						'$1 target="$2"$3$4')
				.replace(/(&lt;a\b(?:\s+(?:class|href|target|title|ref)\s*=\s*(?:"|&quot;)(?:(?!&quot;)[^"])*(?:"|&quot;))*)\s+title\s*=\s*&quot;((?:(?!&quot;)[^"])*)&quot;((?:\s+(?:class|href|target|ref)\s*=\s*(?:"|&quot;)(?:(?!&quot;)[^"])*(?:"|&quot;))*)\s*((?:>|&gt;)\s*&lt;\/a\s*(?:>|&gt;))(?=[^<]*<\/code\b)/g,
						'$1 title="$2"$3$4')
				.replace(/(&lt;a\b(?:\s+(?:class|href|target|title)\s*=\s*(?:"|&quot;)(?:(?!&quot;)[^"])*(?:"|&quot;))*)\s+ref\s*=\s*&quot;(\d*)&quot;((?:\s+(?:href|target|title|ref)\s*=\s*(?:"|&quot;)(?:(?!&quot;)[^"])*(?:"|&quot;))*)\s*((?:>|&gt;)\s*&lt;\/a\s*(?:>|&gt;))(?=[^<]*<\/code\b)/g,
						'$1 ref="$2"$3$4')
				.replace(/&lt;a\b((?:\s+(?:class|href|target|title|ref)\s*=\s*"[^"]*")*)\s*(?:>|&gt;)\s*&lt;\/a\s*(?:>|&gt;)(?=[^<]*<\/code\b)/g,
						'<a$1></a>')

}

const FIRST_REF_INDEX= 0; // 1 - if [[1]] refers to `refs[0]` and not `refs[1]`; 0 - otherwise ([[0]]: first reference)

/**
 * @param {string} answer
 * @param {string} answerWithRefs
 * @param {Array.<Record<string, unknown> & { h: string }>} refs
 * @param {Map} refsMap
 * @param {string} [baseUrl]
 * @param {string} [target]
 */
export function resolve(answer, answerWithRefs, refs, refsMap, baseUrl, target) {
	let result= '';
	let rest= answer;
	let restStart= 0;
	let start= 0;

	let nextRef= Object.keys(refsMap).length + 1;
	const refRegex= /\s*\[\[(\d+)\]\]/g;
	let match;
	while ((match= refRegex.exec(answerWithRefs)) !== null) {

		// Same answer with and without references, ignoring trailing whitespace?
		const prefix= answerWithRefs.substring(start, match.index);
		const prefixTrimmed= prefix.trimStart();
		start= match.index + match[0].length;
		const restTrimmed= rest.trimStart();
		if (prefixTrimmed.length > 0 && restTrimmed.indexOf(prefixTrimmed) != 0) break;

		// Trailing whitespace from the answer without references
		const trailingWhitespaceLength= rest.length - restTrimmed.length;
		if (prefixTrimmed.length > 0 && trailingWhitespaceLength > 0) {
			result+= rest.substring(0, trailingWhitespaceLength);
			rest= rest.substring(trailingWhitespaceLength);
			restStart+= trailingWhitespaceLength;
		}

		// Text before the reference
		result+= prefixTrimmed;
		rest= rest.substring(prefixTrimmed.length);
		restStart+= prefixTrimmed.length;

		// Append reference, if possible
		const chunkNr= parseInt(match[1]) - FIRST_REF_INDEX;
		if (chunkNr < 0 || chunkNr >= refs.length) continue;
		const refChunk= refs[chunkNr];
		let ref= refsMap.get(refChunk.h);
		if (!ref) {
			ref= nextRef;
			refsMap.set(refChunk.h, ref);
			nextRef++;
		}
		const dummy= createElement(undefined, 'div');

		/** @type {any} */
		const element= createElement(dummy, 'a', 'ref');
		element.setAttribute('ref', '' + ref);
		element.href= (baseUrl === undefined ? '' : baseUrl) + refChunk.h;
		element.target= target === undefined ? '_blank' : target;
		element.title= refChunk.t;
		result+= dummy.innerHTML;

	}

	// Make sure that there is a line break between a code fence and a reference,
	// otherwise the code fence will not be recognized as such.
	result= result.replace(/(``[`]+)(<a\b)/g, '$1\n$2');

	return result + answer.substring(restStart);
}