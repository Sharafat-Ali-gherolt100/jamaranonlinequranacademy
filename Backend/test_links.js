const fs = require('fs');
const path = require('path');

function getHtmlFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory() && !full.includes('node_modules')) {
            results = results.concat(getHtmlFiles(full));
        } else if (file.endsWith('.html')) {
            results.push(full);
        }
    });
    return results;
}

const htmlFiles = getHtmlFiles(path.join(__dirname, '..', 'Frontend'));
let brokenLinks = 0;
let brokenSrc = 0;
let totalLinksChecked = 0;
let totalSrcChecked = 0;

htmlFiles.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    const dir = path.dirname(filePath);
    
    // Check href links
    const hrefRegex = /href=["']([^"'#]+)["']/g;
    let match;
    while ((match = hrefRegex.exec(content)) !== null) {
        let link = match[1].split('?')[0];
        if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('mailto:') || link.startsWith('tel:') || link.startsWith('/api') || link === '#') continue;
        totalLinksChecked++;
        const targetPath = path.resolve(dir, link);
        if (!fs.existsSync(targetPath)) {
            console.log(`[BROKEN LINK] In ${path.relative(path.join(__dirname, '..'), filePath)}: "${link}" -> not found at ${targetPath}`);
            brokenLinks++;
        }
    }

    // Check src images/scripts
    const srcRegex = /src=["']([^"']+)["']/g;
    while ((match = srcRegex.exec(content)) !== null) {
        let src = match[1];
        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) continue;
        totalSrcChecked++;
        const targetPath = path.resolve(dir, src);
        if (!fs.existsSync(targetPath)) {
            console.log(`[BROKEN SRC] In ${path.relative(path.join(__dirname, '..'), filePath)}: "${src}" -> not found at ${targetPath}`);
            brokenSrc++;
        }
    }
});

console.log(`\nAudit Results:`);
console.log(`Checked ${htmlFiles.length} HTML files.`);
console.log(`Links checked: ${totalLinksChecked}, Broken: ${brokenLinks}`);
console.log(`Sources checked: ${totalSrcChecked}, Broken: ${brokenSrc}`);
