export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    browser.runtime.openOptionsPage();
  });

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === 'openOptions') {
      browser.runtime.openOptionsPage();
    }
  });
});
