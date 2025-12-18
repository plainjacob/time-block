let interval;
let timerState = {
  running: false,
  startTime: null,
  duration: 0,
  elapsed: 0
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "start":
      timerState.running = true;
      timerState.startTime = message.startTime;
      timerState.duration = message.duration;

      // Update timer state every second
      interval = setInterval(() => {
        timerState.elapsed = Date.now() - timerState.startTime;
        const remaining = timerState.duration - timerState.elapsed;

        if (remaining <= 0) {
          timerState.running = false;
          clearInterval(interval);

          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            const activeTabId = tabs[0].id;
            chrome.tabs.remove(activeTabId);
          }
          });

          playSound();
        }
      }, 1000);
      break;

    case "reset":
      timerState.running = false;
      timerState.startTime = null;
      timerState.duration = 0;
      timerState.elapsed = 0;
      if (interval) {
        clearInterval(interval);
      }
      break;

    case "getState":
      sendResponse( { timerState } );
      break;
  }
});

async function ensureOffscreenDocument() {
  const hasDoc = await chrome.offscreen.hasDocument();
  if (!hasDoc) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play timer alarm sound"
    });
  }
}

async function playSound() {
  await ensureOffscreenDocument();
  chrome.runtime.sendMessage({ action: "playSound" });
}