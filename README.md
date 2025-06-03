# Custodian API Mock Driver

A Chrome extension designed to simplify **mocking custodian APIs for the purpose of testing and demos** by allowing you to inject custom HTTP request headers into GraphQL POST requests. It's particularly useful for development, QA, and debugging workflows.

## Features

-   **Custom `x-ov-mock` Header Injection**: Dynamically injects a configurable `x-ov-mock-YOUR_SUFFIX` header into matching requests. The header's value is constructed from user-defined semicolon-separated `key=value` pairs (e.g., `key1=value1;key2=value2`).
-   **Target URL Specificity**: Headers are only injected into requests sent to a user-defined GraphQL server URL.
-   **Tab URL Restriction**: Optionally restrict header injection to requests originating from browser tabs whose URLs match specific patterns (e.g., `https://*.atbprosper.com/*`, `your-internal-dashboard.com`).
-   **Enable/Disable Toggle**: Easily activate or deactivate the extension's overall functionality directly from the popup UI.

## Installation

1.  Clone this repository or download the source code.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" in the top right corner.
4.  Click "Load unpacked" and select the extension directory.

## Configuration

All extension settings are managed directly through its popup user interface and are automatically saved in Chrome's local storage.

-   **Target GraphQL URL**: Specify the exact URL of the GraphQL server where you want headers to be sent to (e.g., `https://api.example.com/graphql`).
-   **x-ov-mock Header Suffix**: Define the suffix for your custom header. For instance, entering `atb-api` will result in the header `x-ov-mock-atb-api`.
-   **Key/Value Pairs**: Add multiple key-value pairs (`key` and `value` fields) that will be combined to form the content of your `x-ov-mock` header (e.g., `env=dev;version=v2`).
-   **Restrict to Specific Tab URLs**: Enable this option and provide a list of URL patterns (one per line). Headers will only be injected for requests originating from browser tabs whose URLs match any of these patterns.

### Example of an Injected Header

If your configuration sets the `x-ov-mock` header suffix to `atb-api` and includes key-value pairs like `operation=deposit-transfer` and `scenario=risk-challenge`, an outbound request might look something like this:

```http
POST /graphql HTTP/1.1
Host: [api.example.com](https://www.google.com/search?q=api.example.com)
Content-Type: application/json
x-ov-mock-atb-api: operation=deposit-transfer;scenario=risk-challenge
// ... other standard HTTP headers
// ... request body (e.g., GraphQL query)
```

### Expectation

The expectation is that the request will be forwarded to the GraphQL server at `https://api.example.com/graphql` and the `x-ov-mock-atb-api` header will be added to the request. The value of the header will be `operation=deposit-transfer;scenario=risk-challenge`. 

Ideally, our infra and gateways should be made to accept this header (or variations of it) such that when the request hits the custodian package (e.g ov-atb) via the ci-trading-service, the custodian package can route the related 3rd party request to a mock server that handles the `operation=deposit-transfer` and `scenario=risk-challenge` scenarios appropriately by returning a mocked response using the custodians OpenAPI spec. 

## Contributing

Contributions are welcome! Please open an issue or submit a pull request if you have any suggestions or improvements.