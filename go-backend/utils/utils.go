package utils

import (
	"math"
	"strings"
	"time"
)

func ParseExcelDate(val interface{}) *string {
	if val == nil {
		return nil
	}

	switch v := val.(type) {
	case string:
		if len(v) == 10 && v[4] == '-' && v[7] == '-' {
			return &v
		}
	case float64:
		d := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
		d = d.AddDate(0, 0, int(v))
		dateStr := d.Format("2006-01-02")
		return &dateStr
	case time.Time:
		dateStr := v.Format("2006-01-02")
		return &dateStr
	}
	return nil
}

func ExtractKgFromName(name string) float64 {
	if name == "" {
		return 10
	}
	// Match patterns like: "9KG", "17KG", "12,5 KG", "12.5 KG"
	upper := strings.ToUpper(name)
	idx := strings.Index(upper, "KG")
	if idx <= 0 {
		return 10
	}

	// Find number before KG
	start := idx - 1
	for start >= 0 && (upper[start] >= '0' && upper[start] <= '9' || upper[start] == '.' || upper[start] == ',') {
		start--
	}
	start++

	if start >= idx {
		return 10
	}

	numStr := strings.ReplaceAll(upper[start:idx], ",", ".")
	var num float64
	for _, c := range numStr {
		if c >= '0' && c <= '9' {
			num = num*10 + float64(c-'0')
		} else if c == '.' {
			// Handle decimal
		}
	}
	if num > 0 {
		return num
	}
	return 10
}

func ConvertToBE(boxCount int, kg float64) float64 {
	return (float64(boxCount) * kg) / 12
}

func LevenshteinDistance(a, b string) int {
	la := len(a)
	lb := len(b)

	if la == 0 {
		return lb
	}
	if lb == 0 {
		return la
	}

	matrix := make([][]int, lb+1)
	for i := range matrix {
		matrix[i] = make([]int, la+1)
		matrix[i][0] = i
	}
	for j := 0; j <= la; j++ {
		matrix[0][j] = j
	}

	for i := 1; i <= lb; i++ {
		for j := 1; j <= la; j++ {
			cost := 0
			if b[i-1] != a[j-1] {
				cost = 1
			}
			matrix[i][j] = min(
				matrix[i-1][j-1]+cost,
				min(matrix[i][j-1]+1, matrix[i-1][j]+1),
			)
		}
	}
	return matrix[lb][la]
}

func FuzzyMatchOutlet(name string, outlets []map[string]string) *map[string]string {
	normalized := strings.ToUpper(strings.TrimSpace(name))
	var bestMatch *map[string]string
	bestScore := math.MaxInt32

	for i := range outlets {
		outletName := strings.ToUpper(strings.TrimSpace(outlets[i]["name"]))
		dist := LevenshteinDistance(normalized, outletName)
		maxLen := max(len(normalized), len(outletName))
		similarity := 0.0
		if maxLen > 0 {
			similarity = 1 - float64(dist)/float64(maxLen)
		}
		if similarity >= 0.7 && dist < bestScore {
			bestScore = dist
			bestMatch = &outlets[i]
		}
	}
	return bestMatch
}

func CalculateOHS(beCurrent, bePrev, bePrev2 float64, freq3Mo int) (int, map[string]int) {
	totalBE := beCurrent + bePrev + bePrev2
	_ = totalBE / 3 // avgBE used for future calculations

	trend := 0.0
	if bePrev > 0 {
		trend = ((beCurrent - bePrev) / bePrev) * 100
	} else if beCurrent > 0 {
		trend = 100
	}

	volumeScore := math.Min(totalBE, 100)
	trendScore := math.Max(0, math.Min(100, 50+(trend/2)))
	freqScore := math.Min(float64(freq3Mo)*5, 100)

	ohs := int(math.Round(volumeScore*0.40 + trendScore*0.40 + freqScore*0.20))
	ohs = int(math.Max(0, math.Min(100, float64(ohs))))

	breakdown := map[string]int{
		"volume":    int(math.Round(volumeScore)),
		"trend":     int(math.Round(trendScore)),
		"frequency": int(math.Round(freqScore)),
	}

	return ohs, breakdown
}

func CalculatePercentageBonus(currentBE, targetBE float64, config map[string]interface{}) (float64, float64, map[string]interface{}) {
	if targetBE <= 0 || config == nil {
		return 0, 0, nil
	}

	attainment := (currentBE / targetBE) * 100
	tiers, _ := config["tiers"].([]interface{})

	var activeTier map[string]interface{}
	for _, t := range tiers {
		tier, ok := t.(map[string]interface{})
		if !ok {
			continue
		}
		threshold, _ := tier["threshold"].(float64)
		if attainment >= threshold {
			activeTier = tier
		}
	}

	bonus := 0.0
	if activeTier != nil {
		bonus, _ = activeTier["reward"].(float64)
	}

	return attainment, bonus, activeTier
}

func CalculateVolumeBonus(currentBE float64, config map[string]interface{}) (float64, map[string]interface{}) {
	if config == nil {
		return 0, nil
	}

	tiers, _ := config["tiers"].([]interface{})
	var activeTier map[string]interface{}

	for _, t := range tiers {
		tier, ok := t.(map[string]interface{})
		if !ok {
			continue
		}
		threshold, _ := tier["threshold"].(float64)
		if currentBE >= threshold {
			activeTier = tier
		}
	}

	bonus := 0.0
	if activeTier != nil {
		bonus, _ = activeTier["reward"].(float64)
	}

	return bonus, activeTier
}

func CalculateActiveOutletsBonus(totalAssigned, activeCount int, config map[string]interface{}) (float64, float64, map[string]interface{}) {
	if totalAssigned == 0 || config == nil {
		return 0, 0, nil
	}

	percent := (float64(activeCount) / float64(totalAssigned)) * 100
	tiers, _ := config["tiers"].([]interface{})

	var activeTier map[string]interface{}
	for _, t := range tiers {
		tier, ok := t.(map[string]interface{})
		if !ok {
			continue
		}
		threshold, _ := tier["threshold"].(float64)
		if percent >= threshold {
			activeTier = tier
		}
	}

	bonus := 0.0
	if activeTier != nil {
		bonus, _ = activeTier["reward"].(float64)
	}

	return percent, bonus, activeTier
}

func GetCurrentMonthRange() (int, int, string, string) {
	now := time.Now()
	month := int(now.Month())
	year := now.Year()
	start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	end := time.Date(year, time.Month(month)+1, 0, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	return month, year, start, end
}

func GetPreviousMonthRange(month, year, monthsAgo int) (int, int, string, string) {
	targetMonth := month - monthsAgo
	targetYear := year
	for targetMonth <= 0 {
		targetMonth += 12
		targetYear--
	}
	start := time.Date(targetYear, time.Month(targetMonth), 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	end := time.Date(targetYear, time.Month(targetMonth)+1, 0, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	return targetMonth, targetYear, start, end
}

func GetDefaultPercentageConfig(level string) map[string]interface{} {
	base := 1000000
	if level == "L3" {
		base = 1200000
	}
	return map[string]interface{}{
		"base_reward": base,
		"tiers": []map[string]interface{}{
			{"threshold": 90, "reward": int(float64(base) * 0.50), "label": "90%"},
			{"threshold": 100, "reward": base, "label": "100%"},
			{"threshold": 110, "reward": int(float64(base) * 1.25), "label": "110%"},
		},
	}
}

func GetDefaultVolumeConfig() map[string]interface{} {
	return map[string]interface{}{
		"tiers": []map[string]interface{}{
			{"threshold": 1500, "reward": 250000, "label": "Tier 1"},
			{"threshold": 2500, "reward": 500000, "label": "Tier 2"},
			{"threshold": 3500, "reward": 750000, "label": "Tier 3"},
		},
	}
}

func GetDefaultActiveOutletsConfig(level string) map[string]interface{} {
	base := 300000
	if level == "L3" {
		base = 400000
	}
	return map[string]interface{}{
		"base_reward": base,
		"tiers": []map[string]interface{}{
			{"threshold": 90, "reward": int(float64(base) * 0.50), "label": "90%"},
			{"threshold": 100, "reward": base, "label": "100%"},
			{"threshold": 125, "reward": int(float64(base) * 1.25), "label": "125%"},
		},
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
