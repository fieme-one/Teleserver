const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Validate environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY || !process.env.TELEGRAM_BOT_TOKEN) {
    console.error('Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function checkTelegramAuth(data) {
    if (!data || !data.hash) {
        return false;
    }

    const { hash, ...userData } = data;
    const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
    const dataCheckString = Object.keys(userData)
        .sort()
        .map(key => `${key}=${userData[key]}`)
        .join('\n');
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    return hmac === hash;
}

function sanitizeName(name) {
    if (!name) return '';
    return name.trim().slice(0, 100); // Limit length to prevent DB issues
}

app.post('/telegram-login', async (req, res) => {
    try {
        const data = req.body;

        // Validate required fields
        if (!data.id || !data.hash) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields: id and hash are required' 
            });
        }

        if (!checkTelegramAuth(data)) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid Telegram authentication data' 
            });
        }

        // Handle name parsing more robustly
        let first_name = sanitizeName(data.first_name || '');
        let last_name = sanitizeName(data.last_name || '');

        // If first_name contains space and last_name is empty, split it
        if (first_name && first_name.includes(' ') && !last_name) {
            const parts = first_name.split(' ');
            first_name = parts[0];
            last_name = parts.slice(1).join(' ');
        }

        // Upsert user data
        const { data: userData, error } = await supabase
            .from('users')
            .upsert({
                telegram_id: data.id.toString(),
                username: data.username ? sanitizeName(data.username) : null,
                first_name: first_name,
                last_name: last_name,
                picture: data.photo_url || null,
                auth_date: data.auth_date ? new Date(data.auth_date * 1000).toISOString() : null,
                last_login: new Date().toISOString()
            }, { 
                onConflict: 'telegram_id',
                returning: 'representation' // Return the updated/inserted data
            });

        if (error) {
            console.error('Supabase error:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Database error occurred' 
            });
        }

        // Return success response without sensitive data
        const responseData = {
            id: data.id,
            username: data.username,
            first_name: first_name,
            last_name: last_name,
            photo_url: data.photo_url
        };

        res.json({ 
            success: true, 
            message: 'Login successful',
            user: responseData
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ 
        status: "OK", 
        timestamp: new Date().toISOString(),
        service: "Telegram Login Backend"
    });
});

app.get("/", (req, res) => {
    res.send("Backend is working! Don't worry");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Telegram login backend running on port ${PORT}...`);
});