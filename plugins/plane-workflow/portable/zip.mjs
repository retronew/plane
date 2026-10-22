export function createZip(entries) {
  // Stored entries, UTF-8 filenames, fixed DOS date (1980-01-01).
  // No dependencies, host timestamps or directory entries. Unix modes are fixed
  // (755 for .sh, 644 otherwise) so hook scripts stay executable after extraction.
  const files = [];
  const directory = [];
  let offset = 0;
  for (const [path, content] of entries) {
    const name = Buffer.from(path);
    let crc = 0xffffffff;
    for (const byte of content) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE((3 << 8) | 20, 4); // Made by Unix, so external attributes carry the mode.
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((path.endsWith(".sh") ? 0o100755 : 0o100644) * 0x10000, 38);
    central.writeUInt32LE(offset, 42);
    files.push(local, name, content);
    directory.push(central, name);
    offset += local.length + name.length + content.length;
  }
  const centralData = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, centralData, end]);
}
