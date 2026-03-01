const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { extractRecipeSimple } = require('./urlExtractor');
const { parseDuration, extractRecipeFromCreatorWebsite } = require('./tikTokExtractor');

// ---------- Extract Instagram Video ID ----------
const extractInstagramVideoId = (url) => {
    if (!url || typeof url !== 'string') return null;
    // Patterns: instagram.com/p/XXX, /reel/XXX, /tv/XXX
    const patterns = [
        /instagram\.com\/(?:p|reel|tv)\/([^\/?#]+)/i,
        /instagr\.am\/(?:p|reel|tv)\/([^\/?#]+)/i,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    return null;
};

const isValidInstagramUrl = (url) => extractInstagramVideoId(url) !== null;

// ---------- Description extraction from page context ----------
const extractDescriptionFromContext = (pageContent) => {
    console.log("🔍 Extracting description from page context ...");
    if (!pageContent) return '';

    const $ = cheerio.load(pageContent);

    // 1. Try meta description and og:description
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc && metaDesc.length > 50) {
        console.log(`✅ Found description via meta description (${metaDesc.length} chars)`);
        return metaDesc;
    }
    const ogDesc = $('meta[property="og:description"]').attr('content');
    if (ogDesc && ogDesc.length > 50) {
        console.log(`✅ Found description via og:description (${ogDesc.length} chars)`);
        return ogDesc;
    }

    // 2. Look for caption in Instagram's structured data
    const scripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
        try {
            const jsonText = $(scripts[i]).html();
            if (jsonText) {
                const data = JSON.parse(jsonText);
                const findDesc = (obj) => {
                    if (!obj || typeof obj !== 'object') return null;
                    if (obj.description && typeof obj.description === 'string' && obj.description.length > 50)
                        return obj.description;
                    if (obj.caption && typeof obj.caption === 'string' && obj.caption.length > 50)
                        return obj.caption;
                    for (const key in obj) {
                        if (typeof obj[key] === 'object') {
                            const found = findDesc(obj[key]);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                const foundDesc = findDesc(data);
                if (foundDesc) {
                    console.log(`✅ Found description in JSON data (${foundDesc.length} chars)`);
                    return foundDesc;
                }
            }
        } catch (e) { /* ignore */ }
    }

    // 3. Fallback to full page text
    console.log("⚠️ No specific description found, extracting from full page text...");
    $('script, style, noscript, meta, link, head').remove();
    let fullText = $.text();
    let lines = fullText.split(/\n|\r\n/)
        .map(line => line.trim())
        .filter(line => line.length > 10);
    console.log(`📊 Total lines found: ${lines.length}`);

    const uiNoisePatterns = [
        /^(copy|like|comment|share|follow|download|saved|add|favorite|report|block|menu|home|explore|profile)$/i,
        /^comments?\s*\(\d+\)$/i,
        /^replies?\s*\(\d+\)$/i,
        /^shares?\s*\(\d+\)$/i,
        /^likes?\s*\(\d+\)$/i,
        /^\d{1,2}:\d{2}\/\d{1,2}:\d{2}$/,
        /^(more|less|show more|show less|translate|original sound|audio|music)$/i,
        /^@[\w.-]+$/,
        /^#\w+$/,
        /^\d+[KM]?$/,
    ];
    const contentPatterns = [
        /\d+\s*(g|ml|tsp|tbsp|cup|oz|lb|gram|kilogram|liter|milliliter)/i,
        /flour|sugar|butter|egg|milk|oil|chocolate|cocoa|salt|baking|vanilla|cream/i,
        /preheat|bake|mix|whisk|stir|combine|fold|pour|spread|frost|ganache/i,
    ];

    let contentLines = lines.filter(line => {
        if (contentPatterns.some(p => p.test(line))) return true;
        return !uiNoisePatterns.some(p => p.test(line));
    });
    console.log(`📊 Content lines after filtering: ${contentLines.length}`);

    if (contentLines.length < 5 && fullText.length > 500) {
        const sentences = fullText.split(/[.!?]+/).filter(s => s.length > 30);
        if (sentences.length > 0) {
            contentLines = sentences;
            console.log(`📊 Using sentence split: ${contentLines.length} segments`);
        }
    }
    if (contentLines.length === 0) {
        console.log("⚠️ No content lines found, returning empty");
        return '';
    }
    let description = contentLines.join('\n');
    description = description.replace(/[ \t]+/g, ' ').trim();
    console.log(`✅ Extracted description via fallback: ${description.length} characters`);
    return description;
};

// ---------- Download subtitles (Instagram may not have auto-subs, but we try) ----------
const getInstagramSubtitles = async (videoUrl) => {
    const { execa } = await import('execa');
    const languages = ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh-Hans'];
    let subtitleContent = null;
    for (const lang of languages) {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'instagram-sub-'));
        try {
            const outputTemplate = path.join(tempDir, '%(id)s.%(ext)s');
            await execa('yt-dlp', [
                videoUrl,
                '--skip-download',
                '--write-auto-subs',
                '--sub-lang', lang,
                '--sub-format', 'srt',
                '--output', outputTemplate,
                '--quiet',
                '--no-warnings'
            ], { reject: false });
            const files = await fs.readdir(tempDir);
            const subFile = files.find(f =>
                f.includes(`.${lang}.`) && (f.endsWith('.srt') || f.endsWith('.vtt'))
            );
            if (subFile) {
                const filePath = path.join(tempDir, subFile);
                const rawContent = await fs.readFile(filePath, 'utf8');
                console.log(`✅ Instagram subtitles found (${lang})`);
                subtitleContent = rawContent
                    .replace(/\d+\n\d{2}:\d{2}:\d{2},\d{3} --> .*?\n/g, '')
                    .replace(/<[^>]*>/g, '')
                    .replace(/\n{2,}/g, '\n')
                    .trim();
                if (subtitleContent.length >= 20) break;
            }
        } catch (langError) { /* ignore */ } finally {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
    }
    if (!subtitleContent) return { success: false, error: "No subtitles available" };
    console.log(`✅ Instagram subtitles downloaded. Length: ${subtitleContent.length} chars`);
    return { success: true, transcript: subtitleContent, videoTitle: null, duration: null, method: 'subtitles' };
};

// ---------- Download audio (same as TikTok) ----------
const downloadInstagramAudioWithYtDlp = async (videoUrl) => {
    const { execa } = await import('execa');
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'instagram-audio-'));
    const outputPath = path.join(tempDir, 'audio.%(ext)s');
    try {
        await execa('yt-dlp', [
            videoUrl,
            '--extract-audio',
            '--audio-format', 'mp3',
            '--output', outputPath,
            '--quiet',
            '--no-warnings'
        ]);
        const files = await fs.readdir(tempDir);
        const mp3File = files.find(f => f.endsWith('.mp3'));
        if (!mp3File) throw new Error('No audio file generated');
        const filePath = path.join(tempDir, mp3File);
        const buffer = await fs.readFile(filePath);
        const { stdout: title } = await execa('yt-dlp', [
            '--get-title',
            videoUrl,
            '--quiet'
        ]);
        const { stdout: duration } = await execa('yt-dlp', [
            '--get-duration',
            videoUrl,
            '--quiet'
        ]);
        return {
            buffer,
            title: title.trim(),
            duration: parseDuration(duration.trim())
        };
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
};

// ---------- Transcribe with AssemblyAI (same) ----------
const transcribeAudioWithAssemblyAI = async (audioBuffer) => {
    try {
        console.log("📝 Transcribing audio using AssemblyAI...");
        const apiKey = process.env.ASSEMBLYAI_API_KEY;
        if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY not set");
        if (!audioBuffer || audioBuffer.length < 1000) throw new Error("Audio buffer is empty or invalid");

        const uploadResponse = await axios.post(
            "https://api.assemblyai.com/v2/upload",
            audioBuffer,
            { headers: { Authorization: apiKey, "Content-Type": "application/octet-stream" } }
        );
        const audioUrl = uploadResponse.data.upload_url;
        console.log("✅ Audio uploaded:", audioUrl);

        const transcriptResponse = await axios.post(
            "https://api.assemblyai.com/v2/transcript",
            { audio_url: audioUrl, speech_models: ["universal"] },
            { headers: { Authorization: apiKey, "Content-Type": "application/json" } }
        );
        const transcriptId = transcriptResponse.data.id;
        console.log("🆔 Transcript ID:", transcriptId);

        let transcriptText = null;
        let attempts = 0;
        while (!transcriptText && attempts < 40) {
            await new Promise(r => setTimeout(r, 2000));
            const pollingResponse = await axios.get(
                `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                { headers: { Authorization: apiKey } }
            );
            const status = pollingResponse.data.status;
            if (status === "completed") {
                transcriptText = pollingResponse.data.text;
                if (pollingResponse.data.language_code) console.log(`🌐 Detected language: ${pollingResponse.data.language_code}`);
                break;
            } else if (status === "error") throw new Error(pollingResponse.data.error);
            attempts++;
            console.log(`⏳ Processing... (${attempts}/40)`);
        }
        if (!transcriptText) throw new Error("AssemblyAI transcription timeout");
        console.log("✅ AssemblyAI transcription complete");
        return transcriptText;
    } catch (error) {
        console.error("❌ AssemblyAI transcription error:", error.message);
        throw error;
    }
};

// ---------- Get audio transcript ----------
const getInstagramAudioTranscript = async (videoUrl) => {
    try {
        console.log("🎬 Attempting audio transcription for Instagram...");
        const audioData = await downloadInstagramAudioWithYtDlp(videoUrl);
        const transcript = await transcribeAudioWithAssemblyAI(audioData.buffer);
        return { success: true, transcript, videoTitle: audioData.title, duration: audioData.duration, method: 'audio' };
    } catch (audioError) {
        console.error("❌ Audio transcription failed:", audioError.message);
        return { success: false, error: audioError.message };
    }
};

// ---------- Get thumbnail URL from yt-dlp ----------
const getInstagramThumbnail = async (videoUrl) => {
    const { execa } = await import('execa');
    try {
        const { stdout } = await execa('yt-dlp', [
            '--get-thumbnail',
            videoUrl,
            '--quiet'
        ]);
        return stdout.trim();
    } catch (error) {
        return null;
    }
};

// ---------- Analyze description (same as TikTok) ----------
const analyzeInstagramDescription = (text) => {
    if (!text || text.trim().length === 0) {
        return { hasIngredients: false, hasSteps: false, isEmpty: true, ingredientCount: 0, lineCount: 0 };
    }
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const ingredientUnits = /(cup|cups|tbsp|tsp|tablespoon|teaspoon|gram|grams|g|ml|milliliter|oz|pound|lb|pinch|dash)\b/gi;
    const unitMatches = (text.match(ingredientUnits) || []).length;
    const quantityMatches = (text.match(/\b\d+\.?\d*\s*(\/\s*\d+)?\b/g) || []).length;
    const hasIngredients = unitMatches >= 2 && quantityMatches >= 2;
    const stepKeywords = /(step|instruction|direction|procedure|preheat|mix|whisk|combine|bake|cook|heat|cool|serve|spread|pour|add|place)\b/gi;
    const hasSteps = stepKeywords.test(text);
    return { hasIngredients, hasSteps, isEmpty: lines.length < 3, ingredientCount: unitMatches, lineCount: lines.length };
};

// ---------- Validate URL ----------
const validateInstagramUrl = (url) => {
    if (!url || typeof url !== 'string') return { isValid: false, error: "URL is required and must be a string" };
    const videoId = extractInstagramVideoId(url);
    if (!videoId) return { isValid: false, error: "Invalid Instagram URL format" };
    return { isValid: true, videoId };
};

module.exports = {
    extractInstagramVideoId,
    isValidInstagramUrl,
    extractDescriptionFromContext,
    parseDuration,
    getInstagramSubtitles,
    downloadInstagramAudioWithYtDlp,
    transcribeAudioWithAssemblyAI,
    getInstagramAudioTranscript,
    getInstagramThumbnail,
    analyzeInstagramDescription,
    validateInstagramUrl,
    extractRecipeFromCreatorWebsite
};