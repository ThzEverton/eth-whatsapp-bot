import { readFile } from "node:fs/promises";
import { crc32 } from "node:zlib";

// ZIP without compression, with a fixed allowlist: credentials never enter the download.
export async function extensionPackage() {
  const files = [
    "manifest.json",
    "background.js",
    "sidepanel.html",
    "sidepanel.css",
    "sidepanel.js",
    "README.md",
  ];
  const entries = [];
  const directory = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(`extension/${file}`);
    const data = await readFile(
      new URL(`../extension/${file}`, import.meta.url),
    );
    const checksum = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(33, 12); // 1980-01-01
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    entries.push(header, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += header.length + name.length + data.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...entries, central, end]);
}
