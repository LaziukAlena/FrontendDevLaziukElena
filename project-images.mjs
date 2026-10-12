// Делает лёгкие копии картинок проектов для srcset. ОРИГИНАЛЫ НЕ МЕНЯЕТ.
//   img/project-agate.webp  ->  img/project-agate-600.webp, img/project-agate-1000.webp
//
// Установка:  npm install --save-dev sharp
// Запуск:     node project-images.mjs            (папка img, ширины 600 и 1000)
//             node project-images.mjs img 600,1000 72   (папка, ширины, качество)
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [, , dir = "img", widthsArg = "600,1000", qualityArg = "72"] = process.argv;
const widths = widthsArg.split(",").map(Number);
const quality = Number(qualityArg);
const kb = (n) => `${Math.round(n / 1024)} КБ`;

// только оригиналы: project-*.webp без суффикса -600 / -1000
const files = (await readdir(dir)).filter(
  (f) => /^project-.*\.webp$/i.test(f) && !/-\d+\.webp$/i.test(f) && !/\.orig\.webp$/i.test(f),
);
if (!files.length) {
  console.log(`В папке "${dir}" нет оригиналов project-*.webp`);
  process.exit(0);
}

console.log(`Качество ${quality}, ширины: ${widths.join(", ")} px\n`);
for (const file of files) {
  const input = path.join(dir, file);
  const { name } = path.parse(file);
  const meta = await sharp(input).metadata();
  console.log(`${file}  ${meta.width}×${meta.height}  ${kb((await stat(input)).size)}`);

  for (const w of widths) {
    const output = path.join(dir, `${name}-${w}.webp`);
    await sharp(input)
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality })
      .toFile(output);
    const info = await sharp(output).metadata();
    console.log(`   → ${path.basename(output).padEnd(30)} ${info.width}×${info.height}  ${kb((await stat(output)).size)}`);
  }
}
console.log("\nГотово. Оригиналы можно перенести в отдельную папку и не загружать на сервер.");
