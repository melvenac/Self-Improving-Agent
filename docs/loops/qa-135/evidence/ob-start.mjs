// Calls the candidate build's handleStart (ob_start) on a project root, as /start would.
const { handleStart } = await import("file:///C:/qa-scratch/cand/open-brain/build/server.js");
const r = await handleStart({ project_root: process.argv[2] });
for (const c of r.content) console.log(c.text);
if (r.isError) process.exit(1);
