import { chatAdapter } from '@/adapters/chat/adapter';
import { gmailAdapter } from '@/adapters/gmail/adapter';
import { startContent } from '@/core/bootstrap';

export default defineContentScript({
  matches: ['https://mail.google.com/*'],
  allFrames: false,
  runAt: 'document_idle',
  main() {
    startContent([gmailAdapter, chatAdapter]);
  },
});
