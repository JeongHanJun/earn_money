-- 2026-09-28: Altman Z''-EM(3.25 상수 포함) 컷오프를 5.85 / 4.35로 바로잡고 composite 재계산
UPDATE distress_scores SET altman_grade = CASE WHEN altman_z_em > 5.85 THEN 'SAFE' WHEN altman_z_em >= 4.35 THEN 'GREY' ELSE 'DISTRESS' END WHERE altman_z_em IS NOT NULL;
UPDATE distress_scores SET composite_risk = (CASE altman_grade WHEN 'SAFE' THEN 0 WHEN 'GREY' THEN 30 WHEN 'DISTRESS' THEN 70 ELSE 15 END) + (CASE piotroski_grade WHEN 'STRONG' THEN 0 WHEN 'MID' THEN 10 WHEN 'WEAK' THEN 20 ELSE 10 END);
UPDATE distress_scores SET composite_grade = CASE WHEN composite_risk < 25 THEN 'LOW' WHEN composite_risk < 50 THEN 'MEDIUM' WHEN composite_risk < 75 THEN 'HIGH' ELSE 'CRITICAL' END;
SELECT altman_grade, COUNT(*) AS n FROM distress_scores GROUP BY altman_grade;
