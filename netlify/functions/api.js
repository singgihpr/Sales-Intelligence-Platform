import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import xlsx from 'xlsx';
import Busboy from 'busboy';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const rawDbUrl = process.env.DATABASE_URL || '';
const DATABASE_URL = rawDbUrl.replace(/([?&])channel_binding=[^&]*&?/g, '$1').replace(/[?&]$/, '');
const sql = neon(DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD;

const parseExcelDate = (val) => {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = val instanceof Date ? val : new Date(Math.round((val - 25569) * 86400 * 1000));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
      { threshold: 50, reward: Math.round(base * 0.50), label: '50%' },
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
  const end = `${year}-${String(month).padStart(2, '0')}-31`;
  return { month, year, start, end };
};

const getUserDashboardData = async (userId) => {
  const { month, year, start, end } = getCurrentMonthRange();

  const userRows = await sql`SELECT id, name, email, role, region, level FROM users WHERE id = ${userId}`;
  if (!userRows.length) throw new Error('User not found');
  const user = userRows[0];

  const targetRows = await sql`SELECT target_be, percentage_config, volume_config, active_outlets_config FROM targets WHERE user_id = ${userId} AND month = ${month} AND year = ${year}`;
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
      RETURNING target_be, percentage_config, volume_config, active_outlets_config
    `;
    targetData = insertRes[0];
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
    SELECT sku_name, SUM(volume_be) as volume FROM sales_records
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

  const prevMonthMap = Object.fromEntries(skuPrevMonth.map(r => [r.sku_name, parseFloat(r.volume || 0)]));
  const lastYearMap = Object.fromEntries(skuLastYear.map(r => [r.sku_name, parseFloat(r.volume || 0)]));
  const topOutletMap = Object.fromEntries(skuTopOutlets.map(r => [r.sku_name, r.outlet_name]));

  const totalSkuVolume = skuCurrent.reduce((sum, r) => sum + parseFloat(r.volume || 0), 0);

  const skuPerformance = skuCurrent.map(r => {
    const volume = parseFloat(r.volume || 0);
    const prev = prevMonthMap[r.sku_name] || 0;
    const lastY = lastYearMap[r.sku_name] || 0;
    const momTrend = prev > 0 ? ((volume - prev) / prev) * 100 : (volume > 0 ? 100 : 0);
    const yoyTrend = lastY > 0 ? ((volume - lastY) / lastY) * 100 : (volume > 0 ? 100 : 0);
    return {
      name: r.sku_name,
      volume,
      transactionCount: parseInt(r.transaction_count || 0),
      avgOrder: parseFloat(r.avg_order || 0),
      topOutlet: topOutletMap[r.sku_name] || '-',
      mixPercent: totalSkuVolume > 0 ? (volume / totalSkuVolume) * 100 : 0,
      momTrend,
      yoyTrend
    };
  });

  // Outlets data
  const outletRows = await sql`
    SELECT o.id, o.name, o.type, o.address, o.contact_person, o.branch_area,
           COALESCE(SUM(CASE WHEN sr.record_date >= ${start} THEN sr.volume_be ELSE 0 END), 0) as beMonth,
           MAX(sr.record_date) as last_order
    FROM outlets o
    LEFT JOIN outlet_assignments oa ON oa.outlet_id = o.id AND oa.salesman_id = ${userId} AND oa.unassigned_at IS NULL
    LEFT JOIN sales_records sr ON sr.outlet_id = o.id
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
      const daysSince = o.last_order ? Math.floor((Date.now() - new Date(o.last_order)) / 86400000) : 99;
      return {
        id: o.id, name: o.name, type: o.type, address: o.address, contact: o.contact_person, branchArea: o.branch_area || '',
        beMonth: parseFloat(o.bemonth), health: Math.max(0, 100 - daysSince * 2),
        lastOrder: daysSince === 0 ? 'Today' : `${daysSince} days ago`,
        alert: daysSince > 7 ? 'Risk of Churn' : null
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

  const outletRows = await sql`
    SELECT o.id, o.name, o.type, o.address, o.contact_person, o.branch_area,
           u.name as salesman_name,
           COALESCE(SUM(CASE WHEN sr.record_date >= ${start} THEN sr.volume_be ELSE 0 END), 0) as beMonth,
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
    outlets: outletRows.map(o => {
      const daysSince = o.last_order ? Math.floor((Date.now() - new Date(o.last_order)) / 86400000) : 99;
      return {
        id: o.id, name: o.name, type: o.type, address: o.address, contact: o.contact_person, branchArea: o.branch_area || '',
        beMonth: parseFloat(o.bemonth), health: Math.max(0, 100 - daysSince * 2),
        lastOrder: daysSince === 0 ? 'Today' : `${daysSince} days ago`,
        alert: daysSince > 7 ? 'Risk of Churn' : null
      };
    })
  };
};

const _handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  const user = verifyToken(event);
  const type = params.type || (user ? null : 'records');
  const id = params.id;
  const isJson = event.headers['content-type']?.includes('application/json');

  try {
    // --- AUTH ---
    if (type === 'auth' && event.httpMethod === 'POST') {
      const { email, password } = JSON.parse(event.body);
      const dbUser = await sql`SELECT * FROM users WHERE email = ${email}`;
      if (!dbUser[0] || !dbUser[0].password_hash || !(await bcrypt.compare(password, dbUser[0].password_hash))) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid email or password' }) };
      }
      const token = jwt.sign({ id: dbUser[0].id, role: dbUser[0].role, email: dbUser[0].email }, JWT_SECRET, { expiresIn: '7d' });
      return { statusCode: 200, body: JSON.stringify({ token, user: { id: dbUser[0].id, name: dbUser[0].name, role: dbUser[0].role, region: dbUser[0].region, level: dbUser[0].level } }) };
    }

    // --- GET ---
    if (event.httpMethod === 'GET') {
      const page = Math.max(1, parseInt(params.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(params.limit) || 10));
      const offset = (page - 1) * limit;
      const search = (params.search || '').trim();
      const searchPattern = search ? `%${search}%` : '%';

      const paginateResponse = (data, total) => ({
        statusCode: 200,
        body: JSON.stringify({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
      });

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
    if (event.httpMethod === 'POST') {
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
                let rows = [];
                if (isCsv) {
                  const csvText = buffer.toString('utf-8');
                  const workbook = xlsx.read(csvText, { type: 'string', cellDates: true });
                  rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                } else {
                  const workbook = xlsx.read(buffer, { cellDates: true });
                  rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                }
                rows = rows.map(r => ({ ...r, Date: parseExcelDate(r['Date']) }));

                if (action === 'preview') {
                  // Validate rows without inserting
                  const allOutlets = await sql`SELECT id, name FROM outlets`;
                  const allUsers = await sql`SELECT id, name FROM users WHERE role = 'sales'`;
                  const outletMap = Object.fromEntries(allOutlets.map(o => [o.name, o.id]));
                  const userMap = Object.fromEntries(allUsers.map(u => [u.name, u.id]));

                  const preview = rows.map((r, idx) => {
                    const outletName = r['Outlet Name'];
                    const salesName = r['Sales Name'];
                    const date = r['Date'];
                    const volume = r['Volume BE'];
                    const sku = r['SKU'];
                    const errors = [];
                    if (!outletName) errors.push('Missing Outlet Name');
                    else if (!outletMap[outletName]) errors.push(`Outlet not found: ${outletName}`);
                    if (!salesName) errors.push('Missing Sales Name');
                    else if (!userMap[salesName]) errors.push(`Salesman not found: ${salesName}`);
                    if (!date) errors.push('Invalid Date');
                    if (volume === undefined || volume === null || isNaN(Number(volume))) errors.push('Invalid Volume BE');
                    return {
                      row: idx + 2,
                      outletName,
                      salesName,
                      date,
                      volume: volume !== undefined ? Number(volume) : null,
                      sku,
                      valid: errors.length === 0,
                      errors
                    };
                  });
                  resolve({ statusCode: 200, body: JSON.stringify({ action: 'preview', total: rows.length, valid: preview.filter(p => p.valid).length, invalid: preview.filter(p => !p.valid).length, rows: preview }) });
                } else {
                  // Upload / Import
                  const queries = rows.map(r => sql`
                    INSERT INTO sales_records (id, outlet_id, sales_id, record_date, volume_be, sku_name)
                    VALUES (gen_random_uuid(), (SELECT id FROM outlets WHERE name = ${r['Outlet Name']}), (SELECT id FROM users WHERE name = ${r['Sales Name']}), ${r['Date']}, ${r['Volume BE']}, ${r['SKU']||null})
                    ON CONFLICT DO NOTHING
                  `);
                  await Promise.all(queries);
                  resolve({ statusCode: 200, body: JSON.stringify({ success: true, inserted: rows.length }) });
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
    if (event.httpMethod === 'PUT' && isJson) {
      const body = JSON.parse(event.body);
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
    if (event.httpMethod === 'DELETE' && id) {
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

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  const result = await _handler(event, context);
  return {
    ...result,
    headers: {
      ...(result.headers || {}),
      ...corsHeaders
    }
  };
};
