document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const extensionEnabledCheckbox = document.getElementById('extensionEnabled');
    const targetUrlInput = document.getElementById('targetUrl');
    const commonHeadersContainer = document.getElementById('commonHeadersContainer');
    const addCommonHeaderButton = document.getElementById('addCommonHeader');
    const operationOverridesContainer = document.getElementById('operationOverridesContainer');
    const addOperationOverrideButton = document.getElementById('addOperationOverride');
    const saveSettingsButton = document.getElementById('saveSettings');

    // --- Load settings from chrome.storage.local ---
    loadSettings();

    // --- Event Listeners ---
    addCommonHeaderButton.addEventListener('click', () => addHeaderRow(commonHeadersContainer));
    addOperationOverrideButton.addEventListener('click', addOperationOverrideRow);
    saveSettingsButton.addEventListener('click', saveAllSettings);

    // --- Functions ---

    function loadSettings() {
        chrome.storage.local.get(['settingsV1'], (result) => {
            const settings = result.settingsV1 || {
                isEnabled: true,
                targetUrl: '',
                commonHeaders: [],
                operationOverrides: []
            };

            extensionEnabledCheckbox.checked = settings.isEnabled;
            targetUrlInput.value = settings.targetUrl;

            commonHeadersContainer.innerHTML = ''; // Clear existing
            settings.commonHeaders.forEach(header => addHeaderRow(commonHeadersContainer, header.name, header.value, header.enabled));

            operationOverridesContainer.innerHTML = ''; // Clear existing
            settings.operationOverrides.forEach(override => addOperationOverrideRow(override.operationName, override.headers, override.enabled));
        });
    }

    function saveAllSettings() {
        const settings = {
            isEnabled: extensionEnabledCheckbox.checked,
            targetUrl: targetUrlInput.value.trim(),
            commonHeaders: [],
            operationOverrides: []
        };

        // Save common headers
        commonHeadersContainer.querySelectorAll('.header-item').forEach(row => {
            const nameInput = row.querySelector('.header-name');
            const valueInput = row.querySelector('.header-value');
            const enabledCheckbox = row.querySelector('.header-enabled');
            if (nameInput && valueInput && nameInput.value.trim()) {
                settings.commonHeaders.push({
                    name: nameInput.value.trim(),
                    value: valueInput.value.trim(),
                    enabled: enabledCheckbox ? enabledCheckbox.checked : true
                });
            }
        });

        // Save operation overrides
        operationOverridesContainer.querySelectorAll('.override-item').forEach(overrideRow => {
            const operationNameInput = overrideRow.querySelector('.operation-name');
            const overrideEnabledCheckbox = overrideRow.querySelector('.override-enabled');
            if (operationNameInput && operationNameInput.value.trim()) {
                const override = {
                    operationName: operationNameInput.value.trim(),
                    headers: [],
                    enabled: overrideEnabledCheckbox ? overrideEnabledCheckbox.checked : true
                };
                overrideRow.querySelectorAll('.header-item').forEach(headerRow => {
                    const nameInput = headerRow.querySelector('.header-name');
                    const valueInput = headerRow.querySelector('.header-value');
                    const headerEnabledCheckbox = headerRow.querySelector('.header-enabled');
                    if (nameInput && valueInput && nameInput.value.trim()) {
                        override.headers.push({
                            name: nameInput.value.trim(),
                            value: valueInput.value.trim(),
                            enabled: headerEnabledCheckbox ? headerEnabledCheckbox.checked : true
                        });
                    }
                });
                settings.operationOverrides.push(override);
            }
        });

        chrome.storage.local.set({ settingsV1: settings }, () => {
            // Optional: Show a success message
            const originalText = saveSettingsButton.textContent;
            saveSettingsButton.textContent = 'Saved!';
            saveSettingsButton.classList.remove('btn-primary');
            saveSettingsButton.classList.add('btn-secondary'); // Use a different color for saved state
            setTimeout(() => {
                saveSettingsButton.textContent = originalText;
                saveSettingsButton.classList.remove('btn-secondary');
                saveSettingsButton.classList.add('btn-primary');
            }, 1500);
            console.log('Settings saved:', settings);
        });
    }

    function createTextInput(placeholder, value = '', className = '') {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.value = value;
        input.className = `p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${className}`;
        return input;
    }

    function createCheckbox(checked = true, className = '') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = checked;
        checkbox.className = `h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 ${className}`;
        return checkbox;
    }

    function createDeleteButton(onClickAction) {
        const button = document.createElement('button');
        button.textContent = 'Del';
        button.className = 'btn btn-danger btn-sm py-1 px-2 text-xs';
        button.addEventListener('click', onClickAction);
        return button;
    }

    function addHeaderRow(container, name = '', value = '', enabled = true, isOverrideHeader = false) {
        const headerRow = document.createElement('div');
        headerRow.className = 'header-item';

        const nameInput = createTextInput('Header Name', name, 'header-name');
        const valueInput = createTextInput('Header Value', value, 'header-value');
        const enabledCheckbox = createCheckbox(enabled, 'header-enabled ml-2');
        const deleteButton = createDeleteButton(() => headerRow.remove());

        headerRow.appendChild(enabledCheckbox);
        headerRow.appendChild(nameInput);
        headerRow.appendChild(valueInput);
        headerRow.appendChild(deleteButton);

        container.appendChild(headerRow);
    }

    function addOperationOverrideRow(operationName = '', headers = [], enabled = true) {
        const overrideItem = document.createElement('div');
        overrideItem.className = 'override-item flex-col items-start p-3 my-2 border border-gray-300 rounded-lg bg-gray-50'; // Changed to flex-col

        const topRow = document.createElement('div');
        topRow.className = 'flex items-center w-full mb-2';

        const overrideEnabledCheckbox = createCheckbox(enabled, 'override-enabled mr-2');
        const operationNameInput = createTextInput('GraphQL OperationName', operationName, 'operation-name flex-grow');
        const deleteOverrideButton = createDeleteButton(() => overrideItem.remove());

        topRow.appendChild(overrideEnabledCheckbox);
        topRow.appendChild(operationNameInput);
        topRow.appendChild(deleteOverrideButton);
        overrideItem.appendChild(topRow);

        const headersSubContainer = document.createElement('div');
        headersSubContainer.className = 'w-full pl-6'; // Indent headers
        headers.forEach(header => addHeaderRow(headersSubContainer, header.name, header.value, header.enabled, true));
        overrideItem.appendChild(headersSubContainer);

        const addHeaderToOverrideButton = document.createElement('button');
        addHeaderToOverrideButton.textContent = 'Add Header to Override';
        addHeaderToOverrideButton.className = 'btn btn-secondary btn-sm mt-2 py-1 px-2 text-xs ml-6';
        addHeaderToOverrideButton.addEventListener('click', () => addHeaderRow(headersSubContainer, '', '', true, true));
        overrideItem.appendChild(addHeaderToOverrideButton);

        operationOverridesContainer.appendChild(overrideItem);
    }
});