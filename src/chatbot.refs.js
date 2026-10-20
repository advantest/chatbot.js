/**
 * Merges `[[n]]` references from `withRefs` into `base` while their text matches.
 *
 * By default, references are also merged if `withRefs` differs from `base` by more than additional references,
 * whitespace, and punctuation, such as `.` or `"` but not operators such as `<` or `≈`. Merging stops at the first
 * difference that is neither whitespace nor punctuation nor a missing reference from `base`; the rest of `withRefs` is
 * silently ignored.
 *
 * It is optimized for the standard case in which `base` contains no references and `withRefs` is a
 * character-by-character prefix of `base`. Differences in whitespace, punctuation, or references can lead to poorer
 * performance and cause the merged reference to not be placed exactly where expected.
 *
 * @example
 * mergeRefs('Lorem ipsum dolor', 'Lorem ipsum[[1]]') // => 'Lorem ipsum[[1]] dolor'
 *
 * // Whitespace and punctuation changes are ignored by default:
 * mergeRefs('Lorem ipsum dolor', 'Lorem! \n ipsum[[1]]') // => 'Lorem ipsum[[1]] dolor'
 *
 * @param {string} base - The base text, possibly already containing references
 * @param {string} withRefs - The same text or a prefix of it, with additional references
 * @param {boolean} [exactPunctuation=false] - Whether punctuation must match exactly
 * @param {boolean} [exactWhitespace=false] - Whether whitespace must match exactly
 * @returns {string}
 */
export function mergeRefs(base, withRefs, exactPunctuation, exactWhitespace) {
	const refs= /\[\[\d+\]\]/g;
	let nextRef= refs.exec(withRefs);
	if (!nextRef) return base;

	const existingRefs= /\[\[\d+\]\]/y;
	const matchingRefs= exactWhitespace ? existingRefs : /\s*\[\[\d+\]\]/y;
	const gaps= /(?:\s|\[\[\d+\]\])*/y;
	const wordEnd= /[\p{L}\p{N}]$/u;
	const wordStart= /^[\p{L}\p{N}]/u;
	let backtrackingMode= 0;
	let baseIndex= 0, baseBacktrackingIndex= baseIndex;
	let sourceIndex= 0, sourceBacktrackingIndex= sourceIndex;
	let whitespaceEnd= 0;
	let partialWhitespaceEnd= 0;
	let copied= 0;
	let result= '';
	while (nextRef) {

		// Reference?
		if (sourceIndex === nextRef.index) {
			matchingRefs.lastIndex= baseIndex;
			let existing= matchingRefs.exec(base);
			while (existing && existing[0].trim() !== nextRef[0]) {
				existing= matchingRefs.exec(base);
			}
			if (existing) {

				// Keep existing reference
				baseBacktrackingIndex= baseIndex= matchingRefs.lastIndex;

			} else {

				// Add new reference
				result+= base.slice(copied, baseIndex) + nextRef[0];
				copied= baseIndex;

			}
			sourceBacktrackingIndex= sourceIndex+= nextRef[0].length;
			nextRef= refs.exec(withRefs);
			backtrackingMode= 0;
			continue;
		}

		// Fast path: no reference and same character in base and source
		const nextSourceChar= withRefs[sourceIndex];
		if (base[baseIndex] === nextSourceChar && (!result || !/\s/.test(nextSourceChar) || exactWhitespace)) {
			baseBacktrackingIndex= ++baseIndex;
			sourceBacktrackingIndex= ++sourceIndex;
			backtrackingMode= 0;
			continue;
		}

		// References already present only in the base must not block text alignment.
		existingRefs.lastIndex= baseIndex;
		if ((exactWhitespace || !/\s/.test(withRefs[sourceIndex])) && existingRefs.exec(base)) {
			baseIndex= existingRefs.lastIndex;
			continue;
		}

		// Validate a complete whitespace gap before merging references inside it.
		if (exactWhitespace && sourceIndex >= whitespaceEnd && /\s/.test(withRefs[sourceIndex])) {
			gaps.lastIndex= baseIndex;
			const baseGap= gaps.exec(base)?.[0] ?? '';
			gaps.lastIndex= sourceIndex;
			const sourceGap= gaps.exec(withRefs)?.[0] ?? '';
			const baseWhitespace= baseGap.replace(/\S/g, '');
			const sourceWhitespace= sourceGap.replace(/\S/g, '');
			if (baseWhitespace !== sourceWhitespace) {
                const isPartialGap= gaps.lastIndex === withRefs.length && /\[\[\d+\]\]$/.test(sourceGap) &&
                    sourceWhitespace.length <= baseWhitespace.length;
				if (!isPartialGap) {
					if (retryWithPatchedPunctuation()) {
						continue;
					}
					break;
				}
				partialWhitespaceEnd= nextRef.index;
			}
			whitespaceEnd= sourceIndex + sourceGap.length;
		}

		// Handle differing characters or whitespace ignored by the fast path.
		if (exactWhitespace) {
			if (sourceIndex < partialWhitespaceEnd) {
				sourceIndex= partialWhitespaceEnd;
				continue;
			}
			if (retryWithPatchedPunctuation()) {
				continue;
			}
			break;
		}

		// Ignore gaps, but never split or join an alphanumeric token.
		gaps.lastIndex= baseIndex;
		const baseGap= gaps.exec(base)?.[0] ?? '';
		const baseEnd= gaps.lastIndex;
		gaps.lastIndex= sourceIndex;
		const sourceGap= gaps.exec(withRefs)?.[0] ?? '';
		const sourceEnd= gaps.lastIndex;
		const baseWhitespace= /\s/.test(baseGap);
		const sourceWhitespace= /\s/.test(sourceGap);
		if ((baseWhitespace !== sourceWhitespace &&
			wordEnd.test(withRefs.slice(Math.max(0, sourceIndex - 2), sourceIndex)) &&
			wordStart.test(baseWhitespace ? withRefs.slice(sourceEnd, sourceEnd + 2) : base.slice(baseEnd, baseEnd + 2)))
			|| (baseEnd === baseIndex && sourceEnd === sourceIndex)) {
				if (retryWithPatchedPunctuation()) {
					continue;
				}
				break;
			}

		// References precede base whitespace; do not skip source references.
		sourceIndex= Math.min(sourceEnd, nextRef.index);
		if (sourceIndex !== nextRef.index) baseIndex= baseEnd;
	}
	return result + base.slice(copied);

	function retryWithPatchedPunctuation() {
		if (exactPunctuation || backtrackingMode > 2) return false;
		if (backtrackingMode < 1) {
			backtrackingMode= 1;
			const oneWidthBaseToken= base[baseBacktrackingIndex];
			if (/[^\p{L}\p{N}\s]/u.test(oneWidthBaseToken) &&  withRefs[sourceBacktrackingIndex] !== oneWidthBaseToken) {
				sourceIndex= sourceBacktrackingIndex;
				baseIndex= baseBacktrackingIndex + 1;
				resetNonExactWhitespaceMatching();
				return true;
			}
		}
		if (backtrackingMode < 2) {
			backtrackingMode= 2;
			const oneWidthSourceToken= withRefs[sourceBacktrackingIndex];
			if (/[^\p{L}\p{N}\s]/u.test(oneWidthSourceToken) && base[baseBacktrackingIndex] !== oneWidthSourceToken) {
				sourceIndex= sourceBacktrackingIndex + 1;
				baseIndex= baseBacktrackingIndex;
				resetNonExactWhitespaceMatching();
				return true;
			}
		}
		if (backtrackingMode < 3) {
			backtrackingMode= 3;
			const oneWidthBaseToken= base[baseBacktrackingIndex];
			const oneWidthSourceToken= withRefs[sourceBacktrackingIndex];
			if (/[^\p{L}\p{N}\s]/u.test(oneWidthBaseToken) && /[^\p{L}\p{N}\s]/u.test(oneWidthSourceToken)
				&& oneWidthBaseToken !== oneWidthSourceToken) {
				sourceIndex= sourceBacktrackingIndex + 1;
				baseIndex= baseBacktrackingIndex + 1;
				resetNonExactWhitespaceMatching();
				return true;
			}
		}
		return false;
	}

	function resetNonExactWhitespaceMatching() {
		whitespaceEnd= 0;
		partialWhitespaceEnd= 0;
	}

}

/**
 * Removes all `[[n]]` references, where `n` is a non-negative integer (leading zeros allowed), from the given text.
 * Everything else, including whitespace around references, is kept unchanged.
 *
 * @example
 * removeRefs('Lorem ipsum[[1]] dolor[[012]]') // => 'Lorem ipsum dolor'
 *
 * @param {string} text - The text from which to remove the references
 * @returns {string}
 */
export function removeRefs(text) {
	return text.replace(/\[\[\d+\]\]/g, '');
}