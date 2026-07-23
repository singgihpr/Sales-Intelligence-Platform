package handlers

import (
    "context"
    "net/http"
    "strconv"

    "github.com/labstack/echo/v4"

    "sales-intelligence/db"
)

type SKUHandler struct{}

func (h *SKUHandler) ListSKUs(c echo.Context) error {
    page, _ := strconv.Atoi(c.QueryParam("page"))
    if page < 1 {
        page = 1
    }
    limit, _ := strconv.Atoi(c.QueryParam("limit"))
    if limit < 1 || limit > 100 {
        limit = 10
    }
    offset := (page - 1) * limit
    search := c.QueryParam("search")
    searchPattern := "%" + search + "%"

    ctx := context.Background()

    var query string
    var args []interface{}

    if search != "" {
        query = `
            SELECT DISTINCT si.sku_name
            FROM sales_records si
            WHERE si.sku_name ILIKE $1
            ORDER BY si.sku_name
            LIMIT $2 OFFSET $3
        `
        args = []interface{}{searchPattern, limit, offset}
    } else {
        query = `
            SELECT DISTINCT si.sku_name
            FROM sales_records si
            WHERE si.sku_name IS NOT NULL AND si.sku_name <> ''
            ORDER BY si.sku_name
            LIMIT $1 OFFSET $2
        `
        args = []interface{}{limit, offset}
    }

    rows, err := db.Pool.Query(ctx, query, args...)
    if err != nil {
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
    }
    defer rows.Close()

    var skus []string
    for rows.Next() {
        var skuName string
        if err := rows.Scan(&skuName); err != nil {
            continue
        }
        skus = append(skus, skuName)
    }

    var total int
    if search != "" {
        db.Pool.QueryRow(ctx,
            `SELECT COUNT(DISTINCT si.sku_name) FROM sales_records si WHERE si.sku_name ILIKE $1`,
            searchPattern,
        ).Scan(&total)
    } else {
        db.Pool.QueryRow(ctx,
            `SELECT COUNT(DISTINCT si.sku_name) FROM sales_records si WHERE si.sku_name IS NOT NULL AND si.sku_name <> ''`,
        ).Scan(&total)
    }

    result := make([]map[string]interface{}, len(skus))
    for i, skuName := range skus {
        result[i] = map[string]interface{}{
            "name": skuName,
        }
    }

    return c.JSON(http.StatusOK, map[string]interface{}{
        "data":  result,
        "total": total,
        "page":  page,
        "limit": limit,
    })
}
