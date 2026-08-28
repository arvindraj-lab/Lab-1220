import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

// Serve Web UI static files (index.html)
app.use(express.static(__dirname));

/**
 * POST /api/proxy
 * Proxy endpoint to bypass browser CORS restrictions for IBM Cloud / AWS APIs.
 */
app.post('/api/proxy', async (req, res) => {
    try {
        const { url, method, headers, textBody } = req.body;
        
        if (typeof fetch === 'undefined') {
            return res.status(500).json({ error: "Node fetch unavailable. Requires Node 18+." });
        }

        const fetchRes = await fetch(url, {
            method: method || 'GET',
            headers: headers || {},
            body: textBody || undefined
        });

        const respText = await fetchRes.text();
        let respData;
        try {
            respData = JSON.parse(respText);
        } catch (e) {
            respData = { raw: respText };
        }

        return res.status(fetchRes.status).json(respData);

    } catch (error) {
        console.error('❌ Proxy error:', error);
        return res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 WXO Security Toggle running on http://localhost:${PORT}`);
});
