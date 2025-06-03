document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    // const extensionEnabledCheckbox = document.getElementById('extensionEnabled'); // Removed
    const targetUrlInput = document.getElementById('targetUrl');
    const targetUrlError = document.getElementById('targetUrlError');
    const restrictToTabUrlsEnabledCheckbox = document.getElementById('restrictToTabUrlsEnabled');
    const tabUrlPatternsTextarea = document.getElementById('tabUrlPatterns');
    const tabUrlPatternsError = document.getElementById('tabUrlPatternsError');
    const mockHeaderSuffixInput = document.getElementById('mockHeaderSuffix');
    const mockHeaderKeyValuePairsContainer = document.getElementById('mockHeaderKeyValuePairsContainer');
    const noKeyValuePairsMessage = document.getElementById('noKeyValuePairsMessage');
    const addKeyValuePairButton = document.getElementById('addKeyValuePair');
    const keyValuePairsError = document.getElementById('keyValuePairsError');
    const saveSettingsButton = document.getElementById('saveSettings');

    // --- State & Constants ---
    const MOCK_HEADER_PREFIX = "x-ov-mock";
    let mockHeaderKeyValuePairs = []; // To store current state of K/V pairs in UI

    // --- Initial Setup ---
    initialErrors(); // Hide all error messages on load
    loadSettings();
    toggleTabUrlPatternsVisibility(); // Set initial visibility for URL patterns textarea

    // --- Event Listeners ---
    addKeyValuePairButton.addEventListener('click', () => addKeyValuePairRow());
    saveSettingsButton.addEventListener('click', saveAllSettings);
    restrictToTabUrlsEnabledCheckbox.addEventListener('change', toggleTabUrlPatternsVisibility);

    // --- Functions ---

    function initialErrors() {
        targetUrlError.classList.add('hidden');
        tabUrlPatternsError.classList.add('hidden');
        keyValuePairsError.classList.add('hidden');
    }

    function toggleTabUrlPatternsVisibility() {
        // Toggle the entire input-group parent of the textarea
        tabUrlPatternsTextarea.parentNode.classList.toggle('hidden', !restrictToTabUrlsEnabledCheckbox.checked);
        tabUrlPatternsError.classList.add('hidden'); // Hide error when toggling visibility
    }

    function loadSettings() {
        chrome.storage.local.get(['settingsV1'], (result) => {
            const settings = result.settingsV1 || {
                // isEnabled: true, // Removed
                targetUrl: '',
                restrictToTabUrlsEnabled: false,
                tabUrlPatterns: '', // Stored as newline-separated string
                mockHeaderSuffix: '',
                mockHeaderKeyValuePairs: []
            };

            // extensionEnabledCheckbox.checked = settings.isEnabled; // Removed
            targetUrlInput.value = settings.targetUrl;
            restrictToTabUrlsEnabledCheckbox.checked = settings.restrictToTabUrlsEnabled;
            tabUrlPatternsTextarea.value = settings.tabUrlPatterns || '';
            mockHeaderSuffixInput.value = settings.mockHeaderSuffix || '';

            // Render Key/Value pairs
            mockHeaderKeyValuePairsContainer.innerHTML = ''; // Clear existing
            mockHeaderKeyValuePairs = []; // Reset internal array
            (settings.mockHeaderKeyValuePairs || []).forEach(pair => addKeyValuePairRow(pair.key, pair.value));
            updateNoKeyValuePairsMessageVisibility(); // Update message visibility after loading
        });
    }

    // Comprehensive URL/domain validation
    function isValidPatternOrUrl(input) {
        input = input.trim();
        if (!input) return false;

        // Allow wildcards patterns like *.example.com/*
        if (input.includes('*')) {
            try {
                // URLPattern syntax validation is the most robust for this
                // Attempt to create a URLPattern. If the pattern starts with a domain name like 'example.com',
                // URLPattern might fail without a scheme. We'll try to add a dummy scheme for testing.
                const testPattern = input.startsWith('http://') || input.startsWith('https://') ? input : `https://${input}`;
                new URLPattern(testPattern);
                return true; // Valid URLPattern syntax
            } catch (e) {
                // This pattern is not a valid URLPattern string
                return false;
            }
        }

        // Check for full URLs
        try {
            const url = new URL(input);
            // Basic check if it has a valid protocol and host
            return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
        } catch (_) {
            // Not a full URL, try as a domain (e.g., example.com, app.example.com)
            // Added support for optional port number after domain
            const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}(:\d+)?$/;
            return domainRegex.test(input);
        }
    }


    function validateInputs() {
        let isValid = true;
        initialErrors(); // Hide all errors at start of validation

        // Validate Target GraphQL URL
        if (!targetUrlInput.value.trim()) {
            targetUrlError.textContent = 'Target GraphQL URL cannot be empty.';
            targetUrlError.classList.remove('hidden');
            isValid = false;
        } else if (!isValidPatternOrUrl(targetUrlInput.value.trim())) {
            targetUrlError.textContent = 'Please enter a valid GraphQL URL (e.g., https://api.example.com/graphql).';
            targetUrlError.classList.remove('hidden');
            isValid = false;
        }

        // Validate Tab URL Patterns
        if (restrictToTabUrlsEnabledCheckbox.checked) {
            const patterns = tabUrlPatternsTextarea.value.trim().split('\n').filter(p => p.trim() !== '');
            const invalidPatterns = patterns.filter(p => !isValidPatternOrUrl(p.trim()));
            if (invalidPatterns.length > 0) {
                tabUrlPatternsError.textContent = `Invalid URL patterns found: ${invalidPatterns.join(', ')}. Ensure valid URLs, domains, or URLPattern syntax (e.g., *.example.com/*).`;
                tabUrlPatternsError.classList.remove('hidden');
                isValid = false;
            } else if (patterns.length === 0) {
                tabUrlPatternsError.textContent = 'Please enter at least one URL pattern or disable the restriction.';
                tabUrlPatternsError.classList.remove('hidden');
                isValid = false;
            }
        }

        // Validate Key/Value pairs (uniqueness, non-empty key, valid key characters)
        const keys = new Set();
        let hasDuplicateKey = false;
        let hasEmptyKey = false;
        let hasInvalidKeyChar = false;
        const validKeyCharRegex = /^[a-zA-Z0-9_-]+$/; // Alphanumeric, hyphen, underscore

        mockHeaderKeyValuePairs.forEach(pair => {
            const key = pair.keyInput.value.trim();
            if (key === '') {
                hasEmptyKey = true;
            } else if (!validKeyCharRegex.test(key)) {
                hasInvalidKeyChar = true;
            }
            if (keys.has(key) && key !== '') { // Check for duplicates only if key is not empty
                hasDuplicateKey = true;
            }
            keys.add(key);
        });

        if (hasEmptyKey || hasDuplicateKey || hasInvalidKeyChar) {
            let errorMessage = 'Key/Value Pair Errors: ';
            if (hasEmptyKey) errorMessage += 'All keys must be non-empty. ';
            if (hasDuplicateKey) errorMessage += 'All keys must be unique. ';
            if (hasInvalidKeyChar) errorMessage += 'Keys can only contain alphanumeric characters, hyphens (-), and underscores (_). ';
            keyValuePairsError.textContent = errorMessage.trim();
            keyValuePairsError.classList.remove('hidden');
            isValid = false;
        }

        return isValid;
    }

    function formatXMockHeaderName(suffix) {
        if (!suffix || suffix.trim() === '') {
            return MOCK_HEADER_PREFIX;
        }
        const cleanSuffix = suffix.trim();
        // Add hyphen only if suffix is not empty AND doesn't start with a hyphen
        return MOCK_HEADER_PREFIX + (cleanSuffix && !cleanSuffix.startsWith('-') ? '-' : '') + cleanSuffix;
    }

    function formatXMockHeaderValue(pairs) {
        return pairs
            .filter(pair => pair.keyInput.value.trim() !== '') // Only include pairs with non-empty keys
            .map(pair => `${pair.keyInput.value.trim()}=${pair.valueInput.value.trim()}`)
            .join(';');
    }

    async function saveAllSettings() {
        if (!validateInputs()) {
            return; // Stop if validation fails
        }

        const finalMockHeaderName = formatXMockHeaderName(mockHeaderSuffixInput.value);
        const finalMockHeaderValue = formatXMockHeaderValue(mockHeaderKeyValuePairs);

        const settings = {
            // isEnabled: true, // No longer from UI, assumed enabled if extension is active
            targetUrl: targetUrlInput.value.trim(),
            restrictToTabUrlsEnabled: restrictToTabUrlsEnabledCheckbox.checked,
            tabUrlPatterns: tabUrlPatternsTextarea.value.trim(), // Store as raw string
            mockHeaderSuffix: mockHeaderSuffixInput.value.trim(),
            mockHeaderKeyValuePairs: mockHeaderKeyValuePairs.map(pair => ({
                key: pair.keyInput.value.trim(),
                value: pair.valueInput.value.trim()
            }))
        };

        await chrome.storage.local.set({ settingsV1: settings });

        // Notify background script to update rules
        await chrome.runtime.sendMessage({ type: "settings_updated" });

        // Show success message
        const originalText = saveSettingsButton.textContent;
        saveSettingsButton.textContent = 'Saved!';
        saveSettingsButton.classList.remove('btn-primary');
        saveSettingsButton.classList.add('bg-green-600', 'hover:bg-green-700'); // Green for success
        setTimeout(() => {
            saveSettingsButton.textContent = originalText;
            saveSettingsButton.classList.remove('bg-green-600', 'hover:bg-green-700');
            saveSettingsButton.classList.add('btn-primary');
        }, 1500);
        console.log('Settings saved:', settings);
    }

    function createTextInput(placeholder, value = '', className = '') {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.value = value;
        input.className = `p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base ${className}`;
        return input;
    }

    function createDeleteButton(onClickAction) {
        const button = document.createElement('button');
        button.textContent = 'Del';
        button.className = 'btn btn-danger btn-sm py-1 px-2 text-xs w-14 flex-shrink-0'; // Fixed width
        button.addEventListener('click', onClickAction);
        return button;
    }

    function updateNoKeyValuePairsMessageVisibility() {
        if (mockHeaderKeyValuePairs.length === 0) {
            noKeyValuePairsMessage.classList.remove('hidden');
        } else {
            noKeyValuePairsMessage.classList.add('hidden');
        }
    }

    function addKeyValuePairRow(key = '', value = '') {
        const itemContainer = document.createElement('div');
        itemContainer.className = 'key-value-item'; // flex items-center space-x-3 mb-3

        const keyInput = createTextInput('Key', key, 'flex-1');
        const valueInput = createTextInput('Value', value, 'flex-1');
        const deleteButton = createDeleteButton(() => {
            itemContainer.remove();
            // Remove from the internal array as well
            mockHeaderKeyValuePairs = mockHeaderKeyValuePairs.filter(pair => pair.keyInput !== keyInput);
            validateInputs(); // Re-validate to clear potential errors
            updateNoKeyValuePairsMessageVisibility(); // Update message
        });

        itemContainer.appendChild(keyInput);
        itemContainer.appendChild(valueInput);
        itemContainer.appendChild(deleteButton);

        mockHeaderKeyValuePairsContainer.appendChild(itemContainer);

        // Store reference to inputs for later retrieval and validation
        mockHeaderKeyValuePairs.push({ keyInput, valueInput, itemContainer });

        // Add event listeners for immediate validation feedback on input change
        keyInput.addEventListener('input', validateInputs);
        valueInput.addEventListener('input', validateInputs);
        updateNoKeyValuePairsMessageVisibility(); // Update message
    }
});