import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3001;

// Disable serving of parent directory files
app.use((req, res, next) => {
    if (req.url.includes('..')) {
        res.status(403).send('Access denied');
        return;
    }
    next();
});

// Only serve the error test files
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'utils', 'error-test.html'));
});

app.get('/error.js', (req, res) => {
    res.sendFile(join(__dirname, 'utils', 'error.js'));
});

// Handle 404s
app.use((req, res) => {
    res.status(404).send('Test server: File not found');
});

app.listen(port, () => {
    console.log(`Test server running at http://localhost:${port}`);
    console.log('Please open this URL in a new incognito/private window');
}); 