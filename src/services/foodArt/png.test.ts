import test from "node:test";
import assert from "node:assert/strict";
import { parseImageSize, validateMasterPng } from "./png";

function fakePng(width: number, height: number, colorType = 6, size = 100_100): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = colorType;
  return bytes;
}

test("production master gate accepts only the requested full-resolution transparent PNG", () => {
  const result = validateMasterPng(fakePng(2880, 2880), { width: 2880, height: 2880 });
  assert.equal(result.width, 2880);
  assert.equal(result.height, 2880);
  assert.equal(result.hasAlpha, true);
  assert.match(result.checksumSha256, /^[a-f0-9]{64}$/);
});

test("production master gate rejects undersized art rather than allowing browser upscaling", () => {
  assert.throws(() => validateMasterPng(fakePng(1024, 1024), { width: 2880, height: 2880 }), /expected the full-resolution/);
});

test("production master gate rejects PNGs without transparency", () => {
  assert.throws(() => validateMasterPng(fakePng(2880, 2880, 2), { width: 2880, height: 2880 }), /no alpha channel/);
});

test("configured image size is parsed exactly", () => {
  assert.deepEqual(parseImageSize("2880x2880"), { width: 2880, height: 2880 });
});
