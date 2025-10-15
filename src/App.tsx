import {
  Button,
  Checkbox,
  Container,
  FileInput,
  Group,
  MultiSelect,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMemo, useState } from "react";

type OvertimeData = {
  freee: string;
  current: string;
};

type CurrentSalaryData = {
  [key: string]: string;
};

// Markdown KV形式のテキストを生成
const generatePrompt = (
  year: number,
  month: number,
  overtimeData: OvertimeData[],
  currentSalaryData: CurrentSalaryData[]
) => {
  const markdownParts: string[] = [];

  // 年月を最上部に追加
  markdownParts.push(`${year}年${month}月\n\n`);

  // currentカラム名からfreeeカラム名へのマッピングを作成
  const currentToFreeeMap = new Map<string, string>();
  overtimeData.forEach((item) => {
    if (item.current.trim() && item.freee.trim()) {
      currentToFreeeMap.set(item.current, item.freee);
    }
  });

  const extractColumns = Array.from(
    new Set(
      overtimeData
        .map((item) => item.current)
        .filter((col) => col.trim() !== "")
    )
  );

  currentSalaryData.forEach((employee) => {
    const employeeCode = employee["従業員コード"] || "";

    markdownParts.push(`# 従業員番号: ${employeeCode}\n`);

    // マッピングで指定されたカラムを抽出
    extractColumns.forEach((colName) => {
      const value = employee[colName] || "";
      const freeeColName = currentToFreeeMap.get(colName) || colName;
      markdownParts.push(`${freeeColName}: ${value}\n`);
    });

    markdownParts.push("\n");
  });

  return markdownParts.join("");
};

function App() {
  const [year, setYear] = useState<string>("2025");
  const [month, setMonth] = useState<string>("10");
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [currentSalaryFile, setCurrentSalaryFile] = useState<File | null>(null);
  const [overtimeData, setOvertimeData] = useState<OvertimeData[]>([]);
  const [currentSalaryData, setCurrentSalaryData] = useState<
    CurrentSalaryData[]
  >([]);
  const [currentSalaryColumns, setCurrentSalaryColumns] = useState<string[]>(
    []
  );
  const [filterApplied, setFilterApplied] = useState<boolean>(false);
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<string[]>([]);

  // マッピングファイルを処理する関数
  const handleMappingFileSelect = (file: File | null) => {
    if (!file) return;
    setMappingFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n");

      // 各行をカンマで分割し、1~3列目のみに絞る
      const records = lines.map((line) => {
        const columns = line.split(",");
        return columns.slice(0, 3);
      });

      // 「割増賃金」の行を探す
      let startIndex = -1;
      for (let i = 0; i < records.length; i++) {
        if (records[i][0] && records[i][0].includes("割増賃金")) {
          startIndex = i;
          break;
        }
      }

      if (startIndex === -1) {
        console.log("「割増賃金」の行が見つかりませんでした");
        return;
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
      const result: OvertimeData[] = [];
      for (let i = startIndex; i < endIndex; i++) {
        const row = records[i];
        if (row[1] || row[2]) {
          result.push({
            freee: row[1] || "",
            current: row[2] || "",
          });
        }
      }

      setOvertimeData(result);
    };

    reader.readAsText(file);
  };

  // 現行給与ファイルを処理する関数
  const handleCurrentSalaryFileSelect = (file: File | null) => {
    if (!file) return;
    setCurrentSalaryFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        console.log("CSVファイルが空またはヘッダーのみです");
        return;
      }

      const headerLine = lines[0].replace(/^\s*\d+→/, ""); // 行番号を削除
      const headers = headerLine.split(",");
      setCurrentSalaryColumns(headers);

      const data: CurrentSalaryData[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].replace(/^\s*\d+→/, ""); // 行番号を削除
        const values = line.split(",");

        // 空行をスキップ
        if (values.every((v) => !v.trim())) {
          continue;
        }

        const row: CurrentSalaryData = {};
        headers.forEach((header, index) => {
          row[header] = values[index]?.replace(/"/g, "") || "";
        });
        data.push(row);
      }

      setCurrentSalaryData(data);
    };

    reader.readAsText(file);
  };

  const availableFilterValues = useMemo(() => {
    if (!filterColumn || currentSalaryData.length === 0) {
      return [];
    }
    return Array.from(
      new Set(
        currentSalaryData
          .map((row) => row[filterColumn])
          .filter((value) => value && value.trim() !== "")
      )
    ).sort();
  }, [filterColumn, currentSalaryData]);

  const filteredCurrentSalaryData = useMemo(() => {
    if (!filterApplied || !filterColumn || filterValues.length === 0) {
      return currentSalaryData;
    }
    return currentSalaryData.filter((row) =>
      filterValues.includes(row[filterColumn])
    );
  }, [filterApplied, filterColumn, filterValues, currentSalaryData]);

  const generatedPrompt = useMemo(() => {
    if (overtimeData.length === 0 || filteredCurrentSalaryData.length === 0) {
      return "";
    }
    return generatePrompt(
      parseInt(year),
      parseInt(month),
      overtimeData,
      filteredCurrentSalaryData
    );
  }, [year, month, overtimeData, filteredCurrentSalaryData]);

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Title order={1}>Indeedee Prompt</Title>

        <Stack gap="md">
          <Title order={2}>年月</Title>
          <Group>
            <Select
              label="年"
              data={Array.from({ length: 10 }, (_, i) => {
                const y = 2020 + i;
                return { value: String(y), label: `${y}年` };
              })}
              value={year}
              onChange={(value) => setYear(value || "2025")}
              style={{ width: "150px" }}
            />
            <Select
              label="月"
              data={Array.from({ length: 12 }, (_, i) => {
                const m = i + 1;
                return { value: String(m), label: `${m}月` };
              })}
              value={month}
              onChange={(value) => setMonth(value || "10")}
              style={{ width: "150px" }}
            />
          </Group>
        </Stack>

        <Stack gap="md">
          <Title order={2}>マッピング</Title>
          <Text c="dimmed">
            「P2.マッピング」のシートをcsvでダウンロードしたものを読み込ませてください。割増賃金のマッピングを自動で読み込みます。
          </Text>
          <FileInput
            accept="text/csv"
            placeholder="CSVファイルを選択"
            value={mappingFile}
            onChange={handleMappingFileSelect}
          />
          {overtimeData.length > 0 && (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>freee</Table.Th>
                  <Table.Th>現行給与</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {overtimeData.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>{item.freee}</Table.Td>
                    <Table.Td>{item.current}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>

        <Stack gap="md">
          <Title order={2}>現行給与</Title>
          <Text c="dimmed">
            「②現行給与」のシートをcsvでダウンロードしたものを読み込ませてください。
          </Text>
          <FileInput
            accept="text/csv"
            placeholder="CSVファイルを選択"
            value={currentSalaryFile}
            onChange={handleCurrentSalaryFileSelect}
          />
          {currentSalaryData.length > 0 && (
            <>
              <Checkbox
                label="フィルターを適用（一種類の勤務賃金設定に絞ってください）"
                checked={filterApplied}
                onChange={(event) =>
                  setFilterApplied(event.currentTarget.checked)
                }
              />
              {filterApplied && (
                <Group>
                  <Select
                    placeholder="カラムを選択"
                    data={currentSalaryColumns}
                    value={filterColumn}
                    onChange={(value) => {
                      setFilterColumn(value);
                      setFilterValues([]); // カラム変更時にフィルター値をリセット
                    }}
                    style={{ flex: 1 }}
                  />
                  <MultiSelect
                    placeholder="値を選択"
                    data={availableFilterValues}
                    value={filterValues}
                    onChange={setFilterValues}
                    style={{ flex: 2 }}
                  />
                </Group>
              )}
              <Table
                striped
                highlightOnHover
                withTableBorder
                withColumnBorders
                horizontalSpacing="md"
              >
                <Table.Thead>
                  <Table.Tr>
                    {currentSalaryColumns.map((col) => (
                      <Table.Th key={col} style={{ minWidth: "150px" }}>
                        {col}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredCurrentSalaryData.map((item, index) => (
                    <Table.Tr key={index}>
                      {currentSalaryColumns.map((col) => (
                        <Table.Td key={col} style={{ minWidth: "150px" }}>
                          {item[col] || ""}
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}
        </Stack>

        <Stack gap="md">
          <Title order={2}>プロンプト</Title>
          {generatedPrompt && (
            <>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(generatedPrompt);
                  notifications.show({
                    title: "成功",
                    message: "クリップボードにコピーしました",
                    color: "green",
                  });
                }}
              >
                クリップボードにコピー
              </Button>
              <Textarea value={generatedPrompt} rows={20} readOnly />
            </>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}

export default App;
