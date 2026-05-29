const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');

// CONFIGURATION — all from environment variables
const DEVICE_ID = process.env.DEVICE_ID;
const API_KEY = process.env.DEVICE_API_KEY;
const API_URL = process.env.API_URL;
const PLUG_IP = process.env.PLUG_IP;

if (!DEVICE_ID) throw new Error('Missing required env: DEVICE_ID');
if (!API_KEY) throw new Error('Missing required env: DEVICE_API_KEY');
if (!API_URL) throw new Error('Missing required env: API_URL');

const LOCAL_DIR = path.join(__dirname, '..', 'apps', 'player', 'public', 'local-media');
const SCHEDULE_PATH = path.join(__dirname, '..', 'apps', 'player', 'public', 'schedule.json');

if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

function sanitizeFilename(filename) {
  return filename
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
}

async function fetchWithRetry(url, opts, retries = 3) {
  let delay = 5000;
  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.get(url, opts);
    } catch (err) {
      if (i === retries) throw err;
      console.error(`Request failed (attempt ${i + 1}/${retries + 1}): ${err.message}. Retrying in ${delay}ms...`);
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
      headers: { Authorization: `PayloadAPIKey ${API_KEY}` },
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
  const remoteDate = new Date(file.updatedAt);

  if (fs.existsSync(dest)) {
    const stats = fs.statSync(dest);
    if (new Date(stats.mtime) >= remoteDate) return;
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

function buildScheduleJson(activeItems) {
  const schedule = activeItems.map(item => ({
    programId: item.program?.id,
    startTime: item.startTime,
    endTime: item.endTime,
    program: {
      id: item.program?.id,
      title: item.program?.title,
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
        return resolved;
      }),
    },
  }));

  return {
    deviceId: DEVICE_ID,
    lastUpdated: new Date().toISOString(),
    schedule,
  };
}

async function resolveDeviceId() {
  const res = await fetchWithRetry(
    `${API_URL}/devices?where[deviceId][equals]=${DEVICE_ID}&depth=0&limit=1`,
    { headers: { Authorization: `PayloadAPIKey ${API_KEY}` } }
  );
  if (!res.data.docs || res.data.docs.length === 0) {
    throw new Error(`Device not found: ${DEVICE_ID}`);
  }
  return res.data.docs[0].id;
}

async function sync() {
  try {
    const numericId = await resolveDeviceId();

    const res = await fetchWithRetry(
      `${API_URL}/schedule?where[devices][contains]=${numericId}&where[program.status][equals]=approved&depth=2&sort=startTime`,
      { headers: { Authorization: `PayloadAPIKey ${API_KEY}` } }
    );

    const docs = res.data.docs || [];
    if (docs.length === 0) return;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    const graceStart = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    const activeItems = docs.filter(item => {
      const start = new Date(item.startTime);
      const end = item.endTime ? new Date(item.endTime) : null;
      if (start > tomorrow) return false;
      if (end && end < graceStart) return false;
      if (!end && start < graceStart) return false;
      return true;
    });

    if (activeItems.length === 0) return;

    const requiredFilenames = new Set();
    let shouldPowerOn = false;

    for (const item of activeItems) {
      const start = new Date(item.startTime);
      const end = item.endTime ? new Date(item.endTime) : null;

      if (start <= new Date(now.getTime() + 30 * 60000)) shouldPowerOn = true;
      if (start <= now && (!end || now < end)) shouldPowerOn = true;

      if (item.program?.slides) {
        for (const slide of item.program.slides) {
          const media = slide.blockType === 'videoBlock' ? slide.video : slide.image;
          if (media && typeof media === 'object') {
            if (media.filename) requiredFilenames.add(sanitizeFilename(media.filename));
            if (media.sizes?.fullHD?.filename) requiredFilenames.add(sanitizeFilename(media.sizes.fullHD.filename));
            if (media.sizes?.thumbnail?.filename) requiredFilenames.add(sanitizeFilename(media.sizes.thumbnail.filename));

            await downloadIfChanged(media, `${API_URL}/media`).catch(err =>
              console.error(`Download failed for ${media.filename}: ${err.message}`)
            );
            if (media.sizes) {
              await downloadSizes(media, `${API_URL}/media`).catch(err =>
                console.error(`Size download failed for ${media.filename}: ${err.message}`)
              );
            }
          }
        }
      }
    }

    if (PLUG_IP) {
      const cmd = shouldPowerOn ? 'on' : 'off';
      axios.get(`http://${PLUG_IP}/relay?state=${cmd}`).catch(() => {});
    }

    const localFiles = fs.readdirSync(LOCAL_DIR);
    for (const file of localFiles) {
      if (!requiredFilenames.has(file)) {
        try {
          fs.unlinkSync(path.join(LOCAL_DIR, file));
        } catch {}
      }
    }

    const scheduleData = buildScheduleJson(activeItems);
    const dir = path.dirname(SCHEDULE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = SCHEDULE_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(scheduleData, null, 2) + '\n');
    fs.renameSync(tmp, SCHEDULE_PATH);

    const activeProgramId = activeItems[0]?.program?.id || null;
    try {
      await axios.post(`${API_URL}/heartbeat`, {
        programId: activeProgramId,
      }, {
        headers: { Authorization: `PayloadAPIKey ${API_KEY}` },
      });
    } catch (err) {
      console.error('Heartbeat failed:', err.message);
    }

  } catch (err) {
    console.error('Sync error:', err.message);
  }
}

setInterval(sync, 60000);

sync().then(() => {
  const app = express();
  app.use('/local-media', express.static(LOCAL_DIR));
  app.use(express.static(path.join(__dirname, '..', 'apps', 'player', 'dist')));
  app.get('/schedule.json', (_, res) => {
    res.sendFile(SCHEDULE_PATH);
  });
  app.listen(5000, () => {
    console.log('Player server listening on http://localhost:5000');
  });
});
