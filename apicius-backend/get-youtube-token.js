// get-youtube-token.js
const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');

const CREDENTIALS_PATH = './credentials/client_secret.json';
const TOKEN_PATH = './credentials/token.json';

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
console.log('Credentials loaded. Top-level keys:', Object.keys(credentials));

// Determine the correct key
const key = credentials.installed ? 'installed' : (credentials.web ? 'web' : null);
if (!key) {
    console.error('Invalid credentials file: missing "installed" or "web" key');
    process.exit(1);
}
console.log(`Using key: "${key}"`);

const { client_secret, client_id } = credentials[key];

// Use the exact redirect URI you added (change if you used urn:ietf:wg:oauth:2.0:oob)
const redirectUri = 'http://localhost'; // or 'urn:ietf:wg:oauth:2.0:oob'

console.log(`Client ID: ${client_id}`);
console.log(`Using redirect URI: ${redirectUri}`);

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.force-ssl']
});

console.log('Authorize this app by visiting this URL:\n', authUrl);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question('Enter the code from that page here: ', async (code) => {
    rl.close();
    try {
        const { tokens } = await oAuth2Client.getToken(code);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log('Token stored to', TOKEN_PATH);
    } catch (err) {
        console.error('Error retrieving access token', err);
    }
});