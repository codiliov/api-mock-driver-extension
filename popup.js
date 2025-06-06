document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    // const extensionEnabledCheckbox = document.getElementById('extensionEnabled'); // Removed
    const targetUrlInput = document.getElementById('targetUrl');
    const targetUrlError = document.getElementById('targetUrlError');
    const httpMethodInput = document.getElementById('httpMethod');
    const httpMethodDropdown = document.getElementById('httpMethodDropdown');
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

    // Define predefined API paths for the dropdown
    const API_PATHS = [
        { value: '', label: 'Select API Path...' },
        { value: 'dashboard/account', label: 'Account' },
        { value: 'dashboard/balanceHistory/account', label: 'Account Balance History' },
        { value: 'dashboard/accounts', label: 'Accounts' },
        { value: 'dashboard/bankAccount', label: 'Bank Account' },
        { value: 'dashboard/beneficiaries', label: 'Beneficiaries' },
        { value: 'dashboard/balanceHistory/client', label: 'Client Balance History' },
        { value: 'dashboard/CommunicationPreference', label: 'Communication Prefs' },
        { value: 'dashboard/transactions/pac', label: 'Deposit Transfers' },
        { value: 'dashboard/documentNotifications', label: 'Document Notifications' },
        { value: 'dashboard/documents', label: 'Documents' },
        { value: 'profiles/fund/info', label: 'Fund Info' },
        { value: 'dashboard/holdings', label: 'Holdings' },
        { value: 'profiles/risk/answers', label: 'Risk Answers' },
        { value: 'profiles/user/roles', label: 'Roles' },
        { value: 'dashboard/transactions/summary', label: 'Transaction Summary' },
        { value: 'dashboard/transactions', label: 'Transactions' },
        { value: 'profiles/user/CommunicationPreference', label: 'User Communication Prefs' },
        { value: 'custom', label: 'Custom API Path...' }
    ];

    // --- Initial Setup ---
    initialErrors(); // Hide all error messages on load
    loadSettings();
    toggleTabUrlPatternsVisibility(); // Set initial visibility for URL patterns textarea

    // --- Event Listeners ---
    addKeyValuePairButton.addEventListener('click', () => addKeyValuePairRow());
    saveSettingsButton.addEventListener('click', saveAllSettings);
    restrictToTabUrlsEnabledCheckbox.addEventListener('change', toggleTabUrlPatternsVisibility);

    // --- HTTP Method Dropdown Handling ---
    document.querySelectorAll('[data-method]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const method = e.target.getAttribute('data-method');
            httpMethodInput.value = method;
            httpMethodDropdown.textContent = method.toUpperCase();
        });
    });

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
                httpMethod: 'post', // Default to POST
                restrictToTabUrlsEnabled: false,
                tabUrlPatterns: '', // Stored as newline-separated string
                mockHeaderSuffix: '',
                mockHeaderKeyValuePairs: []
            };

            // extensionEnabledCheckbox.checked = settings.isEnabled; // Removed
            targetUrlInput.value = settings.targetUrl;
            httpMethodInput.value = settings.httpMethod || 'post';
            httpMethodDropdown.textContent = settings.httpMethod ? settings.httpMethod.toUpperCase() : 'POST';
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

        // Validate Key/Value pairs (uniqueness, non-empty key)
        const keys = new Set();
        let hasDuplicateKey = false;
        let hasEmptyKey = false;

        mockHeaderKeyValuePairs.forEach(pair => {
            const key = getKeyValue(pair.keyInput);
            if (key === '') {
                hasEmptyKey = true;
            }
            if (keys.has(key) && key !== '') { // Check for duplicates only if key is not empty
                hasDuplicateKey = true;
            }
            keys.add(key);
        });

        if (hasEmptyKey || hasDuplicateKey) {
            let errorMessage = 'Key/Value Pair Errors: ';
            if (hasEmptyKey) errorMessage += 'All API paths must be selected. ';
            if (hasDuplicateKey) errorMessage += 'All API paths must be unique. ';
            keyValuePairsError.textContent = errorMessage.trim();
            keyValuePairsError.classList.remove('hidden');
            isValid = false;
        }

        return isValid;
    }

    function formatXMockHeaderName(suffix) {
        if (!suffix || suffix.trim() === '') {
            return MOCK_HEADER_PREFIX.toLowerCase();
        }
        const cleanSuffix = suffix.trim().toLowerCase(); // Ensure suffix is lowercase
        // Add hyphen only if suffix is not empty AND doesn't start with a hyphen
        const headerName = MOCK_HEADER_PREFIX + (cleanSuffix && !cleanSuffix.startsWith('-') ? '-' : '') + cleanSuffix;
        return headerName.toLowerCase(); // Ensure entire header name is lowercase
    }

    function formatXMockHeaderValue(pairs) {
        const formattedPairs = pairs
            .filter(pair => getKeyValue(pair.keyInput) !== '') // Only include pairs with non-empty keys
            .map(pair => {
                const apiPath = getKeyValue(pair.keyInput);
                let mockInstruction = pair.valueInput.value.trim();
                
                // Transform status= to code= for server compatibility
                mockInstruction = mockInstruction.replace(/\bstatus\s*=/gi, 'code=');
                
                // Format as: API_PATH | Prefer MOCK_INSTRUCTIONS
                return `${apiPath} | Prefer ${mockInstruction}`;
            })
            .join(' ::: '); // Use conspicuous triple colon separator with spaces
        
        return formattedPairs;
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
            httpMethod: httpMethodInput.value,
            restrictToTabUrlsEnabled: restrictToTabUrlsEnabledCheckbox.checked,
            tabUrlPatterns: tabUrlPatternsTextarea.value.trim(), // Store as raw string
            mockHeaderSuffix: mockHeaderSuffixInput.value.trim(),
            mockHeaderKeyValuePairs: mockHeaderKeyValuePairs.map(pair => ({
                key: getKeyValue(pair.keyInput),
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
        input.className = `form-control ${className}`;
        return input;
    }

    function createApiPathSelect(selectedValue = '', className = '') {
        const select = document.createElement('select');
        select.className = `form-select ${className}`;
        
        // Add all predefined options
        API_PATHS.forEach(path => {
            const option = document.createElement('option');
            option.value = path.value;
            option.textContent = path.label;
            if (path.value === selectedValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        // Create custom input (initially hidden)
        const customInput = document.createElement('input');
        customInput.type = 'text';
        customInput.placeholder = 'Enter custom API path...';
        customInput.className = `form-control ${className} hidden`;
        customInput.style.display = 'none';

        // Handle custom option selection
        select.addEventListener('change', () => {
            if (select.value === 'custom') {
                // Hide select, show custom input
                select.style.display = 'none';
                customInput.style.display = 'block';
                customInput.classList.remove('hidden');
                customInput.focus();
            }
            validateInputs(); // Re-validate when selection changes
        });

        // Handle custom input blur - switch back to select if empty
        customInput.addEventListener('blur', () => {
            if (!customInput.value.trim()) {
                customInput.style.display = 'none';
                customInput.classList.add('hidden');
                select.style.display = 'block';
                select.value = '';
            }
        });

        // If the selected value is not in predefined options, set it as custom
        const isPredefineValue = API_PATHS.some(path => path.value === selectedValue);
        if (selectedValue && !isPredefineValue) {
            select.value = 'custom';
            customInput.value = selectedValue;
            select.style.display = 'none';
            customInput.style.display = 'block';
            customInput.classList.remove('hidden');
        }

        // Create wrapper that can be treated as a single element
        const wrapper = document.createElement('div');
        wrapper.className = 'position-relative';
        wrapper.style.flex = '0 0 250px'; // Fixed width for consistency
        wrapper.appendChild(select);
        wrapper.appendChild(customInput);
        
        // Add references for easy access
        wrapper.select = select;
        wrapper.customInput = customInput;

        return wrapper;
    }

    function getKeyValue(keyContainer) {
        if (keyContainer.select.value === 'custom') {
            return keyContainer.customInput.value.trim();
        }
        return keyContainer.select.value;
    }

    function createDeleteButton(onClickAction) {
        const button = document.createElement('button');
        button.innerHTML = '×'; // Use × symbol
        button.className = 'btn btn-outline-danger';
        button.type = 'button';
        button.title = 'Delete this API path configuration'; // Add tooltip
        button.style.minWidth = '50px'; // Ensure consistent width
        button.style.height = '38px'; // Match standard input height
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
        itemContainer.className = 'api-path-item mb-3 p-3 border rounded bg-white'; 

        // Create input group container
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';

        // Create API path dropdown
        const keyInput = createApiPathSelect(key, '');
        
        // Create mock instruction input
        const valueInput = createTextInput('status=230, dynamic=true, timeout=5s', value, '');

        // Create delete button
        const deleteButton = createDeleteButton(() => {
            itemContainer.remove();
            // Remove from the internal array as well
            mockHeaderKeyValuePairs = mockHeaderKeyValuePairs.filter(pair => pair.keyInput !== keyInput);
            validateInputs(); // Re-validate to clear potential errors
            updateNoKeyValuePairsMessageVisibility(); // Update message
        });

        // Add elements to input group
        inputGroup.appendChild(keyInput);
        inputGroup.appendChild(valueInput);
        inputGroup.appendChild(deleteButton);

        itemContainer.appendChild(inputGroup);
        mockHeaderKeyValuePairsContainer.appendChild(itemContainer);

        // Store reference to inputs for later retrieval and validation
        mockHeaderKeyValuePairs.push({ keyInput, valueInput, itemContainer });

        // Add event listeners for immediate validation feedback on input change
        keyInput.select.addEventListener('change', validateInputs);
        keyInput.customInput.addEventListener('input', validateInputs);
        valueInput.addEventListener('input', validateInputs);
        updateNoKeyValuePairsMessageVisibility(); // Update message
    }
});