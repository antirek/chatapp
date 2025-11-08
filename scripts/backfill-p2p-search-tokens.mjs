#!/usr/bin/env node
import Chat3Client from '../backend/src/services/Chat3Client.js';
import { updateP2PSearchTokens } from '../backend/src/utils/p2pSearchTokens.js';

async function fetchP2PDialogs(page, limit) {
  const filter = '(meta.type,eq,p2p)';
  const response = await Chat3Client.getDialogs({ page, limit, filter, includeMembers: true });
  return response;
}

async function ensureTokensForDialog(dialog) {
  const dialogId = dialog.dialogId || dialog._id;

  if (!dialog.members || dialog.members.length < 2) {
    const fullDialog = await Chat3Client.getDialog(dialogId);
    dialog.members = (fullDialog.data || fullDialog).members || [];
  }

  const memberIds = dialog.members.map((member) => member.userId).filter(Boolean);

  if (memberIds.length !== 2) {
    console.warn(`⚠️ Dialog ${dialogId} skipped: expected 2 members, received ${memberIds.length}`);
    return;
  }

  await updateP2PSearchTokens(dialogId, memberIds[0], memberIds[1]);
}

async function main() {
  const limit = parseInt(process.env.CHAT3_BACKFILL_LIMIT || '50', 10);
  let page = 1;
  let pages = 1;
  let processed = 0;

  console.log('🚀 Starting backfill of P2P search tokens');

  while (page <= pages) {
    try {
      const result = await fetchP2PDialogs(page, limit);
      const dialogs = result.data || [];

      pages = result.pagination?.pages || page;

      console.log(`📄 Processing page ${page}/${pages}, dialogs: ${dialogs.length}`);

      for (const dialog of dialogs) {
        try {
          await ensureTokensForDialog(dialog);
          processed += 1;
        } catch (error) {
          console.error(`❌ Failed to update tokens for dialog ${dialog.dialogId}:`, error.message);
        }
      }

      page += 1;
    } catch (error) {
      console.error(`❌ Failed to fetch dialogs on page ${page}:`, error.message);
      break;
    }
  }

  console.log(`✅ Completed. Dialogs processed: ${processed}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});

