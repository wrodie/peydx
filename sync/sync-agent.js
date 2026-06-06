require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { io: socketIOClient } = require('socket.io-client');
const { Server: SocketIOServer } = require('socket.io');
const http = require('http');

// CONFIGURATION — all from environment variables
const API_KEY = process.env.DEVICE_API_KEY;
const API_URL = process.env.API_URL;
const PLUG_IP = process.env.PLUG_IP;

if (!API_KEY) throw new Error('Missing required env: DEVICE_API_KEY');
if (!API_URL) throw new Error('Missing required env: API_URL');

const LOCAL_DIR = process.env.LOCAL_DIR || path.join(__dirname, '..', 'apps', 'player', 'public', 'local-media');
const SCHEDULE_PATH = path.join(__dirname, '..', 'apps', 'player', 'public', 'schedule.json');

if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

console.log(ts('[sync] Sync agent starting...'));

// Write empty schedule so player always has a file to fetch on startup
if (!fs.existsSync(SCHEDULE_PATH)) {
  const empty = JSON.stringify({ lastUpdated: new Date().toISOString(), schedule: [], defaultBackground: null }, null, 2) + '\n'
  const dir = path.dirname(SCHEDULE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = SCHEDULE_PATH + '.tmp'
  fs.writeFileSync(tmp, empty)
  fs.renameSync(tmp, SCHEDULE_PATH)
}

let currentSlideIndex = 0;
let activeProgramId = null;
let userSelectedProgramId = null;

function sanitizeFilename(filename) {
  return filename
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
}

function ts(msg) {
  return `[${new Date().toISOString().slice(11, 19)}] ${msg}`
}

async function fetchWithRetry(url, opts, retries = 3) {
  let delay = 5000;
  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.get(url, { ...opts, timeout: 30000 });
    } catch (err) {
      if (i === retries) throw err;
      console.error(ts(`[sync] API request failed (${err.code || err.message}) — retry ${i + 1}/${retries} in ${delay / 1000}s`));
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 2, 300000);
    }
  }
}

async function downloadFile(url, dest, updatedAt) {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers: { Authorization: `devices API-Key ${API_KEY}` },
    });
    const writer = fs.createWriteStream(dest);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        if (updatedAt) {
          const time = new Date(updatedAt).getTime() / 1000;
          fs.utimesSync(dest, time, time);
        }
        resolve();
      });
      writer.on('error', reject);
    });
  } catch (err) {
    console.error(`Failed to download ${url}: ${err.message}`);
    throw err;
  }
}

async function downloadIfChanged(file, mediaBaseUrl) {
  if (!file || !file.filename) return;

  const sanitized = sanitizeFilename(file.filename);
  const dest = path.join(LOCAL_DIR, sanitized);
  const remoteSec = Math.floor(new Date(file.updatedAt).getTime() / 1000);

  if (fs.existsSync(dest)) {
    const stats = fs.statSync(dest);
    const localSec = Math.floor(new Date(stats.mtime).getTime() / 1000);
    if (localSec >= remoteSec) return;
  }

  const url = mediaBaseUrl ? `${mediaBaseUrl}/${file.filename}` : file.url;
  await downloadFile(url, dest, file.updatedAt);
}

async function downloadSizes(media, mediaBaseUrl) {
  const sizes = ['fullHD', 'thumbnail'];
  for (const size of sizes) {
    const sizeData = media.sizes?.[size];
    if (sizeData?.filename) {
      const sanitized = sanitizeFilename(sizeData.filename);
      const dest = path.join(LOCAL_DIR, sanitized);
      const remoteDate = new Date(media.updatedAt);
      if (fs.existsSync(dest)) {
        const stats = fs.statSync(dest);
        if (new Date(stats.mtime) >= remoteDate) continue;
      }
      const url = `${mediaBaseUrl}/${sizeData.filename}`;
      await downloadFile(url, dest, media.updatedAt);
    }
  }
}

function buildScheduleJson(activeItems, backgroundUrl, deviceName) {
  const schedule = activeItems.map(item => ({
    programId: item.program?.id,
    scheduleType: item.scheduleType || 'autoplay',
    startTime: item.startTime,
    endTime: item.endTime,
    program: {
      id: item.program?.id,
      title: item.program?.title,
      loop: item.program?.loop,
      department: item.program?.folder?.department?.name || null,
      slides: (item.program?.slides || []).map(slide => {
        const resolved = { ...slide };
        if (slide.blockType === 'imageBlock' && slide.image) {
          const img = typeof slide.image === 'object' ? slide.image : null;
          if (img) {
            const sizeFilename = img.sizes?.fullHD?.filename;
            resolved.image = {
              url: sizeFilename
                ? `/local-media/${sanitizeFilename(sizeFilename)}`
                : img.url
                  ? `/local-media/${sanitizeFilename(img.filename || '')}`
                  : null,
              alt: img.alt || null,
            };
          }
        }
        if (slide.blockType === 'videoBlock' && slide.video) {
          const vid = typeof slide.video === 'object' ? slide.video : null;
          if (vid) {
            resolved.video = {
              url: vid.url
                ? `/local-media/${sanitizeFilename(vid.filename || '')}`
                : null,
              alt: vid.alt || null,
            };
          }
        }
        if (slide.blockType === 'audioBlock' && slide.audio) {
          const aud = typeof slide.audio === 'object' ? slide.audio : null;
          if (aud) {
            resolved.audio = {
              url: aud.url
                ? `/local-media/${sanitizeFilename(aud.filename || '')}`
                : null,
              alt: aud.alt || null,
            };
          }
        }
        return resolved;
      }),
    },
  }));

  return {
    lastUpdated: new Date().toISOString(),
    schedule,
    defaultBackground: backgroundUrl || null,
    deviceName: deviceName || null,
  };
}

function writeScheduleAtomically(data) {
  // Skip if content is identical (ignoring lastUpdated)
  try {
    const existing = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf-8'));
    const { lastUpdated: a, ...existingRest } = existing;
    const { lastUpdated: b, ...dataRest } = data;
    if (JSON.stringify(existingRest) === JSON.stringify(dataRest)) {
      console.log(ts('[sync] Schedule unchanged, skipping write'));
      return false;
    }
  } catch {}

  const dir = path.dirname(SCHEDULE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = SCHEDULE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, SCHEDULE_PATH);
  return true;
}

async function resolveDevice() {
  const res = await fetchWithRetry(
    `${API_URL}/devices?depth=0&limit=1`,
    { headers: { Authorization: `devices API-Key ${API_KEY}` } }
  );
  if (!res.data.docs || res.data.docs.length === 0) {
    throw new Error('Device not found — check DEVICE_API_KEY');
  }
  const device = res.data.docs[0];
  return {
    id: device.id,
    name: device.name || null,
    defaultBackground: device.defaultBackground || null,
  };
}

async function downloadSpecificMedia(data) {
  if (!data.url) return;
  const sanitized = sanitizeFilename(data.url.split('/').pop() || `media-${data.mediaId}`);
  const dest = path.join(LOCAL_DIR, sanitized);
  await downloadFile(data.url, dest, new Date().toISOString()).catch(err =>
    console.error(`Download failed for media ${data.mediaId}: ${err.message}`)
  );
}

async function sync() {
  console.log(ts('[sync] sync() started'));
  try {
    let t0 = Date.now();
    const device = await resolveDevice();
    console.log(ts(`[sync] resolveDevice: ${Date.now() - t0}ms`));
    const numericId = device.id;
    const deviceName = device.name;
    const defaultBgId = device.defaultBackground;

    t0 = Date.now();
    const res = await fetchWithRetry(
      `${API_URL}/schedule?where[devices][contains]=${numericId}&where[program.status][equals]=approved&depth=3&sort=startTime`,
      { headers: { Authorization: `devices API-Key ${API_KEY}` } }
    );
    console.log(ts(`[sync] fetch schedule: ${Date.now() - t0}ms`));

    const docs = res.data.docs || [];
    if (docs.length === 0) {
      console.log(ts(`[sync] No schedule entries found for device ${numericId}`));
      return;
    }

    const now = new Date();
    const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    const graceStart = new Date(now.getTime() - (6 * 60 * 60 * 1000));

    const activeItems = docs.filter(item => {
      const scheduleType = item.scheduleType || 'autoplay';

      if (scheduleType === 'availability') {
        if (!item.startTime) return false;
        const start = new Date(item.startTime);
        const end = item.endTime ? new Date(item.endTime) : null;
        if (start > now) return false;
        if (end && now > new Date(end.getTime() + 24 * 60 * 60 * 1000)) return false;
        return true;
      }

      const start = new Date(item.startTime);
      const end = item.endTime ? new Date(item.endTime) : null;
      if (start > tomorrow) return false;
      if (end && end < graceStart) return false;
      if (!end && start < graceStart) return false;
      return true;
    });

    if (activeItems.length === 0) {
      console.log(ts('[sync] No active schedule items after filtering'));
      return;
    }

    const requiredFilenames = new Set();
    let shouldPowerOn = false;

    for (const item of activeItems) {
      const start = new Date(item.startTime);
      const end = item.endTime ? new Date(item.endTime) : null;
      if (start <= new Date(now.getTime() + 30 * 60000)) shouldPowerOn = true;
      if (start <= now && (!end || now < end)) shouldPowerOn = true;
    }

    console.log(ts(`[sync] Fetched schedule: ${activeItems.length} active program(s)`));

    // Phase 2: Download all media in parallel
    const downloads = [];

    for (const item of activeItems) {
      if (item.program?.slides) {
        for (const slide of item.program.slides) {
          const media =
            slide.blockType === 'videoBlock' ? slide.video
              : slide.blockType === 'audioBlock' ? slide.audio
              : slide.image;
          if (media && typeof media === 'object') {
            if (media.filename) requiredFilenames.add(sanitizeFilename(media.filename));
            if (media.sizes?.fullHD?.filename) requiredFilenames.add(sanitizeFilename(media.sizes.fullHD.filename));
            if (media.sizes?.thumbnail?.filename) requiredFilenames.add(sanitizeFilename(media.sizes.thumbnail.filename));

            const logName = media.filename || 'unknown';
            console.log(ts(`[sync] Queuing ${logName}...`));
            downloads.push(
              downloadIfChanged(media, `${API_URL}/media/file`)
                .then(() => console.log(ts(`[sync]   ${logName} done`)))
                .catch(err => console.error(ts(`[sync]   ${logName} failed: ${err.message}`)))
            );

            if (media.sizes) {
              for (const size of ['fullHD', 'thumbnail']) {
                const sizeData = media.sizes?.[size];
                if (sizeData?.filename) {
                  const sanitized = sanitizeFilename(sizeData.filename);
                  if (!requiredFilenames.has(sanitized)) continue;
                  const dest = path.join(LOCAL_DIR, sanitized);
                  const remoteSec = Math.floor(new Date(media.updatedAt).getTime() / 1000);
                  if (fs.existsSync(dest)) {
                    const stats = fs.statSync(dest);
                    const localSec = Math.floor(new Date(stats.mtime).getTime() / 1000);
                    if (localSec >= remoteSec) continue;
                  }
                  const url = `${API_URL}/media/file/${sizeData.filename}`;
                  downloads.push(
                    downloadFile(url, dest, media.updatedAt)
                      .then(() => console.log(ts(`[sync]   ${sizeData.filename} done`)))
                      .catch(err => console.error(ts(`[sync]   ${sizeData.filename} failed: ${err.message}`)))
                  );
                }
              }
            }
          }
        }
      }
    }

    // Download default background
    let defaultBackgroundUrl = null;
    if (defaultBgId) {
      downloads.push(
        (async () => {
          try {
            const bgRes = await fetchWithRetry(
              `${API_URL}/media/${defaultBgId}?depth=0`,
              { headers: { Authorization: `devices API-Key ${API_KEY}` } }
            );
            const bgMedia = bgRes.data;
              if (bgMedia && bgMedia.filename) {
                console.log(ts(`[sync] Queuing background ${bgMedia.filename}...`));
                await downloadIfChanged(bgMedia, `${API_URL}/media/file`);
                const bgRemoteSec = Math.floor(new Date(bgMedia.updatedAt).getTime() / 1000);
                const fullHdFilename = bgMedia.sizes?.fullHD?.filename;
                if (fullHdFilename) {
                  const fhdSanitized = sanitizeFilename(fullHdFilename);
                  const fhdDest = path.join(LOCAL_DIR, fhdSanitized);
                  if (!fs.existsSync(fhdDest) || Math.floor(new Date(fs.statSync(fhdDest).mtime).getTime() / 1000) < bgRemoteSec) {
                    await downloadFile(
                      `${API_URL}/media/file/${fullHdFilename}`,
                      fhdDest,
                      bgMedia.updatedAt
                    );
                  }
                }
                const thumbFilename = bgMedia.sizes?.thumbnail?.filename;
                if (thumbFilename) {
                  const thumbSanitized = sanitizeFilename(thumbFilename);
                  const thumbDest = path.join(LOCAL_DIR, thumbSanitized);
                  if (!fs.existsSync(thumbDest) || Math.floor(new Date(fs.statSync(thumbDest).mtime).getTime() / 1000) < bgRemoteSec) {
                    await downloadFile(
                      `${API_URL}/media/file/${thumbFilename}`,
                      thumbDest,
                      bgMedia.updatedAt
                    );
                  }
                }
              const bgFilename = fullHdFilename || bgMedia.filename;
              defaultBackgroundUrl = `/local-media/${sanitizeFilename(bgFilename)}`;
              requiredFilenames.add(sanitizeFilename(bgFilename));
              if (thumbFilename) requiredFilenames.add(sanitizeFilename(thumbFilename));
              console.log(ts(`[sync]   background done`));
            }
          } catch (err) {
            console.error(ts(`[sync] Background download failed: ${err.message}`));
          }
        })()
      );
    }

    if (downloads.length > 0) {
      console.log(ts(`[sync] Downloading ${downloads.length} file(s)...`));
      await Promise.allSettled(downloads);
      console.log(ts('[sync] All downloads complete'));
    }

    if (PLUG_IP) {
      const cmd = shouldPowerOn ? 'on' : 'off';
      axios.get(`http://${PLUG_IP}/relay?state=${cmd}`).catch(() => {});
    }

    // Cleanup stale files
    const localFiles = fs.readdirSync(LOCAL_DIR);
    for (const file of localFiles) {
      if (!requiredFilenames.has(file)) {
        try {
          fs.unlinkSync(path.join(LOCAL_DIR, file));
        } catch {}
      }
    }

    // Phase 3: Rewrite schedule with local URLs
    let scheduleChanged = writeScheduleAtomically(buildScheduleJson(activeItems, defaultBackgroundUrl, deviceName));
    if (scheduleChanged) {
      console.log(ts('[sync] Schedule rewritten with local URLs'));
    }

    // Determine the currently-active program
    const checkNow = new Date();
    const nowPlaying = activeItems.filter(i => (i.scheduleType || 'autoplay') === 'autoplay').reduce((best, item) => {
      const start = new Date(item.startTime);
      if (start > checkNow) return best;
      const end = item.endTime ? new Date(item.endTime) : null;
      if (end && checkNow >= end) return best;
      if (!best || new Date(item.startTime) > new Date(best.startTime)) return item;
      return best;
    }, null);
    activeProgramId = userSelectedProgramId || nowPlaying?.program?.id || null;

    // Emit heartbeat via Socket.IO
    if (cmsSocket?.connected) {
      cmsSocket.emit('device:heartbeat', {
        programId: activeProgramId,
        slideIndex: currentSlideIndex,
      }, (ack) => {
        if (!ack?.ok) console.error('Heartbeat via Socket.IO failed')
      })
    }

    // HTTP heartbeat fallback
    try {
      await axios.post(`${API_URL}/heartbeat`, {
        programId: activeProgramId,
        slideIndex: currentSlideIndex,
      }, {
        headers: { Authorization: `devices API-Key ${API_KEY}` },
      });
    } catch (err) {
      console.error('Heartbeat failed:', err.message);
    }

    // Notify local player if schedule actually changed
    if (scheduleChanged) {
      localIO?.emit('schedule:update');
    }

  } catch (err) {
    console.error('Sync error:', err.message);
  }
}

// ========================
// Socket.IO: CMS Connection
// ========================
let cmsSocket = null;

function connectToCMS() {
  const wsUrl = API_URL.replace(/\/api$/, '');
  const socket = socketIOClient(wsUrl, {
    path: '/api/ws',
    extraHeaders: { Authorization: `devices API-Key ${API_KEY}` },
    auth: { apiKey: API_KEY },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  });

  socket.on('connect', () => {
    console.log('Connected to CMS WebSocket');
    sync();
  });

  socket.on('schedule:update', () => {
    console.log('Received schedule update via WebSocket');
    sync();
  });

  socket.on('program:update', () => {
    console.log('Received program update via WebSocket');
    sync();
  });

  socket.on('media:update', (data) => {
    console.log('Received media update via WebSocket');
    downloadSpecificMedia(data);
  });

  socket.on('remote:advance', () => {
    localIO?.emit('remote:advance');
  });

  socket.on('remote:previous', () => {
    localIO?.emit('remote:previous');
  });

  socket.on('remote:goto', (data) => {
    localIO?.emit('remote:goto', data);
  });

  socket.on('remote:program', (data) => {
    localIO?.emit('remote:program', data);
  });

  socket.on('remote:menu', () => {
    localIO?.emit('remote:menu');
  });

  socket.on('remote:back', () => {
    localIO?.emit('remote:back');
  });

  socket.on('remote:select', () => {
    localIO?.emit('remote:select');
  });

  socket.on('remote:pause', () => {
    localIO?.emit('remote:pause');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from CMS WebSocket');
  });

  cmsSocket = socket;
}

// ========================
// Express + Local Socket.IO
// ========================
let localIO = null;

const app = express();

app.get('/schedule.json', (_, res) => {
  res.sendFile(SCHEDULE_PATH);
});

app.get('/config.json', (_, res) => {
  const configPath = path.join(__dirname, 'key-config.json');
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return res.json(config);
    }
  } catch {}
  res.json({
    keys: {
      menu: 'KeyM',
      up: 'ArrowUp',
      down: 'ArrowDown',
      enter: 'Enter',
      exit: 'Escape',
    },
  });
});
app.use('/local-media', express.static(LOCAL_DIR));
app.use(express.static(path.join(__dirname, '..', 'apps', 'player', 'dist')));

const httpServer = http.createServer(app);

localIO = new SocketIOServer(httpServer, {
  path: '/ws',
  cors: { origin: '*' },
});

localIO.on('connection', (localPlayerSocket) => {
  console.log('Local player connected via WebSocket');
  localPlayerSocket.emit('schedule:update');

  localPlayerSocket.on('device:slideChange', (data) => {
    currentSlideIndex = data.slideIndex;
    if (cmsSocket?.connected) {
      cmsSocket.emit('device:slideChange', data);
    }
  });

  localPlayerSocket.on('device:stateChange', (data) => {
    if (data.state === 'playing' && data.programId) {
      userSelectedProgramId = data.programId;
    } else if (data.state !== 'playing') {
      userSelectedProgramId = null;
    }
    if (cmsSocket?.connected) {
      cmsSocket.emit('device:stateChange', data);
    }
  });
});

httpServer.listen(5000, () => {
  console.log('Player server listening on http://localhost:5000');

  connectToCMS();
});

// HTTP polling as fallback
setInterval(sync, 60000);
