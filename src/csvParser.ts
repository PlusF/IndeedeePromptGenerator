export type ColumnMapping = {
  freee: string;
  current: string;
};

export type CurrentSalaryData = {
  [key: string]: string;
};

export type ParseResult<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: string };

// CSVの1行をパースする関数（引用符とカンマを正しく処理）
const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 2つ連続の引用符はエスケープされた引用符
        current += '"';
        i++; // 次の引用符をスキップ
      } else {
        // 引用符の開始または終了
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // 引用符の外のカンマはフィールドの区切り
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // 最後のフィールドを追加
  result.push(current);

  return result;
};

// マッピングファイルを解析する関数
export const parseMappingFile = (
  text: string
): ParseResult<{
  overtimeData: ColumnMapping[];
  employeeCode: ColumnMapping;
  fixedOvertimeAllowance: ColumnMapping;
  fixedOvertimeExcess: ColumnMapping;
}> => {
  try {
    // ファイルが空でないかチェック
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error:
          "マッピングファイルが空です。正しいCSVファイルを選択してください。",
      };
    }

    const lines = text.split("\n");

    // 各行をパースし、1~3列目のみに絞る
    const records = lines.map((line) => {
      const columns = parseCsvLine(line);
      return columns.slice(0, 3);
    });

    // 「従業員番号」の行を探してカラム名を取得
    let employeeCode: ColumnMapping = { freee: "", current: "" };
    for (let i = 0; i < records.length; i++) {
      if (records[i][1] && records[i][1].includes("従業員番号")) {
        employeeCode = {
          freee: records[i][1]?.trim() || "",
          current: records[i][2]?.trim() || "",
        };
        break;
      }
    }

    // 「固定残業代」の行を探してカラム名を取得
    let fixedOvertimeAllowance: ColumnMapping = { freee: "", current: "" };
    for (let i = 0; i < records.length; i++) {
      if (records[i][0] && records[i][0].includes("固定残業代")) {
        fixedOvertimeAllowance = {
          freee: records[i][1]?.trim() || "",
          current: records[i][2]?.trim() || "",
        };
        break;
      }
    }

    // 「固定残業超過」の行を探してカラム名を取得
    let fixedOvertimeExcess: ColumnMapping = { freee: "", current: "" };
    for (let i = 0; i < records.length; i++) {
      if (records[i][0] && records[i][0].includes("固定残業超過")) {
        fixedOvertimeExcess = {
          freee: records[i][1]?.trim() || "",
          current: records[i][2]?.trim() || "",
        };
        break;
      }
    }

    // 「割増賃金」の行を探す
    let startIndex = -1;
    for (let i = 0; i < records.length; i++) {
      if (records[i][0] && records[i][0].includes("割増賃金")) {
        startIndex = i;
        break;
      }
    }

    if (startIndex === -1) {
      return {
        success: false,
        error:
          "マッピングファイルに「割増賃金」の行が見つかりませんでした。「P2.マッピング」シートからエクスポートしたCSVファイルを選択してください。",
      };
    }

    // 1列目に「欠勤控除」がある行を探す
    let endIndex = -1;
    for (let i = startIndex + 1; i < records.length; i++) {
      if (records[i][0] && records[i][0].includes("欠勤控除")) {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      endIndex = records.length;
    }

    // 範囲のデータを抽出（2,3列目）
    const result: ColumnMapping[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      const row = records[i];
      if (row[1] || row[2]) {
        result.push({
          freee: row[1] || "",
          current: row[2] || "",
        });
      }
    }

    // データが正しく読み込めたかチェック
    if (result.length === 0) {
      return {
        success: false,
        error:
          "マッピングデータが見つかりませんでした。「割増賃金」セクションにデータが含まれていることを確認してください。",
      };
    }

    return {
      success: true,
      data: {
        overtimeData: result,
        employeeCode,
        fixedOvertimeAllowance,
        fixedOvertimeExcess,
      },
      message: `マッピングファイルを読み込みました (${result.length}件)`,
    };
  } catch {
    return {
      success: false,
      error:
        "マッピングファイルの読み込み中にエラーが発生しました。ファイル形式を確認してください。",
    };
  }
};

// 現行給与ファイルを解析する関数
export const parseCurrentSalaryFile = (
  text: string
): ParseResult<{
  data: CurrentSalaryData[];
  columns: string[];
}> => {
  try {
    // ファイルが空でないかチェック
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error:
          "現行給与ファイルが空です。正しいCSVファイルを選択してください。",
      };
    }

    const lines = text.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      return {
        success: false,
        error:
          "現行給与ファイルが空またはヘッダーのみです。データ行が含まれているCSVファイルを選択してください。",
      };
    }

    const headers = parseCsvLine(lines[0]);

    // ヘッダーの重複チェック
    const headerSet = new Set(headers);
    if (headerSet.size !== headers.length) {
      // 重複しているカラム名を見つける
      const duplicates = headers.filter(
        (item, index) => headers.indexOf(item) !== index
      );
      const uniqueDuplicates = Array.from(new Set(duplicates));
      return {
        success: false,
        error: `現行給与ファイルのヘッダーに重複があります: ${uniqueDuplicates.join(
          ", "
        )}。正しいCSVファイルを選択してください。`,
      };
    }

    const data: CurrentSalaryData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);

      // 空行をスキップ
      if (values.every((v) => !v.trim())) {
        continue;
      }

      const row: CurrentSalaryData = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      data.push(row);
    }

    // データが正しく読み込めたかチェック
    if (data.length === 0) {
      return {
        success: false,
        error:
          "現行給与データが見つかりませんでした。データ行が含まれているCSVファイルを選択してください。",
      };
    }

    return {
      success: true,
      data: { data, columns: headers },
      message: `現行給与ファイルを読み込みました (${data.length}件)`,
    };
  } catch {
    return {
      success: false,
      error:
        "現行給与ファイルの読み込み中にエラーが発生しました。ファイル形式を確認してください。",
    };
  }
};
