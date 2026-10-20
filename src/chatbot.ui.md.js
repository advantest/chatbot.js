import markdownit from 'markdown-it';
import { katex } from '@mdit/plugin-katex';
import { CLASS_PREFIX } from './chatbot.ui.utility.js';
import { SVG_COPY, SVG_DONE } from './chatbot.ui.icons.js';

const DONE_DELAY= 2000; // in milliseconds; time of showing that copy to clipboard has been done

const mdit= markdownit({html: true}).use(resolveReferences).use(katex).use(function (md) {
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
 * Converts Markdown to a raw, non-interactive HTML string (no copy buttons or other interactive chrome). Use it for
 * clipboard/export or wherever a pure string is needed. To render into the DOM with interactive elements, use
 * renderMd() instead.
 *
 * @param {string} markdown
 * @param {Array.<Record<string, unknown>>} [refs]
 * @param {string} [refsBaseUrl]
 * @param {Map} [refsMap]
 * @returns {string}
 */
export function mdToHtml(markdown, refs, refsBaseUrl, refsMap) {
	const env= {refs: refs, refsBaseUrl: refsBaseUrl, refsMap: refsMap ?? new Map()};

	// Make sure that there is a line break between a code fence and a reference,
	// otherwise the code fence will not be recognized as such.
	const mdFixed= refs ? markdown.replace(/(\s```+)(\[\[\d+\]\])$/gm, '$1\n$2') : markdown;

	// surround table tags with '\n\n...\n\n' so they become 'html_block', not 'html_inline' tokens
	// TODO: surrounding needs to be reverted in code phrases and blocks
	return mdit.render(mdFixed.replace(/<[/]?t(able|head|body|foot|r|h|d)\b[^>]*>/gi, '\n\n$&\n\n'), env)

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

/**
 * Renders Markdown into the given element, including interactive elements like
 * the code copy buttons (and potentially further interactive elements in the
 * future). This is the single entry point for putting rendered Markdown into
 * the DOM: call it instead of setting innerHTML directly so that interactive
 * elements are never missed, also on every streaming update.
 * @param {Element} element
 * @param {string} markdown
 * @param {Array.<Record<string, unknown>>} [refs]
 * @param {string} [refsBaseUrl]
 * @param {Map} [refsMap]
 */
export function renderMd(element, markdown, refs, refsBaseUrl, refsMap) {
	element.innerHTML= mdToHtml(markdown, refs, refsBaseUrl, refsMap);
	addCodeCopyBtns(element);
}

/** @param {import('markdown-it').MarkdownIt} md */
function resolveReferences(md) {
	md.inline.ruler.before('link', 'refs', (state, silent) => {
		const refs = state.env.refs;
		/** @type {Map} */ // @ts-ignore
		const refsMap = state.env.refsMap;
		if (!refs) return false;
		const start = state.pos;

		if (state.src.slice(start, start + 2) !== '[[') return false;

		const match = /^\[\[(\d+)\]\]/.exec(
			state.src.slice(start, state.posMax)
		);
		if (!match) return false;

		// Avoid generating nested links.
		if (state.linkLevel > 0) return false;

		const rawIndex = Number(match[1]);
		if (!Number.isSafeInteger(rawIndex)) return false;

		const ref = Array.isArray(refs) ? refs[rawIndex] : undefined;
		if (!ref || typeof ref.h !== 'string') return false;
		let displayIndex= refsMap.get(ref.h);
		if (!displayIndex) {
			displayIndex= refsMap.size + 1;
			refsMap.set(ref.h, displayIndex);
		}

		const href = md.normalizeLink((state.env.refsBaseUrl || '') + ref.h);
		if (!md.validateLink(href)) return false;

		if (!silent) {
			const token = state.push('link_open', 'a', 1);
			token.attrs = [
				['class', '-c-ref'],
				['ref', String(displayIndex)],
				['href', href],
				['target', '_blank'],
				['title', String(ref.t ?? '')]
			];
			state.push('link_close', 'a', -1);
		}
		state.pos = start + match[0].length;
		return true;
	});
}

/**
 * Add a copy button to each code block (pre element) within element.
 * Internal helper used by renderMd(); not exported. One-shot DOM
 * post-processing that runs on every render instead of using a MutationObserver.
 * @param {Element} element
 */
function addCodeCopyBtns(element) {
	element.querySelectorAll('pre').forEach(function (pre) {
		const parent= pre.parentElement;
		if (!parent) return;
		if (parent.classList.contains(CLASS_PREFIX + 'code-block')) return;
		const code= pre.querySelector('code');
		const wrapper= document.createElement('div');
		wrapper.className= CLASS_PREFIX + 'code-block';
		parent.insertBefore(wrapper, pre);
		wrapper.appendChild(pre);
		const header= document.createElement('div');
		header.className= CLASS_PREFIX + 'code-header';
		const actions= document.createElement('div');
		actions.className= CLASS_PREFIX + 'code-header-actions';
		const copyBtn= document.createElement('button');
		copyBtn.className= CLASS_PREFIX + 'btn ' + CLASS_PREFIX + 'code-copy';
		copyBtn.setAttribute('data-tooltip', 'Copy');
		copyBtn.innerHTML= SVG_COPY;
		copyBtn.addEventListener('click', function () {
			try {
				// markdown-it appends a trailing newline to the code fence content;
				// strip it so the copied text matches the other (newline-free) copies.
				const text= ((code ? code.textContent : pre.textContent) || '').replace(/\n$/, '');
				navigator.clipboard.writeText(text).then(function () {
					copyBtn.innerHTML= SVG_DONE;
					copyBtn.setAttribute('data-tooltip', 'Copied!');
					copyBtn.setAttribute('data-copied', 'true');
					setTimeout(function () {
						copyBtn.innerHTML= SVG_COPY;
						copyBtn.setAttribute('data-tooltip', 'Copy');
						copyBtn.removeAttribute('data-copied');
					}, DONE_DELAY);
				}).catch(function () {
					// TODO Error handling when failed to copy; maybe hide copy button
				});
			} catch (e) {}
		});
		actions.appendChild(copyBtn);
		header.appendChild(actions);
		wrapper.insertBefore(header, pre);
	});
}
