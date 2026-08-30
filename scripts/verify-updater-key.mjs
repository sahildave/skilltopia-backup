#!/usr/bin/env node
/**
 * Proves the updater signing key held by CI matches the public key committed to
 * `src-tauri/tauri.conf.json`.
 *
 * Signs a throwaway artifact with `tauri signer sign`, then verifies the produced
 * minisign `.sig` against the committed public key. A key rotation that updates the
 * GitHub secret but not the config (or the reverse) ships updates every installed
 * client rejects; this fails the release instead.
 *
 * Local use:
 *   TAURI_SIGNING_PRIVATE_KEY=... TAURI_SIGNING_PRIVATE_KEY_PASSWORD=... \
 *     node scripts/verify-updater-key.mjs
 */

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const TAURI_CONFIG_PATH = 'src-tauri/tauri.conf.json';

function fail(message) {
  console.error(`Updater key verification failed: ${message}`);
  process.exit(1);
}

/** Decode a minisign public key file (comment line + base64 payload). */
function decodePublicKey(pubkeyField) {
  const keyFile = Buffer.from(pubkeyField, 'base64').toString('utf8');
  const payload = keyFile
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('untrusted comment:'))
    .at(0);

  if (!payload) {
    fail(`no key payload found in the pubkey in ${TAURI_CONFIG_PATH}`);
  }

  const bin = Buffer.from(payload, 'base64');
  if (bin.length !== 42) {
    fail(`committed public key is ${bin.length} bytes, expected 42`);
  }

  return { keyId: bin.subarray(2, 10), key: bin.subarray(10, 42) };
}

/** Decode a Tauri `.sig` file (base64 of a minisign signature file). */
function decodeSignature(sigFileContents) {
  const lines = Buffer.from(sigFileContents, 'base64').toString('utf8').split('\n');
  const signatureBin = Buffer.from(lines[1] ?? '', 'base64');
  const globalSignature = Buffer.from(lines[3] ?? '', 'base64');
  const trustedComment = lines[2] ?? '';

  if (signatureBin.length !== 74 || globalSignature.length !== 64) {
    fail('signature file is malformed');
  }
  if (!trustedComment.startsWith('trusted comment: ')) {
    fail('signature file is missing its trusted comment');
  }

  return {
    isPrehashed: signatureBin[0] === 0x45 && signatureBin[1] === 0x44,
    keyId: signatureBin.subarray(2, 10),
    signature: signatureBin.subarray(10, 74),
    trustedComment: trustedComment.slice('trusted comment: '.length),
    globalSignature,
  };
}

function verifyEd25519(message, rawPublicKey, signature) {
  const publicKey = crypto.createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: rawPublicKey.toString('base64url') },
    format: 'jwk',
  });
  return crypto.verify(null, message, publicKey, signature);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    fail(`${name} is required to sign updater artifacts`);
  }
  return value;
}

requireEnv('TAURI_SIGNING_PRIVATE_KEY');
requireEnv('TAURI_SIGNING_PRIVATE_KEY_PASSWORD');

const config = JSON.parse(fs.readFileSync(TAURI_CONFIG_PATH, 'utf8'));
const pubkeyField = config.plugins?.updater?.pubkey;
if (!pubkeyField) {
  fail(`no plugins.updater.pubkey in ${TAURI_CONFIG_PATH}`);
}
const publicKey = decodePublicKey(pubkeyField);

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'updater-key-'));
let signature;
let artifact;
try {
  const artifactPath = path.join(workDir, 'updater-key-probe.bin');
  artifact = crypto.randomBytes(64);
  fs.writeFileSync(artifactPath, artifact);

  const tauriCli = createRequire(import.meta.url).resolve('@tauri-apps/cli/tauri.js');
  execFileSync(process.execPath, [tauriCli, 'signer', 'sign', artifactPath], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  signature = decodeSignature(fs.readFileSync(`${artifactPath}.sig`, 'utf8'));
} catch (error) {
  fail(`could not sign a probe artifact with the CI private key: ${error.message}`);
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}

if (!publicKey.keyId.equals(signature.keyId)) {
  fail(
    `signing key ID ${signature.keyId.toString('hex')} does not match the committed public key ` +
      `${publicKey.keyId.toString('hex')} in ${TAURI_CONFIG_PATH}`,
  );
}

const signedMessage = signature.isPrehashed
  ? crypto.createHash('blake2b512').update(artifact).digest()
  : artifact;

if (!verifyEd25519(signedMessage, publicKey.key, signature.signature)) {
  fail(`signature does not verify against the public key committed in ${TAURI_CONFIG_PATH}`);
}

const globalMessage = Buffer.concat([
  signature.signature,
  Buffer.from(signature.trustedComment, 'utf8'),
]);
if (!verifyEd25519(globalMessage, publicKey.key, signature.globalSignature)) {
  fail(`trusted comment signature does not verify against the public key in ${TAURI_CONFIG_PATH}`);
}

console.log(
  `Updater signing key matches the public key committed in ${TAURI_CONFIG_PATH} ` +
    `(key ID ${publicKey.keyId.toString('hex')}).`,
);
