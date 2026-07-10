package handlers

import (
	"context"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"

	"sales-intelligence/db"
	"sales-intelligence/models"
)

type RecordHandler struct{}

func (h *RecordHandler) ListRecords(c echo.Context) error {
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
		`SELECT sr.id, o.name as outlet, u.name as sales, sr.record_date::text as date,
		        sr.volume_be as be, sr.sku_name as sku, sr.outlet_id, sr.sales_id
		 FROM sales_records sr
		 LEFT JOIN outlets o ON sr.outlet_id = o.id
		 LEFT JOIN users u ON sr.sales_id = u.id
		 WHERE o.name ILIKE $1 OR u.name ILIKE $1 OR sr.sku_name ILIKE $1
		 ORDER BY sr.record_date DESC LIMIT $2 OFFSET $3`,
		searchPattern, limit, offset,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}
	defer rows.Close()

	records := []map[string]interface{}{}
	for rows.Next() {
		var id, outlet, sales, date, sku string
		var outletID, salesID *string
		var be float64
		if err := rows.Scan(&id, &outlet, &sales, &date, &be, &sku, &outletID, &salesID); err != nil {
			continue
		}
		records = append(records, map[string]interface{}{
			"id": id, "outlet": outlet, "sales": sales, "date": date,
			"be": be, "sku": sku, "outlet_id": outletID, "sales_id": salesID,
		})
	}

	var total int
	db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM sales_records sr
		 LEFT JOIN outlets o ON sr.outlet_id = o.id
		 LEFT JOIN users u ON sr.sales_id = u.id
		 WHERE o.name ILIKE $1 OR u.name ILIKE $1 OR sr.sku_name ILIKE $1`,
		searchPattern,
	).Scan(&total)

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       records,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: (total + limit - 1) / limit,
	})
}

func (h *RecordHandler) UpdateRecord(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id required"})
	}

	var req struct {
		Outlet string  `json:"outlet"`
		Sales  string  `json:"sales"`
		Date   string  `json:"date"`
		BE     float64 `json:"be"`
		SKU    string  `json:"sku"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	ctx := context.Background()
	var record models.SalesRecord
	err := db.Pool.QueryRow(ctx,
		`UPDATE sales_records SET
			outlet_id = (SELECT id FROM outlets WHERE name = $1),
			sales_id = (SELECT id FROM users WHERE name = $2),
			record_date = $3, volume_be = $4, sku_name = $5
		 WHERE id = $6 RETURNING *`,
		req.Outlet, req.Sales, req.Date, req.BE, req.SKU, id,
	).Scan(&record.ID, &record.OutletID, &record.SalesID, &record.RecordDate, &record.VolumeBE, &record.SKUName)

	if err == pgx.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}

	return c.JSON(http.StatusOK, record)
}

func (h *RecordHandler) DeleteRecord(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id required"})
	}

	ctx := context.Background()
	_, err := db.Pool.Exec(ctx, `DELETE FROM sales_records WHERE id = $1`, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete record"})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
