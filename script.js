const form = document.querySelector("form");
const display = document.getElementById("display");
const resetBtn = document.getElementById("reset-btn");
const submitBtn = document.querySelector('button[type="submit"]');
let isSubmitting = false;
let messageListener = null;

// Listen for tick updates from background script
messageListener = (message) => {
  if (message.action === "stateUpdate") {
    updateDisplay(message.state);
  }
};

chrome.runtime.onMessage.addListener(messageListener);

// Clean up when popup closes to prevent memory leaks
window.addEventListener('beforeunload', () => {
  if (messageListener) {
    chrome.runtime.onMessage.removeListener(messageListener);
    messageListener = null;
  }
});
  
// Get initial timer state from service worker
chrome.runtime.sendMessage({ action: "getState" }, (response) => {
  if (chrome.runtime.lastError) {
    console.error("Error getting initial state:", chrome.runtime.lastError.message);
    display.textContent = "00:00";
    return;
  }

  if (response && response.success && response.timerState) {
    const timerState = response.timerState;
    if (timerState.running && timerState.remaining > 0) {
      updateDisplay({
        running: timerState.running,
        remaining: timerState.remaining,
        duration: timerState.duration
      });
    } else if (!timerState.running) {
      display.textContent = "00:00";
      display.classList.remove("red");
    }
  }
});

form.addEventListener("submit", async e => {
  e.preventDefault();

  if (isSubmitting) {
    return;
  }

  isSubmitting = true;
  submitBtn.disabled = true;


  try {
    // Check if a timer state exists
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "getState" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    if (!response.success) {
      alert(response.error || "Failed to get timer state");
      return;
    }
     
    const timerState = response.timerState;
    if (timerState.running) {
      alert("Timer is already running!");
      return;
    }
    
    const input = new FormData(e.target).get("duration");

    // Check if input is empty or null
    if (!input || input.trim() === "") {
      alert("Please enter a time");
      return;
    }

    const timeRegex = /^(\d{1,2}):(\d{1,2})$/;
    if (!timeRegex.test(input)) {
      alert("Invalid time format. Please use MM:SS format (e.g., 05:30)");
      return;
    }

    const [minutes, seconds] = input.split(":").map(Number);

    // Check if parsing failed
    if (isNaN(minutes) || isNaN(seconds)) {
      alert ("Invalid time format. Please enter numbers only.");
      return;
    }

    // Validate ranges
    if (minutes < 0 || seconds < 0) {
      alert("Time cannot be negative");
      return;
    }

    if (seconds >= 60) {
      alert("Seconds must be between 0 and 59");
      return;
    }

    if (minutes > 1440) {
      alert("Timer cannot exceed 24 hours (1440 minutes)");
      return;
    }

    const duration = minutes * 60 + seconds;

    if (duration === 0) {
      alert("Please enter a valid duration greater than 0");
      return;
    }

    if (duration > 86400) {
      alert("Timer cannot exceed 24 hours");
      return;
    }

    // Get current tab ID to pass to background
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTabId = tabs.length > 0 ? tabs[0].id : null;

    // Send timer state to service worker
    const startResponse = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ 
        action: "start", 
        startTime: Date.now(), 
        duration: duration * 1000, 
        elapsed: 0,
        tabId: currentTabId
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    if (!startResponse.success) {
      alert(startResponse.error || "Failed to start timer");
      return;
    }

    form.reset();
  
  } catch (error) {
    console.error("Error starting timer:", error);
    alert("Failed to start timer. Please try again.");
  } finally {
    setTimeout(() => {
      isSubmitting = false;
      submitBtn.disabled = false;
    }, 500);
  }
});


// Reset timer
resetBtn.addEventListener("click", () => {
  try {
    chrome.runtime.sendMessage({ action: "reset" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error resetting timer:", chrome.runtime.lastError.message);
        alert("Failed to reset timer");
        return;
      }

      if (!response.success) {
      console.error("Reset failed:", response.error);
      alert("Failed to reset timer");
      return;
      }

      display.textContent = "00:00";
      display.classList.remove("red");

      // Re-enable submit button in case it was disabled
      submitBtn.disabled = false;
      isSubmitting = false;
    }); 
  } catch (error) {
    console.error("Error in reset handler:", error);
    alert(`Failed to reset timer: ${error.message}`);
  }
});

function updateDisplay(state) {
  display.classList.remove("red");

  if (!state || !state.running) {
    display.textContent = "00:00";
    display.classList.remove("red");
    return;
  }

  const totalSeconds = Math.ceil(state.remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
    
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  display.textContent = `${formattedMinutes}:${formattedSeconds}`;

  if (totalSeconds > 0 && totalSeconds <= 10) {
    display.classList.add("red");
  }
}
