// 동행복권 공식 로또 볼 색상 클래스 매핑
export function ballClass(n: number): string {
  if (n <= 10) return "num n-1-10";
  if (n <= 20) return "num n-11-20";
  if (n <= 30) return "num n-21-30";
  if (n <= 40) return "num n-31-40";
  return "num n-41-45";
}
