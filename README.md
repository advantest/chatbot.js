# chatbot.js

A **customizable**, framework-agnostic **chatbot widget** implemented in JavaScript that can be easily integrated into an existing HTML site or used as a standalone site (see [`src/sample.html`](src/sample.html)).


## Getting Started

### As alternative web UI for [llama.cpp](https://github.com/ggml-org/llama.cpp)

Start [llama-server](https://github.com/ggml-org/llama.cpp/tree/master/tools/server) with the `--path` parameter pointing to the directory that contains [`sample.html`](src/sample.html) together with the built files like `chatbot.compat.min.js`, e.g.:

```
llama-server -m SmolLM3-3B-Q4_K_M.gguf --port 8082 --path <path_to_/chatbot.js/dist>
```

And then open `http://localhost:8082/sample.html` or, if `--port 8082` is omitted, `http://localhost:8080/sample.html`.


## Run-Time Dependencies

The JavaScript file contains the following dependencies:
- [markdown-it](https://www.npmjs.com/package/markdown-it) - Converts Markdown to HTML
- [@mdit/plugin-katex](https://www.npmjs.com/package/@mdit/plugin-katex) - A markdown-it extension for converting mathematical expressions contained in Markdown in LaTeX format
- [@lemonadejs/dropdown](https://lemonadejs.com/docs/plugins/dropdown) - Dropdown widget


## How to Build

Build: `npm install && npm run build` (see [`package.json`](package.json)) or via Maven `mvn generate-resources` (see [`pom.xml`](pom.xml))

Run tests: `npm test`

When using the Eclipse IDE, make sure you have run the *chatbot.js (Maven)* launch configuration initially. This allows you to use the other launch configurations for building and testing, as well as the *Project Build* (Ctrl+B) command, which runs `npm run build:fast`.


## License

[MIT](LICENSE)
