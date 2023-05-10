import { existsSync, mkdirSync } from "fs";

export const SOURCE_PATH = "input/source.pas";
export const ERR_PATH = "output/source.err";
export const DYD_PATH = "output/source.dyd";
export const DYS_PATH = "output/source.dys";
export const VAR_PATH = "output/source.var";
export const PRO_PATH = "output/source.pro";

if (!existsSync("output")) {
  mkdirSync("output");
}
