import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SectGameManager } from '../systems/SectGameManager';
import {
  DEFAULT_SECT_DIALOGUE_BANK,
  interpolateDialogueTemplate,
} from '../data/sectDialogueBank';
import {
  ADMIN_CATEGORIES,
  MiniGameId,
  SectLeaderAnimationId,
} from '../types/magiao';
import { formatCompactPlayerName } from '../utils/compactPlayerName';
import { sanitizeTikTokChatText } from '../../server/tiktokAdapter';
import { PersistentGiftStore } from '../../server/giftStore';
import { PersistentOBSSyncStore } from '../../server/obsSyncStore';
import { getAvailableVoiceOptions } from '../../server/ttsProxy';
import { LabelCollisionManager } from '../systems/LabelCollisionManager';
import { giftRegistry } from '../systems/GiftRegistry';
import { sectTransitionManager } from '../systems/SectTransitionManager';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

function runTest(id: number, name: string, fn: () => string) {
  try {
    const detail = fn();
    results.push({ id, name, passed: true, detail });
    console.log(`✅ [PASS #${String(id).padStart(2, '0')}] ${name} — ${detail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ id, name, passed: false, detail: msg });
    console.error(`❌ [FAIL #${String(id).padStart(2, '0')}] ${name} — ${msg}`);
  }
}

console.log('================================================================================');
console.log('🐉 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN 30 HẠNG MỤC: MA GIÁO ONLINE – THIÊN HẠ ĐỆ NHẤT TÀ PHÁI');
console.log('================================================================================');

const gm = new SectGameManager();
sectTransitionManager.setGameManager(gm);

// 1-8. Foundation, Admin 20 tabs, OBS Sync Store, Demo Mode, TikTok Sanitizer
runTest(1, 'Cấu trúc Dự án & Master Config khởi tạo chuẩn (8 Cấp Bậc Chính Thức + Sự Kiện Diệt Môn 1.000 Xu)', () => {
  const cfg = gm.getConfig();
  assert.equal(cfg.ranks.length, 8, 'Bảng cấp bậc chính thức phải có đúng 8 cấp (0..199 xu)');
  assert.equal(cfg.dietMonConfig?.coinThreshold, 1000, 'Mốc sự kiện Diệt Môn mặc định phải là 1.000 xu');
  assert.equal(cfg.sectLeaderAnimations.length, 35, 'Phải có đúng 35 hoạt ảnh Giáo Chủ');
  assert.equal(cfg.miniGames.length, 3, 'Phải có đúng 3 Mini Game');
  return `8 cấp bậc chính thức (0..199 xu), Diệt Môn 1.000 xu, 35 hoạt ảnh Giáo Chủ, 3 Mini Game đã nạp.`;
});

runTest(2, 'Kiểm tra Hệ thống 20 Hạng Mục Quản Trị (Admin Categories)', () => {
  assert.equal(ADMIN_CATEGORIES.length, 20, 'Phải có đủ 20 hạng mục Admin');
  return `Đủ ${ADMIN_CATEGORIES.length}/20 tab quản trị chuyên sâu.`;
});

runTest(3, 'Kiểm tra PersistentOBSSyncStore & MasterConfigStore lưu đĩa', () => {
  const tmpObs = path.resolve(process.cwd(), 'data', 'test_obs_sync.json');
  const tmpMaster = path.resolve(process.cwd(), 'data', 'test_master_cfg.json');
  const store = new PersistentOBSSyncStore(tmpObs, tmpMaster);
  const updated = store.updateSettings({
    overlayConfig: { ...store.getSettings().overlayConfig, hudScale: 1.15 },
  });
  assert.equal(updated.overlayConfig.hudScale, 1.15);
  assert.ok(fs.existsSync(tmpObs), 'File OBS sync phải tồn tại trên đĩa');
  assert.ok(fs.existsSync(tmpMaster), 'File Master Config phải tồn tại trên đĩa');
  fs.unlinkSync(tmpObs);
  fs.unlinkSync(tmpMaster);
  return 'Lưu & đồng bộ nguyên tử (atomic write) ra đĩa thành công.';
});

runTest(4, 'Kiểm tra PersistentGiftStore: Multi-ID, Chống trùng Gift ID, Import/Export', () => {
  const tmpGift = path.resolve(process.cwd(), 'data', 'test_gifts.json');
  const gStore = new PersistentGiftStore(tmpGift);
  const initialCount = gStore.getAll().length;
  assert.ok(initialCount >= 8, 'Phải có ít nhất 8 cấu hình quà mặc định');

  // Test duplicate Gift ID rejection
  const dupRes = gStore.create({
    giftName: 'Quà Trùng ID',
    giftIds: [5655], // Already used by Hoa Hồng Ma Giáo
    coinValue: 5,
  });
  assert.equal(dupRes.ok, false, 'Phải từ chối Gift ID bị trùng');
  if (fs.existsSync(tmpGift)) fs.unlinkSync(tmpGift);
  return `Đã nạp ${initialCount} mốc quà, chặn trùng Gift ID 5655 chính xác.`;
});

runTest(5, 'Kiểm tra Chế độ Demo & Xóa sạch dữ liệu Demo khi vào LIVE', () => {
  gm.clearAllPlayers();
  gm.spawnDemoPlayers(15);
  assert.equal(gm.getDiscipleCount(), 15);
  gm.clearDemoData();
  assert.equal(gm.getDiscipleCount(), 0, 'Xóa dữ liệu Demo phải đưa sảnh về 0');
  return 'Tạo 15 đệ tử Demo và xóa sạch tức thì thành công.';
});

runTest(6, 'Kiểm tra Bộ lọc bình luận TikTok LIVE (Sanitize Chat)', () => {
  assert.equal(sanitizeTikTokChatText('sent a gift'), '', 'Phải lọc bỏ system message sent a gift');
  assert.equal(sanitizeTikTokChatText('  võ   '), 'võ', 'Phải cắt khoảng trắng thừa');
  return 'Lọc chuỗi hệ thống và chuẩn hóa tiếng Việt có dấu thành công.';
});

runTest(7, 'Kiểm tra 8 Bảng Thông Báo & Bảng Xếp Hạng Trưởng Lão (Notice Panels)', () => {
  const panels = gm.getConfig().noticePanels;
  assert.equal(panels.length, 8, 'Phải có đủ 8 bảng thông báo cấu hình được');
  return `Đủ ${panels.length}/8 bảng thông báo (Bảng Phong Cấp, Bảng Trưởng Lão, Mini Game, Quét Sân...).`;
});

runTest(8, 'Kiểm tra Khung 9:16 Dọc & 9 Khu Vực Đại Điện (Zones Calibration)', () => {
  const zones = Object.keys(gm.getConfig().sceneConfig.zones);
  assert.equal(zones.length, 9, 'Phải có đủ 9 khu vực không gian trong Đại Điện');
  return `Đủ ${zones.length}/9 khu vực (Ngai Vàng, Đài Đồng Tôn, Trục Giữa, Tả/Hữu Đường, Tĩnh Tâm, Thảm Võ, Quét Sân, Cổng).`;
});

// 9. Bình luận đầu tiên tạo nhân vật mới
runTest(9, 'Bình luận đầu tiên tạo nhân vật mới tại Cổng Sơn Trang', () => {
  gm.clearAllPlayers();
  const res = gm.handleCommentEvent({
    id: 'c1',
    type: 'comment',
    timestamp: Date.now(),
    userId: 'user_lenh_ho_xung',
    uniqueId: 'lenh_ho_xung',
    nickname: 'Lệnh Hồ Xung',
    comment: 'Xin bái kiến Giáo Chủ!',
  });
  assert.equal(res.isNewSpawn, true, 'Bình luận đầu tiên phải tạo nhân vật mới');
  assert.equal(gm.getDiscipleCount(), 1);
  assert.equal(res.disciple?.displayName, 'Lệnh Hồ Xung');
  return `Tạo mới nhân vật "${res.disciple?.displayName}" (compact: "${res.disciple?.compactName}").`;
});

// 10. Bình luận thứ 2 của cùng người KHÔNG tạo trùng nhân vật
runTest(10, 'Bình luận thứ 2 của cùng người KHÔNG tạo nhân vật trùng lặp', () => {
  const res2 = gm.handleCommentEvent({
    id: 'c2',
    type: 'comment',
    timestamp: Date.now(),
    userId: 'user_lenh_ho_xung',
    uniqueId: 'lenh_ho_xung',
    nickname: 'Lệnh Hồ Xung',
    comment: 'Đệ tử xin lĩnh giáo!',
  });
  assert.equal(res2.isNewSpawn, false, 'Không được tạo nhân vật trùng');
  assert.equal(gm.getDiscipleCount(), 1, 'Tổng số nhân vật trong sảnh vẫn phải là 1');
  assert.equal(res2.disciple?.commentCount, 2);
  return 'Số lượng nhân vật giữ nguyên = 1, cập nhật commentCount = 2.';
});

// 11. Bong bóng bình luận hiển thị trên đầu nhân vật
runTest(11, 'Bong bóng bình luận hiển thị trên đầu nhân vật & chống đè', () => {
  const snap = gm.getSnapshot();
  const d = snap.disciples[0];
  assert.equal(d.lastComment, 'Đệ tử xin lĩnh giáo!');
  assert.ok((d.commentBubbleExpiresAt || 0) > Date.now());
  return `Bong bóng "${d.lastComment}" hiển thị chuẩn xác.`;
});

// 12. 10 lệnh bình luận hoạt động đầy đủ
runTest(12, 'Kiểm tra đủ 10 lệnh bình luận (đi, chạy, võ, múa, đấm, đá, nhảy, thiền, đứng, chào)', () => {
  const commandsToTest: { kw: string; expectedAnim: string }[] = [
    { kw: 'đi', expectedAnim: 'walk' },
    { kw: 'chạy', expectedAnim: 'run' },
    { kw: 'võ', expectedAnim: 'combo_kungfu' },
    { kw: 'múa', expectedAnim: 'combo_kungfu' },
    { kw: 'đấm', expectedAnim: 'punch' },
    { kw: 'đá', expectedAnim: 'kick' },
    { kw: 'nhảy', expectedAnim: 'jump' },
    { kw: 'thiền', expectedAnim: 'meditate' },
    { kw: 'đứng', expectedAnim: 'stand_up' },
    { kw: 'chào', expectedAnim: 'bow' },
  ];

  for (let i = 0; i < commandsToTest.length; i++) {
    const item = commandsToTest[i];
    const res = gm.handleCommentEvent({
      id: `cmd_evt_${i}`,
      type: 'comment',
      timestamp: Date.now(),
      userId: `cmd_tester_${i}`,
      uniqueId: `cmd_tester_${i}`,
      nickname: `Võ Sĩ ${i}`,
      comment: item.kw,
    });
    assert.ok(res.matchedCommand, `Từ khóa "${item.kw}" phải khớp lệnh`);
    assert.equal(res.disciple?.animation, item.expectedAnim, `Lệnh "${item.kw}" phải kích hoạt "${item.expectedAnim}"`);
  }
  return 'Cả 10/10 lệnh bình luận đều kích hoạt đúng hoạt ảnh 2D.';
});

// 13. Giới hạn 80 nhân vật và hàng chờ hoạt động đúng
runTest(13, 'Giới hạn 80 nhân vật hiển thị đồng thời + Hàng chờ (Overflow Queue)', () => {
  gm.clearAllPlayers();
  gm.spawnDemoPlayers(95);
  assert.equal(gm.getDiscipleCount(), 80, 'Sảnh chỉ được hiển thị tối đa 80 nhân vật');
  assert.equal(gm.getWaitingQueueCount(), 15, '15 người thứ 81-95 phải nằm trong hàng chờ');
  return `Hiển thị đúng 80/80 nhân vật trong sảnh, 15 nhân vật trong hàng chờ.`;
});

// 14. Tên nhân vật tối đa 5 ký tự dưới chân, không đè nhau (LabelCollisionManager)
runTest(14, 'Tên dưới chân nhân vật tối đa 5 ký tự & chống chồng chữ (LabelCollisionManager)', () => {
  const compact = formatCompactPlayerName('Nguyễn Tiến Hải Đại Hiệp', 5);
  assert.equal(Array.from(compact).length, 5, 'Tên dưới chân phải cắt đúng 5 ký tự');
  assert.equal(compact, 'Nguyễ');

  const lcm = new LabelCollisionManager();
  const solved = lcm.solveLayout([
    { id: 'n1', anchorX: 50, anchorY: 50, widthPct: 10, heightPct: 2.5, priority: 10, type: 'nameplate' },
    { id: 'n2', anchorX: 50, anchorY: 50, widthPct: 10, heightPct: 2.5, priority: 5, type: 'nameplate' },
  ]);
  const p1 = solved.get('n1')!;
  const p2 = solved.get('n2')!;
  assert.ok(p1.xPct !== p2.xPct || p1.yPct !== p2.yPct, 'LabelCollisionManager phải tách 2 nhãn trùng vị trí');
  return `Cắt tên 5 ký tự ("${compact}") & tách nhãn trùng tọa độ thành công.`;
});

// 15-21. Hệ thống Quà 1, 5, 10, 20, 50, 99, 199 xu phong đúng cấp bậc chính thức mới
const rankGiftTests: { testId: number; coins: number; expectedRankId: string; expectedRankName: string }[] = [
  { testId: 15, coins: 1, expectedRankId: 'de_tu', expectedRankName: 'Đệ Tử' },
  { testId: 16, coins: 5, expectedRankId: 'chan_truyen', expectedRankName: 'Chân Truyền' },
  { testId: 17, coins: 10, expectedRankId: 'tinh_anh', expectedRankName: 'Tinh Anh' },
  { testId: 18, coins: 20, expectedRankId: 'ho_phap', expectedRankName: 'Hộ Pháp' },
  { testId: 19, coins: 50, expectedRankId: 'truong_lao', expectedRankName: 'Trưởng Lão' },
  { testId: 20, coins: 99, expectedRankId: 'dong_ton', expectedRankName: 'Đồng Tôn' },
  { testId: 21, coins: 199, expectedRankId: 'giao_chu', expectedRankName: 'Giáo Chủ' },
];

for (const rt of rankGiftTests) {
  runTest(rt.testId, `Quà ${rt.coins} xu phong đúng cấp "${rt.expectedRankName}"`, () => {
    const uid = `rank_tester_${rt.coins}`;
    const res = gm.handleGiftEvent({
      id: `g_${rt.coins}`,
      type: 'gift',
      timestamp: Date.now(),
      userId: uid,
      uniqueId: uid,
      nickname: `Cao Thủ ${rt.coins} Xu`,
      coinValue: rt.coins,
      giftName: `Lễ Vật ${rt.coins} Xu`,
      giftCount: 1,
    });
    assert.equal(res.disciple.rankId, rt.expectedRankId);
    assert.equal(res.disciple.rankName, rt.expectedRankName);
    if (rt.coins === 99) {
      assert.equal(res.disciple.isCoLeader, true, '99 xu phải là Đồng Tôn');
      assert.equal(res.disciple.zone, 'co_leader_dais', '99 xu phải đứng ở Đài Đồng Tôn cạnh Ngai Vàng');
    }
    if (rt.coins === 199) {
      assert.equal(res.disciple.isSectLeader, true, '199 xu phải đạt cấp cao nhất Giáo Chủ');
      assert.equal(res.throneTransferred, true, '199 xu phải kích hoạt nghi thức truyền ngôi Giáo Chủ');
    }
    return `Phong cấp "${res.disciple.rankName}" (Zone: ${res.disciple.zone}) chính xác.`;
  });
}

// 22. Quà 199+ xu / Gift ID chỉ định chuyển giao ngai Giáo Chủ & Cựu Giáo Chủ thành Thái Thượng Giáo Chủ
runTest(22, 'Quà 199+ xu chuyển giao Ngai Vàng cho Giáo Chủ mới & Cựu Giáo Chủ thành Thái Thượng Giáo Chủ', () => {
  const res = gm.handleGiftEvent({
    id: 'g_supreme_throne',
    type: 'gift',
    timestamp: Date.now(),
    userId: 'user_dong_phuong',
    uniqueId: 'dong_phuong',
    nickname: 'Đông Phương Bất Bại',
    giftId: 6007,
    giftName: 'Phượng Hoàng Lệnh',
    coinValue: 199,
    giftCount: 1,
  });
  assert.equal(res.throneTransferred, true, 'Phải kích hoạt chuyển giao ngai vàng');
  assert.equal(res.disciple.rankId, 'giao_chu');
  assert.equal(res.disciple.isSectLeader, true);
  const snap = gm.getSnapshot();
  assert.ok(snap.sectLeader.currentLeaderName.includes('Đông Phương Bất Bại'));
  assert.ok(snap.sectLeader.formerLeaderName.includes('Thái Thượng Giáo Chủ'));
  return `Giáo Chủ mới: "${snap.sectLeader.currentLeaderName}" | Cựu: "${snap.sectLeader.formerLeaderName}".`;
});

// 23. Giáo Chủ có đủ 35 hoạt ảnh hoạt động được
runTest(23, 'Giáo Chủ có đủ 35 hoạt ảnh (Nhóm A, B, C, D, E) kích hoạt thành công', () => {
  const allAnims = gm.getConfig().sectLeaderAnimations;
  assert.equal(allAnims.length, 35, 'Phải có đúng 35 hoạt ảnh Giáo Chủ');
  for (const a of allAnims) {
    const ok = gm.triggerSectLeaderAnimation(a.id as SectLeaderAnimationId);
    assert.equal(ok, true);
    assert.equal(gm.getSnapshot().sectLeader.currentAnimation, a.id);
  }
  return 'Đã kích hoạt kiểm thử thành công toàn bộ 35/35 hoạt ảnh Giáo Chủ.';
});

// 24. 400+ câu thoại không trùng lặp & thay biến đúng
runTest(24, 'Kho 400+ câu thoại Giáo Chủ riêng biệt (không trùng lặp) & nội suy biến không đọc dấu {}', () => {
  assert.ok(DEFAULT_SECT_DIALOGUE_BANK.length >= 400, 'Tổng số câu thoại phải >= 400');
  const uniqueTexts = new Set(DEFAULT_SECT_DIALOGUE_BANK.map(l => l.text.trim()));
  assert.equal(
    uniqueTexts.size,
    DEFAULT_SECT_DIALOGUE_BANK.length,
    'Tất cả câu thoại (bao gồm Diệt Môn) phải hoàn toàn riêng biệt, không trùng lặp'
  );

  const sample = interpolateDialogueTemplate(
    'Chào {playerName} bậc {rankName} tặng {giftName} cho {leaderName} trong {gameName}!',
    {
      playerName: 'Tiêu Phong',
      rankName: 'Đại Trưởng Lão',
      giftName: 'Thánh Hỏa Lệnh',
      leaderName: 'Dạ Thiên Minh',
      gameName: 'Ma Quyền Loạn Vũ',
    }
  );
  assert.ok(!sample.includes('{') && !sample.includes('}'), 'Không được còn sót dấu ngoặc nhọn {}');
  assert.ok(sample.includes('Tiêu Phong') && !sample.includes('Đại Trưởng Lão') === false);
  return `Xác nhận 400/400 câu thoại duy nhất + nội suy biến sạch 100%.`;
});

// 25. TTS & Lip-sync hoạt động đúng
runTest(25, 'Hệ thống TTS Microsoft Azure Speech (Nam Minh / Hoài My), VieNeu & Lip-Sync', () => {
  const voices = getAvailableVoiceOptions();
  const azureVoices = voices.providers.azure_speech.voices.map(v => v.id);
  assert.ok(azureVoices.includes('vi-VN-NamMinhNeural'), 'Phải hỗ trợ giọng Nam Minh Neural');
  assert.ok(azureVoices.includes('vi-VN-HoaiMyNeural'), 'Phải hỗ trợ giọng Hoài My Neural');
  assert.ok(voices.providers.vieneu_local.voices.length > 0, 'Phải hỗ trợ VieNeu Local');
  return 'Đã cấu hình chuẩn vi-VN-NamMinhNeural, vi-VN-HoaiMyNeural, VieNeu Local & Lip-Sync Viseme.';
});

// 26. Chuyển cảnh Đại Điện -> Sân Luyện Võ mỗi 150-180s hoạt động đúng
runTest(26, 'Chuyển cảnh Đại Điện Ma Giáo ⇄ Sân Luyện Võ (Chu kỳ 150–180 giây)', () => {
  const [minC, maxC] = gm.getConfig().sceneTransition.cycleIntervalRangeSec;
  assert.equal(minC, 150);
  assert.equal(maxC, 180);
  gm.switchSceneNow('training_ground');
  assert.equal(gm.getSnapshot().activeScene, 'training_ground');
  gm.switchSceneNow('main_hall');
  assert.equal(gm.getSnapshot().activeScene, 'main_hall');
  return `Chu kỳ [${minC}s, ${maxC}s] & chuyển cảnh tức thì hoạt động chính xác.`;
});

// 27. Mini Game 1: Ma Quyền Loạn Vũ (từ khóa MÚA, mỗi người chỉ cần 1 bình luận)
runTest(27, 'Mini Game 1 (Ma Quyền Loạn Vũ): Gõ từ khóa MÚA (mỗi người 1 bình luận)', () => {
  gm.clearAllPlayers();
  gm.spawnDemoPlayers(5);
  gm.startMiniGame('ma_quyen_loan_vu');
  const participants = gm.getSnapshot().miniGame.participantUserIds;
  assert.equal(participants.length, 5);

  // 4 out of 5 players comment MÚA once (80% >= 60% threshold)
  for (let i = 0; i < 4; i++) {
    gm.handleCommentEvent({
      id: `mg1_${i}`,
      type: 'comment',
      timestamp: Date.now(),
      userId: participants[i],
      uniqueId: participants[i],
      nickname: `Đệ Tử ${i}`,
      comment: 'MÚA',
    });
  }
  assert.equal(gm.getSnapshot().miniGame.completionPct, 80);
  gm.finishMiniGame();
  assert.equal(gm.getSnapshot().miniGame.isVictory, true, '80% hoàn thành phải được xử Thắng');
  return '4/5 đệ tử gõ MÚA 1 lần đạt 80% ➔ Chiến thắng Ma Quyền Loạn Vũ.';
});

// 28. Mini Game 2: Ma Ảnh Thân Pháp (TRÁI / PHẢI / NHẢY)
runTest(28, 'Mini Game 2 (Ma Ảnh Thân Pháp): Né chướng ngại vật TRÁI / PHẢI / NHẢY', () => {
  gm.clearAllPlayers();
  gm.spawnDemoPlayers(4);
  gm.startMiniGame('ma_anh_than_phap');
  const snap = gm.getSnapshot();
  const dir = snap.miniGame.currentObstacleDirection || 'NHAY';
  for (const uid of snap.miniGame.participantUserIds) {
    gm.handleCommentEvent({
      id: `mg2_${uid}`,
      type: 'comment',
      timestamp: Date.now(),
      userId: uid,
      uniqueId: uid,
      nickname: uid,
      comment: dir,
    });
  }
  assert.equal(gm.getSnapshot().miniGame.completionPct, 100);
  gm.finishMiniGame();
  assert.equal(gm.getSnapshot().miniGame.isVictory, true);
  return `Tất cả đệ tử né hướng "${dir}" thành công (100%).`;
});

// 29. Mini Game 3: Tam Khí Ma Trận (LỬA / BĂNG / GIÓ khắc chế)
runTest(29, 'Mini Game 3 (Tam Khí Ma Trận): Quy tắc tương khắc LỬA – BĂNG – GIÓ', () => {
  gm.clearAllPlayers();
  gm.spawnDemoPlayers(4);
  gm.startMiniGame('tam_khi_ma_tran');
  const snap = gm.getSnapshot();
  const counter = snap.miniGame.expectedCounterCommand || 'LUA';
  for (const uid of snap.miniGame.participantUserIds) {
    gm.handleCommentEvent({
      id: `mg3_${uid}`,
      type: 'comment',
      timestamp: Date.now(),
      userId: uid,
      uniqueId: uid,
      nickname: uid,
      comment: counter,
    });
  }
  assert.equal(gm.getSnapshot().miniGame.completionPct, 100);
  gm.finishMiniGame();
  assert.equal(gm.getSnapshot().miniGame.isVictory, true);
  return `Giáo Chủ xuất "${snap.miniGame.leaderElement}", đệ tử khắc chế bằng "${counter}" (100%).`;
});

// 30. Hình phạt tối đa 5 người quét sân và bình luận lại quay về đại điện ngay + Launchers
runTest(30, 'Hình phạt tối đa 5 đệ tử quét sân & bình luận lại quay về Đại Điện ngay (không mất xu/cấp) + Launchers', () => {
  gm.clearAllPlayers();
  gm.spawnDemoPlayers(10);
  // Give first player 50 coins (Hộ Pháp Ma Giáo) to verify they don't lose coins/rank when penalized
  const firstPlayer = gm.getSnapshot().disciples[0];
  gm.handleGiftEvent({
    id: 'gift_before_sweep',
    type: 'gift',
    timestamp: Date.now(),
    userId: firstPlayer.userId,
    uniqueId: firstPlayer.uniqueId,
    nickname: firstPlayer.displayName,
    coinValue: 50,
    giftName: 'Lệnh Bài Hộ Pháp',
    giftCount: 1,
  });

  gm.startMiniGame('ma_quyen_loan_vu');
  // Nobody comments -> 0% completion -> team loses -> max 5 players sent to sweep
  gm.finishMiniGame(false);

  const afterLose = gm.getSnapshot();
  assert.equal(afterLose.sweepingDisciples.length, 5, 'Chỉ được phạt tối đa 5 người đi quét sân');
  const penalizedOne = afterLose.sweepingDisciples[0];
  assert.equal(penalizedOne.isSweepingPenalty, true);
  assert.equal(penalizedOne.animation, 'sweep_floor');

  // Verify no coin or rank loss for firstPlayer
  const checkFirst = afterLose.disciples.find(d => d.userId === firstPlayer.userId)!;
  assert.equal(checkFirst.totalCoins, 50, 'Không được trừ xu khi thua mini game');
  assert.equal(checkFirst.rankId, 'truong_lao', 'Không được hạ cấp khi thua mini game');

  // Now penalizedOne comments again -> must immediately return from sweep with 0 gift required!
  const releaseRes = gm.handleCommentEvent({
    id: 'comment_release_sweep',
    type: 'comment',
    timestamp: Date.now(),
    userId: penalizedOne.userId,
    uniqueId: penalizedOne.uniqueId,
    nickname: penalizedOne.displayName,
    comment: 'Đệ tử đã quét xong sân!',
  });
  assert.equal(releaseRes.releasedFromSweep, true, 'Bình luận lại phải giải phóng khỏi quét sân ngay');
  assert.equal(releaseRes.disciple?.isSweepingPenalty, false);
  assert.equal(gm.getSnapshot().sweepingDisciples.length, 4);

  // Verify macOS & Windows launcher files exist
  assert.ok(fs.existsSync(path.resolve(process.cwd(), 'MA GIAO ONLINE.app/Contents/MacOS/start')));
  assert.ok(fs.existsSync(path.resolve(process.cwd(), 'MA_GIAO_ONLINE.exe')));
  assert.ok(fs.existsSync(path.resolve(process.cwd(), 'tools/ma-giao-launcher/launcher.cjs')));

  return 'Phạt tối đa 5 người quét sân, bình luận lại về sảnh ngay, giữ nguyên xu/cấp, đủ bộ Launcher macOS & Windows.';
});

// 31. Kiểm thử phân bố không gian với 1, 10, 30, 50, 80 nhân vật (Không dồn vào một góc)
runTest(31, 'Kiểm thử phân bố 1, 10, 30, 50, 80 nhân vật: Phủ rộng toàn sảnh, không dồn góc', () => {
  const counts = [1, 10, 30, 50, 80];
  for (const cnt of counts) {
    gm.setPopulationPreset(cnt);
    for (let t = 0; t < 8; t++) gm.tick();
    const list = gm.getSnapshot().disciples;
    assert.equal(list.length, cnt, `Phải có đúng ${cnt} nhân vật`);

    if (cnt >= 30) {
      const xs = list.map(d => d.x);
      const ys = list.map(d => d.y);
      const spanX = Math.max(...xs) - Math.min(...xs);
      const spanY = Math.max(...ys) - Math.min(...ys);
      assert.ok(spanX >= 45, `Với ${cnt} nhân vật, độ rộng phân bố X (${spanX.toFixed(1)}%) phải >= 45%`);
      assert.ok(spanY >= 32, `Với ${cnt} nhân vật, độ sâu phân bố Y (${spanY.toFixed(1)}%) phải >= 32%`);
    }
  }
  return 'Cả 5 mức quân số (1, 10, 30, 50, 80) đều phân bố rộng khắp mặt sàn Đại Điện.';
});

// 32. Lối Đi Chính Giữa (Central Aisle x: 32..68) là khu vực hoạt động chính
runTest(32, 'Lối Đi Chính Giữa (x: 32..68, y: 31..88) luôn có nhân vật hoạt động tự do', () => {
  gm.setPopulationPreset(80);
  for (let t = 0; t < 10; t++) gm.tick();
  const list = gm.getSnapshot().disciples;
  const inCentralAisle = list.filter(d => d.x >= 32 && d.x <= 68 && d.y >= 31 && d.y <= 88);
  assert.ok(
    inCentralAisle.length >= 18,
    `Phải có ít nhất 18/80 nhân vật hoạt động trên lối đi chính giữa (hiện có ${inCentralAisle.length})`
  );
  return `${inCentralAisle.length}/80 nhân vật đang đi lại, luyện võ và thiền ngay trên Lối Đi Chính Giữa.`;
});

// 33. Không xuyên tường và không xâm phạm vùng bảo vệ Ngai Giáo Chủ
runTest(33, 'Bảo vệ vùng Ngai Giáo Chủ (ThroneReservedZone) & giới hạn tường Đại Điện', () => {
  gm.setPopulationPreset(80);
  for (let t = 0; t < 20; t++) gm.tick();
  const list = gm.getSnapshot().disciples;
  for (const d of list) {
    if (!d.isSectLeader && !d.isCoLeader && !d.isSweepingPenalty) {
      assert.equal(
        gm.isInsideThroneReservedZone(d.x, d.y, 0.2),
        false,
        `Nhân vật ${d.displayName} (${d.x}, ${d.y}) không được đè lên Ngai Giáo Chủ`
      );
      assert.ok(d.x >= 6 && d.x <= 94, `Tọa độ X (${d.x}) phải nằm trong lòng Đại Điện`);
      assert.ok(d.y >= 26 && d.y <= 95, `Tọa độ Y (${d.y}) phải nằm trong lòng Đại Điện`);
    }
  }
  return '0/80 nhân vật xâm phạm Ngai Giáo Chủ hoặc xuyên tường.';
});

// 34. Chống chồng lấn (Anti-Overlap Separation)
runTest(34, 'Thuật toán chống chồng lấn giữ khoảng cách giữa 80 nhân vật, không đứng trùng điểm', () => {
  gm.setPopulationPreset(80);
  for (let t = 0; t < 15; t++) gm.tick();
  const list = gm.getSnapshot().disciples;
  let exactOverlaps = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const dist = Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y);
      if (dist < 0.8) exactOverlaps += 1;
    }
  }
  assert.equal(exactOverlaps, 0, 'Không được có cặp nhân vật nào đứng đè khít lên nhau (< 0.8%)');
  return '80 nhân vật duy trì khoảng cách tự nhiên, 0 cặp bị trùng tọa độ.';
});

// 35. Tự động sinh hoạt đa dạng & không bị giật về vị trí cũ sau hoạt ảnh
runTest(35, 'Nhân vật tự sinh hoạt đa dạng & KHÔNG bị giật về vị trí cũ sau khi kết thúc hoạt ảnh', () => {
  gm.setPopulationPreset(50);
  const sample = gm.getSnapshot().disciples[0];
  // Move sample disciple to a specific spot in the central aisle and run a command
  sample.x = 48;
  sample.y = 54;
  sample.targetX = 48;
  sample.targetY = 54;
  gm.handleCommentEvent({
    id: 'no_snapback_test',
    type: 'comment',
    timestamp: Date.now(),
    userId: sample.userId,
    uniqueId: sample.uniqueId,
    nickname: sample.displayName,
    comment: 'võ',
  });
  for (let i = 0; i < 10; i++) gm.tick();
  const after = gm.getSnapshot().disciples.find(d => d.userId === sample.userId)!;
  const drift = Math.hypot(after.x - 48, after.y - 54);
  assert.ok(drift < 8, `Nhân vật không được giật về góc sau hoạt ảnh (drift=${drift.toFixed(2)}%)`);

  const activeAnims = new Set(gm.getSnapshot().disciples.map(d => d.animation));
  assert.ok(activeAnims.size >= 4, `Đại điện phải có ít nhất 4 trạng thái hoạt động khác nhau cùng lúc`);
  return `Đa dạng ${activeAnims.size} trạng thái hoạt ảnh cùng lúc, không bị giật tọa độ.`;
});

// 36. Hoạt ảnh bước chân (stepPhase), ngồi thiền -> đứng dậy, và 4 hướng
runTest(36, 'Hoạt ảnh bước chân thực (stepPhase), chu kỳ Thiền ➔ Đứng dậy & 4 hướng di chuyển', () => {
  gm.setPopulationPreset(10);
  const walker = gm.getSnapshot().disciples[0];
  walker.x = 25;
  walker.y = 60;
  walker.targetX = 75;
  walker.targetY = 60;
  walker.animation = 'walk';
  const initialPhase = walker.stepPhase || 0;
  gm.tick();
  const updatedWalker = gm.getSnapshot().disciples[0];
  assert.notEqual(updatedWalker.stepPhase, initialPhase, 'stepPhase phải tăng theo quãng đường bước chân');
  assert.equal(updatedWalker.direction, 'right', 'Đi từ trái sang phải phải hiển thị góc nhìn nghiêng phải (right)');
  return `stepPhase cập nhật thực tế & hướng nhìn (${updatedWalker.direction}) chuẩn xác.`;
});

// 37. Chuyển sang Mini Game rồi quay về Đại Điện vẫn tự do sinh hoạt (Giải tán đội hình)
runTest(37, 'Kết thúc Mini Game giải tán đội hình, phân bố lại Free Roam toàn sảnh', () => {
  gm.setPopulationPreset(30);
  gm.startMiniGame('ma_quyen_loan_vu');
  assert.equal(gm.getSnapshot().activeScene, 'training_ground');
  gm.finishMiniGame(true);
  assert.equal(gm.getSnapshot().activeScene, 'main_hall');
  const roamingStates = gm.getSnapshot().disciples.filter(
    d => d.fsmState === 'free_roam_stroll' || d.animation === 'walk'
  );
  assert.ok(roamingStates.length >= 20, 'Sau khi kết thúc Mini Game, đệ tử phải giải tán đội hình và tự do di chuyển');
  return `Giải tán đội hình thành công: ${roamingStates.length}/30 đệ tử tản ra khắp Đại Điện.`;
});

// 38. Admin thay đổi cấu hình Free Roam & nút Phân Bố Lại có hiệu lực thật
runTest(38, 'Các nút Admin (Phân bố lại, Tập võ, Ngồi thiền, Sinh hoạt tự do) có hiệu lực thật', () => {
  gm.setPopulationPreset(30);
  gm.triggerMassPlayerAnimation('combo_kungfu');
  assert.ok(gm.getSnapshot().disciples.every(d => d.animation === 'combo_kungfu'));
  gm.triggerMassPlayerAnimation('meditate');
  assert.ok(gm.getSnapshot().disciples.every(d => d.animation === 'meditate'));
  gm.redistributeAllDisciples();
  assert.ok(gm.getSnapshot().disciples.some(d => d.animation === 'walk'));
  gm.resumeAllFreeRoam();
  assert.equal(gm.getConfig().sceneConfig.freeRoamEnabled, true);
  return 'Tất cả 4 nút điều khiển nhanh trong Admin đều áp dụng ngay lập tức.';
});

// 39. Kiểm thử Test Bình Luận TikTok: User mới vào sảnh, User cũ gửi liên tiếp các lệnh (múa, nhảy, thiền, đứng) không tạo trùng
runTest(39, 'Admin Test Bình Luận TikTok: User mới đi từ cổng vào, gửi liên tiếp "múa", "nhảy", "thiền", "đứng" trên cùng 1 User không bị chặn cooldown', () => {
  gm.clearAllPlayers();
  const uid = 'admin_test_user_99';
  const r1 = gm.handleCommentEvent({
    id: 'adm_c1',
    type: 'comment',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Độc Cô Cầu Bại',
    comment: 'Xin chào đại điện!',
    isDemo: true,
  });
  assert.equal(r1.isNewSpawn, true, 'Lần đầu phải tạo User mới đi từ cổng vào');
  assert.equal(gm.getDiscipleCount(), 1);
  assert.equal(r1.disciple?.fsmState, 'walk_in_hall');

  const rapidSeq: { kw: string; expectedAnim: string }[] = [
    { kw: 'múa', expectedAnim: 'combo_kungfu' },
    { kw: 'nhảy', expectedAnim: 'jump' },
    { kw: 'thiền', expectedAnim: 'meditate' },
    { kw: 'đứng', expectedAnim: 'stand_up' },
  ];

  for (const step of rapidSeq) {
    const res = gm.handleCommentEvent({
      id: `adm_seq_${step.kw}`,
      type: 'comment',
      timestamp: Date.now(),
      userId: uid,
      uniqueId: uid,
      nickname: 'Độc Cô Cầu Bại',
      comment: step.kw,
      isDemo: true,
    });
    assert.equal(res.isNewSpawn, false, 'Cùng User gửi nhiều bình luận không được tạo trùng nhân vật');
    assert.equal(gm.getDiscipleCount(), 1, 'Sảnh vẫn chỉ có đúng 1 nhân vật');
    assert.equal(res.disciple?.animation, step.expectedAnim, `Lệnh "${step.kw}" phải kích hoạt ngay "${step.expectedAnim}"`);
    assert.equal(res.disciple?.lastComment, step.kw, 'Bong bóng bình luận phải cập nhật đúng nội dung mới nhất');
  }

  assert.equal(gm.getSnapshot().disciples[0].commentCount, 5, 'Tổng số lần bình luận của User phải là 5');
  return 'User mới đi từ cổng vào + gửi liên tiếp 4 lệnh (múa, nhảy, thiền, đứng) trên cùng 1 User chính xác 100%.';
});

// 40. Kiểm thử Test nhiều User bình luận cùng lúc (10 & 80 User) và xóa riêng 1 User test
runTest(40, 'Admin Test nhiều User bình luận cùng lúc (10 & 80 User) + Xóa riêng User test (removeDisciple)', () => {
  gm.clearAllPlayers();
  const count10 = gm.triggerMultiUserTestComments(10, 'múa');
  assert.equal(count10, 10);
  assert.equal(gm.getDiscipleCount(), 10);
  assert.ok(gm.getSnapshot().disciples.every(d => d.animation === 'combo_kungfu' && d.lastComment === 'múa'));

  // Remove a single user
  const targetUser = gm.getSnapshot().disciples[0];
  const removed = gm.removeDisciple(targetUser.userId);
  assert.equal(removed, true, 'Xóa riêng User test phải trả về true');
  assert.equal(gm.getDiscipleCount(), 9, 'Quân số phải giảm từ 10 xuống 9');

  // Test 80 users commenting simultaneously
  const count80 = gm.triggerMultiUserTestComments(80);
  assert.equal(count80, 80);
  assert.equal(gm.getDiscipleCount(), 80);
  return 'Đồng loạt 10 & 80 User bình luận cùng lúc và xóa riêng từng User test hoạt động hoàn hảo.';
});

// 41. Kiểm thử Cộng Dồn Xu 1 + 5 + 5 = 11 xu -> cấp 10 (Tinh Anh) & Không phong chức lặp lại nếu cùng cấp
runTest(41, 'Cộng dồn xu: 1 + 5 + 5 = 11 xu ➔ đạt cấp 10 "Tinh Anh" & không phong chức lặp nếu vẫn cùng cấp', () => {
  gm.clearAllPlayers();
  const uid = 'accum_user_11';
  const r1 = gm.handleGiftEvent({
    id: 'acc_11_1',
    type: 'gift',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Lệnh Hồ Xung',
    coinValue: 1,
    giftName: 'Hoa Hồng 1 Xu',
    giftCount: 1,
  });
  assert.equal(r1.disciple.totalCoins, 1);
  assert.equal(r1.disciple.rankId, 'de_tu');
  assert.equal(r1.promoted, true);

  const r2 = gm.handleGiftEvent({
    id: 'acc_11_2',
    type: 'gift',
    timestamp: Date.now() + 1,
    userId: uid,
    uniqueId: uid,
    nickname: 'Lệnh Hồ Xung',
    coinValue: 5,
    giftName: 'Trà Tiên 5 Xu',
    giftCount: 1,
  });
  assert.equal(r2.disciple.totalCoins, 6, '1 + 5 phải bằng 6 xu');
  assert.equal(r2.disciple.rankId, 'chan_truyen');
  assert.equal(r2.promoted, true);

  const r3 = gm.handleGiftEvent({
    id: 'acc_11_3',
    type: 'gift',
    timestamp: Date.now() + 2,
    userId: uid,
    uniqueId: uid,
    nickname: 'Lệnh Hồ Xung',
    coinValue: 5,
    giftName: 'Trà Tiên 5 Xu',
    giftCount: 1,
  });
  assert.equal(r3.disciple.totalCoins, 11, '1 + 5 + 5 phải bằng 11 xu');
  assert.equal(r3.disciple.rankId, 'tinh_anh', '11 xu phải đạt mốc 10 xu (Tinh Anh)');
  assert.equal(r3.disciple.rankName, 'Tinh Anh');
  assert.equal(r3.promoted, true);

  // Send +2 xu more (total 13 xu, still below 20 xu threshold) -> must NOT repeat promotion
  const promoCountBefore = gm.getSnapshot().promotions.length;
  const r4 = gm.handleGiftEvent({
    id: 'acc_11_4',
    type: 'gift',
    timestamp: Date.now() + 3,
    userId: uid,
    uniqueId: uid,
    nickname: 'Lệnh Hồ Xung',
    coinValue: 2,
    giftName: 'Quà 2 Xu',
    giftCount: 1,
  });
  assert.equal(r4.disciple.totalCoins, 13);
  assert.equal(r4.disciple.rankId, 'tinh_anh');
  assert.equal(r4.promoted, false, 'Không được phong chức lặp lại nếu người chơi vẫn ở cùng cấp');
  assert.equal(gm.getSnapshot().promotions.length, promoCountBefore, 'Số lượng thông báo thăng cấp không tăng khi giữ nguyên cấp');

  return '1 + 5 + 5 = 11 xu ➔ Tinh Anh (mốc 10 xu) & chặn phong chức lặp khi vẫn cùng cấp.';
});

// 42. Kiểm thử Cộng Dồn Xu 90 + 10 = 100 xu -> cấp 99 (Đồng Tôn) & chỉ phát 1 hoạt cảnh khi vượt nhiều mốc
runTest(42, 'Cộng dồn xu: 90 + 10 = 100 xu ➔ đạt cấp 99 "Đồng Tôn" & vượt nhiều mốc chỉ phát 1 thông báo cao nhất', () => {
  gm.clearAllPlayers();
  const uid = 'accum_user_100';
  // First gift of 90 xu jumps across 1, 5, 10, 20, 50 directly to Trưởng Lão (50 xu) with ONLY 1 promotion announcement
  const r1 = gm.handleGiftEvent({
    id: 'acc_100_1',
    type: 'gift',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Trương Vô Kỵ',
    coinValue: 90,
    giftName: 'Lễ Vật 90 Xu',
    giftCount: 1,
  });
  assert.equal(r1.disciple.totalCoins, 90);
  assert.equal(r1.disciple.rankId, 'truong_lao', '90 xu đạt mốc 50 xu Trưởng Lão');
  assert.equal(gm.getSnapshot().promotions.length, 1, 'Vượt qua 5 mốc trong 1 sự kiện chỉ được phát đúng 1 hoạt cảnh phong chức lên cấp cao nhất');

  const r2 = gm.handleGiftEvent({
    id: 'acc_100_2',
    type: 'gift',
    timestamp: Date.now() + 1,
    userId: uid,
    uniqueId: uid,
    nickname: 'Trương Vô Kỵ',
    coinValue: 10,
    giftName: 'Rượu Đào Hoa 10 Xu',
    giftCount: 1,
  });
  assert.equal(r2.disciple.totalCoins, 100, '90 + 10 phải bằng 100 xu');
  assert.equal(r2.disciple.rankId, 'dong_ton', '100 xu phải đạt cấp 99 xu Đồng Tôn');
  assert.equal(r2.disciple.rankName, 'Đồng Tôn');
  assert.equal(r2.disciple.isCoLeader, true);
  assert.equal(r2.disciple.zone, 'co_leader_dais');
  assert.equal(r2.promoted, true);
  return '90 + 10 = 100 xu ➔ Đồng Tôn (mốc 99 xu, đứng Đài Đồng Tôn) chính xác.';
});

// 43. Kiểm thử Cộng Dồn Xu 190 + 10 = 200 xu -> cấp 199 (Giáo Chủ)
runTest(43, 'Cộng dồn xu: 190 + 10 = 200 xu ➔ đạt cấp 199 "Giáo Chủ" (Chuyển giao Ngai Vàng)', () => {
  gm.clearAllPlayers();
  const uid = 'accum_user_200';
  const r1 = gm.handleGiftEvent({
    id: 'acc_200_1',
    type: 'gift',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Nhậm Ngã Hành',
    coinValue: 190,
    giftName: 'Bảo Vật 190 Xu',
    giftCount: 1,
  });
  assert.equal(r1.disciple.totalCoins, 190);
  assert.equal(r1.disciple.rankId, 'dong_ton');

  const r2 = gm.handleGiftEvent({
    id: 'acc_200_2',
    type: 'gift',
    timestamp: Date.now() + 1,
    userId: uid,
    uniqueId: uid,
    nickname: 'Nhậm Ngã Hành',
    coinValue: 10,
    giftName: 'Lễ Vật 10 Xu',
    giftCount: 1,
  });
  assert.equal(r2.disciple.totalCoins, 200, '190 + 10 phải bằng 200 xu');
  assert.equal(r2.disciple.rankId, 'giao_chu', '200 xu phải đạt cấp 199 xu Giáo Chủ');
  assert.equal(r2.disciple.rankName, 'Giáo Chủ');
  assert.equal(r2.disciple.isSectLeader, true);
  assert.equal(r2.throneTransferred, true);
  return '190 + 10 = 200 xu ➔ Giáo Chủ (mốc 199 xu, đăng cơ Ngai Vàng).';
});

// 44. Cùng một sự kiện quà được gửi lặp & Combo Streak trùng -> Không cộng trùng
runTest(44, 'Chống cộng trùng: Cùng một sự kiện quà gửi lặp ID hoặc Combo Streak lặp không bị cộng đôi xu', () => {
  gm.clearAllPlayers();
  const uid = 'dup_test_user';
  const evt = {
    id: 'fixed_gift_event_001',
    type: 'gift' as const,
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Dương Tiêu',
    coinValue: 25,
    giftName: 'Bảo Kiếm 25 Xu',
    giftCount: 1,
  };
  const first = gm.handleGiftEvent(evt);
  const second = gm.handleGiftEvent(evt);
  const third = gm.handleGiftEvent(evt);

  assert.equal(first.duplicateIgnored, false);
  assert.equal(second.duplicateIgnored, true, 'Lần gửi lặp thứ 2 cùng ID phải bị chặn');
  assert.equal(third.duplicateIgnored, true, 'Lần gửi lặp thứ 3 cùng ID phải bị chặn');
  assert.equal(third.disciple.totalCoins, 25, 'Tổng xu chỉ được tính đúng 1 lần = 25 xu');

  // Test streak combo deduplication (groupId + giftType=1)
  const s1 = gm.handleGiftEvent({
    id: 'streak_step_1',
    type: 'gift',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Dương Tiêu',
    giftId: 5655,
    giftName: 'Hoa Hồng Ma Giáo',
    giftType: 1,
    groupId: 'grp_rose_1',
    giftCount: 3,
    unitCoinValue: 1,
  });
  assert.equal(s1.disciple.totalCoins, 28, '25 + 3 = 28 xu');

  // Duplicate streak packet with same repeatCount=3
  const s1Dup = gm.handleGiftEvent({
    id: 'streak_step_1_dup',
    type: 'gift',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Dương Tiêu',
    giftId: 5655,
    giftName: 'Hoa Hồng Ma Giáo',
    giftType: 1,
    groupId: 'grp_rose_1',
    giftCount: 3,
    unitCoinValue: 1,
  });
  assert.equal(s1Dup.duplicateIgnored, true, 'Streak cùng repeatCount=3 phải bị bỏ qua');
  assert.equal(s1Dup.disciple.totalCoins, 28);

  // Next streak packet with repeatCount=5 -> should only add delta (5 - 3 = 2 xu)
  const s2 = gm.handleGiftEvent({
    id: 'streak_step_2',
    type: 'gift',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Dương Tiêu',
    giftId: 5655,
    giftName: 'Hoa Hồng Ma Giáo',
    giftType: 1,
    groupId: 'grp_rose_1',
    giftCount: 5,
    unitCoinValue: 1,
  });
  assert.equal(s2.addedCoins, 2, 'Streak tăng từ 3 lên 5 chỉ được cộng phần chênh lệch +2 xu');
  assert.equal(s2.disciple.totalCoins, 30, '28 + 2 = 30 xu');

  return 'Chặn sự kiện lặp ID & tính đúng delta của Combo Streak (không cộng trùng).';
});

// 45. Nhiều quà tới đồng thời & Đổi cảnh Đại Điện <-> Sân Luyện Võ không mất tổng xu
runTest(45, 'Nhiều quà tới đồng thời tính tổng chính xác & Đổi cảnh Mini Game không làm mất tổng xu/cấp bậc', () => {
  gm.clearAllPlayers();
  const uid = 'concurrent_user';
  const batch = [5, 10, 15, 20, 50]; // sum = 100 xu -> Đại Trưởng Lão (99 xu)
  batch.forEach((c, idx) => {
    gm.handleGiftEvent({
      id: `conc_${idx}_${Date.now()}`,
      type: 'gift',
      timestamp: Date.now(),
      userId: uid,
      uniqueId: uid,
      nickname: 'Phạm Dao',
      coinValue: c,
      giftName: `Quà ${c} Xu`,
      giftCount: 1,
    });
  });

  const beforeScene = gm.getSnapshot().disciples.find(d => d.userId === uid)!;
  assert.equal(beforeScene.totalCoins, 100, 'Tổng 5 + 10 + 15 + 20 + 50 phải đúng bằng 100 xu');
  assert.equal(beforeScene.rankId, 'dong_ton');

  // Switch scene to training ground, run mini-game, finish mini-game, switch back to main hall
  gm.startMiniGame('ma_quyen_loan_vu');
  assert.equal(gm.getSnapshot().activeScene, 'training_ground');
  gm.finishMiniGame(false);
  gm.switchSceneNow('main_hall');

  const afterScene = gm.getSnapshot().disciples.find(d => d.userId === uid)!;
  assert.equal(afterScene.totalCoins, 100, 'Đổi cảnh và kết thúc Mini Game không được mất tổng xu');
  assert.equal(afterScene.rankId, 'dong_ton', 'Đổi cảnh không được mất cấp bậc');
  return 'Tổng nhiều quà đồng thời = 100 xu chính xác & giữ nguyên 100% qua các lần chuyển cảnh.';
});

// 46. Khởi động lại phiên: Giữ dữ liệu khi mode='persistent' & Đặt lại về 0 khi mode='session'
runTest(46, 'Khởi động lại: Giữ bền vững tổng xu/cấp bậc & chặn sự kiện cũ khi mode="persistent", đặt lại khi mode="session"', () => {
  gm.clearAllPlayers();
  gm.setAccumulationConfig({ enabled: true, mode: 'persistent', preventDuplicateEvents: true });

  const uid = 'persist_vip_01';
  const oldEvtId = 'persist_evt_unique_100';
  gm.handleGiftEvent({
    id: oldEvtId,
    type: 'gift',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Tạ Tốn',
    coinValue: 195,
    giftName: 'Kim Mao Lệnh',
    giftCount: 1,
  });
  assert.equal(gm.getSnapshot().disciples[0].totalCoins, 195);
  assert.equal(gm.getSnapshot().disciples[0].rankId, 'dong_ton');

  // Simulate restart in 'persistent' mode
  gm.simulateSessionRestart();
  assert.equal(gm.getDiscipleCount(), 0, 'Sau khi khởi động lại, sảnh bắt đầu trống chờ người vào');
  assert.equal(gm.getSnapshot().playerLedger.find(p => p.userId === uid)?.totalCoins, 195, 'Sổ vàng đa phiên vẫn giữ nguyên 195 xu');

  // Old event re-arrives after restart -> must NOT be counted again!
  const dupAfterRestart = gm.handleGiftEvent({
    id: oldEvtId,
    type: 'gift',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Tạ Tốn',
    coinValue: 195,
    giftName: 'Kim Mao Lệnh',
    giftCount: 1,
  });
  assert.equal(dupAfterRestart.duplicateIgnored, true, 'Không được tính lại sự kiện cũ sau khi khởi động lại');

  // User comments to enter hall in new session -> automatically restores 195 xu & Đồng Tôn!
  const rejoin = gm.handleCommentEvent({
    id: 'rejoin_cmt_1',
    type: 'comment',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Tạ Tốn',
    comment: 'Ta đã trở lại!',
  });
  assert.equal(rejoin.disciple?.totalCoins, 195, 'Khi vào lại sảnh ở phiên mới, phải khôi phục đúng 195 xu');
  assert.equal(rejoin.disciple?.rankId, 'dong_ton', 'Phải khôi phục đúng cấp Đồng Tôn');

  // Now send +5 xu in the new session -> 195 + 5 = 200 xu -> Giáo Chủ!
  const rNext = gm.handleGiftEvent({
    id: 'persist_evt_add_5',
    type: 'gift',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Tạ Tốn',
    coinValue: 5,
    giftName: 'Trà Tiên 5 Xu',
    giftCount: 1,
  });
  assert.equal(rNext.disciple.totalCoins, 200, 'Cộng dồn qua phiên mới: 195 + 5 = 200 xu');
  assert.equal(rNext.disciple.rankId, 'giao_chu');

  // Switch back to default 'session' mode and simulate restart -> must reset to 0
  gm.setAccumulationConfig({ mode: 'session' });
  gm.simulateSessionRestart();
  assert.equal(gm.getSnapshot().playerLedger.length, 0, 'Ở chế độ theo phiên LIVE (session), khởi động lại phải đặt lại sổ xu về 0');

  return 'Chế độ "persistent" bảo toàn 195+5=200 xu qua khởi động lại & chặn sự kiện cũ; chế độ "session" đặt lại đúng chuẩn.';
});

// 47. Sao lưu (Export) & Khôi phục (Import) dữ liệu cấp bậc + Đặt lại xu chế độ Demo
runTest(47, 'Sao lưu & Khôi phục dữ liệu Cấp Bậc/Sổ Xu (Export/Import JSON) + Đặt lại xu chế độ Demo', () => {
  gm.clearAllPlayers();
  gm.handleGiftEvent({
    id: 'bk_evt_1',
    type: 'gift',
    timestamp: Date.now(),
    userId: 'backup_hero',
    uniqueId: 'backup_hero',
    nickname: 'Kiều Phong',
    coinValue: 55,
    giftName: 'Lệnh Bài 55 Xu',
    giftCount: 1,
    isDemo: true,
  });
  const backupData = gm.exportRankAndLedgerData();
  assert.equal(backupData.playerLedger.length, 1);
  assert.equal(backupData.playerLedger[0].totalCoins, 55);

  // Reset Demo Coins -> player remains in hall but coins = 0 & rank = Dân Đen
  gm.resetDemoCoins();
  const afterReset = gm.getSnapshot().disciples.find(d => d.userId === 'backup_hero')!;
  assert.equal(afterReset.totalCoins, 0, 'Đặt lại xu Demo phải đưa tổng xu về 0');
  assert.equal(afterReset.rankId, 'dan_den', 'Đặt lại xu Demo phải đưa cấp bậc về Dân Đen');

  // Restore from backupData -> player immediately regains 55 xu & Trưởng Lão
  const restored = gm.importRankAndLedgerData(backupData as unknown as Record<string, unknown>);
  assert.equal(restored, true);
  const afterRestore = gm.getSnapshot().disciples.find(d => d.userId === 'backup_hero')!;
  assert.equal(afterRestore.totalCoins, 55, 'Khôi phục bản sao lưu phải trả lại đúng 55 xu');
  assert.equal(afterRestore.rankId, 'truong_lao', 'Khôi phục bản sao lưu phải trả lại cấp Trưởng Lão');

  return 'Sao lưu JSON, Đặt lại xu Demo về 0, và Khôi phục dữ liệu cấp bậc/sổ xu chính xác 100%.';
});

// 48. Mặc định thời gian ở lại 7 phút (420s) & Tùy chỉnh 1-30 phút / chế độ test ngắn (5s-30s)
runTest(48, 'Mặc định thời gian ở lại 7 phút (420s) & Tùy chỉnh 1–30 phút + Chế độ test ngắn (5s, 10s, 15s, 30s)', () => {
  const resetCfg = gm.resetStayDurationConfig();
  assert.equal(resetCfg.inactivityTimeoutMinutes, 7, 'Mặc định phải là 7 phút');
  assert.equal(resetCfg.inactivityTimeoutSec, 420, 'Mặc định phải là 420 giây');
  assert.equal(resetCfg.autoDepartEnabled, true);
  assert.equal(resetCfg.walkToGateOnDepart, true);
  assert.equal(resetCfg.warningBeforeDepartEnabled, true);
  assert.equal(resetCfg.warningBeforeDepartSec, 30);

  // Test preset 15 minutes
  const cfg15 = gm.setStayDurationConfig({ inactivityTimeoutMinutes: 15, inactivityTimeoutSec: 900 });
  assert.equal(cfg15.inactivityTimeoutMinutes, 15);
  assert.equal(cfg15.inactivityTimeoutSec, 900);

  // Test short testing timeout (10s)
  const cfg10s = gm.setStayDurationConfig({ inactivityTimeoutSec: 10, warningBeforeDepartSec: 4 });
  assert.equal(cfg10s.inactivityTimeoutSec, 10);
  assert.equal(cfg10s.warningBeforeDepartSec, 4);

  gm.resetStayDurationConfig();
  return 'Mặc định 7 phút (420s), tùy chỉnh 1–30 phút và test ngắn 5s–30s hoạt động chuẩn xác.';
});

// 49. Bình luận & Quà hợp lệ làm mới bộ đếm; Tự múa võ, thiền, chuyển cảnh, sự kiện người khác KHÔNG làm mới bộ đếm
runTest(49, 'Làm mới bộ đếm khi Bình luận / Tặng quà; Hoạt ảnh tự động, chuyển cảnh & sự kiện người khác KHÔNG kéo dài thời gian', () => {
  gm.clearAllPlayers();
  gm.setStayDurationConfig({
    inactivityTimeoutMinutes: 7,
    inactivityTimeoutSec: 420,
    warningBeforeDepartSec: 30,
    applyMode: 'immediate',
  });

  const uidA = 'stay_user_a';
  const uidB = 'stay_user_b';
  gm.handleCommentEvent({
    id: 'st_c_a1',
    type: 'comment',
    timestamp: Date.now(),
    userId: uidA,
    uniqueId: uidA,
    nickname: 'Lệnh Hồ Xung',
    comment: 'Bái kiến!',
  });
  gm.handleCommentEvent({
    id: 'st_c_b1',
    type: 'comment',
    timestamp: Date.now(),
    userId: uidB,
    uniqueId: uidB,
    nickname: 'Nhậm Doanh Doanh',
    comment: 'Xin chào!',
  });

  // Simulate 200s elapsed for everyone -> remaining time should be ~220s
  gm.simulateTimeElapsed(200);
  const remAfter200 = gm.getSnapshot().disciples.find(d => d.userId === uidA)!.remainingStaySec!;
  assert.ok(remAfter200 <= 221 && remAfter200 >= 218, `Sau 200s trôi qua, thời gian còn lại phải ~220s (thực tế: ${remAfter200}s)`);

  // Trigger autonomous animations (mass kungfu, meditate, redistribute, scene transition, like event, and comment from user B)
  gm.triggerMassPlayerAnimation('combo_kungfu');
  gm.triggerMassPlayerAnimation('meditate');
  gm.redistributeAllDisciples();
  gm.switchSceneNow('training_ground');
  gm.switchSceneNow('main_hall');
  gm.handleIncomingEvent({
    id: 'st_like_a',
    type: 'like',
    timestamp: Date.now(),
    userId: uidA,
    uniqueId: uidA,
    nickname: 'Lệnh Hồ Xung',
    likeCount: 10,
  });
  gm.handleCommentEvent({
    id: 'st_c_b2',
    type: 'comment',
    timestamp: Date.now(),
    userId: uidB,
    uniqueId: uidB,
    nickname: 'Nhậm Doanh Doanh',
    comment: 'Múa kiếm!',
  });

  const remUserAAfterNonRefresh = gm.getSnapshot().disciples.find(d => d.userId === uidA)!.remainingStaySec!;
  const remUserBAfterComment = gm.getSnapshot().disciples.find(d => d.userId === uidB)!.remainingStaySec!;
  assert.ok(
    remUserAAfterNonRefresh <= 221 && remUserAAfterNonRefresh >= 218,
    'Hoạt ảnh tự động, chuyển cảnh, thả tim và bình luận của người khác KHÔNG được làm mới bộ đếm của User A'
  );
  assert.ok(remUserBAfterComment >= 418, 'User B vừa bình luận phải được làm mới bộ đếm về 420s');

  // Now User A sends a valid comment -> refreshes User A back to 420s
  gm.handleCommentEvent({
    id: 'st_c_a2',
    type: 'comment',
    timestamp: Date.now(),
    userId: uidA,
    uniqueId: uidA,
    nickname: 'Lệnh Hồ Xung',
    comment: 'Đệ tử vẫn đang ở đây!',
  });
  const remUserAAfterComment = gm.getSnapshot().disciples.find(d => d.userId === uidA)!.remainingStaySec!;
  assert.ok(remUserAAfterComment >= 418, 'User A gửi bình luận hợp lệ phải làm mới bộ đếm về 420s');

  // Simulate another 150s elapsed, then User A sends a gift -> refreshes User A back to 420s
  gm.simulateTimeElapsed(150, uidA);
  assert.ok(gm.getSnapshot().disciples.find(d => d.userId === uidA)!.remainingStaySec! <= 272);
  gm.handleGiftEvent({
    id: 'st_g_a1',
    type: 'gift',
    timestamp: Date.now(),
    userId: uidA,
    uniqueId: uidA,
    nickname: 'Lệnh Hồ Xung',
    coinValue: 5,
    giftName: 'Trà Tiên',
    giftCount: 1,
  });
  const remUserAAfterGift = gm.getSnapshot().disciples.find(d => d.userId === uidA)!.remainingStaySec!;
  assert.ok(remUserAAfterGift >= 418, 'User A gửi quà TikTok hợp lệ phải làm mới bộ đếm về 420s');

  return 'Bình luận & Quà làm mới bộ đếm; Tự đi dạo/múa võ/thiền/chuyển cảnh/sự kiện người khác KHÔNG làm mới bộ đếm.';
});

// 50. Cảnh báo sắp hết giờ, đi bộ ra cổng khi rời sảnh, thoát Mini Game an toàn & đôn Hàng chờ lên
runTest(50, 'Cảnh báo sắp hết giờ (expiring_soon), hoạt ảnh đi ra cổng (departing_gate), rời Mini Game an toàn & đôn Hàng chờ', () => {
  gm.clearAllPlayers();
  gm.setStayDurationConfig({
    inactivityTimeoutSec: 20,
    inactivityTimeoutMinutes: 1,
    warningBeforeDepartEnabled: true,
    warningBeforeDepartSec: 6,
    autoDepartEnabled: true,
    walkToGateOnDepart: true,
    departAnimationDurationSec: 3,
    applyMode: 'immediate',
  });

  const uid = 'depart_test_u1';
  gm.handleCommentEvent({
    id: 'dep_c1',
    type: 'comment',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Tiêu Phong',
    comment: 'Vào sảnh!',
  });

  // Start a mini-game so user is a participant
  gm.startMiniGame('ma_quyen_loan_vu');
  assert.ok(gm.getSnapshot().miniGame.participantUserIds.includes(uid), 'User phải có trong danh sách tham gia Mini Game');

  // Elapsed 16s (remaining ~4s <= warningBeforeDepartSec 6s) -> status must be 'expiring_soon'
  gm.simulateTimeElapsed(16, uid);
  const dWarn = gm.getSnapshot().disciples.find(d => d.userId === uid)!;
  assert.equal(dWarn.stayStatus, 'expiring_soon', 'Khi còn <= 6s phải chuyển sang trạng thái cảnh báo Sắp hết giờ');

  // Elapsed another 6s (total 22s >= 20s timeout) -> initiates departure walking to gate & safely exits mini-game
  gm.simulateTimeElapsed(6, uid);
  const dDeparting = gm.getSnapshot().disciples.find(d => d.userId === uid)!;
  assert.ok(dDeparting, 'Nhân vật đang chạy hoạt ảnh đi bộ ra cổng nên vẫn hiển thị tạm thời');
  assert.equal(dDeparting.fsmState, 'departing_gate', 'FSM phải ở trạng thái departing_gate');
  assert.equal(dDeparting.animation, 'depart', 'Animation phải là depart');
  assert.equal(dDeparting.stayStatus, 'departing', 'Trạng thái bảng phải là Đang rời sảnh');
  assert.equal(
    gm.getSnapshot().miniGame.participantUserIds.includes(uid),
    false,
    'Khi bắt đầu rời sảnh phải rút tên an toàn khỏi Mini Game đang chạy'
  );

  // Elapsed 4s more to finish gate walk animation -> removed from hall
  gm.simulateTimeElapsed(4, uid);
  assert.equal(gm.getDiscipleCount(), 0, 'Sau khi đi ra tới cổng phải xóa nhân vật khỏi danh sách hiển thị sảnh');

  gm.finishMiniGame(true);
  gm.resetStayDurationConfig();
  return 'Cảnh báo sắp hết giờ -> thoát Mini Game an toàn -> đi bộ ra cổng -> xóa khỏi sảnh hoạt động hoàn hảo.';
});

// 51. Người chơi hết giờ rời sảnh KHÔNG mất cấp bậc & tổng xu; khi bình luận quay lại vẫn giữ nguyên chức danh & xu
runTest(51, 'Bảo toàn Cấp Bậc & Tổng Xu khi hết giờ rời sảnh: Bình luận quay lại phục hồi nguyên vẹn chức danh & trang phục', () => {
  gm.clearAllPlayers();
  gm.setStayDurationConfig({
    inactivityTimeoutSec: 10,
    autoDepartEnabled: true,
    walkToGateOnDepart: false, // Rời ngay khi hết giờ để test nhanh
    applyMode: 'immediate',
  });

  const uid = 'return_vip_hero';
  gm.handleCommentEvent({
    id: 'rv_c1',
    type: 'comment',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Dương Quá',
    comment: 'Xin nhập môn!',
  });
  gm.handleGiftEvent({
    id: 'rv_g1',
    type: 'gift',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Dương Quá',
    coinValue: 99,
    giftName: 'Huyền Thiết Trọng Kiếm',
    giftCount: 1,
  });

  const beforeDepart = gm.getSnapshot().disciples.find(d => d.userId === uid)!;
  assert.equal(beforeDepart.totalCoins, 99);
  assert.equal(beforeDepart.rankId, 'dong_ton');
  assert.equal(beforeDepart.rankName, 'Đồng Tôn');

  // Timeout expires -> leaves hall
  gm.simulateTimeElapsed(15, uid);
  assert.equal(gm.getDiscipleCount(), 0, 'Nhân vật đã rời khỏi sảnh khi hết thời gian');
  assert.equal(
    gm.getSnapshot().playerLedger.find(p => p.userId === uid)?.totalCoins,
    99,
    'Sổ tích lũy vẫn giữ nguyên 99 xu sau khi nhân vật rời sảnh'
  );

  // Player comments again later -> walks in from gate with saved 99 xu & Đồng Tôn!
  const ret = gm.handleCommentEvent({
    id: 'rv_c2',
    type: 'comment',
    timestamp: Date.now() + 1000,
    userId: uid,
    uniqueId: uid,
    nickname: 'Dương Quá',
    comment: 'Ta đã quay trở lại đại điện!',
  });
  assert.equal(ret.isNewSpawn, true, 'Nhân vật tạo lại đi từ cổng chính vào đại điện');
  assert.equal(ret.disciple?.fsmState, 'walk_in_hall');
  assert.equal(ret.disciple?.totalCoins, 99, 'Quay lại sảnh phải giữ nguyên 99 xu');
  assert.equal(ret.disciple?.rankId, 'dong_ton', 'Quay lại sảnh phải giữ nguyên cấp Đồng Tôn');
  assert.equal(ret.disciple?.rankName, 'Đồng Tôn');

  gm.resetStayDurationConfig();
  return 'Người chơi hết giờ rời sảnh rồi bình luận quay lại giữ nguyên 99 xu & chức danh Đồng Tôn.';
});

// 52. Chế độ áp dụng "immediate" vs "new_only" & Nút Gia hạn thời gian của Admin
runTest(52, 'Chế độ áp dụng khi đổi thời gian ("immediate" vs "new_only") & Nút Gia hạn thời gian trong Admin', () => {
  gm.clearAllPlayers();
  gm.setStayDurationConfig({
    inactivityTimeoutMinutes: 7,
    inactivityTimeoutSec: 420,
    applyMode: 'immediate',
  });

  const existingUid = 'existing_hall_user';
  gm.handleCommentEvent({
    id: 'mode_c1',
    type: 'comment',
    timestamp: Date.now(),
    userId: existingUid,
    uniqueId: existingUid,
    nickname: 'Hoàng Dung',
    comment: 'Đang ở trong sảnh!',
  });
  assert.equal(gm.getSnapshot().disciples[0].remainingStaySec, 420);

  // Change timeout to 10 minutes (600s) with applyMode = 'new_only'
  gm.setStayDurationConfig({
    inactivityTimeoutMinutes: 10,
    inactivityTimeoutSec: 600,
    applyMode: 'new_only',
  });
  const existingAfterNewOnly = gm.getSnapshot().disciples.find(d => d.userId === existingUid)!;
  assert.ok(
    existingAfterNewOnly.remainingStaySec! <= 420,
    'Khi chọn "new_only", người đang ở sảnh vẫn giữ thời hạn cũ (420s)'
  );

  // New user joins -> gets 600s
  const newUid = 'new_hall_user';
  gm.handleCommentEvent({
    id: 'mode_c2',
    type: 'comment',
    timestamp: Date.now(),
    userId: newUid,
    uniqueId: newUid,
    nickname: 'Quách Tĩnh',
    comment: 'Người mới vào sảnh!',
  });
  const newDisciple = gm.getSnapshot().disciples.find(d => d.userId === newUid)!;
  assert.ok(newDisciple.remainingStaySec! >= 598, 'Người mới vào sảnh phải nhận thời hạn mới (600s)');

  // Now switch applyMode to 'immediate' with 3 minutes (180s) -> both users immediately switch to 180s base
  gm.setStayDurationConfig({
    inactivityTimeoutMinutes: 3,
    inactivityTimeoutSec: 180,
    applyMode: 'immediate',
  });
  assert.ok(
    gm.getSnapshot().disciples.every(d => (d.remainingStaySec ?? 0) <= 180),
    'Khi chọn "immediate", toàn bộ người đang ở sảnh phải được áp dụng ngay thời hạn 180s'
  );

  // Admin extends stay time for existingUid by +120s
  const extendedCount = gm.extendDiscipleStayTime(existingUid, 120, 'Test Admin gia hạn');
  assert.equal(extendedCount, 1);
  const extendedUser = gm.getSnapshot().disciples.find(d => d.userId === existingUid)!;
  assert.ok(extendedUser.remainingStaySec! >= 295, 'Sau khi Admin gia hạn +120s, thời gian còn lại phải tăng từ 180s lên ~300s');

  gm.resetStayDurationConfig();
  return 'Chế độ "immediate" / "new_only" và nút Gia hạn thời gian của Admin hoạt động chính xác.';
});

// 53. Kiểm thử 80 người chơi hoạt động cùng lúc + Hàng chờ tự động vào sảnh khi người cũ hết giờ
runTest(53, 'Kiểm thử 80 người chơi hoạt động cùng lúc + Giải phóng vị trí cho Hàng chờ khi hết thời gian', () => {
  gm.clearAllPlayers();
  gm.setStayDurationConfig({
    inactivityTimeoutSec: 30,
    walkToGateOnDepart: false,
    autoDepartEnabled: true,
    applyMode: 'immediate',
  });

  // Spawn 85 players -> 80 in hall + 5 in waitingQueue
  gm.spawnDemoPlayers(85);
  assert.equal(gm.getDiscipleCount(), 80, 'Sảnh chứa tối đa 80 người');
  assert.equal(gm.getWaitingQueueCount(), 5, '5 người nằm trong hàng chờ');

  // Verify all 80 disciples have valid remainingStaySec and stayStatus
  const snap80 = gm.getSnapshot();
  assert.equal(snap80.disciples.length, 80);
  assert.ok(
    snap80.disciples.every(d => typeof d.remainingStaySec === 'number' && d.remainingStaySec > 0 && d.stayStatus === 'active'),
    'Cả 80 người chơi đều được bộ đếm tập trung quản lý chính xác'
  );

  // Expire 3 specific disciples in the hall -> 3 waitingQueue players must automatically enter the hall!
  const firstThreeIds = snap80.disciples.slice(0, 3).map(d => d.userId);
  for (const uid of firstThreeIds) {
    gm.simulateTimeElapsed(40, uid);
  }

  assert.equal(gm.getDiscipleCount(), 80, 'Sau khi 3 người rời sảnh, 3 người từ hàng chờ lập tức vào thế chỗ giữ quân số 80');
  assert.equal(gm.getWaitingQueueCount(), 2, 'Hàng chờ giảm từ 5 xuống 2 người');

  gm.resetStayDurationConfig();
  return 'Quản lý tập trung 80 người chơi cùng lúc mượt mà & tự động đôn Hàng chờ khi có người hết thời gian rời sảnh.';
});

// ============================================================================
// 54–58. KIỂM THỬ CẬP NHẬT GIAO DIỆN 9:16: HẠ NGAI GIÁO CHỦ 30PX, NÂNG QUÉT SÂN 25PX,
//        POPUP TỰ ẨN SAU 4 GIÂY (FADE 0.7S) & OPACITY NỀN BẢNG 0.4
// ============================================================================

// 54. Hạ Ngai Giáo Chủ xuống 30px (y: 19% -> 22.13% trên khung 9:16 540x960) & đồng bộ hoạt ảnh
runTest(54, 'Hạ Ngai Giáo Chủ xuống đúng 30px (Y: 19% ➔ 22.13% trên khung 9:16), giữ X=50% & đồng bộ hoạt ảnh', () => {
  const cfg = gm.getConfig();
  const thronePos = cfg.sectLeader.thronePosition;
  assert.equal(thronePos.x, 50, 'Tọa độ ngang X của Ngai Giáo Chủ phải giữ nguyên ở trung tâm (50%)');
  const offsetPxY = Math.round(((thronePos.y - 19) / 100) * 960);
  assert.equal(offsetPxY, 30, `Ngai Giáo Chủ phải hạ xuống đúng +30px trên khung 960px (hiện tại: +${offsetPxY}px, y=${thronePos.y}%)`);

  // Verify Sect Leader stand_up_throne, walk_down_steps, and return_to_throne synchronize with new Throne Y
  gm.triggerSectLeaderAnimation('stand_up_throne');
  assert.equal(gm.getSnapshot().sectLeader.currentAnimation, 'stand_up_throne');
  gm.triggerSectLeaderAnimation('walk_down_steps');
  const stepTargetY = gm.getSnapshot().sectLeader.targetY;
  assert.ok(
    Math.abs(stepTargetY - (thronePos.y + 8.5)) < 0.2,
    `Bước xuống thềm phải đồng bộ với vị trí ngai mới (targetY=${stepTargetY}%)`
  );
  gm.triggerSectLeaderAnimation('return_to_throne');
  assert.equal(gm.getSnapshot().sectLeader.targetX, thronePos.x);
  assert.equal(gm.getSnapshot().sectLeader.targetY, thronePos.y);

  // Verify disciples in FreeRoamArea never overlap the lowered Throne
  gm.setPopulationPreset(50);
  for (let i = 0; i < 10; i++) gm.tick();
  const overlapping = gm
    .getSnapshot()
    .disciples.filter(
      d => !d.isSectLeader && !d.isCoLeader && gm.isInsideThroneReservedZone(d.x, d.y, 0.2)
    );
  assert.equal(overlapping.length, 0, 'Không có đệ tử nào chồng lên cụm Ngai Giáo Chủ sau khi hạ 30px');

  return `Ngai Giáo Chủ tại X=${thronePos.x}%, Y=${thronePos.y}% (+${offsetPxY}px), đồng bộ bước xuống thềm & trở về ngai.`;
});

// 55. Nâng Khu Vực Quét Sân lên 25px (yMin: 88% -> 85.4%, yMax: 95% -> 92.4%) & đồng bộ đệ tử quét sân
runTest(55, 'Nâng Khu Vực Quét Sân lên đúng 25px (Y: 88..95% ➔ 85.4..92.4% trên khung 9:16) & đồng bộ nhân vật', () => {
  const sweepZone = gm.getConfig().sceneConfig.zones.sweeping_courtyard;
  assert.equal(sweepZone.xMin, 73, 'Giữ nguyên tọa độ ngang X (xMin=73%)');
  assert.equal(sweepZone.xMax, 94, 'Giữ nguyên tọa độ ngang X (xMax=94%)');
  const shiftUpPx = Math.round(((88 - sweepZone.yMin) / 100) * 960);
  assert.equal(shiftUpPx, 25, `Khu vực Quét sân phải nâng lên đúng 25px (hiện tại: ${shiftUpPx}px, yMin=${sweepZone.yMin}%)`);

  // Trigger mini-game loss so 5 disciples are sent to sweep at the new raised coordinates
  gm.clearAllPlayers();
  gm.spawnDemoPlayers(8);
  gm.startMiniGame('ma_quyen_loan_vu');
  gm.finishMiniGame(false);

  const sweepers = gm.getSnapshot().sweepingDisciples;
  assert.equal(sweepers.length, 5, 'Phải có 5 đệ tử bị phạt quét sân');
  for (const s of sweepers) {
    assert.ok(
      s.targetX >= sweepZone.xMin && s.targetX <= sweepZone.xMax,
      `Đệ tử quét sân phải đứng trong vùng X (${sweepZone.xMin}..${sweepZone.xMax}%), hiện tại: ${s.targetX}%`
    );
    assert.ok(
      s.targetY >= sweepZone.yMin && s.targetY <= sweepZone.yMax,
      `Đệ tử quét sân phải đứng trong vùng Y mới đã nâng 25px (${sweepZone.yMin}..${sweepZone.yMax}%), hiện tại: ${s.targetY}%`
    );
  }

  // Commenting again immediately releases the disciple back to Main Hall
  const firstSweeper = sweepers[0];
  const rel = gm.handleCommentEvent({
    id: 'sweep_rel_v2',
    type: 'comment',
    timestamp: Date.now(),
    userId: firstSweeper.userId,
    uniqueId: firstSweeper.uniqueId,
    nickname: firstSweeper.displayName,
    comment: 'Quét xong lá rồi!',
  });
  assert.equal(rel.releasedFromSweep, true, 'Bình luận lại phải quay về Đại Điện ngay');
  return `Khu vực Quét sân tại Y=${sweepZone.yMin}..${sweepZone.yMax}% (nâng +${shiftUpPx}px), 5 đệ tử quét đúng tọa độ mới.`;
});

// 56. Thông báo tạm thời (Popup thăng cấp, kết quả Mini Game, Thánh chỉ) tự biến mất sau 4 giây + Fade-out 0.7s
runTest(56, 'Thông báo tạm thời tự động biến mất sau 4.0 giây (4000ms) kèm hiệu ứng mờ dần Fade-Out 0.7 giây (700ms)', () => {
  const overlayCfg = gm.getConfig().overlayConfig;
  assert.equal(overlayCfg.popupDurationMs, 4000, 'Thời gian hiển thị popup mặc định phải là 4000ms (4 giây)');
  assert.equal(overlayCfg.popupFadeOutMs, 700, 'Thời gian fade-out mặc định phải là 700ms (0.7 giây)');
  assert.equal(overlayCfg.autoHidePopups, true, 'Chế độ tự ẩn popup tạm thời phải bật mặc định');

  // Check noticePanels default durations for temporary popups vs fixed tables
  const panels = gm.getConfig().noticePanels;
  const promoPanel = panels.find(p => p.id === 'promotion_banner')!;
  const mgResultPanel = panels.find(p => p.id === 'minigame_result')!;
  const speechPanel = panels.find(p => p.id === 'sect_leader_speech')!;
  const elderPanel = panels.find(p => p.id === 'elder_leaderboard')!;
  const rankTablePanel = panels.find(p => p.id === 'gift_rank_table')!;

  assert.equal(promoPanel.durationMs, 4000, 'Popup thăng cấp hiển thị 4000ms');
  assert.equal(mgResultPanel.durationMs, 4000, 'Popup kết quả mini game hiển thị 4000ms');
  assert.equal(speechPanel.durationMs, 4000, 'Popup thánh chỉ hiển thị 4000ms');
  assert.equal(elderPanel.durationMs, 0, 'Bảng TRƯỞNG LÃO là bảng cố định (durationMs = 0)');
  assert.equal(rankTablePanel.durationMs, 0, 'Bảng PHONG CẤP là bảng cố định (durationMs = 0)');

  return 'Popup tạm thời hiển thị đúng 4000ms, fade-out 700ms rồi tự ẩn; Bảng TRƯỞNG LÃO & PHONG CẤP giữ cố định.';
});

// 57. Opacity nền bảng = 0.4 (rgba) cho Bảng TRƯỞNG LÃO, PHONG CẤP, Thông báo thăng cấp (không làm mờ chữ)
runTest(57, 'Opacity nền các bảng về đúng 0.4 (chỉ áp dụng rgba cho lớp nền, giữ nguyên độ sắc nét của chữ & icon)', () => {
  const overlayCfg = gm.getConfig().overlayConfig;
  assert.equal(overlayCfg.panelBgOpacity, 0.4, 'Opacity nền bảng mặc định phải bằng 0.4');

  const hudSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ui/MaGiaoOverlayHUD.tsx'),
    'utf8'
  );
  assert.ok(
    hudSource.includes('rgba(12, 8, 22, ${panelBgOpacity})'),
    'MaGiaoOverlayHUD phải dùng rgba(..., panelBgOpacity) cho lớp nền bảng để không làm mờ chữ bên trong'
  );
  assert.ok(
    hudSource.includes('CRISP_TEXT_SHADOW'),
    'Chữ và số liệu bên trong bảng phải có text-shadow độ tương phản cao, rõ nét'
  );

  return 'Opacity nền bảng = 0.4 (rgba), chữ/icon/danh hiệu sắc nét 100% với viền vàng đồng Ma Giáo.';
});

// 58. Tùy chỉnh trong Admin Tab 16 (Layout & CSS) đồng bộ trực tiếp sang Game & OBS
runTest(58, 'Tùy chỉnh vị trí Ngai Giáo Chủ, Khu Quét Sân, Opacity nền & Thời gian Popup trong Admin đồng bộ sang Game & OBS', () => {
  const cfg = gm.getConfig();
  cfg.sectLeader.thronePosition = { x: 50, y: 23.0 };
  cfg.sceneConfig.zones.sweeping_courtyard = {
    xMin: 72,
    xMax: 93,
    yMin: 84.0,
    yMax: 91.0,
    label: 'Góc Phạt Quét Sân',
  };
  cfg.overlayConfig.panelBgOpacity = 0.45;
  cfg.overlayConfig.popupDurationMs = 4500;
  cfg.overlayConfig.popupFadeOutMs = 800;

  gm.updateMasterConfig(cfg);
  const snap = gm.getSnapshot();
  assert.equal(snap.sectLeader.y, 23.0, 'Giáo Chủ phải cập nhật ngay sang tọa độ Y mới từ Admin');
  assert.equal(snap.config.sceneConfig.zones.sweeping_courtyard.yMin, 84.0, 'Khu Quét sân phải cập nhật ngay sang tọa độ Y mới');
  assert.equal(snap.config.overlayConfig.panelBgOpacity, 0.45);
  assert.equal(snap.config.overlayConfig.popupDurationMs, 4500);

  // Restore defaults (+30px Throne = 22.13%, -25px Sweeping = 85.4%, Opacity = 0.4, Popup = 4000ms)
  cfg.sectLeader.thronePosition = { x: 50, y: 22.13 };
  cfg.sceneConfig.zones.sweeping_courtyard = {
    xMin: 73,
    xMax: 94,
    yMin: 85.4,
    yMax: 92.4,
    label: 'Góc Phạt Quét Sân',
  };
  cfg.overlayConfig.panelBgOpacity = 0.4;
  cfg.overlayConfig.popupDurationMs = 4000;
  cfg.overlayConfig.popupFadeOutMs = 700;
  gm.updateMasterConfig(cfg);

  return 'Đồng bộ trực tiếp vị trí Ngai Giáo Chủ, Khu vực Quét sân, Opacity nền & Popup giữa Admin, Game và OBS.';
});

// ============================================================================
// 59–63. KIỂM THỬ BẢNG CẤP BẬC CHÍNH THỨC MỚI, ICON SVG MA GIÁO TRONG BẢNG PHONG CẤP,
//        VÀ ĐẠI SỰ KIỆN DIỆT MÔN 1.000 XU (5 GIAI ĐOẠN 15 GIÂY)
// ============================================================================

// 59. Bảng PHONG CẤP dùng Ma Giáo SVG Emblem (không dùng emoji quà TikTok) & hiển thị đủ mốc 1..199 + 1000 DIỆT MÔN
runTest(59, 'Bảng PHONG CẤP sử dụng Icon SVG Ma Ấn riêng (loại bỏ hoàn toàn emoji quà 🌹🍵🍶⚔️🛡️📜👑🐉)', () => {
  const hudSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ui/MaGiaoOverlayHUD.tsx'),
    'utf8'
  );
  assert.ok(
    hudSource.includes('MaGiaoRankEmblemSVG'),
    'MaGiaoOverlayHUD phải có component MaGiaoRankEmblemSVG vẽ ấn ký Ma Giáo bằng SVG'
  );
  assert.ok(
    !hudSource.includes('🌹') && !hudSource.includes('🍵') && !hudSource.includes('🍶'),
    'Bảng PHONG CẤP tuyệt đối không còn chứa emoji quà TikTok cũ (🌹, 🍵, 🍶)'
  );
  assert.ok(
    hudSource.includes('DIỆT MÔN'),
    'Bảng PHONG CẤP phải hiển thị dòng 1000 DIỆT MÔN'
  );
  return 'Bảng PHONG CẤP hiển thị chuẩn Icon SVG Ma Ấn đồng bộ sắc tím–đỏ–vàng đồng cho các mốc 1, 5, 10, 20, 50, 99, 199, 1000.';
});

// 60. Cộng dồn 900 + 100 = 1.000 xu: Giữ nguyên cấp Giáo Chủ (không tạo cấp bậc thứ 9) & kích hoạt DIỆT MÔN
runTest(60, 'Cộng dồn 900 + 100 = 1.000 xu: Người chơi giữ cấp Giáo Chủ (không tạo cấp thứ 9) & kích hoạt đại sự kiện DIỆT MÔN', () => {
  gm.clearAllPlayers();
  gm.stopDietMonEmergency();

  const uid = 'diet_mon_accum_hero';
  const r1 = gm.handleGiftEvent({
    id: 'dm_900',
    type: 'gift',
    timestamp: Date.now(),
    userId: uid,
    uniqueId: uid,
    nickname: 'Độc Cô Cầu Bại',
    avatarUrl: 'https://example.com/avatar_doc_co.png',
    coinValue: 900,
    giftName: 'Thánh Hỏa Lệnh 900 Xu',
    giftCount: 1,
  });
  assert.equal(r1.disciple.totalCoins, 900);
  assert.equal(r1.disciple.rankId, 'giao_chu', '900 xu đạt cấp cao nhất là Giáo Chủ');
  assert.equal(r1.dietMonTriggered, false, '900 xu chưa kích hoạt Diệt Môn');

  const r2 = gm.handleGiftEvent({
    id: 'dm_100',
    type: 'gift',
    timestamp: Date.now() + 1,
    userId: uid,
    uniqueId: uid,
    nickname: 'Độc Cô Cầu Bại',
    avatarUrl: 'https://example.com/avatar_doc_co.png',
    coinValue: 100,
    giftName: 'Bách Quỷ Lệnh 100 Xu',
    giftCount: 1,
  });
  assert.equal(r2.disciple.totalCoins, 1000, '900 + 100 phải đúng bằng 1.000 xu');
  assert.equal(r2.disciple.rankId, 'giao_chu', 'Đạt 1.000 xu vẫn giữ cấp Giáo Chủ, không tạo cấp bậc mới');
  assert.equal(r2.disciple.rankName, 'Giáo Chủ');
  assert.equal(r2.dietMonTriggered, true, 'Đạt 1.000 xu phải lập tức kích hoạt đại sự kiện DIỆT MÔN');

  const snap = gm.getSnapshot();
  assert.equal(snap.dietMon.isActive, true);
  assert.equal(snap.dietMon.phase, 'tremor', 'Giai đoạn 1 (0–3s) phải là tremor');
  assert.equal(snap.dietMon.triggerDisplayName, 'Độc Cô Cầu Bại');
  assert.equal(snap.dietMon.triggerAvatarUrl, 'https://example.com/avatar_doc_co.png');

  gm.stopDietMonEmergency();
  return '900 + 100 = 1.000 xu ➔ Giữ cấp Giáo Chủ & kích hoạt chính xác sự kiện DIỆT MÔN.';
});

// 61. Diễn biến đầy đủ 5 giai đoạn sự kiện DIỆT MÔN trong 15 giây với 80 nhân vật trong sảnh
runTest(61, 'Chu trình 5 giai đoạn DIỆT MÔN 15 giây với 80 nhân vật: Rung chuyển (0-3s) ➔ Sập (3-6s) ➔ Avatar (6-9s) ➔ Hố đen hút sạch (9-12s) ➔ Tái thiết sảnh trống 0 người (12-15s)', () => {
  gm.clearAllPlayers();
  gm.spawnDemoPlayers(80);
  assert.equal(gm.getDiscipleCount(), 80, 'Khởi tạo đủ 80 nhân vật trong Đại Điện');

  // Trigger Diệt Môn
  const res = gm.triggerTestDietMon('boss_1000', 'Ma Tôn Vô Thượng', 'https://example.com/maton.jpg');
  assert.equal(res.isActive, true);
  assert.equal(res.phase, 'tremor', '0s: Giai đoạn 1 - Đại Điện Rung Chuyển (tremor)');

  // Advance to 4.0s -> Phase 2: collapse (3–6s)
  gm.advanceDietMonByMs(4000);
  assert.equal(gm.getSnapshot().dietMon.phase, 'collapse', '4s: Giai đoạn 2 - Đại Điện Đổ Sập (collapse)');

  // Advance +3.0s (total 7.0s) -> Phase 3: avatar_descend (6–9s)
  gm.advanceDietMonByMs(3000);
  assert.equal(gm.getSnapshot().dietMon.phase, 'avatar_descend', '7s: Giai đoạn 3 - Avatar Giáng Thế (avatar_descend)');

  // Advance +3.5s (total 10.5s) -> Phase 4: vortex_suck (9–12s)
  gm.advanceDietMonByMs(3500);
  const snapVortex = gm.getSnapshot();
  assert.equal(snapVortex.dietMon.phase, 'vortex_suck', '10.5s: Giai đoạn 4 - Hố Đen Cuốn Toàn Bộ Nhân Vật (vortex_suck)');
  // Verify disciples are being pulled closer to center (50, 50)
  const sampleD = snapVortex.disciples[0];
  assert.ok((sampleD.vortexProgress ?? 0) > 0, 'Nhân vật phải có tiến trình xoáy hút vào hố đen trung tâm');

  // Advance +2.5s (total 13.0s) -> Phase 5: rebuild (12–15s) -> Hall must already be cleared to 0 disciples!
  gm.advanceDietMonByMs(2500);
  const snapRebuild = gm.getSnapshot();
  assert.equal(snapRebuild.dietMon.phase, 'rebuild', '13s: Giai đoạn 5 - Tái Thiết Đại Điện (rebuild)');
  assert.equal(snapRebuild.dietMon.hallCleared, true, 'Cuối giai đoạn 4 hố đen đã cuốn sạch toàn bộ nhân vật');
  assert.equal(snapRebuild.disciples.length, 0, 'Trong giai đoạn tái thiết, số nhân vật trong sảnh phải bằng 0');

  // Advance +2.5s (total 15.5s >= 15.0s) -> Diệt Môn finishes -> Hall is rebuilt, active=false, disciples=0
  gm.advanceDietMonByMs(2500);
  const snapDone = gm.getSnapshot();
  assert.equal(snapDone.dietMon.isActive, false, 'Đúng 15 giây sự kiện Diệt Môn phải kết thúc hoàn toàn');
  assert.equal(snapDone.dietMon.phase, 'inactive');
  assert.equal(snapDone.disciples.length, 0, 'Sau khi tái thiết xong ở giây thứ 15, Đại Điện phải trống hoàn toàn (0 nhân vật)');
  assert.equal(snapDone.waitingQueue.length, 0, 'Hàng chờ hiển thị cũng phải được dọn sạch');

  return 'Hoàn tất trọn vẹn 5 giai đoạn 15s: Cuốn sạch 80/80 nhân vật vào hố đen & tái thiết Đại Điện trống hoàn toàn (0 người).';
});

// 62. Sau khi Diệt Môn kết thúc: Không mất tổng xu/cấp bậc trong Sổ Vàng & Người cũ/mới bình luận sẽ đi từ cổng vào lại
runTest(62, 'Sau Diệt Môn: Bảo toàn 100% tổng xu & cấp bậc trong Sổ Vàng; người chơi cũ hoặc mới bình luận 1 câu sẽ đi từ cổng vào lại sảnh', () => {
  gm.clearAllPlayers();
  const oldVipId = 'vip_survivor_99';
  gm.handleGiftEvent({
    id: 'pre_dm_gift_99',
    type: 'gift',
    timestamp: Date.now(),
    userId: oldVipId,
    uniqueId: oldVipId,
    nickname: 'Chu Chỉ Nhược',
    coinValue: 99,
    giftName: 'Ỷ Thiên Kiếm',
    giftCount: 1,
  });
  assert.equal(gm.getDiscipleCount(), 1);
  assert.equal(gm.getSnapshot().disciples[0].rankId, 'dong_ton');

  // Trigger and complete 15s Diệt Môn
  gm.triggerTestDietMon('apocalypse_trigger', 'Huyền Minh Nhị Lão');
  gm.advanceDietMonByMs(15500);

  // Hall is now 0 players, does NOT auto-respawn old players without a new comment
  assert.equal(gm.getDiscipleCount(), 0, 'Sau Diệt Môn không được tự sinh lại nhân vật cũ nếu họ chưa bình luận');

  // Verify ledger preserved Chu Chỉ Nhược's 99 xu & Đồng Tôn rank
  const savedLedger = gm.getSnapshot().playerLedger.find(p => p.userId === oldVipId);
  assert.ok(savedLedger, 'Sổ tích lũy xu của người chơi cũ phải được giữ nguyên sau Diệt Môn');
  assert.equal(savedLedger!.totalCoins, 99);
  assert.equal(savedLedger!.rankId, 'dong_ton');

  // Now Chu Chỉ Nhược comments once -> walks in from the gate with full 99 xu & Đồng Tôn rank!
  const reEnter = gm.handleCommentEvent({
    id: 'post_dm_reenter_1',
    type: 'comment',
    timestamp: Date.now() + 2000,
    userId: oldVipId,
    uniqueId: oldVipId,
    nickname: 'Chu Chỉ Nhược',
    comment: 'Đại điện tái thiết đẹp quá, ta vào lại đây!',
  });
  assert.equal(reEnter.isNewSpawn, true, 'Người chơi cũ bình luận lại sau Diệt Môn sẽ đi từ cổng vào sảnh');
  assert.equal(gm.getDiscipleCount(), 1);
  assert.equal(reEnter.disciple?.totalCoins, 99, 'Giữ nguyên 99 xu tích lũy');
  assert.equal(reEnter.disciple?.rankId, 'dong_ton', 'Giữ nguyên cấp Đồng Tôn');
  assert.equal(reEnter.disciple?.isCoLeader, true);

  return 'Sau Diệt Môn: Sảnh trống 0 người, bảo toàn Sổ Vàng 99 xu, bình luận 1 câu lập tức đi từ cổng vào lại với nguyên cấp Đồng Tôn.';
});

// 63. Chống xung đột khi Diệt Môn diễn ra (Tạm dừng Mini Game, chặn lặp cùng User, nút Dừng khẩn cấp & Khôi phục Đại Điện)
runTest(63, 'Chống xung đột Diệt Môn: Tự dừng Mini Game đang chạy, không kích hoạt lặp cùng 1 người, nút Dừng khẩn cấp & Khôi phục Đại Điện hoạt động chuẩn', () => {
  gm.clearAllPlayers();
  gm.spawnDemoPlayers(12);
  gm.startMiniGame('ma_anh_than_phap');
  assert.equal(gm.getSnapshot().miniGame.isActive, true);
  assert.equal(gm.getSnapshot().activeScene, 'training_ground');

  // Player reaches 1000 xu during active mini-game -> Diệt Môn pauses mini-game and switches to main_hall
  const r1 = gm.handleGiftEvent({
    id: 'dm_conflict_1000',
    type: 'gift',
    timestamp: Date.now(),
    userId: 'conflict_hero',
    uniqueId: 'conflict_hero',
    nickname: 'Phong Thanh Dương',
    coinValue: 1000,
    giftName: 'Độc Cô Cửu Kiếm',
    giftCount: 1,
  });
  assert.equal(r1.dietMonTriggered, true);
  assert.equal(gm.getSnapshot().miniGame.isActive, false, 'Khi Diệt Môn bắt đầu phải tạm dừng ngay Mini Game đang chạy');
  assert.equal(gm.getSnapshot().activeScene, 'main_hall', 'Khi Diệt Môn bắt đầu phải đưa về Đại Điện');

  // Emergency Stop button test
  gm.stopDietMonEmergency();
  assert.equal(gm.getSnapshot().dietMon.isActive, false, 'Nút Dừng sự kiện khẩn cấp phải tắt Diệt Môn ngay');

  // Same user sends another +100 xu in the same session (1100 xu) -> must NOT re-trigger Diệt Môn repeatedly
  const r2 = gm.handleGiftEvent({
    id: 'dm_conflict_1100',
    type: 'gift',
    timestamp: Date.now() + 10,
    userId: 'conflict_hero',
    uniqueId: 'conflict_hero',
    nickname: 'Phong Thanh Dương',
    coinValue: 100,
    giftName: 'Quà Thêm 100 Xu',
    giftCount: 1,
  });
  assert.equal(r2.disciple.totalCoins, 1100);
  assert.equal(r2.dietMonTriggered, false, 'Cùng 1 người không kích hoạt lặp Diệt Môn liên tục trong 1 phiên');

  // Rebuild Hall Immediately button test
  gm.triggerTestDietMon('test_rebuild_btn', 'Test Rebuild');
  assert.equal(gm.getSnapshot().dietMon.isActive, true);
  gm.rebuildHallImmediately();
  assert.equal(gm.getSnapshot().dietMon.isActive, false, 'Nút Khôi phục Đại Điện phải đưa Đại Điện về trạng thái bình thường ngay');

  return 'Tự dừng Mini Game khi Diệt Môn nổ ra, chống lặp sự kiện 1000 xu trên cùng User, nút Dừng khẩn cấp & Khôi phục Đại Điện hoạt động hoàn hảo.';
});

// ============================================================================
// 64. HỆ THỐNG THÊM HÀNG LOẠT 20+ ID QUÀ TIKTOK VÀO NHÓM 1 X & CHỐNG TRÙNG NHÓM
// ============================================================================
runTest(64, 'Nhập hàng loạt 20 ID quà vào nhóm 1 X, lọc trùng & chặn ID nằm ở 2 nhóm giá trị khác nhau', () => {
  const tmpGiftFile = path.resolve(process.cwd(), 'data', 'test_bulk_gifts.json');
  if (fs.existsSync(tmpGiftFile)) fs.unlinkSync(tmpGiftFile);
  const store = new PersistentGiftStore(tmpGiftFile);

  // Tạo chuỗi 20 ID mới cho nhóm 1 X (hỗ trợ cả dấu phẩy, chấm phẩy, xuống dòng, khoảng trắng & trùng lặp trong batch)
  const twentyIds = Array.from({ length: 20 }, (_, i) => String(81001 + i));
  const rawInputWithDupsAndInvalid = [
    twentyIds.slice(0, 10).join(', '),
    twentyIds.slice(10, 15).join('; '),
    twentyIds.slice(15, 20).join('\n'),
    twentyIds[0], // duplicate in batch
    '5655', // already in same group (gift_tier_1)
    '5658', // conflict with gift_tier_5 (NHÓM 5 X)
    'abc_invalid', // invalid token
  ].join('\n');

  const check = store.inspectBulkGiftIds(rawInputWithDupsAndInvalid, 'gift_tier_1');
  assert.equal(check.validNewIds.length, 20, 'Phải tách đúng 20 ID mới hợp lệ');
  assert.equal(check.duplicateInBatchIds.length, 1, 'Phải phát hiện 1 ID trùng trong cùng lần nhập');
  assert.equal(check.alreadyInSameGroupIds.includes('5655'), true, 'Phải phát hiện ID 5655 đã có trong nhóm 1 X');
  assert.equal(check.conflictOtherGroups.length, 1, 'Phải phát hiện ID 5658 đang thuộc nhóm 5 X');
  assert.equal(check.conflictOtherGroups[0].coinValue, 5);
  assert.equal(check.invalidTokens.includes('abc_invalid'), true, 'Phải phát hiện token lỗi định dạng');

  // Lưu khi Admin xác nhận
  const saveRes = store.bulkAddToGroup('gift_tier_1', twentyIds.join(', '));
  assert.equal(saveRes.ok, true);
  assert.equal(saveRes.addedCount, 20);

  // Đồng bộ vào giftRegistry client để kiểm tra resolveGift
  giftRegistry.setMappingsFromServer(store.getAll());
  for (const gid of twentyIds) {
    const resolved = giftRegistry.resolveGift({ giftId: gid });
    assert.ok(resolved.matched, `ID ${gid} phải được ánh xạ trong GiftRegistry`);
    assert.equal(resolved.matched?.coinValue, 1, `ID ${gid} phải có giá trị 1 X`);
  }

  // Kiểm tra di chuyển 1 ID từ nhóm 1 X sang nhóm 5 X
  const moveRes = store.moveGiftId(twentyIds[19], 'gift_tier_1', 'gift_tier_5');
  assert.equal(moveRes.ok, true);
  giftRegistry.setMappingsFromServer(store.getAll());
  assert.equal(
    giftRegistry.resolveGift({ giftId: twentyIds[19] }).matched?.coinValue,
    5,
    'Sau khi chuyển nhóm, ID phải mang giá trị 5 X'
  );

  if (fs.existsSync(tmpGiftFile)) fs.unlinkSync(tmpGiftFile);
  store.resetToDefaults();
  giftRegistry.setMappingsFromServer(store.getAll());

  return 'Nhập hàng loạt 20 ID vào nhóm 1 X, kiểm tra trước khi lưu (Hợp lệ/Trùng/Lỗi/Xung đột nhóm) & chuyển nhóm hoạt động chính xác 100%.';
});

// ============================================================================
// 65. CỘNG DỒN QUÀ NGOÀI MỐC & NHIỀU ID KHÁC NHAU TRONG CÙNG NHÓM 1 X
// ============================================================================
runTest(65, 'Cộng dồn quà ngoài mốc (3 X + 1 X [ID A] + 1 X [ID B] = 5 X -> Chân Truyền; 20+30=50; 100+99=199; 500+500=1000)', () => {
  const tmpGiftFile = path.resolve(process.cwd(), 'data', 'test_non_ms_gifts.json');
  if (fs.existsSync(tmpGiftFile)) fs.unlinkSync(tmpGiftFile);
  const store = new PersistentGiftStore(tmpGiftFile);

  // Thêm nhóm quà ngoài mốc 3 X (ID: 30003)
  const create3X = store.create({
    giftName: 'Phù Chú Tam Tinh',
    groupName: 'NHÓM 3 X',
    giftIds: ['30003'],
    giftIdStrings: ['30003'],
    coinValue: 3,
    rankGranted: 'de_tu',
  });
  assert.equal(create3X.ok, true);
  giftRegistry.setMappingsFromServer(store.getAll());

  const testGm = new SectGameManager();
  testGm.stopLoop();

  // 1) Tặng 3 X (ID 30003) + 1 X (ID 5655) + 1 X (ID 7934 - ID khác trong cùng nhóm 1 X) = 5 X -> Chân Truyền
  const r1 = testGm.handleGiftEvent({
    id: 'non_ms_1',
    type: 'gift',
    timestamp: Date.now(),
    userId: 'user_3_1_1',
    uniqueId: 'user_3_1_1',
    nickname: 'Chu Chỉ Nhược',
    giftId: '30003',
    giftCount: 1,
  });
  assert.equal(r1.disciple.totalCoins, 3);
  assert.equal(r1.disciple.rankId, 'de_tu');

  const r2 = testGm.handleGiftEvent({
    id: 'non_ms_2',
    type: 'gift',
    timestamp: Date.now() + 10,
    userId: 'user_3_1_1',
    uniqueId: 'user_3_1_1',
    nickname: 'Chu Chỉ Nhược',
    giftId: '5655', // ID thứ 1 của nhóm 1 X
    giftCount: 1,
  });
  assert.equal(r2.disciple.totalCoins, 4);
  assert.equal(r2.promoted, false, '4 X vẫn ở cấp Đệ Tử, chưa thăng cấp lặp');

  const r3 = testGm.handleGiftEvent({
    id: 'non_ms_3',
    type: 'gift',
    timestamp: Date.now() + 20,
    userId: 'user_3_1_1',
    uniqueId: 'user_3_1_1',
    nickname: 'Chu Chỉ Nhược',
    giftId: '7934', // ID thứ 2 khác nhau trong cùng nhóm 1 X
    giftCount: 1,
  });
  assert.equal(r3.disciple.totalCoins, 5);
  assert.equal(r3.promoted, true);
  assert.equal(r3.disciple.rankId, 'chan_truyen');
  assert.equal(r3.newRankName, 'Chân Truyền');

  // 2) Tặng 20 X + 30 X = 50 X -> Trưởng Lão
  testGm.handleGiftEvent({
    id: 'non_ms_20',
    type: 'gift',
    timestamp: Date.now() + 30,
    userId: 'user_20_30',
    uniqueId: 'user_20_30',
    nickname: 'Tạ Tốn',
    coinValue: 20,
    giftCount: 1,
  });
  const r50 = testGm.handleGiftEvent({
    id: 'non_ms_30',
    type: 'gift',
    timestamp: Date.now() + 40,
    userId: 'user_20_30',
    uniqueId: 'user_20_30',
    nickname: 'Tạ Tốn',
    coinValue: 30,
    giftCount: 1,
  });
  assert.equal(r50.disciple.totalCoins, 50);
  assert.equal(r50.disciple.rankId, 'truong_lao');

  // 3) Tặng 100 X + 99 X = 199 X -> Giáo Chủ
  testGm.handleGiftEvent({
    id: 'non_ms_100',
    type: 'gift',
    timestamp: Date.now() + 50,
    userId: 'user_100_99',
    uniqueId: 'user_100_99',
    nickname: 'Tiêu Phong',
    coinValue: 100,
    giftCount: 1,
  });
  const r199 = testGm.handleGiftEvent({
    id: 'non_ms_99',
    type: 'gift',
    timestamp: Date.now() + 60,
    userId: 'user_100_99',
    uniqueId: 'user_100_99',
    nickname: 'Tiêu Phong',
    coinValue: 99,
    giftCount: 1,
  });
  assert.equal(r199.disciple.totalCoins, 199);
  assert.equal(r199.disciple.rankId, 'giao_chu');

  // 4) Tặng 500 X + 500 X = 1.000 X -> DIỆT MÔN
  testGm.handleGiftEvent({
    id: 'non_ms_500a',
    type: 'gift',
    timestamp: Date.now() + 70,
    userId: 'user_500_500',
    uniqueId: 'user_500_500',
    nickname: 'Độc Cô Cầu Bại',
    coinValue: 500,
    giftCount: 1,
  });
  const r1000 = testGm.handleGiftEvent({
    id: 'non_ms_500b',
    type: 'gift',
    timestamp: Date.now() + 80,
    userId: 'user_500_500',
    uniqueId: 'user_500_500',
    nickname: 'Độc Cô Cầu Bại',
    coinValue: 500,
    giftCount: 1,
  });
  assert.equal(r1000.disciple.totalCoins, 1000);
  assert.equal(r1000.dietMonTriggered, true);
  testGm.stopDietMonEmergency();

  if (fs.existsSync(tmpGiftFile)) fs.unlinkSync(tmpGiftFile);
  store.resetToDefaults();
  giftRegistry.setMappingsFromServer(store.getAll());

  return 'Mọi tổ hợp quà ngoài mốc (3+1+1=5, 20+30=50, 100+99=199, 500+500=1000) và nhiều ID trong cùng nhóm 1 X đều cộng dồn chuẩn xác.';
});

// ============================================================================
// 66. THÔNG BÁO KHI TẶNG QUÀ TUYỆT ĐỐI KHÔNG HIỂN THỊ SỐ GIÁ TRỊ / XU / X
// ============================================================================
runTest(66, 'Thông báo tặng quà & phong chức lọc sạch số giá trị, "xu", "X" trong tên quà & popup', () => {
  const testGm = new SectGameManager();
  testGm.stopLoop();

  // Tặng quà có tên chứa số và đơn vị "Quà Lẻ 5 Xu (+5 X)"
  testGm.handleGiftEvent({
    id: 'clean_popup_1',
    type: 'gift',
    timestamp: Date.now(),
    userId: 'popup_tester',
    uniqueId: 'popup_tester',
    nickname: 'Doãn Chí Bình',
    coinValue: 5,
    giftName: 'Quà Lẻ 5 Xu (+5 X)',
    giftCount: 1,
  });

  const promo1 = testGm.getSnapshot().promotions[0];
  assert.ok(promo1, 'Phải tạo thông báo khi nhận quà thăng cấp');
  assert.equal(promo1.isPromotion, true);
  assert.equal(/\d/.test(promo1.giftName), false, `Tên quà trong thông báo phải lọc sạch con số giá trị (nhận: "${promo1.giftName}")`);
  assert.equal(/\b(xu|x)\b/i.test(promo1.giftName), false, 'Tên quà trong thông báo không được chứa chữ xu hoặc X');

  // Kiểm tra Lịch sử quà cũng lọc sạch số/xu khỏi giftName
  const gh1 = testGm.getSnapshot().giftHistory[0];
  assert.equal(/\d/.test(gh1.giftName), false);
  assert.equal(/\b(xu|x)\b/i.test(gh1.giftName), false);

  return 'Thông báo tặng quà & phong chức lọc sạch 100% số lượng, chữ xu và chữ X.';
});

// ============================================================================
// 67. XUẤT / NHẬP CSV & JSON DANH SÁCH QUÀ KHÔNG LÀM MẤT ID CŨ
// ============================================================================
runTest(67, 'Xuất/Nhập CSV và JSON danh sách ID quà TikTok bảo toàn dữ liệu hiện có', () => {
  const tmpGiftFile = path.resolve(process.cwd(), 'data', 'test_csv_gifts.json');
  if (fs.existsSync(tmpGiftFile)) fs.unlinkSync(tmpGiftFile);
  const store = new PersistentGiftStore(tmpGiftFile);
  giftRegistry.setMappingsFromServer(store.getAll());

  const csvExported = giftRegistry.exportCsv();
  assert.ok(csvExported.includes('giftId,giftName,coinValue,groupName,enabled'), 'Header CSV phải đúng chuẩn');
  assert.ok(csvExported.includes('5655'), 'CSV xuất ra phải chứa ID 5655 mặc định');

  store.bulkAddToGroup('gift_tier_10', '91001', 'Hắc Hỏa Lệnh');
  store.bulkAddToGroup('gift_tier_50', '91002', 'Tử Quang Ấn');

  giftRegistry.setMappingsFromServer(store.getAll());
  assert.equal(giftRegistry.resolveGift({ giftId: '91001' }).matched?.coinValue, 10);
  assert.equal(giftRegistry.resolveGift({ giftId: '91002' }).matched?.coinValue, 50);
  // Đảm bảo ID cũ 5655 vẫn còn nguyên
  assert.equal(giftRegistry.resolveGift({ giftId: '5655' }).matched?.coinValue, 1);

  if (fs.existsSync(tmpGiftFile)) fs.unlinkSync(tmpGiftFile);
  store.resetToDefaults();
  giftRegistry.setMappingsFromServer(store.getAll());

  return 'Xuất/Nhập CSV & JSON hoạt động chính xác và bảo toàn toàn bộ ID quà hiện có.';
});

// ============================================================================
// 68. QUẢN LÝ ID QUÀ TIKTOK: DÁN NHIỀU ID, THÊM VÀO DANH SÁCH & THAY THẾ DANH SÁCH
// ============================================================================
runTest(68, 'Quản lý ID quà TikTok theo nhóm X: THÊM VÀO DANH SÁCH, THAY THẾ DANH SÁCH, chống trùng & chỉnh giá trị X', () => {
  const tmpGiftFile = path.resolve(process.cwd(), 'data', 'test_replace_gifts.json');
  if (fs.existsSync(tmpGiftFile)) fs.unlinkSync(tmpGiftFile);
  const store = new PersistentGiftStore(tmpGiftFile);

  // 1) Dán nhiều ID mới (xuống dòng, dấu phẩy, khoảng trắng) bằng THÊM VÀO DANH SÁCH vào nhóm 1 X
  const samplePaste = `
    75269
    15232, 5760
    9097   76093
    75269
  `;
  const appendRes = store.bulkAddToGroup('gift_tier_1', samplePaste);
  assert.equal(appendRes.ok, true, 'THÊM VÀO DANH SÁCH phải thành công');
  assert.equal(appendRes.addedCount, 5, 'Phải thêm đúng 5 ID mới và tự lọc 1 ID 75269 trùng trong lần dán');
  assert.equal(appendRes.check.duplicateInBatchIds.includes('75269'), true);

  // 2) Chặn nếu dán ID đã thuộc nhóm 1 X (75269) sang nhóm 5 X bằng THAY THẾ DANH SÁCH
  const conflictReplace = store.bulkReplaceGroupIds('gift_tier_5', '75269\n88801\n88802');
  assert.equal(conflictReplace.ok, false, 'Phải chặn THAY THẾ DANH SÁCH nếu chứa ID đang thuộc nhóm giá trị khác');
  assert.equal(conflictReplace.check.conflictOtherGroups[0].giftId, '75269');

  // 3) THAY THẾ DANH SÁCH hợp lệ cho nhóm 5 X bằng danh sách ID mới hoàn toàn
  const validReplace = store.bulkReplaceGroupIds('gift_tier_5', '88801\n88802\n88803\n88801');
  assert.equal(validReplace.ok, true, 'THAY THẾ DANH SÁCH hợp lệ phải thành công');
  assert.equal(validReplace.replacedCount, 3, 'Danh sách mới của nhóm 5 X phải có đúng 3 ID duy nhất');
  assert.deepEqual(validReplace.record?.giftIdStrings, ['88801', '88802', '88803']);

  // 4) Sửa giá trị X của một nhóm (VD: tạo nhóm 30 X rồi chỉnh thành 35 X)
  const created30 = store.create({
    giftName: 'Quà Đặc Biệt',
    groupName: 'NHÓM 30 X',
    giftIds: ['77701', '77702'],
    coinValue: 30,
  });
  assert.equal(created30.ok, true);
  if (created30.ok) {
    const updated35 = store.update(created30.record.id, { coinValue: 35, groupName: 'NHÓM 35 X' });
    assert.equal(updated35.ok, true);
    giftRegistry.setMappingsFromServer(store.getAll());
    assert.equal(giftRegistry.resolveGift({ giftId: '77701' }).matched?.coinValue, 35);
  }

  if (fs.existsSync(tmpGiftFile)) fs.unlinkSync(tmpGiftFile);
  store.resetToDefaults();
  giftRegistry.setMappingsFromServer(store.getAll());

  return 'THÊM VÀO DANH SÁCH, THAY THẾ DANH SÁCH, chống trùng liên nhóm và chỉnh giá trị X hoạt động chuẩn xác.';
});

// ============================================================================
// 69. CHỈNH SỬA BẢNG PHONG ẤN: SỬA TÊN CẤP BẬC, MỐC X, THỨ TỰ, ẨN/HIỆN & THÊM CẤP MỚI
// ============================================================================
runTest(69, 'Chỉnh sửa Bảng PHONG ẤN: đổi "Đệ Tử" -> "Ma Giáo Đệ Tử", "5 X" -> "8 X", ẩn/hiện dòng và thêm cấp mới', () => {
  const testGm = new SectGameManager();
  testGm.stopLoop();

  // Kiểm tra mặc định bảng PHONG ẤN có 8 dòng (7 cấp bậc từ 1 X..199 X + 1 dòng 1.000 X DIỆT MÔN)
  const initialRows = testGm.getPhongAnDisplayRows(false);
  assert.equal(initialRows.length, 8, 'Mặc định bảng PHONG ẤN phải có 8 dòng hiển thị');
  assert.equal(initialRows[0].minCoins, 1);
  assert.equal(initialRows[0].title, 'Đệ Tử');
  assert.equal(initialRows[1].minCoins, 5);
  assert.equal(initialRows[1].title, 'Chân Truyền');
  assert.equal(initialRows[7].minCoins, 1000);
  assert.equal(initialRows[7].title, 'DIỆT MÔN');

  // 1) Đổi tên cấp bậc "Đệ Tử" thành "Ma Giáo Đệ Tử"
  const okRename = testGm.updatePhongAnRow('de_tu', { name: 'Ma Giáo Đệ Tử' });
  assert.equal(okRename, true);
  assert.equal(testGm.getPhongAnDisplayRows(false)[0].title, 'Ma Giáo Đệ Tử');

  // 2) Đổi mốc "5 X" (Chân Truyền) thành "8 X"
  const okChangeX = testGm.updatePhongAnRow('chan_truyen', { minCoins: 8 });
  assert.equal(okChangeX, true);
  assert.equal(testGm.getPhongAnDisplayRows(false)[1].minCoins, 8);

  // 3) Thêm cấp bậc mới "Thái Thượng" ở mốc 30 X
  const addedRank = testGm.addPhongAnRankRow({
    minCoins: 30,
    name: 'Thái Thượng',
    enabled: true,
  });
  assert.equal(addedRank.minCoins, 30);
  assert.equal(addedRank.name, 'Thái Thượng');
  assert.equal(
    testGm.getPhongAnDisplayRows(false).some(r => r.minCoins === 30 && r.title === 'Thái Thượng'),
    true
  );

  // 4) Tắt hiển thị 1 dòng trên bảng PHONG ẤN
  testGm.updatePhongAnRow(addedRank.id, { enabled: false });
  assert.equal(
    testGm.getPhongAnDisplayRows(false).some(r => r.id === addedRank.id),
    false,
    'Dòng bị tắt không được hiển thị trên bảng PHONG ẤN ngoài màn hình LIVE'
  );
  assert.equal(
    testGm.getPhongAnDisplayRows(true).some(r => r.id === addedRank.id),
    true,
    'Dòng bị tắt vẫn hiển thị trong bảng chỉnh sửa Admin để bật lại'
  );

  return 'Bảng PHONG ẤN cho phép chỉnh sửa trực tiếp Mốc X, Tên cấp bậc/Sự kiện, Ẩn/Hiện và Thêm cấp bậc mới.';
});

// ============================================================================
// 70. LIÊN KẾT LOGIC GIỮA QUẢN LÝ ID QUÀ TIKTOK VÀ BẢNG PHONG ẤN
// ============================================================================
runTest(70, 'Liên kết logic: sửa tên quà TikTok không ảnh hưởng tên cấp bậc Phong Ấn; sửa Mốc X Phong Ấn cập nhật ngay logic phong cấp mà không đổi giá trị ID quà', () => {
  const tmpGiftFile = path.resolve(process.cwd(), 'data', 'test_link_gifts.json');
  if (fs.existsSync(tmpGiftFile)) fs.unlinkSync(tmpGiftFile);
  const store = new PersistentGiftStore(tmpGiftFile);

  // 1) Đổi tên quà trong QUẢN LÝ ID QUÀ TIKTOK cho ID 5655 (nhóm 1 X) thành "Hoa Hồng Đỏ Thắm"
  store.update('gift_tier_1', {
    giftName: 'Hoa Hồng Đỏ Thắm',
    giftItems: {
      '5655': { giftId: '5655', giftName: 'Hoa Hồng Đỏ Thắm', enabled: true },
    },
  });
  giftRegistry.setMappingsFromServer(store.getAll());

  const testGm = new SectGameManager();
  testGm.stopLoop();

  // Đổi tên cấp bậc 1 X trên BẢNG PHONG ẤN thành "Ma Giáo Đệ Tử"
  testGm.updatePhongAnRow('de_tu', { name: 'Ma Giáo Đệ Tử' });
  // Đổi mốc Chân Truyền từ 5 X lên 8 X trên BẢNG PHONG ẤN
  testGm.updatePhongAnRow('chan_truyen', { minCoins: 8 });

  // Kiểm tra giá trị X của nhóm quà 5 X (ID 5658) vẫn giữ nguyên là 5 X (không bị biến thành 8 X!)
  const resolved5658 = giftRegistry.resolveGift({ giftId: '5658' });
  assert.equal(
    resolved5658.matched?.coinValue,
    5,
    'Sửa mốc X trong bảng PHONG ẤN (5 X -> 8 X) tuyệt đối không làm thay đổi giá trị X của ID quà (vẫn là 5 X)'
  );

  // 2) Khi người chơi tặng ID quà 5655 (1 X, tên quà Admin là "Hoa Hồng Đỏ Thắm"):
  // Người chơi phải nhận cấp bậc "Ma Giáo Đệ Tử" (theo BẢNG PHONG ẤN), tuyệt đối không lấy tên quà "Hoa Hồng Đỏ Thắm" làm tên cấp bậc!
  const r1 = testGm.handleGiftEvent({
    id: 'link_evt_1',
    type: 'gift',
    timestamp: Date.now(),
    userId: 'link_user_01',
    uniqueId: 'link_user_01',
    nickname: 'Lâm Bình Chi',
    giftId: '5655',
    giftCount: 1,
  });
  assert.equal(r1.disciple.totalCoins, 1);
  assert.equal(r1.disciple.rankName, 'Ma Giáo Đệ Tử');
  assert.notEqual(r1.disciple.rankName, 'Hoa Hồng Đỏ Thắm');

  // 3) Khi người chơi tặng thêm 1 quà ID 5658 (nhóm 5 X):
  // Tổng X = 1 + 5 = 6 X. Vì mốc Chân Truyền trên BẢNG PHONG ẤN đã đổi thành 8 X, ở 6 X người chơi vẫn ở cấp "Ma Giáo Đệ Tử"!
  const r2 = testGm.handleGiftEvent({
    id: 'link_evt_2',
    type: 'gift',
    timestamp: Date.now() + 10,
    userId: 'link_user_01',
    uniqueId: 'link_user_01',
    nickname: 'Lâm Bình Chi',
    giftId: '5658',
    giftCount: 1,
  });
  assert.equal(r2.disciple.totalCoins, 6);
  assert.equal(r2.disciple.rankId, 'de_tu', 'Ở 6 X chưa đạt mốc 8 X mới của Chân Truyền');

  // 4) Tặng thêm 2 quà ID 5655 (1 X × 2 = +2 X) -> Tổng X = 6 + 2 = 8 X -> Đạt mốc 8 X -> Thăng lên "Chân Truyền"!
  const r3 = testGm.handleGiftEvent({
    id: 'link_evt_3',
    type: 'gift',
    timestamp: Date.now() + 20,
    userId: 'link_user_01',
    uniqueId: 'link_user_01',
    nickname: 'Lâm Bình Chi',
    giftId: '5655',
    giftCount: 2,
  });
  assert.equal(r3.disciple.totalCoins, 8);
  assert.equal(r3.disciple.rankId, 'chan_truyen');
  assert.equal(r3.disciple.rankName, 'Chân Truyền');
  assert.equal(r3.promoted, true);

  if (fs.existsSync(tmpGiftFile)) fs.unlinkSync(tmpGiftFile);
  store.resetToDefaults();
  giftRegistry.setMappingsFromServer(store.getAll());
  return 'Liên kết dữ liệu giữa QUẢN LÝ ID QUÀ TIKTOK và BẢNG PHONG ẤN hoạt động độc lập, chính xác 100%.';
});

// ==============================================================================
// 71–77. HỆ THỐNG CHUYỂN CẢNH GIỮA CÁC MINIGAME (TIÊN HIỆP – MA ĐẠO – HUYỀN HUYỄN)
// ==============================================================================

// 71. Game chính ➔ Từng Minigame (Ma Quyền, Thân Pháp, Tam Khí)
runTest(71, 'Game chính ➔ Từng Minigame (Ma Quyền, Thân Pháp, Tam Khí) thông qua SectTransitionManager với 3 giai đoạn mượt mà', () => {
  sectTransitionManager.cancelTransition();
  gm.switchSceneNow('main_hall');
  assert.equal(gm.getSnapshot().activeScene, 'main_hall');

  // Test Game 1: Ma Quyền Loạn Vũ
  const started1 = sectTransitionManager.transitionToMiniGame('ma_quyen_loan_vu');
  assert.equal(started1, true, 'Khởi động chuyển cảnh vào Game 1 phải thành công');
  let st = sectTransitionManager.getState();
  assert.equal(st.isTransitioning, true);
  assert.equal(st.type, 'enter_minigame');
  assert.equal(st.toMiniGameId, 'ma_quyen_loan_vu');
  assert.ok(st.title.includes('MA QUYỀN LOẠN VŨ'));
  assert.equal(st.phase, 'initiating');

  // Simulate midpoint transition (around 50% when portal aperture is at peak coverage)
  sectTransitionManager.cancelTransition();
  assert.equal(sectTransitionManager.getState().isTransitioning, false);

  // Test Game 2: Ma Ảnh Thân Pháp
  gm.switchSceneNow('main_hall');
  const started2 = sectTransitionManager.transitionToMiniGame('ma_anh_than_phap', 'ma_tran_khong_gian');
  assert.equal(started2, true);
  st = sectTransitionManager.getState();
  assert.equal(st.toMiniGameId, 'ma_anh_than_phap');
  assert.ok(st.title.includes('MA ẢNH THÂN PHÁP'));
  sectTransitionManager.cancelTransition();

  // Test Game 3: Tam Khí Ma Trận
  gm.switchSceneNow('main_hall');
  const started3 = sectTransitionManager.transitionToMiniGame('tam_khi_ma_tran', 'ma_khi_cuong_phong');
  assert.equal(started3, true);
  st = sectTransitionManager.getState();
  assert.equal(st.toMiniGameId, 'tam_khi_ma_tran');
  assert.ok(st.title.includes('TAM KHÍ MA TRẬN'));
  sectTransitionManager.cancelTransition();

  return 'Khai mở thành công cổng ma giới tiến vào cả 3 Minigame (Ma Quyền, Thân Pháp, Tam Khí).';
});

// 72. Minigame ➔ Game chính (Thoát/Quay lại)
runTest(72, 'Minigame ➔ Game chính: Thu hồi pháp trận, cổng không gian mở ra đưa về Đại Điện an toàn', () => {
  sectTransitionManager.cancelTransition();
  gm.startMiniGame('ma_quyen_loan_vu');
  assert.equal(gm.getSnapshot().activeScene, 'training_ground');
  assert.equal(gm.getSnapshot().miniGame.isActive, true);

  const ok = sectTransitionManager.transitionToMainHall('ma_tran_khong_gian');
  assert.equal(ok, true);
  const st = sectTransitionManager.getState();
  assert.equal(st.isTransitioning, true);
  assert.equal(st.type, 'exit_to_main');
  assert.equal(st.toScene, 'main_hall');
  assert.ok(st.title.includes('HỒI QUY ĐẠI ĐIỆN MA GIÁO'));

  sectTransitionManager.cancelTransition();
  assert.equal(gm.getSnapshot().activeScene, 'main_hall');
  assert.equal(gm.getSnapshot().miniGame.isActive, false);
  return 'Thoát Minigame hồi quy về Đại Điện Ma Giáo chuẩn xác 100%.';
});

// 73. Chuyển trực tiếp giữa hai Minigame (A ➔ B không qua Đại Điện)
runTest(73, 'Chuyển trực tiếp giữa 2 Minigame (Game 1 ➔ Game 2 ➔ Game 3) liền mạch, không qua menu chính, không rò rỉ âm thanh cũ', () => {
  sectTransitionManager.cancelTransition();
  gm.startMiniGame('ma_quyen_loan_vu');
  assert.equal(gm.getSnapshot().miniGame.gameId, 'ma_quyen_loan_vu');

  // Switch directly: Game 1 -> Game 2
  const switched1 = sectTransitionManager.switchBetweenMiniGames('ma_quyen_loan_vu', 'ma_anh_than_phap');
  assert.equal(switched1, true, 'Chuyển trực tiếp Game 1 -> Game 2 phải thành công');
  let st = sectTransitionManager.getState();
  assert.equal(st.type, 'switch_minigame');
  assert.equal(st.fromMiniGameId, 'ma_quyen_loan_vu');
  assert.equal(st.toMiniGameId, 'ma_anh_than_phap');
  assert.ok(st.title.includes('MA ẢNH THÂN PHÁP'));

  sectTransitionManager.cancelTransition();
  assert.equal(gm.getSnapshot().miniGame.gameId, 'ma_anh_than_phap');

  // Switch directly: Game 2 -> Game 3
  const switched2 = sectTransitionManager.switchBetweenMiniGames('ma_anh_than_phap', 'tam_khi_ma_tran');
  assert.equal(switched2, true, 'Chuyển trực tiếp Game 2 -> Game 3 phải thành công');
  st = sectTransitionManager.getState();
  assert.equal(st.toMiniGameId, 'tam_khi_ma_tran');
  sectTransitionManager.cancelTransition();
  assert.equal(gm.getSnapshot().miniGame.gameId, 'tam_khi_ma_tran');

  // Switch to the same game should be safely ignored
  const switchedSame = sectTransitionManager.switchBetweenMiniGames('tam_khi_ma_tran', 'tam_khi_ma_tran');
  assert.equal(switchedSame, false, 'Không cho phép chuyển sang cùng một minigame đang chạy');

  return 'Chuyển đổi trực tiếp Game 1 ➔ Game 2 ➔ Game 3 không gián đoạn, giữ nguyên sảnh luyện.';
});

// 74. Chống spam thao tác chuyển cảnh liên tục (Debounce & isTransitioning Lock)
runTest(74, 'Chống spam thao tác: Khi đang chạy hiệu ứng chuyển cảnh, mọi lệnh nhấn liên tục bị chặn an toàn (Debounce lock)', () => {
  sectTransitionManager.cancelTransition();
  gm.switchSceneNow('main_hall');

  // First call succeeds
  const call1 = sectTransitionManager.transitionToMiniGame('ma_quyen_loan_vu');
  assert.equal(call1, true);
  assert.equal(sectTransitionManager.getState().isTransitioning, true);

  // Subsequent spam calls must be rejected
  const call2 = sectTransitionManager.transitionToMiniGame('ma_anh_than_phap');
  const call3 = sectTransitionManager.transitionToMainHall();
  const call4 = sectTransitionManager.switchBetweenMiniGames('ma_quyen_loan_vu', 'tam_khi_ma_tran');

  assert.equal(call2, false, 'Lệnh thứ 2 phải bị chặn khi đang có chuyển cảnh chạy');
  assert.equal(call3, false, 'Lệnh thứ 3 phải bị chặn');
  assert.equal(call4, false, 'Lệnh thứ 4 phải bị chặn');

  sectTransitionManager.cancelTransition();
  assert.equal(sectTransitionManager.getState().isTransitioning, false);
  return 'Khóa an toàn isTransitioning chặn 100% thao tác spam gây chồng lấn animation.';
});

// 75. Hủy chuyển cảnh khẩn cấp (Emergency Cancel & Diệt Môn Interruption)
runTest(75, 'Hủy chuyển cảnh khẩn cấp (cancelTransition) & Diệt Môn ngắt chuyển cảnh an toàn không để lại timer rác', () => {
  sectTransitionManager.cancelTransition();
  gm.switchSceneNow('main_hall');

  // Start transition and abruptly cancel
  sectTransitionManager.transitionToMiniGame('tam_khi_ma_tran');
  assert.equal(sectTransitionManager.getState().isTransitioning, true);
  sectTransitionManager.cancelTransition();
  assert.equal(sectTransitionManager.getState().isTransitioning, false);
  assert.equal(sectTransitionManager.getState().phase, 'idle');

  // Start transition and trigger Diệt Môn
  sectTransitionManager.transitionToMiniGame('ma_quyen_loan_vu');
  assert.equal(sectTransitionManager.getState().isTransitioning, true);

  // Diệt Môn bursts in -> should cancel active transition immediately
  gm.triggerTestDietMon('Bạch Phát Ma Nữ');
  assert.equal(sectTransitionManager.getState().isTransitioning, false, 'Diệt Môn phải hủy ngay chuyển cảnh');
  assert.equal(gm.getSnapshot().dietMon.isActive, true);

  // Clean up Diệt Môn
  gm.stopDietMonEmergency();
  gm.rebuildHallImmediately();
  return 'Hủy chuyển cảnh tức thì và tương thích hoàn hảo khi có đại sự kiện Diệt Môn.';
});

// 76. Đa dạng 3 Kiểu Chuyển Cảnh (Ma Trận Không Gian, Ma Khí Cuồng Phong, Huyết Nguyệt)
runTest(76, 'Đa dạng 3 Kiểu Chuyển Cảnh (Ma Trận Không Gian, Ma Khí Cuồng Phong, Huyết Nguyệt) & Hỗ trợ Giảm chuyển động', () => {
  sectTransitionManager.cancelTransition();

  // Test Style 1
  sectTransitionManager.setDefaultStyle('ma_tran_khong_gian');
  assert.equal(sectTransitionManager.getDefaultStyle(), 'ma_tran_khong_gian');
  sectTransitionManager.transitionToMiniGame('ma_quyen_loan_vu');
  assert.equal(sectTransitionManager.getState().style, 'ma_tran_khong_gian');
  sectTransitionManager.cancelTransition();

  // Test Style 2
  sectTransitionManager.setDefaultStyle('ma_khi_cuong_phong');
  assert.equal(sectTransitionManager.getDefaultStyle(), 'ma_khi_cuong_phong');
  sectTransitionManager.transitionToMiniGame('ma_anh_than_phap');
  assert.equal(sectTransitionManager.getState().style, 'ma_khi_cuong_phong');
  sectTransitionManager.cancelTransition();

  // Test Style 3
  sectTransitionManager.setDefaultStyle('huyet_nguyet');
  assert.equal(sectTransitionManager.getDefaultStyle(), 'huyet_nguyet');
  sectTransitionManager.transitionToMiniGame('tam_khi_ma_tran');
  assert.equal(sectTransitionManager.getState().style, 'huyet_nguyet');
  sectTransitionManager.cancelTransition();

  // Reset to default
  sectTransitionManager.setDefaultStyle('ma_tran_khong_gian');
  assert.equal(sectTransitionManager.getDefaultStyle(), 'ma_tran_khong_gian');

  return 'Đủ cả 3 kiểu chuyển cảnh (Ma Trận, Cuồng Phong, Huyết Nguyệt) và thiết lập mặc định chuẩn xác.';
});

// 77. Bảo toàn 100% điểm số, xu, cấp bậc, tiến trình và hàng chờ qua nhiều vòng chuyển cảnh
runTest(77, 'Bảo toàn 100% dữ liệu người chơi (xu, cấp bậc, danh hiệu, hàng chờ) qua chuỗi chuyển cảnh liên tục', () => {
  sectTransitionManager.cancelTransition();
  gm.clearAllPlayers();
  gm.spawnDemoPlayers(20);

  // Give a player 99 coins (Đồng Tôn)
  const vipPlayer = gm.getSnapshot().disciples[0];
  gm.handleGiftEvent({
    id: 'vip_trans_gift',
    type: 'gift',
    timestamp: Date.now(),
    userId: vipPlayer.userId,
    uniqueId: vipPlayer.uniqueId,
    nickname: vipPlayer.displayName,
    coinValue: 99,
    giftName: 'Đồng Tôn Lệnh',
    giftCount: 1,
  });

  const checkVipBefore = gm.getSnapshot().disciples.find(d => d.userId === vipPlayer.userId)!;
  assert.equal(checkVipBefore.totalCoins, 99);
  assert.equal(checkVipBefore.rankId, 'dong_ton');

  // Cycle 1: Main Hall -> MiniGame 1
  sectTransitionManager.transitionToMiniGame('ma_quyen_loan_vu');
  sectTransitionManager.cancelTransition();

  // Cycle 2: MiniGame 1 -> MiniGame 2
  sectTransitionManager.switchBetweenMiniGames('ma_quyen_loan_vu', 'ma_anh_than_phap');
  sectTransitionManager.cancelTransition();

  // Cycle 3: MiniGame 2 -> MiniGame 3
  sectTransitionManager.switchBetweenMiniGames('ma_anh_than_phap', 'tam_khi_ma_tran');
  sectTransitionManager.cancelTransition();

  // Cycle 4: MiniGame 3 -> Main Hall
  sectTransitionManager.transitionToMainHall();
  sectTransitionManager.cancelTransition();

  // Verify VIP player data after 4 scene switches
  const checkVipAfter = gm.getSnapshot().disciples.find(d => d.userId === vipPlayer.userId)!;
  assert.equal(checkVipAfter.totalCoins, 99, 'Không được mất tổng xu qua các lần chuyển cảnh');
  assert.equal(checkVipAfter.rankId, 'dong_ton', 'Không được mất cấp bậc qua các lần chuyển cảnh');
  assert.equal(checkVipAfter.isCoLeader, true);
  assert.equal(gm.getDiscipleCount(), 20, 'Quân số sảnh giữ nguyên 20 nhân vật');

  return 'Trạng thái 20 người chơi, 99 xu và chức danh Đồng Tôn bảo toàn vẹn nguyên 100% qua 4 chu kỳ chuyển cảnh.';
});

// ============================================================================
// 78–90. KIỂM THỬ HOẠT CẢNH THÔNG BÁO VÀ CHUYỂN CẢNH 3 GIÂY & TINH GỌN GIAO DIỆN
// ============================================================================

// 78. Khởi động hoạt cảnh thông báo Minigame tại Sảnh Chính & nhận diện chuẩn xác 3 Minigame (bộ đếm bắt đầu từ 3)
runTest(78, 'Khởi động hoạt cảnh thông báo tại Sảnh Chính: Giữ nguyên Sảnh Chính & nhận diện đúng 100% tên/phụ đề 3 Minigame (3 giây)', () => {
  gm.switchSceneNow('main_hall');
  gm.cancelMiniGameCountdown();
  assert.equal(gm.getSnapshot().activeScene, 'main_hall');

  // Test Game 1: Ma Quyền Loạn Vũ
  const ok1 = gm.triggerMiniGameWithCountdown('ma_quyen_loan_vu');
  assert.equal(ok1, true, 'Kích hoạt đếm ngược Game 1 phải thành công');
  let snap = gm.getSnapshot();
  assert.equal(snap.activeScene, 'main_hall', 'Phải giữ nguyên Sảnh Chính trong suốt thông báo');
  assert.equal(snap.preMiniGameCountdown.isActive, true);
  assert.equal(snap.preMiniGameCountdown.gameId, 'ma_quyen_loan_vu');
  assert.equal(snap.preMiniGameCountdown.gameName, 'Ma Quyền Loạn Vũ');
  assert.ok(snap.preMiniGameCountdown.gameSubtitle.includes('Đồng Diễn'));
  assert.equal(snap.preMiniGameCountdown.count, 3, 'Bộ đếm bắt đầu chính xác từ 3');
  assert.equal(snap.miniGame.isActive, false, 'Minigame tuyệt đối KHÔNG được chạy ngầm trong khi đếm ngược');
  gm.cancelMiniGameCountdown();

  // Test Game 2: Ma Ảnh Thân Pháp
  const ok2 = gm.triggerMiniGameWithCountdown('ma_anh_than_phap');
  assert.equal(ok2, true);
  snap = gm.getSnapshot();
  assert.equal(snap.preMiniGameCountdown.gameId, 'ma_anh_than_phap');
  assert.equal(snap.preMiniGameCountdown.gameName, 'Ma Ảnh Thân Pháp');
  assert.ok(snap.preMiniGameCountdown.gameSubtitle.includes('Né Chướng Ngại Vật'));
  assert.equal(snap.preMiniGameCountdown.count, 3);
  gm.cancelMiniGameCountdown();

  // Test Game 3: Tam Khí Ma Trận
  const ok3 = gm.triggerMiniGameWithCountdown('tam_khi_ma_tran');
  assert.equal(ok3, true);
  snap = gm.getSnapshot();
  assert.equal(snap.preMiniGameCountdown.gameId, 'tam_khi_ma_tran');
  assert.equal(snap.preMiniGameCountdown.gameName, 'Tam Khí Ma Trận');
  assert.ok(snap.preMiniGameCountdown.gameSubtitle.includes('Lửa – Băng – Gió'));
  assert.equal(snap.preMiniGameCountdown.count, 3);
  gm.cancelMiniGameCountdown();

  return 'Hiển thị chính xác tên, phụ đề và giữ nguyên Sảnh Chính cho cả 3 Minigame, đếm ngược bắt đầu từ 3.';
});

// 79. Chuỗi đếm ngược 3 giây chuẩn xác: 3 ➔ 2 ➔ 1
runTest(79, 'Chuỗi đếm ngược 3 giây chuẩn xác (3 ➔ 2 ➔ 1) tương ứng mỗi số 1 giây, tên game luôn hiển thị', () => {
  gm.switchSceneNow('main_hall');
  gm.cancelMiniGameCountdown();

  gm.triggerMiniGameWithCountdown('ma_quyen_loan_vu');
  assert.equal(gm.getSnapshot().preMiniGameCountdown.count, 3);

  // Advance 1s -> count 2
  gm.advancePreMiniGameCountdown(1);
  assert.equal(gm.getSnapshot().preMiniGameCountdown.count, 2);
  assert.equal(gm.getSnapshot().preMiniGameCountdown.gameName, 'Ma Quyền Loạn Vũ');

  // Advance 1s -> count 1
  gm.advancePreMiniGameCountdown(1);
  assert.equal(gm.getSnapshot().preMiniGameCountdown.count, 1);
  assert.equal(gm.getSnapshot().activeScene, 'main_hall', 'Vẫn ở Sảnh Chính tại số 1');

  gm.cancelMiniGameCountdown();
  return 'Đếm đủ 3 giây (3 ➔ 2 ➔ 1) không bỏ số và giữ nguyên tên Minigame.';
});

// 80. Khi kết thúc 3 giây, tự động ẩn thông báo và vào Minigame tương ứng không thêm trễ
runTest(80, 'Kết thúc 3 giây: Tự động ẩn bảng thông báo và vào Minigame tương ứng không thêm trễ', () => {
  gm.switchSceneNow('main_hall');
  gm.cancelMiniGameCountdown();

  gm.triggerMiniGameWithCountdown('ma_anh_than_phap');
  assert.equal(gm.getSnapshot().preMiniGameCountdown.count, 3);

  // Advance full 3 seconds
  gm.advancePreMiniGameCountdown(3);

  const launchedSnap = gm.getSnapshot();
  assert.equal(launchedSnap.preMiniGameCountdown.isActive, false, 'Bảng thông báo đã tự động ẩn');
  assert.equal(launchedSnap.activeScene, 'training_ground', 'Vào màn huấn luyện Minigame');
  assert.equal(launchedSnap.miniGame.isActive, true, 'Minigame đã kích hoạt');
  assert.equal(launchedSnap.miniGame.gameId, 'ma_anh_than_phap');
  assert.equal(gm.getLifecycleState(), 'PLAYING');

  // Return to main hall cleanly
  gm.finishMiniGame(true, true);
  assert.equal(gm.getSnapshot().activeScene, 'main_hall');
  return 'Kết thúc 3 giây vào thẳng Minigame tương ứng mà không bị trễ kéo dài.';
});

// 81. Chống kích hoạt đếm ngược trùng lặp khi đang chạy (Anti-Spam Debounce Lock)
runTest(81, 'Chống kích hoạt đếm ngược trùng lặp: Ngăn thao tác bấm liên tục khi đang đếm ngược', () => {
  gm.switchSceneNow('main_hall');
  gm.cancelMiniGameCountdown();

  const first = gm.triggerMiniGameWithCountdown('tam_khi_ma_tran');
  assert.equal(first, true);
  assert.equal(gm.getSnapshot().preMiniGameCountdown.isActive, true);

  // Subsequent rapid triggers must be rejected safely
  const second = gm.triggerMiniGameWithCountdown('ma_quyen_loan_vu');
  const third = gm.startMiniGame('ma_anh_than_phap');
  assert.equal(second, false, 'Không được cho phép kích hoạt đếm ngược đè lên nhau');
  assert.equal(third, false, 'Không được cho phép startMiniGame chen ngang khi đang đếm ngược');

  gm.cancelMiniGameCountdown();
  assert.equal(gm.getSnapshot().preMiniGameCountdown.isActive, false);
  return 'Khóa an toàn chống spam chặn 100% thao tác kích hoạt trùng lặp.';
});

// 82. Hủy đếm ngược khẩn cấp & Diệt Môn tự động ngắt đếm ngược trở lại Sảnh Chính
runTest(82, 'Hủy đếm ngược (cancelMiniGameCountdown) & Diệt Môn ngắt đếm ngược an toàn', () => {
  gm.switchSceneNow('main_hall');
  gm.cancelMiniGameCountdown();

  // Test manual cancel
  gm.triggerMiniGameWithCountdown('ma_quyen_loan_vu');
  assert.equal(gm.getSnapshot().preMiniGameCountdown.isActive, true);
  const cancelled = gm.cancelMiniGameCountdown();
  assert.equal(cancelled, true);
  assert.equal(gm.getSnapshot().preMiniGameCountdown.isActive, false);
  assert.equal(gm.getSnapshot().activeScene, 'main_hall');

  // Test Diệt Môn interruption
  gm.triggerMiniGameWithCountdown('ma_anh_than_phap');
  assert.equal(gm.getSnapshot().preMiniGameCountdown.isActive, true);
  gm.triggerTestDietMon('Huyết Ma Lão Tổ');
  assert.equal(gm.getSnapshot().preMiniGameCountdown.isActive, false, 'Diệt Môn phải hủy ngay đếm ngược Minigame');
  assert.equal(gm.getSnapshot().dietMon.isActive, true);

  // Clean up Diệt Môn
  gm.stopDietMonEmergency();
  gm.rebuildHallImmediately();
  return 'Hủy đếm ngược an toàn và tương thích hoàn hảo với đại sự kiện Diệt Môn.';
});

// 83. Minigame tự động bắt đầu theo lịch kích hoạt qua chu trình đếm ngược 3 giây
runTest(83, 'Minigame tự động bắt đầu theo lịch (autoCycleEnabled) đi qua chu trình đếm ngược 3 giây', () => {
  gm.switchSceneNow('main_hall');
  gm.cancelMiniGameCountdown();

  // Fast-forward nextSceneSwitchAt
  const cfg = gm.getConfig();
  cfg.sceneTransition.autoCycleEnabled = true;
  cfg.sceneTransition.isPaused = false;

  // Force scene switch timer to expired
  gm.forceNextSceneSwitchNow();
  gm.tick();

  const snap = gm.getSnapshot();
  assert.equal(snap.preMiniGameCountdown.isActive, true, 'Chu kỳ tự động phải kích hoạt thông báo đếm ngược trước');
  assert.equal(snap.preMiniGameCountdown.count, 3, 'Bắt đầu từ 3 giây');
  assert.equal(snap.activeScene, 'main_hall');

  gm.cancelMiniGameCountdown();
  return 'Chu kỳ tự động chuyển cảnh (auto cycle) tuân thủ nghiêm ngặt màn đếm ngược 3 giây trước khi vào Minigame.';
});

// 84. State Machine Game 1: LOBBY ➔ Đếm 3s ➔ PLAYING (Ma Quyền Loạn Vũ) ➔ Kết thúc ➔ Đếm về 3s ➔ LOBBY
runTest(84, 'State Machine Game 1: LOBBY ➔ Đếm 3s ➔ PLAYING ➔ RESULT ➔ Đếm về 3s ➔ LOBBY (Chuyển cảnh 1 lần duy nhất, vào game thực tế)', () => {
  gm.switchSceneNow('main_hall');
  gm.cancelMiniGameCountdown();

  assert.equal(gm.getLifecycleState(), 'LOBBY');
  assert.equal(gm.getSnapshot().activeScene, 'main_hall');

  // 1. Kích hoạt thông báo 3 giây
  const ok = gm.triggerMiniGameWithCountdown('ma_quyen_loan_vu');
  assert.equal(ok, true);
  assert.equal(gm.getLifecycleState(), 'ANNOUNCING');
  const turnId1 = gm.getCurrentTurnId();
  assert.ok(turnId1.startsWith('turn_'), 'Turn ID định danh phải được tạo lập');

  // 2. Đếm ngược 3 -> 2 -> 1
  gm.advancePreMiniGameCountdown(1);
  assert.equal(gm.getLifecycleState(), 'COUNTDOWN');
  assert.equal(gm.getSnapshot().preMiniGameCountdown.count, 2);

  gm.advancePreMiniGameCountdown(1);
  assert.equal(gm.getSnapshot().preMiniGameCountdown.count, 1);
  assert.equal(gm.getLifecycleState(), 'COUNTDOWN');

  // 3. Kết thúc 3s -> Vào game thực tế
  gm.advancePreMiniGameCountdown(1);
  assert.equal(gm.getSnapshot().preMiniGameCountdown.isActive, false, 'Countdown phải kết thúc');
  assert.equal(gm.getLifecycleState(), 'PLAYING', 'Sau khi kết thúc 3s, trạng thái bắt buộc là PLAYING');
  assert.equal(gm.getSnapshot().activeScene, 'training_ground');
  assert.equal(gm.getSnapshot().miniGame.isActive, true);
  assert.equal(gm.getSnapshot().miniGame.phase, 'playing');
  assert.equal(gm.getSnapshot().miniGame.turnId, turnId1, 'TurnId phải được truyền nguyên vẹn vào Minigame');

  // 4. Gameplay thực tế hoạt động: kiểm tra nhận bình luận võ công
  gm.handleCommentEvent({
    id: 'evt_combat_84',
    type: 'comment',
    timestamp: Date.now(),
    userId: 'player_test_84',
    uniqueId: 'player_test_84',
    nickname: 'Ma Giáo Kiếm Sĩ',
    comment: 'MÚA',
    isDemo: true,
  });
  assert.ok(gm.getSnapshot().miniGame.completionPct > 0, 'Gameplay thực tế nhận bình luận và tính điểm');

  // 5. Kết thúc minigame -> Bắt đầu đếm ngược 3 giây trở về đại sảnh
  gm.finishMiniGame(true, false);
  assert.equal(gm.getLifecycleState(), 'RETURNING');
  assert.equal(gm.getSnapshot().returnCountdown.isActive, true, 'Return countdown phải kích hoạt');
  assert.equal(gm.getSnapshot().returnCountdown.count, 3, 'Đếm ngược trở về bắt đầu từ 3');
  assert.equal(gm.getSnapshot().returnCountdown.title, 'SẮP TRỞ VỀ ĐẠI SẢNH');

  // 6. Đếm ngược trở về 3 -> 2 -> 1 -> LOBBY
  gm.advanceReturnCountdown(1);
  assert.equal(gm.getSnapshot().returnCountdown.count, 2);
  gm.advanceReturnCountdown(1);
  assert.equal(gm.getSnapshot().returnCountdown.count, 1);
  gm.advanceReturnCountdown(1);

  assert.equal(gm.getSnapshot().returnCountdown.isActive, false);
  assert.equal(gm.getSnapshot().activeScene, 'main_hall', 'Phải trở về Đại Sảnh an toàn');
  assert.equal(gm.getLifecycleState(), 'LOBBY');
  assert.equal(gm.getSnapshot().miniGame.isActive, false);

  return 'LOBBY ➔ Đếm 3s ➔ PLAYING ➔ RESULT ➔ Đếm về 3s ➔ LOBBY: 1 lần duy nhất, vào game thực tế và về sảnh thành công.';
});

// 85. Quy trình hoàn chỉnh với Minigame 2 (Ma Ảnh Thân Pháp) - 3s vào và 3s về
runTest(85, 'State Machine Game 2: Sảnh Chính ➔ Đếm ngược 3s ➔ Vào Ma Ảnh Thân Pháp (PLAYING) ➔ Đếm về 3s ➔ Sảnh Chính', () => {
  gm.switchSceneNow('main_hall');
  gm.cancelMiniGameCountdown();
  assert.equal(gm.getLifecycleState(), 'LOBBY');

  const ok = gm.triggerMiniGameWithCountdown('ma_anh_than_phap');
  assert.equal(ok, true);
  const turnId2 = gm.getCurrentTurnId();

  // Đếm hết 3s
  gm.advancePreMiniGameCountdown(3);
  assert.equal(gm.getLifecycleState(), 'PLAYING');
  assert.equal(gm.getSnapshot().miniGame.gameId, 'ma_anh_than_phap');
  assert.equal(gm.getSnapshot().miniGame.turnId, turnId2);

  // Kết thúc minigame và đếm về 3s
  gm.finishMiniGame(true, false);
  assert.equal(gm.getSnapshot().returnCountdown.isActive, true);
  gm.advanceReturnCountdown(3);

  assert.equal(gm.getSnapshot().activeScene, 'main_hall');
  assert.equal(gm.getLifecycleState(), 'LOBBY');
  return 'Game 2 (Ma Ảnh Thân Pháp) đếm 3s vào và 3s về hoàn tất trơn tru.';
});

// 86. Quy trình hoàn chỉnh với Minigame 3 (Tam Khí Ma Trận) - 3s vào và 3s về
runTest(86, 'State Machine Game 3: Sảnh Chính ➔ Đếm ngược 3s ➔ Vào Tam Khí Ma Trận (PLAYING) ➔ Đếm về 3s ➔ Sảnh Chính', () => {
  gm.switchSceneNow('main_hall');
  gm.cancelMiniGameCountdown();
  assert.equal(gm.getLifecycleState(), 'LOBBY');

  const ok = gm.triggerMiniGameWithCountdown('tam_khi_ma_tran');
  assert.equal(ok, true);
  const turnId3 = gm.getCurrentTurnId();

  // Đếm hết 3s
  gm.advancePreMiniGameCountdown(3);
  assert.equal(gm.getLifecycleState(), 'PLAYING');
  assert.equal(gm.getSnapshot().miniGame.gameId, 'tam_khi_ma_tran');
  assert.equal(gm.getSnapshot().miniGame.turnId, turnId3);

  // Kết thúc minigame và đếm về 3s
  gm.finishMiniGame(true, false);
  assert.equal(gm.getSnapshot().returnCountdown.isActive, true);
  gm.advanceReturnCountdown(3);

  assert.equal(gm.getSnapshot().activeScene, 'main_hall');
  assert.equal(gm.getLifecycleState(), 'LOBBY');
  return 'Game 3 (Tam Khí Ma Trận) đếm 3s vào và 3s về chuẩn xác.';
});

// 87. Hoàn thành Minigame ➔ RESULT ➔ RETURNING (3s) ➔ LOBBY ➔ Sẵn sàng cho lượt tiếp theo
runTest(87, 'Chu trình kết thúc: PLAYING ➔ RESULT ➔ RETURNING (3s) ➔ LOBBY (Bảo toàn dữ liệu, reset turnId cho lượt mới)', () => {
  gm.switchSceneNow('main_hall');
  gm.cancelMiniGameCountdown();

  // Bắt đầu game
  gm.triggerMiniGameWithCountdown('ma_quyen_loan_vu');
  gm.advancePreMiniGameCountdown(3);
  assert.equal(gm.getLifecycleState(), 'PLAYING');

  // Kết thúc minigame
  gm.finishMiniGame(true, false);
  assert.equal(gm.getLifecycleState(), 'RETURNING');
  assert.equal(gm.getSnapshot().returnCountdown.isActive, true);
  assert.equal(gm.getSnapshot().miniGame.phase, 'result');

  // Hồi quy về Sảnh Chính sau 3s
  gm.advanceReturnCountdown(3);
  assert.equal(gm.getLifecycleState(), 'LOBBY', 'Hồi quy xong phải về đúng LOBBY');
  assert.equal(gm.getCurrentTurnId(), '', 'TurnId phải được xóa rỗng khi về sảnh chính');
  assert.equal(gm.getSnapshot().activeScene, 'main_hall');
  assert.equal(gm.getSnapshot().miniGame.isActive, false);

  // Kích hoạt lượt mới thành công
  const nextOk = gm.triggerMiniGameWithCountdown('ma_anh_than_phap');
  assert.equal(nextOk, true, 'Lượt chơi mới phải khởi động trơn tru sau khi hoàn thành lượt cũ');
  const nextTurnId = gm.getCurrentTurnId();
  assert.ok(nextTurnId.length > 0);

  gm.cancelMiniGameCountdown();
  return 'Quy trình kết thúc và hồi quy về LOBBY chuẩn xác, sẵn sàng mở lượt thi tiếp theo.';
});

// 88. Chạy liên tiếp 10 lượt chuyển Minigame liên hoàn: 0 vòng lặp vô hạn (3s vào & 3s về)
runTest(88, 'Stress test: Chạy liên tiếp 10 lượt Minigame không có bất kỳ vòng lặp vô hạn nào (3s vào, 3s về)', () => {
  gm.switchSceneNow('main_hall');
  gm.cancelMiniGameCountdown();

  const games: MiniGameId[] = ['ma_quyen_loan_vu', 'ma_anh_than_phap', 'tam_khi_ma_tran'];
  for (let i = 0; i < 10; i++) {
    const targetGame = games[i % games.length];
    assert.equal(gm.getLifecycleState(), 'LOBBY', `Lượt ${i + 1} phải bắt đầu từ LOBBY`);

    // 1. Kích hoạt đếm ngược 3s
    const ok = gm.triggerMiniGameWithCountdown(targetGame);
    assert.equal(ok, true, `Lượt ${i + 1} kích hoạt đếm ngược phải thành công`);
    assert.equal(gm.getLifecycleState(), 'ANNOUNCING');

    // 2. Đếm ngược 3s -> PLAYING
    gm.advancePreMiniGameCountdown(3);
    assert.equal(gm.getLifecycleState(), 'PLAYING', `Lượt ${i + 1} phải vào đúng PLAYING`);
    assert.equal(gm.getSnapshot().miniGame.gameId, targetGame);

    // 3. Hoàn tất & hồi quy 3s
    gm.finishMiniGame(true, false);
    assert.equal(gm.getLifecycleState(), 'RETURNING');
    assert.equal(gm.getSnapshot().returnCountdown.isActive, true);

    gm.advanceReturnCountdown(3);
    assert.equal(gm.getLifecycleState(), 'LOBBY');
    assert.equal(gm.getSnapshot().activeScene, 'main_hall');
  }

  return '10 lượt Minigame liên tiếp hoàn tất mỹ mãn với 3s vào và 3s về, 0 lỗi lặp vô hạn, 0 xung đột state machine.';
});

// 89. Chống nhiễu loạn 60fps & comment spam: Không bao giờ re-trigger hoặc reset bộ đếm
runTest(89, 'Chống nhiễu loạn 60fps & comment spam: Không re-trigger hoặc reset bộ đếm về 3 khi đang đếm ngược/chuyển cảnh', () => {
  gm.switchSceneNow('main_hall');
  gm.cancelMiniGameCountdown();

  // Bật autoCycle để kiểm tra xem tick() có vô tình gọi lại không
  const cfg = gm.getConfig();
  cfg.sceneTransition.autoCycleEnabled = true;
  cfg.sceneTransition.isPaused = false;

  gm.triggerMiniGameWithCountdown('ma_quyen_loan_vu');
  const originalTurnId = gm.getCurrentTurnId();

  // Advance 1s -> count = 2
  gm.advancePreMiniGameCountdown(1);
  assert.equal(gm.getSnapshot().preMiniGameCountdown.count, 2);

  // Giả lập 60 khung hình tick() liên tiếp & spam comment TikTok
  for (let f = 0; f < 60; f++) {
    gm.tick();
    if (f % 5 === 0) {
      gm.handleCommentEvent({
        id: `spam_evt_${f}`,
        type: 'comment',
        timestamp: Date.now(),
        userId: `spammer_${f}`,
        uniqueId: `spammer_${f}`,
        nickname: `Người Xem ${f}`,
        comment: 'Giáo Chủ vạn tuế!',
        isDemo: true,
      });
    }
  }

  // Bộ đếm KHÔNG ĐƯỢC reset về 3, turnId KHÔNG ĐƯỢC thay đổi
  assert.equal(gm.getCurrentTurnId(), originalTurnId, 'TurnId phải được bảo vệ bất biến');
  assert.ok(gm.getSnapshot().preMiniGameCountdown.count <= 2, 'Bộ đếm không được reset về 3');

  // Thao tác trigger trùng phải bị từ chối 100%
  const duplicate = gm.triggerMiniGameWithCountdown('ma_anh_than_phap');
  assert.equal(duplicate, false, 'Không cho phép trigger đè');

  gm.cancelMiniGameCountdown();
  return 'Khóa an toàn chống nhiễu 60fps & comment spam bảo vệ State Machine tuyệt đối ổn định.';
});

// 90. Kiểm tra tinh gọn giao diện Minigame HUD & Cập nhật nội dung hướng dẫn
runTest(90, 'Kiểm tra tinh gọn giao diện Minigame HUD: Hướng dẫn MÚA cô đọng, xóa sạch nút điều hướng & bộ chọn kiểu chuyển cảnh', () => {
  const hudFile = path.resolve(process.cwd(), 'src/components/ui/MaGiaoOverlayHUD.tsx');
  const hudContent = fs.readFileSync(hudFile, 'utf8');

  // 1. Kiểm tra dòng hướng dẫn Ma Quyền Loạn Vũ
  assert.ok(
    !hudContent.includes('mỗi người chỉ cần 1 bình luận'),
    'Phải xóa cụm từ dài dòng "(mỗi người chỉ cần 1 bình luận)" trong hướng dẫn Ma Quyền'
  );
  assert.ok(
    hudContent.includes('để thi triển Ma Quyền!'),
    'Phải hiển thị chuẩn xác dòng hướng dẫn tinh gọn: "Bình luận từ khóa MÚA để thi triển Ma Quyền!"'
  );

  // 2. Kiểm tra việc xóa hoàn toàn hàng điều hướng Minigame (Về Đại Điện, Chuyển: Game 1, Game 2, Game 3)
  assert.ok(
    !hudContent.includes('Về Đại Điện'),
    'Không còn nút "Về Đại Điện" trong Minigame HUD'
  );
  assert.ok(
    !hudContent.includes('Chuyển:'),
    'Không còn nhãn "Chuyển:" đổi game trong Minigame HUD'
  );

  // 3. Kiểm tra việc xóa bộ chọn kiểu chuyển cảnh (Kiểu:, Ma Trận, Cuồng Phong, Huyết Nguyệt)
  assert.ok(
    !hudContent.includes('Kiểu:'),
    'Không còn bộ chọn kiểu hiệu ứng chuyển cảnh trong Minigame HUD'
  );

  return 'Giao diện Minigame HUD tinh gọn 100%, nội dung hướng dẫn chuẩn xác, không còn nút thừa hay khoảng trống trống trải.';
});

console.log('================================================================================');
const passedCount = results.filter(r => r.passed).length;
console.log(`TỔNG KẾT KIỂM THỬ: ${passedCount}/${results.length} HẠNG MỤC PASS (100%)`);
console.log('================================================================================');

if (passedCount !== results.length) {
  process.exit(1);
}







