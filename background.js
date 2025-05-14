let requestOperationNames = {}; // Temporary store for operation names, keyed by requestId

// Listener for when a request is about to occur
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.method === "POST" && details.requestBody && details.requestBody.raw) {
            try {
                const rawBody = details.requestBody.raw[0].bytes;
                const decodedBody = new TextDecoder("utf-8").decode(new Uint8Array(rawBody));
                const parsedBody = JSON.parse(decodedBody);
                if (parsedBody && parsedBody.operationName) {
                    requestOperationNames[details.requestId] = parsedBody.operationName;
                }
            } catch (e) {
                console.warn("Custodian API Mock Driver: Error parsing request body:", e, details.url);
            }
        }
    },
    { urls: ["<all_urls>"] }, // Listen to all URLs, filtering will happen in onBeforeSendHeaders
    ["requestBody"]
);

// Listener for when headers are about to be sent
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        // Retrieve settings from storage
        return new Promise((resolve) => {
            chrome.storage.local.get(['settingsV1'], (result) => {
                const settings = result.settingsV1;

                if (!settings || !settings.isEnabled || !settings.targetUrl || !details.url.startsWith(settings.targetUrl)) {
                    resolve({ requestHeaders: details.requestHeaders });
                    return;
                }

                let newHeaders = [...details.requestHeaders]; // Start with existing headers
                const operationName = requestOperationNames[details.requestId];

                // Apply common headers
                if (settings.commonHeaders) {
                    settings.commonHeaders.forEach(commonHeader => {
                        if (commonHeader.enabled && commonHeader.name) {
                            const existingHeaderIndex = newHeaders.findIndex(h => h.name.toLowerCase() === commonHeader.name.toLowerCase());
                            if (existingHeaderIndex > -1) {
                                newHeaders[existingHeaderIndex].value = commonHeader.value; // Override
                            } else {
                                newHeaders.push({ name: commonHeader.name, value: commonHeader.value });
                            }
                        }
                    });
                }

                // Apply operation-specific overrides
                if (operationName && settings.operationOverrides) {
                    const override = settings.operationOverrides.find(
                        op => op.enabled && op.operationName === operationName
                    );

                    if (override && override.headers) {
                        override.headers.forEach(overrideHeader => {
                            if (overrideHeader.enabled && overrideHeader.name) {
                                const existingHeaderIndex = newHeaders.findIndex(h => h.name.toLowerCase() === overrideHeader.name.toLowerCase());
                                if (existingHeaderIndex > -1) {
                                    newHeaders[existingHeaderIndex].value = overrideHeader.value; // Override
                                } else {
                                    newHeaders.push({ name: overrideHeader.name, value: overrideHeader.value });
                                }
                            }
                        });
                    }
                }
                
                // Clean up the stored operation name for this request ID
                if (operationName) {
                    delete requestOperationNames[details.requestId];
                }

                resolve({ requestHeaders: newHeaders });
            });
        });
    },
    { urls: ["<all_urls>"] }, // Listen to all URLs, actual filtering by targetUrl happens inside
    ["blocking", "requestHeaders", "extraHeaders"] // "blocking" is needed to modify headers
);

// Clean up stale entries in requestOperationNames (optional, but good practice)
chrome.alarms.create("cleanupOperationNames", { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "cleanupOperationNames") {
        // In a real scenario, you might want to check timestamps if you were storing more complex data.
        // For this simple case, if a request ID is still here after 5 mins, it's likely stale.
        // However, without knowing how long a request might be pending before headers are sent,
        // this could prematurely delete an operation name.
        // A more robust cleanup would involve onCompleted or onErrorOccurred.
        // For now, let's keep it simple or even remove this periodic cleanup if it causes issues.
        // A simple approach: clear it entirely, as requests are usually short-lived.
        // This might miss very long-pending requests, but avoids unbounded growth.
        requestOperationNames = {}; 
        console.log("Custodian API Mock Driver: Cleared stale operation names cache.");
    }
});

// Placeholder icons (you'll need to create these files)
// Create a folder named "icons" in your extension's root directory
// and add icon16.png, icon48.png, icon128.png to it.
// For example, you can use simple colored squares or find free icons.
// If icons are missing, the extension will still work but might show a default icon.
console.log("Custodian API Mock Driver background script loaded.");

