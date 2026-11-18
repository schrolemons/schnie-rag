import { createChatHandler } from '../services/vercel/chat-handler.mjs';
export default createChatHandler();
export const config = { maxDuration: 60 };
