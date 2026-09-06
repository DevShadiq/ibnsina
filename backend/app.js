// Vercel detects this root entry point and runs the exported Express app as a
// single serverless function. src/server.js still starts a listener locally.
export { default } from './src/server.js';
