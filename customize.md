# Customize

The chatbot is created and configured in two steps: `chatbot(config)` creates the core, none-UI chat
logic, and `chatbotUi(chatbot, containerElement, uiConfig)` renders it into the given container element.
Both `config` and `uiConfig` are plain objects. All properties are optional.

```js
// Core, none-UI configuration
var config= {
	connector: {
		send: function(callback, msg) {
			return new Promise((resolve) => {
				callback(msg.toUpperCase(), true);
				resolve();
			});
		}
	},
	history: 'indexeddb'
};

// UI configuration
var uiConfig= {
	title: 'chatbot.js',
	footerHtml: 'A chatbot can make mistakes. Check important info.'
};

var containerElement= document.getElementsByTagName('body')[0];
chatbotUi(chatbot(config), containerElement, uiConfig).typeEverywhere(true);
```


## Core configuration

Passed to `chatbot(config)`. Instead of an object, a plain string can be passed as shorthand for `{ url: string }`.

| Property | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | `'v1/chat/completions'` | Endpoint the chatbot sends requests to when no `connector` is configured. Used with an OpenAI-compatible chat completions API. |
| `baseRequestData` | `Object \| function \| string` | `{}` | Base of the JSON request body sent to `url`. An object is used as-is (with `messages` and, for streaming, `stream: true` added); a function is called with `(chatbot, url, asStream)` and must return a string or an object to stringify; a string is sent as the request body verbatim, letting you build the whole payload yourself. |
| `connector` | `Connector` | none | Custom transport that replaces the built-in HTTP request entirely. See "Custom connector" below. Takes precedence over `url` and `baseRequestData`. |
| `sendHook` | `(message, chatbot, rawSendFn, options) => Promise` | none | Intercepts every call to `chatbot.send(...)`. Call `rawSendFn(message, options)` to continue the normal send, or handle the message yourself (for example to run client-side commands). |
| `options` | `Array<Object> \| string \| function` | `[]` | Definition of the selectable options shown above the input field (for example a model picker). An array is used as-is; a string is fetched as a URL and expected to return the array as JSON; a function (which may return a `Promise`) is called with the chatbot and must resolve to the array. See "Options" below for the item shape. |
| `history` | `'inmemory' \| 'indexeddb' \| History` | none | Enables persistence and the history sidebar. `'indexeddb'` stores chats in the browser's IndexedDB (survives reloads); `'inmemory'` keeps chats only for the current page life cycle; alternatively, pass a custom `History` implementation (see the `History` typedef in `chatbot.core.js`). |
| `historyIndexeddbPrefix` | `string` | `''` | Prefix prepended to the IndexedDB database name. Only used when `history` is `'indexeddb'`. Useful to avoid collisions when multiple chatbot instances run on the same origin. |
| `refsBaseUrl` | `string` | `''` | Base URL prepended to the `h` (href) field of every reference/source when rendering cited sources and the sources sidebar. |


### Custom connector

A `connector` is an object with a `send` method:

```js
connector: {
	// callback(delta, done, refs, refsDelta, refsDone) streams the assistant reply back to the chatbot
	send: function(callback, message, chatbot, options) {
		return new Promise((resolve, reject) => {
			// ... call your own backend, then invoke callback(...) one or more times ...
			callback('Hello', false);
			callback(' world', true);
			resolve();
		});
	}
}
```


### Options

Each entry of the `options` array describes one dropdown shown above the input field:

```js
{
	id: 'model',          // key used in the request/options object passed to send hooks and connectors
	scope: 'chat',        // optional: 'chat' disables the dropdown once the chat has started
	values: [
		{ value: 'gpt', label: 'GPT', default: true },
		{ value: 'llama', label: 'Llama' }
	]
}
```


## UI configuration

Passed as the third argument to `chatbotUi(chatbot, containerElement, uiConfig)`.


### Text and labels

| Property | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | none | Plain text heading shown above the chat. |
| `titleHtml` | `string` | none | HTML heading shown above the chat; takes precedence over `title` when set. |
| `placeholder` | `string` | `'Ask anything'` | Placeholder text of the input field before the first message is sent. |
| `placeholderFollowup` | `string` | none | Placeholder text of the input field after the first message has been sent. Falls back to `placeholder` when not set. |
| `footerHtml` | `string` | none | HTML shown below the input field, for example a disclaimer. |
| `historyFooter` | `string` | `"Your chats are saved locally in your browser's IndexedDB."` | Note shown at the bottom of the history sidebar. Set to an empty string to hide it. |


### Behavior

| Property | Type | Default | Description |
|---|---|---|---|
| `newBtn` | `boolean` | `true` | Shows the "New chat" button. Set to `false` to hide it. |
| `closeBtn` | `boolean` | `false` | Shows a close button in the top bar. |
| `closeFn` | `function` | none | Called when the close button is clicked. Only relevant together with `closeBtn: true`. |
| `hideFirstMessage` | `boolean` | `false` | Hides the very first message of the chat from the message area, for example to hide a hidden system-style priming message. |
| `customizeMsgFn` | `(toolbar, msgElement, isUserMessage, msgObj) => void` | none | Called for every rendered message; lets you add custom buttons to `toolbar` or otherwise modify the message. |
| `sourcesSidebar` | `boolean` | `true` | Shows the "N sources" button on assistant messages that have references, and enables the sources sidebar. |
| `questionNav` | `boolean` | `true` | Enables the floating navigation rail with clickable anchors for previous user questions. |
| `questionNavThreshold` | `number` | `4` | Minimum number of user questions before the navigation rail becomes visible. |


### Icons, hover text, and title attributes

Built-in buttons can be individually restyled. For a button with ID `<id>`, the following properties apply:

| Property pattern | Type | Description |
|---|---|---|
| `<id>Btn` | `string` (SVG/HTML) | Overrides the button icon. |
| `<id>Hover` | `string` | Overrides the tooltip text shown on hover. |
| `<id>Title` | `string` | Overrides the native `title` attribute; falls back to `<id>Hover` when not set. |

Available IDs: `new` (New chat), `sidebar` (open history sidebar), `close` (close the top bar or the sources
sidebar), `send` (send message; icon only, no hover text), `copy` (copy a message; `doneBtn` overrides the
icon shown briefly after a successful copy).

Example:

```js
var uiConfig= {
	newHover: 'Start new chat',
	copyBtn: '<svg>...</svg>',
	doneBtn: '<svg>...</svg>'
};
```


### API returned by `chatbotUi(...)`

`chatbotUi(...)` returns an object with the following methods, each returning the object itself for chaining:

| Method | Description |
|---|---|
| `enter(text, smart?)` | Sets the input field value. With `smart: true`, sends the text right away if the chat is empty, does nothing if it was already asked, and otherwise appends it to the input field. |
| `typeEverywhere(enabled)` | When `enabled` is `true`, keystrokes are captured anywhere on the page, not just while the input field has focus. Disabled by default. |
| `autoScroll(type)` | Sets the auto-scroll behavior: `'top'` (default) scrolls new content to the top, `'bottom'` scrolls to the bottom, `'off'` disables auto-scrolling. |
| `focus()` | Moves the keyboard focus to the input field. |