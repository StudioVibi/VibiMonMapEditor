# Cloud Storage (AWS) - Editor Config

The editor now supports three storage modes:

- `local`: browser `localStorage` only
- `cloud`: API/DynamoDB only
- `hybrid`: cloud first with local fallback

## Runtime keys

Configure in browser local storage:

- `vibimon_map_editor_storage_mode`
- `vibimon_map_editor_cloud_api_base_url`
- `vibimon_map_editor_cloud_auth_token`

Example:

```js
localStorage.setItem("vibimon_map_editor_storage_mode", "hybrid");
localStorage.setItem("vibimon_map_editor_cloud_api_base_url", "https://<api-id>.execute-api.<region>.amazonaws.com/dev");
localStorage.setItem("vibimon_map_editor_cloud_auth_token", "<COGNITO_JWT>");
location.reload();
```

## Optional global config

You can also inject config before loading `main.js`:

```html
<script>
  window.VIBIMON_EDITOR_CONFIG = {
    storage_mode: "hybrid",
    api_base_url: "https://<api-id>.execute-api.<region>.amazonaws.com/dev",
    auth_token: "<COGNITO_JWT>",
    request_timeout_ms: 8000
  };
</script>
```

## Local import behavior

On first successful cloud/hybrid initialization, local levels are imported once into cloud storage.
The import marker is stored per API base URL.
