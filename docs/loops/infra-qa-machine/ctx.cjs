// Print the launch context's temp dir and whether each level of it can be listed (readdir).
const { readdirSync } = require('fs');
const { tmpdir, userInfo } = require('os');
const t = tmpdir();
console.log('os.tmpdir()=' + t);
console.log('TEMP=' + process.env.TEMP + ' TMP=' + process.env.TMP + ' USERPROFILE=' + process.env.USERPROFILE);
console.log('user=' + userInfo().username);
const parts = t.split('\\');
let cur = '';
for (const p of parts) {
  cur = cur ? cur + '\\' + p : p + '\\';
  try { readdirSync(cur); console.log('readdir OK   ' + cur); }
  catch (e) { console.log('readdir FAIL ' + cur + ' ' + e.code); }
}
