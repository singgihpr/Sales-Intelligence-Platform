package handlers

import (
	"context"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"

	"sales-intelligence/db"
	"sales-intelligence/models"
	"sales-intelligence/utils"
)

type TargetHandler struct{}

func (h *TargetHandler) ListTargets(c echo.Context) error {
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
	userID := c.QueryParam("user_id")

	ctx := context.Background()

	if userID != "" {
		rows, err := db.Pool.Query(ctx,
			`SELECT t.id, t.user_id, t.month, t.year, t.target_be,
			        t.percentage_config, t.volume_config, t.active_outlets_config,
			        u.name as user_name
			 FROM targets t
			 LEFT JOIN users u ON t.user_id = u.id
			 WHERE t.user_id = $1
			   AND (u.name ILIKE $2 OR CAST(t.month AS TEXT) ILIKE $2 OR CAST(t.year AS TEXT) ILIKE $2)
			 ORDER BY t.year DESC, t.month DESC LIMIT $3 OFFSET $4`,
			userID, searchPattern, limit, offset,
		)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
		}
		defer rows.Close()

		targets := []map[string]interface{}{}
		for rows.Next() {
			var id, uid string
			var month, year int
			var targetBE float64
			var userName *string
			var pc, vc, ac interface{}
			if err := rows.Scan(&id, &uid, &month, &year, &targetBE, &pc, &vc, &ac, &userName); err != nil {
				continue
			}
			targets = append(targets, map[string]interface{}{
				"id": id, "user_id": uid, "month": month, "year": year,
				"target_be": targetBE, "percentage_config": pc, "volume_config": vc,
				"active_outlets_config": ac, "user_name": userName,
			})
		}

		var total int
		db.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM targets t LEFT JOIN users u ON t.user_id = u.id
			 WHERE t.user_id = $1 AND (u.name ILIKE $2 OR CAST(t.month AS TEXT) ILIKE $2 OR CAST(t.year AS TEXT) ILIKE $2)`,
			userID, searchPattern,
		).Scan(&total)

		return c.JSON(http.StatusOK, models.PaginatedResponse{
			Data:       targets,
			Total:      total,
			Page:       page,
			Limit:      limit,
			TotalPages: (total + limit - 1) / limit,
		})
	}

	rows, err := db.Pool.Query(ctx,
		`SELECT t.id, t.user_id, t.month, t.year, t.target_be,
		        t.percentage_config, t.volume_config, t.active_outlets_config,
		        u.name as user_name
		 FROM targets t
		 LEFT JOIN users u ON t.user_id = u.id
		 WHERE (u.name ILIKE $1 OR u.email ILIKE $1 OR CAST(t.month AS TEXT) ILIKE $1 OR CAST(t.year AS TEXT) ILIKE $1)
		 ORDER BY t.year DESC, t.month DESC LIMIT $2 OFFSET $3`,
		searchPattern, limit, offset,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}
	defer rows.Close()

	targets := []map[string]interface{}{}
	for rows.Next() {
		var id, uid string
		var month, year int
		var targetBE float64
		var userName *string
		var pc, vc, ac interface{}
		if err := rows.Scan(&id, &uid, &month, &year, &targetBE, &pc, &vc, &ac, &userName); err != nil {
			continue
		}
		targets = append(targets, map[string]interface{}{
			"id": id, "user_id": uid, "month": month, "year": year,
			"target_be": targetBE, "percentage_config": pc, "volume_config": vc,
			"active_outlets_config": ac, "user_name": userName,
		})
	}

	var total int
	db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM targets t LEFT JOIN users u ON t.user_id = u.id
		 WHERE (u.name ILIKE $1 OR u.email ILIKE $1 OR CAST(t.month AS TEXT) ILIKE $1 OR CAST(t.year AS TEXT) ILIKE $1)`,
		searchPattern,
	).Scan(&total)

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       targets,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: (total + limit - 1) / limit,
	})
}

func (h *TargetHandler) CreateTarget(c echo.Context) error {
	var req struct {
		UserID               string      `json:"user_id"`
		Month                int         `json:"month"`
		Year                 int         `json:"year"`
		TargetBE             float64     `json:"target_be"`
		Level                string      `json:"level"`
		PercentageConfig     interface{} `json:"percentage_config"`
		VolumeConfig         interface{} `json:"volume_config"`
		ActiveOutletsConfig  interface{} `json:"active_outlets_config"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	pc := req.PercentageConfig
	if pc == nil {
		pc = utils.GetDefaultPercentageConfig(req.Level)
	}
	vc := req.VolumeConfig
	if vc == nil {
		vc = utils.GetDefaultVolumeConfig()
	}
	ac := req.ActiveOutletsConfig
	if ac == nil {
		ac = utils.GetDefaultActiveOutletsConfig(req.Level)
	}

	ctx := context.Background()
	var target models.Target
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO targets (id, user_id, month, year, target_be, percentage_config, volume_config, active_outlets_config)
		 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (user_id, month, year) DO UPDATE SET
		   target_be = EXCLUDED.target_be,
		   percentage_config = EXCLUDED.percentage_config,
		   volume_config = EXCLUDED.volume_config,
		   active_outlets_config = EXCLUDED.active_outlets_config
		 RETURNING *`,
		req.UserID, req.Month, req.Year, req.TargetBE, pc, vc, ac,
	).Scan(&target.ID, &target.UserID, &target.Month, &target.Year, &target.TargetBE, &target.PercentageConfig, &target.VolumeConfig, &target.ActiveOutletsConfig)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create target"})
	}

	return c.JSON(http.StatusCreated, target)
}

func (h *TargetHandler) UpdateTarget(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id required"})
	}

	var req struct {
		TargetBE            *float64    `json:"target_be"`
		PercentageConfig    interface{} `json:"percentage_config"`
		VolumeConfig        interface{} `json:"volume_config"`
		ActiveOutletsConfig interface{} `json:"active_outlets_config"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	ctx := context.Background()
	var target models.Target
	err := db.Pool.QueryRow(ctx,
		`UPDATE targets SET
			target_be = COALESCE($1, target_be),
			percentage_config = COALESCE($2, percentage_config),
			volume_config = COALESCE($3, volume_config),
			active_outlets_config = COALESCE($4, active_outlets_config)
		 WHERE id = $5 RETURNING *`,
		req.TargetBE, req.PercentageConfig, req.VolumeConfig, req.ActiveOutletsConfig, id,
	).Scan(&target.ID, &target.UserID, &target.Month, &target.Year, &target.TargetBE, &target.PercentageConfig, &target.VolumeConfig, &target.ActiveOutletsConfig)

	if err == pgx.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}

	return c.JSON(http.StatusOK, target)
}

func (h *TargetHandler) DeleteTarget(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id required"})
	}

	ctx := context.Background()
	_, err := db.Pool.Exec(ctx, `DELETE FROM targets WHERE id = $1`, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete target"})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
