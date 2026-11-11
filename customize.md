# Customize

The chatbot is created and configured in two steps: `chatbot(config)` creates the core, none-UI chat
logic, and `chatbotUi(chatbot, containerElement, uiConfig)` renders it into the given container element.
Both `config` and `uiConfig` are plain objects. All properties are optional.

```js
// Core, none-UI configuration
var config= {
	connector: (callback, msg) => {
		return new Promise((resolve) => {
			callback(msg.toUpperCase(), true);
			resolve();
		});
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
| `connector` | `Connector` | none | Custom transport function that replaces the built-in HTTP request entirely. See "Custom connector" below. Takes precedence over `url` and `baseRequestData`. |
| `sendHook` | `(message, chatbot, rawSendFn, options) => Promise` | none | Intercepts every call to `chatbot.send(...)`. Call `rawSendFn(message, options)` to continue the normal send, or handle the message yourself (for example to run client-side commands). |
| `options` | `Array<Object> \| string \| function` | `[]` | Definition of the selectable options shown above the input field (for example a model picker). An array is used as-is; a string is fetched as a URL and expected to return the array as JSON; a function (which may return a `Promise`) is called with the chatbot and must resolve to the array. See "Options" below for the item shape. |
| `history` | `'inmemory' \| 'indexeddb' \| History` | none | Enables persistence and the history sidebar. `'indexeddb'` stores chats in the browser's IndexedDB (survives reloads); `'inmemory'` keeps chats only for the current page life cycle; alternatively, pass a custom `History` implementation (see the `History` typedef in `chatbot.core.js`). |
| `historyIndexeddbPrefix` | `string` | `''` | Prefix prepended to the IndexedDB database name. Only used when `history` is `'indexeddb'`. Useful to avoid collisions when multiple chatbot instances run on the same origin. |
| `refsBaseUrl` | `string` | `''` | Base URL prepended to the `h` (href) field of every reference/source when rendering cited sources and the sources sidebar. |
| `imagesBaseUrl` | `string` | `''` | Base URL prepended to the `i` (image path) field of a reference when rendering images included in the Markdown of chatbot responses. |


### Custom connector

A `connector` is a function that sends a message and streams the reply back:

```js
// callback(delta, done, refs, refsDelta, refsDone) streams the assistant reply back to the chatbot
connector: (callback, message, chatbot, options) => {
	return new Promise((resolve, reject) => {
		// ... call your own backend, then invoke callback(...) one or more times ...
		callback('Hello, ', false);
		callback('World!', true);
		resolve();
	});
}
```


### Options

Each entry in the `options` array defines a dropdown shown alongside the input field:

```js
{
	id: 'model',   // key used in the request/options object passed to send hooks and connectors
	scope: 'chat', // optional: 'chat' locks the dropdown once the chat has started
	values: [
		{ value: 'MiniCPM5-2B', label: 'MiniCPM5 2B', default: true }, // preselected
		{ value: 'Qwen3.5-4B',  label: 'Qwen3.5 4B' },
		{ value: 'gpt-oss' } // label defaults to value
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
| `errorMsg` | `ErrorMsg` | `'Something went wrong.'` | Message and buttons shown in the error panel when sending a message fails. See "Error panel" below. |
| `error<status>Msg`, `error<NN>xMsg`, `error<N>xxMsg` | `ErrorMsg` | none | HTTP status-specific variants of `errorMsg`, for example `error413Msg`, `error41xMsg`, or `error4xxMsg`. See "Error panel" below. |


### Behavior

| Property | Type | Default | Description |
|---|---|---|---|
| `attach` | `boolean` | `false` | Enables attaching images: shows an attach button next to the input field and allows pasting images via Ctrl+V. Attached images are shown as thumbnails above the input field. |
| `attachAccept` | `string` | `'image/*'` | Sets the image filter in the file chooser and restricts what sort of image can be pasted, for example `'image/png,image/jpeg'` or `'.png,.jpeg,.jpg'`. |
| `attachMax` | `number` | `-1` (unlimited) | Maximum number of attached images per message. When exceeded, the oldest attachments are removed. With `1`, the file picker allows selecting only a single file. |
| `attachOnlyRequest` | `boolean` | `true` | Allows sending a message that consists only of attachments (without text). Set to `false` to require text. |
| `newBtn` | `boolean` | `true` | Shows the "New chat" button. Set to `false` to hide it. |
| `closeBtn` | `boolean` | `false` | Shows a close button in the top bar. |
| `closeFn` | `function` | none | Called when the close button is clicked. Only relevant together with `closeBtn: true`. |
| `hideFirstMessage` | `boolean` | `false` | Hides the very first message of the chat from the message area, for example to hide a hidden system-style priming message. |
| `customizeMsgFn` | `(toolbar, msgElement, isUserMessage, msgObj) => void` | none | Called for every rendered message; lets you add custom buttons to `toolbar` or otherwise modify the message. |
| `sourcesSidebar` | `boolean` | `true` | Shows the "N sources" button on assistant messages that have references, and enables the sources sidebar. |
| `questionNav` | `boolean` | `true` | Enables the floating navigation rail with clickable anchors for previous user questions. |
| `questionNavThreshold` | `number` | `4` | Minimum number of user questions before the navigation rail becomes visible. |


### Error panel

When sending a message fails, the failed response is removed and an error panel with a message and up to three
buttons is shown below the last message:

| Button | ID | Default text | Action |
|---|---|---|---|
| Retry | `errorRetry` | `'Retry'` | Resends the last user message. |
| New chat | `errorNewChat` | `'New Chat'` | Discards the current chat and starts a new, empty one. |
| Revert last message | `errorRevert` | `'Revert Last Message'` | Removes the last user message (and the failed response) from the chat and puts its text back into the input field, so it can be edited and resent. |

The message and the buttons are configured via an `ErrorMsg`, which is one of the following:

- a `string`: plain text message (with the default buttons),
- an object `{ text?: string, html?: string, retryBtn?: boolean, newChatBtn?: boolean, revertBtn?: boolean }`:
  - `text`: plain text message,
  - `html`: HTML message; takes precedence over `text`,
  - `retryBtn`: shows the "Retry" button; default `true`,
  - `newChatBtn`: shows the "New Chat" button; default `false`,
  - `revertBtn`: shows the "Revert Last Message" button; default `false`,

  If neither `text` nor `html` is set, `'Something went wrong.'` is shown.
- a function `(chatbot, error) => ErrorMsg`: called on each error to compute the message dynamically. Returning
  `null`, `undefined`, or an empty string falls through to the next, less specific property (see below).

If the error has an HTTP status (the built-in HTTP request sets `error.http` to the response status; a custom
`connector` can do the same by rejecting with an `Error` that has an `http` property), the most specific configured
property wins. For example, for status `413`, the properties are looked up in this order:

1. `error413Msg`
2. `error41xMsg`
3. `error4xxMsg`
4. `errorMsg` (not used for status `413`, see below)

Errors without an HTTP status only use `errorMsg`.

Status `413` (request too large, for example because of too many or too large attached images) is special: retrying
the same request would fail again. Therefore, by default, the message `'Request is too large.'` is shown with the
"New Chat" button instead of the "Retry" button, and `errorMsg` is ignored for it. When a status-specific property
for `413` is set to a string, only the message text is replaced while these buttons are kept; when it is set to an
object, the buttons are taken from the object (with the general defaults above).

The buttons can be restyled like all other built-in buttons (see "Icons, hover text, and title attributes" below),
for example via `errorRetryBtnText`, `errorNewChatBtn`, or `errorRevertHover`.

Example:

```js
var uiConfig= {
	errorMsg: { html: 'Something went wrong. <a href="status.html">Check the service status</a>.' },
	error401Msg: { text: 'Your session has expired. Please reload the page.', retryBtn: false },
	error5xxMsg: (chatbot, error) => ({
		text: 'The server is unavailable (' + error['http'] + ').',
		revertBtn: true
	}),
	error413Msg: 'Too many images attached.', // keeps the "New Chat" button and hides "Retry"
	errorRetryBtnText: 'Try again'
};
```


### Icons, hover text, and title attributes

Built-in buttons can be individually restyled. For a button with ID `<id>`, the following properties apply:

| Property pattern | Type | Description |
|---|---|---|
| `<id>Btn` | `string` (SVG/HTML) | Overrides the button icon. |
| `<id>BtnText` | `string` | Overrides the button text/label. |
| `<id>Hover` | `string` | Overrides the tooltip text shown on hover. |

Available IDs: `new` (New chat), `sidebar` (open history sidebar), `close` (close the top bar or the sources
sidebar), `send` (send message), `copy` (copy a message; `doneBtn` overrides the icon shown briefly after a
successful copy), `errorRetry` (retry after a failed send), `errorNewChat` (start a new chat after a failed send),
`errorRevert` (revert the last user message after a failed send), `attach` (attach an image), `attachDel` (remove an
attached image).

Example:

```js
var uiConfig= {
	attach: true,
	attachMax: 1,
	newHover: 'Start new chat',
	copyBtn: '<svg>...</svg>'
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