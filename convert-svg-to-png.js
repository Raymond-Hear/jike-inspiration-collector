const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 创建images目录（如果不存在）
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir);
}

// 定义要转换的SVG文件
const svgFiles = [
    { input: 'icon16.svg', output: 'icon16.png', width: 16, height: 16 },
    { input: 'icon48.svg', output: 'icon48.png', width: 48, height: 48 },
    { input: 'icon128.svg', output: 'icon128.png', width: 128, height: 128 }
];

// 转换每个SVG文件
async function convertSVGs() {
    for (const file of svgFiles) {
        const inputPath = path.join(imagesDir, file.input);
        const outputPath = path.join(imagesDir, file.output);
        
        try {
            await sharp(inputPath)
                .resize(file.width, file.height)
                .png()
                .toFile(outputPath);
            
            console.log(`✓ 转换成功: ${file.input} → ${file.output}`);
        } catch (error) {
            console.error(`✗ 转换失败: ${file.input}`, error);
        }
    }
}

// 运行转换
convertSVGs();