#!/usr/bin/env node

/**
 * Quick helper to simulate an incoming business-contact message directly in Chat3.
 *
 * Usage:
 *   node scripts/send-test-contact-message.mjs \ 
 *     --dialog dlg_xxx \ 
 *     --contact cnt_xxx \ 
 *     --message "Привет!"
 *
 * Short flags: -d, -c, -m
 */

import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '../backend');

process.chdir(backendDir);

const { default: Chat3Client } = await import('../backend/src/services/Chat3Client.js');

function parseArgs(argv) {
  const result = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('-')) {
      continue;
    }

    const trimmed = arg.replace(/^--?/, '');
    const [keyPart, ...rest] = trimmed.split('=');
    const key = keyPart;

    if (rest.length > 0) {
      result[key] = rest.join('=');
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('-')) {
      result[key] = next;
      i += 1;
    } else {
      result[key] = true;
    }
  }

  return result;
}

function getOption(options, keys) {
  for (const key of keys) {
    if (options[key] && typeof options[key] === 'string') {
      return options[key];
    }
  }
  return null;
}

function printUsage() {
  console.log(`
Usage:
  node scripts/send-test-contact-message.mjs --dialog <dialogId> --contact <contactId> [--message "text"]

Options:
  --dialog,  -d   Chat3 dialogId (required)
  --contact, -c   Business contactId (required)
  --message, -m   Message text (optional, default: timestamped test text)
`.trim());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dialogId = getOption(args, ['dialog', 'dialogId', 'd']);
  const contactId = getOption(args, ['contact', 'contactId', 'c']);
  const message =
    getOption(args, ['message', 'm', 'text']) ||
    `Тестовое входящее сообщение ${new Date().toLocaleString('ru-RU')}`;

  if (!dialogId || !contactId) {
    console.error('❌ dialogId and contactId are required.');
    printUsage();
    process.exit(1);
  }

  console.log('🚀 Sending test message...');
  console.log(`   Dialog:   ${dialogId}`);
  console.log(`   Contact:  ${contactId}`);
  console.log(`   Content:  ${message}`);
  console.log('');

  try {
    const response = await Chat3Client.createMessage(dialogId, {
      senderId: contactId,
      type: 'internal.text',
      content: message,
    });

    const createdMessage = response?.data || response;

    console.log('✅ Message created successfully:');
    console.log(`   messageId: ${createdMessage?.messageId || createdMessage?._id}`);
    console.log(`   createdAt: ${createdMessage?.createdAt}`);
    console.log('');
  } catch (error) {
    const details = error?.response?.data || error.message || error;
    console.error('❌ Failed to send message:', details);
    process.exit(1);
  }
}

main();


