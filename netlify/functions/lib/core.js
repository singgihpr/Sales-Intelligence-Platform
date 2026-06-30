import 'dotenv/config';
import { sql } from './db.js';
import xlsx from 'xlsx';
import Busboy from 'busboy';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';




const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD;

const parseExcelDate = (val) => {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = val instanceof Date ? val : new Date(Math.round((val - 25569) * 86400 * 1000));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
};

// --- Ayotama Parser Helpers ---
const extractKgFromName = (name) => {
  if (!name) return 10; // default fallback
  // Match patterns like: "9KG", "17KG", "12,5 KG", "12.5 KG"
  const match = String(name).match(/(\d+(?:[.,]\d+)?)\s*KG/i);
  if (match) {
    return parseFloat(match[1].replace(',', '.'));
  }
  return 10; // default fallback
};

const convertToBE = (boxCount, kg) => {
  return (Number(boxCount) * Number(kg)) / 12;
};

const levenshteinDistance = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
    }
  }
  return matrix[b.length][a.length];
};

const fuzzyMatchOutlet = (name, outletsList) => {
  const normalized = String(name).toUpperCase().trim();
  let bestMatch = null;
  let bestScore = Infinity;
  for (const outlet of outletsList) {
    const outletName = String(outlet.name).toUpperCase().trim();
    const dist = levenshteinDistance(normalized, outletName);
    const maxLen = Math.max(normalized.length, outletName.length);
    const similarity = maxLen > 0 ? (1 - dist / maxLen) : 0;
    if (similarity >= 0.7 && dist < bestScore) {
      bestScore = dist;
      bestMatch = outlet;
    }
  }
  return bestMatch;
};

const detectFileFormat = (rows) => {
  if (rows.length > 4) {
    const headerRow = rows[4];
    if (headerRow.some(cell => String(cell).toLowerCase().includes('nama penjual utama'))) {
      return 'ayotama_v2';
    }
  }
  if (rows.length > 1 && String(rows[1]?.[1]).includes('Rincian Faktur')) {
    return 'ayotama_v1';
  }
  return 'unknown';
};

const parseAyotamaRows = (rows, allOutlets, allUsers) => {
  // Find header row (row 5, index 4) and date columns
  const headerRow = rows[4];
  if (!headerRow) return { total: 0, valid: 0, invalid: 0, rows: [] };

  const dateColumns = [];
  for (let i = 7; i < headerRow.length; i++) {
    const val = headerRow[i];
    if (val && (typeof val === 'number' || val instanceof Date)) {
      const dateStr = parseExcelDate(val);
      if (dateStr) dateColumns.push({ index: i, date: dateStr });
    }
  }

  if (dateColumns.length === 0) {
    return { action: 'preview', total: 0, valid: 0, invalid: 0, rows: [], error: 'No date columns found in header row' };
  }

  // Build branch-to-salesman mapping dynamically from users
  const salesUsers = allUsers.filter(u => u.role === 'sales');
  const branchMap = {};
  for (let i = 0; i < salesUsers.length; i++) {
    branchMap[i + 1] = salesUsers[i];
  }
  const fallbackUser = salesUsers[0] || { id: process.env.DEFAULT_USER_ID, name: 'Default Sales' };

  const preview = [];
  let currentBranch = '';
  let currentOutlet = '';
  let currentOutletMatch = null;

  for (let rowIdx = 5; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row || row.length < 7) continue;

    // Check if this is a footer/page row
    if (String(row[1]).includes('Halaman')) break;

    // Extract branch code if present in col C
    const branchCell = String(row[2] || '').trim();
    if (branchCell && branchCell.match(/^\d{2}\s/)) {
      currentBranch = branchCell;
    }

    // Extract outlet name if present in col D; carry forward if empty
    const outletCell = String(row[3] || '').trim();
    if (outletCell) {
      currentOutlet = outletCell;
      currentOutletMatch = fuzzyMatchOutlet(outletCell, allOutlets);
    }

    const unitType = String(row[4] || '').trim().toUpperCase();
    const productName = String(row[6] || '').trim();

    if (!productName) continue;

    // Skip unsupported unit types
    if (!['BOX', 'KG', 'PAX', 'PCS', 'KRJ'].includes(unitType)) continue;

    const kg = extractKgFromName(productName);
    let volumeBE = 0;
    if (unitType === 'BOX') {
      // convertToBE expects (boxCount, kg)
      volumeBE = convertToBE(1, kg);
    } else if (unitType === 'KG') {
      // Already in KG, convert directly: qty KG / 12 = BE
      volumeBE = 1 / 12;
    } else {
      // PAX, PCS, KRJ — also extract KG from name and convert
      volumeBE = convertToBE(1, kg);
    }

    const branchNum = currentBranch ? parseInt(currentBranch.split(' ')[0]) : 1;
    const salesUser = branchMap[branchNum] || fallbackUser;

    // For each date column with non-zero value
    for (const dc of dateColumns) {
      const qty = Number(row[dc.index] || 0);
      if (qty <= 0) continue;

      const totalVolumeBE = Number((qty * volumeBE).toFixed(3));
      const warnings = [];
      if (!currentOutlet) warnings.push('Missing outlet name');
      if (!currentOutletMatch) warnings.push(`Outlet baru akan dibuat: ${currentOutlet}`);
      if (!dc.date) warnings.push(`Invalid date at col ${dc.index}`);

      preview.push({
        row: rowIdx + 1,
        outletName: currentOutletMatch ? currentOutletMatch.name : (currentOutlet || '-'),
        branchArea: currentBranch || '',
        salesName: salesUser.name,
        date: dc.date,
        volume: totalVolumeBE,
        sku: productName,
        valid: true,
        isNewOutlet: !currentOutletMatch,
        warnings
      });
    }
  }

  return {
    action: 'preview',
    total: preview.length,
    valid: preview.filter(p => p.valid).length,
    invalid: preview.filter(p => !p.valid).length,
    rows: preview
  };
};

const parseAyotamaV2Rows = (rows, allOutlets, allUsers) => {
  const headerRow = rows[4];
  if (!headerRow) return { total: 0, valid: 0, invalid: 0, rows: [] };

  const dateColumns = [];
  for (let i = 7; i < headerRow.length; i++) {
    const val = headerRow[i];
    if (val && (typeof val === 'number' || val instanceof Date)) {
      const dateStr = parseExcelDate(val);
      if (dateStr) dateColumns.push({ index: i, date: dateStr });
    }
  }

  if (dateColumns.length === 0) {
    return { action: 'preview', total: 0, valid: 0, invalid: 0, rows: [], error: 'No date columns found in header row' };
  }

  const userNameMap = Object.fromEntries(allUsers.map(u => [String(u.name).toUpperCase().trim(), u]));

  const preview = [];
  let currentBranch = '';
  let currentSalesman = '';
  let currentOutlet = '';
  let currentOutletMatch = null;

  for (let rowIdx = 5; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row || row.length < 7) continue;

    if (String(row[1]).includes('Halaman')) break;

    const branchCell = String(row[2] || '').trim();
    if (branchCell && branchCell.match(/^\d{2}\s/)) {
      currentBranch = branchCell;
    }

    const salesmanCell = String(row[3] || '').trim();
    if (salesmanCell) {
      currentSalesman = salesmanCell;
    }

    const outletCell = String(row[4] || '').trim();
    if (outletCell) {
      currentOutlet = outletCell;
      currentOutletMatch = fuzzyMatchOutlet(outletCell, allOutlets);
    }

    const unitType = String(row[5] || '').trim().toUpperCase();
    const productName = String(row[6] || '').trim();

    if (!productName) continue;
    if (!['BOX', 'KG', 'PAX', 'PCS', 'KRJ'].includes(unitType)) continue;

    const kg = extractKgFromName(productName);
    let volumeBE = 0;
    if (unitType === 'BOX') {
      volumeBE = convertToBE(1, kg);
    } else if (unitType === 'KG') {
      volumeBE = 1 / 12;
    } else {
      volumeBE = convertToBE(1, kg);
    }

    const isKnownSalesman = !!userNameMap[String(currentSalesman).toUpperCase().trim()];

    for (const dc of dateColumns) {
      const qty = Number(row[dc.index] || 0);
      if (qty <= 0) continue;

      const totalVolumeBE = Number((qty * volumeBE).toFixed(3));
      const warnings = [];
      if (!currentOutlet) warnings.push('Missing outlet name');
      if (!currentOutletMatch) warnings.push(`Outlet baru akan dibuat: ${currentOutlet}`);
      if (!dc.date) warnings.push(`Invalid date at col ${dc.index}`);

      preview.push({
        row: rowIdx + 1,
        outletName: currentOutletMatch ? currentOutletMatch.name : (currentOutlet || '-'),
        branchArea: currentBranch || '',
        salesName: currentSalesman || '-',
        date: dc.date,
        volume: totalVolumeBE,
        sku: productName,
        valid: true,
        isNewOutlet: !currentOutletMatch,
        isNewSalesman: !isKnownSalesman && !!currentSalesman,
        warnings
      });
    }
  }

  return {
    action: 'preview',
    total: preview.length,
    valid: preview.filter(p => p.valid).length,
    invalid: preview.filter(p => !p.valid).length,
    rows: preview
  };
};

// --- OHS (Outlet Health Score) Helpers ---
const getPreviousMonthRange = (month, year, monthsAgo) => {
  let targetMonth = month - monthsAgo;
  let targetYear = year;
  while (targetMonth <= 0) {
    targetMonth += 12;
    targetYear -= 1;
  }
  const start = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  const lastDay = String(new Date(targetYear, targetMonth, 0).getDate()).padStart(2, '0');
  const end = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${lastDay}`;
  return { month: targetMonth, year: targetYear, start, end };
};

const calculateOHS = (beCurrent, bePrev, bePrev2, freq3Mo) => {
  const totalBE = (beCurrent || 0) + (bePrev || 0) + (bePrev2 || 0);
  const avgBE = totalBE / 3;
  
  // Trend: month-over-month change
  const trend = bePrev > 0 ? ((beCurrent - bePrev) / bePrev) * 100 : (beCurrent > 0 ? 100 : 0);
  
  // Volume Score (0-100): based on total BE over 3 months, max at 100 BE
  const volumeScore = Math.min(totalBE, 100);
  
  // Trend Score (0-100): neutral at 0% trend = 50, +100% = 100, -100% = 0
  const trendScore = Math.max(0, Math.min(100, 50 + (trend / 2)));
  
  // Frequency Score (0-100): 20 transactions = 100 points
  const freqScore = Math.min((freq3Mo || 0) * 5, 100);
  
  // Weighted combination
  const ohs = Math.round((volumeScore * 0.40) + (trendScore * 0.40) + (freqScore * 0.20));
  
  return {
    score: Math.max(0, Math.min(100, ohs)),
    totalBE,
    avgBE,
    trend,
    freq3Mo: freq3Mo || 0,
    breakdown: {
      volume: Math.round(volumeScore),
      trend: Math.round(trendScore),
      frequency: Math.round(freqScore)
    }
  };
};

const verifyToken = (event) => {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch { return null; }
};

// Default bonus configurations based on backlog rules
const getDefaultPercentageConfig = (level) => {
  const base = level === 'L3' ? 1200000 : 1000000;
  return {
    base_reward: base,
    tiers: [
      { threshold: 90, reward: Math.round(base * 0.50), label: '90%' },
      { threshold: 100, reward: base, label: '100%' },
      { threshold: 110, reward: Math.round(base * 1.25), label: '110%' }
    ]
  };
};

const getDefaultVolumeConfig = () => ({
  tiers: [
    { threshold: 1500, reward: 250000, label: 'Tier 1' },
    { threshold: 2500, reward: 500000, label: 'Tier 2' },
    { threshold: 3500, reward: 750000, label: 'Tier 3' }
  ]
});

const getDefaultActiveOutletsConfig = (level) => {
  const base = level === 'L3' ? 400000 : 300000;
  return {
    base_reward: base,
    tiers: [
      { threshold: 90, reward: Math.round(base * 0.50), label: '90%' },
      { threshold: 100, reward: base, label: '100%' },
      { threshold: 125, reward: Math.round(base * 1.25), label: '125%' }
    ]
  };
};

const calculatePercentageBonus = (currentBE, targetBE, config) => {
  if (!targetBE || targetBE <= 0 || !config) return { attainment: 0, bonus: 0, tier: null };
  const attainment = (currentBE / targetBE) * 100;
  let activeTier = null;
  for (const tier of config.tiers) {
    if (attainment >= tier.threshold) activeTier = tier;
  }
  return { attainment, bonus: activeTier ? activeTier.reward : 0, tier: activeTier };
};

const calculateVolumeBonus = (currentBE, config) => {
  if (!config || !config.tiers) return { bonus: 0, tier: null };
  let activeTier = null;
  for (const tier of config.tiers) {
    if (currentBE >= tier.threshold) activeTier = tier;
  }
  return { bonus: activeTier ? activeTier.reward : 0, tier: activeTier };
};

const calculateActiveOutletsBonus = (totalAssigned, activeCount, config) => {
  if (!totalAssigned || totalAssigned === 0 || !config) return { percent: 0, bonus: 0, tier: null };
  const percent = (activeCount / totalAssigned) * 100;
  let activeTier = null;
  for (const tier of config.tiers) {
    if (percent >= tier.threshold) activeTier = tier;
  }
  return { percent, bonus: activeTier ? activeTier.reward : 0, tier: activeTier };
};

const getCurrentMonthRange = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = String(new Date(year, month, 0).getDate()).padStart(2, '0');
  const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  return { month, year, start, end };
};

const getUserDashboardData = async (userId) => {
  const { month, year, start, end } = getCurrentMonthRange();

  const userRows = await sql`SELECT id, name, email, role, region, level FROM users WHERE id = ${userId}`;
  if (!userRows.length) throw new Error('User not found');
  const user = userRows[0];

  const targetRows = await sql`SELECT id, target_be, percentage_config, volume_config, active_outlets_config FROM targets WHERE user_id = ${userId} AND month = ${month} AND year = ${year}`;
  let targetData = targetRows[0] || null;

  if (!targetData) {
    // Auto-create defaults
    const defaultTarget = user.level === 'L3' ? 3500 : 3499;
    const pc = getDefaultPercentageConfig(user.level);
    const vc = getDefaultVolumeConfig();
    const ac = getDefaultActiveOutletsConfig(user.level);
    const insertRes = await sql`
      INSERT INTO targets (id, user_id, month, year, target_be, percentage_config, volume_config, active_outlets_config)
      VALUES (gen_random_uuid(), ${userId}, ${month}, ${year}, ${defaultTarget}, ${JSON.stringify(pc)}::jsonb, ${JSON.stringify(vc)}::jsonb, ${JSON.stringify(ac)}::jsonb)
      ON CONFLICT (user_id, month, year) DO UPDATE SET target_be = EXCLUDED.target_be
      RETURNING id, target_be, percentage_config, volume_config, active_outlets_config
    `;
    targetData = insertRes[0];
  } else {
    // Auto-migrate old percentage config (threshold 50%) to new (threshold 90%)
    const pc = targetData.percentage_config;
    if (pc && pc.tiers && pc.tiers[0] && pc.tiers[0].threshold === 50) {
      const newPc = getDefaultPercentageConfig(user.level);
      await sql`UPDATE targets SET percentage_config = ${JSON.stringify(newPc)}::jsonb WHERE id = ${targetData.id}`;
      targetData.percentage_config = newPc;
    }
  }

  const salesSum = await sql`SELECT COALESCE(SUM(volume_be), 0) as total FROM sales_records WHERE sales_id = ${userId} AND record_date >= ${start}`;
  const currentBE = parseFloat(salesSum[0].total);
  const targetBE = parseFloat(targetData.target_be);

  // Percentage bonus
  const percentageResult = calculatePercentageBonus(currentBE, targetBE, targetData.percentage_config);

  // Volume bonus
  const volumeResult = calculateVolumeBonus(currentBE, targetData.volume_config);

  // Active outlets
  const assignedRows = await sql`
    SELECT o.id, EXISTS(
      SELECT 1 FROM sales_records sr WHERE sr.outlet_id = o.id AND sr.record_date >= ${start} AND sr.record_date <= ${end}
    ) as is_active
    FROM outlets o
    INNER JOIN outlet_assignments oa ON oa.outlet_id = o.id AND oa.salesman_id = ${userId} AND oa.unassigned_at IS NULL
  `;
  const totalAssigned = assignedRows.length;
  const activeCount = assignedRows.filter(r => r.is_active).length;
  const activeResult = calculateActiveOutletsBonus(totalAssigned, activeCount, targetData.active_outlets_config);

  const totalBonus = percentageResult.bonus + volumeResult.bonus + activeResult.bonus;

  // SKU performance - current month detailed
  const prevMonthNum = month === 1 ? 12 : month - 1;
  const prevMonthYear = month === 1 ? year - 1 : year;
  const prevMonthStart = `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}-01`;
  const prevMonthEnd = `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}-${String(new Date(prevMonthYear, prevMonthNum, 0).getDate()).padStart(2, '0')}`;
  const lastYearStart = `${year - 1}-${String(month).padStart(2, '0')}-01`;
  const lastYearEnd = `${year - 1}-${String(month).padStart(2, '0')}-${String(new Date(year - 1, month, 0).getDate()).padStart(2, '0')}`;

  const skuCurrent = await sql`
    SELECT 
      sku_name,
      SUM(volume_be) as volume,
      COUNT(*) as transaction_count,
      AVG(volume_be) as avg_order
    FROM sales_records
    WHERE sales_id = ${userId} AND record_date >= ${start} AND record_date <= ${end}
      AND sku_name IS NOT NULL AND sku_name <> ''
    GROUP BY sku_name ORDER BY volume DESC LIMIT 5
  `;

  const skuPrevMonth = await sql`
    SELECT sku_name, SUM(volume_be) as volume, COUNT(*) as transaction_count FROM sales_records
    WHERE sales_id = ${userId} AND record_date >= ${prevMonthStart} AND record_date <= ${prevMonthEnd}
      AND sku_name IS NOT NULL AND sku_name <> ''
    GROUP BY sku_name
  `;

  const skuLastYear = await sql`
    SELECT sku_name, SUM(volume_be) as volume FROM sales_records
    WHERE sales_id = ${userId} AND record_date >= ${lastYearStart} AND record_date <= ${lastYearEnd}
      AND sku_name IS NOT NULL AND sku_name <> ''
    GROUP BY sku_name
  `;

  // Get top outlet per SKU for current month
  const skuTopOutlets = await sql`
    SELECT DISTINCT ON (sku_name)
      sku_name,
      o.name as outlet_name,
      SUM(volume_be) as outlet_volume
    FROM sales_records sr
    LEFT JOIN outlets o ON o.id = sr.outlet_id
    WHERE sr.sales_id = ${userId} AND sr.record_date >= ${start} AND sr.record_date <= ${end}
      AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
    GROUP BY sr.sku_name, o.name
    ORDER BY sr.sku_name, outlet_volume DESC
  `;

  // Get weekly breakdown for current month (4 weeks)
  const skuWeekly = await sql`
    SELECT 
      sku_name,
      EXTRACT(WEEK FROM record_date) as week_num,
      SUM(volume_be) as weekly_volume
    FROM sales_records
    WHERE sales_id = ${userId} AND record_date >= ${start} AND record_date <= ${end}
      AND sku_name IS NOT NULL AND sku_name <> ''
    GROUP BY sku_name, EXTRACT(WEEK FROM record_date)
    ORDER BY sku_name, week_num
  `;

  // Get detailed transactions per SKU for current month
  const skuTransactions = await sql`
    SELECT 
      sr.sku_name,
      sr.record_date::text as date,
      sr.volume_be as be,
      o.name as outlet_name
    FROM sales_records sr
    LEFT JOIN outlets o ON o.id = sr.outlet_id
    WHERE sr.sales_id = ${userId} AND sr.record_date >= ${start} AND sr.record_date <= ${end}
      AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
    ORDER BY sr.sku_name, sr.record_date DESC
  `;

  // Get detailed transactions per SKU for PREVIOUS month
  const skuPrevTransactions = await sql`
    SELECT 
      sr.sku_name,
      sr.record_date::text as date,
      sr.volume_be as be,
      o.name as outlet_name
    FROM sales_records sr
    LEFT JOIN outlets o ON o.id = sr.outlet_id
    WHERE sr.sales_id = ${userId} AND sr.record_date >= ${prevMonthStart} AND sr.record_date <= ${prevMonthEnd}
      AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
    ORDER BY sr.sku_name, sr.record_date DESC
  `;

  const prevMonthMap = Object.fromEntries(skuPrevMonth.map(r => [
    r.sku_name, 
    { volume: parseFloat(r.volume || 0), transactionCount: parseInt(r.transaction_count || 0) }
  ]));
  const lastYearMap = Object.fromEntries(skuLastYear.map(r => [r.sku_name, parseFloat(r.volume || 0)]));
  const topOutletMap = Object.fromEntries(skuTopOutlets.map(r => [r.sku_name, { name: r.outlet_name, volume: parseFloat(r.outlet_volume || 0) }]));

  // Group weekly data by sku
  const weeklyMap = {};
  for (const row of skuWeekly) {
    if (!weeklyMap[row.sku_name]) weeklyMap[row.sku_name] = [];
    weeklyMap[row.sku_name].push(parseFloat(row.weekly_volume || 0));
  }

  // Group transactions by sku (current month)
  const transactionsMap = {};
  for (const row of skuTransactions) {
    if (!transactionsMap[row.sku_name]) transactionsMap[row.sku_name] = [];
    transactionsMap[row.sku_name].push({
      date: row.date,
      be: parseFloat(row.be || 0),
      outlet: row.outlet_name || '-'
    });
  }

  // Group transactions by sku (previous month)
  const prevTransactionsMap = {};
  for (const row of skuPrevTransactions) {
    if (!prevTransactionsMap[row.sku_name]) prevTransactionsMap[row.sku_name] = [];
    prevTransactionsMap[row.sku_name].push({
      date: row.date,
      be: parseFloat(row.be || 0),
      outlet: row.outlet_name || '-'
    });
  }

  const totalSkuVolume = skuCurrent.reduce((sum, r) => sum + parseFloat(r.volume || 0), 0);

  const skuPerformance = skuCurrent.map(r => {
    const volume = parseFloat(r.volume || 0);
    const prevData = prevMonthMap[r.sku_name] || { volume: 0, transactionCount: 0 };
    const prev = prevData.volume;
    const lastY = lastYearMap[r.sku_name] || 0;
    const momTrend = prev > 0 ? ((volume - prev) / prev) * 100 : (volume > 0 ? 100 : 0);
    const yoyTrend = lastY > 0 ? ((volume - lastY) / lastY) * 100 : (volume > 0 ? 100 : 0);
    const topOutletData = topOutletMap[r.sku_name] || { name: '-', volume: 0 };
    const weekly = weeklyMap[r.sku_name] || [];
    // Pad to 4 weeks if less
    while (weekly.length < 4) weekly.unshift(0);
    // Take last 4 weeks
    const monthlyHistory = weekly.slice(-4);
    const topOutletContrib = volume > 0 ? Math.round((topOutletData.volume / volume) * 100) : 0;
    
    return {
      name: r.sku_name,
      volume,
      transactionCount: parseInt(r.transaction_count || 0),
      avgOrder: parseFloat(r.avg_order || 0),
      topOutlet: topOutletData.name,
      topOutletVolume: topOutletData.volume,
      topOutletContrib,
      mixPercent: totalSkuVolume > 0 ? (volume / totalSkuVolume) * 100 : 0,
      momTrend,
      yoyTrend,
      prevVolume: prev,
      prevTransactionCount: prevData.transactionCount,
      monthlyHistory,
      transactions: transactionsMap[r.sku_name] || [],
      prevTransactions: prevTransactionsMap[r.sku_name] || []
    };
  });

  // Outlets data with historical BE for OHS calculation
  const { start: prevStart, end: prevEnd } = getPreviousMonthRange(month, year, 1);
  const { start: prev2Start, end: prev2End } = getPreviousMonthRange(month, year, 2);
  const historyStart = prev2Start;

  const outletRows = await sql`
    SELECT 
      o.id, o.name, o.type, o.address, o.contact_person, o.branch_area,
      COALESCE(SUM(CASE WHEN sr.record_date >= ${start} AND sr.record_date <= ${end} THEN sr.volume_be ELSE 0 END), 0) as be_current,
      COALESCE(SUM(CASE WHEN sr.record_date >= ${prevStart} AND sr.record_date <= ${prevEnd} THEN sr.volume_be ELSE 0 END), 0) as be_prev,
      COALESCE(SUM(CASE WHEN sr.record_date >= ${prev2Start} AND sr.record_date <= ${prev2End} THEN sr.volume_be ELSE 0 END), 0) as be_prev2,
      COALESCE(SUM(CASE WHEN sr.record_date >= ${historyStart} AND sr.record_date <= ${end} THEN 1 ELSE 0 END), 0) as freq_3mo,
      MAX(sr.record_date) as last_order
    FROM outlets o
    LEFT JOIN outlet_assignments oa ON oa.outlet_id = o.id AND oa.salesman_id = ${userId} AND oa.unassigned_at IS NULL
    LEFT JOIN sales_records sr ON sr.outlet_id = o.id AND sr.sales_id = ${userId}
    WHERE oa.id IS NOT NULL
    GROUP BY o.id, o.name, o.type, o.address, o.contact_person, o.branch_area
  `;

  const now = new Date();
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(year, month, 0).getDate();

  return {
    user,
    dashboardStats: {
      monthlyTargetBE: targetBE,
      currentBE,
      daysElapsed,
      totalWorkingDays: 22,
      daysInMonth,
      percentageConfig: targetData.percentage_config,
      volumeConfig: targetData.volume_config,
      activeOutletsConfig: targetData.active_outlets_config
    },
    bonusSummary: {
      percentage: percentageResult,
      volume: volumeResult,
      activeOutlets: { ...activeResult, activeCount, totalAssigned },
      total: totalBonus
    },
    outlets: outletRows.map(o => {
      const ohsData = calculateOHS(
        parseFloat(o.be_current || 0),
        parseFloat(o.be_prev || 0),
        parseFloat(o.be_prev2 || 0),
        parseInt(o.freq_3mo || 0)
      );
      const daysSince = o.last_order ? Math.floor((Date.now() - new Date(o.last_order)) / 86400000) : 99;
      return {
        id: o.id, name: o.name, type: o.type, address: o.address, contact: o.contact_person, branchArea: o.branch_area || '',
        beMonth: parseFloat(o.be_current || 0),
        health: ohsData.score,
        healthBreakdown: ohsData.breakdown,
        totalBE3Mo: ohsData.totalBE,
        avgBE: ohsData.avgBE,
        trend: ohsData.trend,
        freq3Mo: ohsData.freq3Mo,
        lastOrder: daysSince === 0 ? 'Today' : `${daysSince} days ago`,
        alert: ohsData.score < 40 ? 'Unhealthy Outlet' : ohsData.score < 70 ? 'Needs Attention' : null
      };
    }),
    skuPerformance,
    daysElapsed,
    daysInMonth
  };
};

const getSupervisorDashboardData = async (supervisorId) => {
  const { month, year, start, end } = getCurrentMonthRange();

  // Get supervisor's region
  const supRows = await sql`SELECT region FROM users WHERE id = ${supervisorId}`;
  const region = supRows[0]?.region || '';

  // Team members in same region (all sales + supervisors if needed)
  const teamRows = await sql`
    SELECT id, name, email, role, region, level FROM users
    WHERE role = 'sales' AND (region = ${region} OR ${region} = '')
    ORDER BY name
  `;

  const teamData = [];
  let totalTeamBE = 0;
  let totalTarget = 0;

  for (const member of teamRows) {
    const tRows = await sql`SELECT target_be, percentage_config, volume_config, active_outlets_config FROM targets WHERE user_id = ${member.id} AND month = ${month} AND year = ${year}`;
    let targetData = tRows[0];
    if (!targetData) {
      const defaultTarget = member.level === 'L3' ? 3500 : 3499;
      const pc = getDefaultPercentageConfig(member.level);
      const vc = getDefaultVolumeConfig();
      const ac = getDefaultActiveOutletsConfig(member.level);
      const insertRes = await sql`
        INSERT INTO targets (id, user_id, month, year, target_be, percentage_config, volume_config, active_outlets_config)
        VALUES (gen_random_uuid(), ${member.id}, ${month}, ${year}, ${defaultTarget}, ${JSON.stringify(pc)}::jsonb, ${JSON.stringify(vc)}::jsonb, ${JSON.stringify(ac)}::jsonb)
        ON CONFLICT (user_id, month, year) DO UPDATE SET target_be = EXCLUDED.target_be
        RETURNING target_be, percentage_config, volume_config, active_outlets_config
      `;
      targetData = insertRes[0];
    }

    const salesSum = await sql`SELECT COALESCE(SUM(volume_be), 0) as total FROM sales_records WHERE sales_id = ${member.id} AND record_date >= ${start}`;
    const currentBE = parseFloat(salesSum[0].total);
    const targetBE = parseFloat(targetData.target_be);

    const percentageResult = calculatePercentageBonus(currentBE, targetBE, targetData.percentage_config);
    const volumeResult = calculateVolumeBonus(currentBE, targetData.volume_config);

    const assignedRows = await sql`
      SELECT o.id, EXISTS(
        SELECT 1 FROM sales_records sr WHERE sr.outlet_id = o.id AND sr.record_date >= ${start} AND sr.record_date <= ${end}
      ) as is_active
      FROM outlets o
      INNER JOIN outlet_assignments oa ON oa.outlet_id = o.id AND oa.salesman_id = ${member.id} AND oa.unassigned_at IS NULL
    `;
    const totalAssigned = assignedRows.length;
    const activeCount = assignedRows.filter(r => r.is_active).length;
    const activeResult = calculateActiveOutletsBonus(totalAssigned, activeCount, targetData.active_outlets_config);

    const totalBonus = percentageResult.bonus + volumeResult.bonus + activeResult.bonus;
    const attainment = targetBE > 0 ? Math.round((currentBE / targetBE) * 100) : 0;

    totalTeamBE += currentBE;
    totalTarget += targetBE;

    teamData.push({
      ...member,
      currentBE,
      targetBE,
      attainment,
      totalBonus,
      totalAssigned,
      activeCount,
      percentageResult,
      volumeResult,
      activeResult
    });
  }

  const vacantCount = await sql`
    SELECT COUNT(*) as cnt FROM outlets o
    WHERE NOT EXISTS (
      SELECT 1 FROM outlet_assignments oa WHERE oa.outlet_id = o.id AND oa.unassigned_at IS NULL
    )
  `;

  const { start: prevStart, end: prevEnd } = getPreviousMonthRange(month, year, 1);
  const { start: prev2Start, end: prev2End } = getPreviousMonthRange(month, year, 2);
  const historyStart = prev2Start;

  // --- Supervisor/Admin SKU Performance (region-aggregated) ---
  const prevMonthNum = month === 1 ? 12 : month - 1;
  const prevMonthYear = month === 1 ? year - 1 : year;
  const prevMonthStart = `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}-01`;
  const prevMonthEnd = `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}-${String(new Date(prevMonthYear, prevMonthNum, 0).getDate()).padStart(2, '0')}`;
  const lastYearStart = `${year - 1}-${String(month).padStart(2, '0')}-01`;
  const lastYearEnd = `${year - 1}-${String(month).padStart(2, '0')}-${String(new Date(year - 1, month, 0).getDate()).padStart(2, '0')}`;

  const supSkuCurrent = await sql`
    SELECT 
      sr.sku_name,
      SUM(sr.volume_be) as volume,
      COUNT(*) as transaction_count,
      AVG(sr.volume_be) as avg_order
    FROM sales_records sr
    LEFT JOIN users u ON sr.sales_id = u.id
    WHERE sr.record_date >= ${start} AND sr.record_date <= ${end}
      AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
      AND (${region} = '' OR u.region = ${region})
    GROUP BY sr.sku_name ORDER BY volume DESC LIMIT 10
  `;

  const supSkuPrevMonth = await sql`
    SELECT sr.sku_name, SUM(sr.volume_be) as volume, COUNT(*) as transaction_count
    FROM sales_records sr
    LEFT JOIN users u ON sr.sales_id = u.id
    WHERE sr.record_date >= ${prevMonthStart} AND sr.record_date <= ${prevMonthEnd}
      AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
      AND (${region} = '' OR u.region = ${region})
    GROUP BY sr.sku_name
  `;

  const supSkuLastYear = await sql`
    SELECT sr.sku_name, SUM(sr.volume_be) as volume
    FROM sales_records sr
    LEFT JOIN users u ON sr.sales_id = u.id
    WHERE sr.record_date >= ${lastYearStart} AND sr.record_date <= ${lastYearEnd}
      AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
      AND (${region} = '' OR u.region = ${region})
    GROUP BY sr.sku_name
  `;

  const supSkuTopOutlets = await sql`
    SELECT DISTINCT ON (sr.sku_name)
      sr.sku_name,
      o.name as outlet_name,
      SUM(sr.volume_be) as outlet_volume
    FROM sales_records sr
    LEFT JOIN outlets o ON o.id = sr.outlet_id
    LEFT JOIN users u ON sr.sales_id = u.id
    WHERE sr.record_date >= ${start} AND sr.record_date <= ${end}
      AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
      AND (${region} = '' OR u.region = ${region})
    GROUP BY sr.sku_name, o.name
    ORDER BY sr.sku_name, outlet_volume DESC
  `;

  const supSkuWeekly = await sql`
    SELECT 
      sr.sku_name,
      EXTRACT(WEEK FROM sr.record_date) as week_num,
      SUM(sr.volume_be) as weekly_volume
    FROM sales_records sr
    LEFT JOIN users u ON sr.sales_id = u.id
    WHERE sr.record_date >= ${start} AND sr.record_date <= ${end}
      AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
      AND (${region} = '' OR u.region = ${region})
    GROUP BY sr.sku_name, EXTRACT(WEEK FROM sr.record_date)
    ORDER BY sr.sku_name, week_num
  `;

  const supSkuTransactions = await sql`
    SELECT 
      sr.sku_name,
      sr.record_date::text as date,
      sr.volume_be as be,
      o.name as outlet_name
    FROM sales_records sr
    LEFT JOIN outlets o ON o.id = sr.outlet_id
    LEFT JOIN users u ON sr.sales_id = u.id
    WHERE sr.record_date >= ${start} AND sr.record_date <= ${end}
      AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
      AND (${region} = '' OR u.region = ${region})
    ORDER BY sr.sku_name, sr.record_date DESC
  `;

  const supSkuPrevTransactions = await sql`
    SELECT 
      sr.sku_name,
      sr.record_date::text as date,
      sr.volume_be as be,
      o.name as outlet_name
    FROM sales_records sr
    LEFT JOIN outlets o ON o.id = sr.outlet_id
    LEFT JOIN users u ON sr.sales_id = u.id
    WHERE sr.record_date >= ${prevMonthStart} AND sr.record_date <= ${prevMonthEnd}
      AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
      AND (${region} = '' OR u.region = ${region})
    ORDER BY sr.sku_name, sr.record_date DESC
  `;

  const supPrevMonthMap = Object.fromEntries(supSkuPrevMonth.map(r => [
    r.sku_name,
    { volume: parseFloat(r.volume || 0), transactionCount: parseInt(r.transaction_count || 0) }
  ]));
  const supLastYearMap = Object.fromEntries(supSkuLastYear.map(r => [r.sku_name, parseFloat(r.volume || 0)]));
  const supTopOutletMap = Object.fromEntries(supSkuTopOutlets.map(r => [r.sku_name, { name: r.outlet_name, volume: parseFloat(r.outlet_volume || 0) }]));

  const supWeeklyMap = {};
  for (const row of supSkuWeekly) {
    if (!supWeeklyMap[row.sku_name]) supWeeklyMap[row.sku_name] = [];
    supWeeklyMap[row.sku_name].push(parseFloat(row.weekly_volume || 0));
  }

  const supTransactionsMap = {};
  for (const row of supSkuTransactions) {
    if (!supTransactionsMap[row.sku_name]) supTransactionsMap[row.sku_name] = [];
    supTransactionsMap[row.sku_name].push({ date: row.date, be: parseFloat(row.be || 0), outlet: row.outlet_name || '-' });
  }

  const supPrevTransactionsMap = {};
  for (const row of supSkuPrevTransactions) {
    if (!supPrevTransactionsMap[row.sku_name]) supPrevTransactionsMap[row.sku_name] = [];
    supPrevTransactionsMap[row.sku_name].push({ date: row.date, be: parseFloat(row.be || 0), outlet: row.outlet_name || '-' });
  }

  const supTotalSkuVolume = supSkuCurrent.reduce((sum, r) => sum + parseFloat(r.volume || 0), 0);

  const supSkuPerformance = supSkuCurrent.map(r => {
    const volume = parseFloat(r.volume || 0);
    const prevData = supPrevMonthMap[r.sku_name] || { volume: 0, transactionCount: 0 };
    const prev = prevData.volume;
    const lastY = supLastYearMap[r.sku_name] || 0;
    const momTrend = prev > 0 ? ((volume - prev) / prev) * 100 : (volume > 0 ? 100 : 0);
    const yoyTrend = lastY > 0 ? ((volume - lastY) / lastY) * 100 : (volume > 0 ? 100 : 0);
    const topOutletData = supTopOutletMap[r.sku_name] || { name: '-', volume: 0 };
    const weekly = supWeeklyMap[r.sku_name] || [];
    while (weekly.length < 4) weekly.unshift(0);
    const monthlyHistory = weekly.slice(-4);
    const topOutletContrib = volume > 0 ? Math.round((topOutletData.volume / volume) * 100) : 0;

    return {
      name: r.sku_name,
      volume,
      transactionCount: parseInt(r.transaction_count || 0),
      avgOrder: parseFloat(r.avg_order || 0),
      topOutlet: topOutletData.name,
      topOutletVolume: topOutletData.volume,
      topOutletContrib,
      mixPercent: supTotalSkuVolume > 0 ? (volume / supTotalSkuVolume) * 100 : 0,
      momTrend,
      yoyTrend,
      prevVolume: prev,
      prevTransactionCount: prevData.transactionCount,
      monthlyHistory,
      transactions: supTransactionsMap[r.sku_name] || [],
      prevTransactions: supPrevTransactionsMap[r.sku_name] || []
    };
  });
  // --- end SKU performance ---

  const outletRows = await sql`
    SELECT 
      o.id, o.name, o.type, o.address, o.contact_person, o.branch_area,
      u.name as salesman_name,
      COALESCE(SUM(CASE WHEN sr.record_date >= ${start} AND sr.record_date <= ${end} THEN sr.volume_be ELSE 0 END), 0) as be_current,
      COALESCE(SUM(CASE WHEN sr.record_date >= ${prevStart} AND sr.record_date <= ${prevEnd} THEN sr.volume_be ELSE 0 END), 0) as be_prev,
      COALESCE(SUM(CASE WHEN sr.record_date >= ${prev2Start} AND sr.record_date <= ${prev2End} THEN sr.volume_be ELSE 0 END), 0) as be_prev2,
      COALESCE(SUM(CASE WHEN sr.record_date >= ${historyStart} AND sr.record_date <= ${end} THEN 1 ELSE 0 END), 0) as freq_3mo,
      MAX(sr.record_date) as last_order
    FROM outlets o
    LEFT JOIN outlet_assignments oa ON oa.outlet_id = o.id AND oa.unassigned_at IS NULL
    LEFT JOIN users u ON oa.salesman_id = u.id
    LEFT JOIN sales_records sr ON sr.outlet_id = o.id
    GROUP BY o.id, o.name, o.type, o.address, o.contact_person, o.branch_area, u.name
  `;

  return {
    team: teamData,
    teamStats: {
      totalTeamBE,
      totalTarget,
      teamAttainment: totalTarget > 0 ? Math.round((totalTeamBE / totalTarget) * 100) : 0,
      vacantOutlets: parseInt(vacantCount[0].cnt)
    },
    skuPerformance: supSkuPerformance,
    outlets: outletRows.map(o => {
      const ohsData = calculateOHS(
        parseFloat(o.be_current || 0),
        parseFloat(o.be_prev || 0),
        parseFloat(o.be_prev2 || 0),
        parseInt(o.freq_3mo || 0)
      );
      const daysSince = o.last_order ? Math.floor((Date.now() - new Date(o.last_order)) / 86400000) : 99;
      return {
        id: o.id, name: o.name, type: o.type, address: o.address, contact: o.contact_person, branchArea: o.branch_area || '',
        salesman: o.salesman_name || 'Vacant',
        beMonth: parseFloat(o.be_current || 0),
        health: ohsData.score,
        healthBreakdown: ohsData.breakdown,
        totalBE3Mo: ohsData.totalBE,
        avgBE: ohsData.avgBE,
        trend: ohsData.trend,
        freq3Mo: ohsData.freq3Mo,
        lastOrder: daysSince === 0 ? 'Today' : `${daysSince} days ago`,
        alert: ohsData.score < 40 ? 'Unhealthy Outlet' : ohsData.score < 70 ? 'Needs Attention' : null
      };
    })
  };
};

export const handler = async (event) => {
  const params = event.query || {};
  const user = verifyToken(event);
  const type = params.type || (user ? null : 'records');
  const id = params.id;
  const isJson = event.headers['content-type']?.includes('application/json');

  try {
    // --- AUTH ---
    if (type === 'auth' && event.method === 'POST') {
      const { email, password } = JSON.parse(event.body);
      const dbUser = await sql`SELECT * FROM users WHERE email = ${email}`;
      if (!dbUser[0] || !dbUser[0].password_hash || !(await bcrypt.compare(password, dbUser[0].password_hash))) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid email or password' }) };
      }
      const token = jwt.sign({ id: dbUser[0].id, role: dbUser[0].role, email: dbUser[0].email }, JWT_SECRET, { expiresIn: '7d' });
      return { statusCode: 200, body: JSON.stringify({ token, user: { id: dbUser[0].id, name: dbUser[0].name, role: dbUser[0].role, region: dbUser[0].region, level: dbUser[0].level } }) };
    }

    // --- GET ---
    if (event.method === 'GET') {
      const page = Math.max(1, parseInt(params.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(params.limit) || 5));
      const offset = (page - 1) * limit;
      const search = (params.search || '').trim();
      const searchPattern = search ? `%${search}%` : '%';

      const paginateResponse = (data, total) => ({
        statusCode: 200,
        body: JSON.stringify({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
      });

      if (type === 'profile') {
        if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
        const dataRes = await sql`SELECT id, name, email, role, region, level, created_at FROM users WHERE id = ${user.id}`;
        return { statusCode: 200, body: JSON.stringify({ data: dataRes[0] || null }) };
      }
      if (type === 'users') {
        const dataRes = await sql`
          SELECT id, name, email, role, region, level, created_at FROM users
          WHERE (name ILIKE ${searchPattern} OR email ILIKE ${searchPattern} OR role ILIKE ${searchPattern} OR region ILIKE ${searchPattern})
          ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
        const countRes = await sql`
          SELECT COUNT(*) as cnt FROM users
          WHERE (name ILIKE ${searchPattern} OR email ILIKE ${searchPattern} OR role ILIKE ${searchPattern} OR region ILIKE ${searchPattern})
        `;
        return paginateResponse(dataRes.map(u => ({...u, password_hash: '••••••'})), parseInt(countRes[0].cnt));
      }
      if (type === 'outlets') {
        const dataRes = await sql`
          SELECT id, name, type, address, contact_person, branch_area, created_at FROM outlets
          WHERE (name ILIKE ${searchPattern} OR type ILIKE ${searchPattern} OR address ILIKE ${searchPattern} OR contact_person ILIKE ${searchPattern} OR branch_area ILIKE ${searchPattern})
          ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
        const countRes = await sql`
          SELECT COUNT(*) as cnt FROM outlets
          WHERE (name ILIKE ${searchPattern} OR type ILIKE ${searchPattern} OR address ILIKE ${searchPattern} OR contact_person ILIKE ${searchPattern} OR branch_area ILIKE ${searchPattern})
        `;
        return paginateResponse(dataRes, parseInt(countRes[0].cnt));
      }
      if (type === 'records') {
        const dataRes = await sql`
          SELECT sr.id, o.name as outlet, u.name as sales, sr.record_date::text as date,
                 sr.volume_be as be, sr.sku_name as sku, sr.outlet_id, sr.sales_id
          FROM sales_records sr
          LEFT JOIN outlets o ON sr.outlet_id = o.id
          LEFT JOIN users u ON sr.sales_id = u.id
          WHERE (o.name ILIKE ${searchPattern} OR u.name ILIKE ${searchPattern} OR sr.sku_name ILIKE ${searchPattern})
          ORDER BY sr.record_date DESC LIMIT ${limit} OFFSET ${offset}
        `;
        const countRes = await sql`
          SELECT COUNT(*) as cnt FROM sales_records sr
          LEFT JOIN outlets o ON sr.outlet_id = o.id
          LEFT JOIN users u ON sr.sales_id = u.id
          WHERE (o.name ILIKE ${searchPattern} OR u.name ILIKE ${searchPattern} OR sr.sku_name ILIKE ${searchPattern})
        `;
        return paginateResponse(dataRes, parseInt(countRes[0].cnt));
      }
      if (type === 'outlet-history') {
        const outletId = params.outlet_id;
        if (!outletId) return { statusCode: 400, body: JSON.stringify({ error: 'outlet_id required' }) };

        // Calculate 3-month date range
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const startDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
        const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const historyRes = await sql`
          SELECT sr.id, sr.record_date::text as date, sr.volume_be as be, sr.sku_name as sku
          FROM sales_records sr
          WHERE sr.outlet_id = ${outletId}
            AND sr.record_date >= ${startDate}
            AND sr.record_date <= ${endDate}
          ORDER BY sr.record_date DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        const countRes = await sql`
          SELECT COUNT(*) as cnt FROM sales_records sr
          WHERE sr.outlet_id = ${outletId}
            AND sr.record_date >= ${startDate}
            AND sr.record_date <= ${endDate}
        `;
        return paginateResponse(historyRes, parseInt(countRes[0].cnt));
      }
      if (type === 'assignments') {
        const mode = params.mode;
        if (mode === 'vacant') {
          const dataRes = await sql`
            SELECT o.* FROM outlets o
            WHERE NOT EXISTS (
              SELECT 1 FROM outlet_assignments oa WHERE oa.outlet_id = o.id AND oa.unassigned_at IS NULL
            )
            AND (o.name ILIKE ${searchPattern} OR o.type ILIKE ${searchPattern} OR o.branch_area ILIKE ${searchPattern} OR o.address ILIKE ${searchPattern})
            ORDER BY o.name LIMIT ${limit} OFFSET ${offset}
          `;
          const countRes = await sql`
            SELECT COUNT(*) as cnt FROM outlets o
            WHERE NOT EXISTS (
              SELECT 1 FROM outlet_assignments oa WHERE oa.outlet_id = o.id AND oa.unassigned_at IS NULL
            )
            AND (o.name ILIKE ${searchPattern} OR o.type ILIKE ${searchPattern} OR o.branch_area ILIKE ${searchPattern} OR o.address ILIKE ${searchPattern})
          `;
          return paginateResponse(dataRes, parseInt(countRes[0].cnt));
        }
        const dataRes = await sql`
          SELECT oa.id, oa.outlet_id, oa.salesman_id, oa.assigned_at, oa.unassigned_at, oa.notes,
                 o.name as outlet_name, o.branch_area, u.name as salesman_name
          FROM outlet_assignments oa
          LEFT JOIN outlets o ON oa.outlet_id = o.id
          LEFT JOIN users u ON oa.salesman_id = u.id
          WHERE oa.unassigned_at IS NULL
            AND (o.name ILIKE ${searchPattern} OR o.branch_area ILIKE ${searchPattern} OR u.name ILIKE ${searchPattern})
          ORDER BY o.name LIMIT ${limit} OFFSET ${offset}
        `;
        const countRes = await sql`
          SELECT COUNT(*) as cnt FROM outlet_assignments oa
          LEFT JOIN outlets o ON oa.outlet_id = o.id
          LEFT JOIN users u ON oa.salesman_id = u.id
          WHERE oa.unassigned_at IS NULL
            AND (o.name ILIKE ${searchPattern} OR o.branch_area ILIKE ${searchPattern} OR u.name ILIKE ${searchPattern})
        `;
        return paginateResponse(dataRes, parseInt(countRes[0].cnt));
      }
      if (type === 'targets') {
        const targetUserId = params.user_id;
        if (targetUserId) {
          const dataRes = await sql`
            SELECT t.*, u.name as user_name FROM targets t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.user_id = ${targetUserId}
              AND (u.name ILIKE ${searchPattern} OR CAST(t.month AS TEXT) ILIKE ${searchPattern} OR CAST(t.year AS TEXT) ILIKE ${searchPattern})
            ORDER BY t.year DESC, t.month DESC LIMIT ${limit} OFFSET ${offset}
          `;
          const countRes = await sql`
            SELECT COUNT(*) as cnt FROM targets t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.user_id = ${targetUserId}
              AND (u.name ILIKE ${searchPattern} OR CAST(t.month AS TEXT) ILIKE ${searchPattern} OR CAST(t.year AS TEXT) ILIKE ${searchPattern})
          `;
          return paginateResponse(dataRes, parseInt(countRes[0].cnt));
        }
        const dataRes = await sql`
          SELECT t.*, u.name as user_name FROM targets t
          LEFT JOIN users u ON t.user_id = u.id
          WHERE (u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern} OR CAST(t.month AS TEXT) ILIKE ${searchPattern} OR CAST(t.year AS TEXT) ILIKE ${searchPattern})
          ORDER BY t.year DESC, t.month DESC LIMIT ${limit} OFFSET ${offset}
        `;
        const countRes = await sql`
          SELECT COUNT(*) as cnt FROM targets t
          LEFT JOIN users u ON t.user_id = u.id
          WHERE (u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern} OR CAST(t.month AS TEXT) ILIKE ${searchPattern} OR CAST(t.year AS TEXT) ILIKE ${searchPattern})
        `;
        return paginateResponse(dataRes, parseInt(countRes[0].cnt));
      }
      // Dashboard data
      if (!type && user) {
        if (user.role === 'sales') {
          return { statusCode: 200, body: JSON.stringify(await getUserDashboardData(user.id)) };
        }
        if (user.role === 'supervisor') {
          return { statusCode: 200, body: JSON.stringify(await getSupervisorDashboardData(user.id)) };
        }
        if (user.role === 'admin') {
          return { statusCode: 200, body: JSON.stringify(await getSupervisorDashboardData(user.id)) };
        }
      }
      // Fallback old transformToFrontend for backwards compat
      if (!type) {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const userId = process.env.DEFAULT_USER_ID;
        if (!userId) throw new Error('DEFAULT_USER_ID missing');

        const targetRow = await sql`SELECT target_be, incentive_rules FROM targets WHERE user_id = ${userId} AND month = ${currentMonth} AND year = ${currentYear}`;
        if (!targetRow?.length) throw new Error('No target configured');

        const salesSum = await sql`SELECT COALESCE(SUM(volume_be), 0) as total FROM sales_records WHERE record_date >= ${`${currentYear}-${String(currentMonth).padStart(2,'0')}-01`}`;
        const daysElapsed = Math.min(new Date().getDate(), 22);

        const outlets = await sql`
          SELECT o.id, o.name, o.type, o.address, o.contact_person,
                 COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM sr.record_date) = ${currentMonth} THEN sr.volume_be ELSE 0 END), 0) as beMonth,
                 MAX(sr.record_date) as last_order
          FROM outlets o LEFT JOIN sales_records sr ON o.id = sr.outlet_id
          GROUP BY o.id, o.name, o.type, o.address, o.contact_person
        `;

        return {
          statusCode: 200,
          body: JSON.stringify({
            dashboardStats: {
              monthlyTargetBE: parseFloat(targetRow[0].target_be),
              currentBE: parseFloat(salesSum[0].total),
              daysElapsed,
              totalWorkingDays: 22,
              incentiveTiers: targetRow[0].incentive_rules
            },
            outlets: outlets.map(o => {
              const daysSince = o.last_order ? Math.floor((Date.now() - new Date(o.last_order)) / 86400000) : 99;
              return {
                id: o.id, name: o.name, type: o.type, address: o.address, contact: o.contact_person,
                beMonth: parseFloat(o.bemonth), health: Math.max(0, 100 - daysSince * 2),
                lastOrder: daysSince === 0 ? 'Today' : `${daysSince} days ago`,
                alert: daysSince > 7 ? 'Risk of Churn' : null
              };
            })
          })
        };
      }
    }

    // --- POST ---
    if (event.method === 'POST') {
      const body = isJson ? JSON.parse(event.body) : null;

      if (type === 'users' && isJson) {
        const plainPw = body.password || DEFAULT_PASSWORD;
        if (!plainPw) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Password or DEFAULT_PASSWORD env var is required' }) };
        }
        const hash = await bcrypt.hash(plainPw, 10);
        const res = await sql`INSERT INTO users (id, name, email, role, region, level, password_hash, netlify_uid) VALUES (gen_random_uuid(), ${body.name}, ${body.email}, ${body.role}, ${body.region||''}, ${body.level||null}, ${hash}, gen_random_uuid()::text) RETURNING *`;
        return { statusCode: 201, body: JSON.stringify({ ...res[0], password_hash: '••••••' }) };
      }
      if (type === 'outlets' && isJson) {
        const { name, type: otype, address, contact_person, branch_area } = body;
        const res = await sql`INSERT INTO outlets (id, name, type, address, contact_person, branch_area) VALUES (gen_random_uuid(), ${name}, ${otype||''}, ${address||''}, ${contact_person||''}, ${branch_area||''}) RETURNING *`;
        return { statusCode: 201, body: JSON.stringify(res[0]) };
      }
      if (type === 'assignments' && isJson) {
        // Unassign any existing active assignment for this outlet
        await sql`UPDATE outlet_assignments SET unassigned_at = CURRENT_TIMESTAMP WHERE outlet_id = ${body.outlet_id} AND unassigned_at IS NULL`;
        const res = await sql`
          INSERT INTO outlet_assignments (id, outlet_id, salesman_id, assigned_by, notes)
          VALUES (gen_random_uuid(), ${body.outlet_id}, ${body.salesman_id || null}, ${user?.id || null}, ${body.notes || ''})
          RETURNING *
        `;
        return { statusCode: 201, body: JSON.stringify(res[0]) };
      }
      if (type === 'targets' && isJson) {
        const pc = body.percentage_config || JSON.stringify(getDefaultPercentageConfig(body.level || 'L2'));
        const vc = body.volume_config || JSON.stringify(getDefaultVolumeConfig());
        const ac = body.active_outlets_config || JSON.stringify(getDefaultActiveOutletsConfig(body.level || 'L2'));
        const res = await sql`
          INSERT INTO targets (id, user_id, month, year, target_be, percentage_config, volume_config, active_outlets_config)
          VALUES (gen_random_uuid(), ${body.user_id}, ${body.month}, ${body.year}, ${body.target_be}, ${pc}::jsonb, ${vc}::jsonb, ${ac}::jsonb)
          ON CONFLICT (user_id, month, year) DO UPDATE SET
            target_be = EXCLUDED.target_be,
            percentage_config = EXCLUDED.percentage_config,
            volume_config = EXCLUDED.volume_config,
            active_outlets_config = EXCLUDED.active_outlets_config
          RETURNING *
        `;
        return { statusCode: 201, body: JSON.stringify(res[0]) };
      }
      if (!isJson) {
        const action = params.action || 'upload';
        let bodyBuffer;
        if (event.isBase64Encoded) bodyBuffer = Buffer.from(event.body, 'base64');
        else if (typeof event.body === 'string') bodyBuffer = Buffer.from(event.body, 'binary');
        else bodyBuffer = event.body;

        return new Promise((resolve) => {
          const busboy = Busboy({ headers: event.headers });
          busboy.on('file', async (fieldname, file, info) => {
            const chunks = [];
            file.on('data', d => chunks.push(d));
            file.on('end', async () => {
              try {
                const buffer = Buffer.concat(chunks);
                const ext = (info.filename || '').split('.').pop()?.toLowerCase();
                const isCsv = ext === 'csv';
                let workbook;
                if (isCsv) {
                  const csvText = buffer.toString('utf-8');
                  workbook = xlsx.read(csvText, { type: 'string', cellDates: false });
                } else {
                  workbook = xlsx.read(buffer, { cellDates: false });
                }
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                // Get raw rows for format detection
                const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true });
                const fileFormat = detectFileFormat(rawRows);

                if (fileFormat === 'ayotama_v1' || fileFormat === 'ayotama_v2') {
                  const parser = fileFormat === 'ayotama_v2' ? parseAyotamaV2Rows : parseAyotamaRows;
                  const allOutlets = await sql`SELECT id, name FROM outlets`;
                  let allUsers = await sql`SELECT id, name, role FROM users`;

                  if (action === 'preview') {
                    const result = parser(rawRows, allOutlets, allUsers);
                    resolve({ statusCode: 200, body: JSON.stringify(result) });
                  } else {
                    const preview = parser(rawRows, allOutlets, allUsers);
                    const validRows = preview.rows.filter(r => r.valid);

                    // --- Auto-create missing salesmen (v2 only) ---
                    if (fileFormat === 'ayotama_v2') {
                      // Deduplicate by normalized name; collect all branches per salesman
                      const salesmenMap = new Map();
                      for (const r of validRows.filter(r => r.isNewSalesman)) {
                        const normalized = String(r.salesName).toUpperCase().trim();
                        if (!salesmenMap.has(normalized)) {
                          salesmenMap.set(normalized, { name: r.salesName, branches: new Set() });
                        }
                        if (r.branchArea) salesmenMap.get(normalized).branches.add(r.branchArea);
                      }

                      if (salesmenMap.size > 0) {
                        // Fetch existing users by normalized name
                        const existingUsers = await sql`SELECT id, name, email FROM users WHERE role = 'sales'`;
                        const existingByName = new Map(existingUsers.map(u => [String(u.name).toUpperCase().trim(), u]));
                        const existingEmails = new Set(existingUsers.map(u => u.email));
                        const pwHash = DEFAULT_PASSWORD ? await bcrypt.hash(DEFAULT_PASSWORD, 10) : null;

                        for (const sm of salesmenMap.values()) {
                          const normalized = String(sm.name).toUpperCase().trim();

                          // Skip if name already exists
                          if (existingByName.has(normalized)) {
                            const existing = existingByName.get(normalized);
                            // Ensure all branches are recorded
                            for (const branch of sm.branches) {
                              await sql`
                                INSERT INTO user_branches (id, user_id, branch_name)
                                VALUES (gen_random_uuid(), ${existing.id}, ${branch})
                                ON CONFLICT (user_id, branch_name) DO NOTHING
                              `;
                            }
                            continue;
                          }

                          if (!pwHash) continue;

                          // Generate unique email
                          const baseSlug = String(sm.name).toLowerCase().replace(/[^a-z0-9]/g, '');
                          let email = `${baseSlug}@ayotama.com`;
                          let counter = 1;
                          while (existingEmails.has(email)) {
                            email = `${baseSlug}${counter}@ayotama.com`;
                            counter++;
                          }
                          existingEmails.add(email);

                          // Use first branch as primary region
                          const primaryRegion = [...sm.branches][0] || '';

                          const newUser = await sql`
                            INSERT INTO users (id, name, email, role, region, level, password_hash, netlify_uid)
                            VALUES (${randomUUID()}, ${sm.name}, ${email}, 'sales', ${primaryRegion}, 'L2', ${pwHash}, gen_random_uuid()::text)
                            RETURNING id, name, email
                          `;

                          // Record all branches
                          for (const branch of sm.branches) {
                            await sql`
                              INSERT INTO user_branches (id, user_id, branch_name)
                              VALUES (gen_random_uuid(), ${newUser[0].id}, ${branch})
                              ON CONFLICT (user_id, branch_name) DO NOTHING
                            `;
                          }

                          existingByName.set(normalized, newUser[0]);
                        }
                      }

                      // Re-fetch users after creating new ones
                      allUsers = await sql`SELECT id, name, role FROM users`;
                    }

                    // Group new outlets with their branch areas
                    const newOutletMap = {};
                    for (const r of validRows) {
                      if (r.isNewOutlet && r.outletName && r.outletName !== '-') {
                        if (!newOutletMap[r.outletName]) {
                          newOutletMap[r.outletName] = r.branchArea || '';
                        }
                      }
                    }

                    // Create missing outlets with branch area
                    for (const [name, branchArea] of Object.entries(newOutletMap)) {
                      await sql`
                        INSERT INTO outlets (id, name, type, address, contact_person, branch_area)
                        VALUES (${randomUUID()}, ${name}, '', '', '', ${branchArea})
                        ON CONFLICT DO NOTHING
                      `;
                    }

                    // Re-fetch outlets to get IDs for new ones
                    const refreshedOutlets = await sql`SELECT id, name FROM outlets`;
                    const outletIdMap = Object.fromEntries(refreshedOutlets.map(o => [o.name, o.id]));
                    const userIdMap = Object.fromEntries(allUsers.map(u => [u.name, u.id]));

                    // Batch insert using UNNEST (PostgreSQL array expansion)
                    const BATCH_SIZE = 50;
                    let insertedCount = 0;
                    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
                      const batch = validRows.slice(i, i + BATCH_SIZE);
                      const ids = [];
                      const outletIds = [];
                      const salesIds = [];
                      const dates = [];
                      const volumes = [];
                      const skus = [];

                      for (const r of batch) {
                        const outletId = outletIdMap[r.outletName];
                        const salesId = userIdMap[r.salesName];
                        if (!outletId || !salesId) continue;
                        ids.push(randomUUID());
                        outletIds.push(outletId);
                        salesIds.push(salesId);
                        dates.push(r.date);
                        volumes.push(r.volume);
                        skus.push(r.sku || null);
                      }

                      if (ids.length > 0) {
                        await sql`
                          INSERT INTO sales_records (id, outlet_id, sales_id, record_date, volume_be, sku_name)
                          SELECT * FROM UNNEST(
                            ${ids}::uuid[],
                            ${outletIds}::uuid[],
                            ${salesIds}::uuid[],
                            ${dates}::date[],
                            ${volumes}::numeric[],
                            ${skus}::text[]
                          )
                          ON CONFLICT DO NOTHING
                        `;
                        insertedCount += ids.length;
                      }
                    }
                    resolve({ statusCode: 200, body: JSON.stringify({ success: true, inserted: insertedCount, totalPreviewed: preview.rows.length, newOutletsCreated: Object.keys(newOutletMap).length }) });
                  }
                } else {
                  resolve({ statusCode: 400, body: JSON.stringify({ error: 'Unsupported file format. Please upload Ayotama rincian faktur format (xlsx/xls).' }) });
                }
              } catch (e) { resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) }); }
            });
          });
          busboy.on('error', e => resolve({ statusCode: 400, body: JSON.stringify({ error: 'Invalid file' }) }));
          busboy.end(bodyBuffer);
        });
      }
    }

    // --- PUT ---
    if (event.method === 'PUT' && isJson) {
      const body = JSON.parse(event.body);
      if (type === 'profile') {
        if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
        const updateName = body.name || null;
        const updatePassword = body.password && body.password !== '••••••' ? await bcrypt.hash(body.password, 10) : null;
        const res = await sql`
          UPDATE users SET
            name = COALESCE(${updateName}, name),
            password_hash = COALESCE(${updatePassword}, password_hash)
          WHERE id = ${user.id}
          RETURNING id, name, email, role, region, level, created_at
        `;
        return { statusCode: res.length ? 200 : 404, body: JSON.stringify({ data: res[0] || null }) };
      }
      if (type === 'users' && id) {
        const updateData = { name: body.name, role: body.role, region: body.region || '', level: body.level || null };
        if (body.password && body.password !== '••••••') updateData.password_hash = await bcrypt.hash(body.password, 10);
        const res = await sql`UPDATE users SET name=${body.name}, role=${body.role}, region=${body.region||''}, level=${body.level||null}, password_hash=COALESCE(${updateData.password_hash}, password_hash) WHERE id=${id} RETURNING *`;
        return { statusCode: res.length ? 200 : 404, body: JSON.stringify(res[0] || { error: 'Not found' }) };
      }
      if (type === 'outlets' && id) {
        const res = await sql`UPDATE outlets SET name=${body.name}, type=${body.type||''}, address=${body.address||''}, contact_person=${body.contact_person||''}, branch_area=${body.branch_area||''} WHERE id=${id} RETURNING *`;
        return { statusCode: res.length ? 200 : 404, body: JSON.stringify(res[0] || { error: 'Not found' }) };
      }
      if (type === 'assignments' && id) {
        // Unassign
        const res = await sql`UPDATE outlet_assignments SET unassigned_at = CURRENT_TIMESTAMP WHERE id = ${id} RETURNING *`;
        return { statusCode: res.length ? 200 : 404, body: JSON.stringify(res[0] || { error: 'Not found' }) };
      }
      if (type === 'targets' && id) {
        const res = await sql`
          UPDATE targets SET
            target_be = COALESCE(${body.target_be}, target_be),
            percentage_config = COALESCE(${body.percentage_config ? JSON.stringify(body.percentage_config) : null}::jsonb, percentage_config),
            volume_config = COALESCE(${body.volume_config ? JSON.stringify(body.volume_config) : null}::jsonb, volume_config),
            active_outlets_config = COALESCE(${body.active_outlets_config ? JSON.stringify(body.active_outlets_config) : null}::jsonb, active_outlets_config)
          WHERE id = ${id} RETURNING *
        `;
        return { statusCode: res.length ? 200 : 404, body: JSON.stringify(res[0] || { error: 'Not found' }) };
      }
      const res = await sql`
        UPDATE sales_records SET
          outlet_id = (SELECT id FROM outlets WHERE name = ${body.outlet}),
          sales_id = (SELECT id FROM users WHERE name = ${body.sales}),
          record_date = ${body.date}, volume_be = ${body.be}, sku_name = ${body.sku||null}
        WHERE id = ${id} RETURNING *
      `;
      return { statusCode: res.length ? 200 : 404, body: JSON.stringify(res[0] || { error: 'Not found' }) };
    }

    // --- DELETE ---
    if (event.method === 'DELETE' && id) {
      if (type === 'users') await sql`DELETE FROM users WHERE id=${id}`;
      else if (type === 'outlets') await sql`DELETE FROM outlets WHERE id=${id}`;
      else if (type === 'assignments') await sql`DELETE FROM outlet_assignments WHERE id=${id}`;
      else if (type === 'targets') await sql`DELETE FROM targets WHERE id=${id}`;
      else await sql`DELETE FROM sales_records WHERE id=${id}`;
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
};
