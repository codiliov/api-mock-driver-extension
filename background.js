let requestDetailsMap = new Map();

// Helper function to match URL against a pattern (very basic, can be improved)
// Uses the URLPattern API for robust matching with wildcards.
// https://developer.mozilla.org/en-US/docs/Web/API/URLPattern
function matchUrlPattern(url, patterns) {
    if (!url || !patterns || patterns.length === 0) return false;

    // Split patterns by newline and filter out empty lines
    const individualPatterns = patterns.split('\n').map(p => p.trim()).filter(p => p !== '');

    for (const patternString of individualPatterns) {
        try {
            // Attempt to create a URLPattern. This allows for powerful patterns like *.example.com/*
            // If the pattern starts with a domain name like 'example.com', prepend 'https://' or 'http://' to make it a valid URL for URLPattern.
            let fullPattern = patternString;
            // Check if it looks like a bare domain and might need a protocol
            if (!patternString.startsWith('http://') && !patternString.startsWith('https://') && !patternString.includes('*') && patternString.includes('.')) {
                // If it's a bare domain without wildcards, try matching both http and https for robustness
                try {
                    if (new URLPattern(`http://${patternString}`).test(url)) return true;
                    if (new URLPattern(`https://${patternString}`).test(url)) return true;
                } catch(e) {
                    // Fallback for cases where even adding protocol doesn't make it a valid URLPattern
                    // This might happen for very short or unusual domain-like strings.
                    // In such edge cases, a simple substring match on hostname can be a last resort.
                    const urlObj = new URL(url);
                    if (urlObj.hostname && urlObj.hostname.includes(patternString)) return true;
                }
            } else {
                // If it already has protocol or wildcard, use directly
                if (new URLPattern(fullPattern).test(url)) return true;
            }
        } catch (e) {
            console.warn("Custodian API Mock Driver: Invalid URL pattern in settings or URLPattern API error:", patternString, e);
            // As a last resort fallback for patterns that fail URLPattern (e.g., malformed, or older Chrome versions)
            // Perform a simpler, less precise substring match on the URL's hostname.
            try {
                const urlObj = new URL(url);
                if (urlObj.hostname && urlObj.hostname.includes(patternString.replace(/^\*\./, ''))) { // Remove leading *. for simple substring
                    return true;
                }
            } catch (urlParseError) {
                // If the URL itself is invalid, just return false
            }
        }
    }
    return false;
}

// Helper function to format the x-ov-mock header name
function formatXMockHeaderName(suffix) {
    const MOCK_HEADER_PREFIX = "x-ov-mock";
    if (!suffix || suffix.trim() === '') {
        return MOCK_HEADER_PREFIX.toLowerCase();
    }
    const cleanSuffix = suffix.trim().toLowerCase(); // Ensure suffix is lowercase
    // Add hyphen only if suffix is not empty AND doesn't start with a hyphen
    const headerName = MOCK_HEADER_PREFIX + (cleanSuffix && !cleanSuffix.startsWith('-') ? '-' : '') + cleanSuffix;
    return headerName.toLowerCase(); // Ensure entire header name is lowercase
}

// Helper function to format the x-ov-mock header value
function formatXMockHeaderValue(pairs) {
    const formattedPairs = (pairs || [])
        .filter(pair => pair.key.trim() !== '') // Only include pairs with non-empty keys
        .map(pair => {
            const apiPath = pair.key.trim();
            let mockInstruction = pair.value.trim();
            
            // Transform status= to code= for server compatibility
            mockInstruction = mockInstruction.replace(/\bstatus\s*=/gi, 'code=');
            
            // Format as: API_PATH | Prefer MOCK_INSTRUCTIONS
            return `${apiPath} | Prefer ${mockInstruction}`;
        })
        .join(' ::: '); // Use conspicuous triple colon separator with spaces
    
    return formattedPairs;
}

async function updateDynamicHeaderRules() {
    console.log("Updating dynamic header rules based on current settings and active tab URL...");

    const result = await chrome.storage.local.get(['settingsV1']);
    const settings = result.settingsV1;

    // Get the current active tab's URL
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const activeTab = tabs[0];
    const activeTabUrl = activeTab ? activeTab.url : null;

    let rulesToAdd = []; // Renamed from rulesToKeep for clarity with updateDynamicRules
    let ruleIdCounter = 1;

    // The extension is now assumed globally enabled if active in Chrome.
    // Condition: Target URL must be set.
    const isTargetUrlSet = settings && settings.targetUrl && settings.targetUrl.trim() !== '';

    // Condition: Is restriction to specific tab URLs enabled AND does the active tab's URL match?
    let isActiveTabRestrictionMet = true; // Assume no restriction by default
    if (settings && settings.restrictToTabUrlsEnabled && settings.tabUrlPatterns) {
        if (!activeTabUrl || !matchUrlPattern(activeTabUrl, settings.tabUrlPatterns)) {
            isActiveTabRestrictionMet = false;
        }
    }

    // Only add rules if target URL is set AND tab restriction (if enabled) is met
    if (isTargetUrlSet && isActiveTabRestrictionMet) {
        // --- Build rule for the single x-ov-mock header ---
        const finalMockHeaderName = formatXMockHeaderName(settings.mockHeaderSuffix);
        const finalMockHeaderValue = formatXMockHeaderValue(settings.mockHeaderKeyValuePairs);

        if (finalMockHeaderName && finalMockHeaderValue) {
            // Get the selected HTTP method from settings, default to 'post'
            const selectedMethod = settings.httpMethod || 'post';
            
            rulesToAdd.push({
                id: ruleIdCounter++,
                priority: 1,
                action: {
                    type: "modifyHeaders",
                    requestHeaders: [
                        {
                            header: finalMockHeaderName,
                            operation: "set",
                            value: finalMockHeaderValue
                        }
                    ]
                },
                condition: {
                    urlFilter: settings.targetUrl, // Apply to your GraphQL endpoint
                    requestMethods: [selectedMethod.toLowerCase()], // Use selected method
                    resourceTypes: ["xmlhttprequest", "main_frame", "sub_frame", "other"] // Cover common request types
                }
            });
        }
    } else {
        console.log("Header injection rules will not be active due to settings or active tab URL mismatch.");
        if (!isTargetUrlSet) console.log("Target GraphQL URL not set.");
        if (settings && settings.restrictToTabUrlsEnabled && !isActiveTabRestrictionMet) console.log("Active tab URL does not match restriction pattern.");
    }


    // Get existing dynamic rules to determine which IDs to remove
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules.map(rule => rule.id);

    // Update dynamic rules: remove old ones, add new ones atomically
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ruleIdsToRemove,
            addRules: rulesToAdd
        });
        console.log("Updated dynamic rules.");
        if (ruleIdsToRemove.length > 0) {
            console.log("Removed rules with IDs:", ruleIdsToRemove);
        }
        if (rulesToAdd.length > 0) {
            console.log("Added rules with IDs:", rulesToAdd.map(r => r.id));
        } else if (ruleIdsToRemove.length === 0) {
            console.log("No rules to add or remove.");
        }
    } catch (e) {
        console.error("Error updating dynamic rules:", e);
    }
}

// Event listeners to trigger rule updates
chrome.runtime.onInstalled.addListener(() => {
    updateDynamicHeaderRules();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "settings_updated") {
        updateDynamicHeaderRules();
        sendResponse({ status: "rules_update_triggered" });
        return true; // Keep the message channel open for sendResponse
    }
});

chrome.tabs.onActivated.addListener(activeInfo => {
    // Only update if the window is currently focused.
    chrome.windows.getLastFocused({ populate: false }, (window) => {
        if (window && window.id === activeInfo.windowId) {
            updateDynamicHeaderRules();
        }
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if the update is for the active tab and its URL has changed
    // Also ensure it's the currently focused window
    if (tab.active && changeInfo.url && tab.url) { // tab.url will contain the new URL if changeInfo.url is present
        chrome.windows.getLastFocused({ populate: false }, (window) => {
            if (window && window.id === tab.windowId) {
                updateDynamicHeaderRules();
            }
        });
    }
});


// Listener for when a request is about to occur (to extract operationName)
// This remains for potential future use if you want to implement operation-specific
// logic that doesn't involve header injection (e.g., logging or other actions).
// It does NOT affect the declarativeNetRequest header injection.
chrome.webRequest.onBeforeRequest.addListener(
    async (details) => {
        // Get current settings to check the selected HTTP method
        const result = await chrome.storage.local.get(['settingsV1']);
        const settings = result.settingsV1;
        const selectedMethod = (settings?.httpMethod || 'post').toUpperCase();
        
        if (details.method === selectedMethod && details.requestBody && details.requestBody.raw) {
            try {
                const rawBody = details.requestBody.raw[0].bytes;
                const decodedBody = new TextDecoder("utf-8").decode(new Uint8Array(rawBody));
                const parsedBody = JSON.parse(decodedBody);
                if (parsedBody && parsedBody.operationName) {
                    requestDetailsMap.set(details.requestId, { operationName: parsedBody.operationName, timestamp: Date.now() });
                }
            } catch (e) {
                console.warn("Custodian API Mock Driver: Error parsing request body (expected for compressed bodies):", e, details.url);
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["requestBody"]
);

// Clean up stale entries in requestDetailsMap
chrome.alarms.create("cleanupRequestDetailsMap", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "cleanupRequestDetailsMap") {
        const now = Date.now();
        const cutoff = now - (60 * 1000); // 1 minute
        for (const [requestId, details] of requestDetailsMap.entries()) {
            if (details.timestamp < cutoff) {
                requestDetailsMap.delete(requestId);
                console.warn("Custodian API Mock Driver: Removed stale request details:", requestId);
            }
        }
    }
});

chrome.webRequest.onCompleted.addListener((details) => {
    requestDetailsMap.delete(details.requestId);
}, { urls: ["<all_urls>"] });

chrome.webRequest.onErrorOccurred.addListener((details) => {
    requestDetailsMap.delete(details.requestId);
}, { urls: ["<all_urls>"] });

console.log("Custodian API Mock Driver background script loaded.");
