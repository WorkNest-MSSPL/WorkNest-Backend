const express = require('express');
const { validateLicense } = require('./checker.obf'); // obfuscated function
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to validate license before each API
app.use((req, res, next) => {
    try {
        validateLicense();
        next();
    } catch (err) {
        res.status(403).send("❌ License invalid or expired");
    }
});

app.get('/', (req, res) => res.send('✅ API running!'));
app.get('/test', (req, res) => res.send('✅ Another route validated!'));

app.listen(PORT, () => console.log(`🚀 API started on port ${PORT}`));
