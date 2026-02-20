# AWS Storage Backend (V1)

This folder contains the serverless backend for editor level persistence:

- API Gateway HTTP API
- Lambda (TypeScript)
- DynamoDB (`vibimon_levels`)
- Cognito User Pool + client + `map-admin` group
- CloudWatch alarms (API 5xx, Lambda throttles)

## API contract

- `GET /health`
- `GET /levels?query=&sort=&cursor=&limit=`
- `POST /levels`
- `GET /levels/{id}`
- `PUT /levels/{id}`
- `PATCH /levels/{id}/name`
- `DELETE /levels/{id}`

`PUT /levels/{id}` enforces optimistic concurrency with `version` for existing items.

## Deploy with AWS SAM

Prerequisites:

1. AWS CLI configured (`aws configure`)
2. AWS SAM CLI installed
3. Node/npm installed

Commands:

```bash
cd aws
npm install
cd ..
sam build -t aws/template.yaml
sam deploy --guided --template-file aws/template.yaml
```

Important deploy parameters:

- `StageName`: `dev` or `prod`
- `CorsAllowOrigin`: editor origin (for example `https://editor.example.com`)
- `RequireAuth`: keep `true` in production
- `RequiredGroup`: defaults to `map-admin`

## Cognito admin access

After deploy:

1. Create a Cognito user in the generated user pool.
2. Add that user to group `map-admin`.
3. Obtain a valid JWT access token for that user.

The Lambda also checks `cognito:groups` and only accepts users in `map-admin`.

## Frontend configuration

The editor reads cloud config from local storage keys:

- `vibimon_map_editor_storage_mode`: `local` | `cloud` | `hybrid`
- `vibimon_map_editor_cloud_api_base_url`: API base URL (SAM output `ApiBaseUrl`)
- `vibimon_map_editor_cloud_auth_token`: Cognito JWT token

Example (browser console):

```js
localStorage.setItem("vibimon_map_editor_storage_mode", "hybrid");
localStorage.setItem("vibimon_map_editor_cloud_api_base_url", "https://xxxx.execute-api.us-east-1.amazonaws.com/dev");
localStorage.setItem("vibimon_map_editor_cloud_auth_token", "<JWT>");
location.reload();
```

### Storage modes

- `local`: localStorage only
- `cloud`: API only
- `hybrid`: cloud first, local fallback

On first successful cloud/hybrid run, local levels are imported once into DynamoDB.
