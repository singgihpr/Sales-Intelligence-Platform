package handlers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"

	"sales-intelligence/db"
	"sales-intelligence/middleware"
	"sales-intelligence/models"
	"sales-intelligence/utils"
)

type UserHandler struct {
	DefaultPassword string
}

func (h *UserHandler) GetProfile(c echo.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	ctx := context.Background()
	var profile models.User
	err := db.Pool.QueryRow(ctx,
		`SELECT id, name, email, role, region, level, created_at FROM users WHERE id = $1`,
		user.ID,
	).Scan(&profile.ID, &profile.Name, &profile.Email, &profile.Role, &profile.Region, &profile.Level, &profile.CreatedAt)

	if err == pgx.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"data": profile})
}

func (h *UserHandler) ListUsers(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 || limit > 100 {
		limit = 5
	}
	offset := (page - 1) * limit
	search := c.QueryParam("search")
	role := c.QueryParam("role")
	searchPattern := "%" + search + "%"

	ctx := context.Background()

	where := `(name ILIKE $1 OR email ILIKE $1 OR role ILIKE $1 OR region ILIKE $1)`
	args := []interface{}{searchPattern}
	argIdx := 2

	if role != "" {
		where += fmt.Sprintf(" AND role = $%d", argIdx)
		args = append(args, role)
		argIdx++
	}

	query := fmt.Sprintf(`SELECT id, name, email, role, region, level, supervisor_id, created_at
		 FROM users WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.Region, &u.Level, &u.SupervisorID, &u.CreatedAt); err != nil {
			continue
		}
		u.PasswordHash = "••••••"
		users = append(users, u)
	}

	var total int
	countArgs := args[:len(args)-2]
	err = db.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM users WHERE %s`, where), countArgs...).Scan(&total)
	if err != nil {
		total = 0
	}

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       users,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: (total + limit - 1) / limit,
	})
}

func (h *UserHandler) CreateUser(c echo.Context) error {
	var req struct {
		Name         string  `json:"name"`
		Email        string  `json:"email"`
		Role         string  `json:"role"`
		Region       string  `json:"region"`
		Level        *string `json:"level"`
		SupervisorID *string `json:"supervisor_id"`
		Password     string  `json:"password"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	password := req.Password
	if password == "" {
		password = h.DefaultPassword
	}
	if password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Password or DEFAULT_PASSWORD env var is required"})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to hash password"})
	}

	ctx := context.Background()
	var user models.User
	err = db.Pool.QueryRow(ctx,
		`INSERT INTO users (id, name, email, role, region, level, supervisor_id, password_hash, netlify_uid) 
		 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, gen_random_uuid()::text) 
		 RETURNING id, name, email, role, region, level, supervisor_id, created_at`,
		req.Name, req.Email, req.Role, req.Region, req.Level, req.SupervisorID, string(hash),
	).Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.Region, &user.Level, &user.SupervisorID, &user.CreatedAt)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create user"})
	}

	user.PasswordHash = "••••••"
	return c.JSON(http.StatusCreated, user)
}

func (h *UserHandler) UpdateUser(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id required"})
	}

	var req struct {
		Name         string  `json:"name"`
		Role         string  `json:"role"`
		Region       string  `json:"region"`
		Level        *string `json:"level"`
		SupervisorID *string `json:"supervisor_id"`
		Password     string  `json:"password"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	var passwordHash *string
	if req.Password != "" && req.Password != "••••••" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to hash password"})
		}
		s := string(hash)
		passwordHash = &s
	}

	ctx := context.Background()
	var user models.User
	err := db.Pool.QueryRow(ctx,
		`UPDATE users SET 
			name = $1, role = $2, region = $3, level = $4, supervisor_id = $5,
			password_hash = COALESCE($6, password_hash)
		 WHERE id = $7 
		 RETURNING id, name, email, role, region, level, supervisor_id, created_at`,
		req.Name, req.Role, req.Region, req.Level, req.SupervisorID, passwordHash, id,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.Region, &user.Level, &user.SupervisorID, &user.CreatedAt)

	if err == pgx.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}

	user.PasswordHash = "••••••"
	return c.JSON(http.StatusOK, user)
}

func (h *UserHandler) DeleteUser(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id required"})
	}

	ctx := context.Background()
	_, err := db.Pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete user"})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *UserHandler) UpdateProfile(c echo.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	var req struct {
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	var passwordHash *string
	if req.Password != "" && req.Password != "••••••" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to hash password"})
		}
		s := string(hash)
		passwordHash = &s
	}

	ctx := context.Background()
	var profile models.User
	err := db.Pool.QueryRow(ctx,
		`UPDATE users SET 
			name = COALESCE(NULLIF($1, ''), name),
			password_hash = COALESCE($2, password_hash)
		 WHERE id = $3 
		 RETURNING id, name, email, role, region, level, created_at`,
		req.Name, passwordHash, user.ID,
	).Scan(&profile.ID, &profile.Name, &profile.Email, &profile.Role, &profile.Region, &profile.Level, &profile.CreatedAt)

	if err == pgx.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"data": profile})
}

func (h *UserHandler) GetTeamDashboard(c echo.Context, user *middleware.JWTClaims) error {
	ctx := context.Background()
	month, year, start, end := utils.GetCurrentMonthRange()

	var teamRows []models.User
	if user.Role == "admin" {
		rows, err := db.Pool.Query(ctx, `SELECT id, name, email, role, region, level FROM users WHERE role = 'sales' ORDER BY name`)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
		}
		defer rows.Close()
		for rows.Next() {
			var u models.User
			if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.Region, &u.Level); err != nil {
				continue
			}
			teamRows = append(teamRows, u)
		}
	} else {
		rows, err := db.Pool.Query(ctx, `SELECT id, name, email, role, region, level FROM users WHERE role = 'sales' AND supervisor_id = $1 ORDER BY name`, user.ID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
		}
		defer rows.Close()
		for rows.Next() {
			var u models.User
			if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.Region, &u.Level); err != nil {
				continue
			}
			teamRows = append(teamRows, u)
		}
	}

	teamIDs := make([]string, 0, len(teamRows))
	for _, m := range teamRows {
		teamIDs = append(teamIDs, m.ID)
	}

	var teamData []models.TeamMember
	var totalTeamBE, totalTarget float64

	for _, member := range teamRows {
		var target models.Target
		err := db.Pool.QueryRow(ctx,
			`SELECT id, target_be, percentage_config, volume_config, active_outlets_config
			 FROM targets WHERE user_id = $1 AND month = $2 AND year = $3`,
			member.ID, month, year,
		).Scan(&target.ID, &target.TargetBE, &target.PercentageConfig, &target.VolumeConfig, &target.ActiveOutletsConfig)

		if err == pgx.ErrNoRows {
			level := "L2"
			if member.Level != nil {
				level = *member.Level
			}
			defaultTarget := 3499
			if level == "L3" {
				defaultTarget = 3500
			}
			pc := utils.GetDefaultPercentageConfig(level)
			vc := utils.GetDefaultVolumeConfig()
			ac := utils.GetDefaultActiveOutletsConfig(level)
			err = db.Pool.QueryRow(ctx,
				`INSERT INTO targets (id, user_id, month, year, target_be, percentage_config, volume_config, active_outlets_config)
				 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
				 ON CONFLICT (user_id, month, year) DO UPDATE SET target_be = EXCLUDED.target_be
				 RETURNING id, target_be, percentage_config, volume_config, active_outlets_config`,
				member.ID, month, year, defaultTarget, pc, vc, ac,
			).Scan(&target.ID, &target.TargetBE, &target.PercentageConfig, &target.VolumeConfig, &target.ActiveOutletsConfig)
			if err != nil {
				continue
			}
		} else if err != nil {
			continue
		}

		var currentBE float64
		db.Pool.QueryRow(ctx,
			`SELECT COALESCE(SUM(volume_be), 0) FROM sales_records WHERE sales_id = $1 AND record_date >= $2 AND record_date <= $3`,
			member.ID, start, end,
		).Scan(&currentBE)

		targetBE := float64(target.TargetBE)
		attainment := 0.0
		if targetBE > 0 {
			attainment = float64(int((currentBE / targetBE) * 100))
		}

		pcMap, _ := target.PercentageConfig.(map[string]interface{})
		vcMap, _ := target.VolumeConfig.(map[string]interface{})
		acMap, _ := target.ActiveOutletsConfig.(map[string]interface{})
		_, percentageBonus, _ := utils.CalculatePercentageBonus(currentBE, targetBE, pcMap)
		volumeBonus, _ := utils.CalculateVolumeBonus(currentBE, vcMap)

		var totalAssigned int
		db.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM outlet_assignments oa
			 INNER JOIN outlets o ON o.id = oa.outlet_id
			 WHERE oa.salesman_id = $1 AND oa.unassigned_at IS NULL`,
			member.ID,
		).Scan(&totalAssigned)

		var activeCount int
		db.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM outlets o
			 INNER JOIN outlet_assignments oa ON oa.outlet_id = o.id AND oa.salesman_id = $1 AND oa.unassigned_at IS NULL
			 WHERE EXISTS (
				 SELECT 1 FROM sales_records sr WHERE sr.outlet_id = o.id AND sr.sales_id = $1
				   AND sr.record_date >= $2 AND sr.record_date <= $3
			 )`,
			member.ID, start, end,
		).Scan(&activeCount)

		_, activeBonus, _ := utils.CalculateActiveOutletsBonus(totalAssigned, activeCount, acMap)
		totalBonus := percentageBonus + volumeBonus + activeBonus

		totalTeamBE += currentBE
		totalTarget += targetBE

		teamData = append(teamData, models.TeamMember{
			User:          member,
			CurrentBE:     currentBE,
			TargetBE:      targetBE,
			Attainment:    attainment,
			TotalBonus:    totalBonus,
			TotalAssigned: totalAssigned,
			ActiveCount:   activeCount,
		})
	}

	var vacantCount int
	db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM outlets o
		 WHERE NOT EXISTS (
			 SELECT 1 FROM outlet_assignments oa WHERE oa.outlet_id = o.id AND oa.unassigned_at IS NULL
		 )`,
	).Scan(&vacantCount)

	teamAttainment := 0.0
	if totalTarget > 0 {
		teamAttainment = float64(int((totalTeamBE / totalTarget) * 100))
	}

	// --- SKU Performance (aggregated across team) ---
	skuPerformance := []models.SKUPerformance{}
	if len(teamIDs) > 0 {
		_, _, prevStart, prevEnd := utils.GetPreviousMonthRange(month, year, 1)
		lastYearStart := fmt.Sprintf("%04d-%02d-01", year-1, month)
		lastYearEnd := fmt.Sprintf("%04d-%02d-%02d", year-1, month, daysInMonthCount(year-1, month))

		type skuRow struct {
			Name             string
			Volume           float64
			TransactionCount int
			AvgOrder         float64
		}
		var totalSkuVolume float64
		var skuCurrentRows []skuRow

		skuRows, err := db.Pool.Query(ctx,
			`SELECT sr.sku_name, SUM(sr.volume_be) as volume, COUNT(*) as transaction_count, AVG(sr.volume_be) as avg_order
			 FROM sales_records sr
			 WHERE sr.record_date >= $1 AND sr.record_date <= $2
			   AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
			   AND sr.sales_id = ANY($3::uuid[])
			 GROUP BY sr.sku_name ORDER BY volume DESC LIMIT 10`,
			start, end, teamIDs,
		)
		if err == nil {
			for skuRows.Next() {
				var sr skuRow
				if err := skuRows.Scan(&sr.Name, &sr.Volume, &sr.TransactionCount, &sr.AvgOrder); err != nil {
					continue
				}
				totalSkuVolume += sr.Volume
				skuCurrentRows = append(skuCurrentRows, sr)
			}
			skuRows.Close()
		}

		prevMonthMap := map[string]struct{ Volume, TxCount float64 }{}
		pRows, err := db.Pool.Query(ctx,
			`SELECT sr.sku_name, SUM(sr.volume_be) as volume, COUNT(*) as transaction_count
			 FROM sales_records sr
			 WHERE sr.record_date >= $1 AND sr.record_date <= $2
			   AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
			   AND sr.sales_id = ANY($3::uuid[])
			 GROUP BY sr.sku_name`,
			prevStart, prevEnd, teamIDs,
		)
		if err == nil {
			for pRows.Next() {
				var name string
				var vol, txCnt float64
				pRows.Scan(&name, &vol, &txCnt)
				prevMonthMap[name] = struct{ Volume, TxCount float64 }{vol, txCnt}
			}
			pRows.Close()
		}

		lastYearMap := map[string]float64{}
		lyRows, err := db.Pool.Query(ctx,
			`SELECT sr.sku_name, SUM(sr.volume_be) as volume
			 FROM sales_records sr
			 WHERE sr.record_date >= $1 AND sr.record_date <= $2
			   AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
			   AND sr.sales_id = ANY($3::uuid[])
			 GROUP BY sr.sku_name`,
			lastYearStart, lastYearEnd, teamIDs,
		)
		if err == nil {
			for lyRows.Next() {
				var name string
				var vol float64
				lyRows.Scan(&name, &vol)
				lastYearMap[name] = vol
			}
			lyRows.Close()
		}

		topOutletMap := map[string]struct{ Name string; Volume float64 }{}
		toRows, err := db.Pool.Query(ctx,
			`SELECT DISTINCT ON (sr.sku_name) sr.sku_name, o.name as outlet_name, SUM(sr.volume_be) as outlet_volume
			 FROM sales_records sr
			 LEFT JOIN outlets o ON o.id = sr.outlet_id
			 WHERE sr.record_date >= $1 AND sr.record_date <= $2
			   AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
			   AND sr.sales_id = ANY($3::uuid[])
			 GROUP BY sr.sku_name, o.name
			 ORDER BY sr.sku_name, outlet_volume DESC`,
			start, end, teamIDs,
		)
		if err == nil {
			for toRows.Next() {
				var skuName, outletName string
				var outletVol float64
				toRows.Scan(&skuName, &outletName, &outletVol)
				topOutletMap[skuName] = struct{ Name string; Volume float64 }{outletName, outletVol}
			}
			toRows.Close()
		}

		for _, sr := range skuCurrentRows {
			prevData := prevMonthMap[sr.Name]
			prev := prevData.Volume
			lastY := lastYearMap[sr.Name]
			momTrend := 0.0
			if prev > 0 {
				momTrend = ((sr.Volume - prev) / prev) * 100
			} else if sr.Volume > 0 {
				momTrend = 100
			}
			yoyTrend := 0.0
			if lastY > 0 {
				yoyTrend = ((sr.Volume - lastY) / lastY) * 100
			} else if sr.Volume > 0 {
				yoyTrend = 100
			}
			topOD := topOutletMap[sr.Name]
			topOutletContrib := 0.0
			if sr.Volume > 0 {
				topOutletContrib = float64(int((topOD.Volume / sr.Volume) * 100))
			}
			mixPercent := 0.0
			if totalSkuVolume > 0 {
				mixPercent = (sr.Volume / totalSkuVolume) * 100
			}

			skuPerformance = append(skuPerformance, models.SKUPerformance{
				Name:                 sr.Name,
				Volume:               sr.Volume,
				TransactionCount:     sr.TransactionCount,
				AvgOrder:             sr.AvgOrder,
				TopOutlet:            topOD.Name,
				TopOutletVolume:      topOD.Volume,
				TopOutletContrib:     int(topOutletContrib),
				MixPercent:           mixPercent,
				MoMTrend:             momTrend,
				YoYTrend:             yoyTrend,
				PrevVolume:           prev,
				PrevTransactionCount: int(prevData.TxCount),
			})
		}
	}

	// --- Outlet Health ---
	outlets := []models.OutletHealth{}
	if len(teamIDs) > 0 {
		_, _, prevStart, prevEnd := utils.GetPreviousMonthRange(month, year, 1)
		_, _, prev2Start, prev2End := utils.GetPreviousMonthRange(month, year, 2)

		olRows, err := db.Pool.Query(ctx,
			`SELECT o.id, o.name, o.type, o.address, o.contact_person, o.branch_area,
				COALESCE(SUM(CASE WHEN sr.record_date >= $1 AND sr.record_date <= $2 THEN sr.volume_be ELSE 0 END), 0) as be_current,
				COALESCE(SUM(CASE WHEN sr.record_date >= $3 AND sr.record_date <= $4 THEN sr.volume_be ELSE 0 END), 0) as be_prev,
				COALESCE(SUM(CASE WHEN sr.record_date >= $5 AND sr.record_date <= $6 THEN sr.volume_be ELSE 0 END), 0) as be_prev2,
				COALESCE(SUM(CASE WHEN sr.record_date >= $1 AND sr.record_date <= $2 THEN 1 ELSE 0 END), 0) as freq_3mo,
			MAX(sr.record_date)::text as last_order
			 FROM outlets o
			 LEFT JOIN sales_records sr ON sr.outlet_id = o.id AND sr.sales_id = ANY($7::uuid[])
			 GROUP BY o.id, o.name, o.type, o.address, o.contact_person, o.branch_area`,
			start, end, prevStart, prevEnd, prev2Start, prev2End, teamIDs,
		)
		if err == nil {
			defer olRows.Close()
			now := time.Now()
			for olRows.Next() {
				var oType string
				var beCurrent, bePrev, bePrev2 float64
				var freq3Mo int
				var lastOrder *time.Time
				var ol models.OutletHealth
				if err := olRows.Scan(&ol.ID, &ol.Name, &oType, &ol.Address, &ol.Contact, &ol.BranchArea,
					&beCurrent, &bePrev, &bePrev2, &freq3Mo, &lastOrder); err != nil {
					continue
				}
				ol.Type = oType
				ohs := utils.CalculateOHS(beCurrent, bePrev, bePrev2, freq3Mo)
				ol.Health = ohs.Score
				ol.TotalBE3Mo = ohs.TotalBE
				ol.AvgBE = ohs.AvgBE
				ol.Trend = ohs.Trend
				ol.Freq3Mo = ohs.Freq3Mo
				ol.HealthBreakdown = struct {
					Volume    int `json:"volume"`
					Trend     int `json:"trend"`
					Frequency int `json:"frequency"`
				}{
					Volume:    ohs.Breakdown["volume"],
					Trend:     ohs.Breakdown["trend"],
					Frequency: ohs.Breakdown["frequency"],
				}
				daysSince := 99
				if lastOrder != nil {
					daysSince = int(now.Sub(*lastOrder).Hours() / 24)
				}
				if daysSince == 0 {
					ol.LastOrder = "Today"
				} else {
					ol.LastOrder = fmt.Sprintf("%d days ago", daysSince)
				}
				if ohs.Score < 40 {
					s := "Unhealthy Outlet"
					ol.Alert = &s
				} else if ohs.Score < 70 {
					s := "Needs Attention"
					ol.Alert = &s
				}
				outlets = append(outlets, ol)
			}
		}
	}

	return c.JSON(http.StatusOK, models.TeamDashboardData{
		Team: teamData,
		TeamStats: models.TeamStats{
			TotalTeamBE:    totalTeamBE,
			TotalTarget:    totalTarget,
			TeamAttainment: teamAttainment,
			VacantOutlets:  vacantCount,
		},
		SKUPerformance: skuPerformance,
		Outlets:        outlets,
	})
}

func (h *UserHandler) GetDashboard(c echo.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	if user.Role == "admin" || user.Role == "supervisor" {
		return h.GetTeamDashboard(c, user)
	}

	ctx := context.Background()
	month, year, start, end := utils.GetCurrentMonthRange()

	// Read optional date range / groupBy from query params
	dateStart := c.QueryParam("dateStart")
	dateEnd := c.QueryParam("dateEnd")
	groupBy := c.QueryParam("groupBy")
	if groupBy == "" {
		groupBy = "month"
	}
	useProvidedRange := dateStart != "" && dateEnd != ""
	rangeStart := start
	rangeEnd := end
	if useProvidedRange {
		rangeStart = dateStart
		rangeEnd = dateEnd
	}

	// --- Phase 1: User ---
	var userModel models.User
	err := db.Pool.QueryRow(ctx,
		`SELECT id, name, email, role, region, level FROM users WHERE id = $1`, user.ID,
	).Scan(&userModel.ID, &userModel.Name, &userModel.Email, &userModel.Role, &userModel.Region, &userModel.Level)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "User not found"})
	}

	// --- Phase 2: Target (fetch or create) ---
	var target models.Target
	err = db.Pool.QueryRow(ctx,
		`SELECT id, target_be, percentage_config, volume_config, active_outlets_config
		 FROM targets WHERE user_id = $1 AND month = $2 AND year = $3`,
		user.ID, month, year,
	).Scan(&target.ID, &target.TargetBE, &target.PercentageConfig, &target.VolumeConfig, &target.ActiveOutletsConfig)

	if err == pgx.ErrNoRows {
		defaultTarget := 3499
		if userModel.Level != nil && *userModel.Level == "L3" {
			defaultTarget = 3500
		}
		level := "L2"
		if userModel.Level != nil {
			level = *userModel.Level
		}
		pc := utils.GetDefaultPercentageConfig(level)
		vc := utils.GetDefaultVolumeConfig()
		ac := utils.GetDefaultActiveOutletsConfig(level)

		err = db.Pool.QueryRow(ctx,
			`INSERT INTO targets (id, user_id, month, year, target_be, percentage_config, volume_config, active_outlets_config)
			 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
			 ON CONFLICT (user_id, month, year) DO UPDATE SET target_be = EXCLUDED.target_be
			 RETURNING id, target_be, percentage_config, volume_config, active_outlets_config`,
			user.ID, month, year, defaultTarget, pc, vc, ac,
		).Scan(&target.ID, &target.TargetBE, &target.PercentageConfig, &target.VolumeConfig, &target.ActiveOutletsConfig)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create target"})
		}
	}

	// Auto-migrate old percentage config (threshold 50%) to new (threshold 90%)
	if pc, ok := target.PercentageConfig.(map[string]interface{}); ok {
		if tiers, ok := pc["tiers"].([]interface{}); ok && len(tiers) > 0 {
			if tier0, ok := tiers[0].(map[string]interface{}); ok {
				if thr, ok := tier0["threshold"].(float64); ok && thr == 50 {
					level := "L2"
					if userModel.Level != nil {
						level = *userModel.Level
					}
					newPc := utils.GetDefaultPercentageConfig(level)
					db.Pool.Exec(ctx, `UPDATE targets SET percentage_config = $1 WHERE id = $2`, newPc, target.ID)
					target.PercentageConfig = newPc
				}
			}
		}
	}

	// --- Phase 3: Sales sums (range + full month) ---
	var currentBE, monthBE float64
	err = db.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(volume_be), 0) FROM sales_records WHERE sales_id = $1 AND record_date >= $2 AND record_date <= $3`,
		user.ID, rangeStart, rangeEnd,
	).Scan(&currentBE)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch sales data"})
	}

	err = db.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(volume_be), 0) FROM sales_records WHERE sales_id = $1 AND record_date >= $2 AND record_date <= $3`,
		user.ID, start, end,
	).Scan(&monthBE)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch monthly sales data"})
	}

	// --- Phase 4: Active incentives + incentive BE ---
	activeIncentives := []interface{}{}
	incentiveMap := map[string]float64{}
	incRows, err := db.Pool.Query(ctx,
		`SELECT sku_name, bonus_be, notes FROM sku_incentives WHERE is_active = true AND start_date <= $1 AND end_date >= $2`,
		rangeEnd, rangeStart,
	)
	if err == nil {
		defer incRows.Close()
		for incRows.Next() {
			var skuName string
			var bonusBE float64
			var notes string
			if err := incRows.Scan(&skuName, &bonusBE, &notes); err != nil {
				continue
			}
			incentiveMap[skuName] = bonusBE
			activeIncentives = append(activeIncentives, map[string]interface{}{
				"sku_name": skuName, "bonus_be": bonusBE, "notes": notes,
			})
		}
	}

	var incentiveBE float64
	err = db.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(si.bonus_be), 0)
		 FROM sales_records sr
		 JOIN sku_incentives si ON sr.sku_name = si.sku_name
		   AND sr.record_date >= si.start_date AND sr.record_date <= si.end_date
		 WHERE sr.sales_id = $1 AND sr.record_date >= $2 AND sr.record_date <= $3 AND si.is_active = true`,
		user.ID, rangeStart, rangeEnd,
	).Scan(&incentiveBE)
	if err != nil {
		incentiveBE = 0
	}
	totalWithIncentive := currentBE + incentiveBE

	// --- Phase 5: Assigned outlets (with active check) ---
	type assignedRow struct {
		id       string
		isActive bool
	}
	var assignedRows []assignedRow
	rows, err := db.Pool.Query(ctx,
		`SELECT o.id, EXISTS(
			SELECT 1 FROM sales_records sr WHERE sr.outlet_id = o.id AND sr.sales_id = $1
			  AND sr.record_date >= $2 AND sr.record_date <= $3
		) as is_active
		FROM outlets o
		INNER JOIN outlet_assignments oa ON oa.outlet_id = o.id AND oa.salesman_id = $1 AND oa.unassigned_at IS NULL`,
		user.ID, rangeStart, rangeEnd,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch assigned outlets"})
	}
	defer rows.Close()
	for rows.Next() {
		var ar assignedRow
		if err := rows.Scan(&ar.id, &ar.isActive); err != nil {
			continue
		}
		assignedRows = append(assignedRows, ar)
	}
	totalAssigned := len(assignedRows)
	activeCount := 0
	for _, ar := range assignedRows {
		if ar.isActive {
			activeCount++
		}
	}

	// --- Phase 6: Date ranges ---
	now := time.Now()
	daysElapsed := min(now.Day(), daysInMonthCount(year, month))
	daysInMonth := daysInMonthCount(year, month)

	rangeDays := daysElapsed
	if useProvidedRange {
		rs, _ := time.Parse("2006-01-02", rangeStart)
		re, _ := time.Parse("2006-01-02", rangeEnd)
		rangeDays = int(re.Sub(rs).Hours()/24) + 1
	}

	prevMonthNum := month - 1
	prevMonthYear := year
	if prevMonthNum == 0 {
		prevMonthNum = 12
		prevMonthYear--
	}
	prevMonthStart := fmt.Sprintf("%04d-%02d-01", prevMonthYear, prevMonthNum)
	prevMonthEnd := fmt.Sprintf("%04d-%02d-%02d", prevMonthYear, prevMonthNum, daysInMonthCount(prevMonthYear, prevMonthNum))

	lastYearStart := fmt.Sprintf("%04d-%02d-01", year-1, month)
	lastYearEnd := fmt.Sprintf("%04d-%02d-%02d", year-1, month, daysInMonthCount(year-1, month))

	effectivePrevStart := prevMonthStart
	effectivePrevEnd := prevMonthEnd
	if useProvidedRange {
		rs, _ := time.Parse("2006-01-02", rangeStart)
		effectivePrevEnd = rs.AddDate(0, 0, -1).Format("2006-01-02")
		pe, _ := time.Parse("2006-01-02", effectivePrevEnd)
		effectivePrevStart = pe.AddDate(0, 0, -(rangeDays-1)).Format("2006-01-02")
	}

	// OHS date ranges
	_, _, prev2Start, prev2End := utils.GetPreviousMonthRange(month, year, 2)
	outletRangeStart := prev2Start
	outletRangeEnd := rangeEnd

	// --- Phase 7: SKU performance ---
	type skuCurrentRow struct {
		Name             string
		Volume           float64
		TransactionCount int
		AvgOrder         float64
	}
	var skuCurrentRows []skuCurrentRow
	skuRows, err := db.Pool.Query(ctx,
		`SELECT sku_name, SUM(volume_be) as volume, COUNT(*) as transaction_count, AVG(volume_be) as avg_order
		 FROM sales_records
		 WHERE sales_id = $1 AND record_date >= $2 AND record_date <= $3
		   AND sku_name IS NOT NULL AND sku_name <> ''
		 GROUP BY sku_name ORDER BY volume DESC LIMIT 5`,
		user.ID, rangeStart, rangeEnd,
	)
	if err == nil {
		defer skuRows.Close()
		for skuRows.Next() {
			var sr skuCurrentRow
			if err := skuRows.Scan(&sr.Name, &sr.Volume, &sr.TransactionCount, &sr.AvgOrder); err != nil {
				continue
			}
			skuCurrentRows = append(skuCurrentRows, sr)
		}
	}

	// SKU previous period
	type skuPrevRow struct {
		Name             string
		Volume           float64
		TransactionCount int
	}
	prevMonthMap := map[string]skuPrevRow{}
	skuPrevRows, err := db.Pool.Query(ctx,
		`SELECT sku_name, SUM(volume_be) as volume, COUNT(*) as transaction_count FROM sales_records
		 WHERE sales_id = $1 AND record_date >= $2 AND record_date <= $3
		   AND sku_name IS NOT NULL AND sku_name <> ''
		 GROUP BY sku_name`,
		user.ID, effectivePrevStart, effectivePrevEnd,
	)
	if err == nil {
		defer skuPrevRows.Close()
		for skuPrevRows.Next() {
			var sr skuPrevRow
			if err := skuPrevRows.Scan(&sr.Name, &sr.Volume, &sr.TransactionCount); err != nil {
				continue
			}
			prevMonthMap[sr.Name] = sr
		}
	}

	// SKU last year
	lastYearMap := map[string]float64{}
	skuLYRows, err := db.Pool.Query(ctx,
		`SELECT sku_name, SUM(volume_be) as volume FROM sales_records
		 WHERE sales_id = $1 AND record_date >= $2 AND record_date <= $3
		   AND sku_name IS NOT NULL AND sku_name <> ''
		 GROUP BY sku_name`,
		user.ID, lastYearStart, lastYearEnd,
	)
	if err == nil {
		defer skuLYRows.Close()
		for skuLYRows.Next() {
			var name string
			var vol float64
			if err := skuLYRows.Scan(&name, &vol); err != nil {
				continue
			}
			lastYearMap[name] = vol
		}
	}

	// SKU top outlets
	type topOutletRow struct {
		SKUName       string
		OutletName    string
		OutletVolume  float64
	}
	topOutletMap := map[string]topOutletRow{}
	skuTORows, err := db.Pool.Query(ctx,
		`SELECT DISTINCT ON (sr.sku_name) sr.sku_name, o.name as outlet_name, SUM(sr.volume_be) as outlet_volume
		 FROM sales_records sr
		 LEFT JOIN outlets o ON o.id = sr.outlet_id
		 WHERE sr.sales_id = $1 AND sr.record_date >= $2 AND sr.record_date <= $3
		   AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
		 GROUP BY sr.sku_name, o.name
		 ORDER BY sr.sku_name, outlet_volume DESC`,
		user.ID, rangeStart, rangeEnd,
	)
	if err == nil {
		defer skuTORows.Close()
		for skuTORows.Next() {
			var tr topOutletRow
			if err := skuTORows.Scan(&tr.SKUName, &tr.OutletName, &tr.OutletVolume); err != nil {
				continue
			}
			topOutletMap[tr.SKUName] = tr
		}
	}

	// SKU weekly breakdown
	weeklyMap := map[string][]float64{}
	skuWeeklyRows, err := db.Pool.Query(ctx,
		`SELECT sku_name, EXTRACT(WEEK FROM record_date) as week_num, SUM(volume_be) as weekly_volume
		 FROM sales_records
		 WHERE sales_id = $1 AND record_date >= $2 AND record_date <= $3
		   AND sku_name IS NOT NULL AND sku_name <> ''
		 GROUP BY sku_name, EXTRACT(WEEK FROM record_date)
		 ORDER BY sku_name, week_num`,
		user.ID, rangeStart, rangeEnd,
	)
	if err == nil {
		defer skuWeeklyRows.Close()
		for skuWeeklyRows.Next() {
			var name string
			var weekNum float64
			var weeklyVol float64
			if err := skuWeeklyRows.Scan(&name, &weekNum, &weeklyVol); err != nil {
				continue
			}
			weeklyMap[name] = append(weeklyMap[name], weeklyVol)
		}
	}

	// SKU transactions (current)
	transactionsMap := map[string][]map[string]interface{}{}
	skuTxRows, err := db.Pool.Query(ctx,
		`SELECT sr.sku_name, sr.record_date::text as date, sr.volume_be as be, o.name as outlet_name
		 FROM sales_records sr
		 LEFT JOIN outlets o ON o.id = sr.outlet_id
		 WHERE sr.sales_id = $1 AND sr.record_date >= $2 AND sr.record_date <= $3
		   AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
		 ORDER BY sr.sku_name, sr.record_date DESC`,
		user.ID, rangeStart, rangeEnd,
	)
	if err == nil {
		defer skuTxRows.Close()
		for skuTxRows.Next() {
			var skuName, date string
			var be float64
			var outletName *string
			if err := skuTxRows.Scan(&skuName, &date, &be, &outletName); err != nil {
				continue
			}
			outlet := "-"
			if outletName != nil {
				outlet = *outletName
			}
			transactionsMap[skuName] = append(transactionsMap[skuName], map[string]interface{}{
				"date": date, "be": be, "outlet": outlet,
			})
		}
	}

	// SKU transactions (previous period)
	prevTransactionsMap := map[string][]map[string]interface{}{}
	skuPTxRows, err := db.Pool.Query(ctx,
		`SELECT sr.sku_name, sr.record_date::text as date, sr.volume_be as be, o.name as outlet_name
		 FROM sales_records sr
		 LEFT JOIN outlets o ON o.id = sr.outlet_id
		 WHERE sr.sales_id = $1 AND sr.record_date >= $2 AND sr.record_date <= $3
		   AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
		 ORDER BY sr.sku_name, sr.record_date DESC`,
		user.ID, effectivePrevStart, effectivePrevEnd,
	)
	if err == nil {
		defer skuPTxRows.Close()
		for skuPTxRows.Next() {
			var skuName, date string
			var be float64
			var outletName *string
			if err := skuPTxRows.Scan(&skuName, &date, &be, &outletName); err != nil {
				continue
			}
			outlet := "-"
			if outletName != nil {
				outlet = *outletName
			}
			prevTransactionsMap[skuName] = append(prevTransactionsMap[skuName], map[string]interface{}{
				"date": date, "be": be, "outlet": outlet,
			})
		}
	}

	// Assemble SKU performance
	totalSkuVolume := 0.0
	for _, sr := range skuCurrentRows {
		totalSkuVolume += sr.Volume
	}

	skuPerformance := make([]models.SKUPerformance, 0, len(skuCurrentRows))
	for _, sr := range skuCurrentRows {
		volume := sr.Volume
		incentiveBonus := incentiveMap[sr.Name]
		prevData := prevMonthMap[sr.Name]
		prev := prevData.Volume
		lastY := lastYearMap[sr.Name]
		momTrend := 0.0
		if prev > 0 {
			momTrend = ((volume - prev) / prev) * 100
		} else if volume > 0 {
			momTrend = 100
		}
		yoyTrend := 0.0
		if lastY > 0 {
			yoyTrend = ((volume - lastY) / lastY) * 100
		} else if volume > 0 {
			yoyTrend = 100
		}
		topOD := topOutletMap[sr.Name]
		weekly := weeklyMap[sr.Name]
		paddedWeekly := make([]float64, 4)
		for i := 0; i < 4; i++ {
			idx := len(weekly) - 4 + i
			if idx >= 0 && idx < len(weekly) {
				paddedWeekly[i] = weekly[idx]
			}
		}
		topOutletContrib := 0.0
		if volume > 0 {
			topOutletContrib = math.Round((topOD.OutletVolume / volume) * 100)
		}
		mixPercent := 0.0
		if totalSkuVolume > 0 {
			mixPercent = (volume / totalSkuVolume) * 100
		}

		skuPerformance = append(skuPerformance, models.SKUPerformance{
			Name:                 sr.Name,
			Volume:               volume,
			IncentiveBE:          incentiveBonus,
			TotalBE:              volume + incentiveBonus,
			TransactionCount:     sr.TransactionCount,
			AvgOrder:             sr.AvgOrder,
			TopOutlet:            topOD.OutletName,
			TopOutletVolume:      topOD.OutletVolume,
			TopOutletContrib:     int(topOutletContrib),
			MixPercent:           mixPercent,
			MoMTrend:             momTrend,
			YoYTrend:             yoyTrend,
			PrevVolume:           prev,
			PrevTransactionCount: prevData.TransactionCount,
			MonthlyHistory:       paddedWeekly,
		})
	}

	// --- Grouped data for charting ---
	var groupedData interface{}
	if groupBy == "day" || groupBy == "week" {
		type groupedRow struct {
			Label   string
			WeekStart *string
			Volume  float64
			SKUName string
		}
		var gRows []groupedRow
		if groupBy == "day" {
			rows, err := db.Pool.Query(ctx,
				`SELECT sku_name, TO_CHAR(record_date, 'YYYY-MM-DD') as label, SUM(volume_be) as daily_volume
				 FROM sales_records
				 WHERE sales_id = $1 AND record_date >= $2 AND record_date <= $3
				   AND sku_name IS NOT NULL AND sku_name <> ''
				 GROUP BY sku_name, TO_CHAR(record_date, 'YYYY-MM-DD')
				 ORDER BY label`,
				user.ID, rangeStart, rangeEnd,
			)
			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var r groupedRow
					if err := rows.Scan(&r.SKUName, &r.Label, &r.Volume); err != nil {
						continue
					}
					gRows = append(gRows, r)
				}
			}
		} else {
			rows, err := db.Pool.Query(ctx,
				`SELECT sku_name, TO_CHAR(record_date, 'YYYY-WW') as label,
				   MIN(record_date)::text as week_start, SUM(volume_be) as daily_volume
				 FROM sales_records
				 WHERE sales_id = $1 AND record_date >= $2 AND record_date <= $3
				   AND sku_name IS NOT NULL AND sku_name <> ''
				 GROUP BY sku_name, TO_CHAR(record_date, 'YYYY-WW')
				 ORDER BY week_start`,
				user.ID, rangeStart, rangeEnd,
			)
			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var r groupedRow
					if err := rows.Scan(&r.SKUName, &r.Label, &r.WeekStart, &r.Volume); err != nil {
						continue
					}
					gRows = append(gRows, r)
				}
			}
		}
		type groupedDataPoint struct {
			Label     string              `json:"label"`
			WeekStart *string             `json:"weekStart,omitempty"`
			Volume    float64             `json:"volume"`
			SKUs      map[string]float64  `json:"skus"`
		}
		groupedMap := map[string]*groupedDataPoint{}
		for _, r := range gRows {
			if _, ok := groupedMap[r.Label]; !ok {
				groupedMap[r.Label] = &groupedDataPoint{
					Label:     r.Label,
					WeekStart: r.WeekStart,
					SKUs:      map[string]float64{},
				}
			}
			groupedMap[r.Label].Volume += r.Volume
			groupedMap[r.Label].SKUs[r.SKUName] += r.Volume
		}
		grouped := make([]groupedDataPoint, 0, len(groupedMap))
		for _, v := range groupedMap {
			grouped = append(grouped, *v)
		}
		// Sort by label
		for i := 0; i < len(grouped); i++ {
			for j := i + 1; j < len(grouped); j++ {
				if grouped[j].Label < grouped[i].Label {
					grouped[i], grouped[j] = grouped[j], grouped[i]
				}
			}
		}
		groupedData = grouped
	}

	// --- Phase 8: Outlets with OHS ---
	type outletRawRow struct {
		ID, Name, BranchArea, Address, ContactPerson string
		BeCurrent, BePrev, BePrev2 float64
		Freq3Mo                    int
		LastOrder                  *string
	}
	var outletRawRows []outletRawRow
	fmt.Printf("[Phase8] user.ID=%s start=%s end=%s prevStart=%s prevEnd=%s prev2Start=%s prev2End=%s rangeStart=%s rangeEnd=%s\n",
		user.ID, start, end, effectivePrevStart, effectivePrevEnd, prev2Start, prev2End, outletRangeStart, outletRangeEnd)
	olRows, err := db.Pool.Query(ctx,
		`SELECT
			o.id, o.name, o.type, o.address, o.contact_person, o.branch_area,
			COALESCE(SUM(CASE WHEN sr.record_date >= $2 AND sr.record_date <= $3 THEN sr.volume_be ELSE 0 END), 0) as be_current,
			COALESCE(SUM(CASE WHEN sr.record_date >= $4 AND sr.record_date <= $5 THEN sr.volume_be ELSE 0 END), 0) as be_prev,
			COALESCE(SUM(CASE WHEN sr.record_date >= $6 AND sr.record_date <= $7 THEN sr.volume_be ELSE 0 END), 0) as be_prev2,
			COALESCE(SUM(CASE WHEN sr.record_date >= $8 AND sr.record_date <= $9 THEN 1 ELSE 0 END), 0) as freq_3mo,
			MAX(sr.record_date)::text as last_order
		 FROM outlets o
		 LEFT JOIN outlet_assignments oa ON oa.outlet_id = o.id AND oa.salesman_id = $1 AND oa.unassigned_at IS NULL
		 LEFT JOIN sales_records sr ON sr.outlet_id = o.id AND sr.sales_id = $1
		 WHERE oa.id IS NOT NULL
		 GROUP BY o.id, o.name, o.type, o.address, o.contact_person, o.branch_area`,
		user.ID, rangeStart, rangeEnd,
		effectivePrevStart, effectivePrevEnd,
		prev2Start, prev2End,
		outletRangeStart, outletRangeEnd,
	)
	if err == nil {
		defer olRows.Close()
		for olRows.Next() {
			var r outletRawRow
			var oType string
			if err := olRows.Scan(&r.ID, &r.Name, &oType, &r.Address, &r.ContactPerson, &r.BranchArea,
				&r.BeCurrent, &r.BePrev, &r.BePrev2, &r.Freq3Mo, &r.LastOrder); err != nil {
				continue
			}
			outletRawRows = append(outletRawRows, r)
		}
	}

	outlets := make([]models.OutletHealth, 0, len(outletRawRows))
	for _, o := range outletRawRows {
		ohs := utils.CalculateOHS(o.BeCurrent, o.BePrev, o.BePrev2, o.Freq3Mo)
		daysSince := 99
		if o.LastOrder != nil {
			if t, err := time.Parse("2006-01-02", *o.LastOrder); err == nil {
				daysSince = int(now.Sub(t).Hours() / 24)
			}
		}
		lastOrder := "Today"
		if daysSince > 0 {
			lastOrder = fmt.Sprintf("%d days ago", daysSince)
		}
		alert := (*string)(nil)
		if ohs.Score < 40 {
			s := "Unhealthy Outlet"
			alert = &s
		} else if ohs.Score < 70 {
			s := "Needs Attention"
			alert = &s
		}
		outlets = append(outlets, models.OutletHealth{
			ID:              o.ID,
			Name:            o.Name,
			Type:            "",
			Address:         o.Address,
			Contact:         o.ContactPerson,
			BranchArea:      o.BranchArea,
			BEMonth:         o.BeCurrent,
			Health:          ohs.Score,
			HealthBreakdown: struct {
				Volume    int `json:"volume"`
				Trend     int `json:"trend"`
				Frequency int `json:"frequency"`
			}{
				Volume:    ohs.Breakdown["volume"],
				Trend:     ohs.Breakdown["trend"],
				Frequency: ohs.Breakdown["frequency"],
			},
			TotalBE3Mo: ohs.TotalBE,
			AvgBE:      ohs.AvgBE,
			Trend:      ohs.Trend,
			Freq3Mo:    ohs.Freq3Mo,
			LastOrder:  lastOrder,
			Alert:      alert,
		})
	}

	// --- Phase 9: Analytics ---
	analytics := models.Analytics{
		ActiveOutletsCount:   activeCount,
		TotalAssignedOutlets: totalAssigned,
		PenetrationMap:       map[string]int{},
	}

	// Coverage
	if totalAssigned > 0 {
		analytics.CoveragePct = int(math.Round(float64(activeCount) / float64(totalAssigned) * 100))
	}

	// Velocity
	velRows, err := db.Pool.Query(ctx,
		`SELECT TO_CHAR(record_date, 'YYYY-MM-DD') as d, SUM(volume_be) as daily_be, COUNT(*) as tx_count
		 FROM sales_records
		 WHERE sales_id = $1 AND record_date >= $2 AND record_date <= $3
		 GROUP BY d ORDER BY d`,
		user.ID, rangeStart, rangeEnd,
	)
	if err == nil {
		defer velRows.Close()
		for velRows.Next() {
			var date string
			var be float64
			var txCount int
			if err := velRows.Scan(&date, &be, &txCount); err != nil {
				continue
			}
			analytics.Velocity = append(analytics.Velocity, models.VelocityPoint{
				Date: date, BE: be, Transactions: txCount,
			})
		}
	}
	if rangeDays > 0 {
		analytics.AvgVelocity = currentBE / float64(rangeDays)
	}

	// SKU penetration
	skuPenRows, err := db.Pool.Query(ctx,
		`SELECT sr.sku_name, COUNT(DISTINCT sr.outlet_id) as outlet_count
		 FROM sales_records sr
		 INNER JOIN outlet_assignments oa ON oa.outlet_id = sr.outlet_id
		   AND oa.salesman_id = $1 AND oa.unassigned_at IS NULL
		 WHERE sr.sales_id = $1 AND sr.record_date >= $2 AND sr.record_date <= $3
		   AND sr.sku_name IS NOT NULL AND sr.sku_name <> ''
		 GROUP BY sr.sku_name`,
		user.ID, rangeStart, rangeEnd,
	)
	if err == nil {
		defer skuPenRows.Close()
		for skuPenRows.Next() {
			var skuName string
			var outletCount int
			if err := skuPenRows.Scan(&skuName, &outletCount); err != nil {
				continue
			}
			if totalAssigned > 0 {
				analytics.PenetrationMap[skuName] = int(math.Round(float64(outletCount) / float64(totalAssigned) * 100))
			}
		}
	}

	// Enrich SKU performance with penetration
	for i := range skuPerformance {
		skuPerformance[i].Penetration = analytics.PenetrationMap[skuPerformance[i].Name]
	}

	// WhereToVisit — outlets with longest gap since last order
	for _, o := range outletRawRows {
		daysSince := 99
		if o.LastOrder != nil {
			if t, err := time.Parse("2006-01-02", *o.LastOrder); err == nil {
				daysSince = int(now.Sub(t).Hours() / 24)
			}
		}
		if daysSince > 0 {
			analytics.WhereToVisit = append(analytics.WhereToVisit, models.WhereToVisit{
				ID:         o.ID,
				Name:       o.Name,
				BranchArea: o.BranchArea,
				BEMonth:    o.BeCurrent,
				LastOrder:  fmt.Sprintf("%d", daysSince),
				DaysSince:  daysSince,
			})
		}
	}
	if len(analytics.WhereToVisit) > 5 {
		analytics.WhereToVisit = analytics.WhereToVisit[:5]
	}

	// WhatToSell — SKUs with <50% penetration + positive MoM trend
	for _, sku := range skuPerformance {
		pen := analytics.PenetrationMap[sku.Name]
		if pen < 50 && sku.MoMTrend > 0 {
			analytics.WhatToSell = append(analytics.WhatToSell, models.WhatToSell{
				Name:           sku.Name,
				Volume:         sku.Volume,
				MoMTrend:       sku.MoMTrend,
				Penetration:    pen,
				ActiveIncentive: incentiveMap[sku.Name] > 0,
			})
		}
	}
	if len(analytics.WhatToSell) > 5 {
		analytics.WhatToSell = analytics.WhatToSell[:5]
	}

	// Lost/New outlets
	prevActiveIds := map[string]bool{}
	prevActiveRows, err := db.Pool.Query(ctx,
		`SELECT DISTINCT o.id, o.name
		 FROM outlets o
		 INNER JOIN outlet_assignments oa ON oa.outlet_id = o.id AND oa.salesman_id = $1 AND oa.unassigned_at IS NULL
		 INNER JOIN sales_records sr ON sr.outlet_id = o.id AND sr.sales_id = $1
		 WHERE sr.record_date >= $2 AND sr.record_date <= $3`,
		user.ID, effectivePrevStart, effectivePrevEnd,
	)
	if err == nil {
		defer prevActiveRows.Close()
		for prevActiveRows.Next() {
			var id, name string
			if err := prevActiveRows.Scan(&id, &name); err != nil {
				continue
			}
			prevActiveIds[id] = true
		}
	}

	for _, ar := range assignedRows {
		if ar.isActive && !prevActiveIds[ar.id] {
			for _, o := range outletRawRows {
				if o.ID == ar.id {
					analytics.NewOutlets = append(analytics.NewOutlets, models.NewOutlet{
						ID: o.ID, Name: o.Name,
					})
					analytics.NewCount++
					break
				}
			}
		}
	}
	for _, o := range outletRawRows {
		if prevActiveIds[o.ID] {
			isActive := false
			for _, ar := range assignedRows {
				if ar.id == o.ID && ar.isActive {
					isActive = true
					break
				}
			}
			if !isActive {
				analytics.LostOutlets = append(analytics.LostOutlets, models.LostOutlet{
					ID: o.ID, Name: o.Name,
				})
				analytics.LostCount++
			}
		}
	}

	// --- Phase 10: Bonus calculations ---
	pc, _ := target.PercentageConfig.(map[string]interface{})
	attainment, percentageBonus, _ := utils.CalculatePercentageBonus(monthBE, target.TargetBE, pc)
	vc, _ := target.VolumeConfig.(map[string]interface{})
	volumeBonus, _ := utils.CalculateVolumeBonus(monthBE, vc)
	ac, _ := target.ActiveOutletsConfig.(map[string]interface{})
	percent, activeBonus, _ := utils.CalculateActiveOutletsBonus(totalAssigned, activeCount, ac)

	// --- Assemble response ---
	return c.JSON(http.StatusOK, models.UserDashboardData{
		User: userModel,
		DateRange: models.DateRange{
			Start:   rangeStart,
			End:     rangeEnd,
			GroupBy: groupBy,
		},
		DashboardStats: models.DashboardStats{
			MonthlyTargetBE:     target.TargetBE,
			CurrentBE:           currentBE,
			IncentiveBE:         incentiveBE,
			TotalWithIncentive:  totalWithIncentive,
			DaysElapsed:         daysElapsed,
			TotalWorkingDays:    22,
			DaysInMonth:         daysInMonth,
			RangeDays:           rangeDays,
			PercentageConfig:    target.PercentageConfig,
			VolumeConfig:        target.VolumeConfig,
			ActiveOutletsConfig: target.ActiveOutletsConfig,
		},
		BonusSummary: models.BonusSummary{
			Percentage: models.BonusResult{
				Attainment: attainment,
				Bonus:      percentageBonus,
			},
			Volume: models.BonusResult{
				Bonus: volumeBonus,
			},
			ActiveOutlets: models.ActiveOutletsResult{
				Percent:       percent,
				Bonus:         activeBonus,
				ActiveCount:   activeCount,
				TotalAssigned: totalAssigned,
			},
			Total: percentageBonus + volumeBonus + activeBonus,
		},
		Outlets:        outlets,
		SKUPerformance: skuPerformance,
		Analytics:      analytics,
		GroupedData:    groupedData,
		ActiveIncentives: activeIncentives,
		DaysElapsed:    daysElapsed,
		DaysInMonth:    daysInMonth,
	})
}

func daysInMonthCount(year, month int) int {
	t := time.Date(year, time.Month(month)+1, 0, 0, 0, 0, 0, time.UTC)
	return t.Day()
}

// GetAnalytics returns analytics data (same as dashboard for sales role)
func (h *UserHandler) GetAnalytics(c echo.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	// Analytics only supported for sales role
	if user.Role != "sales" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Analytics not supported for this role"})
	}

	// Delegate to dashboard — same data, different endpoint name
	return h.GetDashboard(c)
}
