// Делает уменьшенные копии картинки для srcset: foto.webp -> foto-460.webp, foto-920.webp
// Установка:  npm install --save-dev sharp
// Запуск:     node responsive-images.mjs img/foto.webp 460 920
import path from "node:path";
import { stat } from "node:fs/promises";
import sharp from "sharp";

const [, , input, ...widths] = process.argv;
if (!input || !widths.length) {
  console.log("Пример: node responsive-images.mjs img/foto.webp 460 920");
  process.exit(1);
}

const { name, dir } = path.parse(input);
const meta = await sharp(input).metadata();
const kb = (n) => `${Math.round(n / 1024)} КБ`;
console.log(
  `Оригинал: ${meta.width}×${meta.height}, ${kb((await stat(input)).size)}`,
);

for (const w of widths.map(Number)) {
  const output = path.join(dir, `${name}-${w}.webp`);
  await sharp(input)
    .resize({ width: w, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(output);
  const info = await sharp(output).metadata();
  console.log(
    `${path.basename(output).padEnd(18)} ${info.width}×${info.height}  ${kb((await stat(output)).size)}`,
  );
}
