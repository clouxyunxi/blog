/*
 * build.js - articles.js 构建脚本
 * 功能：
 *   1. 扫描 owo/ 目录下所有 .md 文件
 *   2. 生成 articles.js（文件名 -> md 内容映射），供 article.html 渲染 + index.html 搜索使用
 *   注意：文章列表现在由 index.html 前端读取 article.txt 渲染，不再注入到 index.html
 * 用法：
 *   node build.js          # 一次性构建
 *   node build.js --watch  # 监听模式（持续运行，每 5 分钟强制刷新）
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OWO_DIR = path.join(ROOT, 'owo');
const ARTICLES_JS = path.join(ROOT, 'articles.js');

let lastFileSet = new Set();

function getMdFiles() {
    if (!fs.existsSync(OWO_DIR)) {
        console.error('✗ 找不到 owo 目录:', OWO_DIR);
        process.exit(1);
    }
    return fs.readdirSync(OWO_DIR)
        .filter(f => f.toLowerCase().endsWith('.md'))
        .map(f => {
            const match = f.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(.+?)\.md$/i);
            let date = null;
            let title = f.replace(/\.md$/i, '');
            if (match) {
                const [, y, m, d, t] = match;
                date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00`);
                title = t;
            }
            return { filename: f, date, title };
        });
}

function build() {
    const files = getMdFiles();

    // 对比变化
    const currentSet = new Set(files.map(f => f.filename));
    const added = [];
    const removed = [];
    if (lastFileSet.size > 0) {
        for (const f of currentSet) {
            if (!lastFileSet.has(f)) added.push(f);
        }
        for (const f of lastFileSet) {
            if (!currentSet.has(f)) removed.push(f);
        }
    }
    lastFileSet = currentSet;

    // 生成 articles.js（文件名 -> md 内容映射）
    const articlesObj = {};
    for (const f of files) {
        try {
            articlesObj[f.filename] = fs.readFileSync(path.join(OWO_DIR, f.filename), 'utf8');
        } catch (e) {
            console.error(`✗ 读取文件失败: ${f.filename}`, e.message);
        }
    }
    fs.writeFileSync(ARTICLES_JS, 'window.__ARTICLES__ = ' + JSON.stringify(articlesObj) + ';\n');

    const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    if (added.length === 0 && removed.length === 0) {
        console.log(`[${now}] ✓ 已刷新 articles.js（${files.length} 篇文章，无变化）`);
    } else {
        if (added.length > 0) console.log(`[${now}] + 新增: ${added.join(', ')}`);
        if (removed.length > 0) console.log(`[${now}] - 删除: ${removed.join(', ')}`);
        console.log(`[${now}] ✓ 生成 articles.js（${files.length} 篇文章，${(fs.statSync(ARTICLES_JS).size / 1024).toFixed(1)} KB）`);
    }
}

// ---- 主逻辑 ----
const isWatch = process.argv.includes('--watch');

if (isWatch) {
    console.log('🔍 监听模式已启动，每 5 分钟自动检查一次...');
    console.log('   按 Ctrl+C 退出\n');
    build();

    let debounceTimer = null;
    fs.watch(OWO_DIR, { persistent: true }, (eventType, filename) => {
        if (!filename || !filename.toLowerCase().endsWith('.md')) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            build();
        }, 300);
    });

    setInterval(() => {
        build();
    }, 5 * 60 * 1000);
} else {
    build();
}
