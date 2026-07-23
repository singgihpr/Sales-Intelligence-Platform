package handlers

import (
	"context"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"

	"sales-intelligence/db"
	"sales-intelligence/middleware"
	"sales-intelligence/models"
)

type IncentiveHandler struct{}

func (h *IncentiveHandler) ListIncentives(c echo.Context) error {
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
		`SELECT si.id, si.sku_name, si.bonus_be, si.start_date, si.end_date,
		        si.is_active, si.created_by, si.notes, si.created_at, u.name as created_by_name
		 FROM sku_incentives si
		 LEFT JOIN users u ON si.created_by = u.id
		 WHERE (si.sku_name ILIKE $1 OR si.notes ILIKE $1)
		 ORDER BY si.created_at DESC LIMIT $2 OFFSET $3`,
		searchPattern, limit, offset,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}
	defer rows.Close()

	incentives := []map[string]interface{}{}
	for rows.Next() {
		var id, skuName string
		var bonusBE float64
		var startDate, endDate pgtype.Date
		var isActive bool
		var createdBy *string
		var notes string
		var createdAt pgtype.Timestamp
		var createdByName *string
		if err := rows.Scan(&id, &skuName, &bonusBE, &startDate, &endDate, &isActive, &createdBy, &notes, &createdAt, &createdByName); err != nil {
			continue
		}
		incentives = append(incentives, map[string]interface{}{
			"id": id, "sku_name": skuName, "bonus_be": bonusBE,
			"start_date": startDate, "end_date": endDate, "is_active": isActive,
			"created_by": createdBy, "notes": notes, "created_at": createdAt,
			"created_by_name": createdByName,
		})
	}

	var total int
	db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM sku_incentives WHERE sku_name ILIKE $1 OR notes ILIKE $1`,
		searchPattern,
	).Scan(&total)

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       incentives,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: (total + limit - 1) / limit,
	})
}

func (h *IncentiveHandler) CreateIncentive(c echo.Context) error {
	user := middleware.GetUser(c)

	var req struct {
		SKUName   string  `json:"sku_name"`
		BonusBE   float64 `json:"bonus_be"`
		StartDate string  `json:"start_date"`
		EndDate   string  `json:"end_date"`
		IsActive  *bool   `json:"is_active"`
		Notes     string  `json:"notes"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	ctx := context.Background()
	var incentive models.SKUIncentive
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO sku_incentives (id, sku_name, bonus_be, start_date, end_date, is_active, created_by, notes)
		 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, sku_name, bonus_be, start_date, end_date, is_active, created_by, notes, created_at`,
		req.SKUName, req.BonusBE, req.StartDate, req.EndDate, isActive, user.ID, req.Notes,
	).Scan(&incentive.ID, &incentive.SKUName, &incentive.BonusBE, &incentive.StartDate, &incentive.EndDate, &incentive.IsActive, &incentive.CreatedBy, &incentive.Notes, &incentive.CreatedAt)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create incentive"})
	}

	return c.JSON(http.StatusCreated, incentive)
}

func (h *IncentiveHandler) UpdateIncentive(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id required"})
	}

	var req struct {
		SKUName   *string  `json:"sku_name"`
		BonusBE   *float64 `json:"bonus_be"`
		StartDate *string  `json:"start_date"`
		EndDate   *string  `json:"end_date"`
		IsActive  *bool    `json:"is_active"`
		Notes     *string  `json:"notes"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	ctx := context.Background()
	var incentive models.SKUIncentive
	err := db.Pool.QueryRow(ctx,
		`UPDATE sku_incentives SET
			sku_name = COALESCE($1, sku_name),
			bonus_be = COALESCE($2, bonus_be),
			start_date = COALESCE($3, start_date),
			end_date = COALESCE($4, end_date),
			is_active = COALESCE($5, is_active),
			notes = COALESCE($6, notes),
			updated_at = CURRENT_TIMESTAMP
		 WHERE id = $7
		 RETURNING id, sku_name, bonus_be, start_date, end_date, is_active, created_by, notes, created_at`,
		req.SKUName, req.BonusBE, req.StartDate, req.EndDate, req.IsActive, req.Notes, id,
	).Scan(&incentive.ID, &incentive.SKUName, &incentive.BonusBE, &incentive.StartDate, &incentive.EndDate, &incentive.IsActive, &incentive.CreatedBy, &incentive.Notes, &incentive.CreatedAt)

	if err == pgx.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}

	return c.JSON(http.StatusOK, incentive)
}

func (h *IncentiveHandler) DeleteIncentive(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id required"})
	}

	ctx := context.Background()
	_, err := db.Pool.Exec(ctx, `DELETE FROM sku_incentives WHERE id = $1`, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete incentive"})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
