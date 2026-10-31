// Test-only module resolution, so `node --test` can import the app's
// TypeScript sources directly (Node 22.18+/24 strips types natively — no
// test framework or transpiler dependency):
//   "@/foo"  -> <repo>/foo         (the tsconfig "paths" alias)
//   "./bar"  -> ./bar.ts / ./bar.tsx / ./bar/index.ts  (bundler-style extensionless imports)
import { register } from "node:module";

register("./resolve-hooks.mjs", import.meta.url);
