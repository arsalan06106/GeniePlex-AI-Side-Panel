function initiate () {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
    chrome.runtime.onInstalled.addListener(function () {
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1],
            addRules: [{
                    id: 1,
                    priority: 1,
                    action: {
                        type: "modifyHeaders",
                        responseHeaders: [
                            {
                                header: "content-security-policy",
                                operation: "remove"
                            },
                            {
                                header: "x-frame-options",
                                operation: "remove"
                            },
                            {
                                header: "frame-options",
                                operation: "remove"
                            },
                            {
                                header: "frame-ancestors",
                                operation: "remove"
                            },
                            {
                                header:"X-Content-Type-Options",
                                operation: "remove"
                            },
                            {
                                header: "access-control-allow-origin",
                                operation: "set",
                                value: "*"
                            }
                        ]
                    },
                    condition: {
                        resourceTypes: [
                            "main_frame",
                            "sub_frame"
                        ]
                    }
                }]
        });
    });

};

initiate();

// Listen for messages from the side panel (e.g., for premium status)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PREMIUM_STATUS') {
    // In the future, this could check actual license status.
    // For now, we respond immediately to prevent the connection error.
    sendResponse({ isPremium: false });
  }
  // Return true to indicate you wish to send a response asynchronously
  return true;
});

// Handle long-lived connections from the side panel
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'premium-status') {
    // A simple listener to keep the port open and prevent errors.
    port.onMessage.addListener((msg) => {
      // Can handle messages on the port if needed in the future
    });
  }
});

// Global keyboard command handling: route to side panel
try {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'next_ai_model' && command !== 'previous_ai_model') return;
    // Broadcast to any side panel instance; sidepanel listens and acts
    chrome.runtime.sendMessage({ type: 'AI_MODEL_SWITCH', direction: command === 'next_ai_model' ? 'next' : 'prev' });
  });
} catch (_) {}
