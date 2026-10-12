import { teamsAdapter } from '@/adapters/teams/adapter';
import { startContent } from '@/core/bootstrap';

export default defineContentScript({
  matches: [
    'https://teams.microsoft.com/*',
    'https://teams.cloud.microsoft/*',
  ],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    startContent([teamsAdapter]);
  },
});
