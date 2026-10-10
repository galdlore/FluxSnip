import { chatAdapter } from '@/adapters/chat/adapter';
import { startContent } from '@/core/bootstrap';

export default defineContentScript({
  matches: ['https://chat.google.com/*'],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    startContent([chatAdapter]);
  },
});
