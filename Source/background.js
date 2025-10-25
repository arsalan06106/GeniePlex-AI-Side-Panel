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

// Global keyboard command handling: route to side panel
try {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'next_ai_model' && command !== 'previous_ai_model') return;
    // Broadcast to any side panel instance; sidepanel listens and acts
    chrome.runtime.sendMessage({ type: 'AI_MODEL_SWITCH', direction: command === 'next_ai_model' ? 'next' : 'prev' });
  });
} catch (_) {}
