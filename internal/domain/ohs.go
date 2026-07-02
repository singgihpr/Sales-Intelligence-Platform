package domain

type OHSBreakdown struct {
	Volume    int `json:"volume"`
	Trend     int `json:"trend"`
	Frequency int `json:"frequency"`
}

type OHSResult struct {
	Score      int          `json:"score"`
	TotalBE    float64      `json:"totalBE"`
	AvgBE      float64      `json:"avgBE"`
	Trend      float64      `json:"trend"`
	Freq3Mo    int          `json:"freq3Mo"`
	Breakdown  OHSBreakdown `json:"breakdown"`
}

func CalculateOHS(beCurrent, bePrev, bePrev2 float64, freq3Mo int) OHSResult {
	totalBE := beCurrent + bePrev + bePrev2
	avgBE := totalBE / 3

	trend := 0.0
	if bePrev > 0 {
		trend = ((beCurrent - bePrev) / bePrev) * 100
	} else if beCurrent > 0 {
		trend = 100
	}

	volumeScore := minFloat(totalBE, 100)
	trendScore := clamp(50+(trend/2), 0, 100)
	freqScore := minFloat(float64(freq3Mo*5), 100)

	score := int((volumeScore * 0.40) + (trendScore * 0.40) + (freqScore * 0.20))
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}

	return OHSResult{
		Score:   score,
		TotalBE: totalBE,
		AvgBE:   avgBE,
		Trend:   trend,
		Freq3Mo: freq3Mo,
		Breakdown: OHSBreakdown{
			Volume:    int(volumeScore),
			Trend:     int(trendScore),
			Frequency: int(freqScore),
		},
	}
}

func clamp(val, min, max float64) float64 {
	if val < min {
		return min
	}
	if val > max {
		return max
	}
	return val
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
