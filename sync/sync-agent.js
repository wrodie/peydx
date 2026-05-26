const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// CONFIGURATION
const DEVICE_ID = 'CLASSROOM-01'; 
const API_URL = 'https://your-lightsail-instance.com/api';
const LOCAL_DIR = path.join(__dirname, 'static/local-media');
const PLUG_IP = '192.168.1.50'; // IP of your SLWF-08

if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

async function sync() {
    try {
        // 1. Fetch Device Schedule (24hr window)
        const res = await axios.get(`${API_URL}/devices?where[deviceId][equals]=${DEVICE_ID}&depth=3`);
        const device = res.data.docs[0];
        if (!device) return;

        const now = new Date();
        const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));

        const activeItems = device.schedule.filter(item => {
            const start = new Date(item.startTime);
            return start <= tomorrow;
        });

        // 2. Determine Required Files & TV Power State
        const requiredFilenames = new Set();
        let shouldPowerOn = false;

        activeItems.forEach(item => {
            // Power logic: If a program starts within 30 mins or is currently active
            const start = new Date(item.startTime);
            if (start <= new Date(now.getTime() + 30 * 60000)) shouldPowerOn = true;

            item.program.slides?.forEach(slide => {
                const media = slide.blockType === 'videoBlock' ? slide.video : slide.image;
                if (media) {
                    requiredFilenames.add(media.filename);
                    downloadIfChanged(media);
                }
            });
        });

        // 3. Control Hardware (SLWF-08)
        controlPower(shouldPowerOn);

        // 4. Cleanup Orphans
        const localFiles = fs.readdirSync(LOCAL_DIR);
        localFiles.forEach(file => {
            if (!requiredFilenames.has(file)) fs.unlinkSync(path.join(LOCAL_DIR, file));
        });

    } catch (err) { console.error('Sync Error:', err.message); }
}

async function downloadIfChanged(file) {
    const dest = path.join(LOCAL_DIR, file.filename);
    const remoteDate = new Date(file.updatedAt);

    if (fs.existsSync(dest)) {
        const stats = fs.statSync(dest);
        if (new Date(stats.mtime) >= remoteDate) return; 
    }

    const writer = fs.createWriteStream(dest);
    const response = await axios({ url: file.url, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    
    return new Promise((resolve) => {
        writer.on('finish', () => {
            const time = remoteDate.getTime() / 1000;
            fs.utimesSync(dest, time, time);
            resolve();
        });
    });
}

function controlPower(on) {
    const cmd = on ? 'on' : 'off';
    // Example SLWF-08 API call (adjust based on your specific firmware)
    axios.get(`http://${PLUG_IP}/relay?state=${cmd}`).catch(() => {});
}

setInterval(sync, 60000);
sync();