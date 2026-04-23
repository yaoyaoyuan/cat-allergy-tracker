// ========== 猫咪食物过敏排查记录工具 ==========
// 数据模型、表单逻辑、阶段判定规则、趋势可视化、localStorage 持久化

'use strict';

// ───────── 常量 ─────────
const STORAGE_KEY = 'cat-allergy-tracker';
const BACKUP_APPLIED_KEY = 'cat-allergy-backup-applied-v1';

const STAGES = [
  { id: 0, name: '基线建立', desc: '录入猫咪档案与既往信息' },
  { id: 1, name: '驱虫记录', desc: '完成驱虫记录并确认驱虫执行' },
  { id: 2, name: '食物排除试验', desc: '严格水解蛋白喂养 8-12 周' },
  { id: 3, name: '复挑战', desc: '逐一引入单一蛋白来源' },
  { id: 4, name: '长期管理', desc: '确定安全/回避食物清单' }
];

const PROTEIN_SOURCES = [
  '鸡肉', '鱼肉', '牛肉', '羊肉', '鸭肉', '兔肉', '鹿肉',
  '猪肉', '火鸡', '三文鱼', '金枪鱼', '虾/蟹', '蛋', '乳制品', '其他'
];

const DEWORM_PRODUCTS = ['爱沃克', '大宠爱'];

const SCRATCH_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const EAR_LEVELS = ['无', '轻微发红', '有分泌物', '严重'];
const BRISTOL_SCALE = ['1-硬球', '2-香肠状硬', '3-香肠有裂', '4-光滑软', '5-软团/糊状'];
const SKIN_APPEARANCES = ['正常', '发红', '脱毛', '结痂', '渗液', '多项'];
const WEATHER_OPTIONS = ['晴', '阴', '雨', '潮湿闷热', '干燥', '其他'];
const HUMIDITY_LEVELS = ['低', '中', '高'];
const TEMP_RANGES = ['<10°C', '10-15°C', '15-20°C', '20-25°C', '25-30°C', '30-35°C', '>35°C'];
const FOOD_OPTIONS = ['兔肉粮和冻干', '皇家水解', '希尔斯水解', '法米娜水解'];

const MIN_ELIMINATION_DAYS = 56; // 8 周
const ELIMINATION_START_DATE = '2026-03-14';

// 根据出生日计算年龄文本
function calcAge(birthDate) {
  if (!birthDate) return '未填写';
  const b = new Date(birthDate);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years > 0) return `${years}岁${months}月`;
  return `${months}月`;
}

function calcAgeMonths(birthDate) {
  if (!birthDate) return 0;
  const b = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months--;
  return Math.max(0, months);
}

// ───────── 默认数据结构 ─────────
function createDefaultData() {
  return {
    profile: {
      name: '',
      breed: '金渐层',
      birthDate: '2025-02-15',
      ageMonths: 13,
      sex: '母',
      neutered: true,
      weightJin: 7.3,
      symptomAreas: ['头颈部', '耳朵'],
      indoorOutdoor: '纯室内',
      litterType: '',
      otherPets: '',
      previousProteins: [],
      previousBrands: '',
      currentFood: '皇家水解蛋白',
      seasonalPattern: false,
      notes: '2026-02-05 开始服用环孢素（每天一次 0.3ml），猫粮维持不变。\n2026-03-12 环孢素减为2天一次，减药后皮肤立刻泛红。\n2026-03-14 晚间停止原有猫粮，开始换皇家水解蛋白猫粮。\n2026-03-15 午后用纯牛肉冻干粉诱食，猫开始吃水解猫粮。',
      completed: false
    },
    parasiteControl: {
      lastDewormDate: '',
      dewormProduct: '',
      dewormCompleted: false,
      skinInfectionCleared: false,
      fungalCleared: false,
      records: [],
      notes: '',
      completed: false
    },
    medication: {
      cyclosporine: {
        startDate: '2026-02-05',
        currentFrequency: '2天一次',
        dosage: '0.3ml',
        forcedTakenRanges: [
          { startDate: '2026-02-09', endDate: '2026-03-11', frequency: '每天一次', note: '回溯标记为每日服药' },
          { startDate: '2026-03-13', endDate: '2026-03-13', frequency: '每天一次', note: '补记每日服药' }
        ],
        changes: [
          { date: '2026-02-05', frequency: '每天一次', note: '开始服用环孢素 0.3ml/次' },
          { date: '2026-03-13', frequency: '2天一次', note: '减药为2天一次，减药后皮肤立刻开始泛红' }
        ],
        stoppedDate: ''
      },
      otherMeds: []
    },
    stageStatus: {
      currentStage: 0,
      stages: {
        0: { startDate: '', completedDate: '', conclusion: '' },
        1: { startDate: '', completedDate: '', conclusion: '' },
        2: { startDate: '', completedDate: '', conclusion: '' },
        3: { startDate: '', completedDate: '', conclusion: '' },
        4: { startDate: '', completedDate: '', conclusion: '' }
      }
    },
    dailyLogs: [
      {
        date: '2026-03-12', scratchLevel: '7',
        earSymptom: '轻微发红', rashAreas: '', vomit: false, stoolScore: '4-光滑软',
        foodIntake: '原有猫粮（未换粮）', snackOrStolen: '',
        cyclosporineTaken: true, cyclosporineNote: '今日起减为2天一次',
        otherMeds: '', bathed: false, envChange: '',
        strictnessViolated: false, violationDetail: '',
        photoLink: '', notes: '环孢素从每天一次减为2天一次。减药后皮肤立刻开始泛红。'
      },
      {
        date: '2026-03-13', scratchLevel: '7',
        earSymptom: '轻微发红', rashAreas: '皮肤泛红', vomit: false, stoolScore: '4-光滑软',
        foodIntake: '原有猫粮（未换粮）', snackOrStolen: '',
        cyclosporineTaken: false, cyclosporineNote: '2天一次，今日未服药',
        otherMeds: '', bathed: false, envChange: '',
        strictnessViolated: false, violationDetail: '',
        photoLink: '', notes: '减药后第二天，皮肤持续泛红。'
      },
      {
        date: '2026-03-14', scratchLevel: '7',
        earSymptom: '轻微发红', rashAreas: '皮肤泛红', vomit: false, stoolScore: '4-光滑软',
        foodIntake: '晚间停止原有猫粮，开始换皇家水解蛋白猫粮', snackOrStolen: '',
        cyclosporineTaken: true, cyclosporineNote: '0.3ml',
        otherMeds: '', bathed: false, envChange: '',
        strictnessViolated: false, violationDetail: '',
        photoLink: '', notes: '晚间停止一切原有猫粮，开始换皇家水解蛋白猫粮。猫不爱吃，晚间拒绝进食。'
      },
      {
        date: '2026-03-15', scratchLevel: '7',
        earSymptom: '轻微发红', rashAreas: '皮肤泛红', vomit: false, stoolScore: '4-光滑软',
        foodIntake: '皇家水解蛋白猫粮（午后开始进食）', snackOrStolen: '午后撒了少量纯牛肉冻干粉诱食',
        cyclosporineTaken: false, cyclosporineNote: '2天一次，今日未服药',
        otherMeds: '', bathed: false, envChange: '',
        strictnessViolated: false, violationDetail: '',
        photoLink: '', notes: '3/14晚至3/15中午拒绝进食。午后撒了少量纯牛肉冻干粉在水解猫粮上诱食，中午后开始进餐。牛肉为过敏原检测确认安全的蛋白来源。'
      }
    ],
    challenges: [],
    version: 1
  };
}

function createDailyLog(date) {
  return {
    date: date || new Date().toISOString().slice(0, 10),
    scratchLevel: '5',      // 1-10
    scratchAreas: '',       // 搔抓部位
    skinAppearance: '正常', // 皮肤外观
    earSymptom: '轻微发红', // EAR_LEVELS
    rashAreas: '',
    vomit: false,
    stoolScore: '4-光滑软', // BRISTOL_SCALE
    foodIntake: '兔肉粮和冻干',
    snackOrStolen: '',
    cyclosporineTaken: false,
    cyclosporineNote: '',
    otherMeds: '',
    bathed: false,
    envChange: '',
    weather: '',            // 天气
    humidity: '',           // 湿度
    tempRange: '',          // 气温范围
    strictnessViolated: false,
    violationDetail: '',
    photoLink: '',
    notes: ''
  };
}

function createParasiteRecord(date) {
  return {
    date: date || todayStr(),
    product: '',
    notes: ''
  };
}

function createChallenge() {
  return {
    protein: '',
    startDate: '',
    endDate: '',
    symptomChanges: '',
    conclusion: '' // 无反应 / 轻微反应 / 明确反应
  };
}

// ───────── 全局状态 ─────────
let appData = null;
let currentView = 'daily'; // overview | profile | parasite | daily | medication | trends | challenge | settings
let dailyHistoryPage = 1;
const DAILY_PAGE_SIZE = 20;
let editingLogDate = null; // 正在编辑的日志日期
let parasiteSortOrder = 'desc'; // desc: 新到旧, asc: 旧到新
let editingParasiteIndex = null;
let isFreshInstall = false;

// ───────── 持久化 ─────────
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    syncToFirebase();
  } catch (e) {
    showToast('保存失败：存储空间可能已满', 'error');
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      isFreshInstall = false;
      const parsed = JSON.parse(raw);
      // 合并默认字段（兼容旧版本缺失字段）
      appData = mergeDefaults(createDefaultData(), parsed);
      // 如果旧数据没有预填历史记录，迁移补入
      if (appData.dailyLogs.length === 0 && appData.medication.cyclosporine.startDate === '') {
        const defaults = createDefaultData();
        appData.dailyLogs = defaults.dailyLogs;
        appData.medication = defaults.medication;
        appData.profile.notes = defaults.profile.notes;
        saveData();
      }

      const pc = appData.parasiteControl;
      const hasLegacyParasiteData = !!(pc.lastDewormDate || pc.dewormProduct || pc.notes || pc.dewormCompleted || pc.skinInfectionCleared || pc.fungalCleared);
      if (Array.isArray(pc.records) && pc.records.length === 0 && hasLegacyParasiteData) {
        const summary = createParasiteRecord(pc.lastDewormDate || todayStr());
        summary.product = pc.dewormProduct || '未填写';
        summary.notes = pc.notes || '由旧版数据自动迁移';
        pc.records.push(summary);
        saveData();
      }

      if (Array.isArray(pc.records) && pc.records.length > 0) {
        let changed = false;
        pc.records = pc.records.map(r => {
          const migrated = { ...r };
          if (migrated.product === undefined) {
            migrated.product = migrated.detail || (migrated.category ? `${migrated.category}` : '');
            changed = true;
          }
          if (migrated.notes === undefined) {
            migrated.notes = '';
            changed = true;
          }
          return migrated;
        });
        if (changed) saveData();
      }

      // 清理旧版本中的瘙痒/舔毛字段，避免继续保留无效信息
      if (Array.isArray(appData.dailyLogs) && appData.dailyLogs.length > 0) {
        let cleaned = false;
        appData.dailyLogs.forEach(l => {
          if (Object.prototype.hasOwnProperty.call(l, 'itchScore')) {
            delete l.itchScore;
            cleaned = true;
          }
          if (Object.prototype.hasOwnProperty.call(l, 'lickScore')) {
            delete l.lickScore;
            cleaned = true;
          }
          if (l.scratchLevel === '无') { l.scratchLevel = '1'; cleaned = true; }
          if (l.scratchLevel === '偶尔') { l.scratchLevel = '4'; cleaned = true; }
          if (l.scratchLevel === '频繁') { l.scratchLevel = '7'; cleaned = true; }
          if (l.scratchLevel === '剧烈') { l.scratchLevel = '10'; cleaned = true; }
        });
        if (cleaned) saveData();
      }

      if (Array.isArray(appData.challenges) && appData.challenges.length > 0) {
        let cleaned = false;
        appData.challenges.forEach(c => {
          if (Object.prototype.hasOwnProperty.call(c, 'itchScoreBefore')) {
            delete c.itchScoreBefore;
            cleaned = true;
          }
          if (Object.prototype.hasOwnProperty.call(c, 'itchScoreAfter')) {
            delete c.itchScoreAfter;
            cleaned = true;
          }
        });
        if (cleaned) saveData();
      }

      const med = appData.medication && appData.medication.cyclosporine;
      if (med && (!Array.isArray(med.forcedTakenRanges) || med.forcedTakenRanges.length === 0)) {
        med.forcedTakenRanges = [
          { startDate: '2026-02-09', endDate: '2026-03-11', frequency: '每天一次', note: '回溯标记为每日服药' },
          { startDate: '2026-03-13', endDate: '2026-03-13', frequency: '每天一次', note: '补记每日服药' }
        ];
        saveData();
      }

      if (med && Array.isArray(med.forcedTakenRanges)) {
        const isOldRange = med.forcedTakenRanges.length === 1
          && med.forcedTakenRanges[0].startDate === '2026-02-09'
          && med.forcedTakenRanges[0].endDate === '2026-03-12';
        if (isOldRange) {
          med.forcedTakenRanges = [
            { startDate: '2026-02-09', endDate: '2026-03-11', frequency: '每天一次', note: '回溯标记为每日服药' },
            { startDate: '2026-03-13', endDate: '2026-03-13', frequency: '每天一次', note: '补记每日服药' }
          ];
          saveData();
        }

        const changedRange = med.changes && med.changes.find(c => c.date === '2026-03-12' && String(c.note || '').includes('减药为2天一次'));
        if (changedRange) {
          changedRange.date = '2026-03-13';
          saveData();
        }
      }

      alignEliminationStartDateFromLogs();
    } else {
      isFreshInstall = true;
      appData = createDefaultData();
      alignEliminationStartDateFromLogs();
    }
  } catch (e) {
    isFreshInstall = true;
    appData = createDefaultData();
    alignEliminationStartDateFromLogs();
  }
}

async function tryLoadBundledBackupOnFirstRun() {
  if (localStorage.getItem(BACKUP_APPLIED_KEY) === '1') return false;
  const hasRealProgress = !!(
    appData
    && appData.profile
    && appData.profile.completed
    && Array.isArray(appData.dailyLogs)
    && appData.dailyLogs.length > 7
  );
  const isStarterState = !!(
    appData
    && appData.profile
    && !appData.profile.completed
    && appData.stageStatus
    && appData.stageStatus.currentStage === 0
    && Array.isArray(appData.dailyLogs)
    && appData.dailyLogs.length <= 7
  );

  if (!isFreshInstall && !isStarterState) return false;
  if (hasRealProgress) return false;

  try {
    const res = await fetch('cat-allergy-tracker-2026-04-12.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const imported = await res.json();
    if (!imported.profile || !imported.stageStatus || !Array.isArray(imported.dailyLogs)) return false;
    appData = mergeDefaults(createDefaultData(), imported);
    saveData();
    localStorage.setItem(BACKUP_APPLIED_KEY, '1');
    showToast('已自动恢复备份数据');
    return true;
  } catch (e) {
    return false;
  }
}

function alignEliminationStartDateFromLogs() {
  if (!appData) return;
  const stage2 = appData.stageStatus && appData.stageStatus.stages && appData.stageStatus.stages[2];
  if (!stage2) return;

  const shouldAlign = (appData.stageStatus.currentStage >= 2) || !!stage2.startDate;
  if (!shouldAlign) return;

  if (stage2.startDate !== ELIMINATION_START_DATE) {
    stage2.startDate = ELIMINATION_START_DATE;
    saveData();
  }
}

function mergeDefaults(defaults, saved) {
  const result = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (saved[key] === undefined) continue;
    if (defaults[key] !== null && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
      result[key] = mergeDefaults(defaults[key], saved[key]);
    } else {
      result[key] = saved[key];
    }
  }
  return result;
}

// ───────── JSON 导入导出 ─────────
function exportJSON() {
  const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `cat-allergy-tracker-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('数据已导出');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      // 基本结构校验
      if (!imported.profile || !imported.stageStatus || !Array.isArray(imported.dailyLogs)) {
        showToast('文件格式不正确，缺少必要字段', 'error');
        return;
      }
      appData = mergeDefaults(createDefaultData(), imported);
      saveData();
      showToast('数据导入成功');
      renderCurrentView();
    } catch (err) {
      showToast('导入失败：文件解析出错', 'error');
    }
  };
  reader.readAsText(file);
}

// ───────── 阶段判定引擎 ─────────
function getStageAdvice() {
  const advice = [];
  const s = appData.stageStatus;
  const p = appData.profile;
  const pc = appData.parasiteControl;
  const med = appData.medication.cyclosporine;

  // 阶段 0：基线
  if (!p.completed) {
    advice.push({ type: 'warning', text: '请先完成猫咪基本资料录入，建立排查基线。' });
    return advice;
  }

  // 阶段 1：驱虫
  if (!pc.completed) {
    const hasDewormRecord = Array.isArray(pc.records) && pc.records.length > 0;
    if (!hasDewormRecord) {
      advice.push({ type: 'warning', text: '请先完成并记录驱虫。未排除寄生虫前，不建议开始食物排除试验。' });
    } else {
      advice.push({ type: 'info', text: `已记录 ${pc.records.length} 条驱虫信息，可继续评估是否进入食物排除试验。` });
    }
    return advice;
  }

  // 阶段 2：食物排除试验
  const eliminationStart = s.stages[2].startDate;
  if (s.currentStage === 2 && eliminationStart) {
    const daysPassed = daysBetween(eliminationStart, todayStr());
    const logs = getLogsInRange(eliminationStart, todayStr());
    const contaminatedWeeks = getContaminatedWeeks(logs);
    const recentAvgScratch = getRecentAvgScratch(logs, 7);
    const earlyAvgScratch = getEarlyAvgScratch(logs, 7);
    const improving = recentAvgScratch !== null && earlyAvgScratch !== null && recentAvgScratch < earlyAvgScratch;
    const cycloStopped = !!med.stoppedDate;

    advice.push({ type: 'info', text: `食物排除试验已进行 ${daysPassed} 天（需至少 ${MIN_ELIMINATION_DAYS} 天）。` });

    if (contaminatedWeeks.length > 0) {
      advice.push({ type: 'warning', text: `有 ${contaminatedWeeks.length} 周记录受到干扰（偷吃/零食/换药等），可能影响排查准确性。` });
    }

    if (!cycloStopped) {
      advice.push({ type: 'warning', text: '环孢素尚未停药。当前症状改善可能部分由药物贡献，建议在医生指导下逐步减停后继续观察。' });
    }

    if (daysPassed < MIN_ELIMINATION_DAYS) {
      advice.push({ type: 'info', text: `尚未满 8 周，建议继续严格排查。距满 8 周还需 ${MIN_ELIMINATION_DAYS - daysPassed} 天。` });
    } else {
      // >= 56 天
      if (cycloStopped && improving) {
        const daysSinceStopped = daysBetween(med.stoppedDate, todayStr());
        if (daysSinceStopped >= 14) {
          advice.push({ type: 'success', text: '✅ 已满 8 周，环孢素已停药且症状持续改善。可与医生讨论是否进入复挑战阶段。' });
        } else {
          advice.push({ type: 'info', text: `环孢素已停 ${daysSinceStopped} 天，建议停药至少 2 周后再评估，排除药物残余效果。` });
        }
      } else if (!cycloStopped && improving) {
        advice.push({ type: 'warning', text: '症状有改善，但环孢素尚未停药。改善可能由药物和/或饮食共同贡献，请先在医生指导下减停环孢素。' });
      } else if (cycloStopped && !improving) {
        advice.push({ type: 'warning', text: '已满 8 周且环孢素已停，但症状改善不明显。建议检查是否存在排查污染、环境过敏因素，或与医生讨论其他可能。' });
      }
    }
  }

  // 阶段 3：复挑战
  if (s.currentStage === 3) {
    const activeChallenges = appData.challenges;
    if (activeChallenges.length === 0) {
      advice.push({ type: 'info', text: '复挑战阶段：请选择一种蛋白来源开始测试。建议从最常见的过敏原（如鸡肉、牛肉、鱼肉）开始。' });
    } else {
      const latest = activeChallenges[activeChallenges.length - 1];
      if (!latest.endDate) {
        const days = daysBetween(latest.startDate, todayStr());
        advice.push({ type: 'info', text: `正在测试【${latest.protein}】，已进行 ${days} 天。建议每种蛋白观察 1-2 周。` });
      }
      const confirmed = activeChallenges.filter(c => c.conclusion === '明确反应');
      if (confirmed.length > 0) {
        advice.push({ type: 'warning', text: `已确认的过敏蛋白：${confirmed.map(c => c.protein).join('、')}` });
      }
    }
  }

  // 阶段 4：长期管理
  if (s.currentStage === 4) {
    advice.push({ type: 'success', text: '已进入长期管理阶段。请定期复查并维持安全饮食方案。' });
  }

  return advice;
}

// ───────── 工具函数 ─────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

function getLogsInRange(startDate, endDate) {
  return appData.dailyLogs.filter(l => l.date >= startDate && l.date <= endDate);
}

function getContaminatedWeeks(logs) {
  const weeks = {};
  for (const log of logs) {
    if (log.strictnessViolated) {
      const weekNum = getWeekNumber(appData.stageStatus.stages[2].startDate, log.date);
      weeks[weekNum] = true;
    }
  }
  return Object.keys(weeks);
}

function getWeekNumber(startDate, currentDate) {
  return Math.floor(daysBetween(startDate, currentDate) / 7) + 1;
}

function scratchLevelToScore(level) {
  const n = parseInt(level, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= 10) return n;
  return 1;
}

function getRecentAvgScratch(logs, days) {
  const recent = logs.slice(-days);
  if (recent.length === 0) return null;
  return recent.reduce((sum, l) => sum + scratchLevelToScore(l.scratchLevel), 0) / recent.length;
}

function getEarlyAvgScratch(logs, days) {
  const early = logs.slice(0, days);
  if (early.length === 0) return null;
  return early.reduce((sum, l) => sum + scratchLevelToScore(l.scratchLevel), 0) / early.length;
}

function showToast(message, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show ' + (type || 'success');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

function confirmDeleteTwice(firstMessage, secondMessage) {
  if (!confirm(firstMessage)) return false;
  return confirm(secondMessage || '再次确认：此操作不可撤销，是否继续删除？');
}

// ───────── 渲染引擎 ─────────
function renderCurrentView() {
  updateNav();
  updateOverviewBar();
  const main = document.getElementById('main-content');
  if (!main) return;
  switch (currentView) {
    case 'overview': renderOverview(main); break;
    case 'profile': renderProfile(main); break;
    case 'parasite': renderParasite(main); break;
    case 'daily': renderDaily(main); break;
    case 'medication': renderMedication(main); break;
    case 'trends': renderTrends(main); break;
    case 'challenge': renderChallenge(main); break;
    case 'settings': renderSettings(main); break;
    case 'more': renderMore(main); break;
    default: renderDaily(main);
  }
}

function switchView(view) {
  currentView = view;
  renderCurrentView();
  window.scrollTo(0, 0);
}

function updateNav() {
  document.querySelectorAll('.nav-tab').forEach(el => {
    // "more" tab should be active when viewing profile/parasite/challenge/settings
    const viewAttr = el.dataset.view;
    if (viewAttr === 'more') {
      el.classList.toggle('active', ['profile', 'parasite', 'challenge', 'settings', 'more'].includes(currentView));
    } else {
      el.classList.toggle('active', viewAttr === currentView);
    }
  });
}

function updateHeroBreed() {
  const el = document.getElementById('top-bar-breed');
  const nameEl = document.getElementById('top-bar-name');
  if (!el || !appData) return;
  const p = appData.profile;
  const age = calcAge(p.birthDate);
  const sex = p.sex === '母' ? '♀' : '♂';
  if (nameEl) nameEl.textContent = p.name || 'Amber葵';
  el.textContent = `${p.breed || ''} · ${age} · ${sex}`;
}

function updateOverviewBar() {
  updateHeroBreed();
  const bar = document.getElementById('overview-bar');
  if (!bar) return;
  const s = appData.stageStatus;
  const stage = STAGES[s.currentStage] || STAGES[0];
  let days = '—';
  if (s.stages[2].startDate) {
    days = daysBetween(s.stages[2].startDate, todayStr()) + ' 天';
  }
  const cyclo = appData.medication.cyclosporine;
  let cycloText = '未记录';
  if (cyclo.stoppedDate) cycloText = `已停药 (${formatDate(cyclo.stoppedDate)})`;
  else if (cyclo.currentFrequency) cycloText = cyclo.currentFrequency;

  bar.innerHTML = `
    <div class="status-item"><span class="status-label">阶段</span><span class="status-value stage-${s.currentStage}">${stage.name}</span></div>
    <div class="status-item"><span class="status-label">天数</span><span class="status-value">${days}</span></div>
    <div class="status-item"><span class="status-label">环孢素</span><span class="status-value">${escapeHtml(cycloText)}</span></div>
    <div class="status-item"><span class="status-label">日志</span><span class="status-value">${appData.dailyLogs.length}</span></div>
  `;
}

// ───────── 概览页 ─────────
function renderOverview(container) {
  const adviceList = getStageAdvice();
  const adviceHtml = adviceList.map(a =>
    `<div class="advice-card advice-${a.type}"><p>${escapeHtml(a.text)}</p></div>`
  ).join('');

  // 阶段时间线
  const timelineHtml = STAGES.map(st => {
    const status = appData.stageStatus.stages[st.id];
    let cls = 'tl-future';
    if (appData.stageStatus.currentStage === st.id) cls = 'tl-current';
    else if (status.completedDate) cls = 'tl-done';
    else if (appData.stageStatus.currentStage > st.id) cls = 'tl-done';
    return `<div class="tl-item ${cls}">
      <div class="tl-dot"></div>
      <div class="tl-content">
        <strong>${st.name}</strong>
        <small>${st.desc}</small>
        ${status.startDate ? `<small class="tl-date">${formatDate(status.startDate)}${status.completedDate ? ' → ' + formatDate(status.completedDate) : ' 至今'}</small>` : ''}
      </div>
    </div>`;
  }).join('');

  // 最近日志
  const recentLogs = appData.dailyLogs.slice(-5).reverse();
  const logsHtml = recentLogs.length === 0
    ? '<p class="empty-hint">暂无记录，请开始每日记录。</p>'
    : recentLogs.map(l => `
      <div class="log-mini" onclick="switchView('daily')">
        <span class="log-date">${l.date}</span>
        <span class="log-scratch">${escapeHtml(l.scratchLevel)}</span>
        <span class="log-ear">${escapeHtml(l.earSymptom)}</span>
        ${l.strictnessViolated ? '<span class="log-warn">⚠️ 受干扰</span>' : ''}
      </div>
    `).join('');

  container.innerHTML = `
    <section class="section">
      <h2>排查建议</h2>
      ${adviceHtml || '<div class="advice-card advice-success"><p>当前无特别提示。</p></div>'}
    </section>
    <section class="section">
      <h2>排查阶段</h2>
      <div class="timeline">${timelineHtml}</div>
    </section>
    <section class="section">
      <h2>最近记录</h2>
      ${logsHtml}
    </section>
  `;
}

// ───────── 猫咪档案 ─────────
function renderProfile(container) {
  const p = appData.profile;
  const proteinCheckboxes = PROTEIN_SOURCES.map(pr =>
    `<label class="checkbox-label"><input type="checkbox" name="prevProtein" value="${pr}" ${p.previousProteins.includes(pr) ? 'checked' : ''}> ${pr}</label>`
  ).join('');

  const symptomOptions = ['头颈部', '耳朵', '腹部', '四肢/脚掌', '背部/尾根', '全身性'].map(a =>
    `<label class="checkbox-label"><input type="checkbox" name="symptomArea" value="${a}" ${p.symptomAreas.includes(a) ? 'checked' : ''}> ${a}</label>`
  ).join('');

  container.innerHTML = `
    <section class="section">
      <h2>猫咪基本资料</h2>
      <div class="cat-avatar-wrap"><img src="amber.jpg" alt="猫咪头像" class="cat-avatar"></div>
      <form id="profile-form" class="form-grid">
        <div class="form-group">
          <label>猫咪名字</label>
          <input type="text" name="name" value="${escapeHtml(p.name)}" placeholder="你家猫的名字">
        </div>
        <div class="form-group">
          <label>品种</label>
          <input type="text" name="breed" value="${escapeHtml(p.breed)}">
        </div>
        <div class="form-group">
          <label>出生日期</label>
          <input type="date" name="birthDate" value="${p.birthDate || ''}">
          <span style="font-size:0.78rem;color:var(--text-light);margin-top:0.15rem;">当前年龄：${calcAge(p.birthDate)}</span>
        </div>
        <div class="form-group">
          <label>性别</label>
          <select name="sex">
            <option value="公" ${p.sex === '公' ? 'selected' : ''}>公</option>
            <option value="母" ${p.sex === '母' ? 'selected' : ''}>母</option>
          </select>
        </div>
        <div class="form-group">
          <label>是否绝育</label>
          <select name="neutered">
            <option value="true" ${p.neutered ? 'selected' : ''}>已绝育</option>
            <option value="false" ${!p.neutered ? 'selected' : ''}>未绝育</option>
          </select>
        </div>
        <div class="form-group">
          <label>体重（斤）</label>
          <input type="number" name="weightJin" value="${p.weightJin}" step="0.1" min="0">
        </div>
        <div class="form-group full-width">
          <label>症状部位</label>
          <div class="checkbox-group">${symptomOptions}</div>
        </div>
        <div class="form-group">
          <label>室内/室外</label>
          <select name="indoorOutdoor">
            <option value="纯室内" ${p.indoorOutdoor === '纯室内' ? 'selected' : ''}>纯室内</option>
            <option value="室内为主" ${p.indoorOutdoor === '室内为主' ? 'selected' : ''}>室内为主</option>
            <option value="室内外均有" ${p.indoorOutdoor === '室内外均有' ? 'selected' : ''}>室内外均有</option>
          </select>
        </div>
        <div class="form-group">
          <label>猫砂类型</label>
          <input type="text" name="litterType" value="${escapeHtml(p.litterType)}" placeholder="如：豆腐砂、膨润土...">
        </div>
        <div class="form-group">
          <label>同住宠物</label>
          <input type="text" name="otherPets" value="${escapeHtml(p.otherPets)}" placeholder="无 / 另有1只猫...">
        </div>
        <div class="form-group">
          <label>当前食物</label>
          <input type="text" name="currentFood" value="${escapeHtml(p.currentFood)}">
        </div>
        <div class="form-group full-width">
          <label>是否有季节性规律</label>
          <select name="seasonalPattern">
            <option value="false" ${!p.seasonalPattern ? 'selected' : ''}>无明显季节性</option>
            <option value="true" ${p.seasonalPattern ? 'selected' : ''}>有季节性</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label>既往吃过的蛋白来源（勾选所有吃过的）</label>
          <div class="checkbox-group">${proteinCheckboxes}</div>
        </div>
        <div class="form-group full-width">
          <label>既往吃过的品牌</label>
          <textarea name="previousBrands" rows="2" placeholder="如：渴望、百利、皇家...">${escapeHtml(p.previousBrands)}</textarea>
        </div>
        <div class="form-group full-width">
          <label>备注</label>
          <textarea name="notes" rows="2">${escapeHtml(p.notes)}</textarea>
        </div>
        <div class="form-actions full-width">
          <button type="submit" class="btn btn-primary">保存资料</button>
        </div>
      </form>
    </section>
  `;

  document.getElementById('profile-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const fd = new FormData(this);
    p.name = fd.get('name');
    p.breed = fd.get('breed');
    p.birthDate = fd.get('birthDate') || '';
    p.ageMonths = calcAgeMonths(p.birthDate);
    p.sex = fd.get('sex');
    p.neutered = fd.get('neutered') === 'true';
    p.weightJin = parseFloat(fd.get('weightJin')) || 0;
    p.indoorOutdoor = fd.get('indoorOutdoor');
    p.litterType = fd.get('litterType');
    p.otherPets = fd.get('otherPets');
    p.currentFood = fd.get('currentFood');
    p.seasonalPattern = fd.get('seasonalPattern') === 'true';
    p.previousBrands = fd.get('previousBrands');
    p.notes = fd.get('notes');

    p.symptomAreas = Array.from(this.querySelectorAll('input[name="symptomArea"]:checked')).map(el => el.value);
    p.previousProteins = Array.from(this.querySelectorAll('input[name="prevProtein"]:checked')).map(el => el.value);

    p.completed = true;

    // 自动推进阶段
    if (appData.stageStatus.currentStage === 0) {
      appData.stageStatus.stages[0].completedDate = todayStr();
      if (!appData.stageStatus.stages[0].startDate) appData.stageStatus.stages[0].startDate = todayStr();
      appData.stageStatus.currentStage = 1;
      appData.stageStatus.stages[1].startDate = todayStr();
    }

    saveData();
    showToast('资料已保存');
    renderCurrentView();
  });
}

// ───────── 驱虫记录 ─────────
function renderParasite(container) {
  const pc = appData.parasiteControl;
  const sortedRecords = getSortedParasiteRecords();
  const recordsHtml = renderDewormRecordsTable(sortedRecords);
  const dewormOptions = DEWORM_PRODUCTS.map(p => `<option value="${p}">${p}</option>`).join('');

  container.innerHTML = `
    <section class="section parasite-compact">
      <h2>驱虫记录</h2>
      <p class="hint">这个页面现在只保留驱虫记录。你可以在这里新增、编辑、删除和排序。</p>

      <form id="parasite-record-form" class="form-grid parasite-grid">
        <div class="form-group">
          <label>驱虫日期</label>
          <input type="date" name="date" value="${todayStr()}">
        </div>
        <div class="form-group">
          <label>驱虫产品</label>
          <select name="product">
            <option value="">请选择</option>
            ${dewormOptions}
          </select>
        </div>
        <div class="parasite-inline-actions full-width">
          <div class="parasite-sort-wrap">
            <label for="parasite-sort-order">排序</label>
            <select id="parasite-sort-order" name="sortOrder" class="parasite-sort-select">
              <option value="desc" ${parasiteSortOrder === 'desc' ? 'selected' : ''}>新到旧</option>
              <option value="asc" ${parasiteSortOrder === 'asc' ? 'selected' : ''}>旧到新</option>
            </select>
          </div>
          <button type="submit" class="btn btn-parasite-add">+ 新增驱虫记录</button>
        </div>
      </form>

      <h3 style="margin-top:1rem">已记录内容</h3>
      ${recordsHtml}
    </section>
  `;

  document.getElementById('parasite-record-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const fd = new FormData(this);
    const sortOrder = fd.get('sortOrder');
    if (sortOrder === 'asc' || sortOrder === 'desc') {
      parasiteSortOrder = sortOrder;
    }
    const record = createParasiteRecord(fd.get('date'));
    record.product = fd.get('product');
    if (!record.date || !record.product) {
      showToast('请填写完整记录信息', 'error');
      return;
    }
    pc.records.push(record);
    pc.lastDewormDate = record.date;
    pc.dewormProduct = record.product;
    pc.dewormCompleted = true;
    saveData();
    showToast('驱虫记录已新增');
    renderCurrentView();
  });

  document.querySelector('#parasite-record-form [name="sortOrder"]').addEventListener('change', function (e) {
    setParasiteSort(e.target.value);
  });
}

function getSortedParasiteRecords() {
  const records = appData.parasiteControl.records || [];
  const decorated = records.map((r, i) => ({ ...r, _index: i }));
  decorated.sort((a, b) => {
    const cmp = (a.date || '').localeCompare(b.date || '');
    return parasiteSortOrder === 'asc' ? cmp : -cmp;
  });
  return decorated;
}

function renderDewormRecordsTable(records) {
  if (records.length === 0) {
    return '<p class="empty-hint" style="margin-top:0.9rem">还没有驱虫记录，先添加一条吧。</p>';
  }

  const rowsHtml = records.map(r => {
    if (editingParasiteIndex === r._index) {
      const editProductOptions = DEWORM_PRODUCTS.map(p => `<option value="${p}" ${r.product === p ? 'selected' : ''}>${p}</option>`).join('');
      return `<tr class="log-edit-row">
        <td><input class="edit-input" type="date" data-field="date" value="${r.date || ''}"></td>
        <td><select class="edit-input" data-field="product"><option value="">请选择</option>${editProductOptions}</select></td>
        <td class="log-actions-cell">
          <button class="btn btn-sm btn-primary" onclick="saveParasiteRecordEdit(${r._index})">保存</button>
          <button class="btn btn-sm btn-secondary" onclick="cancelParasiteRecordEdit()">取消</button>
        </td>
      </tr>`;
    }

    return `<tr>
      <td>${escapeHtml(r.date || '—')}</td>
      <td>${escapeHtml(r.product || '—')}</td>
      <td class="log-actions-cell">
        <button class="btn btn-sm btn-secondary" onclick="startParasiteRecordEdit(${r._index})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteParasiteRecord(${r._index})">删除</button>
      </td>
    </tr>`;
  }).join('');

  return `
    <div class="table-wrap" style="margin-top:0.8rem">
      <table class="summary-table">
        <thead>
          <tr><th>日期</th><th>驱虫产品</th><th>操作</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

function setParasiteSort(order) {
  if (order !== 'asc' && order !== 'desc') return;
  parasiteSortOrder = order;
  renderCurrentView();
}

function startParasiteRecordEdit(index) {
  editingParasiteIndex = index;
  renderCurrentView();
}

function cancelParasiteRecordEdit() {
  editingParasiteIndex = null;
  renderCurrentView();
}

function saveParasiteRecordEdit(index) {
  const row = document.querySelector('.log-edit-row');
  if (!row) return;
  const vals = {};
  row.querySelectorAll('.edit-input').forEach(el => {
    vals[el.dataset.field] = el.value;
  });
  const records = appData.parasiteControl.records || [];
  if (!records[index]) return;
  records[index].date = vals.date || records[index].date;
  records[index].product = vals.product || records[index].product;
  appData.parasiteControl.lastDewormDate = records[index].date;
  appData.parasiteControl.dewormProduct = records[index].product;
  appData.parasiteControl.dewormCompleted = records.length > 0;
  editingParasiteIndex = null;
  saveData();
  showToast('记录已更新');
  renderCurrentView();
}

function deleteParasiteRecord(index) {
  const records = appData.parasiteControl.records || [];
  if (!records[index]) return;
  if (!confirmDeleteTwice('确定删除这条驱虫记录？', '再次确认：删除后无法恢复，是否继续？')) return;
  records.splice(index, 1);
  appData.parasiteControl.dewormCompleted = records.length > 0;
  if (records.length === 0) {
    appData.parasiteControl.lastDewormDate = '';
    appData.parasiteControl.dewormProduct = '';
  }
  editingParasiteIndex = null;
  saveData();
  showToast('记录已删除');
  renderCurrentView();
}

function completeParasiteStage() {
  const pc = appData.parasiteControl;
  if (!pc.records || pc.records.length === 0) {
    showToast('请先新增至少 1 条驱虫记录', 'error');
    return;
  }
  pc.dewormCompleted = true;
  pc.completed = true;
  appData.stageStatus.stages[1].completedDate = todayStr();
  appData.stageStatus.currentStage = 2;
  appData.stageStatus.stages[2].startDate = ELIMINATION_START_DATE;
  saveData();
  showToast('驱虫记录已完成，进入食物排除试验阶段');
  renderCurrentView();
}

// ───────── 每日记录 ─────────
function renderDaily(container) {
  // 检查是否已完成基线
  if (!appData.profile.completed) {
    container.innerHTML = '<section class="section"><h2>每日记录</h2><p class="hint">请先完成<a href="#" onclick="switchView(\'profile\')">猫咪资料录入</a>。</p></section>';
    return;
  }

  const today = todayStr();
  const existingToday = appData.dailyLogs.find(l => l.date === today);
  const lastLog = appData.dailyLogs.length > 0 ? appData.dailyLogs[appData.dailyLogs.length - 1] : null;
  const prefill = existingToday || (lastLog ? { ...createDailyLog(today), scratchLevel: lastLog.scratchLevel, earSymptom: lastLog.earSymptom } : createDailyLog(today));

  const scratchOptions = SCRATCH_LEVELS.map(l => `<option value="${l}" ${prefill.scratchLevel === l ? 'selected' : ''}>${l}</option>`).join('');
  const earOptions = EAR_LEVELS.map(l => `<option value="${l}" ${prefill.earSymptom === l ? 'selected' : ''}>${l}</option>`).join('');
  const stoolOptions = BRISTOL_SCALE.map(l => `<option value="${l}" ${prefill.stoolScore === l ? 'selected' : ''}>${l}</option>`).join('');
  const skinOptions = SKIN_APPEARANCES.map(l => `<option value="${l}" ${(prefill.skinAppearance || '正常') === l ? 'selected' : ''}>${l}</option>`).join('');
  const weatherOptions = WEATHER_OPTIONS.map(l => `<option value="${l}" ${(prefill.weather || '') === l ? 'selected' : ''}>${l}</option>`).join('');
  const humidityOptions = HUMIDITY_LEVELS.map(l => `<option value="${l}" ${(prefill.humidity || '') === l ? 'selected' : ''}>${l}</option>`).join('');
  const tempRangeOptions = TEMP_RANGES.map(l => `<option value="${l}" ${(prefill.tempRange || '') === l ? 'selected' : ''}>${l}</option>`).join('');
  const foodOptions = FOOD_OPTIONS.map(l => `<option value="${l}" ${(prefill.foodIntake || '兔肉粮和冻干') === l ? 'selected' : ''}>${l}</option>`).join('');

  // 历史日志（分页）
  const historyHtml = renderDailyHistory();

  container.innerHTML = `
    <section class="section daily-compact">
      <div class="daily-header">
        <h2>每日记录</h2>
        <span class="daily-hint">${existingToday ? '已有记录，修改后覆盖' : '预填前日数据，改变化项即可'}</span>
      </div>
      <form id="daily-form">
        <div class="dc-row dc-row-4">
          <div class="dc-field">
            <label>日期</label>
            <input type="date" name="date" value="${prefill.date}">
          </div>
          <div class="dc-field">
            <label>抓挠 <small>(1-10)</small></label>
            <select name="scratchLevel">${scratchOptions}</select>
          </div>
          <div class="dc-field">
            <label>搔抓部位</label>
            <input type="text" name="scratchAreas" value="${escapeHtml(prefill.scratchAreas || '')}" placeholder="头颈 / 耳后…">
          </div>
          <div class="dc-field">
            <label>皮肤外观</label>
            <select name="skinAppearance">${skinOptions}</select>
          </div>
        </div>

        <div class="dc-row dc-row-4">
          <div class="dc-field">
            <label>耳部</label>
            <select name="earSymptom">${earOptions}</select>
          </div>
          <div class="dc-field">
            <label>皮疹部位</label>
            <input type="text" name="rashAreas" value="${escapeHtml(prefill.rashAreas)}" placeholder="无 / 颈部…">
          </div>
          <div class="dc-field">
            <label>呕吐</label>
            <select name="vomit">
              <option value="false" ${!prefill.vomit ? 'selected' : ''}>无</option>
              <option value="true" ${prefill.vomit ? 'selected' : ''}>有</option>
            </select>
          </div>
          <div class="dc-field">
            <label>便便</label>
            <select name="stoolScore">${stoolOptions}</select>
          </div>
          <div class="dc-field">
            <label>食物</label>
            <select name="foodIntake">${foodOptions}</select>
          </div>
          <div class="dc-field">
            <label>零食/偷吃</label>
            <input type="text" name="snackOrStolen" value="${escapeHtml(prefill.snackOrStolen)}" placeholder="无">
          </div>
        </div>

        <div class="dc-row dc-row-3">
          <div class="dc-field">
            <label>天气</label>
            <select name="weather">
              <option value="">未记录</option>
              ${weatherOptions}
            </select>
          </div>
          <div class="dc-field">
            <label>气温</label>
            <select name="tempRange">
              <option value="">未记录</option>
              ${tempRangeOptions}
            </select>
          </div>
          <div class="dc-field">
            <label>湿度</label>
            <select name="humidity">
              <option value="">未记录</option>
              ${humidityOptions}
            </select>
          </div>
        </div>

        <div class="dc-divider"></div>

        <div class="dc-row dc-row-3">
          <div class="dc-field dc-check">
            <label class="checkbox-label">
              <input type="checkbox" name="cyclosporineTaken" ${prefill.cyclosporineTaken ? 'checked' : ''}>
              环孢素
            </label>
          </div>
          <div class="dc-field">
            <label>环孢素备注</label>
            <input type="text" name="cyclosporineNote" value="${escapeHtml(prefill.cyclosporineNote)}" placeholder="0.28ml">
          </div>
          <div class="dc-field">
            <label>其他药物</label>
            <input type="text" name="otherMeds" value="${escapeHtml(prefill.otherMeds)}" placeholder="无">
          </div>
        </div>

        <details class="dc-optional">
          <summary>▸ 更多（环境 / 备注）</summary>
          <div class="dc-row dc-row-3" style="margin-top:0.5rem">
            <div class="dc-field dc-check">
              <label class="checkbox-label">
                <input type="checkbox" name="bathed" ${prefill.bathed ? 'checked' : ''}>
                洗澡
              </label>
            </div>
            <div class="dc-field" style="grid-column:span 2">
              <label>环境变化</label>
              <input type="text" name="envChange" value="${escapeHtml(prefill.envChange)}" placeholder="换猫砂、新家具…">
            </div>
          </div>
          <div class="dc-row dc-row-1" style="margin-top:0.35rem">
            <div class="dc-field dc-warn">
              <label class="checkbox-label checkbox-warn">
                <input type="checkbox" name="strictnessViolated" ${prefill.strictnessViolated ? 'checked' : ''}>
                ⚠️ 破坏排查严格性
              </label>
              <input type="text" name="violationDetail" value="${escapeHtml(prefill.violationDetail)}" placeholder="描述…" style="margin-top:0.25rem">
            </div>
          </div>
          <div class="dc-row dc-row-2" style="margin-top:0.35rem">
            <div class="dc-field">
              <label>照片/链接</label>
              <input type="text" name="photoLink" value="${escapeHtml(prefill.photoLink)}" placeholder="路径或备注">
            </div>
            <div class="dc-field">
              <label>备注</label>
              <textarea name="notes" rows="1">${escapeHtml(prefill.notes)}</textarea>
            </div>
          </div>
        </details>
        <button type="submit" class="btn btn-primary daily-save-btn-bottom">${existingToday ? '更新记录' : '保存记录'}</button>
      </form>
    </section>
    <section class="section">
      ${historyHtml}
    </section>
  `;

  document.getElementById('daily-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const fd = new FormData(this);
    const log = createDailyLog(fd.get('date'));
    log.scratchLevel = fd.get('scratchLevel');
    log.scratchAreas = fd.get('scratchAreas');
    log.skinAppearance = fd.get('skinAppearance');
    log.earSymptom = fd.get('earSymptom');
    log.rashAreas = fd.get('rashAreas');
    log.vomit = fd.get('vomit') === 'true';
    log.stoolScore = fd.get('stoolScore');
    log.foodIntake = fd.get('foodIntake');
    log.snackOrStolen = fd.get('snackOrStolen');
    log.cyclosporineTaken = !!this.querySelector('[name="cyclosporineTaken"]').checked;
    log.cyclosporineNote = fd.get('cyclosporineNote');
    log.otherMeds = fd.get('otherMeds');
    log.bathed = !!this.querySelector('[name="bathed"]').checked;
    log.envChange = fd.get('envChange');
    log.weather = fd.get('weather');
    log.humidity = fd.get('humidity');
    log.tempRange = fd.get('tempRange');
    log.strictnessViolated = !!this.querySelector('[name="strictnessViolated"]').checked;
    log.violationDetail = fd.get('violationDetail');
    log.photoLink = fd.get('photoLink');
    log.notes = fd.get('notes');

    // 更新或新增
    const idx = appData.dailyLogs.findIndex(l => l.date === log.date);
    if (idx >= 0) {
      appData.dailyLogs[idx] = log;
    } else {
      appData.dailyLogs.push(log);
      appData.dailyLogs.sort((a, b) => a.date.localeCompare(b.date));
    }
    saveData();
    showToast('记录已保存');
    renderCurrentView();
  });
}

function renderDailyHistory() {
  const allLogs = [...appData.dailyLogs].reverse();
  if (allLogs.length === 0) return '';

  const totalPages = Math.ceil(allLogs.length / DAILY_PAGE_SIZE);
  if (dailyHistoryPage > totalPages) dailyHistoryPage = totalPages;
  if (dailyHistoryPage < 1) dailyHistoryPage = 1;
  const start = (dailyHistoryPage - 1) * DAILY_PAGE_SIZE;
  const pageLogs = allLogs.slice(start, start + DAILY_PAGE_SIZE);

  const scratchOpts = (val) => SCRATCH_LEVELS.map(l => `<option value="${l}" ${val === l ? 'selected' : ''}>${l}</option>`).join('');
  const earOpts = (val) => EAR_LEVELS.map(l => `<option value="${l}" ${val === l ? 'selected' : ''}>${l}</option>`).join('');
  const stoolOpts = (val) => BRISTOL_SCALE.map(l => `<option value="${l}" ${val === l ? 'selected' : ''}>${l}</option>`).join('');
  const skinOpts = (val) => SKIN_APPEARANCES.map(l => `<option value="${l}" ${(val || '正常') === l ? 'selected' : ''}>${l}</option>`).join('');
  const weatherOpts = (val) => WEATHER_OPTIONS.map(l => `<option value="${l}" ${(val || '') === l ? 'selected' : ''}>${l}</option>`).join('');
  const humidityOpts = (val) => HUMIDITY_LEVELS.map(l => `<option value="${l}" ${(val || '') === l ? 'selected' : ''}>${l}</option>`).join('');
  const tempOpts = (val) => TEMP_RANGES.map(l => `<option value="${l}" ${(val || '') === l ? 'selected' : ''}>${l}</option>`).join('');

  const rowsHtml = pageLogs.map(l => {
    const isEditing = editingLogDate === l.date;
    if (isEditing) {
      return `<tr class="log-edit-row">
        <td><input type="date" class="edit-input" value="${l.date}" data-field="date" data-orig="${l.date}"></td>
        <td><select class="edit-input" data-field="scratchLevel">${scratchOpts(l.scratchLevel)}</select></td>
        <td><select class="edit-input" data-field="skinAppearance">${skinOpts(l.skinAppearance)}</select></td>
        <td><select class="edit-input" data-field="earSymptom">${earOpts(l.earSymptom)}</select></td>
        <td><select class="edit-input" data-field="stoolScore">${stoolOpts(l.stoolScore)}</select></td>
        <td><input type="text" class="edit-input" value="${escapeHtml(l.foodIntake)}" data-field="foodIntake"></td>
        <td style="white-space:nowrap"><label style="display:inline-flex;align-items:center;gap:3px;font-size:0.82rem"><input type="checkbox" class="edit-input" data-field="cyclosporineTaken" ${l.cyclosporineTaken ? 'checked' : ''}> 环孢素</label> <input type="text" class="edit-input" value="${escapeHtml(l.cyclosporineNote || '')}" data-field="cyclosporineNote" placeholder="0.3ml" style="width:60px"> <input type="text" class="edit-input" value="${escapeHtml(l.otherMeds || '')}" data-field="otherMeds" placeholder="其他药" style="width:70px"></td>
        <td><select class="edit-input" data-field="weather"><option value="">—</option>${weatherOpts(l.weather)}</select></td>
        <td><select class="edit-input" data-field="humidity"><option value="">—</option>${humidityOpts(l.humidity)}</select></td>
        <td><select class="edit-input" data-field="tempRange"><option value="">—</option>${tempOpts(l.tempRange)}</select></td>
        <td><input type="text" class="edit-input" value="${escapeHtml(l.notes)}" data-field="notes"></td>
        <td class="log-actions-cell">
          <button class="btn btn-sm btn-primary" onclick="saveEditLog('${l.date}')">保存</button>
          <button class="btn btn-sm btn-secondary" onclick="cancelEditLog()">取消</button>
        </td>
      </tr>`;
    }
    return `<tr class="${l.strictnessViolated ? 'log-contaminated' : ''}">
      <td class="log-date">${l.date}</td>
      <td>${escapeHtml(l.scratchLevel)}</td>
      <td>${escapeHtml(l.skinAppearance || '—')}</td>
      <td>${escapeHtml(l.earSymptom)}</td>
      <td>${escapeHtml(l.stoolScore)}</td>
      <td class="log-food-cell">${escapeHtml(l.foodIntake)}${l.snackOrStolen ? ' <span class="badge badge-warn">零食</span>' : ''}${l.strictnessViolated ? ' <span class="badge badge-warn">⚠️</span>' : ''}</td>
      <td>${l.cyclosporineTaken ? '✅ ' + escapeHtml(l.cyclosporineNote || '') : '—'}${l.otherMeds ? ' / ' + escapeHtml(l.otherMeds) : ''}</td>
      <td>${escapeHtml(l.weather || '—')}</td>
      <td>${escapeHtml(l.humidity || '—')}</td>
      <td>${escapeHtml(l.tempRange || '—')}</td>
      <td class="log-notes-cell">${escapeHtml(l.notes) || '<span class="text-muted">—</span>'}</td>
      <td class="log-actions-cell">
        <button class="btn btn-sm btn-secondary" onclick="startEditLog('${l.date}')">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteLogByDate('${l.date}')">删除</button>
      </td>
    </tr>`;
  }).join('');

  // 分页控件
  let paginationHtml = '';
  if (totalPages > 1) {
    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
      pages.push(`<button class="btn btn-sm ${p === dailyHistoryPage ? 'btn-primary' : 'btn-secondary'}" onclick="goHistoryPage(${p})">${p}</button>`);
    }
    paginationHtml = `<div class="pagination">
      <button class="btn btn-sm btn-secondary" onclick="goHistoryPage(${dailyHistoryPage - 1})" ${dailyHistoryPage <= 1 ? 'disabled' : ''}>上一页</button>
      ${pages.join('')}
      <button class="btn btn-sm btn-secondary" onclick="goHistoryPage(${dailyHistoryPage + 1})" ${dailyHistoryPage >= totalPages ? 'disabled' : ''}>下一页</button>
      <span class="page-info">共 ${allLogs.length} 条</span>
    </div>`;
  }

  return `
    <h3>历史记录</h3>
    <div class="table-wrap">
      <table class="summary-table log-history-table">
        <thead><tr>
          <th>日期</th><th>抓挠</th><th>皮肤</th><th>耳部</th><th>便便</th><th>饮食</th><th>服药</th><th>天气</th><th>湿度</th><th>气温</th><th>备注</th><th>操作</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    ${paginationHtml}
  `;
}

function startEditLog(dateStr) {
  editingLogDate = dateStr;
  renderCurrentView();
}

function cancelEditLog() {
  editingLogDate = null;
  renderCurrentView();
}

function saveEditLog(origDate) {
  const idx = appData.dailyLogs.findIndex(l => l.date === origDate);
  if (idx < 0) return;
  const row = document.querySelector('.log-edit-row');
  if (!row) return;
  const inputs = row.querySelectorAll('.edit-input');
  const vals = {};
  inputs.forEach(el => { vals[el.dataset.field] = el.value; });

  const log = appData.dailyLogs[idx];
  if (vals.date) log.date = vals.date;
  if (vals.scratchLevel) log.scratchLevel = vals.scratchLevel;
  if (vals.skinAppearance) log.skinAppearance = vals.skinAppearance;
  if (vals.earSymptom) log.earSymptom = vals.earSymptom;
  if (vals.stoolScore) log.stoolScore = vals.stoolScore;
  if (vals.foodIntake !== undefined) log.foodIntake = vals.foodIntake;
  // 服药
  const cycloCheckbox = row.querySelector('[data-field="cyclosporineTaken"]');
  if (cycloCheckbox) log.cyclosporineTaken = cycloCheckbox.checked;
  const cycloNote = row.querySelector('[data-field="cyclosporineNote"]');
  if (cycloNote) log.cyclosporineNote = cycloNote.value;
  const otherMedsInput = row.querySelector('[data-field="otherMeds"]');
  if (otherMedsInput) log.otherMeds = otherMedsInput.value;
  if (vals.weather !== undefined) log.weather = vals.weather;
  if (vals.humidity !== undefined) log.humidity = vals.humidity;
  if (vals.tempRange !== undefined) log.tempRange = vals.tempRange;
  if (vals.notes !== undefined) log.notes = vals.notes;

  appData.dailyLogs.sort((a, b) => a.date.localeCompare(b.date));
  editingLogDate = null;
  saveData();
  showToast('记录已更新');
  renderCurrentView();
}

function deleteLogByDate(dateStr) {
  const idx = appData.dailyLogs.findIndex(l => l.date === dateStr);
  if (idx < 0) return;
  if (confirmDeleteTwice(`确定删除 ${dateStr} 的记录？`, `再次确认：删除 ${dateStr} 的记录后无法恢复，是否继续？`)) {
    appData.dailyLogs.splice(idx, 1);
    saveData();
    renderCurrentView();
  }
}

function goHistoryPage(page) {
  const totalPages = Math.ceil(appData.dailyLogs.length / DAILY_PAGE_SIZE);
  if (page < 1 || page > totalPages) return;
  dailyHistoryPage = page;
  renderCurrentView();
}

// ───────── 环孢素用药追踪 ─────────
function renderMedication(container) {
  const med = appData.medication.cyclosporine;

  // ── 调整记录列表（可编辑，新的在前）──
  const changesReversed = med.changes.map((c, i) => ({ ...c, _idx: i })).reverse();
  const changesHtml = med.changes.length === 0
    ? '<p class="empty-hint">暂无调整记录。</p>'
    : `<div class="change-list">${changesReversed.map(c => { const i = c._idx; return `
      <div class="change-card" id="change-card-${i}">
        <div class="change-card-view">
          <div class="change-header">
            <span class="change-date">${formatDate(c.date)}</span>
            <span class="change-freq">→ ${escapeHtml(c.frequency)}</span>
          </div>
          <p class="change-note">${escapeHtml(c.note || '—')}</p>
          <div class="change-actions">
            <button class="btn btn-sm btn-secondary" onclick="startEditChange(${i})">编辑</button>
            <button class="btn btn-sm btn-danger" onclick="deleteMedChange(${i})">删除</button>
          </div>
        </div>
        <form class="change-card-edit form-grid" style="display:none" onsubmit="saveEditChange(event,${i})">
          <div class="form-group">
            <label>日期</label>
            <input type="date" name="date" value="${c.date}">
          </div>
          <div class="form-group">
            <label>调整为</label>
            <input type="text" name="frequency" value="${escapeHtml(c.frequency)}">
          </div>
          <div class="form-group full-width">
            <label>备注</label>
            <input type="text" name="note" value="${escapeHtml(c.note || '')}">
          </div>
          <div class="form-actions full-width">
            <button type="submit" class="btn btn-sm btn-primary">保存</button>
            <button type="button" class="btn btn-sm btn-secondary" onclick="cancelEditChange(${i})">取消</button>
          </div>
        </form>
      </div>
    `; }).join('')}</div>`;

  // ── 用药日历（按自然月）──
  const calendarHtml = renderMedCalendarMonths();

  // ── 用药总览统计 ──
  const totalDays = med.startDate ? daysBetween(med.startDate, todayStr()) + 1 : 0;
  const takenLogs = appData.dailyLogs.filter(l => l.cyclosporineTaken);
  const summaryHtml = med.startDate ? `
    <div class="med-summary">
      <div class="med-stat"><span class="med-stat-num">${totalDays}</span><span class="med-stat-label">总天数</span></div>
      <div class="med-stat"><span class="med-stat-num">${takenLogs.length}</span><span class="med-stat-label">已记录服药</span></div>
      <div class="med-stat"><span class="med-stat-num">${escapeHtml(med.dosage || '—')}</span><span class="med-stat-label">单次剂量</span></div>
      <div class="med-stat"><span class="med-stat-num">${escapeHtml(med.currentFrequency)}</span><span class="med-stat-label">当前频次</span></div>
      <div class="med-stat"><span class="med-stat-num">${med.stoppedDate ? formatDate(med.stoppedDate) : '未停药'}</span><span class="med-stat-label">停药日期</span></div>
    </div>
  ` : '';

  container.innerHTML = `
    <section class="section">
      <h2>环孢素用药追踪</h2>
      ${summaryHtml}
      <form id="med-form" class="form-grid">
        <div class="form-group">
          <label>开始服药日期</label>
          <input type="date" name="startDate" value="${med.startDate}">
        </div>
        <div class="form-group">
          <label>当前频次</label>
          <select name="currentFrequency">
            <option value="每天一次" ${med.currentFrequency === '每天一次' ? 'selected' : ''}>每天一次</option>
            <option value="2天一次" ${med.currentFrequency === '2天一次' ? 'selected' : ''}>2天一次</option>
            <option value="3天一次" ${med.currentFrequency === '3天一次' ? 'selected' : ''}>3天一次</option>
            <option value="每周一次" ${med.currentFrequency === '每周一次' ? 'selected' : ''}>每周一次</option>
            <option value="已停药" ${med.currentFrequency === '已停药' ? 'selected' : ''}>已停药</option>
          </select>
        </div>
        <div class="form-group">
          <label>每次剂量</label>
          <input type="text" name="dosage" value="${escapeHtml(med.dosage)}" placeholder="如：0.3ml">
        </div>
        <div class="form-group">
          <label>停药日期（如已停）</label>
          <input type="date" name="stoppedDate" value="${med.stoppedDate}">
        </div>
        <div class="form-actions full-width">
          <button type="submit" class="btn btn-primary">保存基本信息</button>
        </div>
      </form>
    </section>

    <section class="section">
      <h2>用药调整时间线</h2>
      <p class="hint">记录每次减量/调整，便于回顾完整用药历程。每条记录均可编辑。</p>
      ${changesHtml}
      <h3 style="margin-top:1rem">添加新调整</h3>
      <form id="med-change-form" class="form-grid">
        <div class="form-group">
          <label>调整日期</label>
          <input type="date" name="changeDate" value="${todayStr()}">
        </div>
        <div class="form-group">
          <label>调整为</label>
          <input type="text" name="changeFreq" placeholder="如：3天一次 / 已停药">
        </div>
        <div class="form-group full-width">
          <label>备注</label>
          <input type="text" name="changeNote" placeholder="医生建议、减药原因等">
        </div>
        <div class="form-actions full-width">
          <button type="submit" class="btn btn-secondary">+ 添加调整记录</button>
        </div>
      </form>
    </section>

    <section class="section">
      <h2>用药日历</h2>
      <div class="med-legend" style="margin-bottom:0.8rem">
        <span class="legend-item"><span class="legend-dot dot-taken"></span>服药</span>
        <span class="legend-item"><span class="legend-dot dot-skipped"></span>未服药</span>
        <span class="legend-item"><span class="legend-dot dot-nodata"></span>无记录</span>
        <span class="legend-item"><span class="legend-dot dot-before-start"></span>未开始</span>
      </div>
      <div id="med-calendars">${calendarHtml}</div>
    </section>
  `;

  document.getElementById('med-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const fd = new FormData(this);
    med.startDate = fd.get('startDate');
    med.currentFrequency = fd.get('currentFrequency');
    med.dosage = fd.get('dosage');
    med.stoppedDate = fd.get('stoppedDate');
    if (med.currentFrequency === '已停药' && !med.stoppedDate) {
      med.stoppedDate = todayStr();
    }
    saveData();
    showToast('用药信息已保存');
    renderCurrentView();
  });

  document.getElementById('med-change-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const fd = new FormData(this);
    const changeDate = fd.get('changeDate');
    const changeFreq = fd.get('changeFreq');
    if (!changeDate || !changeFreq) { showToast('请填写日期和调整内容', 'error'); return; }
    med.changes.push({ date: changeDate, frequency: changeFreq, note: fd.get('changeNote') });
    med.changes.sort((a, b) => a.date.localeCompare(b.date));
    saveData();
    showToast('调整记录已添加');
    renderCurrentView();
  });
}

function startEditChange(index) {
  const card = document.getElementById('change-card-' + index);
  if (!card) return;
  card.querySelector('.change-card-view').style.display = 'none';
  card.querySelector('.change-card-edit').style.display = 'grid';
}

function cancelEditChange(index) {
  const card = document.getElementById('change-card-' + index);
  if (!card) return;
  card.querySelector('.change-card-view').style.display = '';
  card.querySelector('.change-card-edit').style.display = 'none';
}

function saveEditChange(e, index) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const med = appData.medication.cyclosporine;
  med.changes[index].date = fd.get('date');
  med.changes[index].frequency = fd.get('frequency');
  med.changes[index].note = fd.get('note');
  med.changes.sort((a, b) => a.date.localeCompare(b.date));
  saveData();
  showToast('已更新');
  renderCurrentView();
}

function deleteMedChange(index) {
  if (!confirmDeleteTwice('确定删除此调整记录？', '再次确认：删除后无法恢复，是否继续？')) return;
  appData.medication.cyclosporine.changes.splice(index, 1);
  saveData();
  renderCurrentView();
}

function renderMedCalendarMonths() {
  const med = appData.medication.cyclosporine;
  const startDate = med.startDate ? new Date(med.startDate) : null;
  const today = new Date();
  const forcedTakenRanges = Array.isArray(med.forcedTakenRanges) ? med.forcedTakenRanges : [];

  // 确定需要展示的月份范围：从开始服药月到当前月
  let firstMonth, lastMonth;
  if (startDate) {
    firstMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  } else {
    // 没有开始日期就显示最近 2 个月
    firstMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  }
  lastMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const months = [];
  const cursor = new Date(firstMonth);
  while (cursor <= lastMonth) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

  return months.map(monthDate => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // 星期几开始（0=周日, 调整为周一起始）
    let firstDow = new Date(year, month, 1).getDay();
    firstDow = firstDow === 0 ? 6 : firstDow - 1; // 转为周一=0

    const headerHtml = weekdays.map(d => `<div class="cal-weekday">${d}</div>`).join('');

    // 空白占位
    let cellsHtml = '';
    for (let i = 0; i < firstDow; i++) {
      cellsHtml += '<div class="cal-day cal-empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(year, month, day);
      const isToday = dateStr === todayStr();
      const isFuture = dateObj > today;
      const isBeforeStart = startDate && dateObj < startDate;

      let cls = 'cal-nodata';
      if (isFuture) {
        cls = 'cal-future';
      } else if (isBeforeStart) {
        cls = 'cal-before-start';
      } else {
        const log = appData.dailyLogs.find(l => l.date === dateStr);
        if (log) {
          cls = log.cyclosporineTaken ? 'cal-taken' : 'cal-skipped';
        } else {
          const forcedTaken = forcedTakenRanges.some(r => r.startDate && r.endDate && dateStr >= r.startDate && dateStr <= r.endDate);
          if (forcedTaken) cls = 'cal-taken';
        }
      }

      // 检查这一天是否有调整事件
      const hasChange = med.changes.some(c => c.date === dateStr);
      const changeMark = hasChange ? '<span class="cal-change-dot"></span>' : '';

      cellsHtml += `<div class="cal-day ${cls}${isToday ? ' cal-today' : ''}" title="${dateStr}">${day}${changeMark}</div>`;
    }

    return `
      <div class="cal-month">
        <div class="cal-month-title">${year} 年 ${month + 1} 月</div>
        <div class="cal-grid">
          ${headerHtml}
          ${cellsHtml}
        </div>
      </div>
    `;
  }).join('');
}

// ───────── 趋势图 ─────────
function renderTrends(container) {
  const logs = appData.dailyLogs;
  if (logs.length < 2) {
    container.innerHTML = '<section class="section"><h2>趋势分析</h2><p class="empty-hint">至少需要 2 天的记录才能显示趋势。</p></section>';
    return;
  }

  const svgWidth = 700;
  const svgHeight = 300;
  const padding = { top: 30, right: 20, bottom: 50, left: 45 };
  const chartW = svgWidth - padding.left - padding.right;
  const chartH = svgHeight - padding.top - padding.bottom;

  // 取最近 60 条
  const data = logs.slice(-60);
  const n = data.length;
  const xStep = chartW / Math.max(n - 1, 1);
  const maxScratchScore = 10;

  function yPos(val) {
    return padding.top + chartH - (val / maxScratchScore) * chartH;
  }

  // 构建抓挠频率折线
  const scratchPoints = data.map((d, i) => `${padding.left + i * xStep},${yPos(scratchLevelToScore(d.scratchLevel))}`).join(' ');

  // X 轴标签（每 7 天显示一个）
  let xLabels = '';
  for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 8))) {
    const x = padding.left + i * xStep;
    xLabels += `<text x="${x}" y="${svgHeight - 5}" class="axis-label" transform="rotate(-30 ${x} ${svgHeight - 5})">${data[i].date.slice(5)}</text>`;
  }

  // Y 轴标签
  let yLabels = '';
  for (let v = 1; v <= maxScratchScore; v++) {
    const y = yPos(v);
    yLabels += `<text x="${padding.left - 8}" y="${y + 4}" class="axis-label" text-anchor="end">${v}</text>`;
    yLabels += `<line x1="${padding.left}" y1="${y}" x2="${padding.left + chartW}" y2="${y}" class="grid-line"/>`;
  }

  // 污染日标记
  let contaminationMarks = '';
  data.forEach((d, i) => {
    if (d.strictnessViolated) {
      const x = padding.left + i * xStep;
      contaminationMarks += `<rect x="${x - 3}" y="${padding.top}" width="6" height="${chartH}" class="contamination-mark"/>`;
    }
  });

  // 环孢素停药标记线
  let stopLine = '';
  const stoppedDate = appData.medication.cyclosporine.stoppedDate;
  if (stoppedDate) {
    const stopIdx = data.findIndex(d => d.date >= stoppedDate);
    if (stopIdx >= 0) {
      const x = padding.left + stopIdx * xStep;
      stopLine = `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${padding.top + chartH}" class="stop-line"/>
        <text x="${x + 4}" y="${padding.top + 12}" class="stop-label">停环孢素</text>`;
    }
  }

  const svgChart = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="trend-chart">
      ${yLabels}
      ${xLabels}
      ${contaminationMarks}
      ${stopLine}
      <polyline points="${scratchPoints}" class="line-scratch" fill="none"/>
      <text x="${padding.left + 5}" y="${padding.top - 10}" class="chart-title">抓挠频率趋势（最近 ${n} 天）</text>
    </svg>
    <div class="chart-legend">
      <span class="legend-item"><span class="legend-line line-color-scratch"></span>抓挠频率（1-10）</span>
      <span class="legend-item"><span class="legend-rect contamination-color"></span>排查受干扰日</span>
    </div>
  `;

  // 按周汇总
  const weekSummary = getWeeklySummary(data);
  const weekTable = weekSummary.length === 0 ? '' : `
    <h3>按周汇总</h3>
    <div class="table-wrap">
      <table class="summary-table">
        <thead><tr><th>周</th><th>日期范围</th><th>平均抓挠分值</th><th>主要分值</th><th>受干扰</th></tr></thead>
        <tbody>${weekSummary.map(w => `
          <tr class="${w.contaminated ? 'row-contaminated' : ''}">
            <td>${w.week}</td>
            <td>${w.start} ~ ${w.end}</td>
            <td>${w.avgScratch.toFixed(2)}</td>
            <td>${w.mainScratchScore}</td>
            <td>${w.contaminated ? '⚠️ 是' : '✅ 否'}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;

  container.innerHTML = `
    <section class="section">
      <h2>趋势分析</h2>
      ${svgChart}
    </section>
    <section class="section">
      ${weekTable}
    </section>
  `;
}

function getWeeklySummary(logs) {
  if (logs.length === 0) return [];
  const weeks = [];
  let weekLogs = [];
  let weekNum = 1;
  for (let i = 0; i < logs.length; i++) {
    weekLogs.push(logs[i]);
    if (weekLogs.length === 7 || i === logs.length - 1) {
      const avgScratch = weekLogs.reduce((s, l) => s + scratchLevelToScore(l.scratchLevel), 0) / weekLogs.length;
      const rounded = Math.max(1, Math.min(10, Math.round(avgScratch)));
      weeks.push({
        week: weekNum,
        start: weekLogs[0].date.slice(5),
        end: weekLogs[weekLogs.length - 1].date.slice(5),
        avgScratch,
        mainScratchScore: rounded,
        contaminated: weekLogs.some(l => l.strictnessViolated)
      });
      weekLogs = [];
      weekNum++;
    }
  }
  return weeks;
}

// ───────── 复挑战 ─────────
function renderChallenge(container) {
  if (appData.stageStatus.currentStage < 3) {
    const advice = [];
    if (appData.stageStatus.currentStage === 2) {
      const start = appData.stageStatus.stages[2].startDate;
      if (start) {
        const days = daysBetween(start, todayStr());
        if (days < MIN_ELIMINATION_DAYS) {
          advice.push(`食物排除试验仅进行了 ${days} 天，至少需要 ${MIN_ELIMINATION_DAYS} 天才可考虑复挑战。`);
        }
      }
      if (!appData.medication.cyclosporine.stoppedDate) {
        advice.push('环孢素尚未停药，建议先在医生指导下减停环孢素。');
      }
    }
    container.innerHTML = `
      <section class="section">
        <h2>复挑战</h2>
        <p class="hint">尚未进入复挑战阶段。</p>
        ${advice.map(a => `<div class="advice-card advice-warning"><p>${escapeHtml(a)}</p></div>`).join('')}
        ${appData.stageStatus.currentStage === 2 ? '<button class="btn btn-primary" onclick="enterChallengeStage()">进入复挑战阶段</button>' : ''}
      </section>
    `;
    return;
  }

  const challenges = appData.challenges;
  const challengesReversed = challenges.map((c, i) => ({ ...c, _idx: i })).reverse();
  const challengeListHtml = challenges.length === 0
    ? '<p class="empty-hint">尚无复挑战记录。</p>'
    : challengesReversed.map(c => { const i = c._idx; return `
      <div class="challenge-card ${c.conclusion === '明确反应' ? 'challenge-positive' : c.conclusion === '无反应' ? 'challenge-safe' : ''}">
        <h4>${escapeHtml(c.protein)}</h4>
        <p>${formatDate(c.startDate)} → ${c.endDate ? formatDate(c.endDate) : '进行中'}</p>
        <p>症状变化：${escapeHtml(c.symptomChanges || '—')}</p>
        <p>结论：<strong>${escapeHtml(c.conclusion || '待定')}</strong></p>
        <button class="btn btn-sm btn-secondary" onclick="editChallenge(${i})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteChallenge(${i})">删除</button>
      </div>
    `; }).join('');

  // 可疑过敏原汇总
  const confirmed = challenges.filter(c => c.conclusion === '明确反应').map(c => c.protein);
  const safe = challenges.filter(c => c.conclusion === '无反应').map(c => c.protein);

  container.innerHTML = `
    <section class="section">
      <h2>复挑战</h2>
      <p class="hint">逐一引入单一蛋白来源，每种观察 1-2 周，记录症状变化。</p>

      ${confirmed.length > 0 ? `<div class="advice-card advice-warning"><p>已确认过敏蛋白：<strong>${confirmed.join('、')}</strong></p></div>` : ''}
      ${safe.length > 0 ? `<div class="advice-card advice-success"><p>安全蛋白：<strong>${safe.join('、')}</strong></p></div>` : ''}

      <h3>新增测试</h3>
      <form id="challenge-form" class="form-grid">
        <div class="form-group">
          <label>蛋白来源</label>
          <input type="text" name="protein" placeholder="如：鸡肉">
        </div>
        <div class="form-group">
          <label>开始日期</label>
          <input type="date" name="startDate" value="${todayStr()}">
        </div>
        <div class="form-group">
          <label>结束日期</label>
          <input type="date" name="endDate">
        </div>
        <div class="form-group">
          <label>症状变化描述</label>
          <input type="text" name="symptomChanges" placeholder="无变化 / 第3天开始抓挠增多...">
        </div>
        <div class="form-group">
          <label>结论</label>
          <select name="conclusion">
            <option value="">待定</option>
            <option value="无反应">无反应（安全）</option>
            <option value="轻微反应">轻微反应（可疑）</option>
            <option value="明确反应">明确反应（过敏）</option>
          </select>
        </div>
        <div class="form-actions full-width">
          <button type="submit" class="btn btn-primary">添加复挑战记录</button>
        </div>
      </form>
    </section>
    <section class="section">
      <h3>复挑战历史</h3>
      <div class="challenge-list">${challengeListHtml}</div>
    </section>
  `;

  document.getElementById('challenge-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const fd = new FormData(this);
    const c = createChallenge();
    c.protein = fd.get('protein');
    c.startDate = fd.get('startDate');
    c.endDate = fd.get('endDate');
    c.symptomChanges = fd.get('symptomChanges');
    c.conclusion = fd.get('conclusion');
    if (!c.protein || !c.startDate) { showToast('请填写蛋白来源和开始日期', 'error'); return; }
    appData.challenges.push(c);
    saveData();
    showToast('复挑战记录已添加');
    renderCurrentView();
  });
}

function enterChallengeStage() {
  const start = appData.stageStatus.stages[2].startDate;
  const days = start ? daysBetween(start, todayStr()) : 0;
  if (days < MIN_ELIMINATION_DAYS) {
    if (!confirm(`食物排除试验仅进行了 ${days} 天（建议至少 ${MIN_ELIMINATION_DAYS} 天）。确定要提前进入复挑战阶段吗？`)) return;
  }
  appData.stageStatus.stages[2].completedDate = todayStr();
  appData.stageStatus.currentStage = 3;
  appData.stageStatus.stages[3].startDate = todayStr();
  saveData();
  showToast('已进入复挑战阶段');
  renderCurrentView();
}

function editChallenge(index) {
  // 简单实现：弹窗编辑结论
  const c = appData.challenges[index];
  const newConclusion = prompt(`编辑【${c.protein}】结论\n当前：${c.conclusion || '待定'}\n\n请输入：无反应 / 轻微反应 / 明确反应`, c.conclusion);
  if (newConclusion !== null) {
    c.conclusion = newConclusion;
    saveData();
    renderCurrentView();
  }
}

function deleteChallenge(index) {
  if (confirmDeleteTwice('确定删除此复挑战记录？', '再次确认：删除后无法恢复，是否继续？')) {
    appData.challenges.splice(index, 1);
    saveData();
    renderCurrentView();
  }
}

// ───────── 更多菜单 ─────────
function renderMore(container) {
  const menuItems = [
    { view: 'profile', icon: '🐱', label: '猫咪档案', desc: '基本资料、既往饮食史' },
    { view: 'parasite', icon: '🛡️', label: '驱虫记录', desc: '驱虫日期和产品' },
    { view: 'challenge', icon: '🔬', label: '复挑战', desc: '蛋白来源测试记录' },
    { view: 'settings', icon: '⚙️', label: '数据管理', desc: '导入 / 导出 / 清空' }
  ];

  container.innerHTML = `
    <div style="margin-bottom:12px">
      ${menuItems.map(item => `
        <a href="#" class="more-menu-item" data-goto="${item.view}">
          <span class="more-menu-icon">${item.icon}</span>
          <div class="more-menu-text">
            <span class="more-menu-label">${item.label}</span>
            <span class="more-menu-desc">${item.desc}</span>
          </div>
          <span class="more-menu-arrow">›</span>
        </a>
      `).join('')}
    </div>
  `;

  // 添加样式（内联避免加class）
  const style = document.createElement('style');
  style.textContent = `
    .more-menu-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      margin-bottom: 8px;
      text-decoration: none;
      color: var(--text);
      transition: background 0.15s;
    }
    .more-menu-item:hover { background: var(--surface-hover); }
    .more-menu-icon { font-size: 1.3rem; flex-shrink: 0; }
    .more-menu-text { flex: 1; display: flex; flex-direction: column; }
    .more-menu-label { font-size: 0.88rem; font-weight: 600; }
    .more-menu-desc { font-size: 0.74rem; color: var(--text-tertiary); }
    .more-menu-arrow { font-size: 1.2rem; color: var(--text-tertiary); flex-shrink: 0; }
  `;
  container.appendChild(style);

  container.querySelectorAll('.more-menu-item').forEach(el => {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      switchView(this.dataset.goto);
    });
  });
}

// ───────── 设置页 ─────────
function renderSettings(container) {
  container.innerHTML = `
    <section class="section">
      <h2>数据管理</h2>
      <div class="settings-grid">
        <div class="setting-card">
          <h3>导出数据</h3>
          <p>将所有记录导出为 JSON 文件备份。建议定期备份。</p>
          <button class="btn btn-primary" onclick="exportJSON()">导出 JSON</button>
        </div>
        <div class="setting-card">
          <h3>导入数据</h3>
          <p>从之前导出的 JSON 文件恢复数据。</p>
          <input type="file" id="import-file" accept=".json" style="display:none" onchange="handleImport(event)">
          <button class="btn btn-secondary" onclick="document.getElementById('import-file').click()">选择文件导入</button>
        </div>
        <div class="setting-card danger-zone">
          <h3>清空数据</h3>
          <p>清除所有本地记录。此操作不可撤销！建议先导出备份。</p>
          <button class="btn btn-danger" onclick="clearAllData()">清空所有数据</button>
        </div>
      </div>
    </section>
    <section class="section">
      <h2>关于</h2>
      <div class="about-text">
        <p><strong>猫咪食物过敏排查记录工具</strong></p>
        <p>本工具仅用于辅助记录过敏排查过程，帮助整理和回顾信息。</p>
        <p>⚠️ <strong>免责声明</strong>：本工具不提供医疗诊断或治疗建议。所有排查决策（包括环孢素减量/停药、食物选择、复挑战时机等）请务必在专业兽医指导下进行。</p>
        <p>数据仅存储在本地浏览器中，请定期导出备份以防丢失。</p>
      </div>
    </section>
  `;
}

function handleImport(event) {
  const file = event.target.files[0];
  if (file) importJSON(file);
  event.target.value = '';
}

function clearAllData() {
  if (confirm('⚠️ 确定要清空所有数据吗？此操作不可撤销！\n\n建议先导出备份。')) {
    if (confirm('再次确认：真的要删除所有记录吗？')) {
      localStorage.removeItem(STORAGE_KEY);
      appData = createDefaultData();
      saveData();
      showToast('数据已清空');
      switchView('overview');
    }
  }
}

// ───────── HTML 转义 ─────────
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// ───────── Firebase 云同步 ─────────
let _firebaseSyncTimer = null;
let _firebaseReady = false;
let _ignoreNextSnapshot = false;

function syncToFirebase() {
  if (!_firebaseReady || !window._firebase) return;
  clearTimeout(_firebaseSyncTimer);
  _firebaseSyncTimer = setTimeout(async () => {
    try {
      _ignoreNextSnapshot = true;
      await window._firebase.setDoc(window._firebase.DOC_REF, {
        data: JSON.stringify(appData),
        updatedAt: new Date().toISOString(),
        device: navigator.userAgent.substring(0, 80)
      });
      updateSyncIndicator('synced');
    } catch (e) {
      updateSyncIndicator('error');
      console.warn('Firebase sync failed:', e);
    }
  }, 1500);
}

async function loadFromFirebase() {
  if (!window._firebase) return false;
  try {
    const snap = await window._firebase.getDoc(window._firebase.DOC_REF);
    if (snap.exists()) {
      const cloudData = JSON.parse(snap.data().data);
      const localLogs = (appData && appData.dailyLogs) ? appData.dailyLogs.length : 0;
      const cloudLogs = (cloudData && cloudData.dailyLogs) ? cloudData.dailyLogs.length : 0;
      if (cloudLogs >= localLogs) {
        appData = mergeDefaults(createDefaultData(), cloudData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        return true;
      }
    }
    return false;
  } catch (e) {
    console.warn('Firebase load failed:', e);
    return false;
  }
}

function listenToFirebase() {
  if (!window._firebase) return;
  window._firebase.onSnapshot(window._firebase.DOC_REF, (snap) => {
    if (_ignoreNextSnapshot) { _ignoreNextSnapshot = false; return; }
    if (!snap.exists()) return;
    try {
      const cloudData = JSON.parse(snap.data().data);
      const cloudLogs = (cloudData && cloudData.dailyLogs) ? cloudData.dailyLogs.length : 0;
      const localLogs = (appData && appData.dailyLogs) ? appData.dailyLogs.length : 0;
      if (cloudLogs > localLogs) {
        appData = mergeDefaults(createDefaultData(), cloudData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        renderCurrentView();
        showToast('已从云端同步最新数据 ☁️');
      }
    } catch (e) { /* ignore parse errors */ }
  });
}

function updateSyncIndicator(status) {
  let el = document.getElementById('sync-status');
  if (!el) {
    el = document.createElement('span');
    el.id = 'sync-status';
    el.style.cssText = 'font-size:0.65rem;margin-left:6px;opacity:0.7;';
    const actions = document.querySelector('.top-bar-actions');
    if (actions) actions.prepend(el);
  }
  if (status === 'synced') {
    el.textContent = '☁️ 已同步';
    el.style.color = '#4a9d6e';
  } else if (status === 'error') {
    el.textContent = '⚠️ 同步失败';
    el.style.color = '#c94a4a';
  } else {
    el.textContent = '⏳ 同步中...';
    el.style.color = '#c49034';
  }
}

function initFirebaseSync() {
  if (window._firebase) {
    _firebaseReady = true;
    loadFromFirebase().then((loaded) => {
      if (loaded) renderCurrentView();
      updateSyncIndicator('synced');
      listenToFirebase();
      syncToFirebase();
    });
  } else {
    window.addEventListener('firebase-ready', () => {
      _firebaseReady = true;
      loadFromFirebase().then((loaded) => {
        if (loaded) renderCurrentView();
        updateSyncIndicator('synced');
        listenToFirebase();
        syncToFirebase();
      });
    });
  }
}

// ───────── 登录管理 ─────────
function initAuth() {
  const ready = () => {
    const { auth, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, ALLOWED_EMAIL } = window._auth;

    // Handle redirect result (for mobile)
    getRedirectResult(auth).catch(() => {});

    onAuthStateChanged(auth, (user) => {
      const loginScreen = document.getElementById('login-screen');
      const appShell = document.getElementById('app-shell');
      if (user && user.email === ALLOWED_EMAIL) {
        loginScreen.style.display = 'none';
        appShell.style.display = '';
        initApp();
      } else if (user) {
        const { signOut } = window._auth;
        signOut(auth);
        document.getElementById('login-error').textContent = '该账号无权限访问，请使用授权邮箱登录';
      } else {
        loginScreen.style.display = '';
        appShell.style.display = 'none';
      }
    });

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const loginBtn = document.getElementById('google-login-btn');
    if (loginBtn) {
      loginBtn.onclick = async () => {
        const provider = new GoogleAuthProvider();
        document.getElementById('login-error').textContent = '';
        if (isMobile) {
          signInWithRedirect(auth, provider);
        } else {
          try {
            await signInWithPopup(auth, provider);
          } catch (err) {
            if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
              signInWithRedirect(auth, provider);
            } else {
              document.getElementById('login-error').textContent = '登录失败: ' + (err.message || '请重试');
            }
          }
        }
      };
    }
  };

  if (window._auth) ready();
  else window.addEventListener('firebase-ready', ready);
}

function handleLogout() {
  if (!window._auth) return;
  window._auth.signOut(window._auth.auth);
}

let _appInitialized = false;
function initApp() {
  if (_appInitialized) return;
  _appInitialized = true;

  loadData();
  tryLoadBundledBackupOnFirstRun().then(() => {
    document.querySelectorAll('.nav-tab').forEach(el => {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        switchView(this.dataset.view);
      });
    });
    renderCurrentView();
    initFirebaseSync();
  });
}

// ───────── 初始化 ─────────
document.addEventListener('DOMContentLoaded', function () {
  initAuth();
});
