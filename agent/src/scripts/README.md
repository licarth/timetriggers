These are migration scripts to be run on Firestore.


```bash
# Run the migration script
npx ts-node -r tsconfig-paths/register ./src/migration/01-create-project-usage-documents.ts
```

### Run load tests

```
npm run script -- 04-loadtest-http \
    --apiRateLimitQps=10 --qps=2 --during=15s --initialDelay=0s \
    --scheduleVia=http --api=http://localhost:3002 --key=j4OvlB2wihkbzae2IWApEvFPU0XwGQyN

npm run script -- 04-loadtest-http \
    --apiRateLimitQps=10 --qps=2 --during=15s --initialDelay=0s \
    --scheduleVia=datastore --emulator=true
```