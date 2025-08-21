const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const SUPABASE_URL = "https://twqiguaoperbqdzevzes.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3cWlndWFvcGVyYnFkemV2emVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NTUwNDQsImV4cCI6MjA3MTMzMTA0NH0.hCXJ-TLFPfKn8ueHO-GPtKi1DZatdmkxN1RhRdlXCAA";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BOT_TOKEN = "7149110709:AAG055wFsqCPhzhEE2ONa3bT8Nt_LUieteg";

function checkTelegramAuth(data) {
    const { hash, ...userData } = data;
    const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
    const dataCheckString = Object.keys(userData)
        .sort()
        .map(key => `${key}=${userData[key]}`)
        .join('\n');
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    return hmac === hash;
}

app.post('/telegram-login', async (req, res) => {
    const data = req.body;

    if (!checkTelegramAuth(data)) {
        return res.status(400).json({ success: false, message: 'Invalid Telegram data' });
    }

    // Split name into first and last
    let first_name = data.first_name || '';
    let last_name = data.last_name || '';
    if (first_name && first_name.includes(' ')) {
        const parts = first_name.split(' ');
        first_name = parts.shift();
        last_name = parts.join(' ');
    }

    const { error } = await supabase
        .from('users')
        .upsert({
            telegram_id: data.id.toString(),
            username: data.username || null,
            first_name,
            last_name,
            picture: data.photo_url || null
        }, { onConflict: ['telegram_id'] });

    if (error) return res.status(500).json({ success: false, message: error.message });

    res.json({ success: true, user: data });
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Telegram login backend running...');
});
