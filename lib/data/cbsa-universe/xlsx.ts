import ExcelJS from "exceljs";
import {
  DELINEATION_COLUMNS,
  PRINCIPAL_CITY_COLUMNS,
} from "./constants.ts";
import type { SourceRow } from "./types.ts";

type WorkbookSpec = {
  worksheetName: string;
  titleFragment: string;
  columns: readonly string[];
};

export const DELINEATION_WORKBOOK_SPEC: WorkbookSpec = {
  worksheetName: "List 1",
  titleFragment: "JULY 2023",
  columns: DELINEATION_COLUMNS,
};

export const PRINCIPAL_CITY_WORKBOOK_SPEC: WorkbookSpec = {
  worksheetName: "List 2",
  titleFragment: "JULY 2023",
  columns: PRINCIPAL_CITY_COLUMNS,
};

function primitiveCellValue(
  value: ExcelJS.CellValue,
  row: number,
  column: number,
): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  throw new Error(
    `Unexpected non-scalar cell value at row ${row}, column ${column}.`,
  );
}

function assertWorkbookShape(
  workbook: ExcelJS.Workbook,
  spec: WorkbookSpec,
): ExcelJS.Worksheet {
  if (workbook.worksheets.length !== 1) {
    throw new Error(
      `Expected exactly one worksheet, found ${workbook.worksheets.length}.`,
    );
  }
  const worksheet = workbook.getWorksheet(spec.worksheetName);
  if (!worksheet) {
    throw new Error(`Required worksheet ${spec.worksheetName} is missing.`);
  }
  const title = primitiveCellValue(worksheet.getCell(2, 1).value, 2, 1);
  if (typeof title !== "string" || !title.includes(spec.titleFragment)) {
    throw new Error(
      `Worksheet ${spec.worksheetName} does not contain the expected July 2023 title.`,
    );
  }
  const actualHeaders = spec.columns.map((_, index) =>
    primitiveCellValue(worksheet.getCell(3, index + 1).value, 3, index + 1),
  );
  if (
    actualHeaders.length !== spec.columns.length ||
    actualHeaders.some((header, index) => header !== spec.columns[index])
  ) {
    throw new Error(
      `Worksheet ${spec.worksheetName} columns changed. Expected: ${spec.columns.join(
        " | ",
      )}. Found: ${actualHeaders.join(" | ")}.`,
    );
  }
  for (let index = spec.columns.length + 1; index <= worksheet.columnCount; index++) {
    const header = primitiveCellValue(worksheet.getCell(3, index).value, 3, index);
    if (header !== null) {
      throw new Error(
        `Worksheet ${spec.worksheetName} contains unexpected column ${index}: ${header}.`,
      );
    }
  }
  return worksheet;
}

function isBlankDataRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnCount: number,
): boolean {
  return Array.from({ length: columnCount }, (_, index) =>
    primitiveCellValue(
      worksheet.getCell(rowNumber, index + 1).value,
      rowNumber,
      index + 1,
    ),
  ).every((value) => value === null);
}

function assertFooter(
  worksheet: ExcelJS.Worksheet,
  blankRowNumber: number,
): void {
  const note = primitiveCellValue(
    worksheet.getCell(blankRowNumber + 1, 1).value,
    blankRowNumber + 1,
    1,
  );
  const source = primitiveCellValue(
    worksheet.getCell(blankRowNumber + 2, 1).value,
    blankRowNumber + 2,
    1,
  );
  if (
    typeof note !== "string" ||
    !note.startsWith("Note:") ||
    typeof source !== "string" ||
    !source.startsWith("Source:")
  ) {
    throw new Error(
      `Worksheet ${worksheet.name} footer changed after data row ${blankRowNumber - 1}.`,
    );
  }
  for (let row = blankRowNumber + 3; row <= worksheet.rowCount; row++) {
    if (!isBlankDataRow(worksheet, row, worksheet.columnCount)) {
      throw new Error(
        `Worksheet ${worksheet.name} contains unexpected content after its footer at row ${row}.`,
      );
    }
  }
}

export async function readSourceRowsFromWorkbook(
  filePath: string,
  spec: WorkbookSpec,
): Promise<SourceRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = assertWorkbookShape(workbook, spec);
  const rows: SourceRow[] = [];
  let blankRowNumber: number | null = null;

  for (let rowNumber = 4; rowNumber <= worksheet.rowCount; rowNumber++) {
    if (isBlankDataRow(worksheet, rowNumber, spec.columns.length)) {
      blankRowNumber = rowNumber;
      break;
    }
    const values = Object.fromEntries(
      spec.columns.map((column, index) => [
        column,
        primitiveCellValue(
          worksheet.getCell(rowNumber, index + 1).value,
          rowNumber,
          index + 1,
        ),
      ]),
    );
    rows.push({ row_number: rowNumber, values });
  }

  if (rows.length === 0 || blankRowNumber === null) {
    throw new Error(
      `Worksheet ${spec.worksheetName} does not contain a terminated data block.`,
    );
  }
  assertFooter(worksheet, blankRowNumber);
  return rows;
}

export async function readCbsaSourceWorkbooks(
  delineationPath: string,
  principalCityPath: string,
): Promise<{
  delineationRows: SourceRow[];
  principalCityRows: SourceRow[];
}> {
  const [delineationRows, principalCityRows] = await Promise.all([
    readSourceRowsFromWorkbook(delineationPath, DELINEATION_WORKBOOK_SPEC),
    readSourceRowsFromWorkbook(
      principalCityPath,
      PRINCIPAL_CITY_WORKBOOK_SPEC,
    ),
  ]);
  return { delineationRows, principalCityRows };
}
