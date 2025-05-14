# Custodian API Mock Driver

A Chrome extension that allows you to modify HTTP request headers for specific API calls, particularly useful for testing, development and QA purposes.

## Features

- **Header Modification**: Modify request headers for specific API endpoints
- **Operation-Specific Headers**: Apply different headers based on GraphQL operation names
- **Common Headers**: Set default headers that apply to all matching requests
- **URL Targeting**: Configure which URLs the extension should modify
- **Enable/Disable**: Toggle the extension on/off as needed

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## Configuration

The extension uses Chrome's local storage to maintain settings. You can configure:

- **Target URL**: The base URL to match against (only modifies requests to this URL)
- **Common Headers**: Headers to apply to all matching requests
- **Operation Overrides**: Specific header overrides for different operation names

### Example Configuration

```json
{
  "settingsV1": {
    "isEnabled": true,
    "targetUrl": "https://api.example.com",
    "commonHeaders": [
      {
        "enabled": true,
        "name": "X-Test-Header",
        "value": "test-value"
      }
    ],
    "operationOverrides": [
      {
        "enabled": true,
        "operationName": "GetUser",
        "headers": [
          {
            "enabled": true,
            "name": "X-User-ID",
            "value": "123"
          }
        ]
      }
    ]
  }
}
```

## How It Works

1. The extension monitors all HTTP POST requests
2. For requests matching the target URL:
   - If the request contains a JSON body with an `operationName`, it stores this information
   - Applies common headers to all matching requests
   - Applies operation-specific headers if the operation name matches
3. Headers are modified before the request is sent
4. The extension maintains a temporary cache of operation names and cleans it up periodically

## Use Cases

- **API Testing**: Test different header configurations
- **Development**: Simulate different authentication scenarios
- **Debugging**: Debug API interactions with custom headers




