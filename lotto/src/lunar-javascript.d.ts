declare module "lunar-javascript" {
  export interface LunarObj {
    getDayInGanZhi(): string;
    getYearInGanZhi(): string;
    getMonthInGanZhi(): string;
  }
  export interface SolarObj {
    getLunar(): LunarObj;
  }
  export const Solar: {
    fromYmd(y: number, m: number, d: number): SolarObj;
  };
}
