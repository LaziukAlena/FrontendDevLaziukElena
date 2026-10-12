// Проверка и сжатие картинок проектов (project-*.webp / .png / .jpg).
//
// Установка:  npm install --save-dev sharp
//
// 1) Только проверка (файлы НЕ меняются) — показывает размеры и что тяжёлое:
//      node optimize-images.mjs
//      node optimize-images.mjs img
// 2) Сжать то, что помечено как тяжёлое:
//      node optimize-images.mjs img --write
//    Параметры: --width=1400 (макс. ширина, px)  --quality=78  --limit=200 (порог, КБ)
//
// С --write:
//   • .png / .jpg → рядом создаётся .webp
//   • .webp → тяжёлый или слишком широкий файл пережимается на месте
//             (копия оригинала сохраняется как *.orig.webp)
import { readdir, stat, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--")) ?? "img";
const opt = (name, def) => Number(args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def);
const write = args.includes("--write");
const maxWidth = opt("width", 1400);
const quality = opt("quality", 78);
const limitKb = opt("limit", 200);

const kb = (bytes) => Math.round(bytes / 1024);

const files = (await readdir(dir)).filter(
  (f) => /^project-.*\.(webp|png|jpe?g)$/i.test(f) && !/\.orig\.webp$/i.test(f),
);
if (!files.length) {
  console.log(`В папке "${dir}" нет файлов project-*.webp / .png / .jpg`);
  process.exit(0);
}

console.log(`Папка: ${dir}   режим: ${write ? "СЖАТИЕ" : "только проверка"}   порог: ${limitKb} КБ, ширина до ${maxWidth}px\n`);
console.log("файл".padEnd(30), "размер px".padEnd(12), "вес".padStart(8), "  вердикт");

let saved = 0;
for (const file of files) {
  const input = path.join(dir, file);
  const isWebp = /\.webp$/i.test(file);
  const size = (await stat(input)).size;
  const { width, height } = await sharp(input).metadata();

  const heavy = size > limitKb * 1024;
  const wide = width > maxWidth;
  const verdict = !isWebp ? "не WebP" : heavy || wide ? `тяжёлый${wide ? " и широкий" : ""}` : "ок";
  console.log(file.padEnd(30), `${width}×${height}`.padEnd(12), `${kb(size)} КБ`.padStart(8), " ", verdict);

  if (!write) continue;

  if (!isWebp) {
    const output = input.replace(/\.(png|jpe?g)$/i, ".webp");
    await sharp(input).resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality }).toFile(output);
    console.log(`   → создан ${path.basename(output)} (${kb((await stat(output)).size)} КБ)`);
  } else if (heavy || wide) {
    const buffer = await sharp(input)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    if (buffer.length < size) {
      await copyFile(input, input.replace(/\.webp$/i, ".orig.webp"));
      await writeFile(input, buffer);
      saved += size - buffer.length;
      console.log(`   → сжато: ${kb(size)} → ${kb(buffer.length)} КБ`);
    } else {
      console.log("   → пережатие не помогло, файл оставлен как есть");
    }
  }
}

if (write) console.log(`\nЭкономия: ${kb(saved)} КБ`);
else console.log("\nЧтобы сжать помеченные файлы: node optimize-images.mjs img --write");
