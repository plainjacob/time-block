let interval;
let timerState = {
  running: false,
  startTime: null,
  duration: 0,
  elapsed: 0,
  targetTabId: null
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    switch (message.action) {
      case "start":
        if (!message.duration || message.duration <= 0) {
          sendResponse({ success: false, error: "Invalid duration"});
          return true;
        }

        timerState.running = true;
        timerState.startTime = message.startTime;
        timerState.duration = message.duration;
        timerState.elapsed = 0;
        timerState.targetTabId = message.tabId;

        broadcastState();

        // Update timer state
        interval = setInterval(() => {
          try {
            timerState.elapsed = Date.now() - timerState.startTime;
            const remaining = timerState.duration - timerState.elapsed;

            broadcastState();

            if (remaining <= 0) {
              timerState.running = false;
              clearInterval(interval);
              interval = null;

              broadcastState();
              
              if (message.tabId) {
                chrome.tabs.get(message.tabId, (tab) => {
                  if (chrome.runtime.lastError) {
                    console.log("Target tab no longer exists", chrome.runtime.lastError.message);
                  } else {
                    chrome.tabs.remove(message.tabId, () => {
                      if (chrome.runtime.lastError) {
                        console.error("Error closing tab:", chrome.runtime.lastError.message);
                      }
                    });
                  }
                });
              }

              playSound();
            }
          } catch (error) {
            console.error("Error in timer interval:", error);
            clearInterval(interval);
            interval = null;
          }
        }, 100);

        sendResponse({ success: true });
        break;

      case "reset":
        timerState.running = false;
        timerState.startTime = null;
        timerState.duration = 0;
        timerState.elapsed = 0;
        if (interval) {
          clearInterval(interval);
          interval = null;
        }

        broadcastState();
        sendResponse({ success: true });
        break;

      case "getState":
        // Calculate current remaining time when state is requested
        if (timerState.running) {
          timerState.elapsed = Date.now() - timerState.startTime;
        }
        const remaining = timerState.running
          ? Math.max(0, timerState.duration - timerState.elapsed)
          : 0;
        
        sendResponse({ 
          success: true,
          timerState: { 
            ...timerState,
            remaining: remaining
          } 
        });
        break;
      
      default:
        sendResponse({ success: false, error: "Unknown action" });
        break;
    }
  } catch (error) {
    console.error("Error in message handler:", error);
    sendResponse({ success: false, error: error.message });
  }
  return true; // Keep message channel open for async responses
});

function broadcastState() {
  const elapsed = timerState.running ? Date.now() - timerState.startTime : 0;
  const remaining = timerState.running
    ? Math.max(0, timerState.duration - elapsed)
    : 0;

  chrome.runtime.sendMessage({
    action: "stateUpdate",
    state: {
      running: timerState.running,
      remaining: remaining,
      duration: timerState.duration
    }
  }).catch(() => {

  });
}

async function ensureOffscreenDocument() {
  try {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (!hasDoc) {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play timer alarm sound"
      });
    }
    return true;
  } catch (error) {
    console.error("Error creating offscreen document:", error);
    return false;
  }
}

async function playSound() {
  try {
    const created = await ensureOffscreenDocument();
    if (!created) {
      console.error("Failed to create offscreen document, cannot play sound");
      return;
    }

    await chrome.runtime.sendMessage({ action: "playSound" });
  } catch (error) {
    console.error("Error playing sound:", error);
  }
}