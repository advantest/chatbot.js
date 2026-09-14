import { chatbot } from './chatbot.core.js';
import { chatbotUi } from './chatbot.ui.js';
import { Dropdown } from './lemonadejs.dropdown.js';

/**
 * @export
 */
// @ts-ignore
window.chatbot= chatbot;

/**
 * @export
 */
// @ts-ignore
window.chatbotUi= chatbotUi;

/**
 * @export
 */
// @ts-ignore
window.createDropdown= Dropdown;