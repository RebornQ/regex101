const axios = require('axios');
const path = require('path');
const promisify = require('util').promisify;
const fs = require('fs');
const stream = require('stream');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const finished = promisify(stream.finished);
const writeFile = promisify(fs.writeFile);
// const SocksProxyAgent = require('socks-proxy-agent');
// the full socks5 address
// const proxyOptions = `socks5://127.0.0.1:1080`;
// create the socksAgent for axios
// const httpsAgent = new SocksProxyAgent(proxyOptions);

const saveDir = path.resolve(__dirname, 'app');
const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36';
const domain = 'https://regex101.com';

let axiosConfig = {
  baseURL: domain,
  headers: { 'User-Agent': userAgent }
}
if (typeof httpsAgent !== 'undefined') {
  axiosConfig.httpAgent = httpsAgent;
  axiosConfig.httpsAgent = httpsAgent;
}
const instance = axios.create(axiosConfig);

const assetsCache = [];

function parseSw(content) {
  const matches = content.match(/url:"\/.*?",/g);
  return matches.map((temp) => temp.replace(/(url:"|",)/g, ''));
}

function parseIndex(content) {
  return content.match(/\/static\/.*?(?=")/g);
}

async function spySw() {
  try {
    const resp = await instance.get('/sw.js');
    await saveAssets('/sw.js', resp.data);
    const assets = parseSw(resp.data);
    assetsCache.push(...assets);
  } catch (error) {
    console.log(error);
  }
}

async function spyIndex() {
  try {
    const resp = await instance.get('/index.html');
    await saveAssets('/index.html', resp.data);
    const assets = parseIndex(resp.data);
    assetsCache.push(...assets);
  } catch (error) {
    console.log(error);
  }
}

async function cacheMissParseFiles() {
  assetsCache.push(
    // PHP >= 7.3
    '/static/pcre2.worker.0fff4fdbbf3423a854d7.js',
    '/static/pcre2.worker.bb122b5b4907382062a6.js',
    // PHP < 7.3
    '/static/pcre.worker.5ad0361888bb2e998772.js',
    '/static/generic.worker.e7ae3ee9e8b9b71f6a54.js',
    '/static/libs/pcrelib.f84adbca8f2187ce1b565d5363317e69.js',
    '/static/libs/pcrelib.879afe94f2f691ee64e38970bfdad0a9.wasm',
    // JavaScript
    '/static/javascript.worker.160b9eb5a8f6cc49b645.js',
    '/static/javascript.worker.a10e707dccb487a4e5b9.js',
    // Python
    '/static/libs/pcrelib.f84adbca8f2187ce1b565d5363317e69.js',
    '/static/libs/pcrelib.879afe94f2f691ee64e38970bfdad0a9.wasm',
    // Golang
    '/static/golang.worker.a56e4baf19f0745cf52d.js',
    '/static/libs/golang.f6781daa95a91c37a657143af1c9fa15.js',
    '/static/libs/golang.e823b447f564859c015c78baa62631e8.wasm',
    // Java
    '/static/java.worker.6657946717165202ea39.js',
    '/static/java.worker.9b6147abd5e56893ed30.js',
    '/static/libs/java8.8ebf0368cb4913100b222df85082da5e.js',
    // .Net
    '/static/dotnet.worker.50b8240687aed55fe54f.js',
    '/static/dotnet.worker.2eb1850ee30f26cb12a6.js',
    '/static/libs/dotnet.b34b811a67c7676a0512065d249fffe4.js',
    '/static/libs/dotnet.514cb9edb4e6e83f02326c7305e6474a.wasm',
    // Base
    '/static/libs/pcre2lib.c3c3d3d340fea16a312b549130fa6564.js',
    '/static/libs/pcre2lib.f2e2fa3bde3670b117a0d97bfa1be27c.wasm',
    // 正则调试
    '/static/vendors-sentry.0aec4123582cbb0e4dc0.chunk.js'
  )
}

async function spyAssets() {
  await cacheMissParseFiles()
  try {
    for (const filepath of assetsCache) {
      const resp = await instance.get(filepath, { responseType: 'stream' });
      await saveAssets(filepath, resp.data, true);
    }
  } catch (error) {
    console.log(error);
  }
}

async function saveAssets(filepath, respData, isStream) {
  //
  const filepos = path.resolve(saveDir, filepath.replace(/^\//, ''));
  console.log(`saveing asset file ${filepath} ==> ${filepos}`);
  const basename = path.dirname(filepos);
  await mkdirp(basename);
  if (isStream) {
    const writer = fs.createWriteStream(filepos);
    respData.pipe(writer);
    await finished(writer); //this is a Promise
  } else {
    await writeFile(filepos, respData);
  }
  await checkAll(filepath, filepos);
}

async function checkAll(file, filepos) {
  if (/bundle\./.test(file)) {
    const content = fs.readFileSync(filepos, 'utf-8');
    const assets = content.match(/"assets\/.*?\.json"/g);
    if (!assets) return;
    for (const asset of assets) {
      const file = '/static/' + asset.replace(/"/g, '');
      const resp = await instance.get(file, { responseType: 'stream' });
      await saveAssets(file, resp.data, true);
    }
  }
}

async function execpull() {
  rimraf.sync(saveDir);
  await spyIndex();
  await spySw();
  await spyAssets();
}

execpull();
