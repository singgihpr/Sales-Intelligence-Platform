package handlers

import (
	"context"
	"net/http"
	"strconv"

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
	searchPattern := "%" + search + "%"

	ctx := context.Background()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, email, role, region, level, supervisor_id, created_at 
		 FROM users 
		 WHERE name ILIKE $1 OR email ILIKE $1 OR role ILIKE $1 OR region ILIKE $1
		 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		searchPattern, limit, offset,
	)
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
	err = db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE name ILIKE $1 OR email ILIKE $1 OR role ILIKE $1 OR region ILIKE $1`,
		searchPattern,
	).Scan(&total)
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

func (h *UserHandler) GetDashboard(c echo.Context) error {
	user := middleware.GetUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	ctx := context.Background()
	month, year, start, end := utils.GetCurrentMonthRange()

	// Fetch user
	var userModel models.User
	err := db.Pool.QueryRow(ctx,
		`SELECT id, name, email, role, region, level FROM users WHERE id = $1`,
		user.ID,
	).Scan(&userModel.ID, &userModel.Name, &userModel.Email, &userModel.Role, &userModel.Region, &userModel.Level)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "User not found"})
	}

	// Fetch or create target
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
		pc := utils.GetDefaultPercentageConfig("L2")
		vc := utils.GetDefaultVolumeConfig()
		ac := utils.GetDefaultActiveOutletsConfig("L2")

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

	// Run concurrent queries for dashboard data
	type result struct {
		currentBE      float64
		monthBE        float64
		incentiveBE    float64
		totalAssigned  int
		activeCount    int
		outlets        []models.OutletHealth
		skuPerformance []models.SKUPerformance
		analytics      models.Analytics
	}

	ch := make(chan result, 1)
	go func() {
		r := result{}

		// Current BE
		db.Pool.QueryRow(ctx,
			`SELECT COALESCE(SUM(volume_be), 0) FROM sales_records WHERE sales_id = $1 AND record_date >= $2 AND record_date <= $3`,
			user.ID, start, end,
		).Scan(&r.currentBE)

		// Month BE
		db.Pool.QueryRow(ctx,
			`SELECT COALESCE(SUM(volume_be), 0) FROM sales_records WHERE sales_id = $1 AND record_date >= $2 AND record_date <= $3`,
			user.ID, start, end,
		).Scan(&r.monthBE)

		// Incentive BE
		db.Pool.QueryRow(ctx,
			`SELECT COALESCE(SUM(si.bonus_be), 0)
			 FROM sales_records sr
			 JOIN sku_incentives si ON sr.sku_name = si.sku_name
			   AND sr.record_date >= si.start_date AND sr.record_date <= si.end_date
			 WHERE sr.sales_id = $1 AND sr.record_date >= $2 AND sr.record_date <= $3 AND si.is_active = true`,
			user.ID, start, end,
		).Scan(&r.incentiveBE)

		// Assigned outlets
		rows, _ := db.Pool.Query(ctx,
			`SELECT o.id, EXISTS(
				SELECT 1 FROM sales_records sr WHERE sr.outlet_id = o.id AND sr.sales_id = $1 AND sr.record_date >= $2 AND sr.record_date <= $3
			) as is_active
			FROM outlets o
			INNER JOIN outlet_assignments oa ON oa.outlet_id = o.id AND oa.salesman_id = $1 AND oa.unassigned_at IS NULL`,
			user.ID, start, end,
		)
		if rows != nil {
			defer rows.Close()
			for rows.Next() {
				var id string
				var isActive bool
				rows.Scan(&id, &isActive)
				r.totalAssigned++
				if isActive {
					r.activeCount++
				}
			}
		}

		// SKU Performance
		skuRows, _ := db.Pool.Query(ctx,
			`SELECT sku_name, SUM(volume_be) as volume, COUNT(*) as transaction_count, AVG(volume_be) as avg_order
			 FROM sales_records
			 WHERE sales_id = $1 AND record_date >= $2 AND record_date <= $3
			   AND sku_name IS NOT NULL AND sku_name <> ''
			 GROUP BY sku_name ORDER BY volume DESC LIMIT 5`,
			user.ID, start, end,
		)
		if skuRows != nil {
			defer skuRows.Close()
			for skuRows.Next() {
				var sku models.SKUPerformance
				skuRows.Scan(&sku.Name, &sku.Volume, &sku.TransactionCount, &sku.AvgOrder)
				r.skuPerformance = append(r.skuPerformance, sku)
			}
		}

		ch <- r
	}()

	// Wait for results
	res := <-ch

	// Calculate bonuses
	pc, _ := target.PercentageConfig.(map[string]interface{})
	attainment, percentageBonus, _ := utils.CalculatePercentageBonus(res.monthBE, target.TargetBE, pc)
	vc, _ := target.VolumeConfig.(map[string]interface{})
	volumeBonus, _ := utils.CalculateVolumeBonus(res.monthBE, vc)
	ac, _ := target.ActiveOutletsConfig.(map[string]interface{})
	percent, activeBonus, _ := utils.CalculateActiveOutletsBonus(res.totalAssigned, res.activeCount, ac)

	daysInMonth := 30 // Simplified
	daysElapsed := 15 // Simplified

	return c.JSON(http.StatusOK, models.UserDashboardData{
		User: userModel,
		DateRange: models.DateRange{
			Start:   start,
			End:     end,
			GroupBy: "month",
		},
		DashboardStats: models.DashboardStats{
			MonthlyTargetBE:     target.TargetBE,
			CurrentBE:           res.currentBE,
			IncentiveBE:         res.incentiveBE,
			TotalWithIncentive:  res.currentBE + res.incentiveBE,
			DaysElapsed:         daysElapsed,
			TotalWorkingDays:    22,
			DaysInMonth:         daysInMonth,
			RangeDays:           daysElapsed,
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
				ActiveCount:   res.activeCount,
				TotalAssigned: res.totalAssigned,
			},
			Total: percentageBonus + volumeBonus + activeBonus,
		},
		Outlets:        res.outlets,
		SKUPerformance: res.skuPerformance,
		Analytics:      res.analytics,
		DaysElapsed:    daysElapsed,
		DaysInMonth:    daysInMonth,
	})
}
