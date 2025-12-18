const form = document.querySelector("form");
const display = document.getElementById("display");
const resetBtn = document.getElementById("reset-btn");
let interval;

// Get timer state from service worker
chrome.runtime.sendMessage({ action: "getState" }, (response) => {
  const timerState = response.timerState;
  if (timerState.running) {
    const duration = (timerState.duration - timerState.elapsed) / 1000;
    updateUI(duration, display);
  }
});

form.addEventListener("submit", e => {
  e.preventDefault();

  // Check if a timer state exists
  chrome.runtime.sendMessage({ action: "getState" }, (response) => {
    const timerState = response.timerState;
    if (timerState.running) {
      return;
    }
    const input = new FormData(e.target).get("duration");

    const [minutes, seconds] = input.split(":").map(Number);
    const duration = minutes * 60 + seconds;

    // Send timer state to service worker
    chrome.runtime.sendMessage({ action: "start", startTime: Date.now(), duration: duration * 1000, elapsed: 0 });
    updateUI(duration, display);

    form.reset();
  });
});

// Reset timer
resetBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "reset" });
  display.textContent = "00:00";
  if (interval) {
    clearInterval(interval);
  }
});

function updateUI(duration, display) {
  var timer = duration, minutes, seconds;
  interval = setInterval(function () {
    minutes = parseInt(timer / 60, 10);
    seconds = parseInt(timer % 60, 10);
    
    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    display.textContent = minutes + ":" + seconds;

    if (timer <= 10) {
      display.classList.add("red");
    }
    
    if (--timer < 0) {
      timer = 0;
      clearInterval(interval);
      display.classList.remove("red");
    }
  }, 1000);
}
