import { createFixtureRuntime } from '../demo/fixture-runtime.mjs';
const port=Number(process.env.PORT||8789);
createFixtureRuntime().listen(port,'127.0.0.1',()=>console.log(`OFFLINE FIXTURE: http://127.0.0.1:${port}/api/chat; Bearer offline-fixture-key; Vector/LLM doubles, not a cloud acceptance test.`));
